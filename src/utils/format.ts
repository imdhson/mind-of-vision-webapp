import type { MotionState, TrackingState } from '../types';

export const UNKNOWN = '미확인';

export function fmtMeters(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return UNKNOWN;
  return `${v.toFixed(digits)} m`;
}

export function fmtDistance(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return UNKNOWN;
  return v < 10 ? `${v.toFixed(2)} m` : `${v.toFixed(1)} m`;
}

export function fmtPercent(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return UNKNOWN;
  return `${Math.round(v * 100)}%`;
}

export function fmtDeg(rad: number | null | undefined): string {
  if (rad == null || !Number.isFinite(rad)) return UNKNOWN;
  return `${Math.round((rad * 180) / Math.PI)}°`;
}

export function fmtVec(v: { x: number; y: number; z: number } | null | undefined): string {
  if (!v) return UNKNOWN;
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}

export const TRACKING_STATE_KO: Record<TrackingState, string> = {
  detected: '인식됨',
  tracking: '추적 중',
  temporarily_lost: '일시 놓침',
  lost: '추적 종료',
};

export const MOTION_STATE_KO: Record<MotionState, string> = {
  stationary: '정지',
  moving: '이동 중',
  unknown: UNKNOWN,
};

/** yaw(rad, 0=사용자를 향함) → 사람이 이해하기 쉬운 방향 설명 */
export function describeYaw(yaw: number | null): string {
  if (yaw == null) return UNKNOWN;
  const deg = ((((yaw * 180) / Math.PI) % 360) + 360) % 360;
  const dirs = [
    '사용자 쪽',
    '사용자 쪽·오른쪽',
    '오른쪽',
    '먼 쪽·오른쪽',
    '먼 쪽',
    '먼 쪽·왼쪽',
    '왼쪽',
    '사용자 쪽·왼쪽',
  ];
  // yaw 는 Y축 반시계 회전: +Z(사용자 쪽)=0, +X(오른쪽)=+90°
  return `${dirs[Math.round(deg / 45) % 8]} (${Math.round(deg > 180 ? deg - 360 : deg)}°)`;
}
