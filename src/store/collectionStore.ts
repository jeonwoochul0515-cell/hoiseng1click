import { create } from 'zustand';

interface TwoWayInfo {
  jobIndex: number;
  threadIndex: number;
  jti: string;
  twoWayTimestamp: number;
}

interface CollectionState {
  step: number;
  consents: boolean[];
  selectedBanks: string[];
  authMethod: 'simple';  // 간편인증 고정
  // 간편인증 정보
  userName: string;
  birthDate: string;
  phoneNo: string;
  provider: string;
  // 간편인증 상태
  authStatus: 'idle' | 'requesting' | 'pending' | 'done' | 'error';
  twoWayInfo: TwoWayInfo | null;
  connectedId: string | null;
  authExpiry: number | null; // twoWayInfo 만료 시각 (ms)
  // 레거시 (codefCollect 호환)
  credentials: { loginType: string; id: string; password: string };
  // 수집 상태
  progress: number;
  bankStatuses: Record<string, 'waiting' | 'collecting' | 'done' | 'error'>;
  result: { debts: any[]; assets: any[]; summary: any; connectedId?: string } | null;
  error: string | null;

  // Week 4: 크레딧포유 PDF 관련
  creditPdfStatus: 'idle' | 'uploading' | 'parsing' | 'done' | 'error';
  creditPdfDebts: any[];
  // Week 4: 공공기관 인증
  publicConnectedIds: Record<string, string>; // org -> connectedId
  // Week 4: 서류 체크리스트 상태
  docStatuses: Record<string, 'todo' | 'auto' | 'uploaded' | 'verified'>;
  // Week 4: 수동 보완
  manualDebts: any[];     // 사채 등 수동 입력 채무
  leaseDeposit: number;   // 임차보증금
  leaseMonthly: number;   // 월세
  retirementEstimate: number; // 퇴직금 추정액

  setStep: (step: number) => void;
  setConsent: (index: number, value: boolean) => void;
  toggleBank: (bank: string) => void;
  setAuthMethod: (method: CollectionState['authMethod']) => void;
  setUserName: (name: string) => void;
  setBirthDate: (date: string) => void;
  setPhoneNo: (phone: string) => void;
  setProvider: (provider: string) => void;
  setAuthStatus: (status: CollectionState['authStatus']) => void;
  setTwoWayInfo: (info: TwoWayInfo | null) => void;
  setConnectedId: (id: string | null) => void;
  setAuthExpiry: (expiry: number | null) => void;
  setCredentials: (creds: CollectionState['credentials']) => void;
  setProgress: (progress: number) => void;
  setBankStatus: (bank: string, status: 'waiting' | 'collecting' | 'done' | 'error') => void;
  setResult: (result: CollectionState['result']) => void;
  setError: (error: string | null) => void;
  // Week 4: 새 액션
  setCreditPdfStatus: (s: 'idle' | 'uploading' | 'parsing' | 'done' | 'error') => void;
  setCreditPdfDebts: (debts: any[]) => void;
  setPublicConnectedId: (org: string, connectedId: string) => void;
  setDocStatus: (docId: string, status: 'todo' | 'auto' | 'uploaded' | 'verified') => void;
  addManualDebt: (debt: any) => void;
  removeManualDebt: (index: number) => void;
  setLeaseInfo: (deposit: number, monthly: number) => void;
  setRetirementEstimate: (amount: number) => void;
  reset: () => void;
}

const INITIAL: Omit<CollectionState, 'setStep' | 'setConsent' | 'toggleBank' | 'setAuthMethod' | 'setUserName' | 'setBirthDate' | 'setPhoneNo' | 'setProvider' | 'setAuthStatus' | 'setTwoWayInfo' | 'setConnectedId' | 'setAuthExpiry' | 'setCredentials' | 'setProgress' | 'setBankStatus' | 'setResult' | 'setError' | 'setCreditPdfStatus' | 'setCreditPdfDebts' | 'setPublicConnectedId' | 'setDocStatus' | 'addManualDebt' | 'removeManualDebt' | 'setLeaseInfo' | 'setRetirementEstimate' | 'reset'> = {
  step: 1,
  consents: [false, false, false, false],
  selectedBanks: [],
  authMethod: 'simple',
  userName: '',
  birthDate: '',
  phoneNo: '',
  provider: '1',
  authStatus: 'idle',
  twoWayInfo: null,
  connectedId: null,
  authExpiry: null,
  credentials: { loginType: 'simple', id: '', password: '' },
  progress: 0,
  bankStatuses: {},
  result: null,
  error: null,
  // Week 4: 초기값
  creditPdfStatus: 'idle',
  creditPdfDebts: [],
  publicConnectedIds: {},
  docStatuses: {},
  manualDebts: [],
  leaseDeposit: 0,
  leaseMonthly: 0,
  retirementEstimate: 0,
};

export const useCollectionStore = create<CollectionState>((set) => ({
  ...INITIAL,
  setStep: (step) => set({ step }),
  setConsent: (index, value) =>
    set((s) => {
      const consents = [...s.consents];
      consents[index] = value;
      return { consents };
    }),
  toggleBank: (bank) =>
    set((s) => ({
      selectedBanks: s.selectedBanks.includes(bank)
        ? s.selectedBanks.filter((b) => b !== bank)
        : [...s.selectedBanks, bank],
    })),
  setAuthMethod: (authMethod) => set({ authMethod }),
  setUserName: (userName) => set({ userName }),
  setBirthDate: (birthDate) => set({ birthDate }),
  setPhoneNo: (phoneNo) => set({ phoneNo }),
  setProvider: (provider) => set({ provider }),
  setAuthStatus: (authStatus) => set({ authStatus }),
  setTwoWayInfo: (twoWayInfo) => set({ twoWayInfo }),
  setConnectedId: (connectedId) => set({ connectedId }),
  setAuthExpiry: (authExpiry) => set({ authExpiry }),
  setCredentials: (credentials) => set({ credentials }),
  setProgress: (progress) => set({ progress }),
  setBankStatus: (bank, status) =>
    set((s) => ({
      bankStatuses: { ...s.bankStatuses, [bank]: status },
    })),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  // Week 4: 새 액션 구현
  setCreditPdfStatus: (creditPdfStatus) => set({ creditPdfStatus }),
  setCreditPdfDebts: (creditPdfDebts) => set({ creditPdfDebts }),
  setPublicConnectedId: (org, connectedId) =>
    set((s) => ({
      publicConnectedIds: { ...s.publicConnectedIds, [org]: connectedId },
    })),
  setDocStatus: (docId, status) =>
    set((s) => ({
      docStatuses: { ...s.docStatuses, [docId]: status },
    })),
  addManualDebt: (debt) =>
    set((s) => ({
      manualDebts: [...s.manualDebts, debt],
    })),
  removeManualDebt: (index) =>
    set((s) => ({
      manualDebts: s.manualDebts.filter((_, i) => i !== index),
    })),
  setLeaseInfo: (leaseDeposit, leaseMonthly) => set({ leaseDeposit, leaseMonthly }),
  setRetirementEstimate: (retirementEstimate) => set({ retirementEstimate }),
  reset: () => set(INITIAL),
}));
