import { describe, it, expect } from 'vitest';
import { cameraToWorld } from '@/features/depth/CoordinateTransformer';
import { defaultProfile } from '@/features/camera/CameraCalibration';
describe('coordinates', () => {
  it('places center object near x=0 and forward -z', () => {
    const p = { ...defaultProfile(), useTiltSensor: false };
    const v = cameraToWorld({
      bbox: { x: 590, y: 260, width: 100, height: 200 },
      frameWidth: 1280,
      frameHeight: 720,
      distanceM: 3,
      objectHeightM: 1.7,
      profile: p,
    });
    expect(Math.abs(v.x)).toBeLessThan(0.2);
    expect(v.z).toBeLessThan(0);
  });
});
