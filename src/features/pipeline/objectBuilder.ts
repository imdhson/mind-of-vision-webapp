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
 *  2) 거리 보정 (우선순위)
 *     a. 실제 거리가 있으면: 원본 추정 × (실제 거리 / 실측 당시 원본 추정) — 크기·거리 보정값 무시
 *     b. 없으면: 실제 크기(높이/너비)로 다시 추정한 값 + 거리 보정값
 *     → correctedDistance
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
  // 실제 거리(실측)가 있으면 그것이 최우선: 크기 보정·거리 보정값은 거리 계산에 쓰지 않음(중복 적용 방지)
  // → 비율의 기준은 항상 크기 보정 없는 원본 추정값
  const measured = values.measuredDistance != null;
  const hasSize = !measured && (values.realHeight != null || values.realWidth != null);
  const sized = hasSize ? (estimateDistance({ box: track.box, ...common, sizeOverride: values }) ?? raw) : raw;
  const corrected = applyDistanceCorrection(sized.rawDistance, values);

  const rawCam = boxToCameraPoint(track.box, raw.rawDistance, ctx.intrinsics);
  const cam = boxToCameraPoint(track.box, corrected.distance, ctx.intrinsics);
  const depth = cam.z;
  const size = estimateSize(track.box, depth, ctx.intrinsics, info);

  const toView = (p: Vec3, sizeHeight: number) => {
    const v = cameraToView(p, ctx.profile.cameraHeight, ctx.pitch);
    // 바닥에 놓이는 클래스(사람·가구·동물 등)는 바닥 위에 선 것으로 가정: 중심 높이 = 높이/2
    if (info.grounded) v.y = sizeHeight / 2;
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
