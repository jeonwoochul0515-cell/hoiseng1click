/**
 * 전자소송(ecfs.scourt.go.kr) 필드 매핑 정의
 *
 * 회생클릭 데이터 → 전자소송 입력 필드 매핑 테이블
 * 전자소송 시스템의 개인회생 신청서 입력 양식 기준
 */

// ─────────────────────────────────────────────────
// 1. 전자소송 필드 매핑
// ─────────────────────────────────────────────────

export interface EcfsField {
  /** 전자소송 화면상 라벨 */
  ecfsLabel: string;
  /** 전자소송 화면상 위치 설명 */
  ecfsLocation: string;
  /** 회생클릭 데이터 경로 (dot notation) */
  dataPath: string;
  /** 값 변환 함수 키 */
  formatter?: 'krw' | 'phone' | 'maskSsn' | 'fullSsn' | 'date' | 'percent' | 'number' | 'none';
  /** 복사 시 사용할 값 (포맷 없는 원본) */
  copyRaw?: boolean;
  /** 안내 메시지 */
  hint?: string;
  /** 전자소송 입력 필드 유형 */
  inputType: 'text' | 'select' | 'textarea' | 'file';
}

/** 사건기본정보 필드 (전자소송 양식 기준) */
export const CASE_BASIC_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '소득구분',
    ecfsLocation: '사건기본 > 사건정보 > 소득구분',
    dataPath: 'client.incomeType',
    inputType: 'select',
    hint: '급여소득/영업소득/급여+영업소득 중 선택',
  },
  {
    ecfsLabel: '변제기간',
    ecfsLocation: '사건기본 > 사건정보 > 변제기간',
    dataPath: 'client.repayPeriodMonths',
    formatter: 'number',
    inputType: 'text',
    hint: '60개월 초과 불가',
  },
  {
    ecfsLabel: '변제시작일자',
    ecfsLocation: '사건기본 > 사건정보 > 변제시작일자',
    dataPath: 'client.repayStartDate',
    formatter: 'date',
    inputType: 'text',
    hint: '신청일로부터 2~3개월 후 이내',
  },
  {
    ecfsLabel: '월변제일자',
    ecfsLocation: '사건기본 > 사건정보 > 월변제일자',
    dataPath: 'client.repayDayOfMonth',
    formatter: 'number',
    inputType: 'text',
    hint: '1~28 권장 (말일 피함)',
  },
  {
    ecfsLabel: '월변제금액',
    ecfsLocation: '사건기본 > 사건정보 > 월변제금액',
    dataPath: 'client.monthlyPaymentOverride',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
    hint: '월평균수입 − 월평균생계비',
  },
  {
    ecfsLabel: '환급은행',
    ecfsLocation: '사건기본 > 사건정보 > 환급은행',
    dataPath: 'client.refundBank',
    inputType: 'select',
  },
  {
    ecfsLabel: '환급계좌번호',
    ecfsLocation: '사건기본 > 사건정보 > 환급계좌번호',
    dataPath: 'client.refundAccount',
    inputType: 'text',
    hint: "'-' 없이 숫자만 입력",
  },
  {
    ecfsLabel: '예금주',
    ecfsLocation: '사건기본 > 사건정보 > 예금주',
    dataPath: 'client.refundAccountHolder',
    inputType: 'text',
  },
  {
    ecfsLabel: '제출법원',
    ecfsLocation: '사건기본 > 사건정보 > 제출법원',
    dataPath: 'client.court',
    inputType: 'select',
    hint: '신청인의 보통재판적 소재지(주소지) 관할 지방법원',
  },
];

/** 신청인(채무자) 기본정보 필드 — 전자소송 당사자목록 양식 기준 */
export const APPLICANT_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '당사자구분',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 당사자구분',
    dataPath: 'const:채무자',
    inputType: 'text',
    hint: '채무자 고정',
  },
  {
    ecfsLabel: '인격구분',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 인격구분',
    dataPath: 'const:자연인',
    inputType: 'select',
    hint: '자연인 고정',
  },
  {
    ecfsLabel: '국적',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 국적',
    dataPath: 'client.nationality',
    inputType: 'select',
    hint: '기본 한국',
  },
  {
    ecfsLabel: '주민등록번호',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 주민등록번호',
    dataPath: 'client.ssn',
    formatter: 'fullSsn',
    inputType: 'text',
    hint: '앞/뒷 7자리 분리 입력. "제출문서에 보임" 체크 권장',
  },
  {
    ecfsLabel: '이름',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 이름',
    dataPath: 'client.name',
    inputType: 'text',
    hint: '명란에 주민번호·생년월일 입력 금지',
  },
  {
    ecfsLabel: '외국어이름',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 외국어이름',
    dataPath: 'client.nameForeign',
    inputType: 'text',
    hint: '외국인/법인인 경우에만',
  },
  {
    ecfsLabel: '주민등록지 주소',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 주민등록지 주소',
    dataPath: 'client.residentAddress',
    inputType: 'text',
    hint: '동·호수 등 + (동명, 아파트/건물명)',
  },
  {
    ecfsLabel: '실거주지 주소',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 실거주지 주소',
    dataPath: 'client.actualAddress',
    inputType: 'text',
    hint: '주민등록지와 같으면 "위 주소와 동일" 체크',
  },
  {
    ecfsLabel: '송달장소',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 송달장소',
    dataPath: 'client.deliveryAddress',
    inputType: 'text',
    hint: '주민등록지와 같으면 "위 주소와 동일" 체크',
  },
  {
    ecfsLabel: '휴대전화번호',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 연락처 > 휴대전화번호',
    dataPath: 'client.phone',
    formatter: 'phone',
    inputType: 'text',
    hint: '필수. 국가/지역코드 + 번호',
  },
  {
    ecfsLabel: '전화번호(선택)',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 연락처 > 전화번호',
    dataPath: 'client.tel',
    formatter: 'phone',
    inputType: 'text',
  },
  {
    ecfsLabel: '팩스번호(선택)',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 연락처 > 팩스번호',
    dataPath: 'client.fax',
    formatter: 'phone',
    inputType: 'text',
  },
  {
    ecfsLabel: '이메일',
    ecfsLocation: '당사자목록 > 당사자기본정보 > 이메일',
    dataPath: 'client.email',
    inputType: 'text',
  },
];

/** 관련사건목록 필드 */
export const RELATED_CASE_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '관계',
    ecfsLocation: '관련사건목록 > 관계',
    dataPath: 'relatedCase.relation',
    inputType: 'select',
    hint: '배우자/주채무자/보증채무자/연대채무자/기타',
  },
  {
    ecfsLabel: '관계인명',
    ecfsLocation: '관련사건목록 > 관계인명',
    dataPath: 'relatedCase.relationName',
    inputType: 'text',
  },
  {
    ecfsLabel: '제출법원',
    ecfsLocation: '관련사건목록 > 제출법원',
    dataPath: 'relatedCase.court',
    inputType: 'select',
  },
  {
    ecfsLabel: '사건번호',
    ecfsLocation: '관련사건목록 > 사건번호',
    dataPath: 'relatedCase.caseNumber',
    inputType: 'text',
    hint: 'YYYY-구분-번호 형식',
  },
];

/** 신청취지·신청이유 */
export const APPLICATION_TEXT_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '신청취지',
    ecfsLocation: '신청취지 > 텍스트',
    dataPath: 'client.applicationPurpose',
    inputType: 'textarea',
    hint: '기본: 「신청인에 대하여 개인회생절차를 개시한다」라는 결정을 구합니다.',
  },
  {
    ecfsLabel: '신청이유',
    ecfsLocation: '신청이유 > 리치텍스트',
    dataPath: 'client.applicationReason',
    inputType: 'textarea',
    hint: '2000자 이내',
  },
];

/** 채권자 정보 필드 (채권자별 반복) */
export const CREDITOR_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '채권자명(상호)',
    ecfsLocation: '채권자 목록 > 채권자 상호',
    dataPath: 'debt.creditor',
    inputType: 'text',
  },
  {
    ecfsLabel: '채무 유형',
    ecfsLocation: '채권자 목록 > 채무 유형',
    dataPath: 'debt.type',
    inputType: 'select',
    hint: '무담보/담보/사채 중 선택',
  },
  {
    ecfsLabel: '채권 금액',
    ecfsLocation: '채권자 목록 > 원금',
    dataPath: 'debt.amount',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
    hint: '숫자만 입력 (원 단위)',
  },
  {
    ecfsLabel: '이자율',
    ecfsLocation: '채권자 목록 > 이자율',
    dataPath: 'debt.rate',
    formatter: 'percent',
    inputType: 'text',
  },
  {
    ecfsLabel: '월 상환액',
    ecfsLocation: '채권자 목록 > 월 변제액',
    dataPath: 'debt.monthly',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
];

/** 재산 정보 필드 (재산별 반복) */
export const ASSET_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '재산 명칭',
    ecfsLocation: '재산 목록 > 재산명',
    dataPath: 'asset.name',
    inputType: 'text',
  },
  {
    ecfsLabel: '재산 유형',
    ecfsLocation: '재산 목록 > 종류',
    dataPath: 'asset.type',
    inputType: 'select',
    hint: '부동산/차량/예금/보험/증권/기타',
  },
  {
    ecfsLabel: '평가액(시가)',
    ecfsLocation: '재산 목록 > 시가(감정가)',
    dataPath: 'asset.rawValue',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
    hint: '공시가격 또는 감정가 기준',
  },
  {
    ecfsLabel: '청산가치',
    ecfsLocation: '재산 목록 > 청산가치',
    dataPath: 'asset.value',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
    hint: '환가율 적용 후 순가치',
  },
  {
    ecfsLabel: '담보권 설정액',
    ecfsLocation: '재산 목록 > 담보채무',
    dataPath: 'asset.mortgage',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
];

/** 수입 정보 필드 */
export const INCOME_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '월 급여소득',
    ecfsLocation: '수입지출 목록 > 근로소득',
    dataPath: 'client.income',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
  {
    ecfsLabel: '기타소득',
    ecfsLocation: '수입지출 목록 > 기타소득',
    dataPath: 'client.income2',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
  {
    ecfsLabel: '가구원 수',
    ecfsLocation: '수입지출 목록 > 세대원 수',
    dataPath: 'client.family',
    formatter: 'number',
    inputType: 'text',
  },
];

/** 지출 정보 필드 */
export const EXPENSE_FIELDS: EcfsField[] = [
  {
    ecfsLabel: '주거비(임차료)',
    ecfsLocation: '수입지출 목록 > 주거비',
    dataPath: 'client.rent',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
  {
    ecfsLabel: '교육비',
    ecfsLocation: '수입지출 목록 > 교육비',
    dataPath: 'client.education',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
  {
    ecfsLabel: '의료비',
    ecfsLocation: '수입지출 목록 > 의료비',
    dataPath: 'client.medical',
    formatter: 'number',
    copyRaw: true,
    inputType: 'text',
  },
];

// ─────────────────────────────────────────────────
// 2. 전자소송 첨부파일 매핑
// ─────────────────────────────────────────────────

export interface EcfsAttachment {
  /** 전자소송 첨부서류 카테고리 */
  category: string;
  /** 전자소송 화면상 라벨 */
  ecfsLabel: string;
  /** 회생클릭 문서 타입 */
  docType: string;
  /** 법원 권장 파일명 형식 */
  recommendedFileName: string;
  /** 필수 여부 */
  required: boolean;
  /** 안내 */
  hint?: string;
}

export const ECFS_ATTACHMENTS: EcfsAttachment[] = [
  {
    category: '신청서류',
    ecfsLabel: '개인회생신청서',
    docType: 'application',
    recommendedFileName: '개인회생신청서.pdf',
    required: true,
  },
  {
    category: '신청서류',
    ecfsLabel: '채권자목록',
    docType: 'debt_list',
    recommendedFileName: '채권자목록.pdf',
    required: true,
  },
  {
    category: '신청서류',
    ecfsLabel: '재산목록',
    docType: 'asset_list',
    recommendedFileName: '재산목록.pdf',
    required: true,
  },
  {
    category: '신청서류',
    ecfsLabel: '수입및지출에관한목록',
    docType: 'income_list',
    recommendedFileName: '수입지출목록.pdf',
    required: true,
  },
  {
    category: '신청서류',
    ecfsLabel: '변제계획안',
    docType: 'repay_plan',
    recommendedFileName: '변제계획안.pdf',
    required: true,
  },
  {
    category: '신청서류',
    ecfsLabel: '진술서',
    docType: 'statement',
    recommendedFileName: '진술서.pdf',
    required: true,
  },
  {
    category: '부가신청서',
    ecfsLabel: '금지명령 신청서',
    docType: 'prohibition_order',
    recommendedFileName: '금지명령신청서.pdf',
    required: false,
    hint: '개시결정 전 강제집행 금지 — 개시신청과 함께 제출 권장',
  },
  {
    category: '부가신청서',
    ecfsLabel: '중지명령 신청서',
    docType: 'suspension_order',
    recommendedFileName: '중지명령신청서.pdf',
    required: false,
    hint: '이미 진행 중인 강제집행·압류 중지 — 해당 시에만',
  },
  {
    category: '부가신청서',
    ecfsLabel: '면제재산결정 신청서',
    docType: 'exemption_decision',
    recommendedFileName: '면제재산결정신청서.pdf',
    required: false,
    hint: '압류금지 기본 외 추가 면제재산 신청 — 해당 시에만',
  },
  {
    category: '첨부서류',
    ecfsLabel: '주민등록등본',
    docType: 'resident_cert',
    recommendedFileName: '주민등록등본.pdf',
    required: true,
    hint: '세대원 전체, 주소변동 포함',
  },
  {
    category: '첨부서류',
    ecfsLabel: '가족관계증명서',
    docType: 'family_cert',
    recommendedFileName: '가족관계증명서.pdf',
    required: true,
    hint: '상세증명서',
  },
  {
    category: '첨부서류',
    ecfsLabel: '소득금액증명원',
    docType: 'income_cert',
    recommendedFileName: '소득금액증명원.pdf',
    required: true,
    hint: '최근 3년분',
  },
  {
    category: '첨부서류',
    ecfsLabel: '부채증명서',
    docType: 'debt_cert',
    recommendedFileName: '부채증명서_[기관명].pdf',
    required: true,
    hint: '각 금융기관별 발급',
  },
  {
    category: '첨부서류',
    ecfsLabel: '재직증명서',
    docType: 'employment_cert',
    recommendedFileName: '재직증명서.pdf',
    required: true,
  },
  {
    category: '첨부서류',
    ecfsLabel: '납세증명서(국세)',
    docType: 'tax_cert_national',
    recommendedFileName: '납세증명서_국세.pdf',
    required: false,
  },
  {
    category: '첨부서류',
    ecfsLabel: '납세증명서(지방세)',
    docType: 'tax_cert_local',
    recommendedFileName: '납세증명서_지방세.pdf',
    required: false,
  },
];

// ─────────────────────────────────────────────────
// 3. 법원 권장 파일명 생성
// ─────────────────────────────────────────────────

const DOC_TYPE_FILENAMES: Record<string, string> = {
  application: '개인회생신청서',
  debt_list: '채권자목록',
  asset_list: '재산목록',
  income_list: '수입지출목록',
  repay_plan: '변제계획안',
  statement: '진술서',
  prohibition_order: '금지명령신청서',
  suspension_order: '중지명령신청서',
  exemption_decision: '면제재산결정신청서',
};

/**
 * 법원 권장 파일명 형식으로 변환
 * 형식: [서류명]_[신청인성명].pdf
 * 예: 채권자목록_홍길동.pdf
 */
export function generateCourtFileName(
  docType: string,
  clientName: string,
  format: 'pdf' | 'docx' | 'hwpx' = 'pdf',
): string {
  const baseName = DOC_TYPE_FILENAMES[docType] || docType;
  const safeName = clientName.replace(/[^가-힣a-zA-Z0-9]/g, '');
  return `${baseName}_${safeName}.${format}`;
}

/**
 * 부채증명서 등 기관별 첨부서류 파일명 생성
 * 형식: [서류명]_[기관명]_[신청인성명].pdf
 */
export function generateCertFileName(
  certType: string,
  institution: string,
  clientName: string,
): string {
  const safeName = clientName.replace(/[^가-힣a-zA-Z0-9]/g, '');
  const safeInst = institution.replace(/[^가-힣a-zA-Z0-9]/g, '');
  return `${certType}_${safeInst}_${safeName}.pdf`;
}

// ─────────────────────────────────────────────────
// 4. 전자소송 제출 체크리스트
// ─────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  category: 'preparation' | 'documents' | 'attachments' | 'payment' | 'submission';
  label: string;
  description: string;
  /** 자동 완료 가능 여부 (회생클릭 데이터로 확인 가능) */
  autoCheckable: boolean;
  /** 외부 링크 */
  url?: string;
  /** 예상 소요 시간 */
  estimatedMinutes?: number;
}

export const ECFS_CHECKLIST: ChecklistItem[] = [
  // 사전 준비
  {
    id: 'ecfs_signup',
    category: 'preparation',
    label: '전자소송 회원가입',
    description: 'ecfs.scourt.go.kr 에서 회원가입 (공동인증서 필요)',
    autoCheckable: false,
    url: 'https://ecfs.scourt.go.kr',
    estimatedMinutes: 10,
  },
  {
    id: 'ecfs_cert',
    category: 'preparation',
    label: '공동인증서(구 공인인증서) 준비',
    description: '은행/범용 공동인증서가 필요합니다. 금융기관에서 무료 발급 가능',
    autoCheckable: false,
    estimatedMinutes: 5,
  },
  {
    id: 'ecfs_login',
    category: 'preparation',
    label: '전자소송 로그인',
    description: '공동인증서로 로그인 후 [서류제출] > [민사] > [개인회생] 선택',
    autoCheckable: false,
    url: 'https://ecfs.scourt.go.kr',
    estimatedMinutes: 3,
  },

  // 신청서 입력
  {
    id: 'court_select',
    category: 'documents',
    label: '관할법원 선택',
    description: '주소지 기준 관할법원을 선택합니다',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'applicant_input',
    category: 'documents',
    label: '신청인 정보 입력',
    description: '성명, 주민등록번호, 주소, 전화번호 등 기본 정보 입력',
    autoCheckable: true,
    estimatedMinutes: 3,
  },
  {
    id: 'case_type_select',
    category: 'documents',
    label: '사건 종류 선택',
    description: '"개인회생" 선택',
    autoCheckable: false,
    estimatedMinutes: 1,
  },

  // 첨부 서류
  {
    id: 'attach_application',
    category: 'attachments',
    label: '신청서 파일 첨부',
    description: '자동 생성된 개인회생신청서 PDF 업로드',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'attach_debt_list',
    category: 'attachments',
    label: '채권자목록 파일 첨부',
    description: '자동 생성된 채권자목록 PDF 업로드',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'attach_asset_list',
    category: 'attachments',
    label: '재산목록 파일 첨부',
    description: '자동 생성된 재산목록 PDF 업로드',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'attach_income_list',
    category: 'attachments',
    label: '수입지출목록 파일 첨부',
    description: '자동 생성된 수입지출목록 PDF 업로드',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'attach_repay_plan',
    category: 'attachments',
    label: '변제계획안 파일 첨부',
    description: '자동 생성된 변제계획안 PDF 업로드',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'attach_statement',
    category: 'attachments',
    label: '진술서 파일 첨부',
    description: '자동 생성된 진술서 PDF 업로드',
    autoCheckable: true,
    estimatedMinutes: 1,
  },
  {
    id: 'attach_supporting',
    category: 'attachments',
    label: '첨부서류 업로드',
    description: '주민등록등본, 소득금액증명원, 부채증명서 등',
    autoCheckable: false,
    estimatedMinutes: 5,
  },

  // 납부
  {
    id: 'stamp_fee',
    category: 'payment',
    label: '인지대 납부',
    description: '30,000원 (전자소송은 10% 할인 = 27,000원)',
    autoCheckable: false,
    estimatedMinutes: 3,
  },
  {
    id: 'service_fee',
    category: 'payment',
    label: '송달료 납부',
    description: '채권자 수 x 5,200원 x 15회분 (전자송달 동의 시 감면)',
    autoCheckable: false,
    estimatedMinutes: 3,
  },

  // 최종 제출
  {
    id: 'final_review',
    category: 'submission',
    label: '입력내용 최종 확인',
    description: '모든 입력값과 첨부파일을 다시 한번 확인',
    autoCheckable: false,
    estimatedMinutes: 5,
  },
  {
    id: 'submit',
    category: 'submission',
    label: '전자서명 후 제출',
    description: '공동인증서로 전자서명하여 최종 제출',
    autoCheckable: false,
    estimatedMinutes: 2,
  },
  {
    id: 'confirm_receipt',
    category: 'submission',
    label: '접수번호 확인 및 보관',
    description: '제출 완료 후 접수번호(사건번호)를 반드시 기록',
    autoCheckable: false,
    estimatedMinutes: 1,
  },
];

// ─────────────────────────────────────────────────
// 5. 보정명령 유형 정의
// ─────────────────────────────────────────────────

export interface CorrectionOrderType {
  id: string;
  label: string;
  description: string;
  /** 자동 대응 가능 여부 */
  autoResolvable: boolean;
  /** 대응에 필요한 서류 */
  requiredDocs: string[];
  /** 평균 대응 기한 (일) */
  deadlineDays: number;
}

export const CORRECTION_ORDER_TYPES: CorrectionOrderType[] = [
  {
    id: 'debt_amount_mismatch',
    label: '채권 금액 불일치',
    description: '채권자목록의 금액과 부채증명서 금액이 다른 경우',
    autoResolvable: true,
    requiredDocs: ['debt_list', 'debt_cert'],
    deadlineDays: 14,
  },
  {
    id: 'missing_cert',
    label: '증명서 미제출',
    description: '일부 채권자의 부채증명서가 누락된 경우',
    autoResolvable: false,
    requiredDocs: ['debt_cert'],
    deadlineDays: 14,
  },
  {
    id: 'income_proof',
    label: '소득 증빙 보완',
    description: '소득금액증명원, 재직증명서 등 추가 제출 요구',
    autoResolvable: false,
    requiredDocs: ['income_cert', 'employment_cert'],
    deadlineDays: 14,
  },
  {
    id: 'asset_valuation',
    label: '재산 평가 보완',
    description: '부동산 감정서, 차량 시세표 등 재산 평가 근거 보완',
    autoResolvable: true,
    requiredDocs: ['asset_list'],
    deadlineDays: 14,
  },
  {
    id: 'repay_plan_revision',
    label: '변제계획안 수정',
    description: '변제금액 산정 오류 또는 변제율 조정 요구',
    autoResolvable: true,
    requiredDocs: ['repay_plan'],
    deadlineDays: 14,
  },
  {
    id: 'statement_supplement',
    label: '진술서 보완',
    description: '채무 경위, 재산 변동 등 진술 내용 보완 요구',
    autoResolvable: false,
    requiredDocs: ['statement'],
    deadlineDays: 14,
  },
  {
    id: 'form_error',
    label: '양식 오류 정정',
    description: '기재 오류, 누락 사항 등 양식상 문제',
    autoResolvable: true,
    requiredDocs: [],
    deadlineDays: 7,
  },
];

// ─────────────────────────────────────────────────
// 6. 전자소송 제출 단계 안내
// ─────────────────────────────────────────────────

export interface EcfsGuideStep {
  step: number;
  title: string;
  description: string;
  /** 전자소송 화면 경로 */
  ecfsPath: string;
  /** 이 단계에서 복사할 필드 그룹 */
  fieldGroup?: 'applicant' | 'creditors' | 'assets' | 'income' | 'expenses';
  /** 상세 안내 텍스트 */
  details: string[];
  /** 예상 소요 시간 (분) */
  estimatedMinutes: number;
}

export const ECFS_GUIDE_STEPS: EcfsGuideStep[] = [
  {
    step: 1,
    title: '전자소송 로그인',
    description: '전자소송 사이트에 접속하여 공동인증서로 로그인합니다.',
    ecfsPath: 'ecfs.scourt.go.kr > 로그인',
    details: [
      'ecfs.scourt.go.kr 접속',
      '공동인증서(구 공인인증서)로 로그인',
      '처음이라면 회원가입 먼저 진행 (약 10분)',
      'Internet Explorer 또는 Edge 브라우저 권장',
    ],
    estimatedMinutes: 5,
  },
  {
    step: 2,
    title: '사건 접수 시작',
    description: '개인회생 신청을 위한 새 사건을 접수합니다.',
    ecfsPath: '서류제출 > 민사신청 > 개인회생 > 개인회생신청',
    details: [
      '상단 메뉴에서 [서류제출] 클릭',
      '[민사신청] > [회생/파산] > [개인회생] 순서로 선택',
      '[개인회생신청] 클릭',
      '관할법원을 선택 (아래 복사 버튼 활용)',
    ],
    fieldGroup: 'applicant',
    estimatedMinutes: 3,
  },
  {
    step: 3,
    title: '신청인 정보 입력',
    description: '신청인(채무자) 기본 정보를 입력합니다.',
    ecfsPath: '신청인 정보 입력 화면',
    fieldGroup: 'applicant',
    details: [
      '아래 [복사] 버튼을 눌러 각 항목을 붙여넣으세요',
      '성명 → 주민등록번호 → 주소 → 전화번호 순서로 입력',
      '주소는 주민등록등본과 동일해야 합니다',
    ],
    estimatedMinutes: 3,
  },
  {
    step: 4,
    title: '신청서류 첨부',
    description: '자동 생성된 서류 6종을 PDF로 변환하여 첨부합니다.',
    ecfsPath: '첨부서류 업로드 화면',
    details: [
      '아래에서 [PDF 다운로드] 버튼으로 각 서류를 받으세요',
      '전자소송 화면의 [파일 첨부] > [찾아보기]로 업로드',
      '파일당 최대 50MB, 서류별로 하나씩 첨부',
      '파일명은 자동으로 법원 권장 형식으로 설정됩니다',
    ],
    estimatedMinutes: 5,
  },
  {
    step: 5,
    title: '증빙서류 첨부',
    description: '주민등록등본, 소득증명원 등 증빙서류를 첨부합니다.',
    ecfsPath: '첨부서류 업로드 화면 > 증빙서류',
    details: [
      '이미 업로드한 증빙서류를 여기서 첨부합니다',
      '각 서류를 해당 카테고리에 맞게 분류하여 첨부',
      '부채증명서는 금융기관별로 각각 첨부',
    ],
    estimatedMinutes: 5,
  },
  {
    step: 6,
    title: '인지대/송달료 납부',
    description: '인지대와 송달료를 전자납부합니다.',
    ecfsPath: '납부 화면',
    details: [
      '인지대: 27,000원 (전자소송 할인 적용, 원래 30,000원)',
      '송달료: 채권자 수에 따라 자동 계산',
      '신용카드, 계좌이체, 가상계좌 납부 가능',
      '납부 후 영수증 화면 캡처 권장',
    ],
    estimatedMinutes: 5,
  },
  {
    step: 7,
    title: '최종 확인 및 제출',
    description: '모든 내용을 확인하고 전자서명으로 제출합니다.',
    ecfsPath: '제출 확인 화면',
    details: [
      '입력한 모든 정보와 첨부파일 목록을 재확인',
      '[제출] 버튼 클릭 후 공동인증서로 전자서명',
      '제출 완료 화면에서 접수번호(사건번호) 확인',
      '접수번호를 반드시 메모하거나 캡처해 두세요',
    ],
    estimatedMinutes: 3,
  },
];

// ─────────────────────────────────────────────────
// 7. 유틸리티 함수
// ─────────────────────────────────────────────────

/** 전자소송 인지대 계산 (전자소송 10% 할인 적용) */
export function calcStampFee(): { original: number; discounted: number } {
  return { original: 30000, discounted: 27000 };
}

/** 전자소송 송달료 계산 */
export function calcServiceFee(creditorCount: number): number {
  const perCreditor = 5200;
  const rounds = 15;
  return creditorCount * perCreditor * rounds;
}

/** 총 제출 비용 계산 */
export function calcTotalFilingCost(creditorCount: number): {
  stampFee: number;
  serviceFee: number;
  total: number;
} {
  const stamp = calcStampFee();
  const service = calcServiceFee(creditorCount);
  return {
    stampFee: stamp.discounted,
    serviceFee: service,
    total: stamp.discounted + service,
  };
}
