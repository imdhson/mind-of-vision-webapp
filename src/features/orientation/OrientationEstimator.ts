import type { OrientationEstimate, Vec3 } from '../../types';
import type { ClassInfo } from '../detection/classCatalog';
import { DEG, wrapAngle } from '../../utils/math';

/**
 * 객체 방향 추정기
 *
 * - "이동 방향"과 "바라보는 방향"을 구분합니다.
 * - 이동 방향: 최근 위치 이력(시각화 좌표 수평면)의 선형 회귀 속도로 계산.
 *   단안 거리 추정 잡음으로 인한 오판을 막기 위해 최소 관측 시간·이동량·속도 히스테리시스를 적용합니다.
 * - 바라보는 방향: 사람·동물·탈것처럼 진행 방향을 바라보는 클래스가 "이동 중"일 때만 이동 방향으로 추정합니다.
 *   정지한 객체(의자 등)의 외형만으로는 방향을 판단할 수 없으므로 null(미확인)을 반환하며,
 *   사용자가 방향 보정을 입력한 경우에만 그 값을 사용합니다.
 */
export interface OrientationConfig {
  windowMs: number;
  minWindowMs: number;
  enterSpeed: number;
  exitSpeed: number;
  minDisplacement: number;
  facingHoldMs: number;
}

export const DEFAULT_ORIENTATION_CONFIG: OrientationConfig = {
  windowMs: 1600,
  minWindowMs: 600,
  enterSpeed: 0.3,
  exitSpeed: 0.15,
  minDisplacement: 0.35,
  facingHoldMs: 4000,
};

interface Sample {
  t: number;
  x: number;
  z: number;
}

interface TrackOrientationState {
  samples: Sample[];
  moving: boolean;
  lastFacing: number | null;
  lastFacingAt: number;
}

export class OrientationEstimator {
  private states = new Map<string, TrackOrientationState>();
  constructor(private readonly config: OrientationConfig = DEFAULT_ORIENTATION_CONFIG) {}

  reset(): void {
    this.states.clear();
  }

  forget(trackId: string): void {
    this.states.delete(trackId);
  }

  /** 추적 목록에 없는 상태 정리 */
  retain(ids: Set<string>): void {
    for (const id of this.states.keys()) if (!ids.has(id)) this.states.delete(id);
  }

  /**
   * @param position 보정 전 시각화 좌표 (보정 오프셋이 이동으로 오인되지 않도록)
   * @param observed 이번 프레임에 실제로 인식되었는지 (누락 프레임은 이력에 넣지 않음)
   */
  update(
    trackId: string,
    info: ClassInfo,
    position: Vec3 | null,
    timestamp: number,
    observed: boolean,
    yawOffsetDeg?: number,
  ): OrientationEstimate {
    const cfg = this.config;
    let st = this.states.get(trackId);
    if (!st) {
      st = { samples: [], moving: false, lastFacing: null, lastFacingAt: 0 };
      this.states.set(trackId, st);
    }
    if (position && observed) {
      const last = st.samples[st.samples.length - 1];
      if (!last || timestamp > last.t) st.samples.push({ t: timestamp, x: position.x, z: position.z });
    }
    st.samples = st.samples.filter((s) => timestamp - s.t <= cfg.windowMs);

    let movementYaw: number | null = null;
    let speed: number | null = null;
    let motionState: OrientationEstimate['motionState'] = 'unknown';

    const span = st.samples.length >= 3 ? st.samples[st.samples.length - 1].t - st.samples[0].t : 0;
    if (span >= cfg.minWindowMs) {
      const v = regressVelocity(st.samples);
      speed = Math.hypot(v.x, v.z);
      const first = st.samples[0];
      const lastS = st.samples[st.samples.length - 1];
      const displacement = Math.hypot(lastS.x - first.x, lastS.z - first.z);
      if (st.moving) st.moving = speed > cfg.exitSpeed;
      else st.moving = speed > cfg.enterSpeed && displacement > cfg.minDisplacement;
      motionState = st.moving ? 'moving' : 'stationary';
      if (st.moving) movementYaw = Math.atan2(v.x, v.z);
    }

    let facingYaw: number | null = null;
    let facingSource: OrientationEstimate['facingSource'] = null;
    if (info.facesMovement && movementYaw != null) {
      st.lastFacing = movementYaw;
      st.lastFacingAt = timestamp;
    }
    if (info.facesMovement && st.lastFacing != null && timestamp - st.lastFacingAt <= cfg.facingHoldMs) {
      facingYaw = st.lastFacing;
      facingSource = 'motion';
    }

    if (yawOffsetDeg != null && Number.isFinite(yawOffsetDeg) && yawOffsetDeg !== 0) {
      facingYaw = wrapAngle((facingYaw ?? 0) + yawOffsetDeg * DEG);
      facingSource = facingSource ?? 'user';
    } else if (yawOffsetDeg === 0 && facingYaw == null) {
      // 0°를 명시적으로 지정 = 사용자 쪽을 바라봄
      facingYaw = 0;
      facingSource = 'user';
    }

    return { motionState, movementYaw, speed, facingYaw, facingSource };
  }
}

/** 최소제곱 선형 회귀로 속도(m/s) 추정 */
export function regressVelocity(samples: Sample[]): { x: number; z: number } {
  const n = samples.length;
  if (n < 2) return { x: 0, z: 0 };
  const t0 = samples[0].t;
  let st = 0;
  let sx = 0;
  let sz = 0;
  for (const s of samples) {
    st += (s.t - t0) / 1000;
    sx += s.x;
    sz += s.z;
  }
  const mt = st / n;
  const mx = sx / n;
  const mz = sz / n;
  let num_x = 0;
  let num_z = 0;
  let den = 0;
  for (const s of samples) {
    const dt = (s.t - t0) / 1000 - mt;
    num_x += dt * (s.x - mx);
    num_z += dt * (s.z - mz);
    den += dt * dt;
  }
  if (den < 1e-9) return { x: 0, z: 0 };
  return { x: num_x / den, z: num_z / den };
}
