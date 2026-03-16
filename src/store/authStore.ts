import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { PLAN_CONFIGS } from '@/types/subscription';

export interface Office {
  id: string;
  name: string;
  type: 'lawyer' | 'scrivener';
  rep: string;
  phone: string;
  email: string;
  bizNumber: string;       // 사업자등록번호
  address: string;
  bizType: string;         // 업태
  bizItem: string;         // 종목
  plan: 'starter' | 'pro' | 'enterprise';
  planExpiry: Timestamp | null;
  clientCount: number;
  docCountThisMonth: number;
  codefConnected: boolean;
  members: string[];
  createdAt: Timestamp;
}

export interface SignupData {
  officeName: string;
  rep: string;
  phone: string;
  email: string;
  bizNumber: string;
  address: string;
  bizType: string;
  bizItem: string;
  officeType: 'lawyer' | 'scrivener';
}

interface AuthState {
  user: User | null;
  office: Office | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, data: SignupData) => Promise<void>;
  updateOffice: (data: Partial<Office>) => Promise<void>;
  logout: () => Promise<void>;
  loadOffice: (uid: string) => Promise<void>;
  refreshPlanStatus: () => void;
  init: () => () => void;

  canAddClient: () => boolean;
  canGenerateDoc: () => boolean;
  hasPro: () => boolean;
  planExpired: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  office: null,
  loading: true,

  login: async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  },

  signup: async (email: string, password: string, data: SignupData) => {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('email-already-in-use')) {
        throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.');
      }
      throw err;
    }
    // 사무소 문서가 이미 있으면 로드만 하고 끝
    const existingSnap = await getDoc(doc(db, 'offices', cred.user.uid));
    if (existingSnap.exists()) {
      set({ user: cred.user, office: { id: existingSnap.id, ...existingSnap.data() } as Office });
      return;
    }
    const now = Timestamp.now();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 14);
    const planExpiry = Timestamp.fromDate(expiryDate);

    const officeData: Omit<Office, 'id'> = {
      name: data.officeName,
      type: data.officeType,
      rep: data.rep,
      phone: data.phone,
      email: data.email || email,
      bizNumber: data.bizNumber,
      address: data.address,
      bizType: data.bizType,
      bizItem: data.bizItem,
      plan: 'pro',
      planExpiry,
      clientCount: 0,
      docCountThisMonth: 0,
      codefConnected: false,
      members: [cred.user.uid],
      createdAt: now,
    };

    await setDoc(doc(db, 'offices', cred.user.uid), officeData);
    set({ office: { id: cred.user.uid, ...officeData } });
  },

  updateOffice: async (data: Partial<Office>) => {
    const { user, office } = get();
    if (!user || !office) return;
    await updateDoc(doc(db, 'offices', user.uid), data);
    set({ office: { ...office, ...data } });
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, office: null });
  },

  loadOffice: async (uid: string) => {
    const snap = await getDoc(doc(db, 'offices', uid));
    if (snap.exists()) {
      set({ office: { id: snap.id, ...snap.data() } as Office });
    } else {
      // office 문서가 없으면 기본값으로 자동 생성
      const now = Timestamp.now();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 14);
      const officeData: Omit<Office, 'id'> = {
        name: '내 사무소', type: 'scrivener', rep: '', phone: '', email: '',
        bizNumber: '', address: '', bizType: '', bizItem: '',
        plan: 'pro', planExpiry: Timestamp.fromDate(expiryDate),
        clientCount: 0, docCountThisMonth: 0, codefConnected: false,
        members: [uid], createdAt: now,
      };
      await setDoc(doc(db, 'offices', uid), officeData);
      set({ office: { id: uid, ...officeData } });
    }
  },

  refreshPlanStatus: () => {
    const { office } = get();
    if (!office || !office.planExpiry) return;
    const expired = office.planExpiry.toDate().getTime() < Date.now();
    if (expired && office.plan !== 'starter') {
      set({ office: { ...office, plan: 'starter' } });
    }
  },

  init: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user, loading: true });
        try {
          await get().loadOffice(user.uid);
          get().refreshPlanStatus();
        } catch (e) {
          console.error('Failed to load office:', e);
        } finally {
          set({ loading: false });
        }
      } else {
        set({ user: null, office: null, loading: false });
      }
    });
    return unsubscribe;
  },

  canAddClient: () => {
    const { office } = get();
    if (!office) return false;
    if (get().planExpired()) return PLAN_CONFIGS.starter.maxClients > office.clientCount;
    return PLAN_CONFIGS[office.plan].maxClients > office.clientCount;
  },

  canGenerateDoc: () => {
    const { office } = get();
    if (!office) return false;
    if (get().planExpired()) return PLAN_CONFIGS.starter.maxDocsPerMonth > office.docCountThisMonth;
    return PLAN_CONFIGS[office.plan].maxDocsPerMonth > office.docCountThisMonth;
  },

  hasPro: () => {
    const { office } = get();
    if (!office) return false;
    if (get().planExpired()) return false;
    return office.plan === 'pro' || office.plan === 'enterprise';
  },

  planExpired: () => {
    const { office } = get();
    if (!office || !office.planExpiry) return false;
    return office.planExpiry.toDate().getTime() < Date.now();
  },
}));
