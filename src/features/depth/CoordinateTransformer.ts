import type { NormalizedBox, Size3, Vec3 } from '../../types';
import type { CameraIntrinsics } from '../camera/CameraCalibration';
import type { ClassInfo } from '../detection/classCatalog';
import { boxCenter } from '../../utils/geometry';

/**
 * 좌표 변환 (src/types/index.ts 의 좌표계 정의 참고)
 *
 * 영상 좌표(u,v) → 정규화 광선 → 거리 적용 → 카메라 좌표(x 오른쪽, y 아래, z 전방)
 *  → 피치 회전 + 카메라 높이 → 시각화 좌표(X 오른쪽, Y 위, -Z 전방, 바닥 Y=0)
 */

/** 영상 좌표의 광선 방향(단위 벡터, 카메라 좌표계) */
export function pixelRay(u: number, v: number, K: CameraIntrinsics): Vec3 {
  const x = (u - K.cx) / K.fx;
  const y = (v - K.cy) / K.fy;
  const len = Math.sqrt(x * x + y * y + 1);
  return { x: x / len, y: y / len, z: 1 / len };
}

/** 경계 상자 중심을 지나는 광선 위, 주어진 직선거리(m)의 카메라 좌표 */
export function boxToCameraPoint(box: NormalizedBox, distance: number, K: CameraIntrinsics): Vec3 {
  const c = boxCenter(box);
  const r = pixelRay(c.x * K.width, c.y * K.height, K);
  return { x: r.x * distance, y: r.y * distance, z: r.z * distance };
}

/**
 * 카메라 좌표 → 시각화 좌표
 * @param pitch rad, +는 카메라가 아래를 봄
 */
export function cameraToView(p: Vec3, cameraHeight: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: p.x,
    y: cameraHeight - p.y * cp - p.z * sp,
    z: p.y * sp - p.z * cp,
  };
}

/** 시각화 좌표 → 카메라 좌표 (cameraToView 의 역변환) */
export function viewToCamera(p: Vec3, cameraHeight: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const h = cameraHeight - p.y;
  return {
    x: p.x,
    y: h * cp + p.z * sp,
    z: h * sp - p.z * cp,
  };
}

/** 영상상의 크기 + 깊이 → 실제 크기 추정 (m). 깊이는 클래스 비율로 추정 */
export function estimateSize(box: NormalizedBox, depth: number, K: CameraIntrinsics, info: ClassInfo): Size3 {
  const width = (box.width * K.width * depth) / K.fx;
  const height = (box.height * K.height * depth) / K.fy;
  const ratio = info.prior.depth / Math.max(info.prior.width, 1e-3);
  const d = Math.max(0.02, Math.min(width * ratio, info.prior.depth * 3));
  return { width, height, depth: d };
}

export function addVec(a: Vec3, b: Partial<Vec3>): Vec3 {
  return { x: a.x + (b.x ?? 0), y: a.y + (b.y ?? 0), z: a.z + (b.z ?? 0) };
}

export function horizontalDistance(p: Vec3): number {
  return Math.hypot(p.x, p.z);
}
