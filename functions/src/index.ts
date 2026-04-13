import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import { handleCodefCollect, handleIntakeCodefCollect, handleStatementData, handleSimpleAuthStart, handleSimpleAuthComplete, handleCodefTestConnection } from "./codefProxy";
import { handlePropertyLookup, handleVehicleLookup } from "./publicDataProxy";
import { handleDocGenerate } from "./docGenerator";
import { handleIncomeProof, handleWithholdingTax, handleBusinessRegistration, handleHealthInsurance, handleHealthInsurancePremium, handleNationalPension, handlePublicDataCollect, handleResidentRegistration, handleResidentAbstract, handleFamilyRelation, handlePropertyRegistry, handleTaxPaymentCert, handleWageStatement, handleVatCert, handleFinancialStatement, handleLocalTaxAssessment, handleLocalTaxPayment, handleVehicleRegistration, handleLocalTaxCert, handleNationalTaxCert, handleFourInsurance } from "./codefPublic";
import { handleCardApprovals, handleCardBills, handleBankTransactions, handleStockAccounts, handleStockAssets, handleStockTransactions, handleExtendedFinanceCollect } from "./codefFinance";
import { handleLandRegister, handleBuildingRegister, handleBuildingArea } from "./publicDataRegisters";
import { handleStatementDataV2 } from "./statementHelpers";
import { handleAiGenerate } from "./aiWriter";
import { handleVehicleInfo, handlePropertyPrice, handleAssetLookup } from "./codefProperty";
import { encryptSSN, decryptSSN, maskSSN } from "./ssnCrypto";
import { handleDocOcr, handleCreditReportParse, handleGeminiOcr } from "./ocrProcessor";
import { handlePublicAuthCreate } from "./codefPublicAuth";

admin.initializeApp();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://hoiseng1click.web.app',
  'https://hoiseng1click.firebaseapp.com'
];

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});
app.use(express.json());

// ── Public routes (인증 불필요 — 의뢰인 디바이스에서 호출) ──
app.post("/intake/codef-collect", handleIntakeCodefCollect);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

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
    (req as any).user = { uid: decoded.uid, email: decoded.email ?? "", plan: decoded.plan ?? "starter" };
    next();
  } catch {
    res.status(401).json({ error: "인증 실패" });
  }
});

// HWPX 템플릿 업로드 (인증 필요)
app.post("/admin/upload-template", async (req, res) => {
  try {
    const { name, data } = req.body as { name: string; data: string };
    if (!name || !data) { res.status(400).json({ error: "name, data required" }); return; }
    const buf = Buffer.from(data, "base64");
    const bucket = admin.storage().bucket();
    const file = bucket.file(`templates/hwpx/${name}`);
    await file.save(buf, { contentType: "application/octet-stream" });
    res.json({ ok: true, path: `templates/hwpx/${name}`, size: buf.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/codef/collect", handleCodefCollect);
app.post("/codef/test-connection", handleCodefTestConnection);
app.post("/codef/simple-auth/start", handleSimpleAuthStart);
app.post("/codef/simple-auth/complete", handleSimpleAuthComplete);
app.post("/codef/statement-data", handleStatementData);
app.get("/public/property", handlePropertyLookup);
app.get("/public/vehicle", handleVehicleLookup);
app.post("/doc/generate", handleDocGenerate);

// 공공기관 CODEF
app.post("/codef/public-collect", handlePublicDataCollect);
app.post("/codef/public/income-proof", handleIncomeProof);
app.post("/codef/public/withholding-tax", handleWithholdingTax);
app.post("/codef/public/business-registration", handleBusinessRegistration);
app.post("/codef/public/health-insurance", handleHealthInsurance);
app.post("/codef/public/health-insurance-premium", handleHealthInsurancePremium);
app.post("/codef/public/pension", handleNationalPension);

// 금융 확장
app.post("/codef/card-approvals", handleCardApprovals);
app.post("/codef/card-bills", handleCardBills);
app.post("/codef/bank-transactions", handleBankTransactions);
app.post("/codef/stock-accounts", handleStockAccounts);
app.post("/codef/stock-assets", handleStockAssets);
app.post("/codef/stock-transactions", handleStockTransactions);
app.post("/codef/finance-collect", handleExtendedFinanceCollect);

// 공공데이터 확장
app.get("/public/land-register", handleLandRegister);
app.get("/public/building-register", handleBuildingRegister);
app.get("/public/building-area", handleBuildingArea);

// CODEF 재산 조회 (차량등록원부 + 부동산 공시가격)
app.post("/codef/vehicle-info", handleVehicleInfo);
app.post("/codef/property-price", handlePropertyPrice);
app.post("/codef/asset-lookup", handleAssetLookup);

// 상세 신고서 v2
app.post("/codef/statement-data-v2", handleStatementDataV2);

// AI 진술서 작성
app.post("/ai/generate", handleAiGenerate);

// AI OCR (Gemini Vision 프록시 — API 키 서버 보관)
app.post("/ai/ocr", handleGeminiOcr);

// 서류 OCR 처리
app.post("/doc/ocr", handleDocOcr);
app.post("/credit-report/parse", handleCreditReportParse);
app.post("/codef/public-auth/create", handlePublicAuthCreate);

// ── 개인회생 서류 자동수집 (정부24/대법원/위택스/홈택스) ──
app.post("/public/resident-registration", handleResidentRegistration);
app.post("/public/resident-abstract", handleResidentAbstract);
app.post("/public/family-relation", handleFamilyRelation);
app.post("/public/property-registry", handlePropertyRegistry);
app.post("/public/tax-payment-cert", handleTaxPaymentCert);
app.post("/public/wage-statement", handleWageStatement);
app.post("/public/vat-cert", handleVatCert);
app.post("/public/financial-statement", handleFinancialStatement);
app.post("/public/local-tax-assessment", handleLocalTaxAssessment);
app.post("/public/local-tax-payment", handleLocalTaxPayment);
app.post("/public/vehicle-registration", handleVehicleRegistration);
app.post("/public/local-tax-cert", handleLocalTaxCert);
app.post("/public/national-tax-cert", handleNationalTaxCert);
app.post("/public/four-insurance", handleFourInsurance);

// ── SSN 암호화/복호화 (주민등록번호 보호) ──
app.post("/crypto/encrypt-ssn", (req, res) => {
  try {
    const { ssn } = req.body as { ssn: string };
    if (!ssn) { res.status(400).json({ error: "ssn 필드 필요" }); return; }
    const encrypted = encryptSSN(ssn);
    const masked = maskSSN(ssn);
    res.json({ encrypted, masked });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "암호화 실패" });
  }
});

app.post("/crypto/decrypt-ssn", (req, res) => {
  try {
    const { encrypted } = req.body as { encrypted: string };
    if (!encrypted) { res.status(400).json({ error: "encrypted 필드 필요" }); return; }
    const ssn = decryptSSN(encrypted);
    res.json({ ssn });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "복호화 실패" });
  }
});

app.post("/crypto/batch-decrypt-ssn", (req, res) => {
  try {
    const { items } = req.body as { items: Array<{ id: string; encrypted: string }> };
    if (!items?.length) { res.status(400).json({ error: "items 필드 필요" }); return; }
    const results = items.map(item => ({
      id: item.id,
      ssn: decryptSSN(item.encrypted),
    }));
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "일괄 복호화 실패" });
  }
});

// ── 기존 데이터 마이그레이션: 평문 SSN → 암호화 ──
app.post("/crypto/migrate-ssn", async (req, res) => {
  try {
    const user = (req as any).user as { uid: string };
    const officeId = user.uid; // 보안: 자신의 사무소만 마이그레이션 가능
    const clientsSnap = await admin.firestore()
      .collection("offices").doc(officeId).collection("clients").get();

    let migrated = 0;
    const batch = admin.firestore().batch();
    for (const doc of clientsSnap.docs) {
      const data = doc.data();
      const ssn = data.ssn;
      if (!ssn) continue;
      // 이미 암호화된 데이터는 건너뛰기 (base64 + 최소 길이)
      try {
        const buf = Buffer.from(ssn, "base64");
        if (buf.length >= 28 && !/^\d{6}/.test(ssn)) continue; // 이미 암호화됨
      } catch { /* not base64, proceed */ }

      const encrypted = encryptSSN(ssn);
      const masked = maskSSN(ssn);
      batch.update(doc.ref, { ssnEncrypted: encrypted, ssnMasked: masked, ssn: "" });
      migrated++;
    }

    // intakeSubmissions도 마이그레이션
    const intakeSnap = await admin.firestore().collection("intakeSubmissions").where("officeId", "==", officeId).get();
    for (const doc of intakeSnap.docs) {
      const data = doc.data();
      const ssn = data.ssn;
      if (!ssn) continue;
      try {
        const buf = Buffer.from(ssn, "base64");
        if (buf.length >= 28 && !/^\d{6}/.test(ssn)) continue;
      } catch { /* not base64, proceed */ }

      const encrypted = encryptSSN(ssn);
      const masked = maskSSN(ssn);
      batch.update(doc.ref, { ssnEncrypted: encrypted, ssnMasked: masked, ssn: "" });
      migrated++;
    }

    await batch.commit();
    res.json({ ok: true, migrated });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "마이그레이션 실패" });
  }
});

export const api = onRequest({ region: "asia-northeast3", invoker: "public", timeoutSeconds: 120 }, app);
