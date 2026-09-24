import { describe, expect, it } from 'vitest';
import { AutoZoomController, homePose } from '../../src/features/visualization/AutoCameraController';

function run(c: AutoZoomController, pts: { x: number; z: number }[], fromMs: number, durMs: number, stepMs = 16) {
  let r = c.radius;
  for (let t = fromMs; t < fromMs + durMs; t += stepMs) r = c.update(pts, t, stepMs / 1000);
  return r;
}

describe('AutoZoomController', () => {
  it('does not jump when a far object suddenly appears', () => {
    const c = new AutoZoomController();
    c.reset(6);
    const r1 = run(c, [{ x: 0, z: -15 }], 0, 500);
    expect(r1).toBeCloseTo(6, 5); // 대기 시간 동안 변화 없음
    const r2 = run(c, [{ x: 0, z: -15 }], 500, 1500);
    expect(r2).toBeLessThan(6 * 1.2); // 이후에도 매우 천천히
    const r3 = run(c, [{ x: 0, z: -15 }], 2000, 40000);
    expect(r3).toBeGreaterThan(15); // 결국 도달
  });

  it('never changes faster than the max rate', () => {
    const c = new AutoZoomController();
    c.reset(4);
    let prev = c.radius;
    for (let t = 0; t < 30000; t += 16) {
      const r = c.update([{ x: 0, z: -25 }], t, 0.016);
      expect(Math.abs(r - prev) / prev).toBeLessThanOrEqual(c.config.maxRatePerSec * 0.016 + 1e-9);
      prev = r;
    }
  });

  it('ignores small fluctuations (hysteresis) — no oscillation', () => {
    const c = new AutoZoomController();
    const base = c.desiredRadius([{ x: 0, z: -5 }])!;
    c.reset(base);
    let t = 0;
    for (let i = 0; i < 2000; i++, t += 16) {
      const z = -5 + Math.sin(i / 7) * 0.5; // ±10% 잡음
      c.update([{ x: 0, z }], t, 0.016);
    }
    expect(c.radius).toBeCloseTo(base, 5);
  });

  it('holds the view when objects briefly disappear', () => {
    const c = new AutoZoomController();
    c.reset(12);
    const r = run(c, [], 0, 5000);
    expect(r).toBeCloseTo(12, 5);
  });

  it('eventually returns to default when the scene is empty for long', () => {
    const c = new AutoZoomController();
    c.reset(20);
    const r = run(c, [], 0, 60000);
    expect(r).toBeLessThan(8);
  });

  it('home pose looks forward and down from behind the user', () => {
    const p = homePose(6);
    expect(p.position.y).toBeGreaterThan(0);
    expect(p.target.z).toBeLessThan(0);
    expect(p.position.z).toBeGreaterThan(p.target.z);
  });
});
