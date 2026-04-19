import type { Context } from 'hono';
import type { Env } from './types';
import { generateDocx, saveToR2 } from './docxGenerator';
import { generateHwpx } from './hwpxGenerator';

const MEDIAN_INCOME_2026: Record<number, number> = {
  1: 2392013, 2: 3932658, 3: 5025353,
  4: 6097773, 5: 7180914, 6: 8263055,
};

function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원';
}

function maskSSN(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, '');
  return cleaned.length >= 6 ? `${cleaned.slice(0, 6)}-*******` : ssn;
}

function calcMonthlyPayment(client: any): number {
  const base = MEDIAN_INCOME_2026[Math.min(client.family || 1, 6)] ?? 9000000;
  const livCost = base * 0.6;
  const extra = (client.rent || 0) + (client.education || 0) + (client.medical || 0);
  return Math.max(0, Math.floor((client.income || 0) + (client.income2 || 0) - livCost - extra));
}

function buildTemplateData(client: any) {
  const monthly = calcMonthlyPayment(client);
  const debts = (client.debts ?? []).map((d: any, i: number) => ({
    no: i + 1,
    name: d.name,
    creditor: d.creditor,
    type: d.type,
    amount: formatKRW(d.amount),
    rate: (d.rate ?? 0).toFixed(1) + '%',
    monthly: formatKRW(d.monthly ?? 0),
  }));
  const assets = (client.assets ?? []).map((a: any, i: number) => ({
    no: i + 1,
    name: a.name,
    type: a.type,
    rawValue: formatKRW(a.rawValue),
    rate: ((a.liquidationRate ?? 1) * 100).toFixed(0) + '%',
    mortgage: formatKRW(a.mortgage ?? 0),
    value: formatKRW(a.value ?? 0),
    basis: a.type === '부동산' ? '국토부 공시가격 환가율 75%' : a.type === '차량' ? '보험개발원 기준가액 환가율 70%' : '-',
  }));

  const totalDebt = (client.debts ?? []).reduce((s: number, d: any) => s + (d.amount ?? 0), 0);
  const totalAsset = (client.assets ?? []).reduce((s: number, a: any) => s + (a.value ?? 0), 0);
  const family = client.family || 1;

  return {
    clientName: client.name ?? '',
    clientAddr: client.address ?? '',
    clientSSN: maskSSN(client.ssn ?? ''),
    court: client.court ?? '',
    today: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
    debts,
    totalDebt: formatKRW(totalDebt),
    unsecuredDebt: formatKRW((client.debts ?? []).filter((d: any) => d.type !== '담보').reduce((s: number, d: any) => s + (d.amount ?? 0), 0)),
    securedDebt: formatKRW((client.debts ?? []).filter((d: any) => d.type === '담보').reduce((s: number, d: any) => s + (d.amount ?? 0), 0)),
    assets,
    totalAsset: formatKRW(totalAsset),
    income: formatKRW((client.income ?? 0) + (client.income2 ?? 0)),
    livCost: formatKRW(Math.floor((MEDIAN_INCOME_2026[Math.min(family, 6)] ?? 9000000) * 0.6)),
    extraCost: formatKRW((client.rent ?? 0) + (client.education ?? 0) + (client.medical ?? 0)),
    monthlyPayment: formatKRW(monthly),
    repayTotal36: formatKRW(monthly * 36),
    repayTotal60: formatKRW(monthly * 60),
    medianIncome: formatKRW(MEDIAN_INCOME_2026[Math.min(family, 6)] ?? 0),
    // ── statement (진술서) 전용 필드 ──
    ...buildStatementFields(client),
  };
}

function buildStatementFields(client: any): Record<string, unknown> {
  const stmt = client.statement ?? {};

  const newDebts1yr = (stmt.newDebts1yr ?? []).map((d: any, i: number) => ({
    no: i + 1,
    creditor: d.creditor ?? '',
    date: d.date ?? '',
    amount: formatKRW(d.amount ?? 0),
    purpose: d.purpose ?? '',
  }));

  const largeTransfers = (stmt.largeTransfers ?? []).map((t: any, i: number) => ({
    no: i + 1,
    date: t.date ?? '',
    recipient: t.recipient ?? '',
    amount: formatKRW(t.amount ?? 0),
    reason: t.reason ?? '',
  }));

  const cashWithdrawals = (stmt.cashWithdrawals ?? []).map((w: any, i: number) => ({
    no: i + 1,
    date: w.date ?? '',
    amount: formatKRW(w.amount ?? 0),
    purpose: w.purpose ?? '',
  }));

  const largeCardUsage = (stmt.largeCardUsage ?? []).map((c: any, i: number) => ({
    no: i + 1,
    date: c.date ?? '',
    merchant: c.merchant ?? '',
    amount: formatKRW(c.amount ?? 0),
    category: c.category ?? '',
  }));

  const cancelledInsurance = (stmt.cancelledInsurance ?? []).map((ins: any, i: number) => ({
    no: i + 1,
    insurer: ins.insurer ?? '',
    cancelDate: ins.cancelDate ?? '',
    surrenderValue: formatKRW(ins.surrenderValue ?? 0),
  }));

  const investmentLosses = (stmt.investmentLosses ?? []).map((inv: any, i: number) => ({
    no: i + 1,
    type: inv.type ?? '',
    period: inv.period ?? '',
    lossAmount: formatKRW(inv.lossAmount ?? 0),
  }));

  const gamblingLosses = (stmt.gamblingLosses ?? []).map((g: any, i: number) => ({
    no: i + 1,
    type: g.type ?? '',
    period: g.period ?? '',
    lossAmount: formatKRW(g.lossAmount ?? 0),
  }));

  return {
    debtCause: stmt.debtCause ?? '',
    debtHistory: stmt.debtHistory ?? stmt.debtCause ?? '',
    debtTimeline: stmt.debtTimeline ?? '',
    propertyChanges2yr: stmt.propertyChanges2yr ?? stmt.debtTimeline ?? '',
    repayEfforts: stmt.repayEfforts ?? '',
    futureIncomePlan: stmt.futureIncomePlan ?? '',
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
    jobChangeDetail: stmt.jobChangeDetail ?? '',
    garnishment: stmt.garnishment ?? false,
    garnishmentDetail: stmt.garnishmentDetail ?? '',
    priorApplication: stmt.priorApplication ?? false,
    priorApplicationDetail: stmt.priorApplicationDetail ?? '',
    creditEducation: stmt.creditEducation ?? false,
    repayWillingness: stmt.repayWillingness ?? stmt.futureIncomePlan ?? '',
  };
}

const DOC_TYPES = ['debt_list', 'asset_list', 'income_list', 'application', 'repay_plan', 'statement'] as const;

export async function handleDocGenerate(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json() as {
    clientId: string;
    officeId: string;
    docType: string;
    format: 'docx' | 'hwpx';
    clientData: any;
  };

  const user = c.get('user' as any) as { plan: string } | undefined;
  if (body.format === 'hwpx' && user?.plan === 'starter') {
    return c.json({ error: 'HWPX는 PRO 이상 플랜에서 사용 가능합니다.' }, 403);
  }

  const data = buildTemplateData(body.clientData);
  const types = body.docType === 'all' ? DOC_TYPES : [body.docType];

  if (types.length === 1) {
    const typeName = types[0];
    const buffer = body.format === 'hwpx'
      ? await generateHwpx(typeName, data, c.env)
      : await generateDocx(typeName, data, c.env);

    const ext = body.format;
    const path = `docs/${body.officeId}/${body.clientId}/${typeName}.${ext}`;
    await saveToR2(buffer, path, c.env);

    return c.json({ downloadUrl: `/doc/download/${encodeURIComponent(path)}`, fileName: `${typeName}.${ext}` });
  }

  // Multiple docs - generate all
  const results = [];
  for (const typeName of types) {
    const buffer = body.format === 'hwpx'
      ? await generateHwpx(typeName, data, c.env)
      : await generateDocx(typeName, data, c.env);
    const ext = body.format;
    const path = `docs/${body.officeId}/${body.clientId}/${typeName}.${ext}`;
    await saveToR2(buffer, path, c.env);
    results.push({ downloadUrl: `/doc/download/${encodeURIComponent(path)}`, fileName: `${typeName}.${ext}` });
  }

  return c.json({ files: results });
}
