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
exports.handleDocGenerate = handleDocGenerate;
const admin = __importStar(require("firebase-admin"));
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const jszip_1 = __importDefault(require("jszip"));
const docTemplateBuilder_1 = require("./docTemplateBuilder");
const ssnCrypto_1 = require("./ssnCrypto");
const MEDIAN_INCOME_2026 = {
    1: 2392013, 2: 3932658, 3: 5025353,
    4: 6097773, 5: 7180914, 6: 8263055,
};
function formatKRW(n) {
    return new Intl.NumberFormat("ko-KR").format(n) + "원";
}
function maskSSN(ssn) {
    const cleaned = ssn.replace(/\D/g, "");
    return cleaned.length >= 6 ? `${cleaned.slice(0, 6)}-*******` : ssn;
}
function calcMonthlyPayment(client) {
    const base = MEDIAN_INCOME_2026[Math.min(client.family || 1, 6)] ?? 9000000;
    const livCost = base * 0.6;
    const extra = (client.rent || 0) + (client.education || 0) + (client.medical || 0);
    return Math.max(0, Math.floor((client.income || 0) + (client.income2 || 0) - livCost - extra));
}
function today() {
    return new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
// 라이프니츠 계수 (법정이율 연 5%)
const LEGAL_RATE = 0.05;
function leibnizFactor(years) {
    return years <= 0 ? 1 : 1 / Math.pow(1 + LEGAL_RATE, years);
}
function calcRetirementPV(wage, worked, untilRetire) {
    const total = wage * (worked + untilRetire);
    const factor = leibnizFactor(untilRetire);
    return { estimated: total, pv: Math.floor(total * factor), factor };
}
function calcDepositPV(amount, years) {
    const factor = leibnizFactor(years);
    return { pv: Math.floor(amount * factor), factor };
}
function calcNetLiquidation(client) {
    const assets = client.assets ?? [];
    const assetTotal = assets.reduce((s, a) => s + (a.value ?? 0), 0);
    const lb = client.leibniz ?? {};
    let leibnizTotal = 0;
    if (lb.retirementWage && lb.yearsWorked) {
        leibnizTotal += calcRetirementPV(lb.retirementWage, lb.yearsWorked, lb.yearsUntilRetirement ?? 0).pv;
    }
    if (lb.depositAmount && lb.depositYears) {
        leibnizTotal += calcDepositPV(lb.depositAmount, lb.depositYears).pv;
    }
    const pc = client.priorityClaims ?? {};
    const priority = (pc.taxDelinquent ?? 0) + (pc.wageClaim ?? 0) + (pc.smallDeposit ?? 0);
    return Math.max(0, assetTotal + leibnizTotal - priority);
}
// ---------------------------------------------------------------------------
// Per-document data builders
// ---------------------------------------------------------------------------
function buildApplicationData(client) {
    const totalDebt = (client.debts ?? []).reduce((s, d) => s + (d.amount ?? 0), 0);
    const creditorCount = (client.debts ?? []).length;
    const autoMonthly = calcMonthlyPayment(client);
    const monthly = client.monthlyPaymentOverride ?? autoMonthly;
    const repayPeriodMonths = client.repayPeriodMonths || 36;
    // 전자소송 양식 신규 필드
    const incomeTypeLabel = {
        salary: '급여소득으로 변제',
        business: '영업소득으로 변제',
        mixed: '급여소득 + 영업소득으로 변제',
    };
    // 주소 3종 (주민등록지 / 실거주지 / 송달장소)
    const residentAddr = [client.residentAddress, client.residentAddressDetail]
        .filter(Boolean).join(' ') || client.address || '';
    const actualAddr = client.sameAsResident
        ? residentAddr
        : [client.actualAddress, client.actualAddressDetail].filter(Boolean).join(' ');
    const deliveryAddr = client.sameDeliveryAsResident
        ? residentAddr
        : [client.deliveryAddress, client.deliveryAddressDetail].filter(Boolean).join(' ');
    // 관련사건 목록
    const relatedCases = (client.relatedCases ?? []).map((r, i) => ({
        no: i + 1,
        relation: r.relation ?? '',
        relationName: r.relationName ?? '',
        court: r.court ?? '',
        caseFullNumber: `${r.caseYear ?? ''}${r.caseType ?? ''}${r.caseNumber ?? ''}`,
    }));
    return {
        // 기존 필드
        court: client.court ?? "",
        clientName: client.name ?? "",
        clientSSN: maskSSN(client.ssn ?? ""),
        clientAddr: client.address ?? "",
        clientPhone: client.phone ?? "",
        clientJob: client.job ?? "",
        debtReason: client.debtReason ?? "생활비 부족 및 기존 채무 이자 부담 누적",
        totalDebt: formatKRW(totalDebt),
        creditorCount,
        repayPeriodMonths,
        monthlyPayment: formatKRW(monthly),
        today: today(),
        // ── 전자소송 양식 필드 ──
        // 사건기본정보
        incomeType: incomeTypeLabel[client.incomeType] ?? '',
        repayStartDate: client.repayStartDate ?? '',
        repayStartAfterAuthorization: client.repayStartAfterAuthorization ?? false,
        repayDayOfMonth: client.repayDayOfMonth ?? '',
        refundBank: client.refundBank ?? '',
        refundAccount: client.refundAccount ?? '',
        refundAccountHolder: client.refundAccountHolder ?? client.name ?? '',
        // 당사자정보
        partyType: '채무자',
        personalityType: '자연인',
        nationality: client.nationality ?? '한국',
        nameForeign: client.nameForeign ?? '',
        residentAddr,
        actualAddr,
        deliveryAddr,
        clientTel: client.tel ?? '',
        clientFax: client.fax ?? '',
        clientEmail: client.email ?? '',
        // 관련사건목록
        relatedCases,
        relatedCaseCount: relatedCases.length,
        // 신청취지 / 신청이유
        applicationPurpose: client.applicationPurpose
            ?? '「신청인에 대하여 개인회생절차를 개시한다」라는 결정을 구합니다.',
        applicationReason: client.applicationReason ?? client.debtReason ?? '',
    };
}
// 별제권 계산 헬퍼
function calcSeparateSecurityAmount(debtAmount, collateralValue, seniorLien = 0) {
    const netCollateral = Math.max(0, collateralValue - seniorLien);
    return Math.min(debtAmount, netCollateral);
}
function calcDeficiencyAmount(debtAmount, separateSecurityAmount) {
    return Math.max(0, debtAmount - separateSecurityAmount);
}
function buildDebtListData(client) {
    const allDebts = client.debts ?? [];
    const debts = allDebts.map((d, i) => {
        // 별제권 계산
        let separateSecurity = 0;
        let deficiency = d.amount ?? 0;
        if (d.type === "담보" && d.collateralValue) {
            separateSecurity = d.separateSecurityAmount
                ?? calcSeparateSecurityAmount(d.amount ?? 0, d.collateralValue, d.seniorLien ?? 0);
            deficiency = d.deficiencyAmount
                ?? calcDeficiencyAmount(d.amount ?? 0, separateSecurity);
        }
        // 보증채무 비고
        let note = "";
        if (d.isGuarantee && d.guaranteeType) {
            note = `${d.guaranteeType} 보증인, 주채무자: ${d.primaryDebtor ?? "미상"}`;
        }
        // 채권양도 비고
        if (d.transferredFrom) {
            const transferNote = `원채권자: ${d.transferredFrom}${d.transferDate ? `, 양도일: ${d.transferDate}` : ""}`;
            note = note ? `${note} / ${transferNote}` : transferNote;
        }
        // 담보 비고
        if (d.type === "담보") {
            const secNote = d.securedNote ?? d.collateralDesc ?? d.collateral ?? "담보설정";
            note = note ? `${note} / ${secNote}` : secNote;
        }
        return {
            no: i + 1,
            creditor: d.creditor ?? d.name ?? "",
            type: d.type ?? "무담보",
            originalDate: d.originalDate ?? d.originDate ?? "",
            originalAmount: formatKRW(d.originalAmount ?? d.amount ?? 0),
            amount: formatKRW(d.amount ?? 0),
            rate: (d.rate ?? 0).toFixed(1) + "%",
            overdueInterest: formatKRW(d.overdueInterest ?? 0),
            accelerationDate: d.accelerationDate ?? "",
            totalOwed: formatKRW((d.amount ?? 0) + (d.overdueInterest ?? 0)),
            securedNote: note,
            // 보증채무
            isGuarantee: d.isGuarantee ?? false,
            guaranteeType: d.guaranteeType ?? "",
            primaryDebtor: d.primaryDebtor ?? "",
            // 채권양도
            transferredFrom: d.transferredFrom ?? "",
            transferDate: d.transferDate ?? "",
            // 별제권 관련
            separateSecurityAmount: d.type === "담보" ? formatKRW(separateSecurity) : "",
            deficiencyAmount: d.type === "담보" ? formatKRW(deficiency) : "",
            collateralType: d.collateralType ?? "",
            collateralDesc: d.collateralDesc ?? "",
        };
    });
    const totalDebt = allDebts.reduce((s, d) => s + (d.amount ?? 0), 0);
    const unsecuredDebt = allDebts
        .filter((d) => d.type !== "담보")
        .reduce((s, d) => s + (d.amount ?? 0), 0);
    const securedDebt = allDebts
        .filter((d) => d.type === "담보")
        .reduce((s, d) => s + (d.amount ?? 0), 0);
    // 별제권 합계
    const totalSeparateSecurity = allDebts
        .filter((d) => d.type === "담보")
        .reduce((s, d) => {
        if (!d.collateralValue)
            return s;
        const sep = d.separateSecurityAmount
            ?? calcSeparateSecurityAmount(d.amount ?? 0, d.collateralValue, d.seniorLien ?? 0);
        return s + sep;
    }, 0);
    const totalDeficiency = allDebts
        .filter((d) => d.type === "담보")
        .reduce((s, d) => {
        if (!d.collateralValue)
            return s + (d.amount ?? 0);
        const sep = d.separateSecurityAmount
            ?? calcSeparateSecurityAmount(d.amount ?? 0, d.collateralValue, d.seniorLien ?? 0);
        return s + calcDeficiencyAmount(d.amount ?? 0, sep);
    }, 0);
    return {
        clientName: client.name ?? "",
        clientAddr: client.address ?? "",
        court: client.court ?? "",
        today: today(),
        debts,
        totalDebt: formatKRW(totalDebt),
        unsecuredDebt: formatKRW(unsecuredDebt),
        securedDebt: formatKRW(securedDebt),
        totalSeparateSecurity: formatKRW(totalSeparateSecurity),
        totalDeficiency: formatKRW(totalDeficiency),
    };
}
function buildAssetListData(client) {
    const assets = client.assets ?? [];
    const realEstate = assets
        .filter((a) => a.type === "부동산")
        .map((a, i) => ({
        no: i + 1,
        address: a.meta?.address ?? a.name ?? "",
        area: a.meta?.area ?? 0,
        publicPrice: formatKRW(a.rawValue ?? 0),
        rate: ((a.liquidationRate ?? 0.75) * 100).toFixed(0) + "%",
        mortgage: formatKRW(a.mortgage ?? 0),
        liquidationValue: formatKRW(a.value ?? 0),
        basis: `${a.meta?.valuationBasis ?? "국토부 공시가격"} 환가율 ${((a.liquidationRate ?? 0.75) * 100).toFixed(0)}%`,
    }));
    const vehicles = assets
        .filter((a) => a.type === "차량")
        .map((a, i) => ({
        no: i + 1,
        model: a.meta?.model ?? a.name ?? "",
        year: a.meta?.year ?? 0,
        mileage: a.meta?.mileage ?? 0,
        basePrice: formatKRW(a.rawValue ?? 0),
        rate: ((a.liquidationRate ?? 0.70) * 100).toFixed(0) + "%",
        liquidationValue: formatKRW(a.value ?? 0),
        basis: `${a.meta?.valuationBasis ?? "보험개발원 기준가액"} 환가율 ${((a.liquidationRate ?? 0.70) * 100).toFixed(0)}%`,
    }));
    const deposits = assets
        .filter((a) => a.type === "예금")
        .map((a, i) => ({
        no: i + 1,
        bankName: a.meta?.bankName ?? a.name ?? "",
        accountLast4: a.meta?.accountLast4 ?? "",
        balance: formatKRW(a.rawValue ?? 0),
    }));
    const insurance = assets
        .filter((a) => a.type === "보험")
        .map((a, i) => ({
        no: i + 1,
        insurerName: a.meta?.insurerName ?? a.name ?? "",
        insuranceType: a.meta?.insuranceType ?? "",
        surrenderValue: formatKRW(a.meta?.surrenderValue ?? a.rawValue ?? 0),
    }));
    const securities = assets
        .filter((a) => a.type === "증권")
        .map((a, i) => ({
        no: i + 1,
        brokerName: a.meta?.brokerName ?? a.name ?? "",
        stockName: a.meta?.stockName ?? "",
        evalAmount: formatKRW(a.rawValue ?? 0),
    }));
    const otherAssets = assets
        .filter((a) => a.type === "기타")
        .map((a, i) => ({
        no: i + 1,
        name: a.name ?? "",
        rawValue: formatKRW(a.rawValue ?? 0),
        liquidationValue: formatKRW(a.value ?? 0),
    }));
    const assetLiquidation = assets.reduce((s, a) => s + (a.value ?? 0), 0);
    // 라이프니츠 현재가치 항목
    const lb = client.leibniz ?? {};
    const leibnizItems = [];
    let leibnizTotal = 0;
    if (lb.retirementWage && lb.yearsWorked) {
        const ret = calcRetirementPV(lb.retirementWage, lb.yearsWorked, lb.yearsUntilRetirement ?? 0);
        leibnizItems.push({
            no: 1,
            name: "퇴직금",
            rawValue: formatKRW(ret.estimated),
            factor: ret.factor.toFixed(4),
            years: lb.yearsUntilRetirement ?? 0,
            presentValue: formatKRW(ret.pv),
            basis: `라이프니츠 현재가치 할인(연 5%), 계수 ${ret.factor.toFixed(4)}`,
        });
        leibnizTotal += ret.pv;
    }
    if (lb.depositAmount && lb.depositYears) {
        const dep = calcDepositPV(lb.depositAmount, lb.depositYears);
        leibnizItems.push({
            no: leibnizItems.length + 1,
            name: "임대차보증금",
            rawValue: formatKRW(lb.depositAmount),
            factor: dep.factor.toFixed(4),
            years: lb.depositYears,
            presentValue: formatKRW(dep.pv),
            basis: `라이프니츠 현재가치 할인(연 5%), 계수 ${dep.factor.toFixed(4)}`,
        });
        leibnizTotal += dep.pv;
    }
    // 우선채권 공제
    const pc = client.priorityClaims ?? {};
    const priorityClaims = (pc.taxDelinquent ?? 0) + (pc.wageClaim ?? 0) + (pc.smallDeposit ?? 0);
    const totalLiquidationValue = Math.max(0, assetLiquidation + leibnizTotal - priorityClaims);
    return {
        clientName: client.name ?? "",
        court: client.court ?? "",
        today: today(),
        realEstate,
        vehicles,
        deposits,
        insurance,
        securities,
        otherAssets,
        leibnizItems,
        leibnizTotal: formatKRW(leibnizTotal),
        hasLeibniz: leibnizItems.length > 0,
        taxDelinquent: formatKRW(pc.taxDelinquent ?? 0),
        wageClaim: formatKRW(pc.wageClaim ?? 0),
        smallDeposit: formatKRW(pc.smallDeposit ?? 0),
        priorityClaims: formatKRW(priorityClaims),
        assetLiquidation: formatKRW(assetLiquidation),
        totalLiquidationValue: formatKRW(totalLiquidationValue),
    };
}
function buildIncomeListData(client) {
    const family = client.family || 1;
    const familyCapped = Math.min(family, 6);
    const medianIncome = MEDIAN_INCOME_2026[familyCapped] ?? 9000000;
    const livingCostBasis = Math.floor(medianIncome * 0.6);
    const jobType = client.jobType ?? "employed";
    const salary = jobType === "self" || jobType === "freelance" ? 0 : (client.income ?? 0);
    const businessIncome = (jobType === "self" || jobType === "freelance") ? (client.income2 ?? client.income ?? 0) : 0;
    const otherIncome = client.otherIncome ?? 0;
    const totalIncome = (client.income ?? 0) + (client.income2 ?? 0) + otherIncome;
    const rent = client.rent ?? 0;
    const food = client.food ?? 0;
    const transport = client.transport ?? 0;
    const telecom = client.telecom ?? 0;
    const education = client.education ?? 0;
    const medical = client.medical ?? 0;
    const insurancePremium = client.insurancePremium ?? 0;
    const totalExpense = rent + food + transport + telecom + education + medical + insurancePremium;
    const monthly = calcMonthlyPayment(client);
    const familyMembers = [];
    const members = client.familyMembers ?? [];
    for (let i = 0; i < members.length; i++) {
        const m = members[i];
        familyMembers.push({
            no: i + 1,
            relation: m.relation ?? "",
            name: m.name ?? "",
            age: m.age ?? 0,
            job: m.job ?? "",
            income: formatKRW(m.income ?? 0),
        });
    }
    return {
        clientName: client.name ?? "",
        court: client.court ?? "",
        today: today(),
        salary: formatKRW(salary),
        businessIncome: formatKRW(businessIncome),
        otherIncome: formatKRW(otherIncome),
        totalIncome: formatKRW(totalIncome),
        rent: formatKRW(rent),
        food: formatKRW(food),
        transport: formatKRW(transport),
        telecom: formatKRW(telecom),
        education: formatKRW(education),
        medical: formatKRW(medical),
        insurancePremium: formatKRW(insurancePremium),
        totalExpense: formatKRW(totalExpense),
        medianIncome: formatKRW(medianIncome),
        livingCostBasis: formatKRW(livingCostBasis),
        family,
        familyMembers,
        availableIncome: formatKRW(Math.max(0, totalIncome - totalExpense)),
        monthlyPayment: formatKRW(monthly),
    };
}
function buildRepayPlanData(client) {
    const repayPeriodMonths = client.repayPeriodMonths || 36;
    const disposableMonthly = calcMonthlyPayment(client);
    const disposableTotal = disposableMonthly * repayPeriodMonths;
    // 청산가치 보장원칙: MAX(가용소득 총액, 청산가치)
    const netLiquidation = calcNetLiquidation(client);
    const effectiveTotal = Math.max(disposableTotal, netLiquidation);
    const monthly = Math.ceil(effectiveTotal / repayPeriodMonths);
    const isLiquidationAdjusted = effectiveTotal > disposableTotal;
    // 변제대상 채무: 무담보 전액 + 담보 부족액 (별제권 금액 제외)
    const allDebts = client.debts ?? [];
    const totalDebt = allDebts.reduce((s, d) => s + (d.amount ?? 0), 0);
    // 변제 대상 금액 산출 (별제권 제외)
    const repayTargetEntries = [];
    for (const d of allDebts) {
        if (d.type === "담보" && d.collateralValue) {
            const sep = d.separateSecurityAmount
                ?? calcSeparateSecurityAmount(d.amount ?? 0, d.collateralValue, d.seniorLien ?? 0);
            const def = d.deficiencyAmount ?? calcDeficiencyAmount(d.amount ?? 0, sep);
            if (def > 0) {
                repayTargetEntries.push({ creditor: d.creditor ?? d.name ?? "", amount: def, isDeficiency: true });
            }
        }
        else {
            repayTargetEntries.push({ creditor: d.creditor ?? d.name ?? "", amount: d.amount ?? 0, isDeficiency: false });
        }
    }
    const totalRepayTarget = repayTargetEntries.reduce((s, e) => s + e.amount, 0);
    const repayRate = totalRepayTarget > 0 ? Math.round((effectiveTotal / totalRepayTarget) * 10000) / 100 : 0;
    const creditorShares = repayTargetEntries.map((e, i) => {
        const share = totalRepayTarget > 0 ? e.amount / totalRepayTarget : 0;
        const monthlyShare = Math.floor(monthly * share);
        const totalShare = monthlyShare * repayPeriodMonths;
        return {
            no: i + 1,
            creditor: e.creditor + (e.isDeficiency ? " (부족액)" : ""),
            debtAmount: formatKRW(e.amount),
            sharePercent: (share * 100).toFixed(2) + "%",
            monthlyShare: formatKRW(monthlyShare),
            totalShare: formatKRW(totalShare),
        };
    });
    // 기존 단순 변제예정액표 (회차/변제일/변제금액/누적)
    const repaySchedule = [];
    const startDate = new Date();
    startDate.setDate(1);
    startDate.setMonth(startDate.getMonth() + 1);
    let cumulative = 0;
    for (let round = 1; round <= repayPeriodMonths; round++) {
        const payDate = new Date(startDate);
        payDate.setMonth(payDate.getMonth() + (round - 1));
        cumulative += monthly;
        repaySchedule.push({
            round,
            payDate: payDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }),
            payAmount: formatKRW(monthly),
            cumulativeAmount: formatKRW(cumulative),
        });
    }
    // 변제예정액표 (월별, 채권자별 안분) — 법원 필수 서류
    const pc = client.priorityClaims ?? {};
    const priorityDebtTotal = (pc.taxDelinquent ?? 0) + (pc.wageClaim ?? 0) + (pc.smallDeposit ?? 0);
    // 안분 비율 계산
    const totalRepayTargetNum = repayTargetEntries.reduce((s, e) => s + e.amount, 0);
    const shares = {};
    for (const e of repayTargetEntries) {
        const key = e.creditor + (e.isDeficiency ? " (부족액)" : "");
        shares[key] = totalRepayTargetNum > 0 ? e.amount / totalRepayTargetNum : 0;
    }
    const creditorNameList = repayTargetEntries.map((e) => e.creditor + (e.isDeficiency ? " (부족액)" : ""));
    let remainingPriority = priorityDebtTotal;
    const detailedSchedule = [];
    const creditorTotals = {};
    for (const cn of creditorNameList)
        creditorTotals[cn] = 0;
    let priorityGrandTotal = 0;
    let grandTotal = 0;
    const sYear = startDate.getFullYear();
    const sMonth = startDate.getMonth() + 1;
    for (let round = 1; round <= repayPeriodMonths; round++) {
        const mIdx = sMonth + round - 1;
        const year = sYear + Math.floor((mIdx - 1) / 12);
        const month = ((mIdx - 1) % 12) + 1;
        const payDateStr = `${year}.${String(month).padStart(2, "0")}`;
        let priorityAmount = 0;
        let generalBudget = monthly;
        if (remainingPriority > 0) {
            priorityAmount = Math.min(remainingPriority, monthly);
            remainingPriority -= priorityAmount;
            generalBudget = monthly - priorityAmount;
        }
        const creditorAmounts = {};
        let roundTotal = priorityAmount;
        // 안분 배당
        let creditorSum = 0;
        for (let ci = 0; ci < creditorNameList.length; ci++) {
            const cn = creditorNameList[ci];
            const amt = Math.floor(generalBudget * shares[cn]);
            creditorAmounts[`c${ci}`] = formatKRW(amt);
            creditorTotals[cn] += amt;
            creditorSum += amt;
            roundTotal += amt;
        }
        // 단수 차이 보정
        const rounding = generalBudget - creditorSum;
        if (rounding > 0 && creditorNameList.length > 0) {
            const lastIdx = creditorNameList.length - 1;
            const lastCn = creditorNameList[lastIdx];
            const lastAmt = Math.floor(generalBudget * shares[lastCn]) + rounding;
            creditorAmounts[`c${lastIdx}`] = formatKRW(lastAmt);
            creditorTotals[lastCn] += rounding;
            roundTotal += rounding;
        }
        priorityGrandTotal += priorityAmount;
        grandTotal += roundTotal;
        detailedSchedule.push({
            round,
            payDate: payDateStr,
            priorityAmount: formatKRW(priorityAmount),
            ...creditorAmounts,
            total: formatKRW(roundTotal),
        });
    }
    // 합계 행
    const totalRowCreditors = {};
    creditorNameList.forEach((cn, ci) => {
        totalRowCreditors[`c${ci}`] = formatKRW(creditorTotals[cn]);
    });
    const startDateStr = detailedSchedule[0]?.payDate ?? "";
    const endDateStr = detailedSchedule[detailedSchedule.length - 1]?.payDate ?? "";
    return {
        clientName: client.name ?? "",
        court: client.court ?? "",
        today: today(),
        repayPeriodMonths,
        disposableMonthly: formatKRW(disposableMonthly),
        disposableTotal: formatKRW(disposableTotal),
        netLiquidation: formatKRW(netLiquidation),
        isLiquidationAdjusted,
        adjustedNote: isLiquidationAdjusted
            ? `청산가치(${formatKRW(netLiquidation)})가 가용소득 총액(${formatKRW(disposableTotal)})을 초과하므로, 청산가치 보장원칙에 따라 변제총액을 상향 조정합니다.`
            : "",
        monthlyPayment: formatKRW(monthly),
        totalRepay: formatKRW(effectiveTotal),
        totalDebt: formatKRW(totalDebt),
        repayRate: repayRate.toFixed(2) + "%",
        creditorShares,
        repaySchedule,
        // 변제예정액표 (채권자별 상세)
        detailedSchedule,
        creditorNameList,
        scheduleStartDate: startDateStr,
        scheduleEndDate: endDateStr,
        schedulePriorityTotal: formatKRW(priorityGrandTotal),
        scheduleGrandTotal: formatKRW(grandTotal),
        scheduleTotalRow: totalRowCreditors,
        hasPriorityDebt: priorityDebtTotal > 0,
    };
}
function buildStatementData(client) {
    const stmt = client.statement ?? {};
    const newDebts1yr = (stmt.newDebts1yr ?? []).map((d, i) => ({
        no: i + 1,
        creditor: d.creditor ?? "",
        date: d.date ?? "",
        amount: formatKRW(d.amount ?? 0),
        purpose: d.purpose ?? "",
    }));
    const largeTransfers = (stmt.largeTransfers ?? []).map((t, i) => ({
        no: i + 1,
        date: t.date ?? "",
        recipient: t.recipient ?? "",
        amount: formatKRW(t.amount ?? 0),
        reason: t.reason ?? "",
    }));
    const cashWithdrawals = (stmt.cashWithdrawals ?? []).map((w, i) => ({
        no: i + 1,
        date: w.date ?? "",
        amount: formatKRW(w.amount ?? 0),
        purpose: w.purpose ?? "",
    }));
    const largeCardUsage = (stmt.largeCardUsage ?? []).map((c, i) => ({
        no: i + 1,
        date: c.date ?? "",
        merchant: c.merchant ?? "",
        amount: formatKRW(c.amount ?? 0),
        category: c.category ?? "",
    }));
    const cancelledInsurance = (stmt.cancelledInsurance ?? []).map((ins, i) => ({
        no: i + 1,
        insurer: ins.insurer ?? "",
        cancelDate: ins.cancelDate ?? "",
        surrenderValue: formatKRW(ins.surrenderValue ?? 0),
    }));
    const investmentLosses = (stmt.investmentLosses ?? []).map((inv, i) => ({
        no: i + 1,
        type: inv.type ?? "",
        period: inv.period ?? "",
        lossAmount: formatKRW(inv.lossAmount ?? 0),
    }));
    const gamblingLosses = (stmt.gamblingLosses ?? []).map((g, i) => ({
        no: i + 1,
        type: g.type ?? "",
        period: g.period ?? "",
        lossAmount: formatKRW(g.lossAmount ?? 0),
    }));
    return {
        clientName: client.name ?? "",
        clientSSN: maskSSN(client.ssn ?? ""),
        clientAddr: client.address ?? "",
        court: client.court ?? "",
        today: today(),
        debtCause: stmt.debtCause ?? "",
        debtHistory: stmt.debtHistory ?? stmt.debtCause ?? "",
        debtTimeline: stmt.debtTimeline ?? "",
        propertyChanges2yr: stmt.propertyChanges2yr ?? stmt.debtTimeline ?? "",
        repayEfforts: stmt.repayEfforts ?? "",
        futureIncomePlan: stmt.futureIncomePlan ?? "",
        hasNewDebts1yr: newDebts1yr.length > 0,
        newDebts1yr,
        hasLargeTransfers: largeTransfers.length > 0,
        largeTransfers,
        hasCashWithdrawals: cashWithdrawals.length > 0,
        cashWithdrawals,
        hasLargeCardUsage: largeCardUsage.length > 0,
        largeCardUsage,
        hasCancelledInsurance: cancelledInsurance.length > 0,
        cancelledInsurance,
        hasInvestmentLosses: investmentLosses.length > 0,
        investmentLosses,
        hasGamblingLosses: gamblingLosses.length > 0,
        gamblingLosses,
        divorced2yr: stmt.divorced2yr ?? false,
        jobChange1yr: stmt.jobChange1yr ?? false,
        jobChangeDetail: stmt.jobChangeDetail ?? "",
        garnishment: stmt.garnishment ?? false,
        garnishmentDetail: stmt.garnishmentDetail ?? "",
        priorApplication: stmt.priorApplication ?? false,
        priorApplicationDetail: stmt.priorApplicationDetail ?? "",
        creditEducation: stmt.creditEducation ?? false,
        repayWillingness: stmt.repayWillingness ?? stmt.futureIncomePlan ?? "",
    };
}
// 법원 이관 매핑 (전자소송 안내 반영)
//   서울중앙 2017.3.1~ → 서울회생법원
//   수원·부산 2023.3.1~ → 수원·부산회생법원
//   광주·대전·대구 2026.3.1~ → 각 회생법원
function getRehabilitationCourt(originalCourt, filingDate) {
    if (!originalCourt)
        return "";
    const rules = [
        { from: "서울중앙지방법원", to: "서울회생법원", transitionDate: "2017-03-01" },
        { from: "수원지방법원", to: "수원회생법원", transitionDate: "2023-03-01" },
        { from: "부산지방법원", to: "부산회생법원", transitionDate: "2023-03-01" },
        { from: "광주지방법원", to: "광주회생법원", transitionDate: "2026-03-01" },
        { from: "대전지방법원", to: "대전회생법원", transitionDate: "2026-03-01" },
        { from: "대구지방법원", to: "대구회생법원", transitionDate: "2026-03-01" },
    ];
    const date = filingDate ? new Date(filingDate) : new Date();
    const rule = rules.find((r) => r.from === originalCourt);
    if (!rule)
        return originalCourt;
    return date >= new Date(rule.transitionDate) ? rule.to : originalCourt;
}
// 부가신청서 사건번호 검증 (금지/중지/면제재산에서 사용)
function requireCaseNumber(client, docType) {
    const caseNumber = client.caseNumber?.trim();
    if (!caseNumber) {
        throw new Error(`${docType}은(는) 개시신청서가 접수되어 사건번호가 부여된 뒤에만 제출할 수 있습니다. client.caseNumber를 입력해주세요.`);
    }
    return caseNumber;
}
function buildProhibitionOrderData(client) {
    const evidenceList = [];
    evidenceList.push("개인회생절차개시 신청서 사본 1부");
    evidenceList.push("급여명세서 1부");
    if (client.statement?.garnishment) {
        evidenceList.push("압류결정문 사본 1부");
    }
    evidenceList.push("가족관계증명서 1부");
    evidenceList.push("주민등록등본 1부");
    let reason = "";
    if (client.statement?.garnishment && client.statement?.garnishmentDetail) {
        reason = `현재 ${client.statement.garnishmentDetail}에 의한 급여 압류가 진행 중이며, 이로 인해 최저 생계비에도 미치지 못하는 금액만으로 생활하고 있어 극심한 생활 곤란을 겪고 있습니다. `;
    }
    else {
        reason = "현재 급여에 대한 압류가 진행 중이며, 이로 인해 최저 생계비에도 미치지 못하는 금액만으로 생활하고 있어 극심한 생활 곤란을 겪고 있습니다. ";
    }
    reason += `채무자는 가구원 ${client.family || 1}인 가구로서, 개인회생절차개시 신청을 하였으므로, 채무자회생법 제593조에 따라 개인회생채권에 기한 강제집행, 가압류, 가처분의 금지를 구합니다.`;
    return {
        // 부가신청서는 회생법원으로 이관된 경우 자동 변환
        court: getRehabilitationCourt(client.court, client.filingDate),
        originalCourt: client.court ?? "",
        clientName: client.name ?? "",
        clientSSN: maskSSN(client.ssn ?? ""),
        clientAddr: client.address ?? "",
        clientPhone: client.phone ?? "",
        caseNumber: client.caseNumber ?? "(접수 후 기재)",
        reason,
        evidenceList,
        today: today(),
    };
}
// 중지명령신청서 — 이미 진행 중인 강제집행/압류/경매를 중지 (채무자회생법 제593조)
function buildSuspensionOrderData(client) {
    requireCaseNumber(client, "중지명령신청서");
    const evidenceList = [];
    evidenceList.push("개인회생절차개시 신청서 사본 1부");
    evidenceList.push("압류결정문 사본 1부 (또는 집행문 사본)");
    evidenceList.push("급여명세서 1부");
    evidenceList.push("가족관계증명서 1부");
    evidenceList.push("주민등록등본 1부");
    // 중지 대상 절차들 (진술서 데이터 활용)
    const procedures = [];
    if (client.statement?.garnishmentDetail) {
        procedures.push(client.statement.garnishmentDetail);
    }
    // 채무에 연결된 판결채권/연체 기반 추정
    const hasLawsuit = (client.debts ?? []).some((d) => d.debtCategory === "판결채권" || d.type === "담보");
    if (hasLawsuit) {
        procedures.push("채권자들이 제기한 강제집행 및 가압류 절차");
    }
    const reason = `채무자는 개인회생절차 개시 신청을 하였으나, 현재 다음과 같은 강제집행·가압류·경매 절차가 진행 중이어서 생활에 중대한 위협을 받고 있습니다.\n\n` +
        (procedures.length > 0
            ? procedures.map((p, i) => `  ${i + 1}. ${p}`).join("\n")
            : "  1. 채권자의 급여 압류 및 예금 압류") +
        `\n\n이로 인해 채무자 및 가구원 ${client.family || 1}인의 최저생계비 유지가 불가능한 상황이므로, ` +
        `채무자회생법 제593조 제1항 제2호에 따라 위 강제집행 등의 중지를 구합니다.`;
    return {
        court: getRehabilitationCourt(client.court, client.filingDate),
        originalCourt: client.court ?? "",
        clientName: client.name ?? "",
        clientSSN: maskSSN(client.ssn ?? ""),
        clientAddr: client.address ?? "",
        clientPhone: client.phone ?? "",
        caseNumber: client.caseNumber,
        procedures,
        hasProcedures: procedures.length > 0,
        reason,
        evidenceList,
        today: today(),
    };
}
// 면제재산결정신청서 — 민사집행법 압류금지재산 외 추가 면제재산 신청
function buildExemptionDecisionData(client) {
    requireCaseNumber(client, "면제재산결정신청서");
    const evidenceList = [];
    evidenceList.push("개인회생절차개시 신청서 사본 1부");
    evidenceList.push("재산목록 사본 1부");
    evidenceList.push("가족관계증명서 1부");
    evidenceList.push("주민등록등본 1부");
    // 면제재산 추정 (재산목록에서 생계 필수품 성격)
    const exemptionItems = (client.assets ?? [])
        .filter((a) => {
        // 기본 압류금지 재산은 제외, 추가 필요한 것만
        if (a.type === "예금" && a.rawValue <= 1_850_000)
            return false;
        if (a.type === "차량" && a.rawValue <= 8_000_000)
            return false;
        return a.type === "기타" || a.source === "manual";
    })
        .map((a, i) => ({
        no: i + 1,
        name: a.name,
        type: a.type,
        value: formatKRW(a.rawValue),
        reason: "채무자 및 가구원의 생계 유지에 필수",
    }));
    const reason = `채무자는 개인회생절차 개시 신청을 하였으며, 재산목록에 기재한 재산 중 아래 재산은 채무자와 그 피부양자의 생활에 필수불가결한 것이므로 ` +
        `민사집행법 제195조 및 채무자회생법 제580조 제3항에 따라 면제재산으로 결정하여 주시기 바랍니다.`;
    return {
        court: getRehabilitationCourt(client.court, client.filingDate),
        originalCourt: client.court ?? "",
        clientName: client.name ?? "",
        clientSSN: maskSSN(client.ssn ?? ""),
        clientAddr: client.address ?? "",
        clientPhone: client.phone ?? "",
        caseNumber: client.caseNumber,
        familySize: client.family || 1,
        exemptionItems,
        exemptionCount: exemptionItems.length,
        reason,
        evidenceList,
        today: today(),
    };
}
// ---------------------------------------------------------------------------
// Dispatch map
// ---------------------------------------------------------------------------
const DATA_BUILDERS = {
    application: buildApplicationData,
    debt_list: buildDebtListData,
    asset_list: buildAssetListData,
    income_list: buildIncomeListData,
    repay_plan: buildRepayPlanData,
    statement: buildStatementData,
    prohibition_order: buildProhibitionOrderData,
    suspension_order: buildSuspensionOrderData,
    exemption_decision: buildExemptionDecisionData,
};
// ---------------------------------------------------------------------------
// Template-based generators
// ---------------------------------------------------------------------------
async function generateDocx(templateName, data) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(`templates/docx/${templateName}.docx`);
    const [exists] = await file.exists();
    if (!exists)
        throw new Error(`템플릿 없음: ${templateName}.docx`);
    const [buf] = await file.download();
    const zip = new pizzip_1.default(buf);
    const doc = new docxtemplater_1.default(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: "{", end: "}" } });
    doc.render(data);
    return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}
async function generateHwpx(templateName, data) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(`templates/hwpx/${templateName}.hwpx`);
    const [exists] = await file.exists();
    if (!exists)
        throw new Error(`HWPX 템플릿 없음: ${templateName}`);
    const [buf] = await file.download();
    const zip = await jszip_1.default.loadAsync(buf);
    const sectionFile = zip.file("Contents/section0.xml");
    if (!sectionFile)
        throw new Error("section0.xml not found");
    let xml = await sectionFile.async("string");
    for (const [key, val] of Object.entries(data)) {
        if (typeof val === "string" || typeof val === "number") {
            xml = xml.replaceAll(`{{${key}}}`, String(val));
        }
    }
    const arrayKeys = Object.keys(data).filter((k) => Array.isArray(data[k]));
    for (const key of arrayKeys) {
        xml = expandRepeat(xml, key, data[key]);
    }
    zip.file("Contents/section0.xml", xml);
    const output = await zip.generateAsync({ type: "nodebuffer" });
    return Buffer.from(output);
}
function expandRepeat(xml, key, rows) {
    const startTag = `<!--REPEAT:${key}-->`;
    const endTag = `<!--/REPEAT:${key}-->`;
    const start = xml.indexOf(startTag);
    const end = xml.indexOf(endTag);
    if (start === -1 || end === -1)
        return xml;
    const rowTemplate = xml.slice(start + startTag.length, end);
    const expanded = rows.map((row) => {
        let r = rowTemplate;
        for (const [k, v] of Object.entries(row)) {
            r = r.replaceAll(`{{${k}}}`, String(v ?? ""));
        }
        return r;
    }).join("");
    return xml.slice(0, start) + expanded + xml.slice(end + endTag.length);
}
// ---------------------------------------------------------------------------
// Docx generation with fallback
// ---------------------------------------------------------------------------
async function generateDocxWithFallback(typeName, data) {
    try {
        return await generateDocx(typeName, data);
    }
    catch {
        // 템플릿 없음 또는 Storage bucket 미설정 시 프로그래밍 방식 폴백
        return (0, docTemplateBuilder_1.buildDocx)(typeName, data);
    }
}
// ---------------------------------------------------------------------------
// Doc types & handler
// ---------------------------------------------------------------------------
const DOC_TYPES = ["debt_list", "asset_list", "income_list", "application", "repay_plan", "statement", "prohibition_order", "suspension_order", "exemption_decision"];
async function handleDocGenerate(req, res) {
    try {
        const body = req.body;
        // 플랜 확인: Auth 클레임 → Firestore office → starter 폴백
        const user = req.user;
        let plan = user?.plan ?? "starter";
        if (plan === "starter" && body.officeId) {
            const officeSnap = await admin.firestore().collection("offices").doc(body.officeId).get();
            if (officeSnap.exists) {
                const officeData = officeSnap.data();
                plan = officeData?.plan ?? "starter";
            }
        }
        if (body.format === "hwpx" && plan === "starter") {
            res.status(403).json({ error: "HWPX는 PRO 이상 플랜에서 사용 가능합니다." });
            return;
        }
        // SSN 복호화: ssnEncrypted가 있으면 복호화하여 ssn 필드에 넣기
        const clientData = body.clientData;
        if (clientData?.ssnEncrypted) {
            try {
                clientData.ssn = (0, ssnCrypto_1.decryptSSN)(clientData.ssnEncrypted);
            }
            catch {
                // 복호화 실패 시 기존 ssn 사용
            }
        }
        const types = body.docType === "all" ? [...DOC_TYPES] : [body.docType];
        // 단건 생성 — Buffer를 직접 응답 (Storage 불필요)
        if (types.length === 1) {
            const typeName = types[0];
            const builder = DATA_BUILDERS[typeName];
            if (!builder) {
                res.status(400).json({ error: `지원하지 않는 문서 유형: ${typeName}` });
                return;
            }
            const data = builder(body.clientData);
            let buffer;
            let actualFormat = body.format;
            if (body.format === "hwpx") {
                try {
                    buffer = await generateHwpx(typeName, data);
                }
                catch {
                    // HWPX 템플릿 없으면 DOCX로 폴백 (확장자도 변경)
                    buffer = await generateDocxWithFallback(typeName, data);
                    actualFormat = "docx";
                }
            }
            else {
                buffer = await generateDocxWithFallback(typeName, data);
            }
            const ext = actualFormat === "hwpx" ? "hwpx" : "docx";
            const fileName = `${typeName}.${ext}`;
            const contentType = ext === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "application/octet-stream";
            // Storage에 저장 시도, 실패하면 직접 base64 응답
            try {
                const bucket = admin.storage().bucket();
                const path = `docs/${body.officeId}/${body.clientId}/${fileName}`;
                const file = bucket.file(path);
                await file.save(buffer, { contentType });
                const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 3600 * 1000 });
                res.json({ downloadUrl: url, fileName });
            }
            catch {
                // Storage 미설정 시 base64 data URL 반환
                const base64 = buffer.toString("base64");
                const dataUrl = `data:${contentType};base64,${base64}`;
                res.json({ downloadUrl: dataUrl, fileName });
            }
            return;
        }
        // 전체 6종 생성
        const results = [];
        for (const typeName of types) {
            const builder = DATA_BUILDERS[typeName];
            if (!builder)
                continue;
            const data = builder(body.clientData);
            let buffer;
            let fileFormat = body.format;
            if (body.format === "hwpx") {
                try {
                    buffer = await generateHwpx(typeName, data);
                }
                catch {
                    buffer = await generateDocxWithFallback(typeName, data);
                    fileFormat = "docx";
                }
            }
            else {
                buffer = await generateDocxWithFallback(typeName, data);
            }
            const ext = fileFormat === "hwpx" ? "hwpx" : "docx";
            const fileName = `${typeName}.${ext}`;
            const contentType = ext === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "application/octet-stream";
            try {
                const bucket = admin.storage().bucket();
                const path = `docs/${body.officeId}/${body.clientId}/${fileName}`;
                const file = bucket.file(path);
                await file.save(buffer, { contentType });
                const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 3600 * 1000 });
                results.push({ downloadUrl: url, fileName });
            }
            catch {
                const base64 = buffer.toString("base64");
                const dataUrl = `data:${contentType};base64,${base64}`;
                results.push({ downloadUrl: dataUrl, fileName });
            }
        }
        res.json({ files: results });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "문서 생성 실패" });
    }
}
//# sourceMappingURL=docGenerator.js.map