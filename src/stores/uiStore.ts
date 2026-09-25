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
  /** 근접 경고(안전 알림) 사용 여부 */
  proximityAlertEnabled: boolean;
  /** 이 거리(m) 미만으로 가까워지면 경고 */
  proximityAlertDistance: number;
  /** 차선(도로 경계) 인식 사용 여부 */
  laneDetectionEnabled: boolean;
  setTab(tab: TabId): void;
  setFitMode(mode: FitMode): void;
  setModelId(id: string): void;
  setPreferredDeviceId(id: string | null): void;
  setProximityAlertEnabled(v: boolean): void;
  setProximityAlertDistance(v: number): void;
  setLaneDetectionEnabled(v: boolean): void;
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
  proximityAlertEnabled: false,
  proximityAlertDistance: 1.5,
  laneDetectionEnabled: true,
  setTab: (tab) => set({ tab }),
  setFitMode: (fitMode) => set({ fitMode }),
  setModelId: (modelId) => set({ modelId }),
  setPreferredDeviceId: (preferredDeviceId) => set({ preferredDeviceId }),
  setProximityAlertEnabled: (proximityAlertEnabled) => set({ proximityAlertEnabled }),
  setProximityAlertDistance: (proximityAlertDistance) => set({ proximityAlertDistance }),
  setLaneDetectionEnabled: (laneDetectionEnabled) => set({ laneDetectionEnabled }),
  toast(message, kind = 'info') {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 2500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
