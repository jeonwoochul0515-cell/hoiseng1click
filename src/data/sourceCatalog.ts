import type { SourceCatalogEntry } from '@/types/docgen';

/**
 * CODEF 17개 API + 공공데이터포털의 마스터 카탈로그.
 * 각 항목은 문서 생성 시 "어디서 가져왔는지" 시각화에 사용.
 */
export const SOURCE_CATALOG: Record<string, SourceCatalogEntry> = {
  // 공공기관 서류 (회생클릭)
  'gov24-resident-abstract': {
    id: 'gov24-resident-abstract',
    label: '정부24 · 주민등록초본',
    icon: '🏛',
    mockLatencyMs: 1200,
  },
  'court-family-relation': {
    id: 'court-family-relation',
    label: '대법원 · 가족관계등록부',
    icon: '⚖️',
    mockLatencyMs: 1400,
  },
  'hometax-income-proof': {
    id: 'hometax-income-proof',
    label: '홈택스 · 소득금액증명원',
    icon: '📄',
    mockLatencyMs: 1600,
  },
  'hometax-wage-statement': {
    id: 'hometax-wage-statement',
    label: '홈택스 · 근로소득 지급명세서',
    icon: '📄',
    mockLatencyMs: 1500,
  },
  'hometax-tax-payment': {
    id: 'hometax-tax-payment',
    label: '홈택스 · 납세증명서',
    icon: '📄',
    mockLatencyMs: 1300,
  },
  'nhis-qualification': {
    id: 'nhis-qualification',
    label: '건강보험 · 자격득실확인서',
    icon: '💊',
    mockLatencyMs: 1100,
  },
  'wetax-local-assessment': {
    id: 'wetax-local-assessment',
    label: '위택스 · 지방세 부과내역',
    icon: '🏛',
    mockLatencyMs: 1200,
  },
  'gov24-vehicle': {
    id: 'gov24-vehicle',
    label: '정부24 · 자동차등록원부',
    icon: '🚗',
    mockLatencyMs: 1300,
  },

  // 금융 (재산·부채)
  'bank-accounts': {
    id: 'bank-accounts',
    label: '은행 · 보유계좌',
    icon: '🏦',
    mockLatencyMs: 1800,
  },
  'bank-loans': {
    id: 'bank-loans',
    label: '은행 · 대출 거래내역',
    icon: '🏦',
    mockLatencyMs: 2000,
  },
  'savings-accounts': {
    id: 'savings-accounts',
    label: '저축은행 · 보유계좌',
    icon: '🏦',
    mockLatencyMs: 1700,
  },
  'card-list': {
    id: 'card-list',
    label: '카드 · 보유카드',
    icon: '💳',
    mockLatencyMs: 1500,
  },
  'insurance-list': {
    id: 'insurance-list',
    label: '내보험다보여 · 계약정보',
    icon: '🛡',
    mockLatencyMs: 1400,
  },

  // 공공데이터포털 (무료)
  'land-value': {
    id: 'land-value',
    label: '국토부 · 공시가격',
    icon: '🏠',
    mockLatencyMs: 900,
  },

  // 계산·자동생성
  'calc-liquidation': {
    id: 'calc-liquidation',
    label: '자동계산 · 청산가치',
    icon: '🧮',
    mockLatencyMs: 400,
  },
  'calc-repayment': {
    id: 'calc-repayment',
    label: '자동계산 · 변제금',
    icon: '🧮',
    mockLatencyMs: 400,
  },
};

export function getSourceLabel(id: string): string {
  return SOURCE_CATALOG[id]?.label ?? id;
}

export function getSourceIcon(id: string): string {
  return SOURCE_CATALOG[id]?.icon ?? '🔗';
}
