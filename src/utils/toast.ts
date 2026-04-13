import { useUiStore } from '@/store/uiStore';

export const toast = {
  success: (message: string) => useUiStore.getState().addToast({ type: 'success', message }),
  error: (message: string) => useUiStore.getState().addToast({ type: 'error', message }),
  warning: (message: string) => useUiStore.getState().addToast({ type: 'warning', message }),
  info: (message: string) => useUiStore.getState().addToast({ type: 'info', message }),
};
