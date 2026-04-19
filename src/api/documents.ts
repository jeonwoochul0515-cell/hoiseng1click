/**
 * 서류 수집 Firestore CRUD + Storage 업로드
 * 경로: offices/{officeId}/clients/{clientId}/documents/{docId}
 */
import { collection, doc, getDocs, addDoc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/firebase';
import type { ClientDocument, DocCategory } from '@/types/document';

const docCol = (officeId: string, clientId: string) =>
  collection(db, 'offices', officeId, 'clients', clientId, 'documents');

function toDate(val: unknown): Date {
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate();
  if (val instanceof Date) return val;
  return new Date();
}

/** 서류 목록 조회 */
export async function getDocuments(officeId: string, clientId: string): Promise<ClientDocument[]> {
  const q = query(docCol(officeId, clientId), orderBy('uploadedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    uploadedAt: toDate(d.data().uploadedAt),
  } as ClientDocument));
}

/** 카테고리별 서류 조회 */
export async function getDocumentsByCategory(
  officeId: string, clientId: string, category: DocCategory
): Promise<ClientDocument[]> {
  const all = await getDocuments(officeId, clientId);
  return all.filter(d => d.category === category);
}

/** 파일 업로드 + Firestore 기록 */
export async function uploadDocument(
  officeId: string,
  clientId: string,
  file: File,
  metadata: {
    category: DocCategory;
    subCategory: string;
    institution: string;
    docType: string;
    codefAmount?: number;
  }
): Promise<ClientDocument> {
  const safeName = metadata.institution.replace(/[^가-힣a-zA-Z0-9]/g, '_');
  const ext = file.name.split('.').pop() || 'pdf';
  const storagePath = `offices/${officeId}/clients/${clientId}/docs/${metadata.category}/${safeName}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);

  // Storage 업로드
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      institution: metadata.institution,
      docType: metadata.docType,
      originalName: file.name,
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);

  // Firestore 기록
  const docData: Omit<ClientDocument, 'id'> = {
    category: metadata.category,
    subCategory: metadata.subCategory,
    institution: metadata.institution,
    docType: metadata.docType,
    fileName: file.name,
    storagePath,
    downloadUrl,
    ocrStatus: 'pending',
    uploadedAt: Timestamp.now() as any,
    uploadedBy: 'office',
    codefAmount: metadata.codefAmount,
  };

  const ref2 = await addDoc(docCol(officeId, clientId), docData);
  return { ...docData, id: ref2.id } as ClientDocument;
}

/** OCR 결과 저장 */
export async function updateDocumentOcr(
  officeId: string,
  clientId: string,
  docId: string,
  ocrData: {
    ocrStatus: 'done' | 'failed';
    extractedData?: ClientDocument['extractedData'];
    pdfAmount?: number;
    dataMismatch?: boolean;
  }
): Promise<void> {
  await updateDoc(doc(db, 'offices', officeId, 'clients', clientId, 'documents', docId), ocrData);
}

// ── Individual (B2C) 서류 CRUD ──

const individualDocCol = (uid: string, caseId: string) =>
  collection(db, 'individuals', uid, 'cases', caseId, 'documents');

/** 개인용 서류 목록 조회 */
export async function getIndividualDocuments(uid: string, caseId: string = 'default'): Promise<ClientDocument[]> {
  const q = query(individualDocCol(uid, caseId), orderBy('uploadedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    uploadedAt: toDate(d.data().uploadedAt),
  } as ClientDocument));
}

/** 개인용 파일 업로드 */
export async function uploadIndividualDocument(
  uid: string,
  caseId: string,
  file: File,
  metadata: {
    category: DocCategory;
    subCategory: string;
    institution: string;
    docType: string;
    codefAmount?: number;
  }
): Promise<ClientDocument> {
  const safeName = metadata.institution.replace(/[^가-힣a-zA-Z0-9]/g, '_');
  const ext = file.name.split('.').pop() || 'pdf';
  const storagePath = `individuals/${uid}/cases/${caseId}/docs/${metadata.category}/${safeName}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      institution: metadata.institution,
      docType: metadata.docType,
      originalName: file.name,
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);

  const docData: Omit<ClientDocument, 'id'> = {
    category: metadata.category,
    subCategory: metadata.subCategory,
    institution: metadata.institution,
    docType: metadata.docType,
    fileName: file.name,
    storagePath,
    downloadUrl,
    ocrStatus: 'pending',
    uploadedAt: Timestamp.now() as any,
    uploadedBy: 'client',
    codefAmount: metadata.codefAmount,
  };

  const ref2 = await addDoc(individualDocCol(uid, caseId), docData);
  return { ...docData, id: ref2.id } as ClientDocument;
}

/** OCR 요청 (Cloud Functions 호출) */
export async function requestOcr(
  officeId: string,
  clientId: string,
  docId: string,
  storagePath: string,
  docType: string
): Promise<void> {
  const API_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? '';
  const user = auth.currentUser;
  if (!user || !API_BASE) return;

  const token = await user.getIdToken();
  await fetch(`${API_BASE}/doc/ocr`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ officeId, clientId, docId, storagePath, docType }),
  });
}
