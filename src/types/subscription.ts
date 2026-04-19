export type PlanType = 'starter' | 'pro' | 'enterprise';
export type IndividualPlanType = 'self' | 'self_plus' | 'full';
export type PlanId = PlanType | IndividualPlanType;

export interface PlanConfig {
  name: string;
  price: number;
  yearlyPrice: number;
  maxClientsPerMonth: number;  // 월 서류 생성 가능 의뢰인 수
  maxUsers: number;
  hasHwpx: boolean;
  hasLiquidation: boolean;
  hasAiStatement: boolean;     // AI 진술서
  hasApi: boolean;
  features: string[];
}

export interface IndividualPlanConfig {
  name: string;
  price: number;
  priceLabel: string;
  isSubscription: false;
  features: string[];
  validDays: number;
  maxDocRegens: number;
  hasLawyerChat: boolean;
  lawyerChatCount?: number;
  hasLawyerCall: boolean;
  lawyerCallCount?: number;
  correctionGuides: number;
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  starter: {
    name: 'STARTER',
    price: 49000,
    yearlyPrice: 490000,
    maxClientsPerMonth: 10,
    maxUsers: Infinity,
    hasHwpx: true,
    hasLiquidation: false,
    hasAiStatement: false,
    hasApi: false,
    features: ['월 10명분 서류 생성', 'CODEF 수집', 'DOCX+HWPX', '전자소송 CSV', '사용자 무제한', '이메일 지원'],
  },
  pro: {
    name: 'PRO',
    price: 99000,
    yearlyPrice: 990000,
    maxClientsPerMonth: 50,
    maxUsers: Infinity,
    hasHwpx: true,
    hasLiquidation: true,
    hasAiStatement: true,
    hasApi: false,
    features: ['월 50명분 서류 생성', 'CODEF 수집', 'DOCX+HWPX', '전자소송 CSV', '사용자 무제한', '청산가치 리포트', 'AI 진술서 생성', '우선 지원'],
  },
  enterprise: {
    name: 'ENTERPRISE',
    price: 199000,
    yearlyPrice: 1990000,
    maxClientsPerMonth: Infinity,
    maxUsers: Infinity,
    hasHwpx: true,
    hasLiquidation: true,
    hasAiStatement: true,
    hasApi: true,
    features: ['서류 생성 무제한', 'CODEF 수집', 'DOCX+HWPX', '전자소송 CSV', '사용자 무제한', '청산가치 리포트', 'AI 진술서 생성', '전담 지원 + 온보딩', 'API 직접 연동'],
  },
};

export const INDIVIDUAL_PLAN_CONFIGS: Record<IndividualPlanType, IndividualPlanConfig> = {
  self: {
    name: 'SELF',
    price: 99000,
    priceLabel: '99,000원 (1회)',
    isSubscription: false,
    features: [
      'CODEF 금융데이터 자동 수집',
      '법원 제출 서류 5종 자동 생성',
      '서류 수정/재생성 3개월',
      '법원 접수 가이드',
      '첨부서류 체크리스트',
    ],
    validDays: 90,
    maxDocRegens: Infinity,
    hasLawyerChat: false,
    hasLawyerCall: false,
    correctionGuides: 0,
  },
  self_plus: {
    name: 'SELF+',
    price: 199000,
    priceLabel: '199,000원 (1회)',
    isSubscription: false,
    features: [
      'SELF 기능 전체 포함',
      '보정명령 대응 가이드 3회',
      '변호사 채팅 상담 5회',
      '변호사 1:1 통화 1회 (30분)',
      '서류 수정/재생성 6개월',
    ],
    validDays: 180,
    maxDocRegens: Infinity,
    hasLawyerChat: true,
    lawyerChatCount: 5,
    hasLawyerCall: true,
    lawyerCallCount: 1,
    correctionGuides: 3,
  },
  full: {
    name: 'FULL 수임',
    price: 1000000,
    priceLabel: '80~150만원 (상담 후)',
    isSubscription: false,
    features: [
      'SELF+ 기능 전체 포함',
      '변호사 무제한 상담',
      '법원 출석 대리',
      '채권자 이의 대응',
      '완료시까지 서류 관리',
    ],
    validDays: 365,
    maxDocRegens: Infinity,
    hasLawyerChat: true,
    lawyerChatCount: Infinity,
    hasLawyerCall: true,
    lawyerCallCount: Infinity,
    correctionGuides: Infinity,
  },
};
