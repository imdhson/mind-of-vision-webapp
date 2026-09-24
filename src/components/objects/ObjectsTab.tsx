import { useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useObject } from '../../hooks/useSelectedObject';
import { TRACKING_STATE_KO, fmtDistance } from '../../utils/format';
import { Section, Segmented, cx } from '../common/ui';
import { IconChevron } from '../common/Icons';
import { ObjectDetails } from './ObjectDetails';
import { CalibrationPanel } from '../calibration/CalibrationPanel';
import { CameraSettings } from '../calibration/CameraSettings';
import { SavedCalibrations } from '../calibration/SavedCalibrations';
import { AppSettings } from './AppSettings';

/** 객체 목록 탭: 실시간 객체 목록 + 상세/보정 + 카메라 설정/보정 + 저장된 보정값 관리 */
export function ObjectsTab() {
  const order = useObjectStore((s) => s.order);
  const selectedId = useObjectStore((s) => s.selectedId);

  return (
    <div className="scroll-thin h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-2xl px-3 pb-6 pt-3">
        <Section title={`인식 중인 객체 ${order.length}`}>
          {order.length === 0 ? (
            <p className="px-3 py-4 text-[12.5px] text-muted">
              인식된 객체가 없습니다. 카메라 탭에서 카메라를 시작하고 주변을 비춰 보세요.
            </p>
          ) : (
            <ul className="divide-y divide-line" data-testid="object-list">
              {order.map((id) => (
                <ObjectRow key={id} id={id} selected={id === selectedId} />
              ))}
            </ul>
          )}
        </Section>
        <CameraSettings />
        <SavedCalibrations />
        <AppSettings />
      </div>
    </div>
  );
}

function ObjectRow({ id, selected }: { id: string; selected: boolean }) {
  const o = useObject(id);
  const [view, setView] = useState<'details' | 'calibrate'>('details');
  if (!o) return null;
  const hasCal = o.calibration.hasSession || !!o.calibrationId || Object.keys(o.calibration.values).length > 0;
  return (
    <li>
      <button
        type="button"
        className={cx('flex w-full items-center gap-3 px-3 py-2.5 text-left', selected && 'bg-surface-2')}
        aria-expanded={selected}
        onClick={() => useObjectStore.getState().select(selected ? null : id)}
      >
        <span
          className={cx(
            'size-2 shrink-0 rounded-full',
            o.trackingState === 'tracking' ? 'bg-fg' : 'border border-muted bg-transparent',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">
            {o.label}
            {hasCal ? <span className="ml-1.5 text-[10px] font-semibold text-muted">보정</span> : null}
          </span>
          <span className="block text-[11px] text-muted">
            {TRACKING_STATE_KO[o.trackingState]} · 신뢰도 {Math.round(o.confidence * 100)}%
          </span>
        </span>
        <span className="text-right tabular">
          <span className="block text-[14px] font-semibold">{fmtDistance(o.correctedDistance)}</span>
        </span>
        <IconChevron size={16} className={cx('text-muted transition-transform', selected && 'rotate-90')} />
      </button>
      {selected ? (
        <div className="border-t border-line px-3 pb-3 pt-2">
          <Segmented
            className="mb-2"
            value={view}
            onChange={setView}
            options={[
              { value: 'details', label: '상세정보' },
              { value: 'calibrate', label: '보정' },
            ]}
          />
          {view === 'details' ? <ObjectDetails object={o} /> : <CalibrationPanel key={o.id} object={o} />}
        </div>
      ) : null}
    </li>
  );
}
