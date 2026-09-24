import type { CameraDeviceInfo, CameraProfile, LensKind } from '../../types';
import { DEG, clamp } from '../../utils/math';

/**
 * 카메라 내부 파라미터 (핀홀 모델, 픽셀 단위)
 * 주점(cx, cy)은 영상 중심, 정사각 픽셀(fx = fy)을 가정합니다.
 */
export interface CameraIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/** 렌즈 종류별 기본 화각(영상 긴 변 기준, °). 실제 값은 기기마다 다르므로 보정 메뉴에서 수정 가능 */
const DEFAULT_HFOV: Record<LensKind, number> = {
  'ultra-wide': 108,
  wide: 68,
  telephoto: 32,
  front: 72,
  external: 62,
  unknown: 64,
};

export function isProbablyMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile != null) return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function profileKey(deviceId: string): string {
  return `cam:${deviceId || 'default'}`;
}

export function createDefaultProfile(device: Pick<CameraDeviceInfo, 'deviceId' | 'label' | 'lensKind' | 'facing'>): CameraProfile {
  const mobile = isProbablyMobile();
  const lens: LensKind = device.lensKind === 'unknown' && mobile && device.facing === 'environment' ? 'wide' : device.lensKind;
  return {
    id: profileKey(device.deviceId),
    deviceId: device.deviceId,
    label: device.label,
    hfovLongDeg: DEFAULT_HFOV[lens],
    // 스마트폰을 손에 들고 있는 높이 / 책상 위 PC 카메라 높이의 일반적인 값
    cameraHeight: mobile ? 1.3 : 1.15,
    distanceScale: 1,
    pitchDeg: 0,
    useDeviceTilt: mobile,
    userDefined: false,
    updatedAt: Date.now(),
  };
}

/**
 * 프로파일 + 현재 해상도 + 줌 배율 → 내부 파라미터
 * 화각은 "영상의 긴 변" 기준이므로 세로/가로 회전에도 일관됩니다.
 */
export function computeIntrinsics(
  profile: Pick<CameraProfile, 'hfovLongDeg'>,
  width: number,
  height: number,
  zoomFactor = 1,
): CameraIntrinsics {
  const longSide = Math.max(width, height);
  const hfov = clamp(profile.hfovLongDeg, 5, 170) * DEG;
  const f = (longSide / 2 / Math.tan(hfov / 2)) * Math.max(zoomFactor, 0.1);
  return { fx: f, fy: f, cx: width / 2, cy: height / 2, width, height };
}

/** 35mm 환산 초점거리(mm) ↔ 긴 변 화각(°) (35mm 필름 긴 변 = 36mm) */
export function focal35ToHfov(focal35: number): number {
  return (2 * Math.atan(36 / (2 * focal35))) / DEG;
}

export function hfovToFocal35(hfovDeg: number): number {
  return 36 / (2 * Math.tan((hfovDeg * DEG) / 2));
}

/** 브라우저 줌 배율을 화각 계산용 배율로 변환 (프로파일 화각은 최소 줌 기준) */
export function zoomFactorOf(currentZoom: number | null, minZoom: number | null): number {
  if (currentZoom == null || !Number.isFinite(currentZoom) || currentZoom <= 0) return 1;
  const base = minZoom && minZoom > 0 ? minZoom : 1;
  return currentZoom / base;
}
