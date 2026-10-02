import type { BBox, CameraProfile, Vec3 } from '@/types';
import { degToRad } from '@/utils/math';

export function cameraToWorld(args: {
  bbox: BBox;
  frameWidth: number;
  frameHeight: number;
  distanceM: number;
  objectHeightM: number;
  profile: CameraProfile;
  liveTiltDeg?: number;
}): Vec3 {
  const { bbox, frameWidth, frameHeight, distanceM, objectHeightM, profile } = args;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const vfov = degToRad(profile.fovDeg);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (frameWidth / Math.max(1, frameHeight)));
  const ax = ((cx / frameWidth) - 0.5) * hfov;
  const ay = ((cy / frameHeight) - 0.5) * vfov + degToRad(profile.useTiltSensor ? (args.liveTiltDeg ?? profile.tiltDeg) : profile.tiltDeg);
  const z = -Math.cos(ax) * Math.cos(ay) * distanceM;
  const x = Math.sin(ax) * distanceM;
  const y = Math.max(objectHeightM / 2, profile.heightM - Math.sin(ay) * distanceM);
  return { x, y, z };
}
