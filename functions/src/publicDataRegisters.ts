import type { Request, Response } from "express";

// ─── 응답 인터페이스 ───────────────────────────────────────────

export interface LandRegisterResult {
  pnu: string;
  address: string;
  landCategory: string; // 지목 (전, 답, 대, 임 등)
  area: number; // 면적 (㎡)
  useDistrict: string; // 용도지역
  source: "api";
}

export interface BuildingRegisterResult {
  address: string;
  mainPurpose: string; // 주용도
  totalArea: number; // 연면적 (㎡)
  buildingArea: number; // 건축면적 (㎡)
  aboveGroundFloors: number; // 지상층수
  underGroundFloors: number; // 지하층수
  buildDate: string; // 사용승인일
  source: "api";
}

export interface BuildingAreaItem {
  address: string;
  floorNo: string; // 층번호
  floorNoNm: string; // 층명칭
  exposPubuseGbCdNm: string; // 전유/공용 구분
  mainAtchGbCdNm: string; // 주/부속 구분
  area: number; // 면적 (㎡)
  mainPurpsCdNm: string; // 주용도
  source: "api";
}

// ─── 상수 ──────────────────────────────────────────────────────

const LAND_USE_BASE_URL =
  "http://apis.data.go.kr/1611000/nsdi/LandUseService/attr/getLandUseAttr";

const BUILDING_TITLE_BASE_URL =
  "http://apis.data.go.kr/1613000/BldRgstService/getBrTitleInfo";

const BUILDING_AREA_BASE_URL =
  "http://apis.data.go.kr/1613000/BldRgstService/getBrExposPubuseAreaInfo";

const API_TIMEOUT_MS = 8000;

// ─── 유틸 ──────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.PUBLIC_DATA_API_KEY ?? null;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = API_TIMEOUT_MS
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ─── 1. 토지대장 조회 ─────────────────────────────────────────

export async function handleLandRegister(
  req: Request,
  res: Response
): Promise<void> {
  const pnu = (req.query.pnu as string) ?? "";

  if (!pnu || pnu.length < 19) {
    res.status(400).json({ error: "PNU(필지고유번호) 19자리가 필요합니다" });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: "API 키 미설정" });
    return;
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pnu,
    format: "json",
    numOfRows: "10",
    pageNo: "1",
  });

  const url = `${LAND_USE_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      res.status(502).json({
        error: `토지대장 API 호출 실패 (HTTP ${response.status})`,
      });
      return;
    }

    const data = await response.json();

    // data.go.kr 표준 응답 구조 파싱
    const fields =
      data?.landUses?.field ??
      data?.response?.body?.items?.item ??
      data?.field;

    if (!fields) {
      res.status(404).json({
        error: "해당 PNU에 대한 토지대장 정보를 찾을 수 없습니다",
        raw: data,
      });
      return;
    }

    // 단건/다건 통일
    const items = Array.isArray(fields) ? fields : [fields];
    const first = items[0];

    const result: LandRegisterResult = {
      pnu,
      address: first.ldCodeNm ?? first.lnbrMnnm ?? "",
      landCategory: first.regstrSeCodeNm ?? first.jimokNm ?? "",
      area: parseFloat(first.lndpclAr ?? first.pclAr ?? "0"),
      useDistrict: first.prposAreaDstrcCodeNm ?? first.cnflcAtNm ?? "",
      source: "api",
    };

    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      res.status(504).json({ error: "토지대장 API 응답 타임아웃 (8초 초과)" });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `토지대장 API 호출 중 오류: ${message}` });
  }
}

// ─── 2. 건축물대장 표제부 조회 ─────────────────────────────────

export async function handleBuildingRegister(
  req: Request,
  res: Response
): Promise<void> {
  const sigunguCd = (req.query.sigunguCd as string) ?? "";
  const bjdongCd = (req.query.bjdongCd as string) ?? "";
  const bun = (req.query.bun as string) ?? "";
  const ji = (req.query.ji as string) ?? "0000";

  // 유효성 검증
  if (!sigunguCd || sigunguCd.length !== 5) {
    res
      .status(400)
      .json({ error: "시군구코드(sigunguCd) 5자리가 필요합니다" });
    return;
  }
  if (!bjdongCd || bjdongCd.length !== 5) {
    res
      .status(400)
      .json({ error: "법정동코드(bjdongCd) 5자리가 필요합니다" });
    return;
  }
  if (!bun || bun.length !== 4) {
    res.status(400).json({ error: "본번(bun) 4자리가 필요합니다" });
    return;
  }
  if (ji.length !== 4) {
    res.status(400).json({ error: "부번(ji) 4자리가 필요합니다" });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: "API 키 미설정" });
    return;
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    sigunguCd,
    bjdongCd,
    platGbCd: "0",
    bun,
    ji,
    numOfRows: "10",
    pageNo: "1",
    type: "json",
  });

  const url = `${BUILDING_TITLE_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      res.status(502).json({
        error: `건축물대장 API 호출 실패 (HTTP ${response.status})`,
      });
      return;
    }

    const data = await response.json();

    const items =
      data?.response?.body?.items?.item ?? data?.body?.items?.item ?? null;

    if (!items) {
      res.status(404).json({
        error: "해당 주소에 대한 건축물대장 정보를 찾을 수 없습니다",
        raw: data,
      });
      return;
    }

    const list = Array.isArray(items) ? items : [items];
    const first = list[0];

    const result: BuildingRegisterResult = {
      address: first.platPlc ?? first.newPlatPlc ?? "",
      mainPurpose: first.mainPurpsCdNm ?? "",
      totalArea: parseFloat(first.totArea ?? "0"),
      buildingArea: parseFloat(first.archArea ?? "0"),
      aboveGroundFloors: parseInt(first.grndFlrCnt ?? "0", 10),
      underGroundFloors: parseInt(first.ugrndFlrCnt ?? "0", 10),
      buildDate: first.useAprDay ?? first.crtnDay ?? "",
      source: "api",
    };

    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      res
        .status(504)
        .json({ error: "건축물대장 API 응답 타임아웃 (8초 초과)" });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res
      .status(502)
      .json({ error: `건축물대장 API 호출 중 오류: ${message}` });
  }
}

// ─── 3. 건축물대장 전유공용면적 조회 ──────────────────────────

export async function handleBuildingArea(
  req: Request,
  res: Response
): Promise<void> {
  const sigunguCd = (req.query.sigunguCd as string) ?? "";
  const bjdongCd = (req.query.bjdongCd as string) ?? "";
  const bun = (req.query.bun as string) ?? "";
  const ji = (req.query.ji as string) ?? "0000";

  // 유효성 검증
  if (!sigunguCd || sigunguCd.length !== 5) {
    res
      .status(400)
      .json({ error: "시군구코드(sigunguCd) 5자리가 필요합니다" });
    return;
  }
  if (!bjdongCd || bjdongCd.length !== 5) {
    res
      .status(400)
      .json({ error: "법정동코드(bjdongCd) 5자리가 필요합니다" });
    return;
  }
  if (!bun || bun.length !== 4) {
    res.status(400).json({ error: "본번(bun) 4자리가 필요합니다" });
    return;
  }
  if (ji.length !== 4) {
    res.status(400).json({ error: "부번(ji) 4자리가 필요합니다" });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: "API 키 미설정" });
    return;
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    sigunguCd,
    bjdongCd,
    platGbCd: "0",
    bun,
    ji,
    numOfRows: "100",
    pageNo: "1",
    type: "json",
  });

  const url = `${BUILDING_AREA_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      res.status(502).json({
        error: `건축물대장 전유공용면적 API 호출 실패 (HTTP ${response.status})`,
      });
      return;
    }

    const data = await response.json();

    const items =
      data?.response?.body?.items?.item ?? data?.body?.items?.item ?? null;

    if (!items) {
      res.status(404).json({
        error: "해당 주소에 대한 전유공용면적 정보를 찾을 수 없습니다",
        raw: data,
      });
      return;
    }

    const list = Array.isArray(items) ? items : [items];

    const results: BuildingAreaItem[] = list.map((item: Record<string, string>) => ({
      address: item.platPlc ?? item.newPlatPlc ?? "",
      floorNo: item.flrNo ?? "",
      floorNoNm: item.flrNoNm ?? "",
      exposPubuseGbCdNm: item.exposPubuseGbCdNm ?? "",
      mainAtchGbCdNm: item.mainAtchGbCdNm ?? "",
      area: parseFloat(item.area ?? "0"),
      mainPurpsCdNm: item.mainPurpsCdNm ?? item.etcPurps ?? "",
      source: "api" as const,
    }));

    res.status(200).json(results);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      res.status(504).json({
        error: "건축물대장 전유공용면적 API 응답 타임아웃 (8초 초과)",
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: `건축물대장 전유공용면적 API 호출 중 오류: ${message}`,
    });
  }
}
