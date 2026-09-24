import { describe, expect, it } from 'vitest';
import { ProximityMonitor, DEFAULT_PROXIMITY_CONFIG } from '../../src/features/safety/ProximityMonitor';
import type { TrackedObject } from '../../src/types';

function obj(partial: Partial<TrackedObject> & { id: string }): TrackedObject {
  return {
    classId: 'person',
    label: partial.label ?? partial.id,
    className: '사람',
    confidence: 0.9,
    boundingBox: { x: 0, y: 0, width: 0.2, height: 0.4 },
    center: { x: 0.5, y: 0.5 },
    estimatedDistance: partial.correctedDistance ?? null,
    correctedDistance: partial.correctedDistance ?? null,
    distanceQuality: 1,
    distanceCues: [],
    truncated: false,
    cameraPosition: null,
    position: { x: 0, y: 0, z: -1 },
    rawPosition: null,
    size: { width: 0.5, height: 1.7, depth: 0.3 },
    rotation: null,
    orientation: { motionState: 'unknown', movementYaw: null, speed: null, facingYaw: null, facingSource: null },
    trackingState: 'tracking',
    firstSeenAt: 0,
    lastSeenAt: 0,
    calibration: { values: {}, sources: {}, instanceId: null, hasSession: false },
    appearance: null,
    ...partial,
  };
}

describe('ProximityMonitor', () => {
  it('alerts once when an object enters the danger zone', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5 };
    const a1 = m.evaluate([obj({ id: 'a', correctedDistance: 1.0 })], 0, config);
    expect(a1).toHaveLength(1);
    expect(a1[0].id).toBe('a');
    // 같은 프레임 대에 계속 가까이 있어도 쿨다운 동안 재경고하지 않음
    const a2 = m.evaluate([obj({ id: 'a', correctedDistance: 0.9 })], 500, config);
    expect(a2).toHaveLength(0);
  });

  it('does not alert for objects outside the configured distance', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5 };
    const alerts = m.evaluate([obj({ id: 'a', correctedDistance: 3 })], 0, config);
    expect(alerts).toHaveLength(0);
  });

  it('does not alert for objects without a resolved distance', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5 };
    const alerts = m.evaluate([obj({ id: 'a', correctedDistance: null })], 0, config);
    expect(alerts).toHaveLength(0);
  });

  it('ignores objects that are only briefly detected (not yet confirmed) or fully lost', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5 };
    const alerts = m.evaluate(
      [
        obj({ id: 'a', correctedDistance: 0.5, trackingState: 'detected' }),
        obj({ id: 'b', correctedDistance: 0.5, trackingState: 'lost' }),
      ],
      0,
      config,
    );
    expect(alerts).toHaveLength(0);
  });

  it('re-alerts once the object leaves and re-enters the zone', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5, cooldownMs: 4000 };
    const a1 = m.evaluate([obj({ id: 'a', correctedDistance: 1.0 })], 0, config);
    expect(a1).toHaveLength(1);
    // 멀어짐 → 구역 이탈
    m.evaluate([obj({ id: 'a', correctedDistance: 5 })], 100, config);
    // 다시 가까워짐 → 쿨다운이 남아있어도 즉시 재경고
    const a2 = m.evaluate([obj({ id: 'a', correctedDistance: 1.0 })], 200, config);
    expect(a2).toHaveLength(1);
  });

  it('alerts again after the cooldown elapses while staying in the zone', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5, cooldownMs: 1000 };
    m.evaluate([obj({ id: 'a', correctedDistance: 1.0 })], 0, config);
    const mid = m.evaluate([obj({ id: 'a', correctedDistance: 1.0 })], 500, config);
    expect(mid).toHaveLength(0);
    const late = m.evaluate([obj({ id: 'a', correctedDistance: 1.0 })], 1500, config);
    expect(late).toHaveLength(1);
  });

  it('tracks multiple objects independently', () => {
    const m = new ProximityMonitor();
    const config = { ...DEFAULT_PROXIMITY_CONFIG, distanceM: 1.5 };
    const alerts = m.evaluate(
      [
        obj({ id: 'a', correctedDistance: 1.0 }),
        obj({ id: 'b', correctedDistance: 5 }),
        obj({ id: 'c', correctedDistance: 0.5 }),
      ],
      0,
      config,
    );
    expect(alerts.map((a) => a.id).sort()).toEqual(['a', 'c']);
  });
});
