"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncomeProof = handleIncomeProof;
exports.handleWithholdingTax = handleWithholdingTax;
exports.handleBusinessRegistration = handleBusinessRegistration;
exports.handleHealthInsurance = handleHealthInsurance;
exports.handleHealthInsurancePremium = handleHealthInsurancePremium;
exports.handleNationalPension = handleNationalPension;
exports.handlePublicDataCollect = handlePublicDataCollect;
exports.handleResidentRegistration = handleResidentRegistration;
exports.handleResidentAbstract = handleResidentAbstract;
exports.handleFamilyRelation = handleFamilyRelation;
exports.handlePropertyRegistry = handlePropertyRegistry;
exports.handleTaxPaymentCert = handleTaxPaymentCert;
exports.handleWageStatement = handleWageStatement;
exports.handleVatCert = handleVatCert;
exports.handleFinancialStatement = handleFinancialStatement;
exports.handleLocalTaxAssessment = handleLocalTaxAssessment;
exports.handleLocalTaxPayment = handleLocalTaxPayment;
exports.handleVehicleRegistration = handleVehicleRegistration;
exports.handleLocalTaxCert = handleLocalTaxCert;
exports.handleNationalTaxCert = handleNationalTaxCert;
exports.handleFourInsurance = handleFourInsurance;
exports.handleCaseSearch = handleCaseSearch;
exports.handleTaxInvoice = handleTaxInvoice;
const codefProxy_1 = require("./codefProxy");
// ---------------------------------------------------------------------------
// 응답 파싱 헬퍼
// ---------------------------------------------------------------------------
function parseIncomeProof(data) {
    const d = data;
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
function parseWithholdingTax(data) {
    const d = data;
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
function parseBusinessRegistration(data) {
    const d = data;
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
function parseHealthInsurance(data) {
    const d = data;
    const list = d?.resIdentityList ?? d?.resList ?? [];
    const latest = Array.isArray(list) && list.length > 0 ? list[0] : d ?? {};
    // 피부양자 목록 추출
    const depRaw = d?.resDependentList ?? latest?.resDependentList ?? [];
    const dependents = [];
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
function parseHealthInsurancePremium(data) {
    const d = data;
    const list = d?.resPaymentList ?? d?.resList ?? [];
    const payments = [];
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
function parseNationalPension(data) {
    const d = data;
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
async function handleIncomeProof(req, res) {
    try {
        const { connectedId, identity, issuePurpose } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/income-amount", {
            connectedId,
            identity: identity ?? "",
            issuePurpose: issuePurpose ?? "02", // 02: 금융기관 제출용
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "소득금액증명원 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseIncomeProof(data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "소득금액증명원 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 2. 근로소득 원천징수영수증
// POST /codef/public/withholding-tax
// ---------------------------------------------------------------------------
async function handleWithholdingTax(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/paystatement-income", {
            connectedId,
            identity: identity ?? "",
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "원천징수영수증 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseWithholdingTax(data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "원천징수영수증 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 3. 사업자등록증명원
// POST /codef/public/business-registration
// ---------------------------------------------------------------------------
async function handleBusinessRegistration(req, res) {
    try {
        const { connectedId, identity, businessNumber } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/business-registration", {
            connectedId,
            identity: identity ?? "",
            businessNo: businessNumber ?? "",
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "사업자등록증명원 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseBusinessRegistration(data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "사업자등록증명원 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 4. 건강보험 자격득실확인서 + 피부양자 정보
// POST /codef/public/health-insurance
// ---------------------------------------------------------------------------
async function handleHealthInsurance(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/nhis-insurance-identity-confirmation", {
            connectedId,
            identity: identity ?? "",
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "건강보험 자격득실확인서 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseHealthInsurance(data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "건강보험 자격득실확인서 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 5. 건강보험료 납부확인서
// POST /codef/public/health-insurance-premium
// ---------------------------------------------------------------------------
async function handleHealthInsurancePremium(req, res) {
    try {
        const { connectedId, identity, startDate, endDate } = req.body;
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
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/nhis-insurance-payment", {
            connectedId,
            identity: identity ?? "",
            startDate: startDate ?? defaultStart,
            endDate: endDate ?? defaultEnd,
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "건강보험료 납부확인서 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseHealthInsurancePremium(data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "건강보험료 납부확인서 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 6. 국민연금 가입증명서
// POST /codef/public/national-pension
// ---------------------------------------------------------------------------
async function handleNationalPension(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/nps-join-issue", {
            connectedId,
            identity: identity ?? "",
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "국민연금 가입증명서 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseNationalPension(data) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "국민연금 가입증명서 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 7. 통합 조회 — 6개 공공기관 데이터를 한번에 수집
// POST /codef/public/collect-all
// ---------------------------------------------------------------------------
async function handlePublicDataCollect(req, res) {
    try {
        const { connectedId, identity, businessNumber, startDate, endDate } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const id = identity ?? "";
        // 기본 날짜 범위: 최근 12개월
        const now = new Date();
        const ago12m = new Date(now);
        ago12m.setFullYear(now.getFullYear() - 1);
        const defaultStart = ago12m.toISOString().slice(0, 10).replace(/-/g, "");
        const defaultEnd = now.toISOString().slice(0, 10).replace(/-/g, "");
        const [incomeProofResult, withholdingTaxResult, businessRegResult, healthInsResult, healthPremiumResult, pensionResult,] = await Promise.allSettled([
            (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/income-amount", {
                connectedId,
                identity: id,
                issuePurpose: "02",
            }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/paystatement-income", {
                connectedId,
                identity: id,
            }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/business-registration", {
                connectedId,
                identity: id,
                businessNo: businessNumber ?? "",
            }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/nhis-insurance-identity-confirmation", {
                connectedId,
                identity: id,
            }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/nhis-insurance-payment", {
                connectedId,
                identity: id,
                startDate: startDate ?? defaultStart,
                endDate: endDate ?? defaultEnd,
            }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/nps-join-issue", {
                connectedId,
                identity: id,
            }),
        ]);
        const errors = {};
        const extract = (settled, key, parser) => {
            if (settled.status === "rejected") {
                errors[key] = settled.reason instanceof Error ? settled.reason.message : "조회 실패";
                return null;
            }
            const codefResult = settled.value;
            if (codefResult?.result?.code !== "CF-00000") {
                errors[key] = codefResult?.result?.message ?? "조회 실패";
                return null;
            }
            return parser(codefResult?.data);
        };
        const result = {
            incomeProof: extract(incomeProofResult, "incomeProof", parseIncomeProof),
            withholdingTax: extract(withholdingTaxResult, "withholdingTax", parseWithholdingTax),
            businessRegistration: extract(businessRegResult, "businessRegistration", parseBusinessRegistration),
            healthInsurance: extract(healthInsResult, "healthInsurance", parseHealthInsurance),
            healthInsurancePremium: extract(healthPremiumResult, "healthInsurancePremium", parseHealthInsurancePremium),
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
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "공공기관 데이터 통합 조회 실패" });
    }
}
// ---------------------------------------------------------------------------
// 정부24 / 대법원 / 위택스 / 홈택스 추가 API (개인회생 서류 자동 수집)
// ---------------------------------------------------------------------------
/** 정부24 — 주민등록등본 교부 */
async function handleResidentRegistration(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/gov24-resident-register", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "주민등록등본 조회 실패" });
    }
}
/** 정부24 — 주민등록초본 교부 */
async function handleResidentAbstract(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/gov24-resident-abstract", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "주민등록초본 조회 실패" });
    }
}
/** 대법원 — 가족관계등록부 발급 */
async function handleFamilyRelation(req, res) {
    try {
        const { connectedId, identity, certType } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ef/family-relation-certificate", {
            connectedId, identity: identity ?? "",
            certType: certType ?? "1", // 1: 가족관계증명서, 2: 혼인관계증명서
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "가족관계등록부 발급 실패" });
    }
}
/** 대법원 — 부동산등기부등본 열람/발급 */
async function handlePropertyRegistry(req, res) {
    try {
        const { connectedId, address, propertyType } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ef/real-estate-register", {
            connectedId, address, propertyType: propertyType ?? "0",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "부동산등기부등본 조회 실패" });
    }
}
/** 홈택스 — 납세증명서 */
async function handleTaxPaymentCert(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/tax-payment", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "납세증명서 조회 실패" });
    }
}
/** 홈택스 — 근로소득 지급명세서 */
async function handleWageStatement(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/wage-statement", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "근로소득 지급명세서 조회 실패" });
    }
}
/** 홈택스 — 부가세과세표준증명 */
async function handleVatCert(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/vat-certificate", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "부가세과세표준증명 조회 실패" });
    }
}
/** 홈택스 — 재무제표 */
async function handleFinancialStatement(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ck/proof-issue/financial-statement", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "재무제표 조회 실패" });
    }
}
/** 위택스 — 지방세 부과내역 */
async function handleLocalTaxAssessment(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/wetax-local-tax-assessment", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "지방세 부과내역 조회 실패" });
    }
}
/** 위택스 — 지방세 납부결과 */
async function handleLocalTaxPayment(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/wetax-local-tax-payment", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "지방세 납부결과 조회 실패" });
    }
}
/** 정부24 — 자동차등록원부(갑) */
async function handleVehicleRegistration(req, res) {
    try {
        const { connectedId, identity, carNumber } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/gov24-vehicle-registration", {
            connectedId, identity: identity ?? "", carNumber: carNumber ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "자동차등록원부 조회 실패" });
    }
}
/** 정부24 — 지방세 납세증명 */
async function handleLocalTaxCert(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/gov24-local-tax-cert", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "지방세 납세증명 조회 실패" });
    }
}
/** 정부24 — 개인 납세증명서 (국세) */
async function handleNationalTaxCert(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/gov24-national-tax-cert", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "납세증명서 조회 실패" });
    }
}
/** 4대보험 — 사업장 가입자명부 */
async function handleFourInsurance(req, res) {
    try {
        const { connectedId, identity } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId 필요" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/pp/four-insurance-members", {
            connectedId, identity: identity ?? "",
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "4대보험 조회 실패" });
    }
}
/** 사건번호 문자열에서 사건유형 분류 */
function classifyCaseType(caseNumber) {
    if (!caseNumber)
        return "기타";
    // 개회/하회 = 회생, 하단/하합/하파 = 파산, 가단/가합/가소 = 민사, 드단/드합/느단 = 가사, 고단/고합/노/도 = 형사
    if (/개회|하회|회/.test(caseNumber))
        return "회생";
    if (/하단|하합|하파|파/.test(caseNumber))
        return "파산";
    if (/드단|드합|느단|느합|가소|가단(?=가사)/.test(caseNumber))
        return "가사";
    if (/가단|가합|차|나|다/.test(caseNumber))
        return "민사";
    if (/고단|고합|노|도|감/.test(caseNumber))
        return "형사";
    return "기타";
}
function parseCaseSearch(data) {
    const d = data;
    const list = d?.resCaseList ?? d?.resList ?? d?.resCases ?? [];
    const cases = [];
    if (Array.isArray(list)) {
        for (const item of list) {
            const caseNumber = item.resCaseNumber ?? item.resCaseNo ?? item.caseNumber ?? "";
            cases.push({
                caseNumber,
                court: item.resCourtName ?? item.resCourt ?? item.courtName ?? "",
                caseType: classifyCaseType(caseNumber),
                status: item.resStatus ?? item.resProgressStatus ?? item.resCaseStatus ?? "",
                filingDate: item.resFilingDate ?? item.resReceiptDate ?? item.resRegisterDate ?? "",
                lastAction: item.resLastAction ?? item.resLastActionDate ?? undefined,
            });
        }
    }
    return cases;
}
/**
 * 대법원 나의사건검색
 * TODO(CODEF 승인 후): 정확한 엔드포인트 경로 확정 필요.
 *   현재는 "/v1/kr/public/ef/case-search" 로 추정 (기존 ef/ 계열 패턴 따름).
 *   승인 후 실제 CODEF 응답 샘플로 경로와 응답 필드명 재확인.
 */
async function handleCaseSearch(req, res) {
    try {
        const { connectedId, identity, userName, authType } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await (0, codefProxy_1.getToken)();
        // TODO: 승인 후 정확한 엔드포인트 경로로 교체 (대안: "/v1/kr/public/ph/court/case-list")
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/kr/public/ef/case-search", {
            connectedId,
            identity: identity ?? "",
            userName: userName ?? "",
            authType: authType ?? "0",
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "나의사건검색 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        const cases = parseCaseSearch(data);
        res.json({ success: true, data: { cases, raw: data } });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "나의사건검색 조회 실패" });
    }
}
function parseTaxInvoice(data, type) {
    const d = data;
    const list = d?.resInvoiceList ?? d?.resTaxInvoiceList ?? d?.resList ?? [];
    const invoices = [];
    const monthlyTotal = {};
    let totalSupply = 0;
    let totalVat = 0;
    let totalAmount = 0;
    if (Array.isArray(list)) {
        for (const item of list) {
            const supply = Number(item.resSupplyAmount ?? item.resSupplyPrice ?? 0);
            const vat = Number(item.resVatAmount ?? item.resTaxAmount ?? 0);
            const total = Number(item.resTotalAmount ?? supply + vat);
            const date = item.resIssueDate ?? item.resInvoiceDate ?? item.resDate ?? "";
            invoices.push({
                date,
                invoiceNo: item.resInvoiceNo ?? item.resInvoiceNumber ?? "",
                supplyAmount: supply,
                vatAmount: vat,
                totalAmount: total,
                counterparty: item.resCounterpartyName ?? item.resTradingPartnerName ?? item.resBusinessName ?? "",
                counterpartyBizNum: item.resCounterpartyBizNo ?? item.resTradingPartnerBizNo ?? item.resBusinessNo ?? "",
                approvalNo: item.resApprovalNo ?? item.resApprovalNumber ?? "",
                type,
            });
            // 월별 집계 (YYYYMM)
            if (date && date.length >= 6) {
                const ym = date.slice(0, 6);
                if (!monthlyTotal[ym]) {
                    monthlyTotal[ym] = { supplyAmount: 0, vatAmount: 0, totalAmount: 0, count: 0 };
                }
                monthlyTotal[ym].supplyAmount += supply;
                monthlyTotal[ym].vatAmount += vat;
                monthlyTotal[ym].totalAmount += total;
                monthlyTotal[ym].count += 1;
            }
            totalSupply += supply;
            totalVat += vat;
            totalAmount += total;
        }
    }
    return {
        type,
        invoices,
        monthlyTotal,
        totalSupply,
        totalVat,
        totalAmount,
        count: invoices.length,
        raw: data,
    };
}
/**
 * 국세청(홈택스) — 전자세금계산서 목록
 * type: 'sales' = 매출, 'purchase' = 매입
 * 자영업자 가드: businessNumber 필수
 */
async function handleTaxInvoice(req, res) {
    try {
        const { connectedId, identity, userName, businessNumber, startDate, endDate, type } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        if (!businessNumber) {
            res.status(400).json({ error: "사업자등록번호 필요" });
            return;
        }
        const invoiceType = type === 'purchase' ? 'purchase' : 'sales';
        // 기본값: 최근 12개월
        const now = new Date();
        const ago12m = new Date(now);
        ago12m.setFullYear(now.getFullYear() - 1);
        const defaultStart = ago12m.toISOString().slice(0, 10).replace(/-/g, "");
        const defaultEnd = now.toISOString().slice(0, 10).replace(/-/g, "");
        const endpoint = invoiceType === 'sales'
            ? "/v1/kr/public/nt/tax-invoice/sales-list"
            : "/v1/kr/public/nt/tax-invoice/purchase-list";
        const token = await (0, codefProxy_1.getToken)();
        const result = await (0, codefProxy_1.callCodef)(token, endpoint, {
            connectedId,
            identity: identity ?? "",
            userName: userName ?? "",
            businessNo: businessNumber,
            startDate: startDate ?? defaultStart,
            endDate: endDate ?? defaultEnd,
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "전자세금계산서 조회 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const data = codefResult?.data;
        res.json({ success: true, data: parseTaxInvoice(data, invoiceType) });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "전자세금계산서 조회 실패" });
    }
}
//# sourceMappingURL=codefPublic.js.map