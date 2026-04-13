import { collection, doc, getDoc, setDoc, Timestamp, runTransaction, writeBatch } from 'firebase/firestore';
import type { Debt, Asset } from '@/types/client';
import { db } from '@/firebase';
import { encryptSSN } from '@/utils/ssnCrypto';

export interface IntakeToken {
  id: string;
  officeId: string;
  officeName: string;
  pinHash: string;
  clientName?: string;
  clientPhone?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
}

/**
 * PIN을 SHA-256으로 해시하여 hex 문자열로 반환한다.
 * Web Crypto API 사용 (브라우저 + Cloudflare Workers 호환).
 */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface IntakeSubmission {
  tokenId: string;
  officeId: string;
  name: string;
  // TODO: ssn(주민등록번호)은 현재 Firestore에 평문 저장됨.
  // 추후 서버사이드(Cloud Functions 또는 Workers)에서 AES-256-GCM 등으로 암호화 후 저장해야 함.
  ssn: string;
  phone: string;
  address: string;
  zonecode?: string;
  court?: string;
  job: string;
  jobType: 'employed' | 'self' | 'freelance' | 'daily' | 'unemployed';
  family: number;
  income: number;
  income2: number;
  rent: number;
  education: number;
  medical: number;
  debts: {
    creditor: string;
    type: '무담보' | '담보' | '사채';
    amount: number;
    rate: number;
    monthly: number;
    originalDate?: string;
    originalAmount?: number;
    creditorAddress?: string;
    creditorPhone?: string;
    creditorFax?: string;
  }[];
  assets: {
    name: string;
    type: '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';
    rawValue: number;
    memo: string;
    meta?: {
      plate?: string;
      year?: number;
      address?: string;
      bankName?: string;
      accountLast4?: string;
      insurerName?: string;
    };
  }[];
  food?: number;
  transport?: number;
  telecom?: number;
  familyMembers?: { relation: string; name: string; age: number; hasIncome: boolean }[];
  memo: string;
  submittedAt: Timestamp;
  convertedClientId?: string;
  convertedAt?: Timestamp;
}

export async function getIntakeToken(tokenId: string): Promise<IntakeToken | null> {
  const snap = await getDoc(doc(db, 'intakeTokens', tokenId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as IntakeToken;
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createIntakeToken(
  officeId: string,
  officeName: string,
  clientName?: string,
  clientPhone?: string,
): Promise<{ tokenId: string; pin: string }> {
  const tokenId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const pin = generatePin();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7일

  const pinHash = await hashPin(pin);

  await setDoc(doc(db, 'intakeTokens', tokenId), {
    officeId,
    officeName,
    pinHash,
    clientName: clientName || '',
    clientPhone: clientPhone || '',
    createdAt: now,
    expiresAt,
    used: false,
  });

  // PIN 평문은 생성 시에만 반환 (법무사에게 보여주기 위해). Firestore에는 해시만 저장됨.
  return { tokenId, pin };
}

export type VerifyResult =
  | { ok: true; token: IntakeToken }
  | { ok: false; reason: 'not_found' | 'used' | 'expired' | 'wrong_pin' };

export async function verifyIntakePin(tokenId: string, pin: string): Promise<VerifyResult> {
  const token = await getIntakeToken(tokenId);
  if (!token) return { ok: false, reason: 'not_found' };
  if (token.used) return { ok: false, reason: 'used' };
  if (token.expiresAt.toDate().getTime() < Date.now()) return { ok: false, reason: 'expired' };
  const inputHash = await hashPin(pin);
  if (token.pinHash !== inputHash) return { ok: false, reason: 'wrong_pin' };
  return { ok: true, token };
}

export async function submitIntake(data: Omit<IntakeSubmission, 'submittedAt'>, pin: string): Promise<string> {
  const submissionRef = doc(collection(db, 'intakeSubmissions'));

  await runTransaction(db, async (transaction) => {
    const tokenRef = doc(db, 'intakeTokens', data.tokenId);
    const tokenSnap = await transaction.get(tokenRef);

    if (!tokenSnap.exists()) throw new Error('유효하지 않은 토큰입니다.');
    const token = tokenSnap.data();
    if (token.used) throw new Error('이미 사용된 토큰입니다.');
    if (token.expiresAt.toDate() < new Date()) throw new Error('만료된 토큰입니다.');
    const inputHash = await hashPin(pin);
    if (token.pinHash !== inputHash) throw new Error('비밀번호가 올바르지 않습니다.');

    transaction.set(submissionRef, { ...data, submittedAt: Timestamp.now() });
    transaction.update(tokenRef, { used: true });
  });

  return submissionRef.id;
}

export async function convertSubmissionToClient(
  officeId: string,
  submissionId: string,
  submission: IntakeSubmission,
): Promise<string> {
  const debts: Debt[] = submission.debts.map((d) => {
    const debt: Debt = {
      id: crypto.randomUUID(),
      name: d.creditor,
      creditor: d.creditor,
      type: d.type,
      amount: d.amount,
      rate: d.rate,
      monthly: d.monthly,
      source: 'manual' as const,
    };
    if (d.originalDate) debt.originalDate = d.originalDate;
    if (d.originalAmount) debt.originalAmount = d.originalAmount;
    if (d.creditorAddress) debt.creditorAddress = d.creditorAddress;
    if (d.creditorPhone) debt.creditorPhone = d.creditorPhone;
    if (d.creditorFax) debt.creditorFax = d.creditorFax;
    return debt;
  });

  const assets: Asset[] = submission.assets.map((a) => ({
    id: crypto.randomUUID(),
    name: a.name,
    type: a.type,
    rawValue: a.rawValue,
    liquidationRate: 0,
    mortgage: 0,
    value: a.rawValue,
    source: 'manual' as const,
    meta: a.meta ?? {},
  }));

  const now = Timestamp.now();
  const clientsCol = collection(db, 'offices', officeId, 'clients');
  const clientRef = doc(clientsCol);

  // SSN 암호화
  let ssnEncrypted = '';
  let ssnMasked = '';
  if (submission.ssn) {
    try {
      const result = await encryptSSN(submission.ssn);
      ssnEncrypted = result.encrypted;
      ssnMasked = result.masked;
    } catch (err) {
      if (import.meta.env.PROD) {
        throw new Error('주민등록번호 암호화에 실패했습니다.');
      }
      console.warn('SSN 암호화 실패 — 개발 환경에서 평문 저장됨', err);
    }
  }

  const clientData = {
    name: submission.name,
    ssn: ssnEncrypted ? '' : submission.ssn, // 암호화 성공 시 평문 제거
    ssnEncrypted,
    ssnMasked,
    phone: submission.phone,
    address: submission.address,
    zonecode: submission.zonecode ?? '',
    job: submission.job,
    jobType: submission.jobType,
    family: submission.family,
    income: submission.income,
    income2: submission.income2,
    rent: submission.rent,
    education: submission.education,
    medical: submission.medical,
    food: submission.food ?? 0,
    transport: submission.transport ?? 0,
    telecom: submission.telecom ?? 0,
    familyMembers: submission.familyMembers ?? [],
    memo: [
      submission.memo,
      ...submission.assets
        .filter(a => a.memo)
        .map(a => `[재산] ${a.name}: ${a.memo}`)
    ].filter(Boolean).join('\n'),
    court: submission.court ?? '',
    status: 'new',
    collectionDone: false,
    debts,
    assets,
    fee: 0,
    feeInstallment: false,
    feeInstallmentMonths: 1,
    feePaidAmount: 0,
    intakeSubmissionId: submissionId,
    createdAt: now,
    updatedAt: now,
  };

  // 원자적 배치: client 생성 + submission 업데이트를 동시에
  const batch = writeBatch(db);
  batch.set(clientRef, clientData);
  batch.update(doc(db, 'intakeSubmissions', submissionId), {
    convertedAt: now,
    convertedClientId: clientRef.id,
  });
  await batch.commit();

  return clientRef.id;
}
