import { DEBT_LIMITS, EXEMPTIONS, INTEREST_RATES, SMALL_TENANT } from '@/utils/legalConstants';

// ── 소멸시효 확인 ──

const STATUTE_OF_LIMITATIONS: Record<string, number> = {
  '일반채권': 10,    // 민법
  '상사채권': 5,     // 상법
  '카드채무': 5,     // 상사채권
  '대출채무': 5,     // 상사채권 (은행/카드사)
  '사채': 10,        // 일반채권
  '판결채권': 10,    // 확정판결
  '세금': -1,        // 소멸시효 없음 (국세기본법별도)
};

/**
 * 소멸시효 완성 여부 확인
 * @param debtType 채무 유형 (일반채권, 상사채권, 카드채무, 대출채무, 사채, 판결채권, 세금)
 * @param lastPaymentDate 마지막 변제일 (null이면 기한이익 상실일 기준)
 * @param accelerationDate 기한이익 상실일
 * @returns { expired: 시효 완성 여부, remainingDays: 남은 일수 (음수면 이미 완성), limitYears: 시효 기간 }
 */
export function checkStatuteOfLimitations(
  debtType: string,
  lastPaymentDate: Date | null,
  accelerationDate: Date | null,
): { expired: boolean; remainingDays: number; limitYears: number } {
  const limitYears = STATUTE_OF_LIMITATIONS[debtType] ?? 10;

  // 세금은 소멸시효 없음
  if (limitYears === -1) {
    return { expired: false, remainingDays: Infinity, limitYears: -1 };
  }

  // 기산일: 마지막 변제일 > 기한이익 상실일 중 더 늦은 날짜
  const baseDate = lastPaymentDate ?? accelerationDate;
  if (!baseDate) {
    return { expired: false, remainingDays: Infinity, limitYears };
  }

  const expirationDate = new Date(baseDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + limitYears);

  const now = new Date();
  const remainingMs = expirationDate.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  return {
    expired: remainingDays <= 0,
    remainingDays,
    limitYears,
  };
}

// ── 소액임차인 최우선변제금 ──

const SMALL_TENANT_LIMITS: Record<string, { depositLimit: number; priorityAmount: number }> = {
  '서울': SMALL_TENANT['서울'],
  '수도권과밀': SMALL_TENANT['수도권과밀'],
  '광역시': SMALL_TENANT['광역시'],
  '기타': SMALL_TENANT['기타'],
};

/**
 * 소액임차인 최우선변제금 계산
 * @param region 지역 ('서울', '수도권과밀', '광역시', '기타')
 * @param deposit 보증금 총액
 * @returns { isSmallTenant: 소액임차인 해당 여부, priorityAmount: 최우선변제금, remainingAsset: 공제 후 잔여 자산가치 }
 */
export function calcSmallTenantPriority(
  region: string,
  deposit: number,
): { isSmallTenant: boolean; priorityAmount: number; remainingAsset: number } {
  const limit = SMALL_TENANT_LIMITS[region] ?? SMALL_TENANT_LIMITS['기타'];

  if (deposit <= limit.depositLimit) {
    // 소액임차인에 해당
    const priorityAmount = Math.min(deposit, limit.priorityAmount);
    const remainingAsset = Math.max(0, deposit - priorityAmount);
    return { isSmallTenant: true, priorityAmount, remainingAsset };
  }

  // 소액임차인 비해당 - 최우선변제금 없음
  return { isSmallTenant: false, priorityAmount: 0, remainingAsset: deposit };
}

export function getSmallTenantRegions(): string[] {
  return Object.keys(SMALL_TENANT_LIMITS);
}

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
const LEGAL_RATE = INTEREST_RATES.civil / 100;

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
  isCurrentlyEmployed: boolean = true,
): { estimatedRetirement: number; presentValue: number; factor: number; halfApplied: boolean } {
  // 퇴직금 = 월평균임금 × 총근속연수 (퇴직시점 기준)
  const totalYears = yearsWorked + yearsUntilRetirement;
  const estimatedRetirement = monthlyWage * totalYears;
  const factor = leibnizFactor(yearsUntilRetirement);
  const fullPV = Math.floor(estimatedRetirement * factor);
  // 재직 중인 경우 예상 퇴직금의 1/2만 청산가치에 산입
  // (근로기준법 제38조, 민사집행법 제246조 준용)
  const halfApplied = isCurrentlyEmployed && yearsUntilRetirement > 0;
  const presentValue = halfApplied ? Math.floor(fullPV / 2) : fullPV;
  return { estimatedRetirement, presentValue, factor, halfApplied };
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

// ── 이자/지연손해금 일할 계산 ──

/** 법정이율 (민법 제379조) */
const CIVIL_LEGAL_RATE = INTEREST_RATES.civil;
/** 상사법정이율 (상법 제54조) */
const COMMERCIAL_LEGAL_RATE = INTEREST_RATES.commercial;

/**
 * 이율 유형에 따른 연이율 반환
 */
export function getInterestRate(type: '약정이율' | '법정이율' | '상사법정이율', contractRate?: number): number {
  switch (type) {
    case '약정이율': return contractRate ?? 0;
    case '법정이율': return CIVIL_LEGAL_RATE;
    case '상사법정이율': return COMMERCIAL_LEGAL_RATE;
    default: return contractRate ?? 0;
  }
}

/**
 * 지연손해금 일할 계산
 * @param principal 원금
 * @param rate 연이율 (%, 예: 12)
 * @param fromDate 연체 기산일
 * @param toDate 신청일 (기준일)
 * @returns 지연손해금 금액
 */
export function calcOverdueInterest(
  principal: number,
  rate: number,
  fromDate: Date,
  toDate: Date
): number {
  const days = Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000));
  return Math.round(principal * (rate / 100) * (days / 365));
}

// ── 별제권 (담보채권) 계산 ──

/**
 * 별제권 행사 예상액 계산
 * = min(채무액, 담보물 시가 - 선순위 설정액)
 */
export function calcSeparateSecurityAmount(
  debtAmount: number,
  collateralValue: number,
  seniorLien: number = 0,
): number {
  const netCollateral = Math.max(0, collateralValue - seniorLien);
  return Math.min(debtAmount, netCollateral);
}

/**
 * 부족액 계산 (일반 채권으로 전환되는 금액)
 * = max(0, 채무액 - 별제권 행사 예상액)
 */
export function calcDeficiencyAmount(
  debtAmount: number,
  separateSecurityAmount: number,
): number {
  return Math.max(0, debtAmount - separateSecurityAmount);
}

// ── 채무 총액 한도 검증 ──

/** 개인회생 채무한도 (채무자 회생 및 파산에 관한 법률) */
const UNSECURED_DEBT_LIMIT = DEBT_LIMITS.unsecured;
const SECURED_DEBT_LIMIT = DEBT_LIMITS.secured;

export interface DebtLimitWarning {
  unsecuredExceeded: boolean;
  securedExceeded: boolean;
  unsecuredTotal: number;
  securedTotal: number;
  messages: string[];
}

/**
 * 채무 총액 한도 검증
 * 무담보 10억원, 담보부 15억원 초과 시 경고
 */
export function checkDebtLimits(
  debts: Array<{ amount: number; type: string }>,
): DebtLimitWarning {
  const unsecuredTotal = debts
    .filter(d => d.type !== '담보')
    .reduce((sum, d) => sum + d.amount, 0);
  const securedTotal = debts
    .filter(d => d.type === '담보')
    .reduce((sum, d) => sum + d.amount, 0);

  const messages: string[] = [];
  const unsecuredExceeded = unsecuredTotal > UNSECURED_DEBT_LIMIT;
  const securedExceeded = securedTotal > SECURED_DEBT_LIMIT;

  if (unsecuredExceeded) {
    messages.push(`무담보 채무 총액(${Math.floor(unsecuredTotal / 10000).toLocaleString()}만원)이 한도 10억원을 초과합니다. 개인회생 신청이 제한될 수 있습니다.`);
  }
  if (securedExceeded) {
    messages.push(`담보부 채무 총액(${Math.floor(securedTotal / 10000).toLocaleString()}만원)이 한도 15억원을 초과합니다. 개인회생 신청이 제한될 수 있습니다.`);
  }

  return { unsecuredExceeded, securedExceeded, unsecuredTotal, securedTotal, messages };
}

// ── 압류금지재산 자동 공제 ──

/** 압류금지 공제 한도 (민사집행법) */
const DEPOSIT_EXEMPT_AMOUNT = EXEMPTIONS.deposit;
const VEHICLE_EXEMPT_AMOUNT = EXEMPTIONS.vehicle;

/**
 * 압류금지재산 공제 적용된 청산가치 계산
 * - 예금: 185만원 공제
 * - 자동차: 800만원 이하 생활필수 차량 공제
 * - 보험: 의무보험(국민건강보험) 제외
 */
export function calcLiquidationValueWithExemptions(
  assets: Array<{ type: string; rawValue: number; liquidationRate: number; mortgage: number; meta?: { insuranceType?: string } }>,
): { total: number; exemptions: Array<{ type: string; name: string; amount: number }> } {
  const exemptions: Array<{ type: string; name: string; amount: number }> = [];
  let total = 0;

  for (const a of assets) {
    const grossValue = Math.floor(a.rawValue * (a.liquidationRate / 100));
    let net = grossValue - a.mortgage;

    if (a.type === '예금') {
      // 예금 185만원 압류금지
      const exemptAmount = Math.min(DEPOSIT_EXEMPT_AMOUNT, Math.max(0, net));
      if (exemptAmount > 0) {
        exemptions.push({ type: '예금', name: '압류금지 예금 (민사집행법 제246조)', amount: exemptAmount });
        net -= exemptAmount;
      }
    } else if (a.type === '차량') {
      // 800만원 이하 생활필수 차량 전액 공제
      if (a.rawValue <= VEHICLE_EXEMPT_AMOUNT) {
        const exemptAmount = Math.max(0, net);
        if (exemptAmount > 0) {
          exemptions.push({ type: '차량', name: '생활필수 차량 공제 (800만원 이하, 민사집행법 시행령)', amount: exemptAmount });
          net = 0;
        }
      }
    } else if (a.type === '보험') {
      // 의무보험(국민건강보험) 제외
      const insuranceType = a.meta?.insuranceType ?? '';
      if (insuranceType.includes('국민건강') || insuranceType.includes('건강보험') || insuranceType.includes('의무보험')) {
        const exemptAmount = Math.max(0, net);
        if (exemptAmount > 0) {
          exemptions.push({ type: '보험', name: '의무보험 제외 (국민건강보험)', amount: exemptAmount });
          net = 0;
        }
      }
    }

    total += Math.max(0, net);
  }

  return { total, exemptions };
}

// ── 대위변제 / 구상채권 처리 ──

import type { Debt } from '@/types/client';

/**
 * 대위변제 적용 후 채무 목록 반환
 * - 대위변제가 있는 원채권: 금액에서 대위변제액 차감
 * - 구상채권자를 별도 채무 항목으로 추가
 */
export function applySubrogation(debts: Debt[]): Debt[] {
  const result: Debt[] = [];

  for (const d of debts) {
    if (d.hasSubrogation && d.subrogationAmount && d.subrogationAmount > 0) {
      // 원채권 금액 차감
      const adjustedAmount = Math.max(0, d.amount - d.subrogationAmount);
      result.push({ ...d, amount: adjustedAmount });

      // 구상채권자를 별도 행으로 추가
      result.push({
        id: `${d.id}_subrogation`,
        name: `구상채권 (${d.name})`,
        creditor: d.subrogationCreditor || '(대위변제자)',
        type: '무담보',
        amount: d.subrogationAmount,
        rate: 0,
        monthly: 0,
        source: d.source,
        isSubrogationClaim: true,
        originalCreditor: d.creditor,
        originalDebtAmount: d.amount,
      });
    } else {
      result.push(d);
    }
  }

  return result;
}

// ── 변제계획안 자동 계산 ──

/**
 * 채권자별 배당률 계산
 * 무담보채권 + 담보채권의 부족액(deficiencyAmount)을 대상으로 채무비율에 따라 안분 배당
 * 별제권 금액은 변제계획에서 제외하고, 부족액만 일반 채권으로 포함
 */
export function calcCreditorShares(
  debts: Array<{ creditor: string; amount: number; type: string; deficiencyAmount?: number; separateSecurityAmount?: number }>,
  monthlyPayment: number,
  period: number,
): Array<{
  creditor: string;
  debtAmount: number;
  shareRate: number;
  monthlyShare: number;
  totalShare: number;
  isDeficiency?: boolean;
}> {
  // 일반채권에 포함할 항목: 무담보/사채 전액 + 담보채권의 부족액
  const entries: Array<{ creditor: string; amount: number; isDeficiency: boolean }> = [];

  for (const d of debts) {
    if (d.type === '담보') {
      const deficiency = d.deficiencyAmount ?? d.amount;
      if (deficiency > 0) {
        entries.push({ creditor: d.creditor, amount: deficiency, isDeficiency: true });
      }
    } else {
      entries.push({ creditor: d.creditor, amount: d.amount, isDeficiency: false });
    }
  }

  const totalUnsecured = entries.reduce((sum, e) => sum + e.amount, 0);

  if (totalUnsecured <= 0) return [];

  return entries.map((e) => {
    const shareRate = e.amount / totalUnsecured;
    const monthlyShare = Math.floor(monthlyPayment * shareRate);
    const totalShare = monthlyShare * period;
    return {
      creditor: e.creditor,
      debtAmount: e.amount,
      shareRate: Math.round(shareRate * 10000) / 10000,
      monthlyShare,
      totalShare,
      isDeficiency: e.isDeficiency,
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
    const rawValue = Number.isFinite(a.rawValue) ? a.rawValue : 0;
    const rate = Number.isFinite(a.liquidationRate) ? a.liquidationRate : 0;
    const mortgage = Number.isFinite(a.mortgage) ? a.mortgage : 0;
    // 환가율은 0~100 사이로 클램프 (음수·100 초과·NaN 방어)
    const safeRate = Math.max(0, Math.min(100, rate));
    const net = Math.floor(rawValue * (safeRate / 100)) - mortgage;
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
  debts: Array<{ creditor: string; amount: number; type: string; deficiencyAmount?: number; separateSecurityAmount?: number }>;
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
  // 조세채권 절반기간 완납 검증
  taxCheck: {
    taxTotal: number;          // 조세채권 총액
    halfPeriod: number;        // 절반 기간 (월)
    canPayInHalf: boolean;     // 절반 내 완납 가능 여부
    monthsNeeded: number;      // 완납에 필요한 개월수
    shortage: number;          // 부족액 (절반 내 납부 가능액 - 조세채권)
    suggestion: string;        // 대안 제안 메시지
  };
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

  // 무담보채무 총액 (담보채권의 부족액 포함)
  const totalUnsecuredDebt = params.debts.reduce((sum, d) => {
    if (d.type === '담보') {
      return sum + (d.deficiencyAmount ?? d.amount);
    }
    return sum + d.amount;
  }, 0);

  // 변제율 (%)
  const repaymentRate =
    totalUnsecuredDebt > 0
      ? Math.round((totalRepayment / totalUnsecuredDebt) * 10000) / 100
      : 0;

  const meetsLiquidation = totalRepayment >= liquidationValue;

  const creditorShares = calcCreditorShares(params.debts, generalMonthly, period);

  // ── 조세채권 절반기간 완납 검증 ──
  const taxTotal = priority; // 우선채권(조세) 총액
  const halfPeriod = Math.floor(period / 2);
  const payableInHalf = monthlyDisposable * halfPeriod;
  const canPayInHalf = taxTotal <= 0 || payableInHalf >= taxTotal;
  const monthsNeeded = taxTotal > 0 && monthlyDisposable > 0
    ? Math.ceil(taxTotal / monthlyDisposable)
    : 0;
  const shortage = Math.max(0, taxTotal - payableInHalf);

  let suggestion = '';
  if (taxTotal > 0 && !canPayInHalf) {
    if (period < 60) {
      const neededPeriod = monthsNeeded * 2; // 절반 내 완납하려면 전체 기간 = 필요개월 × 2
      if (neededPeriod <= 60) {
        suggestion = `변제기간을 ${neededPeriod}개월로 연장하면 절반(${Math.floor(neededPeriod / 2)}개월) 내 조세채권 완납이 가능합니다.`;
      } else {
        suggestion = `변제기간 60개월로도 절반 내 완납이 어렵습니다. 세금 ${formatKRW(shortage)}을 먼저 납부하고 신청하는 것을 검토하세요.`;
      }
    } else {
      suggestion = `변제기간 60개월(최대)에서도 절반(30개월) 내 완납이 어렵습니다. 세금 ${formatKRW(shortage)}을 먼저 납부 후 신청을 검토하세요.`;
    }
  }

  const taxCheck = { taxTotal, halfPeriod, canPayInHalf, monthsNeeded, shortage, suggestion };

  return {
    monthlyDisposable,
    livingExpense,
    period,
    totalRepayment,
    repaymentRate,
    liquidationValue,
    meetsLiquidation,
    creditorShares,
    taxCheck,
  };
}

function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원';
}

// ── 변제예정액표 (월별) 자동 생성 ──

export interface RepayScheduleRow {
  round: number;            // 회차 (1~months)
  payDate: string;          // 변제일 (YYYY.MM)
  priorityAmount: number;   // 우선채권 변제액
  creditorAmounts: Record<string, number>; // 채권자별 배당액
  total: number;            // 합계
}

export interface RepayScheduleResult {
  startDate: string;        // 변제 시작월 (YYYY.MM)
  endDate: string;          // 변제 종료월 (YYYY.MM)
  months: number;           // 변제 기간
  monthlyPayment: number;   // 월 변제금
  rows: RepayScheduleRow[]; // 월별 데이터
  creditorNames: string[];  // 채권자 목록 (헤더용)
  totals: {                 // 합계행
    priority: number;
    creditors: Record<string, number>;
    grand: number;
  };
}

/**
 * 변제예정액표 자동 생성
 *
 * 로직:
 * 1. 우선채권(조세 등)은 변제 초기에 선변제
 * 2. 우선채권 완료 후 일반 채권을 채권액 비율(안분)로 배당
 * 3. 별제권 부족액은 일반 채권으로 편입
 * 4. 비면책채권도 포함 (면책 안 되지만 변제계획에는 포함)
 *
 * @param debts 채무 목록
 * @param monthlyPayment 월 변제금
 * @param months 변제 기간 (개월)
 * @param priorityDebtTotal 우선채권 총액 (조세, 임금채권 등)
 * @param startYear 시작년도 (기본: 현재 연도)
 * @param startMonth 시작월 (기본: 현재 월+1)
 */
export function buildRepaySchedule(
  debts: Array<{
    creditor: string;
    amount: number;
    type: string;
    deficiencyAmount?: number;
    separateSecurityAmount?: number;
    isNonDischargeable?: boolean;
    nonDischargeReason?: string;
  }>,
  monthlyPayment: number,
  months: number,
  priorityDebtTotal: number = 0,
  startYear?: number,
  startMonth?: number,
): RepayScheduleResult {
  const now = new Date();
  const sYear = startYear ?? now.getFullYear();
  const sMonth = startMonth ?? (now.getMonth() + 2); // 다음 달

  // 일반채권 대상: 무담보/사채 전액 + 담보 부족액
  const generalEntries: Array<{ creditor: string; amount: number }> = [];
  for (const d of debts) {
    if (d.type === '담보') {
      const deficiency = d.deficiencyAmount ?? d.amount;
      if (deficiency > 0) {
        generalEntries.push({ creditor: d.creditor, amount: deficiency });
      }
    } else {
      generalEntries.push({ creditor: d.creditor, amount: d.amount });
    }
  }

  const totalGeneral = generalEntries.reduce((s, e) => s + e.amount, 0);
  const creditorNames = generalEntries.map(e => e.creditor);

  // 안분 비율 계산
  const shares: Record<string, number> = {};
  for (const e of generalEntries) {
    shares[e.creditor] = totalGeneral > 0 ? e.amount / totalGeneral : 0;
  }

  const rows: RepayScheduleRow[] = [];
  let remainingPriority = priorityDebtTotal;

  const totalsPriority = { priority: 0, creditors: {} as Record<string, number>, grand: 0 };
  for (const name of creditorNames) {
    totalsPriority.creditors[name] = 0;
  }

  for (let round = 1; round <= months; round++) {
    // 날짜 계산
    const m = sMonth + round - 1;
    const year = sYear + Math.floor((m - 1) / 12);
    const month = ((m - 1) % 12) + 1;
    const payDate = `${year}.${String(month).padStart(2, '0')}`;

    let priorityAmount = 0;
    let generalBudget = monthlyPayment;

    // 우선채권 선변제
    if (remainingPriority > 0) {
      priorityAmount = Math.min(remainingPriority, monthlyPayment);
      remainingPriority -= priorityAmount;
      generalBudget = monthlyPayment - priorityAmount;
    }

    // 일반채권 안분 배당
    const creditorAmounts: Record<string, number> = {};
    let roundTotal = priorityAmount;

    for (const name of creditorNames) {
      const amt = Math.floor(generalBudget * shares[name]);
      creditorAmounts[name] = amt;
      roundTotal += amt;
      totalsPriority.creditors[name] += amt;
    }

    // 단수 차이 보정: 마지막 채권자에 추가
    const creditorSum = Object.values(creditorAmounts).reduce((s, v) => s + v, 0);
    const rounding = generalBudget - creditorSum;
    if (rounding > 0 && creditorNames.length > 0) {
      const lastCreditor = creditorNames[creditorNames.length - 1];
      creditorAmounts[lastCreditor] += rounding;
      totalsPriority.creditors[lastCreditor] += rounding;
      roundTotal += rounding;
    }

    totalsPriority.priority += priorityAmount;
    totalsPriority.grand += roundTotal;

    rows.push({ round, payDate, priorityAmount, creditorAmounts, total: roundTotal });
  }

  const endIdx = rows.length - 1;

  return {
    startDate: rows[0]?.payDate ?? '',
    endDate: rows[endIdx]?.payDate ?? '',
    months,
    monthlyPayment,
    rows,
    creditorNames,
    totals: totalsPriority,
  };
}

// ── 변제기간 변동 시 전체 재계산 ──

export interface PeriodChangeComparison {
  before: {
    period: number;
    monthlyPayment: number;
    totalRepayment: number;
    repaymentRate: number;
  };
  after: {
    period: number;
    monthlyPayment: number;
    totalRepayment: number;
    repaymentRate: number;
  };
  schedule: RepayScheduleResult;
  taxCheck: {
    taxTotal: number;
    halfPeriod: number;
    canPayInHalf: boolean;
    monthsNeeded: number;
    shortage: number;
    suggestion: string;
  };
}

/**
 * 변제기간 변경 시 전체 재계산 + 변제예정액표 재생성
 * 변경 전/후 비교 데이터를 함께 반환
 */
export function recalcOnPeriodChange(params: {
  monthlyIncome: number;
  familySize: number;
  debts: Array<{ creditor: string; amount: number; type: string; deficiencyAmount?: number; separateSecurityAmount?: number; isNonDischargeable?: boolean; nonDischargeReason?: string }>;
  assets: Array<{ type: string; rawValue: number; liquidationRate: number; mortgage: number }>;
  priorityDebts?: number;
  oldPeriod: number;
  newPeriod: number;
  rent?: number;
  education?: number;
  medical?: number;
  income2?: number;
}): PeriodChangeComparison {
  const livingExpense = calcLivingCost(params.familySize);
  const monthlyDisposable = Math.max(0, Math.floor(params.monthlyIncome - livingExpense));

  // 전체 무담보 채무
  const totalUnsecuredDebt = params.debts.reduce((sum, d) => {
    if (d.type === '담보') return sum + (d.deficiencyAmount ?? d.amount);
    return sum + d.amount;
  }, 0);

  const priority = params.priorityDebts ?? 0;

  // Before
  const beforeTotal = monthlyDisposable * params.oldPeriod;
  const beforeRate = totalUnsecuredDebt > 0
    ? Math.round((beforeTotal / totalUnsecuredDebt) * 10000) / 100 : 0;

  // After (새 기간으로 계산)
  const afterTotal = monthlyDisposable * params.newPeriod;
  const afterRate = totalUnsecuredDebt > 0
    ? Math.round((afterTotal / totalUnsecuredDebt) * 10000) / 100 : 0;

  // 우선채권 공제 후 일반채권 배당용 월 금액
  const priorityMonthly = priority > 0 ? Math.ceil(priority / params.newPeriod) : 0;
  const generalMonthly = Math.max(0, monthlyDisposable - priorityMonthly);

  // 변제예정액표 재생성
  const schedule = buildRepaySchedule(
    params.debts,
    monthlyDisposable,
    params.newPeriod,
    priority,
  );

  // 조세채권 절반기간 검증
  const halfPeriod = Math.floor(params.newPeriod / 2);
  const payableInHalf = monthlyDisposable * halfPeriod;
  const canPayInHalf = priority <= 0 || payableInHalf >= priority;
  const monthsNeeded = priority > 0 && monthlyDisposable > 0
    ? Math.ceil(priority / monthlyDisposable) : 0;
  const shortage = Math.max(0, priority - payableInHalf);

  let suggestion = '';
  if (priority > 0 && !canPayInHalf) {
    if (params.newPeriod < 60) {
      const neededPeriod = monthsNeeded * 2;
      if (neededPeriod <= 60) {
        suggestion = `변제기간을 ${neededPeriod}개월로 연장하면 절반(${Math.floor(neededPeriod / 2)}개월) 내 조세채권 완납이 가능합니다.`;
      } else {
        suggestion = `변제기간 60개월로도 절반 내 완납이 어렵습니다. 세금 ${formatKRW(shortage)}을 먼저 납부하고 신청하는 것을 검토하세요.`;
      }
    } else {
      suggestion = `변제기간 60개월(최대)에서도 절반(30개월) 내 완납이 어렵습니다. 세금 ${formatKRW(shortage)}을 먼저 납부 후 신청을 검토하세요.`;
    }
  }

  return {
    before: {
      period: params.oldPeriod,
      monthlyPayment: monthlyDisposable,
      totalRepayment: beforeTotal,
      repaymentRate: beforeRate,
    },
    after: {
      period: params.newPeriod,
      monthlyPayment: monthlyDisposable,
      totalRepayment: afterTotal,
      repaymentRate: afterRate,
    },
    schedule,
    taxCheck: { taxTotal: priority, halfPeriod, canPayInHalf, monthsNeeded, shortage, suggestion },
  };
}
