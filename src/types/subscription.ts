export type PlanType = 'starter' | 'pro' | 'enterprise';

export interface PlanConfig {
  name: string;
  price: number;
  yearlyPrice: number;
  maxClients: number;
  maxDocsPerMonth: number;
  maxUsers: number;
  hasHwpx: boolean;
  hasLiquidation: boolean;
  hasApi: boolean;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  starter: {
    name: 'STARTER',
    price: 49000,
    yearlyPrice: 490000,
    maxClients: 30,
    maxDocsPerMonth: 50,
    maxUsers: 1,
    hasHwpx: false,
    hasLiquidation: false,
    hasApi: false,
    features: ['의뢰인 30명', '서류 50건/월', 'CODEF 수집', 'DOCX 출력', '사용자 1명', '이메일 지원'],
  },
  pro: {
    name: 'PRO',
    price: 99000,
    yearlyPrice: 990000,
    maxClients: 150,
    maxDocsPerMonth: Infinity,
    maxUsers: 3,
    hasHwpx: true,
    hasLiquidation: true,
    hasApi: false,
    features: ['의뢰인 150명', '서류 무제한', 'CODEF 수집', 'DOCX+HWPX', '사용자 3명', '우선 지원', '청산가치 리포트'],
  },
  enterprise: {
    name: 'ENTERPRISE',
    price: 199000,
    yearlyPrice: 1990000,
    maxClients: Infinity,
    maxDocsPerMonth: Infinity,
    maxUsers: Infinity,
    hasHwpx: true,
    hasLiquidation: true,
    hasApi: true,
    features: ['의뢰인 무제한', '서류 무제한', 'CODEF 수집', 'DOCX+HWPX', '사용자 무제한', '전담 지원 + 온보딩', '청산가치 리포트', 'API 직접 연동', '맞춤 서류 양식'],
  },
};
