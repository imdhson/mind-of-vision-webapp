import type { ObjectDetection } from '@tensorflow-models/coco-ssd';
import type { Detection } from '../../types';
import {
  getModelDefinition,
  initBackend,
  onWebglContextLost,
  resetWebglBackend,
  resolveModelUrl,
  type BackendPreference,
  type ModelDefinition,
} from './ModelLoader';

/** 모델 교체가 가능하도록 분리한 객체 인식기 인터페이스 */
export interface ObjectDetector {
  readonly model: ModelDefinition;
  readonly backend: string;
  /** GPU 컨텍스트 손실 등으로 더 이상 추론할 수 없으면 true (다시 불러와야 함) */
  readonly broken: boolean;
  detect(source: HTMLVideoElement | HTMLCanvasElement, options?: DetectOptions): Promise<Detection[]>;
  dispose(): void;
}

export interface DetectorCreateOptions {
  backend?: BackendPreference;
  /** WebGL 백엔드를 새 컨텍스트로 다시 만든 뒤 불러오기 (컨텍스트 손실 복구) */
  resetGpu?: boolean;
  onProgress?: (msg: string) => void;
}

/** 인식기 생성 함수 (파이프라인에 주입해 교체·테스트 가능) */
export type DetectorFactory = (modelId: string, options?: DetectorCreateOptions) => Promise<ObjectDetector>;

export interface DetectOptions {
  maxDetections?: number;
  minScore?: number;
}

function sourceSize(source: HTMLVideoElement | HTMLCanvasElement) {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  return { w: source.width, h: source.height };
}

/** TensorFlow.js COCO-SSD 기반 구현 (80개 COCO 클래스) */
export class CocoSsdDetector implements ObjectDetector {
  private contextLost = false;
  private readonly unwatch: () => void;

  private constructor(
    readonly model: ModelDefinition,
    readonly backend: string,
    private readonly net: ObjectDetection,
  ) {
    this.unwatch = onWebglContextLost(() => {
      this.contextLost = true;
    });
  }

  get broken(): boolean {
    return this.contextLost;
  }

  static async create(modelId: string, options: DetectorCreateOptions = {}): Promise<CocoSsdDetector> {
    const { onProgress } = options;
    const def = getModelDefinition(modelId);
    onProgress?.('연산 백엔드 초기화');
    if (options.resetGpu && !resetWebglBackend()) throw new Error('WebGL 백엔드를 다시 만들 수 없습니다.');
    const backend = await initBackend(options.backend);
    onProgress?.('모델 불러오는 중');
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    const url = await resolveModelUrl(def);
    const net = await cocoSsd.load({ base: def.base, modelUrl: url });
    onProgress?.('모델 준비(워밍업)');
    // 첫 추론의 셰이더 컴파일 지연을 미리 소모
    const warm = document.createElement('canvas');
    warm.width = 64;
    warm.height = 64;
    await net.detect(warm, 1, 0.9);
    return new CocoSsdDetector(def, backend, net);
  }

  async detect(source: HTMLVideoElement | HTMLCanvasElement, options: DetectOptions = {}): Promise<Detection[]> {
    const { w, h } = sourceSize(source);
    if (!w || !h) return [];
    const raw = await this.net.detect(source, options.maxDetections ?? 20, options.minScore ?? 0.4);
    return raw.map((r) => {
      const [x, y, bw, bh] = r.bbox;
      return {
        classId: r.class,
        score: r.score,
        box: {
          x: clamp01(x / w),
          y: clamp01(y / h),
          width: clamp01(bw / w),
          height: clamp01(bh / h),
        },
      };
    });
  }

  dispose(): void {
    this.unwatch();
    try {
      this.net.dispose();
    } catch {
      // 컨텍스트가 손실된 백엔드의 텐서는 해제에 실패할 수 있음
    }
  }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
