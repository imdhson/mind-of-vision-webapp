import type { CameraDevice } from '@/types';

export function classifyLens(label: string): CameraDevice['kind'] {
  const s = label.toLowerCase();
  if (/ultra|0\.5|초광각/.test(s)) return 'ultrawide';
  if (/tele|zoom|망원/.test(s)) return 'telephoto';
  if (/front|user|facetime|전면/.test(s)) return 'front';
  if (/usb|external|capture|외장/.test(s)) return 'external';
  if (/back|rear|environment|후면/.test(s)) return 'rear';
  return 'unknown';
}
export async function listVideoDevices(): Promise<CameraDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'videoinput')
    .map((d) => ({
      deviceId: d.deviceId,
      groupId: d.groupId,
      label: d.label || '카메라',
      kind: classifyLens(d.label),
    }));
}
