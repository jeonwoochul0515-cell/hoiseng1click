// 2026 기준중위소득 (보건복지부 고시)
const MEDIAN_INCOME_2026: Record<number, number> = {
  1: 2392013,
  2: 3932658,
  3: 5025353,
  4: 6097773,
  5: 7180914,
  6: 8263055,
};

export function getMedianIncome(family: number): number {
  return MEDIAN_INCOME_2026[Math.min(Math.max(family, 1), 6)] ?? 9000000;
}

export function calcLivingCost(family: number): number {
  return Math.floor(getMedianIncome(family) * 0.6);
}

export function calcMonthlyPayment(params: {
  income: number;
  income2: number;
  family: number;
  rent: number;
  education: number;
  medical: number;
}): number {
  const livCost = calcLivingCost(params.family);
  const extra = params.rent + params.education + params.medical;
  return Math.max(0, Math.floor(params.income + params.income2 - livCost - extra));
}

export function calcRepayTotal(monthlyPayment: number, months: number): number {
  return monthlyPayment * months;
}
