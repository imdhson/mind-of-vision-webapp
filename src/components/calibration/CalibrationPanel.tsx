import { useEffect, useMemo, useState } from 'react';
import type { CalibrationScope, CalibrationValues, TrackedObject } from '../../types';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useCameraStore } from '../../stores/cameraStore';
import {
  CALIBRATION_FIELDS,
  classCalibrationId,
  cleanValues,
  validateCalibrationValues,
  type FieldSpec,
} from '../../features/calibration/CalibrationManager';
import { getVisionPipeline } from '../../features/pipeline/VisionPipeline';
import { fmtDistance } from '../../utils/format';
import { Badge, Button, NumberField, Segmented, cx } from '../common/ui';
import { InstanceLinker } from './InstanceLinker';

type Unit = 'm' | 'cm';

const LENGTH_KEYS = new Set<keyof CalibrationValues>([
  'measuredDistance',
  'distanceOffset',
  'realHeight',
  'realWidth',
  'offsetX',
  'offsetY',
  'offsetZ',
]);

const SIZE_KEYS: (keyof CalibrationValues)[] = ['realHeight', 'realWidth'];

/**
 * 선택한 실시간 객체의 보정값 입력·저장
 *
 * 저장 범위:
 *  - 이 객체(임시): 현재 추적 중에만 적용, 저장하지 않음
 *  - 이 객체(저장): 이 물체 전용 영속 보정. 재실행 후에는 사용자가 직접 "연결"해야 적용
 *  - 모든 {클래스}: 같은 종류 전체의 기본 보정 (영속)
 *
 * 입력 중 값은 "미리보기"로만 반영되며 저장 버튼을 눌러야 확정됩니다.
 * 유효하지 않은 값은 저장되지 않으며 기존 저장값을 변경하지 않습니다.
 */
export function CalibrationPanel({ object }: { object: TrackedObject }) {
  const trackId = object.id;
  const [scope, setScope] = useState<CalibrationScope>('session');
  const store = useCalibrationStore;
  const boundId = useCalibrationStore((s) => s.bindings[trackId]);
  const boundInstance = useCalibrationStore((s) => (boundId ? s.instances[boundId] : undefined));
  const classCal = useCalibrationStore((s) => s.classCals[classCalibrationId(object.classId)]);
  const sessionValues = useCalibrationStore((s) => s.session[trackId]);
  const draft = useCalibrationStore((s) => s.draft);

  const saved: CalibrationValues = useMemo(() => {
    if (scope === 'session') return sessionValues ?? {};
    if (scope === 'instance') return boundInstance?.values ?? {};
    return classCal?.values ?? {};
  }, [scope, sessionValues, boundInstance, classCal]);

  const [values, setValues] = useState<CalibrationValues>(saved);
  const [unit, setUnit] = useState<Unit>('m');
  const [preview, setPreview] = useState(true);
  const [name, setName] = useState(boundInstance?.name ?? object.label);
  const [status, setStatus] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // 범위를 바꾸거나 저장값이 바뀌면(다른 화면에서 저장 등) 입력값을 저장값으로 재설정
  useEffect(() => {
    setValues(saved);
    setDirty(false);
  }, [saved]);

  useEffect(() => {
    if (boundInstance) setName(boundInstance.name);
  }, [boundInstance]);

  const errors = useMemo(() => validateCalibrationValues(values), [values]);
  const hasErrors = Object.values(errors).some(Boolean);

  // 미리보기(저장 전) 반영
  useEffect(() => {
    const setDraft = store.getState().setDraft;
    if (!preview || !dirty || hasErrors) {
      if (store.getState().draft?.trackId === trackId) setDraft(null);
      return;
    }
    const prepared = prepare(values, saved, trackId);
    if (prepared.ok) setDraft({ trackId, scope, values: prepared.values });
  }, [values, preview, dirty, hasErrors, scope, saved, trackId, store]);

  // 패널을 닫으면 미리보기 해제
  useEffect(
    () => () => {
      if (store.getState().draft?.trackId === trackId) store.getState().setDraft(null);
    },
    [trackId, store],
  );

  const setField = (key: keyof CalibrationValues, v: number | undefined) => {
    setDirty(true);
    setStatus(null);
    setValues((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[key];
      else next[key] = v;
      return next;
    });
  };

  const onSave = async () => {
    if (hasErrors) {
      setStatus({ kind: 'error', text: '입력값을 확인하세요. 저장하지 않았습니다.' });
      return;
    }
    const prepared = prepare(values, saved, trackId);
    if (!prepared.ok) {
      setStatus({ kind: 'error', text: prepared.error });
      return;
    }
    const s = store.getState();
    let result;
    if (scope === 'session') result = s.setSession(trackId, prepared.values);
    else if (scope === 'instance')
      result = await s.saveInstance({
        trackId,
        instanceId: boundId ?? null,
        classId: object.classId,
        name,
        values: prepared.values,
        cameraKey: useCameraStore.getState().active?.deviceId ?? null,
        appearance: object.appearance,
      });
    else result = await s.saveClass(object.classId, prepared.values);
    s.setDraft(null);
    setDirty(false);
    if (!result.ok) setStatus({ kind: 'error', text: result.error ?? '저장 실패' });
    else if (scope === 'session') setStatus({ kind: 'ok', text: '적용됨 · 이번 추적에만 사용' });
    else if (!result.persisted)
      setStatus({ kind: 'warn', text: `적용됨 · 영구 저장 실패(이번 실행에만 적용): ${result.error ?? ''}` });
    else setStatus({ kind: 'ok', text: `저장됨 ${new Date().toLocaleTimeString('ko-KR', { hour12: false })}` });
  };

  const onReset = async () => {
    const s = store.getState();
    s.setDraft(null);
    if (scope === 'session') {
      s.clearSession(trackId);
      setStatus({ kind: 'ok', text: '이 객체의 임시 보정을 초기화했습니다.' });
    } else if (scope === 'instance') {
      if (!boundId) return;
      if (!confirm(`'${boundInstance?.name}' 개별 보정값을 삭제할까요?`)) return;
      const r = await s.deleteInstance(boundId);
      setStatus(r.persisted ? { kind: 'ok', text: '개별 보정값을 삭제했습니다.' } : { kind: 'warn', text: r.error ?? '' });
    } else {
      if (!classCal) return;
      if (!confirm(`모든 '${object.className}'에 적용되는 클래스 보정값을 초기화할까요?`)) return;
      const r = await s.deleteClass(object.classId);
      setStatus(r.persisted ? { kind: 'ok', text: '클래스 보정값을 초기화했습니다.' } : { kind: 'warn', text: r.error ?? '' });
    }
    setValues({});
    setDirty(false);
  };

  const previewing = draft?.trackId === trackId;
  const scopeHelp =
    scope === 'session'
      ? '현재 추적 중인 이 객체에만 적용 · 저장되지 않음'
      : scope === 'instance'
        ? '이 물체 전용으로 저장 · 앱 재실행 후에는 "저장된 개별 보정 연결"에서 직접 연결해야 적용'
        : `모든 '${object.className}'에 기본 적용 · 저장됨 (개별/임시 보정이 우선)`;
  const canReset =
    scope === 'session' ? !!sessionValues : scope === 'instance' ? !!boundId : !!classCal;

  return (
    <div className="space-y-3" data-testid="calibration-panel">
      <div className="flex items-baseline justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
        <div className="text-[12px] text-muted">
          추정 <span className="tabular text-fg">{fmtDistance(object.estimatedDistance)}</span>
          <span className="mx-1.5">→</span>
          보정 <span className="tabular font-semibold text-fg" data-testid="corrected-distance">{fmtDistance(object.correctedDistance)}</span>
        </div>
        {previewing ? <Badge tone="strong">미리보기 · 저장 안 됨</Badge> : null}
      </div>

      <div>
        <Segmented<CalibrationScope>
          value={scope}
          onChange={(v) => {
            store.getState().setDraft(null);
            setScope(v);
            setStatus(null);
          }}
          options={[
            { value: 'session', label: '이 객체 · 임시' },
            { value: 'instance', label: '이 객체 · 저장' },
            { value: 'class', label: `모든 ${object.className}` },
          ]}
        />
        <p className="mt-1 px-0.5 text-[11px] leading-snug text-muted">{scopeHelp}</p>
      </div>

      {scope === 'instance' ? (
        <>
          <InstanceLinker object={object} />
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium">보정 이름</span>
            <input
              className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[14px] outline-none focus:border-fg"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </>
      ) : null}

      <div className="flex items-center justify-between">
        <Segmented<Unit>
          className="w-28"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'm', label: 'm' },
            { value: 'cm', label: 'cm' },
          ]}
        />
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} className="accent-current" />
          입력 중 미리보기
        </label>
      </div>

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5">
        {CALIBRATION_FIELDS.map((spec) => (
          <CalField
            key={spec.key}
            spec={spec}
            unit={LENGTH_KEYS.has(spec.key) ? unit : null}
            value={values[spec.key]}
            error={errors[spec.key]}
            disabled={spec.key === 'distanceOffset' && values.measuredDistance != null}
            placeholder={
              spec.key === 'measuredDistance' && object.correctedDistance != null
                ? toUnit(object.correctedDistance, unit).toFixed(unit === 'cm' ? 0 : 2)
                : undefined
            }
            onChange={(v) => setField(spec.key, v)}
            trackId={trackId}
          />
        ))}
      </div>
      <p className="text-[10.5px] leading-snug text-muted">
        우선순위: 실제 거리 &gt; 거리 보정값(동시 적용 안 함). 실제 크기는 거리 추정 입력값으로 사용됩니다. 빈 칸 = 보정 없음.
      </p>

      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => void onSave()} disabled={hasErrors} data-testid="calibration-save">
          {scope === 'session' ? '적용' : '저장'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setValues(saved);
            setDirty(false);
            setStatus(null);
          }}
          disabled={!dirty}
        >
          되돌리기
        </Button>
        <Button variant="danger" onClick={() => void onReset()} disabled={!canReset}>
          초기화
        </Button>
      </div>
      {status ? (
        <p
          role="status"
          data-testid="calibration-status"
          className={cx(
            'text-[12px]',
            status.kind === 'error' && 'text-danger',
            status.kind === 'warn' && 'text-danger',
            status.kind === 'ok' && 'text-fg',
          )}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}

function toUnit(m: number, unit: Unit) {
  return unit === 'cm' ? m * 100 : m;
}

function CalField({
  spec,
  unit,
  value,
  error,
  disabled,
  placeholder,
  onChange,
  trackId,
}: {
  spec: FieldSpec;
  unit: Unit | null;
  value: number | undefined;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
  trackId: string;
}) {
  const f = unit === 'cm' ? 100 : 1;
  const display = value == null || Number.isNaN(value) ? value : round(value * f, 6);
  return (
    <NumberField
      id={`cal-${trackId}-${spec.key}`}
      label={spec.label}
      unit={unit ?? spec.unit}
      min={round(spec.min * f, 4)}
      max={round(spec.max * f, 4)}
      step={spec.step * f}
      value={display}
      error={error}
      hint={disabled ? '실제 거리 우선 적용 중' : undefined}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(v) => onChange(v == null ? undefined : Number.isNaN(v) ? NaN : v / f)}
    />
  );
}

function round(v: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

/**
 * 저장 전 값 준비: 실제 거리가 있으면 비율 계산용 기준 추정값(referenceRawDistance)을 기록합니다.
 * 실제 거리·실제 크기가 모두 이전과 같으면 기존 기준값을 유지합니다.
 */
function prepare(
  values: CalibrationValues,
  saved: CalibrationValues,
  trackId: string,
): { ok: true; values: CalibrationValues } | { ok: false; error: string } {
  const clean = cleanValues(values);
  if (clean.measuredDistance == null) {
    delete clean.referenceRawDistance;
    return { ok: true, values: clean };
  }
  const unchanged =
    clean.measuredDistance === saved.measuredDistance &&
    SIZE_KEYS.every((k) => clean[k] === saved[k]) &&
    saved.referenceRawDistance != null;
  if (unchanged) return { ok: true, values: { ...clean, referenceRawDistance: saved.referenceRawDistance } };
  const base = getVisionPipeline().baseDistanceFor(trackId, clean);
  if (base == null || !Number.isFinite(base)) {
    return { ok: false, error: '현재 객체의 거리를 계산할 수 없어 실제 거리를 기준으로 저장할 수 없습니다.' };
  }
  return { ok: true, values: { ...clean, referenceRawDistance: base } };
}
