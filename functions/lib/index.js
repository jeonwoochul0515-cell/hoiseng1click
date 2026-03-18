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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const codefProxy_1 = require("./codefProxy");
const publicDataProxy_1 = require("./publicDataProxy");
const docGenerator_1 = require("./docGenerator");
const codefPublic_1 = require("./codefPublic");
const codefFinance_1 = require("./codefFinance");
const publicDataRegisters_1 = require("./publicDataRegisters");
const statementHelpers_1 = require("./statementHelpers");
const aiWriter_1 = require("./aiWriter");
const codefProperty_1 = require("./codefProperty");
const ssnCrypto_1 = require("./ssnCrypto");
const ocrProcessor_1 = require("./ocrProcessor");
admin.initializeApp();
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://hoiseng1click.web.app',
    'https://hoiseng1click.firebaseapp.com'
];
const app = (0, express_1.default)();
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});
app.use(express_1.default.json());
// ── Public routes (인증 불필요 — 의뢰인 디바이스에서 호출) ──
app.post("/intake/codef-collect", codefProxy_1.handleIntakeCodefCollect);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
// 임시: HWPX 템플릿 업로드 (base64 body)
app.post("/admin/upload-template", async (req, res) => {
    try {
        const { name, data } = req.body;
        if (!name || !data) {
            res.status(400).json({ error: "name, data required" });
            return;
        }
        const buf = Buffer.from(data, "base64");
        const bucket = admin.storage().bucket();
        const file = bucket.file(`templates/hwpx/${name}`);
        await file.save(buf, { contentType: "application/octet-stream" });
        res.json({ ok: true, path: `templates/hwpx/${name}`, size: buf.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ── Auth middleware (아래 라우트는 법무사 로그인 필요) ──
app.use(async (req, res, next) => {
    const auth = req.headers.authorization ?? "";
    const token = auth.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "인증 필요" });
        return;
    }
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = { uid: decoded.uid, email: decoded.email ?? "", plan: decoded.plan ?? "starter" };
        next();
    }
    catch {
        res.status(401).json({ error: "인증 실패" });
    }
});
app.post("/codef/collect", codefProxy_1.handleCodefCollect);
app.post("/codef/simple-auth/start", codefProxy_1.handleSimpleAuthStart);
app.post("/codef/simple-auth/complete", codefProxy_1.handleSimpleAuthComplete);
app.post("/codef/statement-data", codefProxy_1.handleStatementData);
app.get("/public/property", publicDataProxy_1.handlePropertyLookup);
app.get("/public/vehicle", publicDataProxy_1.handleVehicleLookup);
app.post("/doc/generate", docGenerator_1.handleDocGenerate);
// 공공기관 CODEF
app.post("/codef/public-collect", codefPublic_1.handlePublicDataCollect);
app.post("/codef/public/income-proof", codefPublic_1.handleIncomeProof);
app.post("/codef/public/withholding-tax", codefPublic_1.handleWithholdingTax);
app.post("/codef/public/business-registration", codefPublic_1.handleBusinessRegistration);
app.post("/codef/public/health-insurance", codefPublic_1.handleHealthInsurance);
app.post("/codef/public/health-insurance-premium", codefPublic_1.handleHealthInsurancePremium);
app.post("/codef/public/pension", codefPublic_1.handleNationalPension);
// 금융 확장
app.post("/codef/card-approvals", codefFinance_1.handleCardApprovals);
app.post("/codef/card-bills", codefFinance_1.handleCardBills);
app.post("/codef/bank-transactions", codefFinance_1.handleBankTransactions);
app.post("/codef/stock-accounts", codefFinance_1.handleStockAccounts);
app.post("/codef/stock-assets", codefFinance_1.handleStockAssets);
app.post("/codef/stock-transactions", codefFinance_1.handleStockTransactions);
app.post("/codef/finance-collect", codefFinance_1.handleExtendedFinanceCollect);
// 공공데이터 확장
app.get("/public/land-register", publicDataRegisters_1.handleLandRegister);
app.get("/public/building-register", publicDataRegisters_1.handleBuildingRegister);
app.get("/public/building-area", publicDataRegisters_1.handleBuildingArea);
// CODEF 재산 조회 (차량등록원부 + 부동산 공시가격)
app.post("/codef/vehicle-info", codefProperty_1.handleVehicleInfo);
app.post("/codef/property-price", codefProperty_1.handlePropertyPrice);
app.post("/codef/asset-lookup", codefProperty_1.handleAssetLookup);
// 상세 신고서 v2
app.post("/codef/statement-data-v2", statementHelpers_1.handleStatementDataV2);
// AI 진술서 작성
app.post("/ai/generate", aiWriter_1.handleAiGenerate);
// 서류 OCR 처리
app.post("/doc/ocr", ocrProcessor_1.handleDocOcr);
// ── 개인회생 서류 자동수집 (정부24/대법원/위택스/홈택스) ──
app.post("/public/resident-registration", codefPublic_1.handleResidentRegistration);
app.post("/public/resident-abstract", codefPublic_1.handleResidentAbstract);
app.post("/public/family-relation", codefPublic_1.handleFamilyRelation);
app.post("/public/property-registry", codefPublic_1.handlePropertyRegistry);
app.post("/public/tax-payment-cert", codefPublic_1.handleTaxPaymentCert);
app.post("/public/wage-statement", codefPublic_1.handleWageStatement);
app.post("/public/vat-cert", codefPublic_1.handleVatCert);
app.post("/public/financial-statement", codefPublic_1.handleFinancialStatement);
app.post("/public/local-tax-assessment", codefPublic_1.handleLocalTaxAssessment);
app.post("/public/local-tax-payment", codefPublic_1.handleLocalTaxPayment);
app.post("/public/vehicle-registration", codefPublic_1.handleVehicleRegistration);
app.post("/public/local-tax-cert", codefPublic_1.handleLocalTaxCert);
app.post("/public/national-tax-cert", codefPublic_1.handleNationalTaxCert);
app.post("/public/four-insurance", codefPublic_1.handleFourInsurance);
// ── SSN 암호화/복호화 (주민등록번호 보호) ──
app.post("/crypto/encrypt-ssn", (req, res) => {
    try {
        const { ssn } = req.body;
        if (!ssn) {
            res.status(400).json({ error: "ssn 필드 필요" });
            return;
        }
        const encrypted = (0, ssnCrypto_1.encryptSSN)(ssn);
        const masked = (0, ssnCrypto_1.maskSSN)(ssn);
        res.json({ encrypted, masked });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "암호화 실패" });
    }
});
app.post("/crypto/decrypt-ssn", (req, res) => {
    try {
        const { encrypted } = req.body;
        if (!encrypted) {
            res.status(400).json({ error: "encrypted 필드 필요" });
            return;
        }
        const ssn = (0, ssnCrypto_1.decryptSSN)(encrypted);
        res.json({ ssn });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "복호화 실패" });
    }
});
app.post("/crypto/batch-decrypt-ssn", (req, res) => {
    try {
        const { items } = req.body;
        if (!items?.length) {
            res.status(400).json({ error: "items 필드 필요" });
            return;
        }
        const results = items.map(item => ({
            id: item.id,
            ssn: (0, ssnCrypto_1.decryptSSN)(item.encrypted),
        }));
        res.json({ results });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "일괄 복호화 실패" });
    }
});
// ── 기존 데이터 마이그레이션: 평문 SSN → 암호화 ──
app.post("/crypto/migrate-ssn", async (req, res) => {
    try {
        const user = req.user;
        const officeId = req.body.officeId || user.uid;
        const clientsSnap = await admin.firestore()
            .collection("offices").doc(officeId).collection("clients").get();
        let migrated = 0;
        const batch = admin.firestore().batch();
        for (const doc of clientsSnap.docs) {
            const data = doc.data();
            const ssn = data.ssn;
            if (!ssn)
                continue;
            // 이미 암호화된 데이터는 건너뛰기 (base64 + 최소 길이)
            try {
                const buf = Buffer.from(ssn, "base64");
                if (buf.length >= 28 && !/^\d{6}/.test(ssn))
                    continue; // 이미 암호화됨
            }
            catch { /* not base64, proceed */ }
            const encrypted = (0, ssnCrypto_1.encryptSSN)(ssn);
            const masked = (0, ssnCrypto_1.maskSSN)(ssn);
            batch.update(doc.ref, { ssnEncrypted: encrypted, ssnMasked: masked, ssn: "" });
            migrated++;
        }
        // intakeSubmissions도 마이그레이션
        const intakeSnap = await admin.firestore().collection("intakeSubmissions").where("officeId", "==", officeId).get();
        for (const doc of intakeSnap.docs) {
            const data = doc.data();
            const ssn = data.ssn;
            if (!ssn)
                continue;
            try {
                const buf = Buffer.from(ssn, "base64");
                if (buf.length >= 28 && !/^\d{6}/.test(ssn))
                    continue;
            }
            catch { /* not base64, proceed */ }
            const encrypted = (0, ssnCrypto_1.encryptSSN)(ssn);
            const masked = (0, ssnCrypto_1.maskSSN)(ssn);
            batch.update(doc.ref, { ssnEncrypted: encrypted, ssnMasked: masked, ssn: "" });
            migrated++;
        }
        await batch.commit();
        res.json({ ok: true, migrated });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "마이그레이션 실패" });
    }
});
exports.api = (0, https_1.onRequest)({ region: "asia-northeast3", invoker: "public", timeoutSeconds: 120 }, app);
//# sourceMappingURL=index.js.map