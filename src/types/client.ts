export type ClientStatus = 'new' | 'contacted' | 'collecting' | 'drafting' | 'submitted' | 'approved';
export type JobType = 'employed' | 'self' | 'freelance' | 'daily' | 'unemployed';
export type DebtType = '무담보' | '담보' | '사채';
export type AssetType = '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';

// 전자소송 개인회생 개시신청서 — 사건기본정보 타입
export type IncomeType = 'salary' | 'business' | 'mixed'; // 급여/영업/혼합

// 관련사건 (배우자·주채무자·보증·연대채무자가 이미 신청한 경우)
export interface RelatedCase {
  id: string;
  relation: '배우자' | '주채무자' | '보증채무자' | '연대채무자' | '기타';
  relationName: string;          // 관계인명
  relationNameDetail?: string;   // 기타 관계 상세 (예: 자녀, 부모)
  court: string;                 // 제출법원
  caseYear: number;              // 사건번호 연도 (YYYY)
  caseType: string;              // 사건번호 구분 (개회, 하회 등)
  caseNumber: string;            // 사건번호 숫자
}

// 문서 공개(제출 문서 노출) 플래그
export interface DocVisibility {
  ssn?: boolean;         // 주민등록번호
  phone?: boolean;       // 휴대전화번호
  tel?: boolean;         // 전화번호
  fax?: boolean;         // 팩스
  email?: boolean;       // 이메일
}

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
  creditorAddress?: string;      // 도로명주소 기본
  creditorAddressDetail?: string; // 도로명주소 상세 (동·호수 등)
  creditorZipCode?: string;       // 우편번호 5자리 (전자소송 필수)
  creditorPhone?: string;
  creditorFax?: string;
  creditorMobile?: string;        // 휴대전화번호
  creditorEmail?: string;         // 이메일
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
  caseNumber?: string;           // YYYY-개회-XXXXX (전자소송 접수 후 부여)
  filingDate?: string;           // 개시신청 접수일 (YYYY-MM-DD) — 법원 이관 판정용
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

  // ── 전자소송 개인회생 개시신청서 양식 필드 ──
  // 사건기본정보
  incomeType?: IncomeType;              // 소득구분 (급여/영업/혼합)
  repayStartDate?: string;              // 변제시작일자 (YYYY-MM-DD)
  repayStartAfterAuthorization?: boolean; // 변제계획안 인가되는 날의 다음달 사용 여부
  repayDayOfMonth?: number;             // 월변제일자 (1~31)
  monthlyPaymentOverride?: number;      // 월변제금액 (수동 오버라이드, 없으면 자동계산)
  refundBank?: string;                  // 환급은행 (드롭다운)
  refundAccount?: string;               // 환급계좌번호 (하이픈 없음)
  refundAccountHolder?: string;         // 예금주

  // 당사자기본정보
  nationality?: string;                 // 국적 (기본 '한국')
  nameForeign?: string;                 // 외국어이름
  residentAddress?: string;             // 주민등록지 주소
  residentAddressDetail?: string;       // 주민등록지 상세주소
  residentZonecode?: string;            // 주민등록지 우편번호
  actualAddress?: string;               // 실거주지 주소 (주민등록지와 다를 경우)
  actualAddressDetail?: string;
  actualZonecode?: string;
  sameAsResident?: boolean;             // 실거주지 = 주민등록지 여부
  deliveryAddress?: string;             // 송달장소
  deliveryAddressDetail?: string;
  deliveryZonecode?: string;
  sameDeliveryAsResident?: boolean;     // 송달장소 = 주민등록지 여부
  tel?: string;                         // 일반 전화번호 (선택)
  fax?: string;                         // 팩스 (선택)
  email?: string;                       // 이메일
  docVisibility?: DocVisibility;        // 제출문서 노출 플래그

  // 관련사건목록
  relatedCases?: RelatedCase[];

  // 신청취지 / 신청이유
  applicationPurpose?: string;          // 신청취지 (기본값 템플릿)
  applicationReason?: string;           // 신청이유 (debtReason과 별개)
}
