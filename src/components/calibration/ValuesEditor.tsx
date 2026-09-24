import { useMemo, useState } from 'react';
import type { CalibrationValues } from '../../types';
import { CALIBRATION_FIELDS, validateCalibrationValues } from '../../features/calibration/CalibrationManager';
import { Button, NumberField } from '../common/ui';
import { fmtMeters } from '../../utils/format';

/**
 * 저장된 보정값 편집기 (객체 목록 탭 · 실시간 객체 없이 편집)
 * 실제 거리는 실시간 객체의 추정값을 기준으로 기록해야 하므로 여기서는 삭제만 가능합니다.
 */
export function ValuesEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: CalibrationValues;
  onSave: (v: CalibrationValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CalibrationValues>(initial);
  const errors = useMemo(() => validateCalibrationValues(values), [values]);
  const hasErrors = Object.values(errors).some(Boolean);
  const fields = CALIBRATION_FIELDS.filter((f) => f.key !== 'measuredDistance');
  return (
    <div className="space-y-2.5">
      {values.measuredDistance != null ? (
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[12px]">
          <span>
            실제 거리 기준 {fmtMeters(values.measuredDistance)}
            <span className="ml-1 text-muted">(당시 추정 {fmtMeters(values.referenceRawDistance)})</span>
          </span>
          <button
            type="button"
            className="text-danger"
            onClick={() =>
              setValues((v) => {
                const n = { ...v };
                delete n.measuredDistance;
                delete n.referenceRawDistance;
                return n;
              })
            }
          >
            제거
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5">
        {fields.map((spec) => (
          <NumberField
            key={spec.key}
            label={spec.label}
            unit={spec.unit}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={values[spec.key]}
            error={errors[spec.key]}
            disabled={spec.key === 'distanceOffset' && values.measuredDistance != null}
            onChange={(v) =>
              setValues((prev) => {
                const n = { ...prev };
                if (v === undefined) delete n[spec.key];
                else n[spec.key] = v;
                return n;
              })
            }
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" disabled={hasErrors} onClick={() => void onSave(values)}>
          저장
        </Button>
        <Button onClick={onCancel}>취소</Button>
      </div>
    </div>
  );
}

export function summarizeValues(v: CalibrationValues): string {
  const parts: string[] = [];
  if (v.measuredDistance != null) parts.push(`실측 ${v.measuredDistance}m`);
  if (v.distanceOffset != null) parts.push(`거리 ${v.distanceOffset > 0 ? '+' : ''}${v.distanceOffset}m`);
  if (v.realHeight != null) parts.push(`높이 ${v.realHeight}m`);
  if (v.realWidth != null) parts.push(`너비 ${v.realWidth}m`);
  if (v.offsetX != null || v.offsetY != null || v.offsetZ != null)
    parts.push(`위치 ${v.offsetX ?? 0}/${v.offsetY ?? 0}/${v.offsetZ ?? 0}m`);
  if (v.yawOffsetDeg != null) parts.push(`방향 ${v.yawOffsetDeg}°`);
  return parts.join(' · ') || '값 없음';
}
