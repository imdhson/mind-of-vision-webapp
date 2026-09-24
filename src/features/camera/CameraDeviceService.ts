import type { CameraDeviceInfo, CameraError, FacingMode, LensKind } from '../../types';

/**
 * 카메라 장치 검색 및 렌즈 판별
 *
 * 브라우저는 물리 렌즈(초광각·망원 등)를 별도의 videoinput 장치로 노출하는 경우에만 선택할 수 있습니다.
 * 장치명으로 렌즈 종류를 판별할 수 없으면 'unknown' 으로 두고 실제 장치명을 그대로 표시합니다.
 * 존재하지 않는 렌즈를 목록에 추가하지 않습니다.
 */

const RE_ULTRA = /ultra[\s-]?wide|ultrawide|초광각|울트라\s?와이드|0\.5x/i;
const RE_TELE = /tele(photo)?|망원|periscope|[2-9](\.\d)?x\b/i;
const RE_FRONT = /\bfront\b|전면|셀카|facetime/i;
const RE_BACK = /\bback\b|\brear\b|후면/i;
const RE_EXTERNAL = /usb|external|외장|logitech|webcam|brio|c9\d\d|capture|obs|virtual/i;
const RE_WIDE = /\bwide\b|광각|main|기본/i;

export function classifyLens(label: string, facingHint?: FacingMode): { lensKind: LensKind; facing: FacingMode } {
  let facing: FacingMode = facingHint && facingHint !== 'unknown' ? facingHint : 'unknown';
  if (facing === 'unknown') {
    if (RE_FRONT.test(label)) facing = 'user';
    else if (RE_BACK.test(label)) facing = 'environment';
  }
  let lensKind: LensKind = 'unknown';
  if (RE_ULTRA.test(label)) lensKind = 'ultra-wide';
  else if (RE_TELE.test(label)) lensKind = 'telephoto';
  else if (facing === 'user') lensKind = 'front';
  else if (RE_EXTERNAL.test(label)) lensKind = 'external';
  else if (RE_WIDE.test(label)) lensKind = 'wide';
  return { lensKind, facing };
}

export const LENS_LABEL_KO: Record<LensKind, string> = {
  'ultra-wide': '초광각',
  wide: '광각',
  telephoto: '망원',
  front: '전면',
  external: '외장',
  unknown: '',
};

/** 표시용 장치 이름: 렌즈 판별이 되면 한국어 렌즈명, 아니면 실제 장치명 */
export function deviceDisplayName(d: Pick<CameraDeviceInfo, 'label' | 'lensKind' | 'facing'>, index: number): string {
  const label = d.label || `카메라 ${index + 1}`;
  const lens = LENS_LABEL_KO[d.lensKind];
  if (!lens) return label;
  const side = d.facing === 'environment' ? '후면 ' : '';
  return `${side}${lens}`;
}

export function isMediaDevicesSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function listCameras(): Promise<CameraDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'videoinput')
    .map((d) => {
      const { lensKind, facing } = classifyLens(d.label);
      return { deviceId: d.deviceId, groupId: d.groupId, label: d.label, lensKind, facing };
    });
}

export function mapGetUserMediaError(e: unknown): CameraError {
  const name = (e as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { code: 'permission-denied', message: '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.' };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { code: 'no-device', message: '사용 가능한 카메라가 없습니다.' };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { code: 'device-busy', message: '카메라를 열 수 없습니다. 다른 앱이 사용 중인지 확인하세요.' };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return { code: 'overconstrained', message: '선택한 카메라를 이 브라우저에서 사용할 수 없습니다.' };
    default:
      return { code: 'unknown', message: `카메라 오류: ${(e as Error)?.message ?? String(e)}` };
  }
}

export function checkSecureContext(): CameraError | null {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      code: 'insecure-context',
      message: '카메라는 HTTPS 또는 localhost 에서만 사용할 수 있습니다.',
    };
  }
  if (!isMediaDevicesSupported()) {
    return { code: 'unsupported', message: '이 브라우저는 카메라 API 를 지원하지 않습니다.' };
  }
  return null;
}
