export type TabId = 'camera' | 'vision' | 'settings';
export type Vec3 = { x: number; y: number; z: number };
export type BBox = { x: number; y: number; width: number; height: number };

export type RawDetection = {
  className: string;
  score: number;
  bbox: BBox;
  colorHint?: [number, number, number];
};

export type Track = RawDetection & {
  id: string;
  createdAt: number;
  lastSeen: number;
  misses: number;
  velocity: { x: number; y: number };
};

export type CalibrationValues = {
  actualDistance?: number;
  distanceOffset?: number;
  actualHeight?: number;
  actualWidth?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  yawOffsetDeg?: number;
};

export type CalibrationScope = 'object' | 'class';
export type CalibrationRecord = {
  id: string;
  scope: CalibrationScope;
  key: string;
  className: string;
  values: CalibrationValues;
  signature?: string;
  createdAt: number;
  updatedAt: number;
};

export type CameraProfile = {
  deviceId: string;
  label: string;
  fovDeg: number;
  heightM: number;
  tiltDeg: number;
  useTiltSensor: boolean;
  distanceScale: number;
};

export type SpatialObject = {
  id: string;
  className: string;
  label: string;
  score: number;
  bbox: BBox;
  distanceM: number;
  position: Vec3;
  size: { width: number; height: number; depth: number };
  yawRad: number | null;
  moving: boolean;
  correctionSource?: 'temporary' | 'object' | 'class';
};

export type CameraDevice = {
  deviceId: string;
  groupId: string;
  label: string;
  kind: 'front' | 'rear' | 'ultrawide' | 'telephoto' | 'external' | 'unknown';
};
