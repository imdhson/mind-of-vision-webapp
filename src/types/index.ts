/**
 * Mind of Vision 공통 타입 정의
 *
 * ──────────────────────────────────────────────────────────────
 * 좌표계 및 단위 (프로젝트 전체에서 동일하게 사용)
 * ──────────────────────────────────────────────────────────────
 * 1) 영상 좌표 (NormalizedBox)
 *    - 영상 프레임 기준 0..1 정규화 값. 원점은 좌상단, x → 오른쪽, y → 아래.
 *    - 해상도가 바뀌어도 오버레이가 어긋나지 않도록 픽셀 대신 정규화 좌표를 저장합니다.
 *
 * 2) 카메라 좌표계 (CameraPoint) — 컴퓨터 비전 관례
 *    - 원점: 카메라 광학 중심, 단위: 미터(m)
 *    - x → 영상 오른쪽, y → 영상 아래, z → 카메라 전방(광축)
 *
 * 3) 시각화 좌표계 (ViewPoint) — Three.js 관례, "사용자 기준 상대 좌표"
 *    - 원점: 사용자(카메라) 바로 아래 바닥, 단위: 미터(m)
 *    - X → 오른쪽, Y → 위(바닥=0), -Z → 카메라가 바라보는 전방
 *    - 카메라의 이동(자기 위치)은 추적하지 않으므로 절대적인 월드 좌표가 아닙니다.
 *
 * 4) 각도
 *    - yaw(방위각)는 시각화 좌표계에서 Y축 기준 라디안.
 *      0 = 사용자를 향함(+Z 방향), π = 사용자로부터 멀어지는 방향(-Z).
 *    - 사용자 입력(방향 보정)은 도(°) 단위로 받고 내부에서 라디안으로 변환합니다.
 */

// ── 기본 기하 ─────────────────────────────────────────────────
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 0..1 정규화 경계 상자 (좌상단 기준) */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size3 {
  width: number;
  height: number;
  depth: number;
}

// ── 카메라 ────────────────────────────────────────────────────
export type LensKind = 'ultra-wide' | 'wide' | 'telephoto' | 'front' | 'external' | 'unknown';

export type FacingMode = 'environment' | 'user' | 'unknown';

export interface CameraDeviceInfo {
  deviceId: string;
  groupId: string;
  /** 브라우저가 제공한 실제 장치명 (권한 허용 전에는 빈 문자열일 수 있음) */
  label: string;
  /** 장치명에서 추정한 렌즈 종류. 판별 불가 시 'unknown' */
  lensKind: LensKind;
  facing: FacingMode;
}

export interface ZoomCapability {
  min: number;
  max: number;
  step: number;
}

export interface ActiveCameraInfo {
  deviceId: string;
  label: string;
  facing: FacingMode;
  lensKind: LensKind;
  videoWidth: number;
  videoHeight: number;
  frameRate: number | null;
  /** 브라우저가 zoom 제약을 지원하는 경우에만 존재. 물리 렌즈 전환과는 다름 */
  zoom: ZoomCapability | null;
  currentZoom: number | null;
}

export type CameraStatus = 'idle' | 'requesting' | 'running' | 'switching' | 'error';

export type CameraErrorCode =
  | 'permission-denied'
  | 'no-device'
  | 'device-busy'
  | 'overconstrained'
  | 'insecure-context'
  | 'unsupported'
  | 'disconnected'
  | 'unknown';

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

// ── 객체 인식 ────────────────────────────────────────────────
/** 모델이 반환한 원본 인식 결과 (한 프레임) */
export interface Detection {
  classId: string;
  score: number;
  box: NormalizedBox;
}

export interface DetectionFrame {
  detections: Detection[];
  /** 추론에 사용된 프레임의 캡처 시각(ms, performance.now) */
  timestamp: number;
  frameWidth: number;
  frameHeight: number;
  /** 카메라 스트림 세대 번호. 카메라 전환 후 도착한 이전 결과를 폐기하는 데 사용 */
  streamGeneration: number;
  inferenceMs: number;
}

// ── 추적 ─────────────────────────────────────────────────────
export type TrackingState = 'detected' | 'tracking' | 'temporarily_lost' | 'lost';

/** 외형 서명: 경계 상자 영역의 정규화된 색상 히스토그램 */
export type AppearanceSignature = number[];

/** 추적기 내부 결과 (거리·좌표 계산 전) */
export interface TrackSnapshot {
  id: string;
  classId: string;
  /** 같은 클래스 내 순번 (표시용: "의자 #2") */
  ordinal: number;
  confidence: number;
  /** 안정화(평활화)된 경계 상자 */
  box: NormalizedBox;
  /** 마지막 인식에서의 원본 경계 상자 */
  rawBox: NormalizedBox;
  /** 경계 상자 중심 속도 (정규화 좌표/초) */
  velocity: { x: number; y: number };
  state: TrackingState;
  hits: number;
  misses: number;
  firstSeenAt: number;
  lastSeenAt: number;
  appearance: AppearanceSignature | null;
}

// ── 거리 추정 ────────────────────────────────────────────────
export type DistanceMethod = 'size-height' | 'size-width' | 'ground-plane';

export interface DistanceCue {
  method: DistanceMethod;
  distance: number;
  weight: number;
}

export interface DistanceEstimate {
  /** 보정 전 원본 추정 거리 (m, 카메라 중심→객체 중심 직선거리) */
  rawDistance: number;
  /** 원본 추정 깊이 (광축 방향 z, m) */
  rawDepth: number;
  cues: DistanceCue[];
  /** 0..1 추정 신뢰도(휴리스틱). 경계 상자 잘림, 단서 불일치 시 낮아짐 */
  quality: number;
  /** 경계 상자가 영상 가장자리에 걸려 크기가 잘린 경우 */
  truncated: boolean;
}

// ── 방향 ─────────────────────────────────────────────────────
export type MotionState = 'stationary' | 'moving' | 'unknown';
export type FacingSource = 'motion' | 'user' | null;

export interface OrientationEstimate {
  motionState: MotionState;
  /** 이동 방향 yaw (rad). 이동 중이 아니면 null */
  movementYaw: number | null;
  /** 이동 속도 (m/s, 시각화 좌표 수평면) */
  speed: number | null;
  /** 객체가 바라보는 방향 yaw (rad). 판별 불가 시 null */
  facingYaw: number | null;
  facingSource: FacingSource;
}

// ── 보정 ─────────────────────────────────────────────────────
/**
 * 보정 값 (모든 필드는 선택). 단위:
 * - measuredDistance: m (사용자 실측 거리). 설정 시 distanceOffset 은 무시됩니다.
 * - referenceRawDistance: m (실측 입력 당시의 원본 추정 거리 — 비율 계산용, 자동 기록)
 * - distanceOffset: m (원본 추정 거리에 더하는 값, ±)
 * - realHeight / realWidth: m (거리 추정에 사용하는 객체 실제 크기)
 * - offsetX / offsetY / offsetZ: m (시각화 좌표계 기준 위치 보정)
 * - yawOffsetDeg: ° (방향 보정. 방향 미확인 객체에는 사용자 지정 방향으로 적용)
 */
export interface CalibrationValues {
  measuredDistance?: number;
  referenceRawDistance?: number;
  distanceOffset?: number;
  realHeight?: number;
  realWidth?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  yawOffsetDeg?: number;
}

export type CalibrationScope = 'class' | 'instance' | 'session';

export interface ClassCalibration {
  id: string; // `class:${classId}`
  classId: string;
  values: CalibrationValues;
  updatedAt: number;
}

/**
 * 특정 물리 객체 하나에 대한 영속 보정값.
 * 추적 ID는 일시적이므로, 앱 재실행 후에는 사용자가 명시적으로 "연결"해야만 적용됩니다.
 */
export interface InstanceCalibration {
  id: string; // `inst:${uuid}`
  classId: string;
  name: string;
  values: CalibrationValues;
  /** 저장 당시 카메라 장치 ID */
  cameraKey: string | null;
  /** 연결 후보 추천용 외형 서명 */
  appearance: AppearanceSignature | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 카메라(렌즈)별 보정 프로파일.
 * 브라우저는 각 물리 렌즈를 별도 장치로 노출하므로 deviceId 단위 = 렌즈 단위입니다.
 */
export interface CameraProfile {
  id: string; // `cam:${deviceId}`
  deviceId: string;
  label: string;
  /** 영상 긴 변 기준 화각(°) */
  hfovLongDeg: number;
  /** 카메라(사용자 손) 높이, 바닥 기준 m */
  cameraHeight: number;
  /** 전체 거리 추정 배율(거리 추정 기준값). 1 = 보정 없음 */
  distanceScale: number;
  /** 기울기 센서가 없을 때 가정하는 카메라 피치(°, +는 아래를 봄) */
  pitchDeg: number;
  /** 기기 기울기 센서(DeviceOrientation) 사용 여부 */
  useDeviceTilt: boolean;
  /** 사용자가 값을 직접 저장했는지 (false면 기본 추정값) */
  userDefined: boolean;
  updatedAt: number;
}

/** 보정 계층을 합성한 결과 (적용 우선순위: session > instance > class > 기본값) */
export interface ResolvedCalibration {
  values: CalibrationValues;
  /** 각 필드가 어느 범위에서 왔는지 */
  sources: Partial<Record<keyof CalibrationValues, CalibrationScope>>;
  instanceId: string | null;
  hasSession: boolean;
}

// ── 최종 공통 객체 상태 ──────────────────────────────────────
export interface TrackedObject {
  id: string;
  classId: string;
  /** 한국어 표시 이름 (예: "의자 #2") */
  label: string;
  /** 한국어 클래스 이름 (예: "의자") */
  className: string;
  confidence: number;

  /** 안정화된 경계 상자 (정규화 좌표) */
  boundingBox: NormalizedBox;
  /** 경계 상자 중심 (정규화 좌표) */
  center: { x: number; y: number };

  /** 보정 전 원본 추정 거리 (m) */
  estimatedDistance: number | null;
  /** 보정 적용 후 거리 (m). 적용된 보정이 없으면 estimatedDistance 와 동일 */
  correctedDistance: number | null;
  distanceQuality: number;
  distanceCues: DistanceCue[];
  truncated: boolean;

  /** 카메라 좌표계 위치 (보정 후, m) */
  cameraPosition: Vec3 | null;
  /** 시각화 좌표계 위치 (보정 후, m). 객체 바닥 중심이 아닌 "중심" */
  position: Vec3 | null;
  /** 시각화 좌표계 위치 (보정 전, m) */
  rawPosition: Vec3 | null;

  /** 추정 크기 (m) — 너비/높이는 영상 기반, 깊이는 클래스 비율 기반 */
  size: Size3 | null;
  /** 시각화 좌표계 회전 (rad). y=facingYaw. 방향 미확인 시 null */
  rotation: Vec3 | null;
  orientation: OrientationEstimate;

  trackingState: TrackingState;
  firstSeenAt: number;
  lastSeenAt: number;

  calibration: ResolvedCalibration;
  /** 연결된 개별(인스턴스) 보정 ID */
  calibrationId?: string;
  appearance: AppearanceSignature | null;
}

export interface PipelineStats {
  backend: string | null;
  modelId: string | null;
  inferenceMs: number;
  detectionFps: number;
  lastFrameAt: number;
}
