import { useEffect, type ReactNode } from 'react';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useCameraStore } from '../../stores/cameraStore';
import { useUIStore } from '../../stores/uiStore';
import { getVisionPipeline } from '../../features/pipeline/VisionPipeline';
import { getCameraManager } from '../../features/camera/CameraManager';
import { initSettings } from '../../services/settings';
import { registerServiceWorker } from '../../services/pwa';
import { useWakeLock } from '../../hooks/useWakeLock';

let booted = false;

/**
 * 앱 런타임: 저장된 보정값/설정 로드 → AI 모델 로드 → 처리 파이프라인 시작 → 카메라 자동 시작(권한 보유 시)
 * 화면 꺼짐 방지는 카메라가 실행 중일 때만 활성화합니다.
 */
export function AppRuntime({ children }: { children: ReactNode }) {
  const cameraRunning = useCameraStore((s) => s.status === 'running' || s.status === 'switching');
  const modelId = useUIStore((s) => s.modelId);
  useWakeLock(cameraRunning);

  useEffect(() => {
    if (booted) return;
    booted = true;
    const pipeline = getVisionPipeline();
    void (async () => {
      await Promise.all([useCalibrationStore.getState().load(), initSettings()]);
      pipeline.start();
      await autoStartCamera();
    })();
    registerServiceWorker();
  }, []);

  useEffect(() => {
    void getVisionPipeline()
      .loadModel(modelId)
      .catch(() => undefined);
  }, [modelId]);

  // 선택한 카메라 기억
  useEffect(
    () =>
      useCameraStore.subscribe((s, prev) => {
        const id = s.active?.deviceId;
        if (id && id !== prev.active?.deviceId) useUIStore.getState().setPreferredDeviceId(id);
      }),
    [],
  );

  return <>{children}</>;
}

async function autoStartCamera() {
  try {
    const perm = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    if (perm?.state === 'granted') {
      await getCameraManager().start(useUIStore.getState().preferredDeviceId);
    }
  } catch {
    // permissions API 미지원(일부 Safari/Firefox): 사용자가 시작 버튼을 누를 때 요청
  }
}
