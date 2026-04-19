// 공유 채권자 디렉토리
// Firestore: sharedCreditors/{id}
// - 모든 사무소 읽기 가능
// - 쓰기는 관리자(admin custom claim)만
// - "verified" 플래그로 검증된 채권자 표시
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';

export interface SharedCreditor {
  id: string;
  name: string;
  personalityType?: '자연인' | '법인' | '권리능력없는법인(비법인)' | '국가' | '지방자치단체';
  zipCode?: string;
  address?: string;
  addressDetail?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  verified?: boolean;       // 관리자 검증 여부
  category?: string;        // '은행' | '카드' | '보험' | '캐피탈' | '공공' 등
  createdAt?: Date;
  updatedAt?: Date;
  contributedBy?: string;   // 기여한 사무소 UID
}

const sharedCol = () => collection(db, 'sharedCreditors');

function convertTimestamps(data: any): SharedCreditor {
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? undefined,
    updatedAt: data.updatedAt?.toDate?.() ?? undefined,
  };
}

/** 모든 공유 채권자 (검증됨 우선, 이름순) */
export async function listSharedCreditors(): Promise<SharedCreditor[]> {
  const q = query(sharedCol(), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...convertTimestamps(d.data()) }))
    .sort((a, b) => {
      // verified 우선
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** 단일 조회 */
export async function getSharedCreditor(id: string): Promise<SharedCreditor | null> {
  const snap = await getDoc(doc(db, 'sharedCreditors', id));
  return snap.exists() ? { id: snap.id, ...convertTimestamps(snap.data()) } : null;
}

/** 관리자용: 공유 채권자 추가/갱신 */
export async function upsertSharedCreditor(
  data: Omit<SharedCreditor, 'id' | 'createdAt' | 'updatedAt'>,
  contributedBy?: string,
): Promise<string> {
  const id = data.name.replace(/\s+/g, '').toLowerCase().slice(0, 80);
  const ref = doc(db, 'sharedCreditors', id);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...data,
      contributedBy: contributedBy ?? data.contributedBy,
      updatedAt: Timestamp.now(),
      ...(existing.exists() ? {} : { createdAt: Timestamp.now() }),
    },
    { merge: true },
  );
  return id;
}

/** 관리자용: 삭제 */
export async function deleteSharedCreditor(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sharedCreditors', id));
}
