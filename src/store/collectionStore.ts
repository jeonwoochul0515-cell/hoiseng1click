import { create } from 'zustand';

interface CollectionState {
  step: number;
  consents: boolean[];
  selectedBanks: string[];
  authMethod: 'cert' | 'kakao' | 'pass' | 'finCert';
  credentials: { loginType: string; id: string; password: string };
  progress: number;
  bankStatuses: Record<string, 'waiting' | 'collecting' | 'done' | 'error'>;
  result: { debts: any[]; assets: any[]; summary: any } | null;
  error: string | null;

  setStep: (step: number) => void;
  setConsent: (index: number, value: boolean) => void;
  toggleBank: (bank: string) => void;
  setAuthMethod: (method: CollectionState['authMethod']) => void;
  setCredentials: (creds: CollectionState['credentials']) => void;
  setProgress: (progress: number) => void;
  setBankStatus: (bank: string, status: 'waiting' | 'collecting' | 'done' | 'error') => void;
  setResult: (result: CollectionState['result']) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const INITIAL: Omit<CollectionState, 'setStep' | 'setConsent' | 'toggleBank' | 'setAuthMethod' | 'setCredentials' | 'setProgress' | 'setBankStatus' | 'setResult' | 'setError' | 'reset'> = {
  step: 1,
  consents: [false, false, false, false],
  selectedBanks: [],
  authMethod: 'cert',
  credentials: { loginType: 'cert', id: '', password: '' },
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
