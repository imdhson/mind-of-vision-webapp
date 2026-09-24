import { describe, expect, it } from 'vitest';
import {
  cleanValues,
  isEmptyValues,
  resolveCalibration,
  validateCalibrationValues,
  validateProfile,
} from '../../src/features/calibration/CalibrationManager';
import type { ClassCalibration, InstanceCalibration } from '../../src/types';

const cls = (values: ClassCalibration['values']): ClassCalibration => ({
  id: 'class:cup',
  classId: 'cup',
  values,
  updatedAt: 0,
});
const inst = (values: InstanceCalibration['values']): InstanceCalibration => ({
  id: 'inst:1',
  classId: 'cup',
  name: 'x',
  values,
  cameraKey: null,
  appearance: null,
  createdAt: 0,
  updatedAt: 0,
});

describe('resolveCalibration', () => {
  it('overrides per field: session > instance > class (no summing)', () => {
    const r = resolveCalibration(cls({ offsetX: 1, realHeight: 0.1 }), inst({ offsetX: 2 }), { offsetX: 3 });
    expect(r.values.offsetX).toBe(3);
    expect(r.values.realHeight).toBe(0.1);
    expect(r.sources.offsetX).toBe('session');
    expect(r.sources.realHeight).toBe('class');
    expect(r.instanceId).toBe('inst:1');
    expect(r.hasSession).toBe(true);
  });

  it('takes measured distance and its reference from the same layer', () => {
    const r = resolveCalibration(
      cls({ measuredDistance: 1, referenceRawDistance: 0.8 }),
      inst({ measuredDistance: 2, referenceRawDistance: 1.5 }),
      undefined,
    );
    expect(r.values.measuredDistance).toBe(2);
    expect(r.values.referenceRawDistance).toBe(1.5);
  });

  it('returns empty values when nothing is set', () => {
    const r = resolveCalibration(undefined, undefined, undefined);
    expect(r.values).toEqual({});
    expect(r.hasSession).toBe(false);
  });
});

describe('validation', () => {
  it('rejects out-of-range and NaN values', () => {
    const e = validateCalibrationValues({ measuredDistance: 0, realHeight: NaN, yawOffsetDeg: 200, offsetX: 1 });
    expect(e.measuredDistance).toBeTruthy();
    expect(e.realHeight).toBeTruthy();
    expect(e.yawOffsetDeg).toBeTruthy();
    expect(e.offsetX).toBeUndefined();
  });
  it('accepts valid values', () => {
    expect(validateCalibrationValues({ measuredDistance: 1.5, distanceOffset: -0.3 })).toEqual({});
  });
  it('validates camera profile ranges', () => {
    expect(validateProfile({ hfovLongDeg: 5 }).hfovLongDeg).toBeTruthy();
    expect(validateProfile({ hfovLongDeg: 70, cameraHeight: 1.3, distanceScale: 1, pitchDeg: 0 })).toEqual({});
  });
  it('cleanValues drops NaN and orphan reference', () => {
    expect(cleanValues({ offsetX: NaN, referenceRawDistance: 2, realHeight: 0.2 })).toEqual({ realHeight: 0.2 });
    expect(isEmptyValues({ referenceRawDistance: 3 })).toBe(true);
  });
});
