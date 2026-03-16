/**
 * SSN 암호화/복호화 프론트엔드 유틸리티
 * 서버(Cloud Functions)의 AES-256-GCM 암호화 엔드포인트를 호출한다.
 */
import { auth } from '@/firebase';

const API_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://localhost:8787';

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** 평문 SSN → 암호화 문자열 + 마스킹 문자열 */
export async function encryptSSN(ssn: string): Promise<{ encrypted: string; masked: string }> {
  if (!ssn) return { encrypted: '', masked: '' };
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/crypto/encrypt-ssn`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ssn }),
  });
  if (!res.ok) throw new Error('SSN 암호화 실패');
  return res.json();
}

/** 암호화 문자열 → 복호화된 평문 SSN */
export async function decryptSSN(encrypted: string): Promise<string> {
  if (!encrypted) return '';
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/crypto/decrypt-ssn`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ encrypted }),
  });
  if (!res.ok) throw new Error('SSN 복호화 실패');
  const data = await res.json();
  return data.ssn;
}

/** 기존 평문 SSN 데이터를 일괄 암호화 마이그레이션 */
export async function migrateSSN(officeId: string): Promise<{ migrated: number }> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/crypto/migrate-ssn`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ officeId }),
  });
  if (!res.ok) throw new Error('SSN 마이그레이션 실패');
  return res.json();
}
