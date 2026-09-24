import { describe, expect, it } from 'vitest';
import {
  boxToCameraPoint,
  cameraToView,
  pixelRay,
  viewToCamera,
} from '../../src/features/depth/CoordinateTransformer';
import { computeIntrinsics } from '../../src/features/camera/CameraCalibration';
import { box } from './helpers';

const K = computeIntrinsics({ hfovLongDeg: 60 }, 1280, 720);

describe('coordinate transforms', () => {
  it('principal point ray is the optical axis', () => {
    const r = pixelRay(K.cx, K.cy, K);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.z).toBeCloseTo(1);
  });

  it('camera forward maps to view -Z at camera height (level camera)', () => {
    const v = cameraToView({ x: 0, y: 0, z: 3 }, 1.2, 0);
    expect(v).toEqual({ x: 0, y: 1.2, z: -3 });
  });

  it('right in image maps to +X, down in image maps to lower Y', () => {
    const v = cameraToView({ x: 1, y: 0.5, z: 2 }, 1.2, 0);
    expect(v.x).toBe(1);
    expect(v.y).toBeCloseTo(0.7);
  });

  it('view ↔ camera round trip with pitch', () => {
    const p = { x: 0.3, y: -0.2, z: 2.5 };
    const pitch = 0.4;
    const back = viewToCamera(cameraToView(p, 1.3, pitch), 1.3, pitch);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
    expect(back.z).toBeCloseTo(p.z);
  });

  it('a camera pitched down 90° looks at the floor', () => {
    const v = cameraToView({ x: 0, y: 0, z: 1.2 }, 1.2, Math.PI / 2);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(0);
  });

  it('box center point lies at the requested distance', () => {
    const p = boxToCameraPoint(box(0.7, 0.2, 0.1, 0.1), 4, K);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(4);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(0);
  });
});
