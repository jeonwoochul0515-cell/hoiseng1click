import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';

export interface Office {
  id: string;
  name: string;
  type: 'lawyer' | 'scrivener';
  rep: string;
  phone: string;
  plan: 'starter' | 'pro' | 'enterprise';
  planExpiry: Timestamp | null;
  clientCount: number;
  docCountThisMonth: number;
  codefConnected: boolean;
  members: string[];
  createdAt: Timestamp;
}

const PLAN_LIMITS: Record<Office['plan'], { clients: number; docs: number }> = {
  starter: { clients: 30, docs: 50 },
  pro: { clients: 150, docs: Infinity },
  enterprise: { clients: Infinity, docs: Infinity },
};

interface AuthState {
  user: User | null;
  office: Office | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, officeName: string) => Promise<void>;
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

  signup: async (email: string, password: string, officeName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const now = Timestamp.now();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 14);
    const planExpiry = Timestamp.fromDate(expiryDate);

    const officeData: Omit<Office, 'id'> = {
      name: officeName,
      type: 'lawyer',
      rep: '',
      phone: '',
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

  logout: async () => {
    await signOut(auth);
    set({ user: null, office: null });
  },

  loadOffice: async (uid: string) => {
    const snap = await getDoc(doc(db, 'offices', uid));
    if (snap.exists()) {
      set({ office: { id: snap.id, ...snap.data() } as Office });
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
        await get().loadOffice(user.uid);
        get().refreshPlanStatus();
        set({ loading: false });
      } else {
        set({ user: null, office: null, loading: false });
      }
    });
    return unsubscribe;
  },

  canAddClient: () => {
    const { office } = get();
    if (!office) return false;
    if (get().planExpired()) return PLAN_LIMITS.starter.clients > office.clientCount;
    return PLAN_LIMITS[office.plan].clients > office.clientCount;
  },

  canGenerateDoc: () => {
    const { office } = get();
    if (!office) return false;
    if (get().planExpired()) return PLAN_LIMITS.starter.docs > office.docCountThisMonth;
    return PLAN_LIMITS[office.plan].docs > office.docCountThisMonth;
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
