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
  const clamped = Math.max(family, 1);
  if (clamped <= 6) return MEDIAN_INCOME_2026[clamped]!;
  // 7인 이상: 6인 기준 + 1인당 증가분 (= 6인 - 5인)
  const perPerson = MEDIAN_INCOME_2026[6]! - MEDIAN_INCOME_2026[5]!;
  return MEDIAN_INCOME_2026[6]! + perPerson * (clamped - 6);
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

// ── 라이프니츠 계수 (현재가치 할인) ──

/** 법정이율 (민법 제379조, 연 5%) */
const LEGAL_RATE = 0.05;

/**
 * 라이프니츠 계수 (단일 시점)
 * 장래 n년 후 수령할 금액의 현재가치 = 금액 × leibnizFactor(n)
 */
export function leibnizFactor(years: number): number {
  if (years <= 0) return 1;
  return 1 / Math.pow(1 + LEGAL_RATE, years);
}

/**
 * 라이프니츠 계수 (연금형 — 매기 균등 수령)
 * n년간 매년 일정액을 수령할 때의 현재가치 합계 계수
 * = [1 - (1+r)^(-n)] / r
 */
export function leibnizAnnuityFactor(years: number): number {
  if (years <= 0) return 0;
  return (1 - Math.pow(1 + LEGAL_RATE, -years)) / LEGAL_RATE;
}

/**
 * 퇴직금 현재가치
 * @param monthlyWage 월 평균 임금
 * @param yearsWorked 현재까지 근속연수
 * @param yearsUntilRetirement 퇴직까지 남은 연수
 * @returns { estimatedRetirement: 예상 퇴직금, presentValue: 현재가치 }
 */
export function calcRetirementPV(
  monthlyWage: number,
  yearsWorked: number,
  yearsUntilRetirement: number,
): { estimatedRetirement: number; presentValue: number; factor: number } {
  // 퇴직금 = 월평균임금 × 총근속연수 (퇴직시점 기준)
  const totalYears = yearsWorked + yearsUntilRetirement;
  const estimatedRetirement = monthlyWage * totalYears;
  const factor = leibnizFactor(yearsUntilRetirement);
  const presentValue = Math.floor(estimatedRetirement * factor);
  return { estimatedRetirement, presentValue, factor };
}

/**
 * 임대차보증금 현재가치
 * @param deposit 보증금 총액
 * @param yearsUntilReturn 반환까지 남은 연수
 */
export function calcDepositPV(
  deposit: number,
  yearsUntilReturn: number,
): { presentValue: number; factor: number } {
  const factor = leibnizFactor(yearsUntilReturn);
  return { presentValue: Math.floor(deposit * factor), factor };
}

/**
 * 라이프니츠 계수표 (1~30년)
 */
export function getLeibnizTable(): Array<{ years: number; single: number; annuity: number }> {
  const table: Array<{ years: number; single: number; annuity: number }> = [];
  for (let n = 1; n <= 30; n++) {
    table.push({
      years: n,
      single: Math.round(leibnizFactor(n) * 10000) / 10000,
      annuity: Math.round(leibnizAnnuityFactor(n) * 10000) / 10000,
    });
  }
  return table;
}
