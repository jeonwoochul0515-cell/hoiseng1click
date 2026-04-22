import type { Request, Response } from "express";
import { addressToPnu } from "./publicDataProxy";

// ---------------------------------------------------------------------------
// [Phase B-3] VWORLD 국가중점데이터 API (CODEF reb-estate-* 대체)
// 응답 포맷은 data.go.kr NSDI 와 동일. 호출 시 Referer 헤더 필수.
// ---------------------------------------------------------------------------
const VWORLD_PRICE_API = {
  APT: "https://api.vworld.kr/ned/data/getApartHousingPriceAttr",
  HOUSE: "https://api.vworld.kr/ned/data/getIndvdHousingPriceAttr",
  LAND: "https://api.vworld.kr/ned/data/getIndvdLandPriceAttr",
} as const;
const VWORLD_REFERER = "https://hoiseng1click.web.app";

/**
 * VWORLD 국가중점데이터 API 로 공시가격 조회. CODEF 의존성 제거.
 * PNU + 기준연도(YYYY) 입력 → { rawPrice, stdrYear, standardDate, buildingName }
 */
async function fetchPublicDataPrice(opts: {
  type: "apt" | "house" | "land";
  pnu: string;
  stdrYear?: string;
}): Promise<{
  rawPrice: number;
  area: number;
  stdrYear: string;
  standardDate: string;
  buildingName: string;
} | null> {
  const vworldKey = process.env.VWORLD_API_KEY ?? "";
  if (!vworldKey) return null;

  const apiUrl =
    opts.type === "apt" ? VWORLD_PRICE_API.APT :
    opts.type === "house" ? VWORLD_PRICE_API.HOUSE :
    VWORLD_PRICE_API.LAND;
  const priceField = opts.type === "land" ? "pblntfPclnd" : "pblntfPc";

  const year = (opts.stdrYear && /^\d{4}$/.test(opts.stdrYear))
    ? opts.stdrYear
    : String(new Date().getFullYear());

  const params = new URLSearchParams({
    key: vworldKey,
    pnu: opts.pnu,
    stdrYear: year,
    format: "json",
    numOfRows: "10",
    pageNo: "1",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${apiUrl}?${params}`, {
      signal: controller.signal,
      headers: { Referer: VWORLD_REFERER },
    });
    clearTimeout(timeout);
    if (!r.ok) return null;

    const data = (await r.json()) as any;
    const fields =
      data?.indvdLandPrices?.field ??
      data?.apartHousingPrices?.field ??
      data?.indvdHousingPrices?.field ??
      data?.field ??
      [];
    const first = Array.isArray(fields) ? fields[0] : fields;
    if (!first) return null;

    const rawPrice = Number(first[priceField] ?? 0);
    if (!rawPrice) return null;

    return {
      rawPrice,
      area: Number(first.prvuseAr ?? first.area ?? first.excluUseAr ?? 0),
      stdrYear: year,
      standardDate: String(first.lastUpdtDt ?? first.pblntfDe ?? year),
      buildingName: String(first.aphusNm ?? first.bdNm ?? first.aptBldNm ?? first.ldCodeNm ?? ""),
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CODEF OAuth & 호출 헬퍼
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";

function getCodefBase(): string {
  return process.env.CODEF_API_HOST || "https://api.codef.io";
}

let cachedToken: { token: string; expiry: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiry > Date.now()) return cachedToken.token;

  const clientId = process.env.CODEF_CLIENT_ID ?? "";
  const clientSecret = process.env.CODEF_CLIENT_SECRET ?? "";
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=read",
  });

  if (!res.ok) {
    throw new Error(`CODEF OAuth failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { access_token: string };
  if (!data.access_token) {
    throw new Error("CODEF OAuth response missing access_token");
  }
  cachedToken = { token: data.access_token, expiry: Date.now() + 6 * 24 * 60 * 60 * 1000 };
  return cachedToken.token;
}

async function callCodef(token: string, endpoint: string, body: object): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const jsonBody = JSON.stringify(body);

  try {
    const res = await fetch(`${getCodefBase()}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: jsonBody,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return JSON.parse(decodeURIComponent(text.replace(/\+/g, " "))); }
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`CODEF API error on ${endpoint}: ${err instanceof Error ? err.message : "호출 실패"}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. 차량등록원부 + 시세 조회
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /codef/vehicle-info
 * body: { carNumber: string, ownerName?: string, ownerBirthDate?: string }
 *
 * CODEF 차량 제원·시세 API를 통해 차량 정보 + 보험개발원 기준가액 조회
 * + 차량등록원부에서 저당/압류 정보 조회
 */
export async function handleVehicleInfo(req: Request, res: Response) {
  try {
    const { carNumber, ownerName, ownerBirthDate } = req.body as {
      carNumber: string;
      ownerName?: string;
      ownerBirthDate?: string; // YYYYMMDD
    };

    if (!carNumber) {
      res.status(400).json({ error: "차량번호가 필요합니다" });
      return;
    }

    const token = await getToken();

    // 병렬 호출: 차량 제원·시세 + 차량등록원부
    const [specResult, regResult] = await Promise.allSettled([
      callCodef(token, "/v1/kr/public/pp/car-spec-price", {
        organization: "0001",
        carNo: carNumber,
      }),
      callCodef(token, "/v1/kr/public/pp/car-registration-info", {
        organization: "0001",
        carNo: carNumber,
        identity: ownerBirthDate ?? "",
        userName: ownerName ?? "",
      }),
    ]);

    const specData = specResult.status === "fulfilled" ? (specResult.value as any) : null;
    const regData = regResult.status === "fulfilled" ? (regResult.value as any) : null;

    // 제원·시세 파싱
    const spec = specData?.data ?? {};
    const model = spec.resCarModel ?? spec.resModelName ?? "";
    const year = Number(spec.resYear ?? spec.resModelYear ?? new Date().getFullYear());
    const displacement = Number(spec.resDisplacement ?? 0);
    const fuelType = spec.resFuelType ?? "";
    const basePrice = Number(spec.resBasePrice ?? spec.resCarPrice ?? 0);
    const insurancePrice = Number(spec.resInsurancePrice ?? spec.resStandardPrice ?? basePrice);

    // 등록원부 파싱 — 저당/압류
    const regInfo = regData?.data ?? {};
    const mortgageList = regInfo.resMortgageList ?? [];
    const seizureList = regInfo.resSeizureList ?? [];
    const totalMortgage = mortgageList.reduce(
      (sum: number, m: any) => sum + Number(m.resAmount ?? m.resMortgageAmount ?? 0), 0,
    );
    const totalSeizure = seizureList.reduce(
      (sum: number, s: any) => sum + Number(s.resAmount ?? s.resSeizureAmount ?? 0), 0,
    );

    const liquidation70 = Math.floor(insurancePrice * 0.70);
    const netValue = Math.max(0, liquidation70 - totalMortgage - totalSeizure);

    res.json({
      carNumber,
      model,
      year,
      displacement,
      fuelType,
      basePrice: insurancePrice,
      liquidation70,
      mortgage: totalMortgage,
      seizure: totalSeizure,
      netValue,
      mortgageDetails: mortgageList,
      seizureDetails: seizureList,
      registrationDate: regInfo.resRegistrationDate ?? "",
      ownerCount: Number(regInfo.resOwnerCount ?? 0),
      source: specData ? "codef" : "codef_partial",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "차량 정보 조회 실패" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. 부동산 공시가격 조회 (data.go.kr NSDI — CODEF 유료 API 대체)
//    - CODEF 토큰·Connected ID 불필요 (인증키 기반 공공 API)
//    - 프론트엔드 호출 시그니처 유지, 내부 구현만 교체
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /codef/property-price
 * body: { address: string, propertyType?: 'apt'|'house'|'land', dong?: string, ho?: string, pnu?: string, stdrYear?: string }
 *
 * data.go.kr 공시가격 API 를 통해 공시가격 조회 (기존 CODEF reb-estate-* 대체).
 * 응답 포맷은 기존과 동일하게 유지 — 프론트 수정 불필요.
 */
export async function handlePropertyPrice(req: Request, res: Response) {
  try {
    const { address, propertyType, dong, ho, pnu, stdrYear } = req.body as {
      address: string;
      propertyType?: "apt" | "house" | "land";
      dong?: string;
      ho?: string;
      pnu?: string;
      stdrYear?: string;
    };

    if (!address && !pnu) {
      res.status(400).json({ error: "주소 또는 PNU가 필요합니다" });
      return;
    }

    const type = propertyType ?? "apt";

    // PNU 확보: 직접 입력 > 주소 변환
    let targetPnu = (pnu ?? "").trim();
    if (!targetPnu && address) {
      const converted = await addressToPnu(address);
      if (converted) targetPnu = converted;
    }

    if (!targetPnu || targetPnu.length !== 19) {
      res.json({
        address: address ?? "",
        propertyType: type,
        rawPrice: 0,
        area: 0,
        liquidation75: 0,
        standardDate: "",
        buildingName: "",
        dongHo: dong && ho ? `${dong}동 ${ho}호` : "",
        source: "codef_no_data",
        message: "PNU(19자리)를 확인할 수 없습니다. 주소를 구체적으로 입력하거나 브이월드 API 키를 설정해주세요.",
      });
      return;
    }

    const result = await fetchPublicDataPrice({
      type,
      pnu: targetPnu,
      stdrYear,
    });

    if (!result || result.rawPrice <= 0) {
      res.json({
        address: address ?? "",
        propertyType: type,
        rawPrice: 0,
        area: 0,
        liquidation75: 0,
        standardDate: "",
        buildingName: "",
        dongHo: dong && ho ? `${dong}동 ${ho}호` : "",
        source: "codef_no_data",
        message: "해당 주소의 공시가격 정보를 찾을 수 없습니다. 수동 입력해주세요.",
      });
      return;
    }

    // 개별공시지가는 원/㎡ — area 정보가 있으면 총액 계산 (없으면 단가 그대로)
    const rawPrice = result.rawPrice;

    res.json({
      address: address ?? "",
      propertyType: type,
      rawPrice,
      area: result.area,
      liquidation75: Math.floor(rawPrice * 0.75),
      standardDate: result.standardDate,
      buildingName: result.buildingName,
      dongHo: dong && ho ? `${dong}동 ${ho}호` : "",
      pnu: targetPnu,
      stdrYear: result.stdrYear,
      // 기존 'codef' source 라벨 유지 (프론트 PropertyLookup 의 sourceLabel 매핑 호환)
      source: "codef" as const,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "부동산 공시가격 조회 실패" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 통합 재산 조회 (차량 + 부동산 한번에)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /codef/asset-lookup
 * body: {
 *   vehicles: [{ carNumber, ownerName?, ownerBirthDate? }],
 *   properties: [{ address, propertyType?, dong?, ho? }],
 * }
 */
export async function handleAssetLookup(req: Request, res: Response) {
  try {
    const { vehicles, properties } = req.body as {
      vehicles?: Array<{ carNumber: string; ownerName?: string; ownerBirthDate?: string }>;
      properties?: Array<{ address: string; propertyType?: string; dong?: string; ho?: string }>;
    };

    const token = await getToken();

    // 차량 조회 병렬 실행
    const vehiclePromises = (vehicles ?? []).map(async (v) => {
      try {
        const [specResult, regResult] = await Promise.allSettled([
          callCodef(token, "/v1/kr/public/pp/car-spec-price", {
            organization: "0001", carNo: v.carNumber,
          }),
          callCodef(token, "/v1/kr/public/pp/car-registration-info", {
            organization: "0001", carNo: v.carNumber,
            identity: v.ownerBirthDate ?? "", userName: v.ownerName ?? "",
          }),
        ]);

        const spec = (specResult.status === "fulfilled" ? (specResult.value as any) : {})?.data ?? {};
        const reg = (regResult.status === "fulfilled" ? (regResult.value as any) : {})?.data ?? {};

        const insurancePrice = Number(spec.resInsurancePrice ?? spec.resStandardPrice ?? spec.resCarPrice ?? 0);
        const mortgageList = reg.resMortgageList ?? [];
        const seizureList = reg.resSeizureList ?? [];
        const totalMortgage = mortgageList.reduce((s: number, m: any) => s + Number(m.resAmount ?? m.resMortgageAmount ?? 0), 0);
        const totalSeizure = seizureList.reduce((s: number, m: any) => s + Number(m.resAmount ?? m.resSeizureAmount ?? 0), 0);
        const liq70 = Math.floor(insurancePrice * 0.70);

        return {
          carNumber: v.carNumber,
          model: spec.resCarModel ?? spec.resModelName ?? "",
          year: Number(spec.resYear ?? spec.resModelYear ?? 0),
          basePrice: insurancePrice,
          liquidation70: liq70,
          mortgage: totalMortgage,
          seizure: totalSeizure,
          netValue: Math.max(0, liq70 - totalMortgage - totalSeizure),
          source: "codef" as const,
        };
      } catch (err: any) {
        return { carNumber: v.carNumber, error: err.message, source: "error" as const };
      }
    });

    // 부동산 조회 병렬 실행 — data.go.kr 공시가격 API 사용 (CODEF reb-estate-* 대체)
    const propertyPromises = (properties ?? []).map(async (p) => {
      const type = (p.propertyType ?? "apt") as "apt" | "house" | "land";

      try {
        // 주소 → PNU 변환
        const pnu = await addressToPnu(p.address);
        if (!pnu) {
          return {
            address: p.address,
            propertyType: type,
            rawPrice: 0,
            liquidation75: 0,
            buildingName: "",
            source: "codef_no_data" as const,
          };
        }

        const result = await fetchPublicDataPrice({ type, pnu });
        if (!result) {
          return {
            address: p.address,
            propertyType: type,
            rawPrice: 0,
            liquidation75: 0,
            buildingName: "",
            source: "codef_no_data" as const,
          };
        }

        return {
          address: p.address,
          propertyType: type,
          rawPrice: result.rawPrice,
          liquidation75: Math.floor(result.rawPrice * 0.75),
          buildingName: result.buildingName,
          source: result.rawPrice > 0 ? "codef" as const : "codef_no_data" as const,
        };
      } catch (err: any) {
        return { address: p.address, error: err.message, source: "error" as const };
      }
    });

    const [vehicleResults, propertyResults] = await Promise.all([
      Promise.all(vehiclePromises),
      Promise.all(propertyPromises),
    ]);

    res.json({ vehicles: vehicleResults, properties: propertyResults });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "재산 조회 실패" });
  }
}

