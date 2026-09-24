import type { AppearanceSignature, CameraProfile, TrackSnapshot, TrackedObject } from '../../types';
import { useCameraStore } from '../../stores/cameraStore';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useObjectStore } from '../../stores/objectStore';
import { getCameraManager } from '../camera/CameraManager';
import { computeIntrinsics, createDefaultProfile, profileKey, zoomFactorOf } from '../camera/CameraCalibration';
import { CocoSsdDetector, type DetectorFactory, type ObjectDetector } from '../detection/ObjectDetector';
import type { BackendPreference } from '../detection/ModelLoader';
import { ObjectTracker } from '../tracking/ObjectTracker';
import { OrientationEstimator } from '../orientation/OrientationEstimator';
import { getClassInfo } from '../detection/classCatalog';
import { resolveCalibration } from '../calibration/CalibrationManager';
import { computeAppearance } from '../../utils/appearance';
import { DEG } from '../../utils/math';
import { buildTrackedObject, computeGeometry, type BuildContext } from './objectBuilder';

/**
 * 실시간 처리 파이프라인
 *
 *  카메라 프레임 → AI 인식 → 추적 → 거리/좌표/방향 → 보정 적용 → 공통 객체 상태(objectStore)
 *
 * - 추론 루프는 렌더링과 분리된 비동기 루프이며, 이전 추론이 끝나기 전에는 새 추론을 시작하지 않습니다.
 * - 카메라 전환(generation 변경) 후 도착한 이전 스트림의 결과는 폐기합니다.
 * - 보정값/카메라 설정이 바뀌면 추론을 기다리지 않고 마지막 추적 결과로 즉시 다시 계산합니다.
 * - 탭이 백그라운드로 가면 추론을 멈춰 배터리·발열을 줄입니다.
 * - 추론이 연속으로 실패하거나 WebGL 컨텍스트가 손실되면 모델을 다시 불러옵니다.
 *   첫 복구는 WebGL 을 새 컨텍스트로 다시 만들어 GPU 속도를 유지하고(iOS 백그라운드 복귀 등),
 *   그래도 실패하면 CPU 로 전환합니다. 복구가 반복해서 실패하면 추론을 멈추고 오류를 표시합니다.
 */
const MIN_INTERVAL_MS = 70; // 최대 약 14회/초
const APPEARANCE_WIDTH = 160;
/** 이 횟수만큼 연속으로 추론이 실패하면 모델을 다시 불러옵니다. */
export const MAX_CONSECUTIVE_ERRORS = 3;
/** 성공 없이 연속으로 시도할 수 있는 복구 횟수 */
export const MAX_RECOVERY_ATTEMPTS = 2;
const ERROR_RETRY_MS = 1000;

/** 파이프라인이 사용하는 카메라 영상 소스 (테스트에서 교체 가능) */
export interface VideoSource {
  readonly video: HTMLVideoElement;
}

export class VisionPipelineImpl {
  private detector: ObjectDetector | null = null;
  private detectorLoading: Promise<void> | null = null;
  private tracker = new ObjectTracker();
  private orientation = new OrientationEstimator();
  private running = false;
  private loopToken = 0;
  private lastTracks: TrackSnapshot[] = [];
  private lastObservedAt = 0;
  private fpsSamples: number[] = [];
  private appearanceCanvas: HTMLCanvasElement | null = null;
  private unsubscribers: (() => void)[] = [];
  private consecutiveErrors = 0;
  private recoveryAttempts = 0;
  private backendPreference: BackendPreference = 'auto';

  constructor(
    private readonly createDetector: DetectorFactory = CocoSsdDetector.create,
    private readonly getCamera: () => VideoSource = getCameraManager,
  ) {}

  async loadModel(modelId: string, { force = false, resetGpu = false } = {}): Promise<void> {
    if (!force && this.detector?.model.id === modelId) return;
    if (this.detectorLoading) await this.detectorLoading.catch(() => undefined);
    if (!force && this.detector?.model.id === modelId) return;
    const objects = useObjectStore.getState();
    objects.setDetector('loading', 'AI 모델 준비 중');
    this.detectorLoading = (async () => {
      try {
        const next = await this.createDetector(modelId, {
          backend: this.backendPreference,
          resetGpu,
          onProgress: (msg) => objects.setDetector('loading', msg),
        });
        this.detector?.dispose();
        this.detector = next;
        objects.setDetector('ready', null);
        objects.setStats({ backend: next.backend, modelId: next.model.id });
      } catch (e) {
        objects.setDetector('error', `모델을 불러오지 못했습니다: ${(e as Error).message}`);
        throw e;
      } finally {
        this.detectorLoading = null;
      }
    })();
    return this.detectorLoading;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const token = ++this.loopToken;
    this.subscribe();
    void this.loop(token);
  }

  stop(): void {
    this.running = false;
    this.loopToken++;
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }

  /** 카메라 전환 등으로 추적 상태를 초기화 */
  resetTracking(): void {
    this.tracker.reset();
    this.orientation.reset();
    this.lastTracks = [];
    useObjectStore.getState().setObjects([]);
    useCalibrationStore.getState().pruneTracks(new Set());
  }

  private subscribe() {
    // 보정값·카메라 설정 변경 → 즉시 재계산
    this.unsubscribers.push(
      useCalibrationStore.subscribe((s, prev) => {
        if (
          s.profiles !== prev.profiles ||
          s.classCals !== prev.classCals ||
          s.instances !== prev.instances ||
          s.session !== prev.session ||
          s.bindings !== prev.bindings ||
          s.draft !== prev.draft
        ) {
          this.publish(false);
        }
      }),
      useCameraStore.subscribe((s, prev) => {
        if (s.generation !== prev.generation) {
          this.resetTracking();
        } else if (s.active?.currentZoom !== prev.active?.currentZoom) {
          // 줌은 즉시 반영. 센서(기울기) 변화는 다음 추론 때 반영(과도한 재계산 방지)
          this.publish(false);
        }
      }),
    );
  }

  private async loop(token: number) {
    const camera = this.getCamera();
    while (this.running && token === this.loopToken) {
      const started = performance.now();
      const video = camera.video;
      const cam = useCameraStore.getState();
      const ready =
        this.detector &&
        cam.status === 'running' &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        document.visibilityState === 'visible';
      if (!ready) {
        // 인식 대상이 없을 때도 유예 기간 처리를 위해 추적 상태 갱신
        if (this.lastTracks.length && performance.now() - this.lastObservedAt > 250)
          this.step([], [], performance.now());
        await sleep(document.visibilityState === 'visible' ? 120 : 500);
        continue;
      }
      if (this.detector!.broken) {
        await this.recover('GPU(WebGL) 컨텍스트가 손실되었습니다');
        continue;
      }
      const generation = cam.generation;
      const timestamp = performance.now();
      try {
        const appearanceFrame = this.grabAppearanceFrame(video);
        const detections = await this.detector!.detect(video, { maxDetections: 20, minScore: 0.45 });
        if (token !== this.loopToken) return;
        this.consecutiveErrors = 0;
        this.recoveryAttempts = 0;
        // 이전 스트림(카메라 전환 전) 결과는 폐기. continue 대신 아래 대기를 거쳐 추론 간격을 유지
        if (useCameraStore.getState().generation === generation) {
          const inferenceMs = performance.now() - timestamp;
          const appearances = appearanceFrame
            ? detections.map((d) =>
                computeAppearance(appearanceFrame.data, appearanceFrame.width, appearanceFrame.height, d.box),
              )
            : detections.map(() => null);
          this.step(detections, appearances, timestamp);
          this.lastObservedAt = timestamp;
          this.recordStats(inferenceMs, timestamp);
        }
      } catch (e) {
        console.warn('[pipeline] 추론 오류', e);
        if (token !== this.loopToken) return;
        const message = (e as Error).message;
        if (++this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS || this.detector?.broken) {
          await this.recover(message);
          continue;
        }
        useObjectStore.getState().setDetector('error', `추론 오류: ${message}`);
        await sleep(ERROR_RETRY_MS);
        if (this.detector) useObjectStore.getState().setDetector('ready', null);
      }
      const elapsed = performance.now() - started;
      await sleep(Math.max(0, MIN_INTERVAL_MS - elapsed));
      // 메인 스레드 양보: 렌더링 프레임이 끼어들 수 있게 함
      await nextFrame();
    }
  }

  /**
   * 추론이 계속 실패할 때 모델을 다시 불러옵니다.
   * WebGL 에서의 첫 복구는 WebGL 을 새로 만들어 시도하고(실패 시 곧바로 CPU), 이후 복구는 CPU 를 사용합니다.
   * 복구가 반복해서 실패하면 인식기를 내려놓아 루프가 대기 상태로 머물게 합니다(무한 재시도 방지).
   */
  private async recover(reason: string): Promise<void> {
    const current = this.detector;
    if (!current) return;
    this.consecutiveErrors = 0;
    const objects = useObjectStore.getState();
    const giveUp = () => {
      objects.setDetector('error', `AI 인식을 복구하지 못했습니다(${reason}). 페이지를 새로고침하세요.`);
    };
    if (++this.recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
      current.dispose();
      this.detector = null;
      giveUp();
      return;
    }
    const plan: ('gpu' | 'cpu')[] =
      current.backend === 'webgl' && this.recoveryAttempts === 1 ? ['gpu', 'cpu'] : ['cpu'];
    // 백엔드를 교체하기 전에 기존 모델의 텐서를 먼저 해제
    current.dispose();
    this.detector = null;
    for (const step of plan) {
      this.backendPreference = step === 'cpu' ? 'cpu' : 'auto';
      console.warn(`[pipeline] 인식기 복구 시도 ${this.recoveryAttempts} (${step}): ${reason}`);
      try {
        await this.loadModel(current.model.id, { force: true, resetGpu: step === 'gpu' });
        return;
      } catch {
        // loadModel 이 오류 상태를 기록함. 다음 단계 시도
      }
    }
    giveUp();
  }

  private grabAppearanceFrame(video: HTMLVideoElement): ImageData | null {
    try {
      if (!this.appearanceCanvas) this.appearanceCanvas = document.createElement('canvas');
      const c = this.appearanceCanvas;
      const w = APPEARANCE_WIDTH;
      const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    } catch {
      return null;
    }
  }

  private step(
    detections: Parameters<ObjectTracker['update']>[0]['detections'],
    appearances: (AppearanceSignature | null)[],
    timestamp: number,
  ) {
    this.lastTracks = this.tracker.update({ detections, appearances, timestamp });
    this.publish(true, timestamp);
  }

  private recordStats(inferenceMs: number, t: number) {
    this.fpsSamples.push(t);
    this.fpsSamples = this.fpsSamples.filter((s) => t - s < 2000);
    const fps = this.fpsSamples.length > 1 ? ((this.fpsSamples.length - 1) * 1000) / (t - this.fpsSamples[0]) : 0;
    const prev = useObjectStore.getState().stats;
    useObjectStore.getState().setStats({
      inferenceMs: prev.inferenceMs ? prev.inferenceMs * 0.8 + inferenceMs * 0.2 : inferenceMs,
      detectionFps: fps,
      lastFrameAt: t,
    });
  }

  /** 현재 카메라의 프로파일(저장값 또는 기본값) */
  currentProfile(): CameraProfile | null {
    const active = useCameraStore.getState().active;
    if (!active) return null;
    const saved = useCalibrationStore.getState().profiles[profileKey(active.deviceId)];
    return saved ?? createDefaultProfile(active);
  }

  buildContext(): BuildContext | null {
    const cam = useCameraStore.getState();
    const active = cam.active;
    const profile = this.currentProfile();
    if (!active || !profile || !active.videoWidth || !active.videoHeight) return null;
    const intrinsics = computeIntrinsics(
      profile,
      active.videoWidth,
      active.videoHeight,
      zoomFactorOf(active.currentZoom, active.zoom?.min ?? null),
    );
    let pitch = profile.pitchDeg * DEG;
    if (profile.useDeviceTilt && cam.sensorPitch != null) {
      pitch = active.facing === 'user' ? -cam.sensorPitch : cam.sensorPitch;
    }
    return { intrinsics, profile, pitch };
  }

  /**
   * 실제 거리 비율 계산용 기준값: 해당 객체의 현재 원본 추정 거리(보정 없음).
   * 실제 거리 저장 시 referenceRawDistance 로 기록합니다.
   */
  rawDistanceFor(trackId: string): number | null {
    const track = this.lastTracks.find((t) => t.id === trackId);
    const ctx = this.buildContext();
    if (!track || !ctx) return null;
    return computeGeometry(track, {}, ctx).estimatedDistance;
  }

  private publish(observedFrame: boolean, timestamp = performance.now()) {
    const ctx = this.buildContext();
    const cal = useCalibrationStore.getState();
    const ids = new Set(this.lastTracks.map((t) => t.id));
    this.orientation.retain(ids);
    const list: TrackedObject[] = [];
    for (const track of this.lastTracks) {
      const classCal = cal.classCals[`class:${track.classId}`];
      const instId = cal.bindings[track.id];
      const inst = instId ? cal.instances[instId] : undefined;
      // 미리보기: 입력 중 값은 해당 범위 계층에만 임시로 반영
      const draft = cal.draft?.trackId === track.id ? cal.draft : null;
      const resolved = resolveCalibration(
        draft?.scope === 'class'
          ? { id: 'draft', classId: track.classId, values: draft.values, updatedAt: 0 }
          : classCal,
        draft?.scope === 'instance' ? { ...(inst ?? emptyInstance(track.classId)), values: draft.values } : inst,
        draft?.scope === 'session' ? draft.values : cal.session[track.id],
      );
      if (!ctx) {
        list.push(
          buildTrackedObject(track, resolved, emptyGeometry(), {
            motionState: 'unknown',
            movementYaw: null,
            speed: null,
            facingYaw: null,
            facingSource: null,
          }),
        );
        continue;
      }
      const geometry = computeGeometry(track, resolved.values, ctx);
      const observed = observedFrame && track.lastSeenAt === timestamp;
      const orientation = this.orientation.update(
        track.id,
        getClassInfo(track.classId),
        geometry.rawPosition,
        observed ? timestamp : track.lastSeenAt,
        observed,
        resolved.values.yawOffsetDeg,
      );
      list.push(buildTrackedObject(track, resolved, geometry, orientation));
    }
    useObjectStore.getState().setObjects(list);
    if (observedFrame) cal.pruneTracks(ids);
  }
}

function emptyInstance(classId: string) {
  return {
    id: 'draft',
    classId,
    name: '',
    values: {},
    cameraKey: null,
    appearance: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function emptyGeometry() {
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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function nextFrame() {
  return new Promise<void>((r) => {
    if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') {
      // rAF 가 멈추는 환경 대비 타임아웃 병행
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          r();
        }
      };
      requestAnimationFrame(finish);
      setTimeout(finish, 50);
    } else r();
  });
}

let pipeline: VisionPipelineImpl | null = null;
export function getVisionPipeline(): VisionPipelineImpl {
  if (!pipeline) pipeline = new VisionPipelineImpl();
  return pipeline;
}
export type VisionPipeline = VisionPipelineImpl;
