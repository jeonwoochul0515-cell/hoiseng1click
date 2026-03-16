import type { Request, Response } from "express";

// ---------------------------------------------------------------------------
// CODEF OAuth & 호출 헬퍼
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";

function getCodefBase(): string {
  return process.env.CODEF_API_HOST || "https://development.codef.io";
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

function isSandbox(): boolean {
  const host = process.env.CODEF_API_HOST || "https://development.codef.io";
  const hasCredentials = !!(process.env.CODEF_CLIENT_ID && process.env.CODEF_CLIENT_SECRET);
  return !hasCredentials || host.includes("sandbox");
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

    // 샌드박스 모드
    if (isSandbox()) {
      await new Promise(r => setTimeout(r, 800));
      res.json(generateVehicleSandbox(carNumber));
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
// 2. 부동산 공시가격 조회 (CODEF 경유)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /codef/property-price
 * body: { address: string, propertyType?: 'apt'|'house'|'land', dong?: string, ho?: string }
 *
 * CODEF 부동산 공시가격 알리미 API를 통해 공시가격 조회
 */
export async function handlePropertyPrice(req: Request, res: Response) {
  try {
    const { address, propertyType, dong, ho } = req.body as {
      address: string;
      propertyType?: "apt" | "house" | "land";
      dong?: string;
      ho?: string;
    };

    if (!address) {
      res.status(400).json({ error: "주소가 필요합니다" });
      return;
    }

    // 샌드박스 모드
    if (isSandbox()) {
      await new Promise(r => setTimeout(r, 800));
      res.json(generatePropertySandbox(address, propertyType ?? "apt"));
      return;
    }

    const token = await getToken();
    const type = propertyType ?? "apt";

    let endpoint: string;
    let reqBody: object;

    switch (type) {
      case "apt":
        // 공동주택(아파트) 공시가격
        endpoint = "/v1/kr/public/pp/reb-estate-apartment-price";
        reqBody = {
          organization: "0001",
          address,
          dong: dong ?? "",
          ho: ho ?? "",
        };
        break;
      case "house":
        // 개별주택 공시가격
        endpoint = "/v1/kr/public/pp/reb-estate-individual-housing-price";
        reqBody = {
          organization: "0001",
          address,
        };
        break;
      case "land":
      default:
        // 개별공시지가
        endpoint = "/v1/kr/public/pp/reb-estate-individual-land-price";
        reqBody = {
          organization: "0001",
          address,
        };
        break;
    }

    const result = await callCodef(token, endpoint, reqBody) as any;

    const data = result?.data ?? {};
    const rawPrice = Number(
      data.resOfficialPrice ?? data.resPblntfPrice ?? data.resPrice ?? 0,
    );
    const area = Number(data.resArea ?? data.resExclusiveArea ?? 0);
    const stdDate = data.resStandardDate ?? data.resBaseDate ?? "";

    if (rawPrice <= 0) {
      // CODEF에서 결과 없으면 에러 대신 빈 결과
      res.json({
        address,
        propertyType: type,
        rawPrice: 0,
        liquidation75: 0,
        source: "codef_no_data",
        message: "해당 주소의 공시가격 정보를 찾을 수 없습니다. 수동 입력해주세요.",
      });
      return;
    }

    res.json({
      address,
      propertyType: type,
      rawPrice,
      area,
      liquidation75: Math.floor(rawPrice * 0.75),
      standardDate: stdDate,
      buildingName: data.resBuildingName ?? data.resAptName ?? "",
      dongHo: data.resDong && data.resHo ? `${data.resDong}동 ${data.resHo}호` : "",
      source: "codef",
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

    // 샌드박스 모드
    if (isSandbox()) {
      await new Promise(r => setTimeout(r, 1200));
      const vehicleResults = (vehicles ?? []).map(v => generateVehicleSandbox(v.carNumber));
      const propertyResults = (properties ?? []).map(p =>
        generatePropertySandbox(p.address, (p.propertyType as "apt" | "house" | "land") ?? "apt"),
      );
      res.json({ vehicles: vehicleResults, properties: propertyResults });
      return;
    }

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

    // 부동산 조회 병렬 실행
    const propertyPromises = (properties ?? []).map(async (p) => {
      const type = p.propertyType ?? "apt";
      let endpoint: string;
      let reqBody: object;
      switch (type) {
        case "apt":
          endpoint = "/v1/kr/public/pp/reb-estate-apartment-price";
          reqBody = { organization: "0001", address: p.address, dong: p.dong ?? "", ho: p.ho ?? "" };
          break;
        case "house":
          endpoint = "/v1/kr/public/pp/reb-estate-individual-housing-price";
          reqBody = { organization: "0001", address: p.address };
          break;
        default:
          endpoint = "/v1/kr/public/pp/reb-estate-individual-land-price";
          reqBody = { organization: "0001", address: p.address };
          break;
      }

      try {
        const result = await callCodef(token, endpoint, reqBody) as any;
        const data = result?.data ?? {};
        const rawPrice = Number(data.resOfficialPrice ?? data.resPblntfPrice ?? data.resPrice ?? 0);
        return {
          address: p.address,
          propertyType: type,
          rawPrice,
          liquidation75: Math.floor(rawPrice * 0.75),
          buildingName: data.resBuildingName ?? data.resAptName ?? "",
          source: rawPrice > 0 ? "codef" as const : "codef_no_data" as const,
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

// ═══════════════════════════════════════════════════════════════════════════
// 샌드박스 데이터 생성
// ═══════════════════════════════════════════════════════════════════════════

function generateVehicleSandbox(carNumber: string) {
  const models = ["소나타", "아반떼", "그랜저", "K5", "투싼", "싼타페", "카니발", "모닝"];
  const model = models[Math.floor(Math.random() * models.length)];
  const year = 2018 + Math.floor(Math.random() * 7);
  const age = new Date().getFullYear() - year;

  const basePrices: Record<string, number> = {
    "소나타": 28000000, "아반떼": 20000000, "그랜저": 38000000, "K5": 27000000,
    "투싼": 30000000, "싼타페": 35000000, "카니발": 40000000, "모닝": 12000000,
  };
  const depRates: Record<number, number> = {
    0: 1.0, 1: 0.82, 2: 0.70, 3: 0.60, 4: 0.52, 5: 0.44, 6: 0.37, 7: 0.31, 8: 0.26,
  };

  const newPrice = basePrices[model] ?? 25000000;
  const dep = depRates[Math.min(age, 8)] ?? 0.22;
  const insurancePrice = Math.floor(newPrice * dep);
  const liquidation70 = Math.floor(insurancePrice * 0.70);
  const hasMortgage = Math.random() > 0.7;
  const mortgage = hasMortgage ? Math.floor(Math.random() * 5000000 / 100000) * 100000 : 0;

  return {
    carNumber,
    model,
    year,
    displacement: 1600 + Math.floor(Math.random() * 4) * 500,
    fuelType: Math.random() > 0.3 ? "가솔린" : "디젤",
    basePrice: insurancePrice,
    liquidation70,
    mortgage,
    seizure: 0,
    netValue: Math.max(0, liquidation70 - mortgage),
    mortgageDetails: hasMortgage
      ? [{ creditor: "국민은행", resAmount: mortgage, resDate: "20230315" }]
      : [],
    seizureDetails: [],
    registrationDate: `${year}0${3 + Math.floor(Math.random() * 6)}15`,
    ownerCount: 1 + Math.floor(Math.random() * 2),
    source: "sandbox" as const,
  };
}

function generatePropertySandbox(address: string, propertyType: "apt" | "house" | "land") {
  const regionPrices: Record<string, number> = {
    "강남": 1200000000, "서초": 1100000000, "송파": 900000000, "마포": 750000000,
    "용산": 850000000, "성동": 700000000, "영등포": 650000000,
    "분당": 800000000, "일산": 500000000, "수원": 450000000,
  };

  let rawPrice = 350000000; // 기본값
  for (const [region, price] of Object.entries(regionPrices)) {
    if (address.includes(region)) {
      rawPrice = price + Math.floor((Math.random() - 0.5) * price * 0.2);
      break;
    }
  }

  if (propertyType === "house") rawPrice = Math.floor(rawPrice * 0.6);
  if (propertyType === "land") rawPrice = Math.floor(rawPrice * 0.4);

  return {
    address,
    propertyType,
    rawPrice,
    area: propertyType === "apt" ? 84 : propertyType === "house" ? 120 : 200,
    liquidation75: Math.floor(rawPrice * 0.75),
    standardDate: `${new Date().getFullYear()}0101`,
    buildingName: propertyType === "apt" ? "래미안 아파트" : "",
    dongHo: propertyType === "apt" ? "101동 1502호" : "",
    source: "sandbox" as const,
  };
}
