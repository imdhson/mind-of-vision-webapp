import { clamp, dampFactor, quantile } from '../../utils/math';

/**
 * 기본 시점 자동 확대·축소 제어기 (렌더링과 독립된 순수 로직 — 단위 테스트 대상)
 *
 * 목표: 가까운(안전상 중요한) 객체 위주로 잘 보이는 시야 반경(r)을 유지하되, 매우 느리고 안정적으로 변화.
 *   먼 객체 하나 때문에 전체 시야가 과도하게 축소되어 정작 가까운 객체가 안 보이는 일이 없도록,
 *   시야 반경에는 상한(maxRadius)을 두고 먼 객체의 영향은 완만한 분위수로 제한한다.
 *
 * 안정화 기법
 *  - 분위수(75%) 사용: 소수의 먼 객체(이상치)에 과민 반응하지 않음
 *  - 히스테리시스: 목표 대비 변화율이 임계값(기본 20%) 미만이면 무시
 *  - 지속 시간 조건(디바운스): 변화가 일정 시간 계속되어야 목표 변경
 *    (확대보다 축소를 더 오래 기다림 → 객체가 잠깐 사라져도 급격히 축소되지 않음)
 *  - 객체가 전혀 없으면 오래 기다린 뒤에만 기본 반경으로 복귀
 *  - 시간 기반 지수 감쇠 + 초당 최대 변화율 제한 → 프레임레이트와 무관하게 매우 느린 전환
 */
export interface AutoZoomConfig {
  minRadius: number;
  maxRadius: number;
  defaultRadius: number;
  /** 객체 분포 반경에 곱하는 여유 배율 */
  margin: number;
  /** 객체 분포 반경에 더하는 여유 (m) */
  padding: number;
  /** 목표 변경을 위한 최소 상대 변화율 */
  hysteresis: number;
  /** 확대(시야 넓힘) 전 대기 시간 (ms) */
  expandDelayMs: number;
  /** 축소(시야 좁힘) 전 대기 시간 (ms) */
  shrinkDelayMs: number;
  /** 객체가 없을 때 기본 반경 복귀 전 대기 시간 (ms) */
  emptyHoldMs: number;
  /** 지수 감쇠 시간 상수 (s) — 클수록 느림 */
  timeConstant: number;
  /** 초당 최대 상대 변화율 */
  maxRatePerSec: number;
}

export const DEFAULT_AUTO_ZOOM: AutoZoomConfig = {
  minRadius: 3.5,
  maxRadius: 16,
  defaultRadius: 6,
  margin: 1.25,
  padding: 1.2,
  hysteresis: 0.2,
  expandDelayMs: 1200,
  shrinkDelayMs: 3500,
  emptyHoldMs: 8000,
  timeConstant: 4.5,
  maxRatePerSec: 0.12,
};

export interface PlanarPoint {
  x: number;
  z: number;
}

export class AutoZoomController {
  readonly config: AutoZoomConfig;
  private target: number;
  private current: number;
  private pendingSince: number | null = null;
  private pendingDirection: 1 | -1 | 0 = 0;
  private lastNonEmptyAt = -Infinity;

  constructor(config: Partial<AutoZoomConfig> = {}) {
    this.config = { ...DEFAULT_AUTO_ZOOM, ...config };
    this.target = this.config.defaultRadius;
    this.current = this.config.defaultRadius;
  }

  get radius(): number {
    return this.current;
  }

  get targetRadius(): number {
    return this.target;
  }

  /** 객체 분포로부터 원하는 반경 계산 (객체 없으면 null) */
  desiredRadius(points: PlanarPoint[]): number | null {
    if (points.length === 0) return null;
    const dists = points.map((p) => Math.hypot(p.x, p.z));
    const extent = points.length >= 3 ? quantile(dists, 0.75) : Math.max(...dists);
    const c = this.config;
    return clamp(extent * c.margin + c.padding, c.minRadius, c.maxRadius);
  }

  /**
   * @param points 현재 객체들의 수평 위치 (시각화 좌표, m)
   * @param now 현재 시각 (ms)
   * @param dt 경과 시간 (s)
   * @returns 적용할 현재 반경
   */
  update(points: PlanarPoint[], now: number, dt: number): number {
    const c = this.config;
    // 시작/재설정 직후 객체가 없으면 그 시점부터 유지 시간을 계산
    if (this.lastNonEmptyAt === -Infinity) this.lastNonEmptyAt = now;
    let desired = this.desiredRadius(points);
    if (desired != null) this.lastNonEmptyAt = now;
    else if (now - this.lastNonEmptyAt >= c.emptyHoldMs) desired = c.defaultRadius;

    if (desired != null) {
      const rel = (desired - this.target) / this.target;
      if (Math.abs(rel) > c.hysteresis) {
        const dir: 1 | -1 = rel > 0 ? 1 : -1;
        if (this.pendingSince == null || this.pendingDirection !== dir) {
          this.pendingSince = now;
          this.pendingDirection = dir;
        }
        const wait = dir > 0 ? c.expandDelayMs : c.shrinkDelayMs;
        if (now - this.pendingSince >= wait) {
          this.target = desired;
          this.pendingSince = null;
          this.pendingDirection = 0;
        }
      } else {
        this.pendingSince = null;
        this.pendingDirection = 0;
      }
    }

    const safeDt = clamp(dt, 0, 0.25);
    let step = (this.target - this.current) * dampFactor(safeDt, c.timeConstant);
    const maxStep = this.current * c.maxRatePerSec * safeDt;
    step = clamp(step, -maxStep, maxStep);
    this.current += step;
    return this.current;
  }

  /** 즉시 반경 설정 (예: 기본 시점 복귀 시 현재 객체 분포로 초기화) */
  reset(radius?: number): void {
    const r = clamp(radius ?? this.config.defaultRadius, this.config.minRadius, this.config.maxRadius);
    this.target = r;
    this.current = r;
    this.pendingSince = null;
    this.pendingDirection = 0;
    this.lastNonEmptyAt = -Infinity;
  }
}

/**
 * 반경 r 에 대한 기본(홈) 카메라 자세: 사용자 뒤쪽 위에서 전방을 내려다봄
 * @param aspect 화면 가로/세로 비. 세로 화면(좁은 수평 시야)에서는 더 멀리서 봐서 좌우 객체도 보이게 함
 */
export function homePose(r: number, aspect = 1.6) {
  const elevation = (52 * Math.PI) / 180;
  const aspectFactor = aspect < 1.2 ? clamp(1.2 / Math.max(aspect, 0.3), 1, 2.4) : 1;
  const dist = r * 1.2 * aspectFactor;
  const target = { x: 0, y: 0, z: -r * 0.38 };
  return {
    target,
    position: {
      x: 0,
      y: Math.sin(elevation) * dist,
      z: target.z + Math.cos(elevation) * dist,
    },
  };
}
