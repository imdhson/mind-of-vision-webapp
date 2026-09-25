import { useEffect, useRef, useState } from 'react';
import { getCameraManager } from '../../features/camera/CameraManager';
import { deviceDisplayName, LENS_LABEL_KO } from '../../features/camera/CameraDeviceService';
import { startDeviceTilt } from '../../services/deviceTilt';
import { useCameraStore } from '../../stores/cameraStore';
import { useUIStore } from '../../stores/uiStore';
import { IconCheck, IconFit, IconFlip, IconLens, IconPower, IconRoad } from '../common/Icons';
import { OverlayButton, cx } from '../common/ui';

/** 카메라 화면 상단의 실시간 조작 버튼 (시작/종료 · 차선 인식 · 전면/후면 전환 · 렌즈 선택 · 화면 맞춤) */
export function CameraControls() {
  const status = useCameraStore((s) => s.status);
  const devices = useCameraStore((s) => s.devices);
  const active = useCameraStore((s) => s.active);
  const fitMode = useUIStore((s) => s.fitMode);
  const setFitMode = useUIStore((s) => s.setFitMode);
  const laneDetection = useUIStore((s) => s.laneDetectionEnabled);
  const setLaneDetection = useUIStore((s) => s.setLaneDetectionEnabled);
  const [lensOpen, setLensOpen] = useState(false);
  const running = status === 'running' || status === 'switching';
  const busy = status === 'switching' || status === 'requesting';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
      <div className="pointer-events-auto flex gap-1.5">
        <OverlayButton
          aria-label={running ? '카메라 종료' : '카메라 시작'}
          title={running ? '카메라 종료' : '카메라 시작'}
          active={running}
          disabled={busy}
          onClick={() => {
            if (running) getCameraManager().stop();
            else {
              void startDeviceTilt();
              void getCameraManager().start(useUIStore.getState().preferredDeviceId);
            }
          }}
        >
          <IconPower />
        </OverlayButton>
        <OverlayButton
          aria-label={laneDetection ? '차선 인식 끄기' : '차선 인식 켜기'}
          aria-pressed={laneDetection}
          title={laneDetection ? '차선 인식 끄기' : '차선 인식 켜기'}
          active={laneDetection}
          onClick={() => setLaneDetection(!laneDetection)}
        >
          <IconRoad />
        </OverlayButton>
      </div>
      <div className="pointer-events-auto relative flex gap-1.5">
        <OverlayButton
          aria-label="전면/후면 카메라 전환"
          title="전면/후면 전환"
          disabled={!running || busy || devices.length < 2}
          onClick={() => void getCameraManager().toggleFacing()}
        >
          <IconFlip />
        </OverlayButton>
        <OverlayButton
          aria-label="카메라·렌즈 선택"
          aria-expanded={lensOpen}
          title="카메라·렌즈 선택"
          disabled={busy}
          active={lensOpen}
          onClick={() => {
            void getCameraManager().refreshDevices();
            setLensOpen((v) => !v);
          }}
        >
          <IconLens />
          {active && LENS_LABEL_KO[active.lensKind] ? (
            <span className="pr-0.5">{LENS_LABEL_KO[active.lensKind]}</span>
          ) : null}
        </OverlayButton>
        <OverlayButton
          aria-label={fitMode === 'contain' ? '화면 채우기' : '전체 영상 보기'}
          title={fitMode === 'contain' ? '화면 채우기' : '전체 영상 보기'}
          active={fitMode === 'cover'}
          onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
        >
          <IconFit />
        </OverlayButton>
        {lensOpen ? <LensMenu onClose={() => setLensOpen(false)} /> : null}
      </div>
    </div>
  );
}

function LensMenu({ onClose }: { onClose: () => void }) {
  const devices = useCameraStore((s) => s.devices);
  const active = useCameraStore((s) => s.active);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('pointerdown', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDoc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-[52px] w-72 max-w-[calc(100vw-16px)] rounded-[24px] bg-overlay p-2 text-fg shadow-lg backdrop-blur-xl"
    >
      {devices.length === 0 ? (
        <p className="px-2 py-2 text-[12px] text-muted">카메라를 시작하면 사용 가능한 장치가 표시됩니다.</p>
      ) : (
        devices.map((d, i) => {
          const current = active?.deviceId === d.deviceId;
          const name = deviceDisplayName(d, i);
          return (
            <button
              key={d.deviceId || i}
              role="menuitemradio"
              aria-checked={current}
              type="button"
              className={cx(
                'flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left active:bg-surface-2',
                current && 'bg-accent-soft font-semibold text-accent',
              )}
              onClick={() => {
                onClose();
                void getCameraManager().switchTo(d.deviceId);
              }}
            >
              <span className="grid size-4 place-items-center">{current ? <IconCheck size={15} /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{name}</span>
                {d.label && name !== d.label ? (
                  <span className="block truncate text-[10.5px] text-muted">{d.label}</span>
                ) : null}
              </span>
            </button>
          );
        })
      )}
      {active?.zoom ? <ZoomControl /> : null}
      <p className="px-2 pb-1 pt-1.5 text-[10.5px] leading-snug text-muted">
        브라우저가 제공하는 카메라만 표시됩니다. 초광각·망원 렌즈가 별도 장치로 제공되지 않으면 선택할 수 없습니다.
      </p>
    </div>
  );
}

function ZoomControl() {
  const active = useCameraStore((s) => s.active)!;
  const zoom = active.zoom!;
  const [value, setValue] = useState(active.currentZoom ?? zoom.min);
  return (
    <div className="mt-1 border-t border-line px-2 pt-2">
      <div className="flex items-center justify-between text-[12px] font-medium">
        <span>줌</span>
        <span className="tabular text-muted">{value.toFixed(1)}×</span>
      </div>
      <input
        type="range"
        className="w-full accent-accent"
        min={zoom.min}
        max={zoom.max}
        step={zoom.step || 0.1}
        value={value}
        aria-label="줌 배율"
        onChange={(e) => {
          const z = Number(e.target.value);
          setValue(z);
          void getCameraManager().setZoom(z);
        }}
      />
      <p className="text-[10.5px] text-muted">장치 제공 줌 · 물리 렌즈 전환 여부는 기기가 결정합니다.</p>
    </div>
  );
}
