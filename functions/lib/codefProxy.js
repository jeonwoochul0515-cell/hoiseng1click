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
exports.handleCodefCollect = handleCodefCollect;
exports.handleIntakeCodefCollect = handleIntakeCodefCollect;
exports.handleStatementData = handleStatementData;
exports.handleSimpleAuthStart = handleSimpleAuthStart;
exports.handleSimpleAuthComplete = handleSimpleAuthComplete;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const forge = __importStar(require("node-forge"));
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";
function getCodefBase() {
    return process.env.CODEF_API_HOST || "https://development.codef.io";
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
    "토스뱅크": { code: "0048", businessType: "BK" }, // 수정: 0092→0048
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
/**
 * PFX(PKCS#12) → derFile + keyFile 분리
 * 사용자가 PFX 파일을 업로드하면 CODEF가 요구하는 derFile/keyFile로 분리합니다.
 */
function pfxToDerKey(pfxBase64, password) {
    try {
        const p12Der = forge.util.decode64(pfxBase64);
        const p12Asn1 = forge.asn1.fromDer(p12Der);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        // 인증서 추출
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certBag = certBags[forge.pki.oids.certBag]?.[0];
        if (!certBag?.cert)
            throw new Error("PFX에서 인증서를 찾을 수 없습니다.");
        const certAsn1 = forge.pki.certificateToAsn1(certBag.cert);
        const certDer = forge.asn1.toDer(certAsn1).getBytes();
        const derFile = forge.util.encode64(certDer);
        // 개인키 추출 → PKCS#8 암호화 DER
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
        if (!keyBag?.key)
            throw new Error("PFX에서 개인키를 찾을 수 없습니다.");
        const keyAsn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keyBag.key));
        const encKeyAsn1 = forge.pki.encryptPrivateKeyInfo(keyAsn1, password, { algorithm: 'aes256' });
        const keyDer = forge.asn1.toDer(encKeyAsn1).getBytes();
        const keyFile = forge.util.encode64(keyDer);
        console.log(`[CODEF] PFX → DER+KEY 분리 성공: der=${derFile.length}chars, key=${keyFile.length}chars`);
        return { derFile, keyFile };
    }
    catch (err) {
        console.error("[CODEF] PFX 분리 실패:", err.message);
        throw new Error(`인증서 처리 실패: ${err.message}`);
    }
}
// 레거시: derKeyToPfx (사용하지 않음)
function derKeyToPfx(derBase64, keyBase64, password) {
    try {
        const derBuf = Buffer.from(derBase64, "base64");
        const keyBuf = Buffer.from(keyBase64, "base64");
        // DER → forge 인증서
        const derAsn1 = forge.asn1.fromDer(forge.util.createBuffer(derBuf));
        const cert = forge.pki.certificateFromAsn1(derAsn1);
        // KEY 파일 → forge 개인키 (한국 공동인증서는 PKCS#8 암호화된 형태)
        const keyPem = forge.pki.encryptedPrivateKeyToPem(forge.asn1.fromDer(forge.util.createBuffer(keyBuf)));
        const privateKey = forge.pki.decryptRsaPrivateKey(keyPem, password);
        if (!privateKey) {
            throw new Error("인증서 비밀번호가 올바르지 않습니다.");
        }
        // PFX(PKCS#12) 생성
        const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password, {
            algorithm: "3des",
        });
        const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
        const pfxBase64 = forge.util.encode64(p12Der);
        console.log(`[CODEF] PFX 변환 성공: ${pfxBase64.length} chars`);
        return pfxBase64;
    }
    catch (err) {
        console.error("[CODEF] PFX 변환 실패:", err.message);
        throw new Error(`인증서 변환 실패: ${err.message}`);
    }
}
function buildAccountList(banks, credentials) {
    const encPw = encryptRSA(credentials.password);
    const codefLoginType = LOGIN_TYPE_MAP[credentials.loginType] ?? "1";
    const result = [];
    const seen = new Set(); // 보험 어그리게이터 중복 방지
    for (const bankName of banks) {
        const org = ORG_MAP[bankName];
        if (!org)
            continue;
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
            // 공동인증서 (loginType 0)
            if (credentials.derFile && credentials.keyFile) {
                // signCert.der + signPri.key 직접 업로드 (easycodef-node SDK 방식)
                account.certType = "1";
                account.derFile = credentials.derFile;
                account.keyFile = credentials.keyFile;
            }
            else if (credentials.pfxFile) {
                // PFX(PKCS#12) 파일 직접 전송
                account.certFile = credentials.pfxFile;
                account.certPassword = encPw;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const jsonBody = JSON.stringify(body);
    // 요청 로깅 (비밀번호/파일 데이터 제외)
    const logBody = JSON.parse(jsonBody);
    if (logBody.accountList) {
        logBody.accountList = logBody.accountList.map((a) => ({
            ...a,
            password: a.password ? '[ENCRYPTED]' : undefined,
            certPassword: a.certPassword ? '[ENCRYPTED]' : undefined,
            derFile: a.derFile ? `[${a.derFile.length}chars]` : undefined,
            keyFile: a.keyFile ? `[${a.keyFile.length}chars]` : undefined,
            pfxFile: a.pfxFile ? `[${a.pfxFile.length}chars]` : undefined,
            certFile: a.certFile ? `[${a.certFile.length}chars]` : undefined,
        }));
    }
    console.log(`[CODEF] Calling ${endpoint}:`, JSON.stringify(logBody).slice(0, 500));
    // CODEF 공식 SDK(easycodef-node) 기준: body를 URL 인코딩해서 전송
    const encodedBody = encodeURIComponent(jsonBody);
    try {
        const res = await fetch(`${getCodefBase()}${endpoint}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: encodedBody,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await res.text();
        const decoded = (() => { try {
            return decodeURIComponent(text.replace(/\+/g, " "));
        }
        catch {
            return text;
        } })();
        console.log(`[CODEF] Response ${endpoint}: ${res.status}`);
        console.log(`[CODEF] Body: ${decoded.slice(0, 1000)}`);
        try {
            return JSON.parse(text);
        }
        catch {
            return JSON.parse(decodeURIComponent(text.replace(/\+/g, " ")));
        }
    }
    catch (err) {
        clearTimeout(timeout);
        const message = err instanceof Error ? err.message : "CODEF API 호출 실패";
        throw new Error(`CODEF API error on ${endpoint}: ${message}`);
    }
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
    const acctData = (await callCodef(token, "/v1/account/create", { accountList }));
    const cid = acctData?.data?.connectedId;
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
        // 모든 기관이 실패한 경우
        const msg = acctData?.result?.message ?? "금융기관 계정 연결 실패";
        const detail = errorList.length > 0
            ? errorList.map((e) => `${e.organization}: ${e.message}`).join("; ")
            : undefined;
        return { error: msg, detail: detail ?? acctData };
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
            res.status(500).json(result);
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "CODEF 수집 실패" });
    }
}
// ---------------------------------------------------------------------------
// POST /intake/codef-collect (의뢰인용, 인증 불필요)
// ---------------------------------------------------------------------------
async function handleIntakeCodefCollect(req, res) {
    try {
        const body = req.body;
        if (!body.tokenId) {
            res.status(400).json({ error: "토큰 ID가 필요합니다" });
            return;
        }
        if (!body.credentials) {
            res.status(400).json({ error: "금융기관 인증 정보가 필요합니다" });
            return;
        }
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
        // Mark token as used before calling CODEF to prevent reuse
        await tokenRef.update({ used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
        const token = await getToken();
        const accountList = body.banks?.length
            ? buildAccountList(body.banks, body.credentials) : [body.credentials];
        if (accountList.length === 0) {
            res.status(400).json({ error: "유효한 금융기관이 선택되지 않았습니다" });
            return;
        }
        const result = await collectWithCodef(token, accountList);
        if ("error" in result) {
            res.status(500).json(result);
            return;
        }
        res.json(result);
    }
    catch (err) {
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
async function handleStatementData(req, res) {
    try {
        const { connectedId } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
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
        res.status(500).json({ error: err.message ?? "진술서 데이터 수집 실패" });
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
            res.json({ status: "pending", message: "아직 인증이 완료되지 않았습니다. 폰에서 인증을 완료해주세요." });
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
//# sourceMappingURL=codefProxy.js.map