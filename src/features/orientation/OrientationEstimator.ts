import type { Track } from '@/types';
export type OrientationResult = { yawRad: number | null; moving: boolean };
export function estimateOrientation(track: Track): OrientationResult {
  const speed = Math.hypot(track.velocity.x, track.velocity.y);
  if (speed < 1.25) return { yawRad: null, moving: false };
  const yawRad = Math.atan2(track.velocity.x, Math.max(0.001, -track.velocity.y));
  return { yawRad, moving: true };
}
