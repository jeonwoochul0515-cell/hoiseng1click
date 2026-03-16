import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Client } from '@/types/client';
import { encryptSSN, decryptSSN } from '@/utils/ssnCrypto';

const clientsCol = (officeId: string) => collection(db, 'offices', officeId, 'clients');

function toDate(val: unknown): Date {
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate();
  if (val instanceof Date) return val;
  return new Date();
}

function convertClient(id: string, data: Record<string, unknown>): Client {
  return {
    ...data,
    id,
    // ssnMasked가 있으면 ssn 필드에 마스킹값 사용 (목록 표시용)
    ssn: (data.ssnMasked as string) || (data.ssn as string) || '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as Client;
}

export async function getClients(officeId: string): Promise<Client[]> {
  const q = query(clientsCol(officeId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => convertClient(d.id, d.data()));
}

export async function getClient(officeId: string, clientId: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, 'offices', officeId, 'clients', clientId));
  return snap.exists() ? convertClient(snap.id, snap.data()) : null;
}

/** 의뢰인의 복호화된 SSN을 가져온다 (편집, 서류 생성 시 사용) */
export async function getClientDecryptedSSN(officeId: string, clientId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'offices', officeId, 'clients', clientId));
  if (!snap.exists()) return '';
  const data = snap.data();
  // ssnEncrypted가 있으면 복호화, 없으면 레거시 평문 ssn 반환
  if (data.ssnEncrypted) {
    return decryptSSN(data.ssnEncrypted);
  }
  return data.ssn || '';
}

export async function createClient(officeId: string, data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const payload: Record<string, unknown> = { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };

  // SSN 암호화 처리
  if (data.ssn) {
    try {
      const { encrypted, masked } = await encryptSSN(data.ssn);
      payload.ssnEncrypted = encrypted;
      payload.ssnMasked = masked;
      payload.ssn = ''; // 평문 제거
    } catch {
      // 암호화 서버 미연결 시 경고만 (개발 환경 대비)
      console.warn('SSN 암호화 실패 — 평문 저장됨');
    }
  }

  const ref = await addDoc(clientsCol(officeId), payload);
  return ref.id;
}

export async function updateClient(officeId: string, clientId: string, data: Partial<Client>): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: Timestamp.now() };

  // SSN이 변경되었으면 재암호화
  if (data.ssn) {
    try {
      const { encrypted, masked } = await encryptSSN(data.ssn);
      payload.ssnEncrypted = encrypted;
      payload.ssnMasked = masked;
      payload.ssn = ''; // 평문 제거
    } catch {
      console.warn('SSN 암호화 실패 — 평문 저장됨');
    }
  }

  await updateDoc(doc(db, 'offices', officeId, 'clients', clientId), payload);
}

export async function deleteClient(officeId: string, clientId: string): Promise<void> {
  await deleteDoc(doc(db, 'offices', officeId, 'clients', clientId));
}
