import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  upgradeModalOpen: boolean;
  toggleSidebar: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  upgradeModalOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openUpgradeModal: () => set({ upgradeModalOpen: true }),
  closeUpgradeModal: () => set({ upgradeModalOpen: false }),
}));
