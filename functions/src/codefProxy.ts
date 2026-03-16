import type { Request, Response } from "express";
import * as crypto from "crypto";
import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";

function getCodefBase(): string {
  return process.env.CODEF_API_HOST || "https://development.codef.io";
}

const CODEF_PUBLIC_KEY = process.env.CODEF_PUBLIC_KEY ||
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9rz2qUGlx8m5E+3FazN2vX1kmbiKFfgkLy7DTBZX0TStLWn7Xq4SfqdIzHZxCEPw5iMsKGfA+TCs6fLObYNzA+0EkHkVSv8E2HVHvbQbtT5xIghi1DNyL4zvfs+YrZaybVBPb0uKn8SP9yA9yxcATv2QHee6m7qaLieoAwLYBACNLOc1oDXMnwGfg7RSxgtVxLm4uFT/z0/nRSzgyVwDXPo8g+uY6fiwPwS/3ouAjw0KsCTMIJr6SzccLlQv5+PqpYvmjMn9+RzIpA6VHpVVeFSbvaRIgiyeRr1oyh7OCtWQROUQs4nVQPOQj5zXvJPEtDZYc6LrZpPxiH2b1m2NIQIDAQAB";

// ---------------------------------------------------------------------------
// Token cache (in-memory, 6일)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// RSA 암호화
// ---------------------------------------------------------------------------
function encryptRSA(plainText: string): string {
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${CODEF_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  const encrypted = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, "utf-8"),
  );
  return encrypted.toString("base64");
}

// ---------------------------------------------------------------------------
// 기관코드 매핑
// ---------------------------------------------------------------------------
const ORG_MAP: Record<string, { code: string; businessType: string }> = {
  "국민은행": { code: "0004", businessType: "BK" },
  "신한은행": { code: "0088", businessType: "BK" },
  "우리은행": { code: "0020", businessType: "BK" },
  "하나은행": { code: "0081", businessType: "BK" },
  "농협":     { code: "0011", businessType: "BK" },
  "IBK기업은행": { code: "0003", businessType: "BK" },
  "SC제일은행": { code: "0023", businessType: "BK" },
  "카카오뱅크": { code: "0090", businessType: "BK" },
  "토스뱅크": { code: "0092", businessType: "BK" },
  "케이뱅크": { code: "0089", businessType: "BK" },
  "수협은행": { code: "0007", businessType: "BK" },
  "삼성카드": { code: "0303", businessType: "CD" },
  "현대카드": { code: "0302", businessType: "CD" },
  "롯데카드": { code: "0311", businessType: "CD" },
  "BC카드":   { code: "0361", businessType: "CD" },
  "KB국민카드": { code: "0301", businessType: "CD" },
  "신한카드": { code: "0306", businessType: "CD" },
  "우리카드": { code: "0309", businessType: "CD" },
  "하나카드": { code: "0313", businessType: "CD" },
  "NH카드":   { code: "0304", businessType: "CD" },
  "삼성생명": { code: "0032", businessType: "IN" },
  "한화생명": { code: "0050", businessType: "IN" },
  "교보생명": { code: "0033", businessType: "IN" },
  "삼성화재": { code: "0058", businessType: "IN" },
  "현대해상": { code: "0059", businessType: "IN" },
  "DB손해보험": { code: "0060", businessType: "IN" },
  "OK저축은행": { code: "0105", businessType: "BK" },
  "SBI저축은행": { code: "0101", businessType: "BK" },
};

const LOGIN_TYPE_MAP: Record<string, string> = {
  cert: "0", finCert: "0", kakao: "1", pass: "1",
};

interface CodefAccount {
  countryCode: string; businessType: string; clientType: string;
  organization: string; loginType: string; id?: string; password?: string;
  loginTypeLevel?: string; userName?: string; phoneNo?: string; identity?: string;
}

function buildAccountList(
  banks: string[],
  credentials: { loginType: string; id: string; password: string },
): CodefAccount[] {
  const encPw = encryptRSA(credentials.password);
  const codefLoginType = LOGIN_TYPE_MAP[credentials.loginType] ?? "1";
  const result: CodefAccount[] = [];
  for (const bankName of banks) {
    const org = ORG_MAP[bankName];
    if (!org) continue;
    result.push({
      countryCode: "KR", businessType: org.businessType, clientType: "P",
      organization: org.code, loginType: codefLoginType,
      id: credentials.id, password: encPw,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// CODEF API 호출
// ---------------------------------------------------------------------------
async function callCodef(token: string, endpoint: string, body: object): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const jsonBody = JSON.stringify(body);
  console.log(`[CODEF] Calling endpoint: ${endpoint}`);
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
    const message = err instanceof Error ? err.message : "CODEF API 호출 실패";
    throw new Error(`CODEF API error on ${endpoint}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 응답 파싱 — 기본 수집
// ---------------------------------------------------------------------------
interface Debt {
  id: string; name: string; creditor: string; type: string;
  amount: number; rate: number; monthly: number; source: string;
}
interface Asset {
  id: string; name: string; type: string; rawValue: number;
  liquidationRate: number; mortgage: number; value: number; source: string;
}

function parseDebts(bankLoans: unknown, cardLoans: unknown): Debt[] {
  const debts: Debt[] = [];
  for (const loan of (bankLoans as any)?.data?.resList ?? []) {
    debts.push({ id: crypto.randomUUID(), name: loan.resLoanName ?? "은행대출",
      creditor: loan.resBankName ?? "", type: "무담보",
      amount: Number(loan.resLoanBalance ?? 0), rate: Number(loan.resLoanInterest ?? 0),
      monthly: 0, source: "codef" });
  }
  for (const loan of (cardLoans as any)?.data?.resList ?? []) {
    debts.push({ id: crypto.randomUUID(), name: loan.resLoanName ?? "카드론",
      creditor: loan.resCardName ?? "", type: "무담보",
      amount: Number(loan.resLoanBalance ?? 0), rate: Number(loan.resLoanInterest ?? 0),
      monthly: 0, source: "codef" });
  }
  return debts;
}

function parseAssets(accounts: unknown, insurance: unknown): Asset[] {
  const assets: Asset[] = [];
  for (const acc of (accounts as any)?.data?.resList ?? []) {
    const balance = Number(acc.resAccountBalance ?? 0);
    if (balance > 0) {
      assets.push({ id: crypto.randomUUID(),
        name: `${acc.resBankName ?? ""} ${acc.resAccountName ?? "예금"}`,
        type: "예금", rawValue: balance, liquidationRate: 1.0,
        mortgage: 0, value: balance, source: "codef" });
    }
  }
  for (const item of (insurance as any)?.data?.resList ?? []) {
    const refund = Number(item.resSurrenderAmount ?? 0);
    if (refund > 0) {
      assets.push({ id: crypto.randomUUID(),
        name: `${item.resInsuranceName ?? "보험"} 해지환급금`,
        type: "보험", rawValue: refund, liquidationRate: 1.0,
        mortgage: 0, value: refund, source: "codef" });
    }
  }
  return assets;
}

// ---------------------------------------------------------------------------
// 샌드박스 모드 감지 + 데모 데이터
// ---------------------------------------------------------------------------
function isSandbox(): boolean {
  const host = process.env.CODEF_API_HOST || "https://development.codef.io";
  const hasCredentials = !!(process.env.CODEF_CLIENT_ID && process.env.CODEF_CLIENT_SECRET);
  return !hasCredentials || host.includes("sandbox");
}

function generateSandboxData(banks: string[]) {
  const debts: Debt[] = [];
  const assets: Asset[] = [];

  // 은행별 대출 데이터 생성
  const bankNames = banks.filter(b =>
    ["국민은행","신한은행","우리은행","하나은행","농협","IBK기업은행","카카오뱅크","토스뱅크","케이뱅크","SC제일은행","수협은행","OK저축은행","SBI저축은행"].includes(b)
  );
  const cardNames = banks.filter(b =>
    ["삼성카드","현대카드","롯데카드","BC카드","KB국민카드","신한카드","우리카드","하나카드","NH카드"].includes(b)
  );
  const insuranceNames = banks.filter(b =>
    ["삼성생명","한화생명","교보생명","삼성화재","현대해상","DB손해보험"].includes(b)
  );

  // 은행 대출
  const loanTemplates = [
    { suffix: "신용대출", amountRange: [5000000, 50000000], rateRange: [4.5, 12.9] },
    { suffix: "마이너스통장", amountRange: [3000000, 30000000], rateRange: [5.0, 11.0] },
    { suffix: "주택담보대출", amountRange: [50000000, 300000000], rateRange: [3.2, 5.8] },
  ];
  for (const bank of bankNames) {
    const tpl = loanTemplates[Math.floor(Math.random() * loanTemplates.length)];
    const amount = Math.round((tpl.amountRange[0] + Math.random() * (tpl.amountRange[1] - tpl.amountRange[0])) / 10000) * 10000;
    const rate = Math.round((tpl.rateRange[0] + Math.random() * (tpl.rateRange[1] - tpl.rateRange[0])) * 10) / 10;
    debts.push({
      id: crypto.randomUUID(), name: `${bank} ${tpl.suffix}`, creditor: bank,
      type: tpl.suffix === "주택담보대출" ? "담보" : "무담보",
      amount, rate, monthly: Math.round(amount * (rate / 100 / 12)), source: "codef",
    });
  }

  // 카드론
  for (const card of cardNames) {
    if (Math.random() > 0.6) continue; // 40%는 카드론 없음
    const amount = Math.round((1000000 + Math.random() * 15000000) / 10000) * 10000;
    const rate = Math.round((8 + Math.random() * 12) * 10) / 10;
    debts.push({
      id: crypto.randomUUID(), name: `${card} 카드론`, creditor: card,
      type: "무담보", amount, rate, monthly: Math.round(amount * (rate / 100 / 12)), source: "codef",
    });
  }

  // 은행 예금 계좌
  for (const bank of bankNames.slice(0, 2)) {
    const balance = Math.round(Math.random() * 5000000 / 100) * 100;
    if (balance > 0) {
      assets.push({
        id: crypto.randomUUID(), name: `${bank} 보통예금`, type: "예금",
        rawValue: balance, liquidationRate: 1.0, mortgage: 0, value: balance, source: "codef",
      });
    }
  }

  // 보험 해약환급금
  for (const ins of insuranceNames) {
    const refund = Math.round((500000 + Math.random() * 5000000) / 1000) * 1000;
    assets.push({
      id: crypto.randomUUID(), name: `${ins} 종신보험 해지환급금`, type: "보험",
      rawValue: refund, liquidationRate: 1.0, mortgage: 0, value: refund, source: "codef",
    });
  }

  const debtTotal = debts.reduce((s, d) => s + d.amount, 0);
  const assetTotal = assets.reduce((s, a) => s + a.value, 0);

  return {
    connectedId: `sandbox-${crypto.randomUUID().slice(0, 8)}`,
    debts, assets,
    summary: {
      debtCount: debts.length, debtTotal,
      assetCount: assets.length, assetTotal,
    },
  };
}

// ---------------------------------------------------------------------------
// 공통: Connected ID 생성 + 기본 수집
// ---------------------------------------------------------------------------
async function collectWithCodef(
  token: string,
  accountList: CodefAccount[] | Array<{ loginType: string; id: string; password: string }>,
) {
  const acctData = (await callCodef(token, "/v1/account/create", { accountList })) as any;
  const cid = acctData?.data?.connectedId;
  if (!cid) {
    const msg = acctData?.result?.message ?? "금융기관 계정 연결 실패";
    return { error: msg, detail: acctData };
  }

  const reqBody = { connectedId: cid };
  const [bankAccounts, bankLoans, cardLoans, insurance] = await Promise.allSettled([
    callCodef(token, "/v1/kr/bank/p/account/account-basic", reqBody),
    callCodef(token, "/v1/kr/bank/p/loan/loan-list", reqBody),
    callCodef(token, "/v1/kr/card/p/loan/loan-list", reqBody),
    callCodef(token, "/v1/kr/insurance/p/common/product-list", reqBody),
  ]);

  const g = (r: PromiseSettledResult<unknown>) => r.status === "fulfilled" ? r.value : null;
  const debts = parseDebts(g(bankLoans), g(cardLoans));
  const assets = parseAssets(g(bankAccounts), g(insurance));

  return {
    connectedId: cid, debts, assets,
    summary: {
      debtCount: debts.length, debtTotal: debts.reduce((s, d) => s + d.amount, 0),
      assetCount: assets.length, assetTotal: assets.reduce((s, a) => s + a.value, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// POST /codef/collect (인증된 법무사용)
// ---------------------------------------------------------------------------
export async function handleCodefCollect(req: Request, res: Response) {
  try {
    const body = req.body as {
      connectedId?: string; clientId?: string; authMethod?: string;
      credentials: { loginType: string; id: string; password: string };
      banks?: string[];
    };

    // 샌드박스 모드: CODEF API 없이 데모 데이터 반환
    if (isSandbox()) {
      console.log("[CODEF] 샌드박스 모드 — 데모 데이터 반환");
      const banks = body.banks ?? [];
      if (banks.length === 0) {
        res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" });
        return;
      }
      // 실제 API 호출처럼 약간의 딜레이
      await new Promise(r => setTimeout(r, 1500));
      res.json(generateSandboxData(banks));
      return;
    }

    const token = await getToken();

    if (body.connectedId) {
      const reqBody = { connectedId: body.connectedId };
      const [ba, bl, cl, ins] = await Promise.allSettled([
        callCodef(token, "/v1/kr/bank/p/account/account-basic", reqBody),
        callCodef(token, "/v1/kr/bank/p/loan/loan-list", reqBody),
        callCodef(token, "/v1/kr/card/p/loan/loan-list", reqBody),
        callCodef(token, "/v1/kr/insurance/p/common/product-list", reqBody),
      ]);
      const g = (r: PromiseSettledResult<unknown>) => r.status === "fulfilled" ? r.value : null;
      const debts = parseDebts(g(bl), g(cl));
      const assets = parseAssets(g(ba), g(ins));
      res.json({ connectedId: body.connectedId, debts, assets, summary: {
        debtCount: debts.length, debtTotal: debts.reduce((s, d) => s + d.amount, 0),
        assetCount: assets.length, assetTotal: assets.reduce((s, a) => s + a.value, 0),
      }});
      return;
    }

    const accountList = body.banks?.length
      ? buildAccountList(body.banks, body.credentials) : [body.credentials];
    if (accountList.length === 0) { res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" }); return; }

    const result = await collectWithCodef(token, accountList);
    if ("error" in result) { res.status(500).json(result); return; }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "CODEF 수집 실패" });
  }
}

// ---------------------------------------------------------------------------
// POST /intake/codef-collect (의뢰인용, 인증 불필요)
// ---------------------------------------------------------------------------
export async function handleIntakeCodefCollect(req: Request, res: Response) {
  try {
    const body = req.body as {
      tokenId?: string;
      credentials: { loginType: string; id: string; password: string };
      banks?: string[];
    };
    if (!body.tokenId) { res.status(400).json({ error: "토큰 ID가 필요합니다" }); return; }
    if (!body.credentials) { res.status(400).json({ error: "금융기관 인증 정보가 필요합니다" }); return; }

    // Validate intake token against Firestore
    const tokenRef = admin.firestore().collection('intakeTokens').doc(body.tokenId);
    const tokenDoc = await tokenRef.get();
    if (!tokenDoc.exists) {
      res.status(403).json({ error: "유효하지 않은 토큰입니다" });
      return;
    }
    const tokenData = tokenDoc.data();
    if (tokenData?.used) {
      res.status(403).json({ error: "이미 사용된 토큰입니다" });
      return;
    }
    if (tokenData?.expiresAt && tokenData.expiresAt.toDate() < new Date()) {
      res.status(403).json({ error: "만료된 토큰입니다" });
      return;
    }

    // 샌드박스 모드
    if (isSandbox()) {
      console.log("[CODEF] 샌드박스 모드 (intake) — 데모 데이터 반환");
      const banks = body.banks ?? [];
      if (banks.length === 0) {
        res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" });
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
      res.json(generateSandboxData(banks));
      return;
    }

    // Mark token as used before calling CODEF to prevent reuse
    await tokenRef.update({ used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });

    const token = await getToken();
    const accountList = body.banks?.length
      ? buildAccountList(body.banks, body.credentials) : [body.credentials];
    if (accountList.length === 0) { res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" }); return; }

    const result = await collectWithCodef(token, accountList);
    if ("error" in result) { res.status(500).json(result); return; }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "CODEF 수집 실패" });
  }
}

// ---------------------------------------------------------------------------
// POST /codef/statement-data — 진술서 자동채움용 금융데이터
// Q2: 1년 내 신규 채무
// Q4: 200만원 이상 이체
// Q5: 100만원 이상 현금인출
// Q6: 100만원 이상 카드사용
// Q7: 1년 내 해약 보험
// ---------------------------------------------------------------------------
export async function handleStatementData(req: Request, res: Response) {
  try {
    const { connectedId } = req.body as { connectedId: string };
    if (!connectedId) { res.status(400).json({ error: "connectedId가 필요합니다" }); return; }

    // 샌드박스 모드
    if (isSandbox()) {
      res.json({
        newDebts: [
          { creditor: "카카오뱅크", type: "신용대출", amount: 10000000, date: "20250801" },
        ],
        largeTransfers: [
          { account: "110-xxx-1234", date: "20260110", amount: 5000000, recipient: "홍길동", memo: "가족 송금" },
        ],
        cashWithdrawals: [],
        largeCardUsage: [
          { cardNo: "1234-xxxx", date: "20260205", amount: 2500000, merchant: "인테리어 업체" },
        ],
        cancelledInsurance: [],
      });
      return;
    }

    const token = await getToken();
    const now = new Date();
    const ago1y = new Date(now); ago1y.setFullYear(now.getFullYear() - 1);
    const startDate = fmtD(ago1y), endDate = fmtD(now);
    const dBody = { connectedId, startDate, endDate };
    const rBody = { connectedId };

    const [bankTxns, cardAppr, insList, bLoans, cLoans] = await Promise.allSettled([
      callCodef(token, "/v1/kr/bank/p/account/transaction-list", dBody),
      callCodef(token, "/v1/kr/card/p/account/approval-list", dBody),
      callCodef(token, "/v1/kr/insurance/p/common/product-list", rBody),
      callCodef(token, "/v1/kr/bank/p/loan/loan-list", rBody),
      callCodef(token, "/v1/kr/card/p/loan/loan-list", rBody),
    ]);
    const g = (r: PromiseSettledResult<unknown>) => r.status === "fulfilled" ? r.value : null;

    res.json({
      newDebts: stmtNewDebts(g(bLoans), g(cLoans), startDate),
      largeTransfers: stmtTransfers(g(bankTxns), 2000000),
      cashWithdrawals: stmtCash(g(bankTxns), 1000000),
      largeCardUsage: stmtCard(g(cardAppr), 1000000),
      cancelledInsurance: stmtInsCancel(g(insList)),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "진술서 데이터 수집 실패" });
  }
}

// ---------------------------------------------------------------------------
// 진술서 파싱 헬퍼
// ---------------------------------------------------------------------------
function fmtD(d: Date) { return d.toISOString().slice(0, 10).replace(/-/g, ""); }

function stmtNewDebts(bl: unknown, cl: unknown, since: string) {
  const r: Array<{ creditor: string; type: string; amount: number; date: string }> = [];
  for (const l of [...((bl as any)?.data?.resList ?? []), ...((cl as any)?.data?.resList ?? [])]) {
    const dt = l.resLoanDate ?? l.resContractDate ?? "";
    if (dt >= since) r.push({ creditor: l.resBankName ?? l.resCardName ?? "", type: l.resLoanName ?? "대출", amount: Number(l.resLoanBalance ?? 0), date: dt });
  }
  return r;
}

function stmtTransfers(txns: unknown, th: number) {
  const r: Array<{ account: string; date: string; amount: number; recipient: string; memo: string }> = [];
  for (const tx of (txns as any)?.data?.resList ?? []) {
    const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
    const tp = tx.resAccountTrType ?? "";
    if (amt >= th && (tp.includes("이체") || tp.includes("송금")))
      r.push({ account: tx.resAccountNum ?? "", date: tx.resAccountTrDate ?? "", amount: amt, recipient: tx.resAccountDesc ?? "", memo: tx.resAccountMemo ?? "" });
  }
  return r;
}

function stmtCash(txns: unknown, th: number) {
  const r: Array<{ account: string; date: string; amount: number; memo: string }> = [];
  for (const tx of (txns as any)?.data?.resList ?? []) {
    const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
    const tp = tx.resAccountTrType ?? "";
    if (amt >= th && (tp.includes("현금") || tp.includes("인출") || tp.includes("수표") || tp === "출금"))
      r.push({ account: tx.resAccountNum ?? "", date: tx.resAccountTrDate ?? "", amount: amt, memo: tx.resAccountMemo ?? "" });
  }
  return r;
}

function stmtCard(approvals: unknown, th: number) {
  const r: Array<{ cardNo: string; date: string; amount: number; merchant: string }> = [];
  for (const tx of (approvals as any)?.data?.resList ?? []) {
    const amt = Number(tx.resApprovalAmount ?? tx.resUsedAmount ?? 0);
    if (amt >= th) r.push({ cardNo: tx.resCardNo ?? "", date: tx.resApprovalDate ?? "", amount: amt, merchant: tx.resMerchantName ?? "" });
  }
  return r;
}

function stmtInsCancel(ins: unknown) {
  const r: Array<{ company: string; name: string; monthlyPremium: number; refundAmount: number; status: string }> = [];
  for (const it of (ins as any)?.data?.resList ?? []) {
    const st = it.resContractStatus ?? "";
    if (st.includes("해지") || st.includes("소멸") || st.includes("만기"))
      r.push({ company: it.resCompanyName ?? "", name: it.resInsuranceName ?? "", monthlyPremium: Number(it.resMonthlyPremium ?? 0), refundAmount: Number(it.resSurrenderAmount ?? 0), status: st });
  }
  return r;
}

// ---------------------------------------------------------------------------
// 간편인증 (2-way) 시작 / 완료
// ---------------------------------------------------------------------------

/**
 * POST /codef/simple-auth/start
 * body: { userName, birthDate, phoneNo, carrier?, banks }
 *
 * CODEF 간편인증을 시작합니다.
 * - 성공 시 2-way 정보 반환 (CF-03002) → 사용자가 폰에서 인증
 * - 샌드박스 시 바로 connectedId 반환
 */
export async function handleSimpleAuthStart(req: Request, res: Response) {
  try {
    const { userName, birthDate, phoneNo, provider, banks } = req.body as {
      userName: string;
      birthDate: string;       // YYYYMMDD
      phoneNo: string;
      provider?: string;       // loginTypeLevel: 1=카카오, 5=PASS, 6=네이버, 8=토스
      banks: string[];
    };

    if (!userName || !birthDate || !phoneNo) {
      res.status(400).json({ error: "이름, 생년월일, 전화번호가 필요합니다" });
      return;
    }
    if (!banks || banks.length === 0) {
      res.status(400).json({ error: "금융기관을 선택해주세요" });
      return;
    }

    // 샌드박스 모드
    if (isSandbox()) {
      console.log("[CODEF] 샌드박스 간편인증 — 데모 twoWayInfo 반환");
      await new Promise(r => setTimeout(r, 1000));
      res.json({
        status: "pending",
        message: "간편인증 요청이 전송되었습니다. 폰에서 인증을 완료해주세요.",
        twoWayInfo: {
          jobIndex: 0,
          threadIndex: 0,
          jti: `sandbox-jti-${crypto.randomUUID().slice(0, 8)}`,
          twoWayTimestamp: Date.now(),
        },
        sandbox: true,
      });
      return;
    }

    const token = await getToken();
    const loginTypeLevel = provider ?? "1"; // 기본: 카카오톡

    // 간편인증용 계정 목록 (loginType "5")
    const accountList: CodefAccount[] = [];
    for (const bankName of banks) {
      const org = ORG_MAP[bankName];
      if (!org) continue;
      accountList.push({
        countryCode: "KR",
        businessType: org.businessType,
        clientType: "P",
        organization: org.code,
        loginType: "5",           // 간편인증
        loginTypeLevel,           // 인증 제공사
        userName,
        phoneNo: phoneNo.replace(/-/g, ""),
        identity: birthDate,
      });
    }

    if (accountList.length === 0) {
      res.status(400).json({ error: "유효한 금융기관이 없습니다" });
      return;
    }

    console.log(`[CODEF] 간편인증 시작: ${userName}, 금융기관 ${accountList.length}개, 제공사 ${loginTypeLevel}`);
    const result = await callCodef(token, "/v1/account/create", { accountList }) as any;
    const code = result?.result?.code ?? "";
    console.log(`[CODEF] 간편인증 응답 코드: ${code}, message: ${result?.result?.message ?? ""}`);

    // CF-03002: 2-way 인증 필요 (간편인증 푸시 전송됨)
    if (code === "CF-03002") {
      res.json({
        status: "pending",
        message: "간편인증 요청이 전송되었습니다. 폰에서 인증을 완료해주세요.",
        twoWayInfo: {
          jobIndex: result?.data?.jobIndex ?? 0,
          threadIndex: result?.data?.threadIndex ?? 0,
          jti: result?.data?.jti ?? "",
          twoWayTimestamp: result?.data?.twoWayTimestamp ?? 0,
        },
      });
      return;
    }

    // 바로 성공 (드물지만)
    const connectedId = result?.data?.connectedId;
    if (connectedId) {
      res.json({ status: "done", connectedId });
      return;
    }

    // 기타 에러
    res.status(400).json({
      error: result?.result?.message ?? "간편인증 시작 실패",
      code,
      detail: result,
    });
  } catch (err: any) {
    console.error("[CODEF] 간편인증 시작 오류:", err);
    res.status(500).json({ error: err.message ?? "간편인증 시작 실패" });
  }
}

/**
 * POST /codef/simple-auth/complete
 * body: { twoWayInfo, banks, phoneNo, birthDate }
 *
 * 사용자가 폰에서 인증 완료 후 호출. connectedId 반환.
 */
export async function handleSimpleAuthComplete(req: Request, res: Response) {
  try {
    const { twoWayInfo, banks, phoneNo, birthDate, userName, provider } = req.body as {
      twoWayInfo: { jobIndex: number; threadIndex: number; jti: string; twoWayTimestamp: number };
      banks: string[];
      phoneNo: string;
      birthDate: string;
      userName: string;
      provider?: string;
    };

    if (!twoWayInfo?.jti) {
      res.status(400).json({ error: "인증 정보가 없습니다" });
      return;
    }

    // 샌드박스 모드
    if (isSandbox()) {
      await new Promise(r => setTimeout(r, 800));
      res.json({
        status: "done",
        connectedId: `sandbox-${crypto.randomUUID().slice(0, 8)}`,
      });
      return;
    }

    const token = await getToken();
    const loginTypeLevel = provider ?? "1";

    // 2-way 완료 요청 (간편인증 loginType "5")
    const accountList: CodefAccount[] = [];
    for (const bankName of banks) {
      const org = ORG_MAP[bankName];
      if (!org) continue;
      accountList.push({
        countryCode: "KR",
        businessType: org.businessType,
        clientType: "P",
        organization: org.code,
        loginType: "5",
        loginTypeLevel,
        userName: userName ?? "",
        phoneNo: phoneNo.replace(/-/g, ""),
        identity: birthDate,
      });
    }

    console.log(`[CODEF] 간편인증 완료 요청: jti=${twoWayInfo.jti}`);
    const result = await callCodef(token, "/v1/account/create", {
      accountList,
      simpleAuth: "1",
      is2Way: true,
      twoWayInfo,
    }) as any;

    const code = result?.result?.code ?? "";
    console.log(`[CODEF] 간편인증 완료 응답 코드: ${code}`);

    const connectedId = result?.data?.connectedId;
    if (connectedId) {
      res.json({ status: "done", connectedId });
      return;
    }

    if (code === "CF-03002") {
      res.json({ status: "pending", message: "아직 인증이 완료되지 않았습니다. 폰에서 인증을 완료해주세요." });
      return;
    }

    // 에러 코드별 상세 메시지
    const errorMessages: Record<string, string> = {
      "CF-00000": "알 수 없는 오류가 발생했습니다.",
      "CF-03003": "인증 시간이 만료되었습니다. 다시 인증해주세요.",
      "CF-03004": "인증이 거부되었습니다. 앱에서 인증을 승인해주세요.",
      "CF-12100": "금융기관 연결에 실패했습니다. 기관 정보를 확인해주세요.",
      "CF-12101": "해당 금융기관의 간편인증을 지원하지 않습니다.",
    };
    const detailMsg = errorMessages[code] ?? result?.result?.message ?? "간편인증 완료 실패";

    res.status(400).json({
      error: detailMsg,
      code,
    });
  } catch (err: any) {
    console.error("[CODEF] 간편인증 완료 오류:", err);
    res.status(500).json({ error: err.message ?? "간편인증 완료 실패" });
  }
}
