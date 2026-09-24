import type { CalibrationValues, TrackedObject } from '../../types';
import {
  MOTION_STATE_KO,
  TRACKING_STATE_KO,
  UNKNOWN,
  describeYaw,
  fmtDistance,
  fmtMeters,
  fmtPercent,
  fmtVec,
} from '../../utils/format';
import { FIELD_MAP } from '../../features/calibration/CalibrationManager';
import { Row } from '../common/ui';

const CUE_KO = { 'size-height': '높이 기반', 'size-width': '너비 기반', 'ground-plane': '바닥 접지' } as const;
const SCOPE_KO = { session: '임시', instance: '개별', class: '클래스' } as const;

/** 객체 상세정보. 확인할 수 없는 값은 "미확인"으로 표시합니다. */
export function ObjectDetails({ object: o }: { object: TrackedObject }) {
  const s = o.size;
  const facingSrc =
    o.orientation.facingSource === 'motion'
      ? '이동 방향 기반 추정'
      : o.orientation.facingSource === 'user'
        ? '사용자 지정'
        : null;
  return (
    <div className="divide-y divide-line/60" data-testid="object-details">
      <div className="pb-1">
        <Row k="객체 ID" v={<span className="font-mono text-[12px]">{o.id}</span>} />
        <Row k="객체 이름" v={o.label} />
        <Row k="클래스" v={o.className} sub={o.classId} />
        <Row k="인식 신뢰도" v={fmtPercent(o.confidence)} />
        <Row k="추적 상태" v={TRACKING_STATE_KO[o.trackingState]} />
      </div>
      <div className="py-1">
        <Row k="추정 거리(보정 전)" v={fmtDistance(o.estimatedDistance)} />
        <Row k="보정된 거리" v={fmtDistance(o.correctedDistance)} />
        <Row
          k="거리 추정 신뢰도"
          v={fmtPercent(o.distanceQuality)}
          sub={o.truncated ? '화면 가장자리에서 잘림' : undefined}
        />
        {o.distanceCues.length ? (
          <Row
            k="추정 단서"
            v={
              <span className="text-[11.5px]">
                {o.distanceCues.map((c) => `${CUE_KO[c.method]} ${c.distance.toFixed(2)}m`).join(' · ')}
              </span>
            }
          />
        ) : null}
      </div>
      <div className="py-1">
        <Row k="3D 좌표 (X, Y, Z)" v={fmtVec(o.position)} sub="m" />
        <Row k="보정 전 좌표" v={fmtVec(o.rawPosition)} sub="m" />
        <Row
          k="추정 크기 (W×H×D)"
          v={s ? `${s.width.toFixed(2)} × ${s.height.toFixed(2)} × ${s.depth.toFixed(2)}` : UNKNOWN}
          sub={s ? 'm' : undefined}
        />
      </div>
      <div className="py-1">
        <Row k="바라보는 방향" v={describeYaw(o.orientation.facingYaw)} sub={facingSrc ?? undefined} />
        <Row k="이동 상태" v={MOTION_STATE_KO[o.orientation.motionState]} />
        <Row
          k="이동 방향 / 속도"
          v={
            o.orientation.movementYaw != null
              ? `${describeYaw(o.orientation.movementYaw)} · ${o.orientation.speed?.toFixed(2)} m/s`
              : UNKNOWN
          }
        />
      </div>
      <div className="pt-1">
        <AppliedCalibration values={o.calibration.values} sources={o.calibration.sources} />
      </div>
      <p className="pt-2 text-[10.5px] leading-snug text-muted">
        좌표는 카메라(사용자) 기준 상대 위치입니다. X 오른쪽(+), Y 바닥에서 위(+), Z 전방(−). 단안 카메라 추정값이므로 실측과 다를 수
        있습니다.
      </p>
    </div>
  );
}

export function AppliedCalibration({
  values,
  sources,
}: {
  values: CalibrationValues;
  sources: Partial<Record<keyof CalibrationValues, 'class' | 'instance' | 'session'>>;
}) {
  const entries = (Object.entries(values) as [keyof CalibrationValues, number][]).filter(
    ([k]) => k !== 'referenceRawDistance',
  );
  if (!entries.length) return <Row k="적용된 사용자 보정값" v="없음" />;
  const offsetIgnored = values.measuredDistance != null && values.distanceOffset != null;
  return (
    <div className="py-0.5">
      <div className="py-1 text-[12px] text-muted">적용된 사용자 보정값</div>
      {entries.map(([k, v]) => {
        const spec = FIELD_MAP[k];
        const scope = sources[k];
        return (
          <Row
            key={k}
            k={spec?.label ?? k}
            v={
              <span className={k === 'distanceOffset' && offsetIgnored ? 'text-muted line-through' : undefined}>
                {spec?.unit === 'm' ? fmtMeters(v) : `${v}${spec?.unit ?? ''}`}
              </span>
            }
            sub={scope ? SCOPE_KO[scope] : undefined}
          />
        );
      })}
      {offsetIgnored ? (
        <p className="text-[10.5px] text-muted">실제 거리가 설정되어 거리 보정값은 적용되지 않습니다.</p>
      ) : null}
    </div>
  );
}
