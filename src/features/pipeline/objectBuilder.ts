import type {
  CalibrationValues,
  CameraProfile,
  OrientationEstimate,
  ResolvedCalibration,
  TrackSnapshot,
  TrackedObject,
  Vec3,
} from '../../types';
import { getClassInfo } from '../detection/classCatalog';
import type { CameraIntrinsics } from '../camera/CameraCalibration';
import { applyDistanceCorrection, estimateDistance } from '../depth/DistanceEstimator';
import { addVec, boxToCameraPoint, cameraToView, estimateSize } from '../depth/CoordinateTransformer';
import { boxCenter } from '../../utils/geometry';

/**
 * 추적 결과 1개 → 공통 객체 상태(TrackedObject)
 *
 * 처리 순서:
 *  1) 원본 추정: 클래스 사전 크기 + 카메라 프로파일 → estimatedDistance, rawPosition
 *  2) 크기 보정(실제 높이/너비)을 반영한 기준 추정 → base
 *  3) 거리 보정: 실제 거리(비율) 우선, 없으면 거리 보정값 → correctedDistance
 *  4) 카메라 좌표 → 시각화 좌표 변환 후 X/Y/Z 위치 보정 → position
 *  방향(orientation)은 호출 측에서 rawPosition 기반으로 계산해 전달합니다.
 */
export interface BuildContext {
  intrinsics: CameraIntrinsics;
  profile: CameraProfile;
  pitch: number;
}

export interface BuiltGeometry {
  estimatedDistance: number | null;
  baseDistance: number | null;
  correctedDistance: number | null;
  distanceQuality: number;
  distanceCues: TrackedObject['distanceCues'];
  truncated: boolean;
  cameraPosition: Vec3 | null;
  rawPosition: Vec3 | null;
  position: Vec3 | null;
  size: TrackedObject['size'];
}

export function computeGeometry(track: TrackSnapshot, values: CalibrationValues, ctx: BuildContext): BuiltGeometry {
  const info = getClassInfo(track.classId);
  const common = {
    classInfo: info,
    intrinsics: ctx.intrinsics,
    cameraHeight: ctx.profile.cameraHeight,
    pitch: ctx.pitch,
    distanceScale: ctx.profile.distanceScale,
  };
  const raw = estimateDistance({ box: track.box, ...common });
  if (!raw) {
    return {
      estimatedDistance: null,
      baseDistance: null,
      correctedDistance: null,
      distanceQuality: 0,
      distanceCues: [],
      truncated: false,
      cameraPosition: null,
      rawPosition: null,
      position: null,
      size: null,
    };
  }
  const hasSize = values.realHeight != null || values.realWidth != null;
  const sized = hasSize
    ? (estimateDistance({ box: track.box, ...common, sizeOverride: values }) ?? raw)
    : raw;
  const corrected = applyDistanceCorrection(sized.rawDistance, values);

  const rawCam = boxToCameraPoint(track.box, raw.rawDistance, ctx.intrinsics);
  const cam = boxToCameraPoint(track.box, corrected.distance, ctx.intrinsics);
  const depth = cam.z;
  const size = estimateSize(track.box, depth, ctx.intrinsics, info);

  const toView = (p: Vec3, sizeHeight: number) => {
    const v = cameraToView(p, ctx.profile.cameraHeight, ctx.pitch);
    // 바닥에 놓이는 객체는 바닥 위에 놓이도록 중심 높이를 높이/2 이상으로 유지
    if (info.grounded) v.y = Math.max(v.y, sizeHeight / 2);
    else v.y = Math.max(v.y, 0.02);
    return v;
  };
  const rawSize = estimateSize(track.box, rawCam.z, ctx.intrinsics, info);
  const rawPosition = toView(rawCam, rawSize.height);
  const position = addVec(toView(cam, size.height), {
    x: values.offsetX ?? 0,
    y: values.offsetY ?? 0,
    z: values.offsetZ ?? 0,
  });

  return {
    estimatedDistance: raw.rawDistance,
    baseDistance: sized.rawDistance,
    correctedDistance: corrected.distance,
    distanceQuality: sized.quality,
    distanceCues: sized.cues,
    truncated: sized.truncated,
    cameraPosition: cam,
    rawPosition,
    position,
    size,
  };
}

export function buildTrackedObject(
  track: TrackSnapshot,
  calibration: ResolvedCalibration,
  geometry: BuiltGeometry,
  orientation: OrientationEstimate,
): TrackedObject {
  const info = getClassInfo(track.classId);
  return {
    id: track.id,
    classId: track.classId,
    className: info.nameKo,
    label: `${info.nameKo} #${track.ordinal}`,
    confidence: track.confidence,
    boundingBox: track.box,
    center: boxCenter(track.box),
    estimatedDistance: geometry.estimatedDistance,
    correctedDistance: geometry.correctedDistance,
    distanceQuality: geometry.distanceQuality,
    distanceCues: geometry.distanceCues,
    truncated: geometry.truncated,
    cameraPosition: geometry.cameraPosition,
    position: geometry.position,
    rawPosition: geometry.rawPosition,
    size: geometry.size,
    rotation: orientation.facingYaw != null ? { x: 0, y: orientation.facingYaw, z: 0 } : null,
    orientation,
    trackingState: track.state,
    firstSeenAt: track.firstSeenAt,
    lastSeenAt: track.lastSeenAt,
    calibration,
    calibrationId: calibration.instanceId ?? undefined,
    appearance: track.appearance,
  };
}
