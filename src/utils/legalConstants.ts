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
