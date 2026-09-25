import type { CameraIntrinsics } from '../camera/CameraCalibration';
import { cameraToView, pixelRay } from '../depth/CoordinateTransformer';
import type { LaneLine } from './LaneTracker';

/**
 * 차선의 영상 좌표 → 바닥 평면(시각화 좌표 X/Z) 투영
 * 카메라 높이·피치를 알면 영상의 각 점을 지나는 광선이 바닥(Y=0)과 만나는 위치를 계산할 수 있습니다.
 * 직선은 투영 후에도 직선이므로 양 끝점만 투영합니다(너무 먼 쪽은 maxDistance 에서 자름).
 */
export interface GroundPoint {
  x: number;
  z: number;
}

export interface GroundSegment {
  near: GroundPoint;
  far: GroundPoint;
}

/** 3D 에 그리는 차선의 최대 거리(m). 지평선 부근은 작은 오차에도 거리가 크게 튀므로 자릅니다. */
export const MAX_LANE_DISTANCE_M = 30;

/** 정규화 영상 좌표 → 바닥 위 점. 광선이 바닥을 향하지 않으면(지평선 위) null */
export function imageToGround(
  u: number,
  v: number,
  K: CameraIntrinsics,
  cameraHeight: number,
  pitch: number,
): GroundPoint | null {
  const r = pixelRay(u * K.width, v * K.height, K);
  const d = cameraToView(r, 0, pitch); // 방향 벡터(높이 0 기준)
  if (d.y >= -1e-6) return null;
  const t = cameraHeight / -d.y;
  return { x: d.x * t, z: d.z * t };
}

export function laneToGround(
  line: LaneLine,
  K: CameraIntrinsics,
  cameraHeight: number,
  pitch: number,
  maxDistance = MAX_LANE_DISTANCE_M,
): GroundSegment | null {
  const at = (s: number) =>
    imageToGround(
      line.bottom.x + (line.top.x - line.bottom.x) * s,
      line.bottom.y + (line.top.y - line.bottom.y) * s,
      K,
      cameraHeight,
      pitch,
    );
  const within = (p: GroundPoint | null): p is GroundPoint => p != null && Math.hypot(p.x, p.z) <= maxDistance;
  const near = at(0);
  if (!within(near)) return null;
  let far = at(1);
  if (!within(far)) {
    // 가까운 끝에서 먼 끝 방향으로, 바닥 위이면서 maxDistance 이내인 가장 먼 점을 이분 탐색
    let lo = 0;
    let hi = 1;
    far = near;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const p = at(mid);
      if (within(p)) {
        lo = mid;
        far = p;
      } else hi = mid;
    }
  }
  if (Math.hypot(far.x - near.x, far.z - near.z) < 0.2) return null;
  return { near, far };
}

/** 화면·3D 표시용 차선: 영상 좌표 직선 + 바닥 투영(계산 불가 시 null) */
export type DetectedLane = LaneLine & { ground: GroundSegment | null };

export interface LaneScene {
  left: DetectedLane | null;
  right: DetectedLane | null;
}

export const EMPTY_LANES: LaneScene = { left: null, right: null };
