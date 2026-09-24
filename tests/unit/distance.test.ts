import { describe, expect, it } from 'vitest';
import { applyDistanceCorrection, estimateDistance } from '../../src/features/depth/DistanceEstimator';
import { computeIntrinsics, focal35ToHfov, hfovToFocal35 } from '../../src/features/camera/CameraCalibration';
import { getClassInfo } from '../../src/features/detection/classCatalog';
import { box } from './helpers';

const K = computeIntrinsics({ hfovLongDeg: 60 }, 1280, 720);

/** 광축 위 깊이 z 에 있는 높이 H 객체의 정규화 상자 (중앙) */
function projected(H: number, W: number, z: number) {
  const hN = (K.fy * H) / z / K.height;
  const wN = (K.fx * W) / z / K.width;
  return box(0.5 - wN / 2, 0.5 - hN / 2, wN, hN);
}

describe('camera intrinsics', () => {
  it('uses the long side for FOV so portrait and landscape agree', () => {
    const land = computeIntrinsics({ hfovLongDeg: 70 }, 1280, 720);
    const port = computeIntrinsics({ hfovLongDeg: 70 }, 720, 1280);
    expect(land.fx).toBeCloseTo(port.fx);
  });
  it('converts 35mm focal length and FOV both ways', () => {
    expect(hfovToFocal35(focal35ToHfov(26))).toBeCloseTo(26);
    expect(focal35ToHfov(13)).toBeGreaterThan(100);
  });
  it('zoom factor increases focal length', () => {
    expect(computeIntrinsics({ hfovLongDeg: 60 }, 1280, 720, 2).fx).toBeCloseTo(K.fx * 2);
  });
});

describe('estimateDistance', () => {
  const cup = getClassInfo('cup');
  const common = { intrinsics: K, cameraHeight: 1.2, pitch: 0, distanceScale: 1 };

  it('recovers distance from known size (pinhole model)', () => {
    const b = projected(cup.prior.height, cup.prior.width, 2);
    const r = estimateDistance({ box: b, classInfo: cup, ...common })!;
    expect(r.rawDepth).toBeCloseTo(2, 1);
    expect(r.rawDistance).toBeGreaterThanOrEqual(r.rawDepth);
  });

  it('uses user-provided real size', () => {
    const b = projected(0.2, 0.17, 2); // 실제로는 2배 큰 컵
    const withPrior = estimateDistance({ box: b, classInfo: cup, ...common })!;
    const withSize = estimateDistance({ box: b, classInfo: cup, ...common, sizeOverride: { realHeight: 0.2, realWidth: 0.17 } })!;
    expect(withPrior.rawDepth).toBeLessThan(1.3);
    expect(withSize.rawDepth).toBeCloseTo(2, 1);
  });

  it('adds a ground-plane cue for floor objects that agrees with geometry', () => {
    const chair = getClassInfo('chair');
    const z = 5;
    const cameraHeight = 1.2;
    // 바닥 접지점 v 좌표: cy + fy * h / z
    const vBottom = (K.cy + (K.fy * cameraHeight) / z) / K.height;
    const hN = (K.fy * chair.prior.height) / z / K.height;
    const wN = (K.fx * chair.prior.width) / z / K.width;
    const b = box(0.5 - wN / 2, vBottom - hN, wN, hN);
    const r = estimateDistance({ box: b, classInfo: chair, ...common, cameraHeight })!;
    const ground = r.cues.find((c) => c.method === 'ground-plane');
    expect(ground).toBeDefined();
    expect(ground!.distance).toBeCloseTo(5, 1);
    expect(r.rawDepth).toBeCloseTo(5, 1);
    expect(r.quality).toBeGreaterThan(0.7);
  });

  it('flags truncated boxes and lowers quality', () => {
    const person = getClassInfo('person');
    const full = estimateDistance({ box: box(0.4, 0.2, 0.1, 0.5), classInfo: person, ...common })!;
    const cut = estimateDistance({ box: box(0.4, 0, 0.1, 1), classInfo: person, ...common })!;
    expect(cut.truncated).toBe(true);
    expect(cut.quality).toBeLessThan(full.quality);
  });

  it('applies the camera distance scale', () => {
    const b = projected(cup.prior.height, cup.prior.width, 2);
    const r = estimateDistance({ box: b, classInfo: cup, ...common, distanceScale: 1.5 })!;
    expect(r.rawDepth).toBeCloseTo(3, 1);
  });
});

describe('applyDistanceCorrection priority', () => {
  it('measured distance uses ratio and ignores offset', () => {
    const r = applyDistanceCorrection(2, { measuredDistance: 3, referenceRawDistance: 2, distanceOffset: 5 });
    expect(r.mode).toBe('measured');
    expect(r.distance).toBeCloseTo(3);
    // 객체가 두 배 멀어지면 비율 유지
    expect(applyDistanceCorrection(4, { measuredDistance: 3, referenceRawDistance: 2 }).distance).toBeCloseTo(6);
  });
  it('offset applies only without measured distance', () => {
    expect(applyDistanceCorrection(2, { distanceOffset: 0.5 })).toEqual({ distance: 2.5, mode: 'offset' });
  });
  it('no calibration leaves distance unchanged', () => {
    expect(applyDistanceCorrection(2, {})).toEqual({ distance: 2, mode: 'none' });
  });
  it('never returns a negative distance', () => {
    expect(applyDistanceCorrection(1, { distanceOffset: -5 }).distance).toBeGreaterThan(0);
  });
});
