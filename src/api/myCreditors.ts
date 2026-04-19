// 사무소별 "내 채권자" 템플릿 관리
// Firestore: offices/{officeId}/myCreditors/{id}
//
// 사용 시나리오:
// - 의뢰인마다 동일한 채권자(KB국민은행 등)를 반복 입력하지 않도록
// - 사무소가 자주 쓰는 채권자를 저장해 빠른 재사용
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp, increment,
} from 'firebase/firestore';
import { db } from '@/firebase';

export interface MyCreditor {
  id: string;
  name: string;
  personalityType?: '자연인' | '법인' | '권리능력없는법인(비법인)' | '국가' | '지방자치단체';
  zipCode?: string;
  address?: string;
  addressDetail?: string;
  phone?: string;       // 전화번호
  mobile?: string;      // 휴대전화
  fax?: string;
  email?: string;
  memo?: string;        // 사무소 메모 (예: "지점별 다른 담당자")
  useCount?: number;    // 누적 사용 횟수
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

function colRef(officeId: string) {
  return collection(db, 'offices', officeId, 'myCreditors');
}

function convertTimestamps(data: any): MyCreditor {
  return {
    ...data,
    lastUsedAt: data.lastUsedAt?.toDate?.() ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? undefined,
    updatedAt: data.updatedAt?.toDate?.() ?? undefined,
  };
}

/** 사무소 내 모든 내 채권자 목록 */
export async function listMyCreditors(officeId: string): Promise<MyCreditor[]> {
  const q = query(colRef(officeId), orderBy('useCount', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...convertTimestamps(d.data()) }));
}

/** 단일 채권자 조회 */
export async function getMyCreditor(officeId: string, id: string): Promise<MyCreditor | null> {
  const snap = await getDoc(doc(db, 'offices', officeId, 'myCreditors', id));
  return snap.exists() ? { id: snap.id, ...convertTimestamps(snap.data()) } : null;
}

/** 새 채권자 추가 (이름 중복 시 useCount 증가) */
export async function addOrBumpMyCreditor(
  officeId: string,
  data: Omit<MyCreditor, 'id' | 'createdAt' | 'updatedAt' | 'useCount' | 'lastUsedAt'>,
): Promise<string> {
  if (!data.name?.trim()) throw new Error('채권자명이 필요합니다');

  // 이름 기반 ID (소문자·공백 제거)
  const id = data.name.replace(/\s+/g, '').toLowerCase().slice(0, 80);
  const ref = doc(db, 'offices', officeId, 'myCreditors', id);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    // 이미 있으면 사용 횟수 + lastUsedAt 갱신 (내용도 최신으로)
    await updateDoc(ref, {
      ...data,
      useCount: increment(1),
      lastUsedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(ref, {
      ...data,
      useCount: 1,
      lastUsedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  return id;
}

/** 채권자 정보 업데이트 (이름 변경 없이) */
export async function updateMyCreditor(
  officeId: string,
  id: string,
  data: Partial<Omit<MyCreditor, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'offices', officeId, 'myCreditors', id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/** 삭제 */
export async function deleteMyCreditor(officeId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'offices', officeId, 'myCreditors', id));
}
