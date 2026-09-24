import type { AppearanceSignature, Detection, NormalizedBox, TrackSnapshot, TrackingState } from '../../types';
import { boxCenter, iou, normalizedCenterDistance } from '../../utils/geometry';
import { appearanceSimilarity, blendAppearance } from '../../utils/appearance';
import { clamp } from '../../utils/math';

/**
 * 다중 객체 추적기 (IoU + 중심 거리 + 등속 예측 + 외형 유사도)
 *
 * - 같은 클래스끼리만 매칭하여 개별 추적 ID를 부여합니다. (의자 2개 → 서로 다른 ID)
 * - 인식이 잠시 누락되어도 graceMs 동안 'temporarily_lost' 상태로 유지합니다.
 * - 유예 기간이 지나면 'lost' 로 표시한 뒤 lostRetentionMs 후 완전히 제거합니다.
 * - 추적 ID는 이번 실행 동안만 유효한 일시적 식별자입니다.
 */
export interface TrackerConfig {
  /** 확정(tracking)으로 전환하기 위한 연속 인식 횟수 */
  confirmHits: number;
  /** 확정된 추적의 인식 누락 허용 시간 (ms) */
  graceMs: number;
  /** 확정 전(detected) 추적의 누락 허용 시간 (ms) */
  tentativeGraceMs: number;
  /** 'lost' 상태를 목록에 남겨두는 시간 (ms) */
  lostRetentionMs: number;
  /** 매칭 허용 최소 IoU (중심 거리 조건과 OR) */
  minIou: number;
  /** 매칭 허용 최대 정규화 중심 거리 */
  maxCenterDistance: number;
  /** 경계 상자 중심 평활화 계수 (0..1, 클수록 즉각 반영) */
  positionAlpha: number;
  /** 경계 상자 크기 평활화 계수 */
  sizeAlpha: number;
  /** 매칭 비용 계산 시 외형 가중치 */
  appearanceWeight: number;
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  confirmHits: 2,
  graceMs: 1500,
  tentativeGraceMs: 400,
  lostRetentionMs: 700,
  minIou: 0.1,
  maxCenterDistance: 1.0,
  positionAlpha: 0.55,
  sizeAlpha: 0.35,
  appearanceWeight: 0.35,
};

interface InternalTrack extends TrackSnapshot {
  lostAt: number | null;
}

export interface TrackerInput {
  detections: Detection[];
  timestamp: number;
  appearances?: (AppearanceSignature | null)[];
}

let globalCounter = 0;

export class ObjectTracker {
  private tracks = new Map<string, InternalTrack>();
  private lastTimestamp: number | null = null;
  readonly config: TrackerConfig;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
  }

  reset(): void {
    this.tracks.clear();
    this.lastTimestamp = null;
  }

  snapshots(): TrackSnapshot[] {
    return [...this.tracks.values()].map(toSnapshot);
  }

  /** 새 인식 프레임을 반영하고 현재 추적 목록을 반환합니다. */
  update({ detections, timestamp, appearances }: TrackerInput): TrackSnapshot[] {
    const cfg = this.config;
    const dt = this.lastTimestamp == null ? 0 : clamp((timestamp - this.lastTimestamp) / 1000, 0, 1);
    this.lastTimestamp = timestamp;

    const active = [...this.tracks.values()].filter((t) => t.state !== 'lost');

    // 1) 비용 계산 (같은 클래스만)
    const pairs: { t: InternalTrack; d: number; cost: number }[] = [];
    for (const t of active) {
      const predicted = predictBox(t, Math.min(dt + t.misses * dt, 0.6));
      detections.forEach((det, di) => {
        if (det.classId !== t.classId) return;
        const ov = Math.max(iou(predicted, det.box), iou(t.box, det.box));
        const cd = normalizedCenterDistance(predicted, det.box);
        if (ov < cfg.minIou && cd > cfg.maxCenterDistance) return;
        const sizeRatio = Math.log(
          Math.max(1e-6, det.box.width * det.box.height) / Math.max(1e-6, t.box.width * t.box.height),
        );
        let cost = 1 - ov + 0.5 * cd + 0.15 * Math.abs(sizeRatio);
        const sim = appearanceSimilarity(t.appearance, appearances?.[di] ?? null);
        if (sim != null) cost += cfg.appearanceWeight * (1 - sim);
        pairs.push({ t, d: di, cost });
      });
    }

    // 2) 비용 오름차순 탐욕적 할당 (소규모 장면에서 충분히 안정적)
    pairs.sort((a, b) => a.cost - b.cost);
    const usedTracks = new Set<string>();
    const usedDets = new Set<number>();
    for (const p of pairs) {
      if (usedTracks.has(p.t.id) || usedDets.has(p.d)) continue;
      usedTracks.add(p.t.id);
      usedDets.add(p.d);
      this.applyMatch(p.t, detections[p.d], appearances?.[p.d] ?? null, timestamp, dt);
    }

    // 3) 매칭되지 않은 추적: 누락 처리
    for (const t of this.tracks.values()) {
      if (usedTracks.has(t.id)) continue;
      if (t.state === 'lost') {
        if (t.lostAt != null && timestamp - t.lostAt > cfg.lostRetentionMs) this.tracks.delete(t.id);
        continue;
      }
      t.misses++;
      const since = timestamp - t.lastSeenAt;
      const confirmed = t.hits >= cfg.confirmHits;
      if (!confirmed && since > cfg.tentativeGraceMs) {
        // 확정되지 않은 일시적 오검출은 즉시 정리
        this.tracks.delete(t.id);
      } else if (confirmed && since > cfg.graceMs) {
        t.state = 'lost';
        t.lostAt = timestamp;
        t.velocity = { x: 0, y: 0 };
      } else if (confirmed) {
        t.state = 'temporarily_lost';
        // 가려진 동안에는 속도를 감쇠시켜 상자가 멀리 날아가지 않도록 함
        t.velocity = { x: t.velocity.x * 0.5, y: t.velocity.y * 0.5 };
      }
    }

    // 4) 새 추적 생성
    detections.forEach((det, di) => {
      if (usedDets.has(di)) return;
      const id = `trk-${++globalCounter}`;
      this.tracks.set(id, {
        id,
        classId: det.classId,
        ordinal: this.nextOrdinal(det.classId),
        confidence: det.score,
        box: { ...det.box },
        rawBox: { ...det.box },
        velocity: { x: 0, y: 0 },
        state: 'detected',
        hits: 1,
        misses: 0,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        appearance: appearances?.[di] ?? null,
        lostAt: null,
      });
    });

    return this.snapshots();
  }

  private applyMatch(
    t: InternalTrack,
    det: Detection,
    appearance: AppearanceSignature | null,
    timestamp: number,
    dt: number,
  ) {
    const cfg = this.config;
    const prevCenter = boxCenter(t.box);
    const detCenter = boxCenter(det.box);
    const pa = cfg.positionAlpha;
    const sa = cfg.sizeAlpha;
    const width = t.box.width + (det.box.width - t.box.width) * sa;
    const height = t.box.height + (det.box.height - t.box.height) * sa;
    const cx = prevCenter.x + (detCenter.x - prevCenter.x) * pa;
    const cy = prevCenter.y + (detCenter.y - prevCenter.y) * pa;
    t.box = { x: cx - width / 2, y: cy - height / 2, width, height };
    t.rawBox = { ...det.box };
    if (dt > 0) {
      const vx = (cx - prevCenter.x) / dt;
      const vy = (cy - prevCenter.y) / dt;
      t.velocity = { x: t.velocity.x * 0.6 + vx * 0.4, y: t.velocity.y * 0.6 + vy * 0.4 };
    }
    t.confidence = t.confidence * 0.6 + det.score * 0.4;
    t.hits++;
    t.misses = 0;
    t.lastSeenAt = timestamp;
    t.lostAt = null;
    t.appearance = blendAppearance(t.appearance, appearance);
    t.state = (t.hits >= cfg.confirmHits ? 'tracking' : 'detected') satisfies TrackingState;
  }

  private nextOrdinal(classId: string): number {
    const used = new Set(
      [...this.tracks.values()].filter((t) => t.classId === classId && t.state !== 'lost').map((t) => t.ordinal),
    );
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }
}

function predictBox(t: TrackSnapshot, dt: number): NormalizedBox {
  return { ...t.box, x: t.box.x + t.velocity.x * dt, y: t.box.y + t.velocity.y * dt };
}

function toSnapshot(t: InternalTrack): TrackSnapshot {
  const { lostAt: _lostAt, ...rest } = t;
  return { ...rest, box: { ...t.box }, rawBox: { ...t.rawBox }, velocity: { ...t.velocity } };
}
