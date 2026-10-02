import type { CameraProfile } from '@/types';
const KEY = 'mind-of-vision:camera-profiles';
export function defaultProfile(deviceId = '', label = '카메라'): CameraProfile {
  return { deviceId, label, fovDeg: 62, heightM: 1.35, tiltDeg: 0, useTiltSensor: true, distanceScale: 1 };
}
export function loadProfiles(): Record<string, CameraProfile> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
export function saveProfile(profile: CameraProfile) {
  const all = loadProfiles();
  all[profile.deviceId || 'default'] = profile;
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function loadProfile(deviceId: string, label = '카메라'): CameraProfile {
  return loadProfiles()[deviceId || 'default'] ?? defaultProfile(deviceId, label);
}
