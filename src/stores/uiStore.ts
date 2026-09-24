import { create } from 'zustand';

export type TabId = 'camera' | 'vision' | 'objects';
export type FitMode = 'contain' | 'cover';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error' | 'success';
}

interface UIState {
  tab: TabId;
  fitMode: FitMode;
  modelId: string;
  preferredDeviceId: string | null;
  toasts: Toast[];
  setTab(tab: TabId): void;
  setFitMode(mode: FitMode): void;
  setModelId(id: string): void;
  setPreferredDeviceId(id: string | null): void;
  toast(message: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  tab: 'camera',
  fitMode: 'contain',
  modelId: 'coco-ssd-lite',
  preferredDeviceId: null,
  toasts: [],
  setTab: (tab) => set({ tab }),
  setFitMode: (fitMode) => set({ fitMode }),
  setModelId: (modelId) => set({ modelId }),
  setPreferredDeviceId: (preferredDeviceId) => set({ preferredDeviceId }),
  toast(message, kind = 'info') {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 2500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
