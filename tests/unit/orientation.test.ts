import { describe, expect, it } from 'vitest';
import { OrientationEstimator } from '../../src/features/orientation/OrientationEstimator';
import { getClassInfo } from '../../src/features/detection/classCatalog';

describe('OrientationEstimator', () => {
  it('estimates heading for a person walking to the right (+X)', () => {
    const est = new OrientationEstimator();
    const person = getClassInfo('person');
    let r;
    for (let i = 0; i <= 15; i++) r = est.update('p', person, { x: i * 0.1, y: 0.85, z: -3 }, i * 100, true);
    expect(r!.motionState).toBe('moving');
    expect(r!.movementYaw).toBeCloseTo(Math.PI / 2, 1);
    expect(r!.facingYaw).toBeCloseTo(Math.PI / 2, 1);
    expect(r!.facingSource).toBe('motion');
  });

  it('keeps facing unknown for a static chair', () => {
    const est = new OrientationEstimator();
    const chair = getClassInfo('chair');
    let r;
    for (let i = 0; i <= 15; i++) r = est.update('c', chair, { x: 0.5, y: 0.45, z: -2 }, i * 100, true);
    expect(r!.motionState).toBe('stationary');
    expect(r!.facingYaw).toBeNull();
  });

  it('does not treat distance-estimate jitter as movement', () => {
    const est = new OrientationEstimator();
    const person = getClassInfo('person');
    let r;
    for (let i = 0; i <= 20; i++) {
      const jitter = (i % 2 ? 1 : -1) * 0.12;
      r = est.update('p', person, { x: 0, y: 0.85, z: -3 + jitter }, i * 100, true);
    }
    expect(r!.motionState).toBe('stationary');
  });

  it('uses user yaw correction as the facing when unknown', () => {
    const est = new OrientationEstimator();
    const chair = getClassInfo('chair');
    const r = est.update('c', chair, { x: 0, y: 0, z: -2 }, 0, true, 90);
    expect(r.facingYaw).toBeCloseTo(Math.PI / 2);
    expect(r.facingSource).toBe('user');
  });

  it('moving chair still has no facing (moving ≠ facing)', () => {
    const est = new OrientationEstimator();
    const chair = getClassInfo('chair');
    let r;
    for (let i = 0; i <= 15; i++) r = est.update('c', chair, { x: i * 0.1, y: 0.45, z: -2 }, i * 100, true);
    expect(r!.motionState).toBe('moving');
    expect(r!.movementYaw).not.toBeNull();
    expect(r!.facingYaw).toBeNull();
  });
});
