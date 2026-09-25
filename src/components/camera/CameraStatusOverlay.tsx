import { getCameraManager } from '../../features/camera/CameraManager';
import { deviceDisplayName } from '../../features/camera/CameraDeviceService';
import { startDeviceTilt } from '../../services/deviceTilt';
import { useCameraStore } from '../../stores/cameraStore';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { IconCamera } from '../common/Icons';

/** 카메라 대기/오류/로딩 상태 표시 (영상 위 중앙) */
export function CameraStatusOverlay() {
  const status = useCameraStore((s) => s.status);
  const error = useCameraStore((s) => s.error);
  const devices = useCameraStore((s) => s.devices);
  const detectorStatus = useObjectStore((s) => s.detectorStatus);
  const detectorMessage = useObjectStore((s) => s.detectorMessage);

  const start = () => {
    void startDeviceTilt();
    void getCameraManager().start(useUIStore.getState().preferredDeviceId);
  };

  if (status === 'running' || status === 'switching') {
    if (detectorStatus === 'loading' || detectorStatus === 'error') {
      return (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
          <span className="rounded-full bg-overlay px-3.5 py-1.5 text-[12px] font-medium text-fg shadow-sm backdrop-blur-md">
            {detectorStatus === 'loading' ? (detectorMessage ?? 'AI 모델 준비 중…') : detectorMessage}
          </span>
        </div>
      );
    }
    if (status === 'switching') {
      return (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className="rounded-full bg-overlay px-3.5 py-1.5 text-[12px] font-medium shadow-sm backdrop-blur-md">
            카메라 전환 중…
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center text-white">
      <div className="max-w-xs">
        {status === 'requesting' ? (
          <p className="text-[13px] text-white/80">카메라 권한을 확인하는 중…</p>
        ) : (
          <>
            {error ? (
              <p className="mb-3 text-[13px] leading-relaxed text-white/85" role="alert">
                {error.message}
              </p>
            ) : null}
            <button
              type="button"
              onClick={start}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-bold text-accent-fg shadow-lg active:opacity-85"
            >
              <IconCamera size={18} />
              {error ? '다시 시도' : '카메라 시작'}
            </button>
            {error && devices.length > 1 ? (
              <div className="mt-4 space-y-1.5">
                <p className="text-[11px] text-white/60">다른 카메라 선택</p>
                {devices.map((d, i) => (
                  <button
                    key={d.deviceId || i}
                    type="button"
                    className="block w-full truncate rounded-2xl bg-white/10 px-3 py-2 text-[12px] text-white/90"
                    onClick={() => {
                      void startDeviceTilt();
                      void getCameraManager().switchTo(d.deviceId);
                    }}
                  >
                    {deviceDisplayName(d, i)}
                  </button>
                ))}
              </div>
            ) : null}
            {!error && detectorStatus === 'loading' ? (
              <p className="mt-3 text-[11px] text-white/60">{detectorMessage ?? 'AI 모델 준비 중…'}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
