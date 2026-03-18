import type { Request, Response } from "express";

// ---------------------------------------------------------------------------
// CODEF OAuth & 호출 헬퍼 (codefProxy.ts에서 export되지 않으므로 자체 정의)
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";

function getCodefBase(): string {
  return process.env.CODEF_API_HOST || "https://development.codef.io";
}

let cachedToken: { token: string; expiry: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.CODEF_CLIENT_ID ?? "";
  const clientSecret = process.env.CODEF_CLIENT_SECRET ?? "";
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: jsonBody,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return JSON.parse(decodeURIComponent(text.replace(/\+/g, " ")));
    }
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(
      `CODEF API error on ${endpoint}: ${err instanceof Error ? err.message : "호출 실패"}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** 건강보험 자격득실확인서에서 추출되는 피부양자 정보 */
interface Dependent {
  name: string;
  relation: string; // 배우자, 자녀 등
  birthDate: string;
}

/** 건강보험 자격득실 결과 */
interface HealthInsuranceResult {
  qualificationType: string; // 직장가입자, 지역가입자 등
  qualificationDate: string;
  lossDate: string;
  companyName: string;
  dependents: Dependent[];
  raw: unknown;
}

/** 소득금액증명원 결과 */
interface IncomeProofResult {
  year: string;
  totalIncome: number;
  salaryIncome: number;
  businessIncome: number;
  otherIncome: number;
  raw: unknown;
}

/** 근로소득 원천징수영수증 결과 */
interface WithholdingTaxResult {
  year: string;
  companyName: string;
  totalSalary: number;
  taxAmount: number;
  raw: unknown;
}

/** 사업자등록증명원 결과 */
interface BusinessRegistrationResult {
  businessNumber: string;
  businessName: string;
  representative: string;
  businessType: string;
  businessCategory: string;
  registrationDate: string;
  raw: unknown;
}

/** 건강보험료 납부확인서 결과 */
interface HealthInsurancePremiumResult {
  payments: Array<{
    yearMonth: string;
    premiumAmount: number;
    paidDate: string;
  }>;
  totalAmount: number;
  raw: unknown;
}

/** 국민연금 가입증명서 결과 */
interface NationalPensionResult {
  joinDate: string;
  memberType: string; // 사업장가입자, 지역가입자 등
  monthlyPayment: number;
  companyName: string;
  raw: unknown;
}

/** 통합 조회 결과 */
interface PublicDataCollectResult {
  incomeProof: IncomeProofResult | null;
  withholdingTax: WithholdingTaxResult | null;
  businessRegistration: BusinessRegistrationResult | null;
  healthInsurance: HealthInsuranceResult | null;
  healthInsurancePremium: HealthInsurancePremiumResult | null;
  nationalPension: NationalPensionResult | null;
  errors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// 응답 파싱 헬퍼
// ---------------------------------------------------------------------------

function parseIncomeProof(data: unknown): IncomeProofResult {
  const d = data as Record<string, any> | undefined;
  const list = d?.resIncomeDetailList ?? d?.resList ?? [];
  const latest = Array.isArray(list) && list.length > 0 ? list[0] : d ?? {};

  return {
    year: latest.resYear ?? latest.resIncomeYear ?? "",
    totalIncome: Number(latest.resTotalIncome ?? latest.resIncomeAmount ?? 0),
    salaryIncome: Number(latest.resSalaryIncome ?? latest.resEmploymentIncome ?? 0),
    businessIncome: Number(latest.resBusinessIncome ?? 0),
    otherIncome: Number(latest.resOtherIncome ?? 0),
    raw: data,
  };
}

function parseWithholdingTax(data: unknown): WithholdingTaxResult {
  const d = data as Record<string, any> | undefined;
  const list = d?.resPayStatementList ?? d?.resList ?? [];
  const latest = Array.isArray(list) && list.length > 0 ? list[0] : d ?? {};

  return {
    year: latest.resYear ?? latest.resPaymentYear ?? "",
    companyName: latest.resCompanyName ?? latest.resEmployerName ?? "",
    totalSalary: Number(latest.resTotalSalary ?? latest.resTotalPayment ?? 0),
    taxAmount: Number(latest.resTotalTax ?? latest.resIncomeTax ?? 0),
    raw: data,
  };
}

function parseBusinessRegistration(data: unknown): BusinessRegistrationResult {
  const d = data as Record<string, any> | undefined;

  return {
    businessNumber: d?.resBusinessNo ?? d?.resBusinessNumber ?? "",
    businessName: d?.resBusinessName ?? d?.resCompanyName ?? "",
    representative: d?.resRepresentative ?? d?.resOwnerName ?? "",
    businessType: d?.resBusinessType ?? d?.resBusinessCategory ?? "",
    businessCategory: d?.resBusinessItem ?? d?.resBusinessSubCategory ?? "",
    registrationDate: d?.resRegistrationDate ?? d?.resOpenDate ?? "",
    raw: data,
  };
}

function parseHealthInsurance(data: unknown): HealthInsuranceResult {
  const d = data as Record<string, any> | undefined;
  const list = d?.resIdentityList ?? d?.resList ?? [];
  const latest = Array.isArray(list) && list.length > 0 ? list[0] : d ?? {};

  // 피부양자 목록 추출
  const depRaw = d?.resDependentList ?? latest?.resDependentList ?? [];
  const dependents: Dependent[] = [];
  if (Array.isArray(depRaw)) {
    for (const dep of depRaw) {
      dependents.push({
        name: dep.resName ?? dep.resDependentName ?? "",
        relation: dep.resRelation ?? dep.resRelationship ?? "",
        birthDate: dep.resBirthDate ?? dep.resBirthday ?? "",
      });
    }
  }

  return {
    qualificationType: latest.resQualificationType ?? latest.resInsuranceType ?? "",
    qualificationDate: latest.resQualificationDate ?? latest.resJoinDate ?? "",
    lossDate: latest.resLossDate ?? latest.resDisqualificationDate ?? "",
    companyName: latest.resCompanyName ?? latest.resWorkplaceName ?? "",
    dependents,
    raw: data,
  };
}

function parseHealthInsurancePremium(data: unknown): HealthInsurancePremiumResult {
  const d = data as Record<string, any> | undefined;
  const list = d?.resPaymentList ?? d?.resList ?? [];
  const payments: Array<{ yearMonth: string; premiumAmount: number; paidDate: string }> = [];
  let totalAmount = 0;

  if (Array.isArray(list)) {
    for (const item of list) {
      const amount = Number(item.resPremiumAmount ?? item.resPaymentAmount ?? 0);
      payments.push({
        yearMonth: item.resYearMonth ?? item.resPaymentYearMonth ?? "",
        premiumAmount: amount,
        paidDate: item.resPaidDate ?? item.resPaymentDate ?? "",
      });
      totalAmount += amount;
    }
  }

  return { payments, totalAmount, raw: data };
}

function parseNationalPension(data: unknown): NationalPensionResult {
  const d = data as Record<string, any> | undefined;
  const list = d?.resJoinList ?? d?.resList ?? [];
  const latest = Array.isArray(list) && list.length > 0 ? list[0] : d ?? {};

  return {
    joinDate: latest.resJoinDate ?? latest.resQualificationDate ?? "",
    memberType: latest.resMemberType ?? latest.resJoinType ?? "",
    monthlyPayment: Number(latest.resMonthlyPayment ?? latest.resMonthlyPremium ?? 0),
    companyName: latest.resCompanyName ?? latest.resWorkplaceName ?? "",
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// 1. 소득금액증명원
// POST /codef/public/income-proof
// ---------------------------------------------------------------------------
export async function handleIncomeProof(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity, issuePurpose } = req.body as {
      connectedId: string;
      identity?: string;
      issuePurpose?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/income-amount", {
      connectedId,
      identity: identity ?? "",
      issuePurpose: issuePurpose ?? "02", // 02: 금융기관 제출용
    });

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "소득금액증명원 조회 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const data = codefResult?.data;
    res.json({ success: true, data: parseIncomeProof(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "소득금액증명원 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 2. 근로소득 원천징수영수증
// POST /codef/public/withholding-tax
// ---------------------------------------------------------------------------
export async function handleWithholdingTax(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity } = req.body as {
      connectedId: string;
      identity?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/paystatement-income", {
      connectedId,
      identity: identity ?? "",
    });

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "원천징수영수증 조회 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const data = codefResult?.data;
    res.json({ success: true, data: parseWithholdingTax(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "원천징수영수증 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 3. 사업자등록증명원
// POST /codef/public/business-registration
// ---------------------------------------------------------------------------
export async function handleBusinessRegistration(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity, businessNumber } = req.body as {
      connectedId: string;
      identity?: string;
      businessNumber?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/business-registration", {
      connectedId,
      identity: identity ?? "",
      businessNo: businessNumber ?? "",
    });

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "사업자등록증명원 조회 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const data = codefResult?.data;
    res.json({ success: true, data: parseBusinessRegistration(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "사업자등록증명원 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 4. 건강보험 자격득실확인서 + 피부양자 정보
// POST /codef/public/health-insurance
// ---------------------------------------------------------------------------
export async function handleHealthInsurance(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity } = req.body as {
      connectedId: string;
      identity?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    const token = await getToken();
    const result = await callCodef(
      token,
      "/v1/kr/public/pp/nhis-insurance-identity-confirmation",
      {
        connectedId,
        identity: identity ?? "",
      },
    );

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "건강보험 자격득실확인서 조회 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const data = codefResult?.data;
    res.json({ success: true, data: parseHealthInsurance(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "건강보험 자격득실확인서 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 5. 건강보험료 납부확인서
// POST /codef/public/health-insurance-premium
// ---------------------------------------------------------------------------
export async function handleHealthInsurancePremium(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity, startDate, endDate } = req.body as {
      connectedId: string;
      identity?: string;
      startDate?: string;
      endDate?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    // 기본값: 최근 12개월
    const now = new Date();
    const ago12m = new Date(now);
    ago12m.setFullYear(now.getFullYear() - 1);
    const defaultStart = ago12m.toISOString().slice(0, 10).replace(/-/g, "");
    const defaultEnd = now.toISOString().slice(0, 10).replace(/-/g, "");

    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/nhis-insurance-payment", {
      connectedId,
      identity: identity ?? "",
      startDate: startDate ?? defaultStart,
      endDate: endDate ?? defaultEnd,
    });

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "건강보험료 납부확인서 조회 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const data = codefResult?.data;
    res.json({ success: true, data: parseHealthInsurancePremium(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "건강보험료 납부확인서 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 6. 국민연금 가입증명서
// POST /codef/public/national-pension
// ---------------------------------------------------------------------------
export async function handleNationalPension(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity } = req.body as {
      connectedId: string;
      identity?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/nps-join-issue", {
      connectedId,
      identity: identity ?? "",
    });

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "국민연금 가입증명서 조회 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const data = codefResult?.data;
    res.json({ success: true, data: parseNationalPension(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "국민연금 가입증명서 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 7. 통합 조회 — 6개 공공기관 데이터를 한번에 수집
// POST /codef/public/collect-all
// ---------------------------------------------------------------------------
export async function handlePublicDataCollect(req: Request, res: Response): Promise<void> {
  try {
    const { connectedId, identity, businessNumber, startDate, endDate } = req.body as {
      connectedId: string;
      identity?: string;
      businessNumber?: string;
      startDate?: string;
      endDate?: string;
    };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    const token = await getToken();
    const id = identity ?? "";

    // 기본 날짜 범위: 최근 12개월
    const now = new Date();
    const ago12m = new Date(now);
    ago12m.setFullYear(now.getFullYear() - 1);
    const defaultStart = ago12m.toISOString().slice(0, 10).replace(/-/g, "");
    const defaultEnd = now.toISOString().slice(0, 10).replace(/-/g, "");

    const [
      incomeProofResult,
      withholdingTaxResult,
      businessRegResult,
      healthInsResult,
      healthPremiumResult,
      pensionResult,
    ] = await Promise.allSettled([
      callCodef(token, "/v1/kr/public/ck/proof-issue/income-amount", {
        connectedId,
        identity: id,
        issuePurpose: "02",
      }),
      callCodef(token, "/v1/kr/public/ck/proof-issue/paystatement-income", {
        connectedId,
        identity: id,
      }),
      callCodef(token, "/v1/kr/public/ck/proof-issue/business-registration", {
        connectedId,
        identity: id,
        businessNo: businessNumber ?? "",
      }),
      callCodef(token, "/v1/kr/public/pp/nhis-insurance-identity-confirmation", {
        connectedId,
        identity: id,
      }),
      callCodef(token, "/v1/kr/public/pp/nhis-insurance-payment", {
        connectedId,
        identity: id,
        startDate: startDate ?? defaultStart,
        endDate: endDate ?? defaultEnd,
      }),
      callCodef(token, "/v1/kr/public/pp/nps-join-issue", {
        connectedId,
        identity: id,
      }),
    ]);

    const errors: Record<string, string> = {};

    const extract = <T>(
      settled: PromiseSettledResult<unknown>,
      key: string,
      parser: (data: unknown) => T,
    ): T | null => {
      if (settled.status === "rejected") {
        errors[key] = settled.reason instanceof Error ? settled.reason.message : "조회 실패";
        return null;
      }
      const codefResult = settled.value as Record<string, any>;
      if (codefResult?.result?.code !== "CF-00000") {
        errors[key] = codefResult?.result?.message ?? "조회 실패";
        return null;
      }
      return parser(codefResult?.data);
    };

    const result: PublicDataCollectResult = {
      incomeProof: extract(incomeProofResult, "incomeProof", parseIncomeProof),
      withholdingTax: extract(withholdingTaxResult, "withholdingTax", parseWithholdingTax),
      businessRegistration: extract(
        businessRegResult,
        "businessRegistration",
        parseBusinessRegistration,
      ),
      healthInsurance: extract(healthInsResult, "healthInsurance", parseHealthInsurance),
      healthInsurancePremium: extract(
        healthPremiumResult,
        "healthInsurancePremium",
        parseHealthInsurancePremium,
      ),
      nationalPension: extract(pensionResult, "nationalPension", parseNationalPension),
      errors,
    };

    const successCount = [
      result.incomeProof,
      result.withholdingTax,
      result.businessRegistration,
      result.healthInsurance,
      result.healthInsurancePremium,
      result.nationalPension,
    ].filter((v) => v !== null).length;

    res.json({
      success: true,
      summary: {
        total: 6,
        succeeded: successCount,
        failed: 6 - successCount,
      },
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "공공기관 데이터 통합 조회 실패" });
  }
}

// ---------------------------------------------------------------------------
// 정부24 / 대법원 / 위택스 / 홈택스 추가 API (개인회생 서류 자동 수집)
// ---------------------------------------------------------------------------

/** 정부24 — 주민등록등본 교부 */
export async function handleResidentRegistration(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/gov24-resident-register", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "주민등록등본 조회 실패" });
  }
}

/** 정부24 — 주민등록초본 교부 */
export async function handleResidentAbstract(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/gov24-resident-abstract", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "주민등록초본 조회 실패" });
  }
}

/** 대법원 — 가족관계등록부 발급 */
export async function handleFamilyRelation(req: Request, res: Response) {
  try {
    const { connectedId, identity, certType } = req.body as { connectedId: string; identity?: string; certType?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ef/family-relation-certificate", {
      connectedId, identity: identity ?? "",
      certType: certType ?? "1", // 1: 가족관계증명서, 2: 혼인관계증명서
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "가족관계등록부 발급 실패" });
  }
}

/** 대법원 — 부동산등기부등본 열람/발급 */
export async function handlePropertyRegistry(req: Request, res: Response) {
  try {
    const { connectedId, address, propertyType } = req.body as { connectedId: string; address: string; propertyType?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ef/real-estate-register", {
      connectedId, address, propertyType: propertyType ?? "0",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "부동산등기부등본 조회 실패" });
  }
}

/** 홈택스 — 납세증명서 */
export async function handleTaxPaymentCert(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/tax-payment", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "납세증명서 조회 실패" });
  }
}

/** 홈택스 — 근로소득 지급명세서 */
export async function handleWageStatement(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/wage-statement", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "근로소득 지급명세서 조회 실패" });
  }
}

/** 홈택스 — 부가세과세표준증명 */
export async function handleVatCert(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/vat-certificate", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "부가세과세표준증명 조회 실패" });
  }
}

/** 홈택스 — 재무제표 */
export async function handleFinancialStatement(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/ck/proof-issue/financial-statement", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "재무제표 조회 실패" });
  }
}

/** 위택스 — 지방세 부과내역 */
export async function handleLocalTaxAssessment(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/wetax-local-tax-assessment", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "지방세 부과내역 조회 실패" });
  }
}

/** 위택스 — 지방세 납부결과 */
export async function handleLocalTaxPayment(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/wetax-local-tax-payment", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "지방세 납부결과 조회 실패" });
  }
}

/** 정부24 — 자동차등록원부(갑) */
export async function handleVehicleRegistration(req: Request, res: Response) {
  try {
    const { connectedId, identity, carNumber } = req.body as { connectedId: string; identity?: string; carNumber?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/gov24-vehicle-registration", {
      connectedId, identity: identity ?? "", carNumber: carNumber ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "자동차등록원부 조회 실패" });
  }
}

/** 정부24 — 지방세 납세증명 */
export async function handleLocalTaxCert(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/gov24-local-tax-cert", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "지방세 납세증명 조회 실패" });
  }
}

/** 정부24 — 개인 납세증명서 (국세) */
export async function handleNationalTaxCert(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/gov24-national-tax-cert", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "납세증명서 조회 실패" });
  }
}

/** 4대보험 — 사업장 가입자명부 */
export async function handleFourInsurance(req: Request, res: Response) {
  try {
    const { connectedId, identity } = req.body as { connectedId: string; identity?: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId 필요" }); return; }
    const token = await getToken();
    const result = await callCodef(token, "/v1/kr/public/pp/four-insurance-members", {
      connectedId, identity: identity ?? "",
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "4대보험 조회 실패" });
  }
}
