import type { AppearanceSignature, NormalizedBox } from '../types';

const BINS = 4; // 채널당 4단계 → 64 bins

/**
 * 경계 상자 영역의 RGB 색상 히스토그램(64차원, 합=1)을 계산합니다.
 * 추적 매칭 보조와 개별 보정값 "연결 후보" 추천에만 사용하며,
 * 이것만으로 동일 물체라고 확정하지 않습니다.
 */
export function computeAppearance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  box: NormalizedBox,
): AppearanceSignature | null {
  // 가장자리 배경 영향을 줄이기 위해 안쪽 70% 영역만 사용
  const inset = 0.15;
  const x0 = Math.floor((box.x + box.width * inset) * width);
  const y0 = Math.floor((box.y + box.height * inset) * height);
  const x1 = Math.ceil((box.x + box.width * (1 - inset)) * width);
  const y1 = Math.ceil((box.y + box.height * (1 - inset)) * height);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const hist = new Array<number>(BINS * BINS * BINS).fill(0);
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
      const i = (y * width + x) * 4;
      const r = (data[i] * BINS) >> 8;
      const g = (data[i + 1] * BINS) >> 8;
      const b = (data[i + 2] * BINS) >> 8;
      hist[r * BINS * BINS + g * BINS + b]++;
      n++;
    }
  }
  if (n === 0) return null;
  return hist.map((v) => v / n);
}

/** Bhattacharyya 계수 기반 유사도 (0..1, 1 = 동일 분포) */
export function appearanceSimilarity(a: AppearanceSignature | null, b: AppearanceSignature | null): number | null {
  if (!a || !b || a.length !== b.length) return null;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.sqrt(a[i] * b[i]);
  return Math.min(1, s);
}

/** 지수 이동 평균으로 외형 서명 갱신 */
export function blendAppearance(
  prev: AppearanceSignature | null,
  next: AppearanceSignature | null,
  alpha = 0.2,
): AppearanceSignature | null {
  if (!next) return prev;
  if (!prev || prev.length !== next.length) return next;
  return prev.map((v, i) => v * (1 - alpha) + next[i] * alpha);
}
