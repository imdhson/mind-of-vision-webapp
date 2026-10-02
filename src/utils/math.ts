import type { BBox } from '@/types';
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const degToRad = (v: number) => (v * Math.PI) / 180;
export const radToDeg = (v: number) => (v * 180) / Math.PI;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function iou(a: BBox, b: BBox) {
  const x1 = Math.max(a.x, b.x),
    y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width),
    y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
export function centerDistance(a: BBox, b: BBox) {
  const ax = a.x + a.width / 2,
    ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2,
    by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}
