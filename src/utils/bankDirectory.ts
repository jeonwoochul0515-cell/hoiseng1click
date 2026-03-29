/** 금융기관별 부채증명서 발급 정보 */

export interface BankCertInfo {
  name: string;
  type: 'bank' | 'card' | 'insurance' | 'savings' | 'public';
  url: string;
  certName: string;
  path: string;
  method: 'online' | 'app' | 'visit' | 'online+app';
  auth: string;
  fee: string;
  hours: string;
  note: string;
}

export const BANK_CERT_DIRECTORY: Record<string, BankCertInfo> = {
  // ── 은행 ──
  '국민은행': {
    name: '국민은행', type: 'bank',
    url: 'https://obank.kbstar.com',
    certName: '부채증명서',
    path: '개인뱅킹 > 뱅킹관리 > 제증명발급 > 부채증명서',
    method: 'online', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: '개인회생/파산용은 지점 방문이 필요할 수 있음. KB스타뱅킹 앱에서도 가능.',
  },
  '신한은행': {
    name: '신한은행', type: 'bank',
    url: 'https://bank.shinhan.com',
    certName: '부채증명서',
    path: '개인 > 부가서비스 > 증명서발급서비스 > 부채증명서',
    method: 'online+app', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: '신한 쏠(SOL) 앱에서도 발급 가능.',
  },
  '우리은행': {
    name: '우리은행', type: 'bank',
    url: 'https://spib.wooribank.com',
    certName: '여신증명서',
    path: '개인 > 뱅킹관리 > 증명서발급 > 여신증명서발급확인',
    method: 'online', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: '개인회생용 부채증명서는 영업점 방문 필요. 일반 금융거래확인서는 온라인 가능.',
  },
  '하나은행': {
    name: '하나은행', type: 'bank',
    url: 'https://www.kebhana.com',
    certName: '부채증명서',
    path: '전체메뉴 > My하나 > 증명서발급신청/조회',
    method: 'online+app', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: '하나원큐 앱에서도 가능. 개인회생용은 영업점 방문 권장.',
  },
  '농협': {
    name: '농협은행', type: 'bank',
    url: 'https://banking.nonghyup.com',
    certName: '부채증명원',
    path: '뱅킹관리 > 증명서 > 부채증명원 > 발급신청',
    method: 'online+app', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: 'NH스마트뱅킹 앱에서도 발급 가능.',
  },
  'IBK기업은행': {
    name: 'IBK기업은행', type: 'bank',
    url: 'https://mybank.ibk.co.kr',
    certName: '부채증명서',
    path: '개인뱅킹 > 뱅킹관리 > 증명서/결산자료 발급 > 부채증명서',
    method: 'online', auth: '공동인증서', fee: '무료', hours: '09:00~22:00',
    note: '',
  },
  'SC제일은행': {
    name: 'SC제일은행', type: 'bank',
    url: 'https://www.standardchartered.co.kr',
    certName: '부채잔액증명서',
    path: '증명서 및 보고서 > 인터넷증명서 발급서비스 > 부채잔액증명서',
    method: 'online', auth: '공동인증서', fee: '2,000원 (등급별 면제)', hours: '09:00~23:00',
    note: '개인회생/파산용은 영업점 방문 필요.',
  },
  '카카오뱅크': {
    name: '카카오뱅크', type: 'bank',
    url: 'https://www.kakaobank.com',
    certName: '부채증명서',
    path: '카카오뱅크 앱 > 더보기 > 증명서발급 > 부채증명서',
    method: 'app', auth: '앱 자체 인증', fee: '무료', hours: '24시간',
    note: '앱에서만 신청 가능. 이메일/팩스 수령.',
  },
  '토스뱅크': {
    name: '토스뱅크', type: 'bank',
    url: 'https://www.tossbank.com',
    certName: '대출잔액증명서',
    path: '토스 앱 > 고객센터 > 증명서 발급 > 토스뱅크 부채증명서',
    method: 'app', auth: '토스 앱 인증', fee: '무료', hours: '24시간',
    note: '팩스, 이메일, PDF 다운로드 가능.',
  },
  '케이뱅크': {
    name: '케이뱅크', type: 'bank',
    url: 'https://www.kbanknow.com',
    certName: '부채증명서',
    path: '앱/웹 > 고객센터 > 증명서발급 > 부채증명서',
    method: 'online+app', auth: '공동인증서 또는 앱 인증', fee: '무료', hours: '24시간',
    note: '앱과 홈페이지 모두 발급 가능.',
  },
  '수협은행': {
    name: '수협은행', type: 'bank',
    url: 'https://www.suhyup-bank.com',
    certName: '부채증명서',
    path: '인터넷뱅킹 > 뱅킹관리 > 증명서 > 부채증명서',
    method: 'online', auth: '공동인증서', fee: '확인 필요', hours: '09:00~22:00',
    note: '고객센터 1588-1515 확인 권장.',
  },
  // ── 카드 ──
  '삼성카드': {
    name: '삼성카드', type: 'card',
    url: 'https://www.samsungcard.com/personal/customer-service/smart-issue/UHPPCC1000M0.jsp',
    certName: '부채증명서/금융거래확인서',
    path: '고객서비스 > 스마트발급 > 부채증명서',
    method: 'online', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: 'PDF 다운로드/출력 가능.',
  },
  '현대카드': {
    name: '현대카드', type: 'card',
    url: 'https://www.hyundaicard.com',
    certName: '금융거래잔액확인서',
    path: 'My Account > 소득공제 및 서류발급 > 서류발급',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '이메일/팩스 수령 선택 가능.',
  },
  '롯데카드': {
    name: '롯데카드', type: 'card',
    url: 'https://www.lottecard.co.kr',
    certName: '부채증명서',
    path: '고객센터 > 제증명발급 > 부채증명서 발급신청',
    method: 'online', auth: '공동인증서', fee: '무료', hours: '24시간(신청)',
    note: '신청 후 3~5일 소요. 빠른 처리는 1588-8100 전화 신청.',
  },
  'BC카드': {
    name: 'BC카드', type: 'card',
    url: 'https://www.bccard.com',
    certName: '부채증명서',
    path: '고객센터 > 서류발급/조회',
    method: 'visit', auth: '공동인증서', fee: '확인 필요', hours: '확인 필요',
    note: '발급카드사(제휴은행)를 통해 발급. 고객센터 1588-4000 확인.',
  },
  'KB국민카드': {
    name: 'KB국민카드', type: 'card',
    url: 'https://card.kbcard.com',
    certName: '부채증명서(회생/파산용)',
    path: '서비스 > 기타서비스 > 부채증명서(회생 및 파산)',
    method: 'online', auth: '공동인증서', fee: '무료', hours: '24시간',
    note: '개인회생/파산용도 온라인 발급 가능 (카드사 중 가장 편리).',
  },
  '신한카드': {
    name: '신한카드', type: 'card',
    url: 'https://www.shinhancard.com',
    certName: '부채증명서/금융거래확인서',
    path: '고객센터 > 문서발송 > 금융거래확인서/부채증명서',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '신한플레이 앱에서도 가능.',
  },
  '우리카드': {
    name: '우리카드', type: 'card',
    url: 'https://pc.wooricard.com',
    certName: '금융거래확인서',
    path: '우리은행 인터넷뱅킹 > 증명서 발급 > 여신 증명서',
    method: 'online', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: '우리은행 인터넷뱅킹에서 카드 관련 여신증명서 통합 발급.',
  },
  '하나카드': {
    name: '하나카드', type: 'card',
    url: 'https://www.hanacard.co.kr',
    certName: '금융거래확인서',
    path: '고객센터 > 문서발송 > 금융거래확인서',
    method: 'online', auth: '본인인증', fee: '무료', hours: '24시간',
    note: '채무구분별 조회/발급 가능.',
  },
  'NH카드': {
    name: 'NH농협카드', type: 'card',
    url: 'https://card.nonghyup.com',
    certName: '부채증명원',
    path: '농협은행 인터넷뱅킹 > 뱅킹관리 > 증명서 > 부채증명원',
    method: 'online+app', auth: '공동인증서', fee: '무료', hours: '08:00~22:00',
    note: '농협은행과 통합 운영. NH스마트뱅킹 앱에서도 가능.',
  },
  // ── 보험 ──
  '삼성생명': {
    name: '삼성생명', type: 'insurance',
    url: 'https://www.samsunglife.com',
    certName: '해약환급금증명서',
    path: '마이페이지 > 내 보험 > 계약 상세 > 해약환급금 조회',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: 'PDF 저장/출력/이메일 가능. 보험계약대출이 있으면 대출잔액증명서도 필요.',
  },
  '한화생명': {
    name: '한화생명', type: 'insurance',
    url: 'https://www.hanwhalife.com',
    certName: '해약환급금증명서',
    path: '마이페이지 > 보험계약조회 > 해약환급금',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  '교보생명': {
    name: '교보생명', type: 'insurance',
    url: 'https://www.kyobo.com',
    certName: '해약환급금증명서',
    path: '마이페이지 > 계약조회 > 해약환급금 조회',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  '삼성화재': {
    name: '삼성화재', type: 'insurance',
    url: 'https://www.samsungfire.com',
    certName: '해약환급금증명서',
    path: '마이페이지 > 계약조회 > 해약환급금',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  '현대해상': {
    name: '현대해상', type: 'insurance',
    url: 'https://www.hi.co.kr',
    certName: '해약환급금증명서',
    path: '마이하이(MyHi) > 보험계약조회 > 해약환급금',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  'DB손해보험': {
    name: 'DB손해보험', type: 'insurance',
    url: 'https://www.directdb.co.kr',
    certName: '해약환급금증명서',
    path: '마이페이지 > 보험계약조회 > 해약환급금',
    method: 'online+app', auth: '공동인증서 필수', fee: '무료', hours: '24시간',
    note: '계약자와 피보험자가 동일한 계약만 가능.',
  },
  '메리츠화재': {
    name: '메리츠화재', type: 'insurance',
    url: 'https://www.meritzfire.com',
    certName: '해약환급금증명서',
    path: '마이페이지 > 계약조회 > 해약환급금',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  '흥국생명': {
    name: '흥국생명', type: 'insurance',
    url: 'https://www.heungkuklife.co.kr',
    certName: '해약환급금증명서',
    path: '마이페이지 > 내 보험조회',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  '미래에셋생명': {
    name: '미래에셋생명', type: 'insurance',
    url: 'https://life.miraeasset.com',
    certName: '해약환급금증명서',
    path: '마이페이지 > 계약조회',
    method: 'online+app', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '',
  },
  // ── 저축은행 ──
  'OK저축은행': {
    name: 'OK저축은행', type: 'savings',
    url: 'https://www.oksavingsbank.com',
    certName: '부채증명서',
    path: '저축은행중앙회 통합시스템 또는 앱 > 고객센터 > 증명서발급',
    method: 'online', auth: '공동인증서', fee: '본인확인 5,000원 + 발급수수료', hours: '09:00~18:00',
    note: '발급까지 5영업일 소요 가능.',
  },
  'SBI저축은행': {
    name: 'SBI저축은행', type: 'savings',
    url: 'https://www.sbisb.co.kr',
    certName: '부채증명서',
    path: '고객센터 > 증명서발급안내',
    method: 'online', auth: '공동인증서', fee: '확인 필요', hours: '09:00~18:00',
    note: '저축은행중앙회 소비자포털(fsb.or.kr)에서도 가능.',
  },
  // ── 공공/통합조회 ──
  '내보험다보여': {
    name: '내보험다보여', type: 'public',
    url: 'https://cont.insure.or.kr',
    certName: '보험가입내역조회',
    path: '본인인증 > 보험계약 통합조회',
    method: 'online', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '보험협회 운영. 모든 보험사 가입 내역을 한번에 조회 가능.',
  },
  '서민금융진흥원': {
    name: '서민금융진흥원', type: 'public',
    url: 'https://www.kinfa.or.kr',
    certName: '대부업이용현황조회',
    path: '서민금융포털 > 대부업 이용현황 조회',
    method: 'online', auth: '공동인증서 또는 본인인증', fee: '무료', hours: '24시간',
    note: '대부업체(사채) 이용 현황 통합 조회.',
  },
};

/** 공공기관 서류 */
export const PUBLIC_CERTS: BankCertInfo[] = [
  {
    name: '정부24', type: 'public',
    url: 'https://www.gov.kr',
    certName: '주민등록등본',
    path: '자주 찾는 서비스 > 주민등록표 등본 발급',
    method: 'online+app', auth: '공동인증서 또는 간편인증', fee: '무료', hours: '24시간',
    note: '카카오/네이버/PASS 간편인증 지원.',
  },
  {
    name: '국세청 홈택스', type: 'public',
    url: 'https://www.hometax.go.kr',
    certName: '납세증명서(국세)',
    path: '민원증명 > 납세증명서(국세완납증명) 신청',
    method: 'online', auth: '공동인증서 또는 간편인증', fee: '무료', hours: '24시간',
    note: '정부24에서도 발급 가능.',
  },
  {
    name: '위택스', type: 'public',
    url: 'https://www.wetax.go.kr',
    certName: '납세증명서(지방세)',
    path: '납부확인 > 납세증명서 발급',
    method: 'online', auth: '공동인증서 또는 간편인증', fee: '무료', hours: '24시간',
    note: '정부24에서도 발급 가능.',
  },
];

/** 의뢰인 채무 기반으로 필요 서류 목록 생성 */
export function getRequiredCerts(debtCreditors: string[]): BankCertInfo[] {
  const certs: BankCertInfo[] = [];
  const added = new Set<string>();

  for (const creditor of debtCreditors) {
    // 정확한 매칭
    if (BANK_CERT_DIRECTORY[creditor] && !added.has(creditor)) {
      certs.push(BANK_CERT_DIRECTORY[creditor]);
      added.add(creditor);
      continue;
    }
    // 부분 매칭
    for (const [key, info] of Object.entries(BANK_CERT_DIRECTORY)) {
      if (!added.has(key) && (creditor.includes(key) || key.includes(creditor))) {
        certs.push(info);
        added.add(key);
        break;
      }
    }
  }

  // 공공서류는 항상 포함
  certs.push(...PUBLIC_CERTS);

  return certs;
}
