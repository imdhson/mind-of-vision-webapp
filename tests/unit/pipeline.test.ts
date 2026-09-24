import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  MAX_CONSECUTIVE_ERRORS,
  MAX_RECOVERY_ATTEMPTS,
  VisionPipelineImpl,
} from '../../src/features/pipeline/VisionPipeline';
import type { DetectorFactory, ObjectDetector } from '../../src/features/detection/ObjectDetector';
import { getModelDefinition } from '../../src/features/detection/ModelLoader';
import { useCameraStore } from '../../src/stores/cameraStore';
import { useObjectStore } from '../../src/stores/objectStore';
import type { Detection } from '../../src/types';
import { box, det } from './helpers';

type DetectFn = () => Promise<Detection[]>;

interface FakeDetector extends ObjectDetector {
  broken: boolean;
  detect: Mock<DetectFn>;
  dispose: Mock<() => void>;
}

function fakeDetector(backend: string, detect: DetectFn): FakeDetector {
  return {
    model: getModelDefinition('coco-ssd-lite'),
    backend,
    broken: false,
    detect: vi.fn(detect),
    dispose: vi.fn(),
  };
}

function fakeVideo() {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: 4 });
  Object.defineProperty(video, 'videoWidth', { value: 640 });
  Object.defineProperty(video, 'videoHeight', { value: 480 });
  return { video };
}

let pipeline: VisionPipelineImpl | null = null;

function setup(factory: DetectorFactory) {
  const create = vi.fn(factory);
  pipeline = new VisionPipelineImpl(create, fakeVideo);
  return { pipeline, create };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // jsdom 에는 캔버스 구현이 없음: 외형 특징 추출은 생략되도록 null 반환
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  useCameraStore.setState({
    status: 'running',
    error: null,
    generation: 1,
    sensorPitch: null,
    active: {
      deviceId: 'cam',
      label: 'Back Camera',
      facing: 'environment',
      lensKind: 'wide',
      videoWidth: 640,
      videoHeight: 480,
      frameRate: 30,
      zoom: null,
      currentZoom: null,
    },
  });
  useObjectStore.getState().setObjects([]);
  useObjectStore.getState().setDetector('idle', null);
});

afterEach(() => {
  pipeline?.stop();
  pipeline = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 조건이 참이 될 때까지 가짜 시간을 조금씩 진행 */
async function advanceUntil(check: () => boolean, maxMs = 20_000) {
  for (let t = 0; t < maxMs && !check(); t += 50) await vi.advanceTimersByTimeAsync(50);
  expect(check()).toBe(true);
}

const chair = () => [det('chair', box(0.4, 0.4, 0.2, 0.3))];

describe('VisionPipeline', () => {
  it('인식 결과를 추적·거리 추정 후 객체 상태로 게시한다', async () => {
    const { pipeline } = setup(async () => fakeDetector('webgl', async () => chair()));
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();
    await vi.advanceTimersByTimeAsync(500);
    const objects = Object.values(useObjectStore.getState().objects);
    expect(objects).toHaveLength(1);
    expect(objects[0].classId).toBe('chair');
    expect(objects[0].estimatedDistance).toBeGreaterThan(0);
    expect(useObjectStore.getState().detectorStatus).toBe('ready');
  });

  it('카메라가 바뀐 뒤 도착한 이전 스트림의 결과는 폐기한다', async () => {
    const { pipeline } = setup(async () =>
      fakeDetector('webgl', async () => {
        // 추론 도중 카메라 전환
        useCameraStore.setState({ generation: useCameraStore.getState().generation + 1 });
        return chair();
      }),
    );
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(Object.values(useObjectStore.getState().objects)).toHaveLength(0);
  });

  it('같은 모델은 다시 불러오지 않는다', async () => {
    const { pipeline, create } = setup(async () => fakeDetector('webgl', async () => []));
    await pipeline.loadModel('coco-ssd-lite');
    await pipeline.loadModel('coco-ssd-lite');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it(`추론이 ${MAX_CONSECUTIVE_ERRORS}회 연속 실패하면 WebGL 을 새로 만들고, 그래도 실패하면 CPU 로 전환한다`, async () => {
    const failingGpu = () =>
      fakeDetector('webgl', async () => {
        throw new Error('gpu fail');
      });
    const cpu = fakeDetector('cpu', async () => chair());
    const { pipeline, create } = setup(async (_id, opts) => (opts?.backend === 'cpu' ? cpu : failingGpu()));
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();

    await vi.advanceTimersByTimeAsync(1500);
    expect(useObjectStore.getState().detectorStatus).toBe('error'); // 아직 재시도 중
    expect(create).toHaveBeenCalledTimes(1);

    // 1차 복구: WebGL 재생성
    await advanceUntil(() => create.mock.calls.length >= 2);
    expect(create.mock.calls[1][1]).toMatchObject({ backend: 'auto', resetGpu: true });

    // 2차 복구: CPU
    await advanceUntil(() => create.mock.calls.length >= 3);
    expect(create.mock.calls[2][1]).toMatchObject({ backend: 'cpu', resetGpu: false });
    await vi.advanceTimersByTimeAsync(300);
    expect(useObjectStore.getState().stats.backend).toBe('cpu');
    expect(useObjectStore.getState().detectorStatus).toBe('ready');
    expect(Object.values(useObjectStore.getState().objects)).toHaveLength(1);
  });

  it('WebGL 컨텍스트가 손실되면 추론 전에 바로 새 WebGL 로 복구한다 (iOS 백그라운드 복귀)', async () => {
    const lost = fakeDetector('webgl', async () => chair());
    lost.broken = true;
    const fresh = fakeDetector('webgl', async () => chair());
    const { pipeline, create } = setup(async (_id, opts) => (opts?.resetGpu ? fresh : lost));
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();
    await vi.advanceTimersByTimeAsync(300);
    expect(lost.detect).not.toHaveBeenCalled();
    expect(lost.dispose).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
    expect(fresh.detect).toHaveBeenCalled();
    expect(useObjectStore.getState().stats.backend).toBe('webgl');
  });

  it('WebGL 재생성 자체가 실패하면 같은 복구 안에서 곧바로 CPU 로 불러온다', async () => {
    const lost = fakeDetector('webgl', async () => chair());
    lost.broken = true;
    const cpu = fakeDetector('cpu', async () => chair());
    const { pipeline, create } = setup(async (_id, opts) => {
      if (opts?.resetGpu) throw new Error('no webgl');
      return opts?.backend === 'cpu' ? cpu : lost;
    });
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();
    await vi.advanceTimersByTimeAsync(300);
    expect(create).toHaveBeenCalledTimes(3);
    expect(cpu.detect).toHaveBeenCalled();
    expect(useObjectStore.getState().detectorStatus).toBe('ready');
  });

  it('복구가 반복해서 실패하면 재시도를 멈추고 오류를 표시한다', async () => {
    const failing = () =>
      fakeDetector('cpu', async () => {
        throw new Error('still failing');
      });
    const { pipeline, create } = setup(async () => failing());
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(create).toHaveBeenCalledTimes(1 + MAX_RECOVERY_ATTEMPTS);
    const { detectorStatus, detectorMessage } = useObjectStore.getState();
    expect(detectorStatus).toBe('error');
    expect(detectorMessage).toContain('새로고침');
  });

  it('인식에 성공하면 복구 횟수를 초기화한다', async () => {
    let calls = 0;
    // 3회 실패 → 복구 → 성공 → 다시 3회 실패 → 복구 … 가 계속 반복되어도 포기하지 않음
    const { pipeline, create } = setup(async () =>
      fakeDetector('cpu', async () => {
        calls++;
        if (calls % (MAX_CONSECUTIVE_ERRORS + 1) === 0) return chair();
        throw new Error('flaky');
      }),
    );
    await pipeline.loadModel('coco-ssd-lite');
    pipeline.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(create.mock.calls.length).toBeGreaterThan(1 + MAX_RECOVERY_ATTEMPTS);
    expect(useObjectStore.getState().detectorMessage ?? '').not.toContain('새로고침');
  });
});
