import type { ActiveCameraInfo, CameraDeviceInfo, FacingMode, ZoomCapability } from '../../types';
import { useCameraStore } from '../../stores/cameraStore';
import { checkSecureContext, classifyLens, listCameras, mapGetUserMediaError } from './CameraDeviceService';

/**
 * 카메라 스트림 수명 관리 (싱글턴)
 *
 * - 항상 하나의 MediaStream 만 유지합니다. 전환 시 기존 트랙을 먼저 stop() 합니다.
 * - 전환 요청이 겹치면 마지막 요청만 반영합니다(직렬화 + 요청 번호 비교).
 * - 전환 실패 시 이전 장치로 복구를 시도합니다.
 * - 스트림이 바뀔 때마다 generation 을 증가시켜 이전 스트림의 추론 결과를 폐기할 수 있게 합니다.
 */
type ExtendedCapabilities = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
type ExtendedSettings = MediaTrackSettings & { zoom?: number };

interface OpenRequest {
  deviceId?: string;
  facingMode?: 'environment' | 'user';
}

class CameraManagerImpl {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private requestSeq = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private deviceChangeBound = false;
  private lastGoodDeviceId: string | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('muted', '');
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.className = 'mov-video';
    this.video.addEventListener('resize', () => this.syncVideoSize());
    this.video.addEventListener('loadedmetadata', () => this.syncVideoSize());
  }

  get isRunning(): boolean {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  private get store() {
    return useCameraStore.getState();
  }

  private bindDeviceChange() {
    if (this.deviceChangeBound || !navigator.mediaDevices?.addEventListener) return;
    this.deviceChangeBound = true;
    navigator.mediaDevices.addEventListener('devicechange', () => {
      void this.refreshDevices().then(() => this.handleDeviceListChange());
    });
  }

  async refreshDevices(): Promise<CameraDeviceInfo[]> {
    try {
      const devices = await listCameras();
      // 현재 트랙의 facingMode 로 판별 결과 보강
      const active = this.store.active;
      const merged = devices.map((d) =>
        active && d.deviceId === active.deviceId ? { ...d, facing: active.facing, lensKind: active.lensKind } : d,
      );
      this.store.set({ devices: merged });
      return merged;
    } catch {
      return this.store.devices;
    }
  }

  /** 활성 장치가 연결 해제되었는지 확인 */
  private handleDeviceListChange() {
    const { active, devices, status } = this.store;
    if (!active || status !== 'running') return;
    if (active.deviceId && !devices.some((d) => d.deviceId === active.deviceId)) {
      this.onTrackEnded();
    }
  }

  /** 카메라 시작 (선호 장치가 있으면 사용, 없으면 후면 카메라 우선) */
  start(preferredDeviceId?: string | null): Promise<boolean> {
    const insecure = checkSecureContext();
    if (insecure) {
      this.store.set({ status: 'error', error: insecure });
      return Promise.resolve(false);
    }
    this.bindDeviceChange();
    return this.enqueue(async (seq) => {
      this.store.set({ status: 'requesting', error: null });
      let devices = this.store.devices.length ? this.store.devices : await this.refreshDevices();
      const hasLabels = devices.some((d) => d.label);
      const preferred = preferredDeviceId && devices.find((d) => d.deviceId === preferredDeviceId);
      const req: OpenRequest =
        preferred && hasLabels ? { deviceId: preferred.deviceId } : { facingMode: 'environment' };
      const ok = await this.open(req, seq);
      if (ok) {
        devices = await this.refreshDevices();
        // 권한 허용 후에야 장치 목록을 알 수 있는 브라우저: 선호 장치로 한 번 더 전환
        if (preferredDeviceId && !preferred && devices.some((d) => d.deviceId === preferredDeviceId)) {
          if (this.store.active?.deviceId !== preferredDeviceId) await this.open({ deviceId: preferredDeviceId }, seq);
        }
      } else if (req.deviceId) {
        return this.open({ facingMode: 'environment' }, seq);
      }
      return ok;
    });
  }

  /** 특정 장치로 전환. 실패 시 이전 장치 복구 */
  switchTo(deviceId: string): Promise<boolean> {
    return this.enqueue(async (seq) => {
      if (this.store.active?.deviceId === deviceId && this.isRunning) return true;
      const previous = this.store.active?.deviceId ?? this.lastGoodDeviceId;
      this.store.set({ status: 'switching', error: null });
      const ok = await this.open({ deviceId }, seq);
      if (ok) return true;
      const failure = this.store.error;
      if (previous && previous !== deviceId) {
        const restored = await this.open({ deviceId: previous }, seq);
        if (restored) {
          this.store.set({
            error: failure ? { ...failure, message: `${failure.message} 이전 카메라로 복구했습니다.` } : null,
          });
          return false;
        }
      }
      return false;
    });
  }

  /** 전면 ↔ 후면 전환 (판별 불가 시 다음 장치로 순환) */
  toggleFacing(): Promise<boolean> {
    const { devices, active } = this.store;
    if (!active) return this.start();
    const current: FacingMode = active.facing;
    const opposite = current === 'user' ? 'environment' : 'user';
    const candidates = devices.filter((d) => d.facing === opposite && d.deviceId !== active.deviceId);
    const pick =
      candidates.find((d) => d.lensKind === 'wide' || d.lensKind === 'front' || d.lensKind === 'unknown') ??
      candidates[0];
    if (pick) return this.switchTo(pick.deviceId);
    if (devices.length > 1) {
      const idx = devices.findIndex((d) => d.deviceId === active.deviceId);
      return this.switchTo(devices[(idx + 1) % devices.length].deviceId);
    }
    // 장치 목록으로 판단할 수 없으면 facingMode 로 요청
    return this.enqueue(async (seq) => {
      this.store.set({ status: 'switching' });
      const ok = await this.open({ facingMode: opposite }, seq);
      if (!ok && active.deviceId) await this.open({ deviceId: active.deviceId }, seq);
      return ok;
    });
  }

  stop(): void {
    this.requestSeq++;
    this.releaseStream();
    this.store.set({ status: 'idle', active: null, error: null, generation: this.store.generation + 1 });
  }

  async setZoom(zoom: number): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
      const s = track.getSettings() as ExtendedSettings;
      const active = this.store.active;
      if (active) this.store.set({ active: { ...active, currentZoom: s.zoom ?? zoom } });
    } catch {
      // 줌 미지원: 무시
    }
  }

  private enqueue<T>(fn: (seq: number) => Promise<T>): Promise<T> {
    const seq = ++this.requestSeq;
    const run = this.chain.then(() => (seq === this.requestSeq ? fn(seq) : (false as T)));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private releaseStream() {
    if (this.stream) {
      for (const t of this.stream.getTracks()) {
        t.onended = null;
        t.stop();
      }
    }
    this.stream = null;
    this.video.srcObject = null;
  }

  private async open(req: OpenRequest, seq: number): Promise<boolean> {
    // 기존 스트림을 먼저 종료해야 일부 모바일 기기에서 다른 렌즈를 열 수 있음
    this.releaseStream();
    const video: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    };
    if (req.deviceId) video.deviceId = { exact: req.deviceId };
    else if (req.facingMode) video.facingMode = { ideal: req.facingMode };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      if (seq !== this.requestSeq) return false;
      this.store.set({ status: 'error', error: mapGetUserMediaError(e), active: null });
      return false;
    }
    if (seq !== this.requestSeq) {
      // 더 새로운 요청이 있음 → 이 스트림은 폐기
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    track.onended = () => this.onTrackEnded();
    this.video.srcObject = stream;
    try {
      await this.video.play();
    } catch {
      // 자동 재생 정책: muted + playsinline 이므로 대부분 통과. 실패해도 프레임은 도착함
    }
    await waitForVideoSize(this.video);

    const settings = track.getSettings() as ExtendedSettings;
    const caps = (typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}) as ExtendedCapabilities;
    const label = track.label || '';
    const facingHint: FacingMode =
      settings.facingMode === 'user' ? 'user' : settings.facingMode === 'environment' ? 'environment' : 'unknown';
    const { lensKind, facing } = classifyLens(label, facingHint);
    const zoom: ZoomCapability | null = caps.zoom
      ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step ?? 0.1 }
      : null;
    const active: ActiveCameraInfo = {
      deviceId: settings.deviceId ?? req.deviceId ?? '',
      label,
      facing,
      lensKind,
      videoWidth: this.video.videoWidth || settings.width || 0,
      videoHeight: this.video.videoHeight || settings.height || 0,
      frameRate: settings.frameRate ?? null,
      zoom: zoom && zoom.max > zoom.min ? zoom : null,
      currentZoom: settings.zoom ?? null,
    };
    this.lastGoodDeviceId = active.deviceId || this.lastGoodDeviceId;
    this.store.set({
      status: 'running',
      error: null,
      active,
      generation: this.store.generation + 1,
    });
    return true;
  }

  private syncVideoSize() {
    const active = this.store.active;
    if (!active) return;
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (w && h && (w !== active.videoWidth || h !== active.videoHeight)) {
      // 기기 회전 등으로 해상도가 바뀌면 세대를 올려 이전 추론 결과 폐기
      this.store.set({ active: { ...active, videoWidth: w, videoHeight: h }, generation: this.store.generation + 1 });
    }
  }

  private onTrackEnded() {
    const prevId = this.store.active?.deviceId;
    this.releaseStream();
    this.store.set({
      status: 'error',
      active: null,
      generation: this.store.generation + 1,
      error: { code: 'disconnected', message: '카메라 연결이 끊어졌습니다. 다른 카메라를 선택하거나 다시 시도하세요.' },
    });
    // 다른 장치가 있으면 자동 복구 시도
    void this.refreshDevices().then((devices) => {
      const alt = devices.find((d) => d.deviceId !== prevId);
      if (alt) void this.switchTo(alt.deviceId);
    });
  }
}

function waitForVideoSize(video: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('loadedmetadata', done);
      video.removeEventListener('resize', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    video.addEventListener('loadedmetadata', done);
    video.addEventListener('resize', done);
  });
}

let instance: CameraManagerImpl | null = null;

export function getCameraManager(): CameraManagerImpl {
  if (!instance) instance = new CameraManagerImpl();
  return instance;
}

export type CameraManager = CameraManagerImpl;
