import type { TrackedObject } from '../../types';

/**
 * 근접 경고(안전 알림) 판정 로직
 *
 * 보정 적용 후 거리(correctedDistance)가 설정한 거리보다 가까운 "추적 중"(또는 일시 놓침) 객체를 찾아
 * 경고 대상으로 반환합니다. 같은 객체를 매 프레임 반복 경고하지 않도록 쿨다운을 두고,
 * 위험 구역을 벗어나면 즉시 잊어버려 재진입 시 곧바로 다시 경고합니다.
 */
export interface ProximityConfig {
  /** 이 거리(m) 미만이면 경고 */
  distanceM: number;
  /** 같은 객체를 다시 경고하기까지 최소 간격(ms) */
  cooldownMs: number;
}

export const DEFAULT_PROXIMITY_CONFIG: ProximityConfig = {
  distanceM: 1.5,
  cooldownMs: 4000,
};

export interface ProximityAlert {
  id: string;
  label: string;
  distance: number;
}

const ALERTABLE_STATES = new Set<TrackedObject['trackingState']>(['tracking', 'temporarily_lost']);

export class ProximityMonitor {
  private lastAlertAt = new Map<string, number>();

  reset(): void {
    this.lastAlertAt.clear();
  }

  /** 이번 프레임의 객체 목록을 평가해 새로 경고해야 할 항목을 반환합니다. */
  evaluate(objects: TrackedObject[], now: number, config: ProximityConfig): ProximityAlert[] {
    const alerts: ProximityAlert[] = [];
    const inZone = new Set<string>();

    for (const o of objects) {
      if (!ALERTABLE_STATES.has(o.trackingState)) continue;
      const dist = o.correctedDistance;
      if (dist == null || !Number.isFinite(dist) || dist >= config.distanceM) continue;
      inZone.add(o.id);
      const last = this.lastAlertAt.get(o.id);
      if (last == null || now - last >= config.cooldownMs) {
        this.lastAlertAt.set(o.id, now);
        alerts.push({ id: o.id, label: o.label, distance: dist });
      }
    }

    // 구역을 벗어난 객체는 잊어버려, 다시 들어오면 즉시 경고합니다.
    for (const id of this.lastAlertAt.keys()) {
      if (!inZone.has(id)) this.lastAlertAt.delete(id);
    }
    return alerts;
  }
}
