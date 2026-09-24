/** 3D 장면 색상 (블랙/화이트/그레이, 시스템 테마별) */
export interface ScenePalette {
  background: string;
  object: string;
  selected: string;
  selectedEmissive: string;
  ring: string;
  gridCell: string;
  gridSection: string;
  distanceRing: string;
  user: string;
  userRing: string;
  fov: string;
  ambient: number;
  key: number;
}

export const DARK_PALETTE: ScenePalette = {
  background: '#0a0a0b',
  object: '#a9a9b0',
  selected: '#ffffff',
  selectedEmissive: '#3a3a3a',
  ring: '#8a8a92',
  gridCell: '#18181b',
  gridSection: '#222226',
  distanceRing: '#26262b',
  user: '#ffffff',
  userRing: '#ffffff',
  fov: '#ffffff',
  ambient: 0.55,
  key: 1.4,
};

export const LIGHT_PALETTE: ScenePalette = {
  background: '#f4f4f5',
  object: '#55555c',
  selected: '#0a0a0b',
  selectedEmissive: '#000000',
  ring: '#6b6b73',
  gridCell: '#e7e7ea',
  gridSection: '#dcdce0',
  distanceRing: '#d6d6db',
  user: '#0a0a0b',
  userRing: '#0a0a0b',
  fov: '#0a0a0b',
  ambient: 0.75,
  key: 1.5,
};
