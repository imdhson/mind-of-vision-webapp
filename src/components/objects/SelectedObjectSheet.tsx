import { useEffect, useState } from 'react';
import { useSelectedObject } from '../../hooks/useSelectedObject';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { TRACKING_STATE_KO, describeYaw, fmtDistance, fmtPercent } from '../../utils/format';
import { IconClose } from '../common/Icons';
import { Badge, Segmented, cx } from '../common/ui';
import { ObjectDetails } from './ObjectDetails';
import { CalibrationPanel } from '../calibration/CalibrationPanel';

type View = 'summary' | 'details' | 'calibrate';

/**
 * 카메라·3D 화면 하단의 선택 객체 시트.
 * 기본은 한 줄 요약(화면을 가리지 않음) → 상세/보정을 펼쳐서 확인·입력합니다.
 */
export function SelectedObjectSheet({ context }: { context: 'camera' | 'vision' }) {
  const object = useSelectedObject();
  const endedLabel = useObjectStore((s) => s.selectionEndedLabel);
  const dismissEnded = useObjectStore((s) => s.dismissSelectionEnded);
  const tab = useUIStore((s) => s.tab);
  const [view, setView] = useState<View>('summary');
  const objectId = object?.id ?? null;

  useEffect(() => {
    if (!objectId) setView('summary');
  }, [objectId]);

  const visible = tab === context;

  if (!object) {
    if (endedLabel && visible) {
      return (
        <div className="absolute inset-x-2 bottom-2 z-30 flex items-center justify-between rounded-xl bg-overlay px-3 py-2.5 text-[12.5px] backdrop-blur-xl">
          <span>{endedLabel}의 추적이 종료되었습니다.</span>
          <button type="button" className="p-1" aria-label="닫기" onClick={dismissEnded}>
            <IconClose size={16} />
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="absolute inset-x-2 bottom-2 z-30 mx-auto max-w-xl rounded-2xl bg-overlay text-fg shadow-lg backdrop-blur-xl"
      data-testid={`selected-sheet-${context}`}
    >
      <div className="flex items-center gap-3 px-3.5 pb-2 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold" data-testid="selected-label">
              {object.label}
            </span>
            <Badge>{fmtPercent(object.confidence)}</Badge>
            {object.trackingState !== 'tracking' ? <Badge>{TRACKING_STATE_KO[object.trackingState]}</Badge> : null}
            {object.calibration.hasSession || object.calibrationId || Object.keys(object.calibration.values).length ? (
              <Badge tone="strong">보정</Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted tabular">
            방향 {describeYaw(object.orientation.facingYaw)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-semibold leading-none tabular">{fmtDistance(object.correctedDistance)}</div>
          {object.estimatedDistance != null &&
          object.correctedDistance != null &&
          Math.abs(object.estimatedDistance - object.correctedDistance) > 0.005 ? (
            <div className="mt-0.5 text-[10.5px] text-muted tabular">추정 {fmtDistance(object.estimatedDistance)}</div>
          ) : (
            <div className="mt-0.5 text-[10.5px] text-muted">추정 거리</div>
          )}
        </div>
        <button
          type="button"
          aria-label="선택 해제"
          className="-mr-1 grid size-9 place-items-center rounded-full active:bg-surface-2"
          onClick={() => useObjectStore.getState().select(null)}
        >
          <IconClose size={17} />
        </button>
      </div>
      <div className="px-3 pb-2.5">
        <Segmented<View>
          value={view}
          onChange={(v) => setView(v === view ? 'summary' : v)}
          options={[
            { value: 'summary', label: '요약' },
            { value: 'details', label: '상세정보' },
            { value: 'calibrate', label: '보정' },
          ]}
        />
      </div>
      <div
        className={cx(
          'scroll-thin overflow-y-auto overscroll-contain px-3.5',
          view === 'summary' ? 'hidden' : 'max-h-[min(52vh,440px)] pb-3',
        )}
      >
        {view === 'details' ? <ObjectDetails object={object} /> : null}
        {view === 'calibrate' ? <CalibrationPanel key={object.id} object={object} /> : null}
      </div>
    </div>
  );
}
