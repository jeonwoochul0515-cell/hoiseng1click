/**
 * CODEF 수집 결과 → 동적 서류 버튼 생성
 * 데이터 우선순위: PDF OCR > CODEF API
 */
import type { Debt, Asset } from '@/types/client';
import type { DocCategory } from '@/types/document';
import { BANK_CERT_DIRECTORY, PUBLIC_CERTS, type BankCertInfo } from './bankDirectory';

export interface DocButton {
  id: string;
  category: DocCategory;
  institution: string;
  docType: string;
  url: string;
  directUrl?: boolean;
  description: string;
  status: 'auto' | 'todo' | 'uploaded' | 'verified';
  codefData?: { amount: number; count: number };
  icon: string;
}

/** 기본서류 (항상 표시) */
const BASIC_DOCS: Omit<DocButton, 'id' | 'status'>[] = [
  { category: 'basic', institution: '정부24', docType: '주민등록등본', url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015', directUrl: true, description: '세대원 전체, 주소변동 포함', icon: '📋' },
  { category: 'basic', institution: '정부24', docType: '주민등록초본', url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015', directUrl: true, description: '개명/주민번호 변동사항 포함', icon: '📋' },
  { category: 'basic', institution: '대법원', docType: '가족관계증명서(상세)', url: 'https://efamily.scourt.go.kr', description: '상세증명서로 발급', icon: '👨‍👩‍👧' },
  { category: 'basic', institution: '대법원', docType: '혼인관계증명서(상세)', url: 'https://efamily.scourt.go.kr', description: '상세증명서로 발급', icon: '💍' },
  { category: 'basic', institution: '홈택스', docType: '납세증명서(국세)', url: 'https://www.hometax.go.kr', description: '국세 완납 증명', icon: '🏛️' },
  { category: 'basic', institution: '정부24', docType: '납세증명서(지방세)', url: 'https://www.gov.kr', description: '지방세 완납 증명', icon: '🏛️' },
  { category: 'basic', institution: '홈택스', docType: '소득금액증명원(3년)', url: 'https://www.hometax.go.kr', description: '최근 3년간', icon: '💰' },
  { category: 'basic', institution: '홈택스', docType: '원천징수영수증', url: 'https://www.hometax.go.kr', description: '근로소득 원천징수', icon: '💰' },
  { category: 'basic', institution: '어카운트인포', docType: '전체 금융계좌 조회', url: 'https://www.payinfo.or.kr', description: '은행/카드/증권/보험 일괄 조회', icon: '🏦' },
];

/** 부동산 소유 시 추가 */
const REAL_ESTATE_DOCS: Omit<DocButton, 'id' | 'status'>[] = [
  { category: 'asset', institution: '인터넷등기소', docType: '등기사항전부증명서', url: 'https://www.iros.go.kr', description: '소유 부동산 전부', icon: '🏠' },
  { category: 'basic', institution: '정부24', docType: '지방세 과세증명서(5년)', url: 'https://www.gov.kr', description: '전국/전체세목/최근5년', icon: '🏛️' },
];

/** 자영업자 추가 */
const SELF_EMPLOYED_DOCS: Omit<DocButton, 'id' | 'status'>[] = [
  { category: 'income', institution: '홈택스', docType: '사업자등록증명', url: 'https://www.hometax.go.kr', description: '', icon: '📄' },
  { category: 'income', institution: '홈택스', docType: '부가가치세과세표준증명', url: 'https://www.hometax.go.kr', description: '최근 3년', icon: '📄' },
];

/** CODEF 수집 결과에서 동적 버튼 생성 */
export function generateDocButtons(
  debts: Debt[],
  assets: Asset[],
  options: { hasRealEstate?: boolean; jobType?: string }
): DocButton[] {
  const buttons: DocButton[] = [];
  let idCounter = 0;
  const makeId = () => `doc-${idCounter++}`;

  // ── 기본서류 ──
  for (const doc of BASIC_DOCS) {
    buttons.push({ ...doc, id: makeId(), status: 'todo' });
  }

  // ── 부동산 소유 시 ──
  if (options.hasRealEstate) {
    for (const doc of REAL_ESTATE_DOCS) {
      buttons.push({ ...doc, id: makeId(), status: 'todo' });
    }
  }

  // ── 자영업자 ──
  if (options.jobType === 'self' || options.jobType === 'freelance') {
    for (const doc of SELF_EMPLOYED_DOCS) {
      buttons.push({ ...doc, id: makeId(), status: 'todo' });
    }
  }

  // ── 은행별 (CODEF 대출 데이터 기반) ──
  const bankDebts = new Map<string, { count: number; amount: number }>();
  for (const d of debts) {
    if (!d.creditor) continue;
    const key = d.creditor;
    const prev = bankDebts.get(key) || { count: 0, amount: 0 };
    bankDebts.set(key, { count: prev.count + 1, amount: prev.amount + d.amount });
  }

  for (const [creditor, data] of bankDebts) {
    const bankInfo = BANK_CERT_DIRECTORY[creditor];
    const amountStr = (data.amount / 10000).toFixed(0);
    buttons.push({
      id: makeId(),
      category: bankInfo?.type === 'card' ? 'card' : bankInfo?.type === 'insurance' ? 'insurance' : 'bank',
      institution: creditor,
      docType: bankInfo?.certName || '부채증명서',
      url: bankInfo?.url || '',
      description: `${data.count}건, ${amountStr}만원`,
      status: 'todo',
      codefData: data,
      icon: bankInfo?.type === 'card' ? '💳' : bankInfo?.type === 'insurance' ? '🛡️' : '🏦',
    });
  }

  // ── 보험사별 (CODEF 보험 자산 기반) ──
  const insuranceAssets = new Map<string, { count: number; amount: number }>();
  for (const a of assets) {
    if (a.type !== '보험' || !a.meta?.insurerName) continue;
    const key = a.meta.insurerName;
    const prev = insuranceAssets.get(key) || { count: 0, amount: 0 };
    insuranceAssets.set(key, { count: prev.count + 1, amount: prev.amount + a.rawValue });
  }

  for (const [insurer, data] of insuranceAssets) {
    // 이미 채무로 추가된 보험사는 건너뛰기
    if (bankDebts.has(insurer)) continue;
    const bankInfo = BANK_CERT_DIRECTORY[insurer];
    const amountStr = (data.amount / 10000).toFixed(0);
    buttons.push({
      id: makeId(),
      category: 'insurance',
      institution: insurer,
      docType: bankInfo?.certName || '해약환급금증명서',
      url: bankInfo?.url || '',
      description: `해지환급금 ${amountStr}만원`,
      status: 'todo',
      codefData: data,
      icon: '🛡️',
    });
  }

  return buttons;
}

/** CODEF vs PDF 데이터 병합 (PDF 우선) */
export function mergeDocData(
  codefAmount: number | undefined,
  pdfAmount: number | undefined
): { finalAmount: number; source: 'codef' | 'pdf' | 'none'; mismatch: boolean; delta?: number } {
  if (pdfAmount != null && pdfAmount > 0) {
    const mismatch = codefAmount != null && Math.abs(pdfAmount - codefAmount) > 100;
    return {
      finalAmount: pdfAmount,
      source: 'pdf',
      mismatch,
      delta: codefAmount != null ? pdfAmount - codefAmount : undefined,
    };
  }
  if (codefAmount != null && codefAmount > 0) {
    return { finalAmount: codefAmount, source: 'codef', mismatch: false };
  }
  return { finalAmount: 0, source: 'none', mismatch: false };
}
