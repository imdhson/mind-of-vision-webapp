import type { CalibrationValues, DistanceCue, DistanceEstimate, NormalizedBox } from '../../types';
import type { ClassInfo } from '../detection/classCatalog';
import type { CameraIntrinsics } from '../camera/CameraCalibration';
import { edgeContact } from '../../utils/geometry';
import { clamp } from '../../utils/math';

/**
 * 단안 카메라 거리 추정기
 *
 * 세 가지 단서를 조합합니다. 모두 "광축 방향 깊이 z(m)"로 환산한 뒤 로그 가중 평균합니다.
 *  1) size-height : z = fy · 실제높이 / 상자높이(px)
 *  2) size-width  : z = fx · 실제너비 / 상자너비(px)   (방향에 따라 너비가 달라지는 클래스는 가중치 낮음)
 *  3) ground-plane: 바닥에 놓인 객체의 하단 접지점 광선과 바닥 평면(카메라 높이 h)의 교점
 *
 * 경계 상자가 영상 가장자리에 닿으면 해당 치수는 잘린 값이므로 가중치를 크게 낮춥니다.
 * 결과는 "추정값"이며 사용자 보정과는 분리해서 관리합니다.
 */
export interface DistanceInput {
  box: NormalizedBox;
  classInfo: ClassInfo;
  intrinsics: CameraIntrinsics;
  /** 카메라 높이 (m) */
  cameraHeight: number;
  /** 카메라 피치 (rad, +는 아래를 봄) */
  pitch: number;
  /** 카메라 프로파일의 거리 배율 */
  distanceScale: number;
  /** 크기 보정 (없으면 클래스 사전값) */
  sizeOverride?: Pick<CalibrationValues, 'realHeight' | 'realWidth'>;
}

export const MIN_DISTANCE = 0.1;
export const MAX_DISTANCE = 60;

/** 방향에 따라 보이는 너비가 크게 변하는 형상 */
const WIDTH_UNRELIABLE = new Set(['vehicle', 'twoWheeler', 'animal', 'couch', 'bed', 'table', 'person', 'laptop']);

export function estimateDistance(input: DistanceInput): DistanceEstimate | null {
  const { box, classInfo, intrinsics: K, cameraHeight, pitch, distanceScale, sizeOverride } = input;
  const hPx = box.height * K.height;
  const wPx = box.width * K.width;
  if (hPx < 2 || wPx < 2) return null;

  const edges = edgeContact(box);
  const heightTruncated = edges.top || edges.bottom;
  const widthTruncated = edges.left || edges.right;
  const realH = sizeOverride?.realHeight ?? classInfo.prior.height;
  const realW = sizeOverride?.realWidth ?? classInfo.prior.width;
  const userSized = sizeOverride?.realHeight != null || sizeOverride?.realWidth != null;
  const sizePenalty = classInfo.sizeVaries && !userSized ? 0.5 : 1;

  const cues: DistanceCue[] = [];

  cues.push({
    method: 'size-height',
    distance: (K.fy * realH) / hPx,
    weight: (heightTruncated ? 0.15 : 1) * sizePenalty,
  });

  const widthBase = WIDTH_UNRELIABLE.has(classInfo.shape) && sizeOverride?.realWidth == null ? 0.3 : 0.8;
  cues.push({
    method: 'size-width',
    distance: (K.fx * realW) / wPx,
    weight: (widthTruncated ? 0.1 : widthBase) * sizePenalty,
  });

  if (classInfo.grounded && !edges.bottom && cameraHeight > 0.05) {
    const vBottom = (box.y + box.height) * K.height;
    const ry = (vBottom - K.cy) / K.fy;
    const denom = ry * Math.cos(pitch) + Math.sin(pitch);
    // 수평선 근처(교점이 매우 멀거나 무한대)는 불안정하므로 제외
    if (denom > 0.035) {
      const z = cameraHeight / denom;
      if (z > MIN_DISTANCE && z < MAX_DISTANCE) {
        cues.push({ method: 'ground-plane', distance: z, weight: classInfo.sizeVaries ? 0.9 : 0.6 });
      }
    }
  }

  const valid = cues.filter((c) => Number.isFinite(c.distance) && c.distance > 0 && c.weight > 0);
  if (valid.length === 0) return null;

  // 로그 공간 가중 평균 + 이상치(중앙값 대비 2배 이상 차이) 가중치 감소
  const logMean = (list: DistanceCue[]) => {
    const tw = list.reduce((s, c) => s + c.weight, 0);
    return list.reduce((s, c) => s + Math.log(c.distance) * c.weight, 0) / tw;
  };
  const first = logMean(valid);
  const adjusted = valid.map((c) => {
    const dev = Math.abs(Math.log(c.distance) - first);
    return { ...c, weight: dev > Math.log(2) ? c.weight * 0.25 : c.weight };
  });
  const logZ = logMean(adjusted);
  const depth = clamp(Math.exp(logZ) * distanceScale, MIN_DISTANCE, MAX_DISTANCE);

  // 광축 깊이 → 상자 중심 방향 직선거리
  const u = (box.x + box.width / 2) * K.width;
  const v = (box.y + box.height / 2) * K.height;
  const rx = (u - K.cx) / K.fx;
  const ry = (v - K.cy) / K.fy;
  const rayLen = Math.sqrt(1 + rx * rx + ry * ry);

  // 품질: 단서 간 일치도 × 잘림 × 크기 편차
  const tw = adjusted.reduce((s, c) => s + c.weight, 0);
  const spread = Math.sqrt(adjusted.reduce((s, c) => s + c.weight * (Math.log(c.distance) - logZ) ** 2, 0) / tw);
  const truncated = heightTruncated && widthTruncated ? true : heightTruncated || widthTruncated;
  let quality = Math.exp(-spread * 2);
  if (heightTruncated && widthTruncated) quality *= 0.3;
  else if (truncated) quality *= 0.7;
  quality *= sizePenalty === 1 ? 1 : 0.75;

  return {
    rawDepth: depth,
    rawDistance: depth * rayLen,
    cues: adjusted.map((c) => ({ ...c, distance: c.distance * distanceScale })),
    quality: clamp(quality, 0, 1),
    truncated,
  };
}

export type DistanceCorrectionMode = 'measured' | 'offset' | 'none';

/**
 * 객체 보정 적용 (우선순위 명확화):
 *  1) measuredDistance(실측 거리)가 있으면 → 비율 보정: base × (실측 / 실측 당시 추정값)
 *     이때 distanceOffset 은 중복 적용되지 않도록 무시합니다.
 *  2) 없으면 distanceOffset(m)을 더합니다.
 */
export function applyDistanceCorrection(
  baseDistance: number,
  values: Pick<CalibrationValues, 'measuredDistance' | 'referenceRawDistance' | 'distanceOffset'>,
): { distance: number; mode: DistanceCorrectionMode } {
  if (values.measuredDistance != null && values.measuredDistance > 0) {
    const ref = values.referenceRawDistance;
    const ratio = ref && ref > 0 ? values.measuredDistance / ref : null;
    const d = ratio != null ? baseDistance * ratio : values.measuredDistance;
    return { distance: clamp(d, MIN_DISTANCE, MAX_DISTANCE * 2), mode: 'measured' };
  }
  if (values.distanceOffset != null && values.distanceOffset !== 0) {
    return { distance: clamp(baseDistance + values.distanceOffset, MIN_DISTANCE, MAX_DISTANCE * 2), mode: 'offset' };
  }
  return { distance: baseDistance, mode: 'none' };
}
