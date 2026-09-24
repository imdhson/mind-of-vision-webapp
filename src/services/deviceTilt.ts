import { useCameraStore } from '../stores/cameraStore';

/**
 * 기기 기울기(DeviceOrientation) → 후면 카메라 피치 추정
 *
 * W3C 회전 행렬(Z-X'-Y'')에서 지구 "위" 벡터를 기기 좌표로 나타내면
 *   up = (-cosβ·sinγ, sinβ, cosβ·cosγ)
 * 후면 카메라 광축은 기기 -Z 이므로, 수평선 아래로 내려다보는 각도는 asin(up.z) 입니다.
 * (화면 회전 방향과 무관하게 동작, 전면 카메라는 부호 반전)
 * 센서가 없거나 권한이 거부되면 카메라 프로파일의 기본 피치를 사용합니다.
 */
let listening = false;
let lastUpdate = 0;
let smoothed: number | null = null;

export function pitchFromOrientation(betaDeg: number, gammaDeg: number): number {
  const b = (betaDeg * Math.PI) / 180;
  const g = (gammaDeg * Math.PI) / 180;
  const upZ = Math.cos(b) * Math.cos(g);
  return Math.asin(Math.max(-1, Math.min(1, upZ)));
}

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  const now = performance.now();
  const p = pitchFromOrientation(e.beta, e.gamma);
  smoothed = smoothed == null ? p : smoothed + (p - smoothed) * 0.2;
  if (now - lastUpdate > 100) {
    lastUpdate = now;
    useCameraStore.getState().set({ sensorPitch: smoothed });
  }
}

type PermissionFn = () => Promise<'granted' | 'denied'>;

/** iOS 13+ 는 사용자 제스처 안에서 권한 요청이 필요합니다. 카메라 시작 버튼에서 호출하세요. */
export async function startDeviceTilt(): Promise<boolean> {
  if (listening) return true;
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
  const req = (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  if (typeof req === 'function') {
    try {
      if ((await req()) !== 'granted') return false;
    } catch {
      return false;
    }
  }
  window.addEventListener('deviceorientation', onOrientation);
  listening = true;
  return true;
}

export function stopDeviceTilt() {
  if (!listening) return;
  window.removeEventListener('deviceorientation', onOrientation);
  listening = false;
  smoothed = null;
  useCameraStore.getState().set({ sensorPitch: null });
}
