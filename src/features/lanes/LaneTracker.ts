import type { LaneCandidate, LaneDetection, LaneSide } from './LaneDetector';

/**
 * 차선 인식 결과의 시간적 안정화
 *
 * - 연속 프레임에서 비슷한 위치에 다시 인식되어야(minHits) 표시합니다 → 순간적인 오인식 억제.
 * - 표시 중인 직선은 지수 평활로 부드럽게 따라가며, 크게 튀는 값은 새 후보로 취급해 다시 확정을 기다립니다.
 * - 잠시 놓쳐도 holdMs 동안은 마지막 위치를 유지합니다(점선 차선의 빈 구간, 순간 가림).
 * - 좌/우 직선이 영상 아래에서 서로 교차(왼쪽이 오른쪽보다 오른쪽)하면 신뢰도가 낮은 쪽을 버립니다.
 */
export interface LaneLine {
  side: LaneSide;
  /** 정규화 영상 좌표: 영상 아래쪽 끝 */
  bottom: { x: number; y: number };
  /** 정규화 영상 좌표: 먼 쪽 끝(관심 영역 위쪽 또는 두 직선의 교차점 직전) */
  top: { x: number; y: number };
  confidence: number;
}

export interface LaneState {
  left: LaneLine | null;
  right: LaneLine | null;
}

export interface LaneTrackerConfig {
  smoothing: number;
  minHits: number;
  holdMs: number;
  /** 이 값(정규화 x)보다 크게 바뀌면 같은 직선으로 보지 않음 */
  maxJump: number;
}

export const DEFAULT_LANE_TRACKER_CONFIG: LaneTrackerConfig = {
  smoothing: 0.35,
  minHits: 2,
  holdMs: 700,
  maxJump: 0.18,
};

interface SideState {
  bottomX: number;
  slope: number;
  confidence: number;
  hits: number;
  lastSeen: number;
}

export class LaneTracker {
  private sides: Record<LaneSide, SideState | null> = { left: null, right: null };
  private roiTop: number | null = null;
  readonly config: LaneTrackerConfig;

  constructor(config: Partial<LaneTrackerConfig> = {}) {
    this.config = { ...DEFAULT_LANE_TRACKER_CONFIG, ...config };
  }

  reset(): void {
    this.sides = { left: null, right: null };
    this.roiTop = null;
  }

  update(detection: LaneDetection, now: number): LaneState {
    const a = this.config.smoothing;
    this.roiTop = this.roiTop == null ? detection.roiTop : this.roiTop + (detection.roiTop - this.roiTop) * a;
    for (const side of ['left', 'right'] as const) {
      this.sides[side] = this.step(this.sides[side], detection[side], now, this.roiTop);
    }
    return this.state();
  }

  private step(prev: SideState | null, cand: LaneCandidate | null, now: number, roiTop: number): SideState | null {
    if (!cand) return prev && now - prev.lastSeen <= this.config.holdMs ? prev : null;
    if (prev) {
      // 아래쪽 끝과 먼 쪽 끝의 x 변화로 같은 직선인지 판단
      const dBottom = Math.abs(cand.bottomX - prev.bottomX);
      const dTop = Math.abs(xAt(cand, roiTop) - xAt(prev, roiTop));
      if (Math.max(dBottom, dTop) <= this.config.maxJump) {
        const a = this.config.smoothing;
        return {
          bottomX: prev.bottomX + (cand.bottomX - prev.bottomX) * a,
          slope: prev.slope + (cand.slope - prev.slope) * a,
          confidence: prev.confidence + (cand.confidence - prev.confidence) * a,
          hits: prev.hits + 1,
          lastSeen: now,
        };
      }
    }
    return { bottomX: cand.bottomX, slope: cand.slope, confidence: cand.confidence, hits: 1, lastSeen: now };
  }

  private state(): LaneState {
    const roiTop = this.roiTop ?? 0.5;
    let left = this.sides.left && this.sides.left.hits >= this.config.minHits ? this.sides.left : null;
    let right = this.sides.right && this.sides.right.hits >= this.config.minHits ? this.sides.right : null;
    let top = roiTop;
    if (left && right) {
      if (left.bottomX >= right.bottomX) {
        if (left.confidence >= right.confidence) right = null;
        else left = null;
      } else if (left.slope !== right.slope) {
        // 두 직선이 관심 영역 안에서 만나면 교차점(소실점) 직전까지만 그림
        const yCross = 1 + (right.bottomX - left.bottomX) / (left.slope - right.slope);
        if (yCross > top && yCross < 1) top = Math.min(1, yCross + 0.01);
      }
    }
    const line = (side: LaneSide, s: SideState | null): LaneLine | null =>
      s && top < 1
        ? {
            side,
            bottom: { x: s.bottomX, y: 1 },
            top: { x: s.bottomX + s.slope * (top - 1), y: top },
            confidence: s.confidence,
          }
        : null;
    return { left: line('left', left), right: line('right', right) };
  }
}

function xAt(s: { bottomX: number; slope: number }, y: number): number {
  return s.bottomX + s.slope * (y - 1);
}
