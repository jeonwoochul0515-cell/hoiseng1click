import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import JSZip from "jszip";
import { buildDocx } from "./docTemplateBuilder";
import { decryptSSN } from "./ssnCrypto";

const MEDIAN_INCOME_2026: Record<number, number> = {
  1: 2392013, 2: 3932658, 3: 5025353,
  4: 6097773, 5: 7180914, 6: 8263055,
};

function formatKRW(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function maskSSN(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, "");
  return cleaned.length >= 6 ? `${cleaned.slice(0, 6)}-*******` : ssn;
}

function calcMonthlyPayment(client: any): number {
  const base = MEDIAN_INCOME_2026[Math.min(client.family || 1, 6)] ?? 9000000;
  const livCost = base * 0.6;
  const extra = (client.rent || 0) + (client.education || 0) + (client.medical || 0);
  return Math.max(0, Math.floor((client.income || 0) + (client.income2 || 0) - livCost - extra));
}

function today(): string {
  return new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// 라이프니츠 계수 (법정이율 연 5%)
const LEGAL_RATE = 0.05;
function leibnizFactor(years: number): number {
  return years <= 0 ? 1 : 1 / Math.pow(1 + LEGAL_RATE, years);
}
function calcRetirementPV(wage: number, worked: number, untilRetire: number) {
  const total = wage * (worked + untilRetire);
  const factor = leibnizFactor(untilRetire);
  return { estimated: total, pv: Math.floor(total * factor), factor };
}
function calcDepositPV(amount: number, years: number) {
  const factor = leibnizFactor(years);
  return { pv: Math.floor(amount * factor), factor };
}
function calcNetLiquidation(client: any): number {
  const assets: any[] = client.assets ?? [];
  const assetTotal = assets.reduce((s: number, a: any) => s + (a.value ?? 0), 0);
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

function buildApplicationData(client: any): Record<string, unknown> {
  const totalDebt = (client.debts ?? []).reduce((s: number, d: any) => s + (d.amount ?? 0), 0);
  const creditorCount = (client.debts ?? []).length;
  const monthly = calcMonthlyPayment(client);
  const repayPeriodMonths = client.repayPeriodMonths || 36;

  return {
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
  };
}

function buildDebtListData(client: any): Record<string, unknown> {
  const debts = (client.debts ?? []).map((d: any, i: number) => ({
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
    securedNote: d.type === "담보" ? (d.securedNote ?? d.collateralDesc ?? "담보설정") : "",
  }));

  const allDebts = client.debts ?? [];
  const totalDebt = allDebts.reduce((s: number, d: any) => s + (d.amount ?? 0), 0);
  const unsecuredDebt = allDebts
    .filter((d: any) => d.type !== "담보")
    .reduce((s: number, d: any) => s + (d.amount ?? 0), 0);
  const securedDebt = allDebts
    .filter((d: any) => d.type === "담보")
    .reduce((s: number, d: any) => s + (d.amount ?? 0), 0);

  return {
    clientName: client.name ?? "",
    clientAddr: client.address ?? "",
    court: client.court ?? "",
    today: today(),
    debts,
    totalDebt: formatKRW(totalDebt),
    unsecuredDebt: formatKRW(unsecuredDebt),
    securedDebt: formatKRW(securedDebt),
  };
}

function buildAssetListData(client: any): Record<string, unknown> {
  const assets: any[] = client.assets ?? [];

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

  const assetLiquidation = assets.reduce((s: number, a: any) => s + (a.value ?? 0), 0);

  // 라이프니츠 현재가치 항목
  const lb = client.leibniz ?? {};
  const leibnizItems: Array<Record<string, unknown>> = [];
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

function buildIncomeListData(client: any): Record<string, unknown> {
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

  const familyMembers: Array<Record<string, unknown>> = [];
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

function buildRepayPlanData(client: any): Record<string, unknown> {
  const repayPeriodMonths = client.repayPeriodMonths || 36;
  const disposableMonthly = calcMonthlyPayment(client);
  const disposableTotal = disposableMonthly * repayPeriodMonths;

  // 청산가치 보장원칙: MAX(가용소득 총액, 청산가치)
  const netLiquidation = calcNetLiquidation(client);
  const effectiveTotal = Math.max(disposableTotal, netLiquidation);
  const monthly = Math.ceil(effectiveTotal / repayPeriodMonths);
  const isLiquidationAdjusted = effectiveTotal > disposableTotal;

  const totalDebt = (client.debts ?? []).reduce((s: number, d: any) => s + (d.amount ?? 0), 0);
  const repayRate = totalDebt > 0 ? Math.round((effectiveTotal / totalDebt) * 10000) / 100 : 0;

  const creditorShares = (client.debts ?? []).map((d: any, i: number) => {
    const share = totalDebt > 0 ? (d.amount ?? 0) / totalDebt : 0;
    const monthlyShare = Math.floor(monthly * share);
    const totalShare = monthlyShare * repayPeriodMonths;
    return {
      no: i + 1,
      creditor: d.creditor ?? d.name ?? "",
      debtAmount: formatKRW(d.amount ?? 0),
      sharePercent: (share * 100).toFixed(2) + "%",
      monthlyShare: formatKRW(monthlyShare),
      totalShare: formatKRW(totalShare),
    };
  });

  const repaySchedule: Array<Record<string, unknown>> = [];
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
  };
}

function buildStatementData(client: any): Record<string, unknown> {
  const stmt = client.statement ?? {};

  const newDebts1yr = (stmt.newDebts1yr ?? []).map((d: any, i: number) => ({
    no: i + 1,
    creditor: d.creditor ?? "",
    date: d.date ?? "",
    amount: formatKRW(d.amount ?? 0),
    purpose: d.purpose ?? "",
  }));

  const largeTransfers = (stmt.largeTransfers ?? []).map((t: any, i: number) => ({
    no: i + 1,
    date: t.date ?? "",
    recipient: t.recipient ?? "",
    amount: formatKRW(t.amount ?? 0),
    reason: t.reason ?? "",
  }));

  const cashWithdrawals = (stmt.cashWithdrawals ?? []).map((w: any, i: number) => ({
    no: i + 1,
    date: w.date ?? "",
    amount: formatKRW(w.amount ?? 0),
    purpose: w.purpose ?? "",
  }));

  const largeCardUsage = (stmt.largeCardUsage ?? []).map((c: any, i: number) => ({
    no: i + 1,
    date: c.date ?? "",
    merchant: c.merchant ?? "",
    amount: formatKRW(c.amount ?? 0),
    category: c.category ?? "",
  }));

  const cancelledInsurance = (stmt.cancelledInsurance ?? []).map((ins: any, i: number) => ({
    no: i + 1,
    insurer: ins.insurer ?? "",
    cancelDate: ins.cancelDate ?? "",
    surrenderValue: formatKRW(ins.surrenderValue ?? 0),
  }));

  const investmentLosses = (stmt.investmentLosses ?? []).map((inv: any, i: number) => ({
    no: i + 1,
    type: inv.type ?? "",
    period: inv.period ?? "",
    lossAmount: formatKRW(inv.lossAmount ?? 0),
  }));

  const gamblingLosses = (stmt.gamblingLosses ?? []).map((g: any, i: number) => ({
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

// ---------------------------------------------------------------------------
// Dispatch map
// ---------------------------------------------------------------------------

const DATA_BUILDERS: Record<string, (client: any) => Record<string, unknown>> = {
  application: buildApplicationData,
  debt_list: buildDebtListData,
  asset_list: buildAssetListData,
  income_list: buildIncomeListData,
  repay_plan: buildRepayPlanData,
  statement: buildStatementData,
};

// ---------------------------------------------------------------------------
// Template-based generators
// ---------------------------------------------------------------------------

async function generateDocx(templateName: string, data: Record<string, unknown>): Promise<Buffer> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(`templates/docx/${templateName}.docx`);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`템플릿 없음: ${templateName}.docx`);
  const [buf] = await file.download();
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: "{", end: "}" } });
  doc.render(data);
  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}

async function generateHwpx(templateName: string, data: Record<string, unknown>): Promise<Buffer> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(`templates/hwpx/${templateName}.hwpx`);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`HWPX 템플릿 없음: ${templateName}`);
  const [buf] = await file.download();
  const zip = await JSZip.loadAsync(buf);
  const sectionFile = zip.file("Contents/section0.xml");
  if (!sectionFile) throw new Error("section0.xml not found");
  let xml = await sectionFile.async("string");

  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string" || typeof val === "number") {
      xml = xml.replaceAll(`{{${key}}}`, String(val));
    }
  }

  const arrayKeys = Object.keys(data).filter((k) => Array.isArray(data[k]));
  for (const key of arrayKeys) {
    xml = expandRepeat(xml, key, data[key] as unknown[]);
  }

  zip.file("Contents/section0.xml", xml);
  const output = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(output);
}

function expandRepeat(xml: string, key: string, rows: unknown[]): string {
  const startTag = `<!--REPEAT:${key}-->`;
  const endTag = `<!--/REPEAT:${key}-->`;
  const start = xml.indexOf(startTag);
  const end = xml.indexOf(endTag);
  if (start === -1 || end === -1) return xml;
  const rowTemplate = xml.slice(start + startTag.length, end);
  const expanded = rows.map((row) => {
    let r = rowTemplate;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      r = r.replaceAll(`{{${k}}}`, String(v ?? ""));
    }
    return r;
  }).join("");
  return xml.slice(0, start) + expanded + xml.slice(end + endTag.length);
}

// ---------------------------------------------------------------------------
// Docx generation with fallback
// ---------------------------------------------------------------------------

async function generateDocxWithFallback(typeName: string, data: Record<string, unknown>): Promise<Buffer> {
  try {
    return await generateDocx(typeName, data);
  } catch {
    // 템플릿 없음 또는 Storage bucket 미설정 시 프로그래밍 방식 폴백
    return buildDocx(typeName, data);
  }
}

// ---------------------------------------------------------------------------
// Doc types & handler
// ---------------------------------------------------------------------------

const DOC_TYPES = ["debt_list", "asset_list", "income_list", "application", "repay_plan", "statement"] as const;

export async function handleDocGenerate(req: Request, res: Response) {
  try {
    const body = req.body as {
      clientId: string; officeId: string; docType: string;
      format: "docx" | "hwpx"; clientData: any;
    };

    // 플랜 확인: Auth 클레임 → Firestore office → starter 폴백
    const user = (req as any).user as { uid: string; plan?: string } | undefined;
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
        clientData.ssn = decryptSSN(clientData.ssnEncrypted);
      } catch {
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

      let buffer: Buffer;
      if (body.format === "hwpx") {
        try {
          buffer = await generateHwpx(typeName, data);
        } catch {
          // HWPX 템플릿 없으면 DOCX로 폴백
          buffer = await generateDocxWithFallback(typeName, data);
        }
      } else {
        buffer = await generateDocxWithFallback(typeName, data);
      }

      const ext = body.format === "hwpx" ? "hwpx" : "docx";
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
      } catch {
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
      if (!builder) continue;
      const data = builder(body.clientData);

      let buffer: Buffer;
      if (body.format === "hwpx") {
        try {
          buffer = await generateHwpx(typeName, data);
        } catch {
          buffer = await generateDocxWithFallback(typeName, data);
        }
      } else {
        buffer = await generateDocxWithFallback(typeName, data);
      }

      const ext = body.format === "hwpx" ? "hwpx" : "docx";
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
      } catch {
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${contentType};base64,${base64}`;
        results.push({ downloadUrl: dataUrl, fileName });
      }
    }
    res.json({ files: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "문서 생성 실패" });
  }
}
