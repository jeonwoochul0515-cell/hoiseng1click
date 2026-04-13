import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface UiState {
  sidebarOpen: boolean;
  upgradeModalOpen: boolean;
  toasts: Toast[];
  goldBurst: { show: boolean; message: string };
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showGoldBurst: (message?: string) => void;
  hideGoldBurst: () => void;
}

let toastCounter = 0;

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: false,
  upgradeModalOpen: false,
  toasts: [],
  goldBurst: { show: false, message: '서류 생성 완료!' },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  openUpgradeModal: () => set({ upgradeModalOpen: true }),
  closeUpgradeModal: () => set({ upgradeModalOpen: false }),
  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  showGoldBurst: (message) =>
    set({ goldBurst: { show: true, message: message ?? '서류 생성 완료!' } }),
  hideGoldBurst: () =>
    set((s) => ({ goldBurst: { ...s.goldBurst, show: false } })),
}));
