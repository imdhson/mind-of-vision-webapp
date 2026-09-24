import { describe, expect, it } from 'vitest';
import { classifyLens, deviceDisplayName } from '../../src/features/camera/CameraDeviceService';
import { pitchFromOrientation } from '../../src/services/deviceTilt';

describe('classifyLens', () => {
  it.each([
    ['Back Ultra Wide Camera', 'ultra-wide', 'environment'],
    ['Back Telephoto Camera', 'telephoto', 'environment'],
    ['Back Camera', 'unknown', 'environment'],
    ['Front Camera', 'front', 'user'],
    ['camera2 1, facing front', 'front', 'user'],
    ['camera2 0, facing back', 'unknown', 'environment'],
    ['Logitech BRIO (046d:085e)', 'external', 'unknown'],
    ['Integrated Camera (04f2:b6dd)', 'unknown', 'unknown'],
    ['후면 초광각 카메라', 'ultra-wide', 'environment'],
  ])('%s → %s / %s', (label, lens, facing) => {
    const r = classifyLens(label);
    expect(r.lensKind).toBe(lens);
    expect(r.facing).toBe(facing);
  });

  it('prefers the track-reported facing mode', () => {
    expect(classifyLens('Integrated Camera', 'user').facing).toBe('user');
  });

  it('shows the real device name when the lens is unknown', () => {
    const d = { label: 'camera2 0, facing back', lensKind: 'unknown' as const, facing: 'environment' as const };
    expect(deviceDisplayName(d, 0)).toBe('camera2 0, facing back');
    expect(deviceDisplayName({ label: '', lensKind: 'unknown', facing: 'unknown' }, 2)).toBe('카메라 3');
  });
});

describe('pitchFromOrientation', () => {
  it('upright phone = level, flat phone = looking down 90°', () => {
    expect(pitchFromOrientation(90, 0)).toBeCloseTo(0);
    expect(pitchFromOrientation(0, 0)).toBeCloseTo(Math.PI / 2);
    expect(pitchFromOrientation(60, 0)).toBeCloseTo((30 * Math.PI) / 180);
    expect(pitchFromOrientation(0, 90)).toBeCloseTo(0); // 가로 방향 세움
  });
});
