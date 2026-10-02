import { create } from 'zustand';
import type { CameraDevice, SpatialObject, TabId } from '@/types';
import type { ModelId } from '@/features/detection/ModelLoader';

type State = {
  tab: TabId;
  objects: SpatialObject[];
  selectedId: string | null;
  cameraDevices: CameraDevice[];
  activeDeviceId: string;
  cameraRunning: boolean;
  modelId: ModelId;
  modelStatus: 'idle'|'loading'|'ready'|'error';
  backend: string;
  message: string;
  setTab: (tab: TabId) => void;
  setObjects: (objects: SpatialObject[]) => void;
  select: (id: string | null) => void;
  setCameraDevices: (devices: CameraDevice[]) => void;
  setActiveDeviceId: (id: string) => void;
  setCameraRunning: (v: boolean) => void;
  setModelId: (id: ModelId) => void;
  setModelState: (s: Partial<Pick<State,'modelStatus'|'backend'|'message'>>) => void;
};

export const useObjectStore = create<State>((set) => ({
  tab: 'camera', objects: [], selectedId: null, cameraDevices: [], activeDeviceId: '', cameraRunning: false,
  modelId: 'coco-ssd-lite', modelStatus: 'idle', backend: 'unknown', message: '',
  setTab: (tab) => set({ tab }),
  setObjects: (objects) => set((s) => ({ objects, selectedId: s.selectedId && objects.some((o) => o.id === s.selectedId) ? s.selectedId : s.selectedId })),
  select: (selectedId) => set({ selectedId }),
  setCameraDevices: (cameraDevices) => set({ cameraDevices }),
  setActiveDeviceId: (activeDeviceId) => set({ activeDeviceId }),
  setCameraRunning: (cameraRunning) => set({ cameraRunning }),
  setModelId: (modelId) => set({ modelId }),
  setModelState: (s) => set(s)
}));
