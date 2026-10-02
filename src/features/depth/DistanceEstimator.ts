import type { BBox, CameraProfile } from '@/types';
import { clamp, degToRad } from '@/utils/math';

export function estimateDistance(args: {
  bbox: BBox;
  frameWidth: number;
  frameHeight: number;
  objectHeightM: number;
  profile: CameraProfile;
  liveTiltDeg?: number;
}) {
  const { bbox, frameHeight, objectHeightM, profile } = args;
  const fov = degToRad(clamp(profile.fovDeg, 20, 140));
  const focalPx = frameHeight / (2 * Math.tan(fov / 2));
  const sizeDistance = ((objectHeightM * focalPx) / Math.max(3, bbox.height)) * profile.distanceScale;
  const bottom = (bbox.y + bbox.height) / Math.max(1, frameHeight);
  const imageAngle = Math.atan((bottom - 0.5) * 2 * Math.tan(fov / 2));
  const tilt = degToRad(profile.useTiltSensor ? (args.liveTiltDeg ?? profile.tiltDeg) : profile.tiltDeg);
  const downAngle = imageAngle + tilt;
  let distance = sizeDistance;
  if (bottom > 0.58 && downAngle > degToRad(4)) {
    const floorDistance = profile.heightM / Math.tan(downAngle);
    if (Number.isFinite(floorDistance) && floorDistance > 0.15 && floorDistance < 100) {
      const floorBlend = clamp((bottom - 0.58) / 0.35, 0, 0.45);
      distance = sizeDistance * (1 - floorBlend) + floorDistance * floorBlend;
    }
  }
  return clamp(distance, 0.1, 100);
}
