import { useObjectStore } from '../../stores/objectStore';
import { useCameraStore } from '../../stores/cameraStore';
import { cx } from './ui';

/** 극단적으로 얇은 헤더 (32px + 안전 영역) */
export function Header() {
  const detectorStatus = useObjectStore((s) => s.detectorStatus);
  const detectorMessage = useObjectStore((s) => s.detectorMessage);
  const fps = useObjectStore((s) => s.stats.detectionFps);
  const count = useObjectStore((s) => s.order.length);
  const camStatus = useCameraStore((s) => s.status);

  let status: string;
  if (detectorStatus === 'loading') status = detectorMessage ?? 'AI 모델 준비 중';
  else if (detectorStatus === 'error') status = 'AI 오류';
  else if (camStatus !== 'running') status = 'AI 준비됨';
  else status = `${count}개 · ${fps.toFixed(0)} fps`;

  return (
    <header className="safe-top shrink-0 border-b border-line bg-bg">
      <div className="flex h-8 items-center justify-between px-3">
        <h1 className="text-[13px] font-semibold tracking-tight">Mind of Vision</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-muted tabular" aria-live="polite">
          <span
            className={cx(
              'inline-block size-1.5 rounded-full',
              detectorStatus === 'ready' && camStatus === 'running' && 'bg-fg',
              detectorStatus === 'loading' && 'animate-pulse bg-muted',
              detectorStatus === 'error' && 'bg-danger',
              (detectorStatus === 'idle' || (detectorStatus === 'ready' && camStatus !== 'running')) && 'bg-line',
            )}
          />
          <span title={detectorMessage ?? undefined}>{status}</span>
        </div>
      </div>
    </header>
  );
}
