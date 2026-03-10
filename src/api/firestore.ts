import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Client } from '@/types/client';

const clientsCol = (officeId: string) => collection(db, 'offices', officeId, 'clients');

export async function getClients(officeId: string): Promise<Client[]> {
  const q = query(clientsCol(officeId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
}

export async function getClient(officeId: string, clientId: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, 'offices', officeId, 'clients', clientId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Client) : null;
}

export async function createClient(officeId: string, data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(clientsCol(officeId), { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  return ref.id;
}

export async function updateClient(officeId: string, clientId: string, data: Partial<Client>): Promise<void> {
  await updateDoc(doc(db, 'offices', officeId, 'clients', clientId), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteClient(officeId: string, clientId: string): Promise<void> {
  await deleteDoc(doc(db, 'offices', officeId, 'clients', clientId));
}
