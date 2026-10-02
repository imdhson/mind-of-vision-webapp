import { describe, it, expect } from 'vitest';
import { estimateDistance } from '@/features/depth/DistanceEstimator';
import { defaultProfile } from '@/features/camera/CameraCalibration';
describe('distance', () => {
  it('gets nearer for larger boxes', () => {
    const p = { ...defaultProfile(), useTiltSensor: false };
    const a = estimateDistance({
      bbox: { x: 0, y: 100, width: 50, height: 100 },
      frameWidth: 1280,
      frameHeight: 720,
      objectHeightM: 1.7,
      profile: p,
    });
    const b = estimateDistance({
      bbox: { x: 0, y: 100, width: 100, height: 200 },
      frameWidth: 1280,
      frameHeight: 720,
      objectHeightM: 1.7,
      profile: p,
    });
    expect(b).toBeLessThan(a);
  });
});
