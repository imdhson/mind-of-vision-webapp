import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CameraManager } from '@/features/camera/CameraManager';
import { CalibrationManager } from '@/features/calibration/CalibrationManager';
import { VisionPipeline } from '@/features/pipeline/VisionPipeline';
import { defaultProfile, loadProfile } from '@/features/camera/CameraCalibration';
import type { CameraProfile } from '@/types';
import { useObjectStore } from '@/stores/objectStore';
import { useDevicePitch } from '@/hooks/useDeviceOrientation';
import { useWakeLock } from '@/hooks/useWakeLock';

const Ctx = createContext<ReturnType<typeof makeContext> | null>(null);
function makeContext(camera: CameraManager, pipeline: VisionPipeline, calibration: CalibrationManager) {
  return { camera, pipeline, calibration };
}
export function useRuntime() {
  const v = useContext(Ctx);
  if (!v) throw new Error('Runtime missing');
  return v;
}

export function AppRuntime({ children }: { children: ReactNode }) {
  const camera = useMemo(() => new CameraManager(), []);
  const pipeline = useMemo(() => new VisionPipeline(), []);
  const calibration = useMemo(() => new CalibrationManager(), []);
  const ctx = useMemo(() => makeContext(camera, pipeline, calibration), [camera, pipeline, calibration]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [profile, setProfile] = useState<CameraProfile>(defaultProfile());
  const pitch = useDevicePitch();
  useWakeLock(true);

  useEffect(() => {
    calibration.init();
    return () => {
      pipeline.stop();
      camera.stop();
    };
  }, [calibration, pipeline, camera]);
  useEffect(() => {
    (window as any).__MOV_RUNTIME__ = { ...ctx, videoRef, profile, setProfile, pitch };
    return () => {
      delete (window as any).__MOV_RUNTIME__;
    };
  }, [ctx, profile, pitch]);

  useEffect(() => {
    const onDevice = async () => useObjectStore.getState().setCameraDevices(await camera.refreshDevices());
    navigator.mediaDevices?.addEventListener?.('devicechange', onDevice);
    onDevice().catch(() => {});
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onDevice);
  }, [camera]);

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

export function runtimeExtras() {
  return (window as any).__MOV_RUNTIME__ as {
    videoRef: React.MutableRefObject<HTMLVideoElement | null>;
    profile: CameraProfile;
    setProfile: React.Dispatch<React.SetStateAction<CameraProfile>>;
    pitch?: number;
  };
}

export async function profileForCurrentCamera(camera: CameraManager) {
  const d = camera.devices.find((x) => x.deviceId === camera.currentDeviceId);
  return loadProfile(camera.currentDeviceId, d?.label || '카메라');
}
