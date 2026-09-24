import type {
  CalibrationScope,
  CalibrationValues,
  CameraProfile,
  ClassCalibration,
  InstanceCalibration,
  ResolvedCalibration,
} from '../../types';

/**
 * 보정값 규칙 (단위·허용 범위·우선순위)
 *
 * 적용 우선순위(필드 단위 덮어쓰기, 합산하지 않음):
 *   현재 추적 객체의 임시 보정(session) > 개별 객체 보정(instance) > 클래스 기본 보정(class) > 모델 기본값
 *
 * 거리 보정 우선순위:
 *   실제 거리(measuredDistance)가 설정되면 실제 크기(realHeight/realWidth)와 거리 보정값(distanceOffset)은
 *   거리 계산에 적용하지 않습니다. 실제 거리는 원본 추정값 대비 비율로 저장됩니다.
 */
export interface FieldSpec {
  key: keyof CalibrationValues;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  help: string;
}

export const CALIBRATION_FIELDS: FieldSpec[] = [
  {
    key: 'measuredDistance',
    label: '실제 거리',
    unit: 'm',
    min: 0.1,
    max: 100,
    step: 0.01,
    help: '직접 측정한 카메라→객체 거리. 설정 시 실제 크기·거리 보정값보다 우선',
  },
  {
    key: 'distanceOffset',
    label: '거리 보정값',
    unit: 'm',
    min: -20,
    max: 20,
    step: 0.01,
    help: '추정 거리에 더하는 값(±). 실제 거리가 없을 때만 적용',
  },
  {
    key: 'realHeight',
    label: '실제 높이',
    unit: 'm',
    min: 0.01,
    max: 50,
    step: 0.01,
    help: '거리 추정에 사용할 객체의 실제 높이',
  },
  {
    key: 'realWidth',
    label: '실제 너비',
    unit: 'm',
    min: 0.01,
    max: 50,
    step: 0.01,
    help: '거리 추정에 사용할 객체의 실제 너비',
  },
  { key: 'offsetX', label: 'X축 보정', unit: 'm', min: -20, max: 20, step: 0.01, help: '좌우 위치(+ 오른쪽)' },
  { key: 'offsetY', label: 'Y축 보정', unit: 'm', min: -20, max: 20, step: 0.01, help: '높이(+ 위)' },
  { key: 'offsetZ', label: 'Z축 보정', unit: 'm', min: -20, max: 20, step: 0.01, help: '깊이(+ 사용자 쪽, − 멀어짐)' },
  {
    key: 'yawOffsetDeg',
    label: '방향 보정',
    unit: '°',
    min: -180,
    max: 180,
    step: 1,
    help: '방향 회전. 방향 미확인 객체는 이 값이 방향이 됨(0°=사용자 쪽)',
  },
];

export const FIELD_MAP = Object.fromEntries(CALIBRATION_FIELDS.map((f) => [f.key, f])) as Record<
  keyof CalibrationValues,
  FieldSpec | undefined
>;

export type ValidationErrors = Partial<Record<string, string>>;

/** 입력값 검증. 오류가 있으면 저장하지 않습니다. */
export function validateCalibrationValues(values: CalibrationValues): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const spec of CALIBRATION_FIELDS) {
    const v = values[spec.key];
    if (v == null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors[spec.key] = '숫자를 입력하세요';
    } else if (v < spec.min || v > spec.max) {
      errors[spec.key] = `${spec.min}~${spec.max} ${spec.unit}`;
    }
  }
  return errors;
}

/** undefined/NaN 필드를 제거한 깨끗한 값 */
export function cleanValues(values: CalibrationValues): CalibrationValues {
  const out: CalibrationValues = {};
  for (const [k, v] of Object.entries(values) as [keyof CalibrationValues, number | undefined][]) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  // 실측 기준값 없이 실측 거리만 있는 상태 방지
  if (out.measuredDistance == null) delete out.referenceRawDistance;
  return out;
}

export function isEmptyValues(values: CalibrationValues | undefined | null): boolean {
  if (!values) return true;
  return Object.keys(cleanValues(values)).filter((k) => k !== 'referenceRawDistance').length === 0;
}

export function resolveCalibration(
  classCal: ClassCalibration | undefined,
  instanceCal: InstanceCalibration | undefined,
  sessionValues: CalibrationValues | undefined,
): ResolvedCalibration {
  const values: CalibrationValues = {};
  const sources: ResolvedCalibration['sources'] = {};
  const layers: [CalibrationScope, CalibrationValues | undefined][] = [
    ['class', classCal?.values],
    ['instance', instanceCal?.values],
    ['session', sessionValues],
  ];
  for (const [scope, layer] of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(cleanValues(layer)) as [keyof CalibrationValues, number][]) {
      values[k] = v;
      sources[k] = scope;
    }
    // 실측 거리와 기준값은 한 쌍으로 같은 계층에서 가져와야 함
    if (layer.measuredDistance != null) {
      values.referenceRawDistance = layer.referenceRawDistance;
      sources.referenceRawDistance = scope;
    }
  }
  return {
    values,
    sources,
    instanceId: instanceCal?.id ?? null,
    hasSession: !isEmptyValues(sessionValues),
  };
}

// ── 카메라 프로파일 검증 ────────────────────────────────────
export interface ProfileFieldSpec {
  key: 'hfovLongDeg' | 'cameraHeight' | 'distanceScale' | 'pitchDeg';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export const PROFILE_FIELDS: ProfileFieldSpec[] = [
  { key: 'hfovLongDeg', label: '화각(긴 변)', unit: '°', min: 10, max: 160, step: 0.5 },
  { key: 'cameraHeight', label: '카메라 높이', unit: 'm', min: 0, max: 5, step: 0.01 },
  { key: 'distanceScale', label: '거리 추정 기준 배율', unit: '×', min: 0.2, max: 5, step: 0.01 },
  { key: 'pitchDeg', label: '기본 기울기(아래+)', unit: '°', min: -80, max: 80, step: 1 },
];

export function validateProfile(p: Partial<CameraProfile>): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const spec of PROFILE_FIELDS) {
    const v = p[spec.key];
    if (v == null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) errors[spec.key] = '숫자를 입력하세요';
    else if (v < spec.min || v > spec.max) errors[spec.key] = `${spec.min}~${spec.max} ${spec.unit}`;
  }
  return errors;
}

export function classCalibrationId(classId: string): string {
  return `class:${classId}`;
}

export function newInstanceId(): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `inst:${rnd}`;
}
