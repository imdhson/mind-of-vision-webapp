import { describe, expect, it } from 'vitest';
import { TrailTracker } from '../../src/features/visualization/TrailTracker';

describe('TrailTracker', () => {
  it('does not record a trail for a stationary object', () => {
    const t = new TrailTracker({ minStepM: 0.15, maxAgeMs: 60000, maxPoints: 40 });
    let trails: Record<string, { x: number; z: number; t: number }[]> = {};
    for (let i = 0; i < 10; i++) {
      trails = t.update([{ id: 'a', x: 0, z: -2 }], i * 200);
    }
    expect(trails['a']).toBeUndefined();
  });

  it('records points as an object moves beyond the minimum step', () => {
    const t = new TrailTracker({ minStepM: 0.15, maxAgeMs: 60000, maxPoints: 40 });
    let trails: Record<string, { x: number; z: number; t: number }[]> = {};
    for (let i = 0; i < 20; i++) {
      trails = t.update([{ id: 'a', x: 0, z: -2 - i * 0.05 }], i * 100);
    }
    expect(trails['a']).toBeDefined();
    expect(trails['a'].length).toBeGreaterThan(1);
    // 점들은 실제 이동 순서를 유지해야 함
    for (let i = 1; i < trails['a'].length; i++) {
      expect(trails['a'][i].t).toBeGreaterThan(trails['a'][i - 1].t);
    }
  });

  it('drops a trail as soon as the object is no longer active', () => {
    const t = new TrailTracker({ minStepM: 0.1, maxAgeMs: 60000, maxPoints: 40 });
    t.update([{ id: 'a', x: 0, z: -1 }], 0);
    const trails = t.update([{ id: 'a', x: 0, z: -2 }], 200);
    expect(trails['a']).toBeDefined();
    const after = t.update([], 400);
    expect(after['a']).toBeUndefined();
  });

  it('expires points older than maxAgeMs', () => {
    const t = new TrailTracker({ minStepM: 0.1, maxAgeMs: 500, maxPoints: 40 });
    t.update([{ id: 'a', x: 0, z: -1 }], 0);
    t.update([{ id: 'a', x: 0, z: -2 }], 100);
    const trails = t.update([{ id: 'a', x: 0, z: -2 }], 5000);
    // 5000ms 뒤에는 이전 점들이 모두 만료되고, 정지 상태이므로 새 점도 추가되지 않아 궤적이 사라짐
    expect(trails['a']).toBeUndefined();
  });

  it('caps the number of stored points at maxPoints', () => {
    const t = new TrailTracker({ minStepM: 0.05, maxAgeMs: 600000, maxPoints: 5 });
    let trails: Record<string, { x: number; z: number; t: number }[]> = {};
    for (let i = 0; i < 30; i++) {
      trails = t.update([{ id: 'a', x: 0, z: -i * 0.1 }], i * 100);
    }
    expect(trails['a'].length).toBeLessThanOrEqual(5);
  });
});
