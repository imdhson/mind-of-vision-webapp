/**
 * 이동 궤적(경로) 추적
 *
 * 시각화 좌표계(X/Z, 바닥 평면) 기준으로 각 추적 객체의 최근 위치 이력을 보관합니다.
 * - 잡음(추정치의 미세한 흔들림)으로 정지 객체에 궤적이 그려지지 않도록 최소 이동 거리 이상일 때만 점을 추가합니다.
 * - 오래된 점은 시간 기준으로, 너무 많은 점은 개수 기준으로 제거합니다.
 * - 더 이상 추적되지 않는 객체의 궤적은 다음 update 호출에서 즉시 제거됩니다.
 */
export interface TrailPoint {
  x: number;
  z: number;
  t: number;
}

export interface TrailConfig {
  /** 이 거리(m) 이상 이동해야 새 점을 추가 (잡음으로 인한 점 남발 방지) */
  minStepM: number;
  /** 객체당 보관하는 최대 점 개수 */
  maxPoints: number;
  /** 이 시간(ms)보다 오래된 점은 제거 */
  maxAgeMs: number;
}

export const DEFAULT_TRAIL_CONFIG: TrailConfig = {
  minStepM: 0.15,
  maxPoints: 40,
  maxAgeMs: 6000,
};

export interface TrailInput {
  id: string;
  x: number;
  z: number;
}

export class TrailTracker {
  private trails = new Map<string, TrailPoint[]>();
  readonly config: TrailConfig;

  constructor(config: Partial<TrailConfig> = {}) {
    this.config = { ...DEFAULT_TRAIL_CONFIG, ...config };
  }

  reset(): void {
    this.trails.clear();
  }

  /**
   * 이번 프레임에 활성 상태인 객체의 위치를 반영하고, 2개 이상의 점이 있는 궤적만 반환합니다.
   * (더 이상 활성 목록에 없는 객체의 궤적은 내부 상태에서도 삭제됩니다.)
   */
  update(active: TrailInput[], now: number): Record<string, TrailPoint[]> {
    const activeIds = new Set(active.map((a) => a.id));
    for (const id of this.trails.keys()) {
      if (!activeIds.has(id)) this.trails.delete(id);
    }

    for (const a of active) {
      let points = (this.trails.get(a.id) ?? []).filter((p) => now - p.t < this.config.maxAgeMs);
      const last = points[points.length - 1];
      if (!last || Math.hypot(a.x - last.x, a.z - last.z) >= this.config.minStepM) {
        points = [...points, { x: a.x, z: a.z, t: now }];
        if (points.length > this.config.maxPoints) points = points.slice(points.length - this.config.maxPoints);
      }
      this.trails.set(a.id, points);
    }

    const out: Record<string, TrailPoint[]> = {};
    for (const [id, points] of this.trails) {
      if (points.length >= 2) out[id] = points;
    }
    return out;
  }
}
