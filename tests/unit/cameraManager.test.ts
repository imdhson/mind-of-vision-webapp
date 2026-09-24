import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraManagerImpl } from '../../src/features/camera/CameraManager';
import { useCameraStore } from '../../src/stores/cameraStore';

/** getUserMedia 가 돌려주는 가짜 트랙/스트림 */
class FakeTrack {
  readyState: 'live' | 'ended' = 'live';
  onended: (() => void) | null = null;
  constructor(
    readonly deviceId: string,
    readonly label: string,
  ) {}
  stop = vi.fn(() => {
    this.readyState = 'ended';
  });
  getSettings() {
    return { deviceId: this.deviceId, width: 1280, height: 720, frameRate: 30 };
  }
  getCapabilities() {
    return {};
  }
}

function fakeStream(track: FakeTrack) {
  return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

const DEVICES = [
  { deviceId: 'back', groupId: 'g', kind: 'videoinput', label: 'Back Camera' },
  { deviceId: 'front', groupId: 'g', kind: 'videoinput', label: 'Front Camera' },
];

let tracks: FakeTrack[];
let getUserMedia: ReturnType<typeof vi.fn>;
/** 이 장치 ID 로 열면 실패 */
let failing: Set<string>;

function requestedDeviceId(constraints: MediaStreamConstraints): string {
  const video = constraints.video as MediaTrackConstraints;
  const exact = (video.deviceId as ConstrainDOMStringParameters | undefined)?.exact;
  return typeof exact === 'string' ? exact : 'back';
}

function createManager() {
  const manager = new CameraManagerImpl();
  // jsdom 은 영상을 재생하지 않으므로 크기와 play() 를 흉내냄
  Object.defineProperty(manager.video, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(manager.video, 'videoHeight', { configurable: true, value: 720 });
  manager.video.play = () => Promise.resolve();
  // jsdom 의 srcObject 는 MediaStream 만 받으므로 단순 속성으로 대체
  Object.defineProperty(manager.video, 'srcObject', { configurable: true, writable: true, value: null });
  return manager;
}

beforeEach(() => {
  tracks = [];
  failing = new Set();
  getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    const id = requestedDeviceId(constraints);
    if (failing.has(id)) throw Object.assign(new Error('busy'), { name: 'NotReadableError' });
    const label = DEVICES.find((d) => d.deviceId === id)?.label ?? '';
    const track = new FakeTrack(id, label);
    tracks.push(track);
    return fakeStream(track);
  });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => DEVICES),
      addEventListener: vi.fn(),
    },
  });
  useCameraStore.setState({ status: 'idle', error: null, devices: [], active: null, generation: 0 });
});

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.restoreAllMocks();
});

describe('CameraManager', () => {
  it('시작하면 실행 상태·활성 카메라 정보를 기록하고 세대를 올린다', async () => {
    const manager = createManager();
    expect(await manager.start()).toBe(true);
    const s = useCameraStore.getState();
    expect(s.status).toBe('running');
    expect(s.active).toMatchObject({ deviceId: 'back', facing: 'environment', videoWidth: 1280, videoHeight: 720 });
    expect(s.generation).toBe(1);
    expect(s.devices.map((d) => d.deviceId)).toEqual(['back', 'front']);
    expect(manager.isRunning).toBe(true);
  });

  it('전환 시 기존 트랙을 먼저 종료한다', async () => {
    const manager = createManager();
    await manager.start();
    expect(await manager.switchTo('front')).toBe(true);
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(useCameraStore.getState().active?.deviceId).toBe('front');
    expect(useCameraStore.getState().generation).toBe(2);
  });

  it('전환에 실패하면 이전 카메라로 복구하고 안내 메시지를 남긴다', async () => {
    const manager = createManager();
    await manager.start();
    failing.add('front');
    expect(await manager.switchTo('front')).toBe(false);
    const s = useCameraStore.getState();
    expect(s.status).toBe('running');
    expect(s.active?.deviceId).toBe('back');
    expect(s.error?.message).toContain('이전 카메라로 복구했습니다');
  });

  it('겹친 전환 요청은 마지막 요청만 반영한다', async () => {
    const manager = createManager();
    await manager.start();
    const first = manager.switchTo('front');
    const second = manager.switchTo('back');
    expect(await first).toBe(false); // 더 새로운 요청에 밀려 실행되지 않음
    expect(await second).toBe(true);
    expect(useCameraStore.getState().active?.deviceId).toBe('back');
    expect(getUserMedia).toHaveBeenCalledTimes(1); // 이미 back 이 실행 중이므로 다시 열지 않음
  });

  it('진행 중이던 요청의 스트림은 더 새로운 요청이 오면 폐기한다', async () => {
    const manager = createManager();
    let release!: () => void;
    getUserMedia.mockImplementationOnce(async () => {
      await new Promise<void>((r) => (release = r));
      const track = new FakeTrack('back', 'Back Camera');
      tracks.push(track);
      return fakeStream(track);
    });
    const starting = manager.start();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    manager.stop();
    release();
    expect(await starting).toBe(false);
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(useCameraStore.getState().status).toBe('idle');
  });

  it('종료하면 트랙을 정리하고 세대를 올린다', async () => {
    const manager = createManager();
    await manager.start();
    manager.stop();
    const s = useCameraStore.getState();
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(s.status).toBe('idle');
    expect(s.active).toBeNull();
    expect(s.generation).toBe(2);
    expect(manager.isRunning).toBe(false);
  });

  it('트랙이 끊기면 오류를 알리고 다른 카메라로 자동 전환한다', async () => {
    const manager = createManager();
    await manager.start();
    tracks[0].onended?.();
    expect(useCameraStore.getState().error?.code).toBe('disconnected');
    await vi.waitFor(() => expect(useCameraStore.getState().active?.deviceId).toBe('front'));
    expect(useCameraStore.getState().status).toBe('running');
  });

  it('백그라운드에서 카메라가 회수되면 복귀 시 같은 카메라를 다시 연다', async () => {
    const manager = createManager();
    await manager.start();
    const setVisibility = (v: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: v });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setVisibility('hidden');
    tracks[0].onended?.();
    await Promise.resolve();
    expect(getUserMedia).toHaveBeenCalledTimes(1); // 숨겨진 동안에는 다시 열지 않음
    setVisibility('visible');
    await vi.waitFor(() => expect(useCameraStore.getState().status).toBe('running'));
    expect(useCameraStore.getState().active?.deviceId).toBe('back');
  });

  it('백그라운드 회수 후 사용자가 종료했다면 복귀해도 다시 열지 않는다', async () => {
    const manager = createManager();
    await manager.start();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    tracks[0].onended?.();
    manager.stop();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 10));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(useCameraStore.getState().status).toBe('idle');
  });

  it('보안 컨텍스트가 아니면 카메라를 요청하지 않는다', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    const manager = createManager();
    expect(await manager.start()).toBe(false);
    expect(useCameraStore.getState().error?.code).toBe('insecure-context');
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
