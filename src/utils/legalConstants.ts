/**
 * 개인회생 관련 법적 상수
 * 마지막 업데이트: 2026-04-18
 *
 * ⚠️ 이 파일의 상수는 법령 개정 시 업데이트가 필요합니다.
 * 매년 1월에 기준중위소득, 소액임차인 금액 등을 확인하세요.
 */

// 채무 한도 (채무자회생법 제579조)
export const DEBT_LIMITS = {
  unsecured: 1_000_000_000, // 무담보 10억원
  secured: 1_500_000_000, // 담보부 15억원
  lastUpdated: '2024-01-01',
};

// 재신청 제한 (채무자회생법 제624조 제2항 제5호)
export const REAPPLICATION_LIMIT_YEARS = 5;

// 압류금지재산 (민사집행법 제246조)
export const EXEMPTIONS = {
  deposit: 1_850_000, // 예금 185만원
  vehicle: 8_000_000, // 차량 800만원
  lastUpdated: '2024-01-01',
};

// 법정이율
export const INTEREST_RATES = {
  civil: 5, // 민법 제379조
  commercial: 6, // 상법 제54조
};

// 송달료 (2025.6.1 기준)
export const SERVICE_FEE = {
  perRound: 5_500, // 1회분
  baseRounds: 10, // 기본 회차
  perCreditorRounds: 8, // 채권자 1인당 회차
  lastUpdated: '2025-06-01',
};

// 인지대
export const STAMP_FEE = {
  paper: 30_000,
  electronic: 27_000, // 전자소송 10% 할인
};

// 소액임차인 최우선변제금 (주택임대차보호법 제8조)
export const SMALL_TENANT = {
  서울: { depositLimit: 165_000_000, priorityAmount: 55_000_000 },
  수도권과밀: { depositLimit: 145_000_000, priorityAmount: 48_000_000 },
  광역시: { depositLimit: 85_000_000, priorityAmount: 28_000_000 },
  기타: { depositLimit: 75_000_000, priorityAmount: 25_000_000 },
  lastUpdated: '2024-01-01',
};

// ─────────────────────────────────────────────────
// 전자소송 제출법원 목록 (회생·파산 재판부)
// ─────────────────────────────────────────────────
export const COURTS = [
  { value: '서울회생법원', label: '서울회생법원' },
  { value: '서울중앙지방법원', label: '서울중앙지방법원' },
  { value: '서울동부지방법원', label: '서울동부지방법원' },
  { value: '서울남부지방법원', label: '서울남부지방법원' },
  { value: '서울북부지방법원', label: '서울북부지방법원' },
  { value: '서울서부지방법원', label: '서울서부지방법원' },
  { value: '의정부지방법원', label: '의정부지방법원' },
  { value: '인천지방법원', label: '인천지방법원' },
  { value: '수원지방법원', label: '수원지방법원' },
  { value: '수원회생법원', label: '수원회생법원' },
  { value: '춘천지방법원', label: '춘천지방법원' },
  { value: '대전지방법원', label: '대전지방법원' },
  { value: '청주지방법원', label: '청주지방법원' },
  { value: '대구지방법원', label: '대구지방법원' },
  { value: '부산지방법원', label: '부산지방법원' },
  { value: '부산회생법원', label: '부산회생법원' },
  { value: '울산지방법원', label: '울산지방법원' },
  { value: '창원지방법원', label: '창원지방법원' },
  { value: '광주지방법원', label: '광주지방법원' },
  { value: '전주지방법원', label: '전주지방법원' },
  { value: '제주지방법원', label: '제주지방법원' },
] as const;

// 사건번호 구분 코드
export const CASE_TYPES = [
  { value: '개회', label: '개회 (개인회생)' },
  { value: '회단', label: '회단 (개인회생 단독)' },
  { value: '하단', label: '하단 (개인파산 단독)' },
  { value: '하합', label: '하합 (개인파산 합의)' },
  { value: '면', label: '면 (면책)' },
] as const;

// 환급은행 드롭다운 (전자소송 등재 은행)
export const REFUND_BANKS = [
  '국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행',
  '기업은행', 'IBK기업은행', 'KEB하나은행', 'SC제일은행', '씨티은행',
  '카카오뱅크', '케이뱅크', '토스뱅크',
  '수협은행', '제주은행', '전북은행', '광주은행', '부산은행', '대구은행', '경남은행',
  'SH수협은행', '새마을금고', '신협', '우체국',
  '산업은행', '한국산업은행',
] as const;

// 관련사건 관계 드롭다운
export const RELATION_TYPES = [
  '배우자', '주채무자', '보증채무자', '연대채무자', '기타',
] as const;

// 개인회생 신청취지 기본 템플릿
export const DEFAULT_APPLICATION_PURPOSE =
  '「신청인에 대하여 개인회생절차를 개시한다」라는 결정을 구합니다.';

// 회생법원 이관 규칙 (전자소송 안내 기준)
//   서울중앙지방법원 회생파산사건 2017.3.1~ → 서울회생법원
//   수원지방법원 회생파산사건 2023.3.1~ → 수원회생법원
//   부산지방법원 회생파산사건 2023.3.1~ → 부산회생법원
//   광주·대전·대구지방법원 회생파산사건 2026.3.1~ → 각 지역 회생법원
export const COURT_TRANSITION_RULES: Array<{
  from: string;
  to: string;
  transitionDate: string; // YYYY-MM-DD
}> = [
  { from: '서울중앙지방법원', to: '서울회생법원', transitionDate: '2017-03-01' },
  { from: '수원지방법원', to: '수원회생법원', transitionDate: '2023-03-01' },
  { from: '부산지방법원', to: '부산회생법원', transitionDate: '2023-03-01' },
  { from: '광주지방법원', to: '광주회생법원', transitionDate: '2026-03-01' },
  { from: '대전지방법원', to: '대전회생법원', transitionDate: '2026-03-01' },
  { from: '대구지방법원', to: '대구회생법원', transitionDate: '2026-03-01' },
];

/**
 * 개시신청 법원 + 접수일자 → 부가신청서 제출 법원 변환
 * 이관 기준일 이후 접수된 회생파산 사건은 회생법원으로 제출해야 함
 */
export function getRehabilitationCourt(
  originalCourt: string | undefined,
  filingDate?: Date | string,
): string {
  if (!originalCourt) return '';
  const date = filingDate
    ? filingDate instanceof Date
      ? filingDate
      : new Date(filingDate)
    : new Date();
  const rule = COURT_TRANSITION_RULES.find((r) => r.from === originalCourt);
  if (!rule) return originalCourt;
  return date >= new Date(rule.transitionDate) ? rule.to : originalCourt;
}

/**
 * 사건번호 형식 검증: YYYY-개회-XXXXX 또는 YYYY개회XXXXX
 * 반환: { valid, year, caseType, number }
 */
export function parseCaseNumber(input: string): {
  valid: boolean;
  year?: number;
  caseType?: string;
  number?: string;
  formatted?: string;
} {
  if (!input) return { valid: false };
  const cleaned = input.trim().replace(/\s+/g, '');
  // YYYY개회NNNNN 또는 YYYY-개회-NNNNN
  const match = cleaned.match(/^(\d{4})[-]?(개회|회단|하단|하합|면)[-]?(\d{1,6})$/);
  if (!match) return { valid: false };
  const [, year, caseType, number] = match;
  const y = Number(year);
  if (y < 1998) return { valid: false }; // 1998년 이전은 전자소송 제한
  return {
    valid: true,
    year: y,
    caseType,
    number,
    formatted: `${year}${caseType}${number}`,
  };
}

