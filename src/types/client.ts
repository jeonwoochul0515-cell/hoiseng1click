export type ClientStatus = 'new' | 'contacted' | 'collecting' | 'drafting' | 'submitted' | 'approved';
export type JobType = 'employed' | 'self' | 'freelance' | 'daily' | 'unemployed';
export type DebtType = '무담보' | '담보' | '사채';
export type AssetType = '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';

export interface Debt {
  id: string;
  name: string;
  creditor: string;
  type: DebtType;
  amount: number;
  rate: number;
  monthly: number;
  source: 'codef' | 'manual' | 'pdf';
  originalDate?: string;
  originalAmount?: number;
  overdueInterest?: number;
  accelerationDate?: string;
  collateral?: string;
  creditorAddress?: string;
  creditorPhone?: string;
  creditorFax?: string;
  transferredFrom?: string;  // 원 채권자 (채권양도된 경우)
  transferDate?: string;     // 양도일

  // 보증채무
  isGuarantee?: boolean;        // 보증채무 여부
  guaranteeType?: '연대보증' | '일반보증' | '근보증';
  primaryDebtor?: string;       // 주채무자 이름
  primaryDebtorSSN?: string;    // 주채무자 주민번호

  // 소멸시효 관련
  lastPaymentDate?: string;     // 마지막 변제일 (YYYY-MM-DD)
  debtCategory?: '일반채권' | '상사채권' | '카드채무' | '대출채무' | '사채' | '판결채권' | '세금';

  // 이자/지연손해금 자동 계산
  overdueStartDate?: string;    // 연체 기산일 (YYYY-MM-DD)
  interestType?: '약정이율' | '법정이율' | '상사법정이율';  // 이율 유형

  // 비면책채권
  isNonDischargeable?: boolean;  // 비면책채권 여부
  nonDischargeReason?: '조세' | '벌금' | '양육비' | '불법행위' | '근로채권' | '누락채권';

  // 별제권 관련 (담보채권)
  collateralType?: '주택' | '차량' | '기타';    // 담보물 종류
  collateralValue?: number;                      // 담보물 시가
  collateralDesc?: string;                       // 담보물 설명 (주소, 차종 등)
  seniorLien?: number;                           // 선순위 설정액
  separateSecurityAmount?: number;               // 별제권 행사 예상액 (자동 계산)
  deficiencyAmount?: number;                     // 부족액 (자동 계산, 일반채권 전환분)

  // 대위변제
  hasSubrogation?: boolean;        // 대위변제 여부
  subrogationAmount?: number;      // 대위변제 금액
  subrogationCreditor?: string;    // 대위변제자 (구상채권자)
  subrogationDate?: string;        // 대위변제일

  // 구상채권
  isSubrogationClaim?: boolean;     // 이 채무가 구상채권인지
  originalCreditor?: string;       // 원 채권자 (구상채권의 경우)
  originalDebtAmount?: number;     // 원 채무 금액
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  rawValue: number;
  liquidationRate: number;
  mortgage: number;
  value: number;
  source: 'codef' | 'api' | 'api_trade' | 'manual' | 'internal_db' | 'simulation' | 'sandbox' | 'codef_no_data';
  meta?: {
    plate?: string;
    year?: number;
    address?: string;
    area?: number;
    model?: string;
    mileage?: number;
    bankName?: string;
    accountLast4?: string;
    insurerName?: string;
    insuranceType?: string;
    surrenderValue?: number;
    brokerName?: string;
    stockName?: string;
    valuationBasis?: string;
  };
}

export interface FamilyMember {
  relation: '배우자' | '자녀' | '부모' | '형제' | '기타';
  name: string;
  age: number;
  hasIncome: boolean;
  isDependent: boolean;  // 실제 부양 여부
  specialNeeds?: '미성년' | '장애' | '노인' | '질병';
}

// 진술서 관련 타입
export interface StatementNewDebt {
  creditor: string;
  type: string;
  amount: number;
  date: string;
  memo: string;
}

export interface StatementTransfer {
  account: string;
  date: string;
  amount: number;
  recipient: string;
  relation: string;
  reason: string;
}

export interface StatementCashWithdrawal {
  account: string;
  date: string;
  amount: number;
  usage: string;
}

export interface StatementCardUsage {
  cardNo: string;
  date: string;
  amount: number;
  merchant: string;
  memo: string;
}

export interface StatementCancelledInsurance {
  company: string;
  name: string;
  monthlyPremium: number;
  refundAmount: number;
  status: string;
}

export interface StatementInvestmentLoss {
  item: string;
  period: string;
  investAmount: number;
  lossAmount: number;
}

export interface StatementData {
  debtHistory?: string;
  propertyChanges2yr?: string;
  newDebts1yr?: StatementNewDebt[];
  largeTransfers?: StatementTransfer[];
  cashWithdrawals?: StatementCashWithdrawal[];
  largeCardUsage?: StatementCardUsage[];
  cancelledInsurance?: StatementCancelledInsurance[];
  investmentLosses?: StatementInvestmentLoss[];
  gamblingLosses?: StatementInvestmentLoss[];
  divorced2yr?: boolean;
  divorceDetail?: string;
  jobChange1yr?: boolean;
  jobChangeDetail?: string;
  garnishment?: boolean;
  garnishmentDetail?: string;
  priorApplication?: boolean;
  priorApplicationDetail?: string;
  creditEducation?: boolean;
  repayWillingness?: string;
}

export interface Client {
  id: string;
  name: string;
  ssn: string;
  ssnEncrypted?: string;
  ssnMasked?: string;
  phone: string;
  address: string;
  zonecode?: string;
  job: string;
  jobType: JobType;
  family: number;
  court: string;
  income: number;
  income2: number;
  rent: number;
  education: number;
  medical: number;
  status: ClientStatus;
  collectionDone: boolean;
  connectedId?: string;
  debts: Debt[];
  assets: Asset[];
  memo: string;
  intakeSubmissionId?: string;
  fee?: number;
  feeInstallment?: boolean;
  feeInstallmentMonths?: number;
  feePaidAmount?: number;
  createdAt: Date | { toDate(): Date };
  updatedAt: Date | { toDate(): Date };
  // 개시신청서
  caseNumber?: string;
  debtReason?: string;
  repayPeriodMonths?: number;
  // 수입지출 상세
  food?: number;
  transport?: number;
  telecom?: number;
  insurancePremium?: number;
  // 가족 상세
  familyMembers?: FamilyMember[];
  // 자영업자 소득 산정
  selfEmployedIncome?: {
    revenue1: number;   // 최근 1년차 연간 매출
    revenue2: number;   // 최근 2년차 연간 매출
    expense1: number;   // 최근 1년차 연간 경비
    expense2: number;   // 최근 2년차 연간 경비
    taxReportIncome?: number; // 종합소득세 신고 기준 소득
  };
  // 라이프니츠 현재가치 (청산가치 페이지)
  leibniz?: {
    retirementWage?: number;
    yearsWorked?: number;
    yearsUntilRetirement?: number;
    depositAmount?: number;
    depositYears?: number;
  };
  // 우선채권 공제
  priorityClaims?: {
    taxDelinquent?: number;
    wageClaim?: number;
    smallDeposit?: number;
  };
  // 진술서
  statement?: StatementData;
}
