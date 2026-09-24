import { useObjectStore } from '../stores/objectStore';
import { useCalibrationStore } from '../stores/calibrationStore';
import { useCameraStore } from '../stores/cameraStore';
import { useUIStore } from '../stores/uiStore';

/**
 * 자동화 테스트(E2E)용 디버그 브리지. URL 에 ?debug=1 이 있을 때만 활성화됩니다.
 * 일반 사용 시에는 전역 객체를 노출하지 않습니다.
 */
export interface DebugBridge {
  objects: typeof useObjectStore;
  calibration: typeof useCalibrationStore;
  camera: typeof useCameraStore;
  ui: typeof useUIStore;
  /** 3D 객체 중심의 화면 좌표 (VisionScene 이 등록) */
  projectObject?: (id: string) => { x: number; y: number } | null;
}

export const debugEnabled =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

export function getDebugBridge(): DebugBridge | null {
  if (!debugEnabled) return null;
  const w = window as unknown as { __movDebug?: DebugBridge };
  if (!w.__movDebug) {
    w.__movDebug = {
      objects: useObjectStore,
      calibration: useCalibrationStore,
      camera: useCameraStore,
      ui: useUIStore,
    };
  }
  return w.__movDebug;
}
