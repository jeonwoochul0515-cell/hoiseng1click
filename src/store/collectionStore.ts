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
  reset: () => void;
}

const INITIAL: Omit<CollectionState, 'setStep' | 'setConsent' | 'toggleBank' | 'setAuthMethod' | 'setUserName' | 'setBirthDate' | 'setPhoneNo' | 'setProvider' | 'setAuthStatus' | 'setTwoWayInfo' | 'setConnectedId' | 'setAuthExpiry' | 'setCredentials' | 'setProgress' | 'setBankStatus' | 'setResult' | 'setError' | 'reset'> = {
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
  reset: () => set(INITIAL),
}));
