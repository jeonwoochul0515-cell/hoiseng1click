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

// ── 변제계획안 자동 계산 ──

/**
 * 채권자별 배당률 계산
 * 무담보채권만 대상으로 채무비율에 따라 안분 배당
 */
export function calcCreditorShares(
  debts: Array<{ creditor: string; amount: number; type: string }>,
  monthlyPayment: number,
  period: number,
): Array<{
  creditor: string;
  debtAmount: number;
  shareRate: number;
  monthlyShare: number;
  totalShare: number;
}> {
  const unsecured = debts.filter((d) => d.type !== '담보');
  const totalUnsecured = unsecured.reduce((sum, d) => sum + d.amount, 0);

  if (totalUnsecured <= 0) return [];

  return unsecured.map((d) => {
    const shareRate = d.amount / totalUnsecured;
    const monthlyShare = Math.floor(monthlyPayment * shareRate);
    const totalShare = monthlyShare * period;
    return {
      creditor: d.creditor,
      debtAmount: d.amount,
      shareRate: Math.round(shareRate * 10000) / 10000,
      monthlyShare,
      totalShare,
    };
  });
}

/**
 * 청산가치 계산
 * 각 자산의 순청산가치 합산: (rawValue × liquidationRate/100) - mortgage
 * 음수는 0으로 처리
 */
export function calcLiquidationValue(
  assets: Array<{ type: string; rawValue: number; liquidationRate: number; mortgage: number }>,
): number {
  return assets.reduce((sum, a) => {
    const net = Math.floor(a.rawValue * (a.liquidationRate / 100)) - a.mortgage;
    return sum + Math.max(0, net);
  }, 0);
}

/**
 * 변제계획안 종합 계산
 *
 * 1. 생계비 = MEDIAN_INCOME[familySize] × 0.6
 * 2. 가용소득 = monthlyIncome - 생계비
 * 3. 변제기간 = 36개월 기본, 청산가치 미충족 시 최대 60개월
 * 4. 우선채권이 있으면 먼저 공제 후 나머지를 일반채권에 안분
 * 5. 청산가치 보장 검증: totalRepayment >= liquidationValue
 */
export function calcRepaymentPlan(params: {
  monthlyIncome: number;
  familySize: number;
  debts: Array<{ creditor: string; amount: number; type: string }>;
  assets: Array<{ type: string; rawValue: number; liquidationRate: number; mortgage: number }>;
  priorityDebts?: number;
}): {
  monthlyDisposable: number;
  livingExpense: number;
  period: number;
  totalRepayment: number;
  repaymentRate: number;
  liquidationValue: number;
  meetsLiquidation: boolean;
  creditorShares: Array<{
    creditor: string;
    debtAmount: number;
    shareRate: number;
    monthlyShare: number;
    totalShare: number;
  }>;
} {
  const livingExpense = calcLivingCost(params.familySize);
  const monthlyDisposable = Math.max(0, Math.floor(params.monthlyIncome - livingExpense));
  const liquidationValue = calcLiquidationValue(params.assets);
  const priority = params.priorityDebts ?? 0;

  // 우선채권 월 공제액 (36개월 기준으로 균등 분할)
  const priorityMonthly36 = priority > 0 ? Math.ceil(priority / 36) : 0;
  const generalMonthly36 = Math.max(0, monthlyDisposable - priorityMonthly36);

  // 36개월 기본 시도
  let period = 36;
  let totalRepayment = monthlyDisposable * period;

  // 청산가치 미충족 시 기간 연장 (최대 60개월)
  if (totalRepayment < liquidationValue) {
    if (monthlyDisposable > 0) {
      const needed = Math.ceil(liquidationValue / monthlyDisposable);
      period = Math.min(60, Math.max(36, needed));
    } else {
      period = 60;
    }
    totalRepayment = monthlyDisposable * period;
  }

  // 우선채권 공제 후 일반채권 배당용 월 금액
  const priorityMonthly = priority > 0 ? Math.ceil(priority / period) : 0;
  const generalMonthly = Math.max(0, monthlyDisposable - priorityMonthly);

  // 무담보채무 총액
  const totalUnsecuredDebt = params.debts
    .filter((d) => d.type !== '담보')
    .reduce((sum, d) => sum + d.amount, 0);

  // 변제율 (%)
  const repaymentRate =
    totalUnsecuredDebt > 0
      ? Math.round((totalRepayment / totalUnsecuredDebt) * 10000) / 100
      : 0;

  const meetsLiquidation = totalRepayment >= liquidationValue;

  const creditorShares = calcCreditorShares(params.debts, generalMonthly, period);

  return {
    monthlyDisposable,
    livingExpense,
    period,
    totalRepayment,
    repaymentRate,
    liquidationValue,
    meetsLiquidation,
    creditorShares,
  };
}
