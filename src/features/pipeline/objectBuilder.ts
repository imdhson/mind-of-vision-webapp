import type { CameraProfile, SpatialObject, Track } from '@/types';
import { classMeta } from '@/features/detection/classCatalog';
import { estimateDistance } from '@/features/depth/DistanceEstimator';
import { cameraToWorld } from '@/features/depth/CoordinateTransformer';
import { estimateOrientation } from '@/features/orientation/OrientationEstimator';
import type { CalibrationManager } from '@/features/calibration/CalibrationManager';

export function buildSpatialObject(track: Track, ctx: {
  width: number; height: number; profile: CameraProfile; liveTiltDeg?: number; calibration: CalibrationManager;
}): SpatialObject {
  const meta = classMeta(track.className);
  const resolved = ctx.calibration.resolve(track.id, track.className);
  const height = resolved.values.actualHeight ?? meta.heightM;
  const distanceM = estimateDistance({ bbox: track.bbox, frameWidth: ctx.width, frameHeight: ctx.height, objectHeightM: height, profile: ctx.profile, liveTiltDeg: ctx.liveTiltDeg });
  const pos = cameraToWorld({ bbox: track.bbox, frameWidth: ctx.width, frameHeight: ctx.height, distanceM, objectHeightM: height, profile: ctx.profile, liveTiltDeg: ctx.liveTiltDeg });
  const orient = estimateOrientation(track);
  const obj: SpatialObject = {
    id: track.id, className: track.className, label: meta.ko, score: track.score, bbox: track.bbox, distanceM, position: pos,
    size: { width: meta.widthM, height, depth: meta.depthM }, yawRad: orient.yawRad, moving: orient.moving,
    correctionSource: resolved.source
  };
  return ctx.calibration.apply(obj, resolved.values);
}
