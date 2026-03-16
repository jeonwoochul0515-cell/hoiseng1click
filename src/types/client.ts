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
  source: 'codef' | 'manual';
  originalDate?: string;
  originalAmount?: number;
  overdueInterest?: number;
  accelerationDate?: string;
  collateral?: string;
  creditorAddress?: string;
  creditorPhone?: string;
  creditorFax?: string;
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
  relation: string;
  name: string;
  age: number;
  hasIncome: boolean;
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
