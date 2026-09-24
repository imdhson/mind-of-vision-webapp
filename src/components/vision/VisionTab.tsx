import { useMemo, useState } from 'react';
import { useSystemTheme } from '../../hooks/useSystemTheme';
import { useCameraStore } from '../../stores/cameraStore';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useObjectStore } from '../../stores/objectStore';
import { VisionScene } from '../../features/visualization/VisionScene';
import { DARK_PALETTE, LIGHT_PALETTE } from '../../features/visualization/palette';
import {
  computeIntrinsics,
  createDefaultProfile,
  profileKey,
  zoomFactorOf,
} from '../../features/camera/CameraCalibration';
import { SelectedObjectSheet } from '../objects/SelectedObjectSheet';
import { OverlayButton } from '../common/ui';
import { IconHome } from '../common/Icons';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** 3D 시각화 탭 */
export default function VisionTab({ active }: { active: boolean }) {
  const theme = useSystemTheme();
  const palette = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const [autoMode, setAutoMode] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [webgl] = useState(hasWebGL);
  const count = useObjectStore((s) => s.order.length);
  const hfovRad = useHorizontalFov();

  if (!webgl) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-[14px] font-medium">이 기기·브라우저에서 3D(WebGL)를 사용할 수 없습니다.</p>
          <p className="mt-1 text-[12px] text-muted">설정 탭에서 거리와 위치를 확인할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full touch-none bg-bg">
      <VisionScene
        active={active}
        palette={palette}
        hfovRad={hfovRad}
        autoMode={autoMode}
        onUserInteract={() => setAutoMode(false)}
        resetToken={resetToken}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
        <span className="rounded-full bg-overlay px-2.5 py-1 text-[11px] text-muted backdrop-blur-md tabular">
          카메라 기준 상대 위치 · {count}개
        </span>
        <OverlayButton
          className="pointer-events-auto"
          aria-label="기본 시점으로 복귀"
          title={autoMode ? '기본 시점 (자동 확대·축소 중)' : '기본 시점으로 복귀'}
          active={!autoMode}
          onClick={() => {
            setAutoMode(true);
            setResetToken((t) => t + 1);
          }}
        >
          <IconHome />
          <span className="pr-0.5">{autoMode ? '자동' : '기본 시점'}</span>
        </OverlayButton>
      </div>
      <SelectedObjectSheet context="vision" />
    </div>
  );
}

/** 현재 카메라의 수평 화각 (3D 시야 부채꼴 표시용) */
function useHorizontalFov(): number | null {
  const active = useCameraStore((s) => s.active);
  const profiles = useCalibrationStore((s) => s.profiles);
  return useMemo(() => {
    if (!active || !active.videoWidth) return null;
    const profile = profiles[profileKey(active.deviceId)] ?? createDefaultProfile(active);
    const K = computeIntrinsics(
      profile,
      active.videoWidth,
      active.videoHeight,
      zoomFactorOf(active.currentZoom, active.zoom?.min ?? null),
    );
    return 2 * Math.atan(active.videoWidth / 2 / K.fx);
  }, [active, profiles]);
}
