import type { ObjectDetection } from '@tensorflow-models/coco-ssd';
import type { Detection } from '../../types';
import { getModelDefinition, initBackend, resolveModelUrl, type ModelDefinition } from './ModelLoader';

/** 모델 교체가 가능하도록 분리한 객체 인식기 인터페이스 */
export interface ObjectDetector {
  readonly model: ModelDefinition;
  readonly backend: string;
  detect(source: HTMLVideoElement | HTMLCanvasElement, options?: DetectOptions): Promise<Detection[]>;
  dispose(): void;
}

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
  private constructor(
    readonly model: ModelDefinition,
    readonly backend: string,
    private readonly net: ObjectDetection,
  ) {}

  static async create(modelId: string, onProgress?: (msg: string) => void): Promise<CocoSsdDetector> {
    const def = getModelDefinition(modelId);
    onProgress?.('연산 백엔드 초기화');
    const backend = await initBackend();
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
    this.net.dispose();
  }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
