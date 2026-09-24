import type { NormalizedBox } from '../types';

export function boxArea(b: NormalizedBox): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

export function boxCenter(b: NormalizedBox): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** 교집합/합집합 비율 (Intersection over Union) */
export function iou(a: NormalizedBox, b: NormalizedBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = boxArea(a) + boxArea(b) - inter;
  return union > 0 ? inter / union : 0;
}

/** 두 상자 중심 거리를 두 상자 크기로 정규화한 값 (0 = 동일 중심) */
export function normalizedCenterDistance(a: NormalizedBox, b: NormalizedBox): number {
  const ca = boxCenter(a);
  const cb = boxCenter(b);
  const scale = Math.max(1e-6, (Math.sqrt(boxArea(a)) + Math.sqrt(boxArea(b))) / 2);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) / scale;
}

export function pointInBox(px: number, py: number, b: NormalizedBox, pad = 0): boolean {
  return px >= b.x - pad && px <= b.x + b.width + pad && py >= b.y - pad && py <= b.y + b.height + pad;
}

/** 영상 가장자리에 닿았는지 (크기가 잘렸을 가능성) */
export function edgeContact(b: NormalizedBox, margin = 0.01) {
  return {
    left: b.x <= margin,
    top: b.y <= margin,
    right: b.x + b.width >= 1 - margin,
    bottom: b.y + b.height >= 1 - margin,
  };
}

/**
 * 영상(원본 해상도)을 화면 컨테이너에 object-fit 으로 배치했을 때의 사각형.
 * 오버레이 좌표 변환 및 터치 판정에 사용합니다.
 */
export function fitRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
  mode: 'contain' | 'cover',
) {
  if (!videoW || !videoH || !containerW || !containerH) {
    return { x: 0, y: 0, width: containerW, height: containerH };
  }
  const scale =
    mode === 'contain'
      ? Math.min(containerW / videoW, containerH / videoH)
      : Math.max(containerW / videoW, containerH / videoH);
  const width = videoW * scale;
  const height = videoH * scale;
  return { x: (containerW - width) / 2, y: (containerH - height) / 2, width, height };
}
