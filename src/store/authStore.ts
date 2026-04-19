import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { PLAN_CONFIGS } from '@/types/subscription';
import type { IndividualPlanType } from '@/types/subscription';

export type UserType = 'office' | 'individual';

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

export interface Individual {
  id: string;
  name: string;
  phone: string;
  email: string;
  plan: IndividualPlanType | null;
  planPurchasedAt: Timestamp | null;
  planExpiresAt: Timestamp | null;
  lawyerChatRemaining: number;
  lawyerCallRemaining: number;
  correctionGuidesRemaining: number;
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

export interface IndividualSignupData {
  name: string;
  phone: string;
  email: string;
}

interface AuthState {
  user: User | null;
  userType: UserType | null;
  office: Office | null;
  individual: Individual | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, data: SignupData) => Promise<void>;
  signupIndividual: (email: string, password: string, data: IndividualSignupData) => Promise<void>;
  updateOffice: (data: Partial<Office>) => Promise<void>;
  updateIndividual: (data: Partial<Individual>) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  loadOffice: (uid: string) => Promise<void>;
  loadProfile: (uid: string) => Promise<void>;
  refreshPlanStatus: () => Promise<void>;
  init: () => () => void;

  canAddClient: () => boolean;
  canGenerateDoc: () => boolean;
  hasPro: () => boolean;
  planExpired: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userType: null,
  office: null,
  individual: null,
  loading: true,

  login: async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    set({ user: cred.user });
  },

  loginWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    // 이미 프로필이 있으면 로드만 (loadProfile은 init에서 호출됨)
    // 프로필이 없으면 individual로 자동 생성
    const indSnap = await getDoc(doc(db, 'individuals', cred.user.uid));
    const offSnap = await getDoc(doc(db, 'offices', cred.user.uid));
    if (!indSnap.exists() && !offSnap.exists()) {
      const now = Timestamp.now();
      const individualData = {
        name: cred.user.displayName ?? '',
        phone: cred.user.phoneNumber ?? '',
        email: cred.user.email ?? '',
        plan: null,
        planPurchasedAt: null,
        planExpiresAt: null,
        lawyerChatRemaining: 0,
        lawyerCallRemaining: 0,
        correctionGuidesRemaining: 0,
        createdAt: now,
      };
      await setDoc(doc(db, 'individuals', cred.user.uid), individualData);
      set({ user: cred.user, userType: 'individual', individual: { id: cred.user.uid, ...individualData } as Individual });
    } else {
      set({ user: cred.user });
    }
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
    // 사무소 문서가 이미 있으면 가입 정보로 업데이트
    const existingSnap = await getDoc(doc(db, 'offices', cred.user.uid));
    if (existingSnap.exists()) {
      const updateData = {
        name: data.officeName,
        type: data.officeType,
        rep: data.rep,
        phone: data.phone,
        email: data.email || email,
        bizNumber: data.bizNumber,
        address: data.address,
        bizType: data.bizType,
        bizItem: data.bizItem,
      };
      await updateDoc(doc(db, 'offices', cred.user.uid), updateData);
      set({ user: cred.user, userType: 'office', office: { id: existingSnap.id, ...existingSnap.data(), ...updateData } as Office });
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
    set({ user: cred.user, userType: 'office', office: { id: cred.user.uid, ...officeData } });
  },

  signupIndividual: async (email: string, password: string, data: IndividualSignupData) => {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('email-already-in-use')) {
        throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.');
      }
      throw err;
    }
    // 개인 문서가 이미 있으면 로드만 하고 끝
    const existingSnap = await getDoc(doc(db, 'individuals', cred.user.uid));
    if (existingSnap.exists()) {
      set({ user: cred.user, userType: 'individual', individual: { id: existingSnap.id, ...existingSnap.data() } as Individual });
      return;
    }
    const now = Timestamp.now();

    const individualData: Omit<Individual, 'id'> = {
      name: data.name,
      phone: data.phone,
      email: data.email || email,
      plan: null,
      planPurchasedAt: null,
      planExpiresAt: null,
      lawyerChatRemaining: 0,
      lawyerCallRemaining: 0,
      correctionGuidesRemaining: 0,
      createdAt: now,
    };

    await setDoc(doc(db, 'individuals', cred.user.uid), individualData);
    set({ user: cred.user, userType: 'individual', individual: { id: cred.user.uid, ...individualData } });
  },

  updateOffice: async (data: Partial<Office>) => {
    const { user, office } = get();
    if (!user || !office) return;
    await updateDoc(doc(db, 'offices', user.uid), data);
    set({ office: { ...office, ...data } });
  },

  updateIndividual: async (data: Partial<Individual>) => {
    const { user, individual } = get();
    if (!user || !individual) return;
    await updateDoc(doc(db, 'individuals', user.uid), data);
    set({ individual: { ...individual, ...data } });
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, userType: null, office: null, individual: null });
  },

  deleteAccount: async () => {
    const { user, userType } = get();
    if (!user) return;
    // Firestore 문서 삭제
    if (userType === 'individual') {
      await deleteDoc(doc(db, 'individuals', user.uid)).catch((err) => { console.error('개인 문서 삭제 실패:', err); });
    } else {
      await deleteDoc(doc(db, 'offices', user.uid)).catch((err) => { console.error('사무소 문서 삭제 실패:', err); });
    }
    // Firebase Auth 계정 삭제
    await user.delete();
    set({ user: null, userType: null, office: null, individual: null });
  },

  loadOffice: async (uid: string) => {
    const snap = await getDoc(doc(db, 'offices', uid));
    if (snap.exists()) {
      set({ userType: 'office', office: { id: snap.id, ...snap.data() } as Office });
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
      set({ userType: 'office', office: { id: uid, ...officeData } });
    }
  },

  loadProfile: async (uid: string) => {
    // 먼저 individuals 컬렉션 확인
    const indSnap = await getDoc(doc(db, 'individuals', uid));
    if (indSnap.exists()) {
      set({ userType: 'individual', individual: { id: indSnap.id, ...indSnap.data() } as Individual });
      return;
    }
    // individuals에 없으면 offices에서 로드 (기존 사무소 사용자)
    await get().loadOffice(uid);
  },

  refreshPlanStatus: async () => {
    const { userType, office, individual } = get();
    if (userType === 'individual') {
      // 개인 사용자: planExpiresAt 기준으로 만료 체크
      if (!individual || !individual.planExpiresAt) return;
      const expired = individual.planExpiresAt.toDate().getTime() < Date.now();
      if (expired && individual.plan !== null) {
        set({ individual: { ...individual, plan: null } });
        try {
          await updateDoc(doc(db, 'individuals', individual.id), { plan: null });
        } catch (e) {
          console.error('Failed to persist individual plan expiry:', e);
        }
      }
      return;
    }
    // 사무소 사용자: 기존 로직
    if (!office || !office.planExpiry) return;
    const expired = office.planExpiry.toDate().getTime() < Date.now();
    if (expired && office.plan !== 'starter') {
      set({ office: { ...office, plan: 'starter' } });
      try {
        await updateDoc(doc(db, 'offices', office.id), { plan: 'starter' });
      } catch (e) {
        console.error('Failed to persist plan downgrade:', e);
      }
    }
  },

  init: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user, loading: true });
        try {
          await get().loadProfile(user.uid);
          await get().refreshPlanStatus();
        } catch (e) {
          console.error('Failed to load profile:', e);
        } finally {
          set({ loading: false });
        }
      } else {
        set({ user: null, userType: null, office: null, individual: null, loading: false });
      }
    });
    return unsubscribe;
  },

  canAddClient: () => {
    const { userType, office } = get();
    // 개인 사용자는 항상 1건 (자기 자신)
    if (userType === 'individual') return true;
    if (!office) return false;
    if (get().planExpired()) return PLAN_CONFIGS.starter.maxClientsPerMonth > office.clientCount;
    return PLAN_CONFIGS[office.plan].maxClientsPerMonth > office.clientCount;
  },

  canGenerateDoc: () => {
    const { userType, individual, office } = get();
    // 개인 사용자는 유효한 플랜이 있으면 생성 가능
    if (userType === 'individual') {
      if (!individual || !individual.plan) return false;
      if (!individual.planExpiresAt) return false;
      return individual.planExpiresAt.toDate().getTime() > Date.now();
    }
    if (!office) return false;
    if (get().planExpired()) return PLAN_CONFIGS.starter.maxClientsPerMonth > office.docCountThisMonth;
    return PLAN_CONFIGS[office.plan].maxClientsPerMonth > office.docCountThisMonth;
  },

  hasPro: () => {
    const { userType, individual, office } = get();
    if (userType === 'individual') {
      // 개인 사용자는 self_plus 이상이면 pro급
      if (!individual || !individual.plan) return false;
      return individual.plan === 'self_plus' || individual.plan === 'full';
    }
    if (!office) return false;
    if (get().planExpired()) return false;
    return office.plan === 'pro' || office.plan === 'enterprise';
  },

  planExpired: () => {
    const { userType, individual, office } = get();
    if (userType === 'individual') {
      if (!individual || !individual.planExpiresAt) return false;
      return individual.planExpiresAt.toDate().getTime() < Date.now();
    }
    if (!office || !office.planExpiry) return false;
    return office.planExpiry.toDate().getTime() < Date.now();
  },
}));
