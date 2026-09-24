import { describe, expect, it } from 'vitest';
import { computeGeometry } from '../../src/features/pipeline/objectBuilder';
import { computeIntrinsics } from '../../src/features/camera/CameraCalibration';
import type { CameraProfile, TrackSnapshot } from '../../src/types';

const profile: CameraProfile = {
  id: 'cam:x',
  deviceId: 'x',
  label: 'x',
  hfovLongDeg: 60,
  cameraHeight: 1.2,
  distanceScale: 1,
  pitchDeg: 0,
  useDeviceTilt: false,
  userDefined: false,
  updatedAt: 0,
};
const ctx = { intrinsics: computeIntrinsics(profile, 1280, 720), profile, pitch: 0 };
const track: TrackSnapshot = {
  id: 'trk-1',
  classId: 'cup',
  ordinal: 1,
  confidence: 0.9,
  box: { x: 0.45, y: 0.45, width: 0.05, height: 0.1 },
  rawBox: { x: 0.45, y: 0.45, width: 0.05, height: 0.1 },
  velocity: { x: 0, y: 0 },
  state: 'tracking',
  hits: 5,
  misses: 0,
  firstSeenAt: 0,
  lastSeenAt: 0,
  appearance: null,
};

describe('computeGeometry (estimate vs corrected)', () => {
  it('without calibration corrected == estimated', () => {
    const g = computeGeometry(track, {}, ctx);
    expect(g.correctedDistance).toBeCloseTo(g.estimatedDistance!);
    expect(g.position!.z).toBeLessThan(0); // 전방
  });

  it('measured distance reproduces the measurement and keeps raw estimate separate', () => {
    const base = computeGeometry(track, {}, ctx).estimatedDistance!;
    const g = computeGeometry(track, { measuredDistance: 1.5, referenceRawDistance: base }, ctx);
    expect(g.correctedDistance).toBeCloseTo(1.5);
    expect(g.estimatedDistance).toBeCloseTo(base);
    const c = g.cameraPosition!;
    expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(1.5);
  });

  it('position offsets shift only the corrected position', () => {
    const g = computeGeometry(track, { offsetX: 0.5, offsetZ: -1 }, ctx);
    expect(g.position!.x - g.rawPosition!.x).toBeCloseTo(0.5);
    expect(g.position!.z - g.rawPosition!.z).toBeCloseTo(-1);
  });

  it('measured distance wins over class real size and offset (no double application)', () => {
    const raw = computeGeometry(track, {}, ctx).estimatedDistance!;
    const g = computeGeometry(
      track,
      { measuredDistance: 2, referenceRawDistance: raw, realHeight: 0.3, distanceOffset: 1 },
      ctx,
    );
    expect(g.correctedDistance).toBeCloseTo(2);
  });

  it('real size override changes the estimate input, not the raw estimate', () => {
    const g0 = computeGeometry(track, {}, ctx);
    const g = computeGeometry(track, { realHeight: 0.2 }, ctx);
    expect(g.estimatedDistance).toBeCloseTo(g0.estimatedDistance!);
    expect(g.correctedDistance!).toBeGreaterThan(g0.correctedDistance!);
  });
});
