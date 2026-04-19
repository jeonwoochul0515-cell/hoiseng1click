"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToken = getToken;
exports.encryptRSA = encryptRSA;
exports.callCodef = callCodef;
exports.handleCodefCollect = handleCodefCollect;
exports.handleIntakeCodefCollect = handleIntakeCodefCollect;
exports.handleStatementData = handleStatementData;
exports.handleSimpleAuthStart = handleSimpleAuthStart;
exports.handleSimpleAuthComplete = handleSimpleAuthComplete;
exports.handleCodefTestConnection = handleCodefTestConnection;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const validators_1 = require("./validators");
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";
function getCodefBase() {
    return process.env.CODEF_API_HOST || "https://api.codef.io";
}
const CODEF_PUBLIC_KEY = process.env.CODEF_PUBLIC_KEY ||
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9rz2qUGlx8m5E+3FazN2vX1kmbiKFfgkLy7DTBZX0TStLWn7Xq4SfqdIzHZxCEPw5iMsKGfA+TCs6fLObYNzA+0EkHkVSv8E2HVHvbQbtT5xIghi1DNyL4zvfs+YrZaybVBPb0uKn8SP9yA9yxcATv2QHee6m7qaLieoAwLYBACNLOc1oDXMnwGfg7RSxgtVxLm4uFT/z0/nRSzgyVwDXPo8g+uY6fiwPwS/3ouAjw0KsCTMIJr6SzccLlQv5+PqpYvmjMn9+RzIpA6VHpVVeFSbvaRIgiyeRr1oyh7OCtWQROUQs4nVQPOQj5zXvJPEtDZYc6LrZpPxiH2b1m2NIQIDAQAB";
// ---------------------------------------------------------------------------
// Token cache (in-memory, 6일)
// ---------------------------------------------------------------------------
let cachedToken = null;
async function getToken() {
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
    const data = (await res.json());
    if (!data.access_token) {
        throw new Error("CODEF OAuth response missing access_token");
    }
    cachedToken = { token: data.access_token, expiry: Date.now() + 6 * 24 * 60 * 60 * 1000 };
    return cachedToken.token;
}
// ---------------------------------------------------------------------------
// RSA 암호화
// ---------------------------------------------------------------------------
function encryptRSA(plainText) {
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${CODEF_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
    const encrypted = crypto.publicEncrypt({ key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plainText, "utf-8"));
    return encrypted.toString("base64");
}
// ---------------------------------------------------------------------------
// 기관코드 매핑
// ---------------------------------------------------------------------------
const ORG_MAP = {
    // 은행 (BK)
    "국민은행": { code: "0004", businessType: "BK" },
    "신한은행": { code: "0088", businessType: "BK" },
    "우리은행": { code: "0020", businessType: "BK" },
    "하나은행": { code: "0081", businessType: "BK" },
    "농협": { code: "0011", businessType: "BK" },
    "IBK기업은행": { code: "0003", businessType: "BK" },
    "SC제일은행": { code: "0023", businessType: "BK" },
    "카카오뱅크": { code: "0090", businessType: "BK" },
    "토스뱅크": { code: "0092", businessType: "BK" },
    "케이뱅크": { code: "0089", businessType: "BK" },
    "수협은행": { code: "0007", businessType: "BK" },
    "OK저축은행": { code: "0105", businessType: "BK" },
    "SBI저축은행": { code: "0101", businessType: "BK" },
    // 카드 (CD)
    "삼성카드": { code: "0303", businessType: "CD" },
    "현대카드": { code: "0302", businessType: "CD" },
    "롯데카드": { code: "0311", businessType: "CD" },
    "BC카드": { code: "0305", businessType: "CD" }, // dev API 검증: 0305
    "KB국민카드": { code: "0301", businessType: "CD" },
    "신한카드": { code: "0306", businessType: "CD" },
    "우리카드": { code: "0309", businessType: "CD" },
    "하나카드": { code: "0313", businessType: "CD" },
    "NH카드": { code: "0304", businessType: "CD" },
    // 보험 (IS) — CODEF는 보험협회 어그리게이터 코드 사용
    "삼성생명": { code: "0002", businessType: "IS" }, // 생명보험협회
    "한화생명": { code: "0002", businessType: "IS" }, // 생명보험협회
    "교보생명": { code: "0002", businessType: "IS" }, // 생명보험협회
    "삼성화재": { code: "0003", businessType: "IS" }, // 손해보험협회
    "현대해상": { code: "0003", businessType: "IS" }, // 손해보험협회
    "DB손해보험": { code: "0003", businessType: "IS" }, // 손해보험협회
};
const LOGIN_TYPE_MAP = {
    cert: "0", finCert: "0", kakao: "1", pass: "1",
};
function buildAccountList(banks, credentials) {
    const encPw = encryptRSA(credentials.password);
    const codefLoginType = LOGIN_TYPE_MAP[credentials.loginType] ?? "1";
    const result = [];
    const seen = new Set(); // 보험 어그리게이터 중복 방지
    for (const bankName of banks) {
        const org = ORG_MAP[bankName];
        if (!org)
            continue;
        // 인증서 로그인(loginType 0) 미지원 기관 스킵
        if (codefLoginType === "0") {
            // 인터넷전용은행은 인증서 로그인 미지원 (간편인증만)
            if (["0090", "0092", "0089"].includes(org.code))
                continue;
        }
        // 동일 기관코드+businessType 중복 스킵 (보험 어그리게이터 등)
        const key = `${org.code}_${org.businessType}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const account = {
            countryCode: "KR", businessType: org.businessType, clientType: "P",
            organization: org.code, loginType: codefLoginType,
            password: encPw,
        };
        if (codefLoginType === "0") {
            // 공동인증서 (loginType 0) — PFX 방식 (certFile)
            account.certType = "0";
            if (credentials.pfxFile) {
                account.certFile = credentials.pfxFile;
            }
        }
        else {
            account.id = credentials.id;
        }
        result.push(account);
    }
    return result;
}
// ---------------------------------------------------------------------------
// CODEF API 호출
// ---------------------------------------------------------------------------
async function callCodef(token, endpoint, body) {
    async function doFetch(authToken) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const jsonBody = JSON.stringify(body);
        // 요청 로깅 (비밀번호/파일 데이터 제외)
        const logBody = JSON.parse(jsonBody);
        if (logBody.accountList) {
            logBody.accountList = logBody.accountList.map((a) => ({
                ...a,
                password: a.password ? '[ENCRYPTED]' : undefined,
                certFile: a.certFile ? `[${a.certFile.length}chars]` : undefined,
            }));
        }
        const startMs = Date.now();
        console.log(`[CODEF] → ${endpoint}:`, JSON.stringify(logBody).slice(0, 500));
        const encodedBody = encodeURIComponent(jsonBody);
        try {
            const res = await fetch(`${getCodefBase()}${endpoint}`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: encodedBody,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const text = await res.text();
            const elapsed = Date.now() - startMs;
            // 항상 URL 디코딩 먼저 (CODEF SDK 방식)
            let decoded;
            try {
                decoded = decodeURIComponent(text.replace(/\+/g, " "));
            }
            catch {
                decoded = text;
            }
            console.log(`[CODEF] ← ${endpoint} [${res.status}] ${elapsed}ms: ${decoded.slice(0, 1000)}`);
            if (!res.ok)
                console.log(`[CODEF] Full error: ${decoded}`);
            return { status: res.status, decoded };
        }
        catch (err) {
            clearTimeout(timeout);
            throw new Error(`CODEF API error on ${endpoint}: ${err instanceof Error ? err.message : "호출 실패"}`);
        }
    }
    // 1차 시도
    let result = await doFetch(token);
    // 401 → 토큰 갱신 후 재시도
    if (result.status === 401) {
        console.log("[CODEF] 401 → 토큰 갱신 후 재시도");
        cachedToken = null;
        const newToken = await getToken();
        result = await doFetch(newToken);
    }
    // URL 디코딩된 문자열을 JSON 파싱
    let parsed;
    try {
        parsed = JSON.parse(result.decoded);
    }
    catch {
        console.error(`[CODEF] JSON 파싱 실패 (${endpoint}): ${result.decoded.slice(0, 500)}`);
        throw new Error(`CODEF 응답 파싱 실패 (HTTP ${result.status}): 서버가 비정상 응답을 반환했습니다.`);
    }
    // CODEF 인증 에러 시 토큰 캐시 무효화
    const code = parsed?.result?.code;
    if (code === "CF-00401" || code === "CF-09999") {
        cachedToken = null;
    }
    return parsed;
}
function parseDebts(bankLoans, cardLoans) {
    const debts = [];
    for (const loan of bankLoans?.data?.resList ?? []) {
        debts.push({ id: crypto.randomUUID(), name: loan.resLoanName ?? "은행대출",
            creditor: loan.resBankName ?? "", type: "무담보",
            amount: Number(loan.resLoanBalance ?? 0), rate: Number(loan.resLoanInterest ?? 0),
            monthly: 0, source: "codef" });
    }
    for (const loan of cardLoans?.data?.resList ?? []) {
        debts.push({ id: crypto.randomUUID(), name: loan.resLoanName ?? "카드론",
            creditor: loan.resCardName ?? "", type: "무담보",
            amount: Number(loan.resLoanBalance ?? 0), rate: Number(loan.resLoanInterest ?? 0),
            monthly: 0, source: "codef" });
    }
    return debts;
}
function parseAssets(accounts, insurance) {
    const assets = [];
    for (const acc of accounts?.data?.resList ?? []) {
        const balance = Number(acc.resAccountBalance ?? 0);
        if (balance > 0) {
            assets.push({ id: crypto.randomUUID(),
                name: `${acc.resBankName ?? ""} ${acc.resAccountName ?? "예금"}`,
                type: "예금", rawValue: balance, liquidationRate: 1.0,
                mortgage: 0, value: balance, source: "codef" });
        }
    }
    for (const item of insurance?.data?.resList ?? []) {
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
// ---------------------------------------------------------------------------
// (샌드박스 데이터 제거됨 — 모든 요청은 실제 CODEF API를 호출합니다)
// ---------------------------------------------------------------------------
// 공통: Connected ID 생성 + 기본 수집
// ---------------------------------------------------------------------------
async function collectWithCodef(token, accountList) {
    // 계정 등록 요청 로깅
    const acctCount = Array.isArray(accountList) ? accountList.length : 0;
    const acctOrgs = Array.isArray(accountList)
        ? accountList.map((a) => `${a.organization}(${a.businessType})`).join(", ")
        : "unknown";
    console.log(`[CODEF] account/create 요청: ${acctCount}개 기관 [${acctOrgs}]`);
    const acctData = (await callCodef(token, "/v1/account/create", { accountList }));
    const codefCode = acctData?.result?.code;
    const codefMsg = acctData?.result?.message;
    const cid = acctData?.data?.connectedId;
    console.log(`[CODEF] account/create 응답: code=${codefCode}, msg=${codefMsg}, connectedId=${cid ?? "없음"}`);
    // 부분 성공 처리: 일부 기관이 실패해도 connectedId가 있으면 계속 진행
    const successList = acctData?.data?.successList ?? [];
    const errorList = acctData?.data?.errorList ?? [];
    if (errorList.length > 0) {
        const skipped = errorList.map((e) => `${e.organization}(${e.code}: ${e.message})`);
        console.log(`[CODEF] 부분 실패 — 건너뛴 기관: ${skipped.join(", ")}`);
    }
    if (successList.length > 0) {
        console.log(`[CODEF] 성공 기관: ${successList.map((s) => s.organization).join(", ")}`);
    }
    if (!cid) {
        // 모든 기관이 실패한 경우 — 상세 에러 로깅
        console.error(`[CODEF] account/create 실패 전체 응답:`, JSON.stringify(acctData).slice(0, 2000));
        const msg = codefMsg ?? "금융기관 계정 연결 실패";
        const detail = errorList.length > 0
            ? errorList.map((e) => `${e.organization}: ${e.message}`).join("; ")
            : undefined;
        return { error: msg, code: codefCode, detail: detail ?? acctData };
    }
    const reqBody = { connectedId: cid };
    const [bankAccounts, bankLoans, cardLoans, insurance] = await Promise.allSettled([
        callCodef(token, "/v1/kr/bank/p/account/account-basic", reqBody),
        callCodef(token, "/v1/kr/bank/p/loan/loan-list", reqBody),
        callCodef(token, "/v1/kr/card/p/loan/loan-list", reqBody),
        callCodef(token, "/v1/kr/insurance/p/common/product-list", reqBody),
    ]);
    const g = (r) => r.status === "fulfilled" ? r.value : null;
    const debts = parseDebts(g(bankLoans), g(cardLoans));
    const assets = parseAssets(g(bankAccounts), g(insurance));
    return {
        connectedId: cid, debts, assets,
        summary: {
            debtCount: debts.length, debtTotal: debts.reduce((s, d) => s + d.amount, 0),
            assetCount: assets.length, assetTotal: assets.reduce((s, a) => s + a.value, 0),
        },
        ...(errorList.length > 0 && {
            skippedOrgs: errorList.map((e) => ({
                organization: e.organization,
                code: e.code,
                message: e.message,
            })),
        }),
    };
}
// ---------------------------------------------------------------------------
// POST /codef/collect (인증된 법무사용)
// ---------------------------------------------------------------------------
async function handleCodefCollect(req, res) {
    try {
        const body = req.body;
        if (body.connectedId !== undefined)
            (0, validators_1.validateConnectedId)(body.connectedId);
        if (!body.connectedId)
            (0, validators_1.validateCredentials)(body.credentials);
        (0, validators_1.validateBanks)(body.banks);
        const token = await getToken();
        if (body.connectedId) {
            const reqBody = { connectedId: body.connectedId };
            const [ba, bl, cl, ins] = await Promise.allSettled([
                callCodef(token, "/v1/kr/bank/p/account/account-basic", reqBody),
                callCodef(token, "/v1/kr/bank/p/loan/loan-list", reqBody),
                callCodef(token, "/v1/kr/card/p/loan/loan-list", reqBody),
                callCodef(token, "/v1/kr/insurance/p/common/product-list", reqBody),
            ]);
            const g = (r) => r.status === "fulfilled" ? r.value : null;
            const debts = parseDebts(g(bl), g(cl));
            const assets = parseAssets(g(ba), g(ins));
            res.json({ connectedId: body.connectedId, debts, assets, summary: {
                    debtCount: debts.length, debtTotal: debts.reduce((s, d) => s + d.amount, 0),
                    assetCount: assets.length, assetTotal: assets.reduce((s, a) => s + a.value, 0),
                } });
            return;
        }
        const accountList = body.banks?.length
            ? buildAccountList(body.banks, body.credentials) : [body.credentials];
        if (accountList.length === 0) {
            res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" });
            return;
        }
        const result = await collectWithCodef(token, accountList);
        if ("error" in result) {
            console.error(`[CODEF] handleCodefCollect 실패:`, JSON.stringify(result).slice(0, 1000));
            res.status(502).json(result);
            return;
        }
        res.json(result);
    }
    catch (err) {
        if (err instanceof validators_1.ValidationError) {
            res.status(400).json({ error: err.message });
            return;
        }
        console.error(`[CODEF] handleCodefCollect 예외:`, err.message, err.stack?.slice(0, 500));
        res.status(500).json({ error: "CODEF 수집 중 오류가 발생했습니다" });
    }
}
// ---------------------------------------------------------------------------
// POST /intake/codef-collect (의뢰인용, 인증 불필요)
// ---------------------------------------------------------------------------
async function handleIntakeCodefCollect(req, res) {
    try {
        const body = req.body;
        (0, validators_1.validateTokenId)(body.tokenId);
        (0, validators_1.validateCredentials)(body.credentials);
        (0, validators_1.validateBanks)(body.banks);
        // Validate intake token and mark as used atomically via transaction
        const tokenRef = admin.firestore().collection('intakeTokens').doc(body.tokenId);
        await admin.firestore().runTransaction(async (transaction) => {
            const tokenDoc = await transaction.get(tokenRef);
            if (!tokenDoc.exists) {
                throw new Error("유효하지 않은 토큰입니다");
            }
            const tokenData = tokenDoc.data();
            if (tokenData?.used) {
                throw new Error("이미 사용된 토큰입니다");
            }
            if (tokenData?.expiresAt && tokenData.expiresAt.toDate() < new Date()) {
                throw new Error("만료된 토큰입니다");
            }
            transaction.update(tokenRef, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        const token = await getToken();
        const accountList = body.banks?.length
            ? buildAccountList(body.banks, body.credentials) : [body.credentials];
        if (accountList.length === 0) {
            res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" });
            return;
        }
        const result = await collectWithCodef(token, accountList);
        if ("error" in result) {
            console.error(`[CODEF] handleIntakeCodefCollect 실패:`, JSON.stringify(result).slice(0, 1000));
            res.status(502).json(result);
            return;
        }
        res.json(result);
    }
    catch (err) {
        if (err instanceof validators_1.ValidationError) {
            res.status(400).json({ error: err.message });
            return;
        }
        console.error(`[CODEF] handleIntakeCodefCollect 예외:`, err.message, err.stack?.slice(0, 500));
        res.status(500).json({ error: "CODEF 수집 중 오류가 발생했습니다" });
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
async function handleStatementData(req, res) {
    try {
        const { connectedId } = req.body;
        (0, validators_1.validateConnectedId)(connectedId);
        const token = await getToken();
        const now = new Date();
        const ago1y = new Date(now);
        ago1y.setFullYear(now.getFullYear() - 1);
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
        const g = (r) => r.status === "fulfilled" ? r.value : null;
        res.json({
            newDebts: stmtNewDebts(g(bLoans), g(cLoans), startDate),
            largeTransfers: stmtTransfers(g(bankTxns), 2000000),
            cashWithdrawals: stmtCash(g(bankTxns), 1000000),
            largeCardUsage: stmtCard(g(cardAppr), 1000000),
            cancelledInsurance: stmtInsCancel(g(insList)),
        });
    }
    catch (err) {
        if (err instanceof validators_1.ValidationError) {
            res.status(400).json({ error: err.message });
            return;
        }
        console.error(`[CODEF] handleStatementData 예외:`, err.message);
        res.status(500).json({ error: "진술서 데이터 수집 중 오류가 발생했습니다" });
    }
}
// ---------------------------------------------------------------------------
// 진술서 파싱 헬퍼
// ---------------------------------------------------------------------------
function fmtD(d) { return d.toISOString().slice(0, 10).replace(/-/g, ""); }
function stmtNewDebts(bl, cl, since) {
    const r = [];
    for (const l of [...(bl?.data?.resList ?? []), ...(cl?.data?.resList ?? [])]) {
        const dt = l.resLoanDate ?? l.resContractDate ?? "";
        if (dt >= since)
            r.push({ creditor: l.resBankName ?? l.resCardName ?? "", type: l.resLoanName ?? "대출", amount: Number(l.resLoanBalance ?? 0), date: dt });
    }
    return r;
}
function stmtTransfers(txns, th) {
    const r = [];
    for (const tx of txns?.data?.resList ?? []) {
        const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
        const tp = tx.resAccountTrType ?? "";
        if (amt >= th && (tp.includes("이체") || tp.includes("송금")))
            r.push({ account: tx.resAccountNum ?? "", date: tx.resAccountTrDate ?? "", amount: amt, recipient: tx.resAccountDesc ?? "", memo: tx.resAccountMemo ?? "" });
    }
    return r;
}
function stmtCash(txns, th) {
    const r = [];
    for (const tx of txns?.data?.resList ?? []) {
        const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
        const tp = tx.resAccountTrType ?? "";
        if (amt >= th && (tp.includes("현금") || tp.includes("인출") || tp.includes("수표") || tp === "출금"))
            r.push({ account: tx.resAccountNum ?? "", date: tx.resAccountTrDate ?? "", amount: amt, memo: tx.resAccountMemo ?? "" });
    }
    return r;
}
function stmtCard(approvals, th) {
    const r = [];
    for (const tx of approvals?.data?.resList ?? []) {
        const amt = Number(tx.resApprovalAmount ?? tx.resUsedAmount ?? 0);
        if (amt >= th)
            r.push({ cardNo: tx.resCardNo ?? "", date: tx.resApprovalDate ?? "", amount: amt, merchant: tx.resMerchantName ?? "" });
    }
    return r;
}
function stmtInsCancel(ins) {
    const r = [];
    for (const it of ins?.data?.resList ?? []) {
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
 * - 인증 완료 시 connectedId 반환
 */
async function handleSimpleAuthStart(req, res) {
    try {
        const { userName, birthDate, phoneNo, provider, banks } = req.body;
        if (!userName || !birthDate || !phoneNo) {
            res.status(400).json({ error: "이름, 생년월일, 전화번호가 필요합니다" });
            return;
        }
        if (!banks || banks.length === 0) {
            res.status(400).json({ error: "금융기관을 선택해주세요" });
            return;
        }
        const token = await getToken();
        const loginTypeLevel = provider ?? "1"; // 기본: 카카오톡
        // 간편인증용 계정 목록 (loginType "5")
        const accountList = [];
        const seen = new Set();
        for (const bankName of banks) {
            const org = ORG_MAP[bankName];
            if (!org)
                continue;
            const key = `${org.code}_${org.businessType}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            accountList.push({
                countryCode: "KR",
                businessType: org.businessType,
                clientType: "P",
                organization: org.code,
                loginType: "5", // 간편인증
                loginTypeLevel, // 인증 제공사
                userName,
                phoneNo: phoneNo.replace(/-/g, ""),
                identity: birthDate,
                password: encryptRSA(""), // CODEF 필수 필드 (RSA 암호화된 빈 문자열)
            });
        }
        if (accountList.length === 0) {
            res.status(400).json({ error: "유효한 금융기관이 없습니다" });
            return;
        }
        console.log(`[CODEF] 간편인증 시작: ${userName}, 금융기관 ${accountList.length}개, 제공사 ${loginTypeLevel}`);
        const result = await callCodef(token, "/v1/account/create", { accountList });
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
    }
    catch (err) {
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
async function handleSimpleAuthComplete(req, res) {
    try {
        const { twoWayInfo, banks, phoneNo, birthDate, userName, provider } = req.body;
        if (!twoWayInfo?.jti) {
            res.status(400).json({ error: "인증 정보가 없습니다" });
            return;
        }
        const token = await getToken();
        const loginTypeLevel = provider ?? "1";
        // 2-way 완료 요청 (간편인증 loginType "5")
        const accountList = [];
        const seen = new Set();
        for (const bankName of banks) {
            const org = ORG_MAP[bankName];
            if (!org)
                continue;
            const key = `${org.code}_${org.businessType}`;
            if (seen.has(key))
                continue;
            seen.add(key);
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
                password: encryptRSA(""), // CODEF 필수 필드
            });
        }
        console.log(`[CODEF] 간편인증 완료 요청: jti=${twoWayInfo.jti}`);
        const result = await callCodef(token, "/v1/account/create", {
            accountList,
            simpleAuth: "1",
            is2Way: true,
            twoWayInfo,
        });
        const code = result?.result?.code ?? "";
        console.log(`[CODEF] 간편인증 완료 응답 코드: ${code}`);
        const connectedId = result?.data?.connectedId;
        if (connectedId) {
            res.json({ status: "done", connectedId });
            return;
        }
        if (code === "CF-03002") {
            // 새로운 twoWayInfo가 포함되어 있으면 갱신하여 반환
            const newTwoWayInfo = result?.data ? {
                jobIndex: result.data.jobIndex ?? twoWayInfo.jobIndex,
                threadIndex: result.data.threadIndex ?? twoWayInfo.threadIndex,
                jti: result.data.jti ?? twoWayInfo.jti,
                twoWayTimestamp: result.data.twoWayTimestamp ?? twoWayInfo.twoWayTimestamp,
            } : undefined;
            res.json({
                status: "pending",
                message: "아직 인증이 완료되지 않았습니다. 폰에서 인증을 완료해주세요.",
                ...(newTwoWayInfo && { twoWayInfo: newTwoWayInfo }),
            });
            return;
        }
        // 에러 코드별 상세 메시지
        const errorMessages = {
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
    }
    catch (err) {
        console.error("[CODEF] 간편인증 완료 오류:", err);
        res.status(500).json({ error: err.message ?? "간편인증 완료 실패" });
    }
}
// ---------------------------------------------------------------------------
// POST /codef/test-connection — CODEF 연결 진단
// ---------------------------------------------------------------------------
async function handleCodefTestConnection(_req, res) {
    const results = {};
    // 1) OAuth 토큰 테스트
    try {
        const start = Date.now();
        const token = await getToken();
        results.oauth = { ok: true, elapsed: Date.now() - start, tokenLength: token.length };
    }
    catch (err) {
        results.oauth = { ok: false, error: err.message };
    }
    // 2) API 연결 테스트 (connectedId-list 조회)
    try {
        const token = await getToken();
        const start = Date.now();
        const resp = await callCodef(token, "/v1/account/connectedId-list", { pageNo: 0 });
        results.api = { ok: true, elapsed: Date.now() - start, code: resp?.result?.code };
    }
    catch (err) {
        results.api = { ok: false, error: err.message };
    }
    results.config = {
        host: getCodefBase(),
        hasClientId: !!process.env.CODEF_CLIENT_ID,
        hasClientSecret: !!process.env.CODEF_CLIENT_SECRET,
        hasPublicKey: !!CODEF_PUBLIC_KEY,
    };
    res.json(results);
}
//# sourceMappingURL=codefProxy.js.map