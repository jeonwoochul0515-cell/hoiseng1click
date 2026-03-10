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
    unsecuredDebt: formatKRW((client.debts ?? []).filter((d: any) => d.type === '무담보').reduce((s: number, d: any) => s + (d.amount ?? 0), 0)),
    assets,
    totalAsset: formatKRW(totalAsset),
    income: formatKRW((client.income ?? 0) + (client.income2 ?? 0)),
    livCost: formatKRW(Math.floor((MEDIAN_INCOME_2026[Math.min(family, 6)] ?? 9000000) * 0.6)),
    extraCost: formatKRW((client.rent ?? 0) + (client.education ?? 0) + (client.medical ?? 0)),
    monthlyPayment: formatKRW(monthly),
    repayTotal36: formatKRW(monthly * 36),
    repayTotal60: formatKRW(monthly * 60),
    medianIncome: formatKRW(MEDIAN_INCOME_2026[Math.min(family, 6)] ?? 0),
  };
}

const DOC_TYPES = ['debt_list', 'asset_list', 'income_list', 'application', 'repay_plan'] as const;

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
