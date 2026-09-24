import { create } from 'zustand';
import type { ActiveCameraInfo, CameraDeviceInfo, CameraError, CameraStatus } from '../types';

interface CameraState {
  status: CameraStatus;
  error: CameraError | null;
  devices: CameraDeviceInfo[];
  active: ActiveCameraInfo | null;
  /** 스트림 세대 번호: 카메라가 바뀔 때마다 증가 */
  generation: number;
  /** 기기 기울기 센서로 측정한 카메라 피치(rad, +아래). 센서 없으면 null */
  sensorPitch: number | null;
  set(partial: Partial<Omit<CameraState, 'set'>>): void;
}

export const useCameraStore = create<CameraState>((set) => ({
  status: 'idle',
  error: null,
  devices: [],
  active: null,
  generation: 0,
  sensorPitch: null,
  set(partial) {
    set(partial);
  },
}));
