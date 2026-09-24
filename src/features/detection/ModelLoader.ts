import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

/**
 * 사전 학습 모델 레지스트리 및 로더
 *
 * - 기본 모델은 저장소에 포함된 public/models/coco-ssd-lite (약 18MB) 입니다.
 * - 로컬 파일이 없으면 Google Cloud Storage의 공식 배포본으로 자동 대체합니다.
 * - 새 모델을 추가하려면 MODEL_REGISTRY 에 정의를 추가하고 ObjectDetector 구현을 연결하세요.
 */
export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  base: 'lite_mobilenet_v2' | 'mobilenet_v2';
  localPath: string;
  remoteUrl: string;
  approxSizeMB: number;
}

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: 'coco-ssd-lite',
    name: 'COCO-SSD Lite (기본)',
    description: '가볍고 빠름 · 모바일/내장 그래픽 권장',
    base: 'lite_mobilenet_v2',
    localPath: 'models/coco-ssd-lite/model.json',
    remoteUrl: 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json',
    approxSizeMB: 18,
  },
  {
    id: 'coco-ssd-mobilenet-v2',
    name: 'COCO-SSD MobileNet v2',
    description: '정확도 향상 · 더 무겁고 느림',
    base: 'mobilenet_v2',
    localPath: 'models/coco-ssd-mobilenet-v2/model.json',
    remoteUrl: 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json',
    approxSizeMB: 65,
  },
];

export const DEFAULT_MODEL_ID = MODEL_REGISTRY[0].id;

export function getModelDefinition(id: string): ModelDefinition {
  return MODEL_REGISTRY.find((m) => m.id === id) ?? MODEL_REGISTRY[0];
}

let backendPromise: Promise<string> | null = null;

/**
 * 연산 백엔드 초기화: WebGL(GPU, AMD 내장 그래픽 포함) → CPU 순으로 시도합니다.
 * 특정 GPU 제조사/CUDA 에 의존하지 않습니다.
 */
export function initBackend(): Promise<string> {
  if (!backendPromise) {
    backendPromise = (async () => {
      for (const name of ['webgl', 'cpu']) {
        try {
          const ok = await tf.setBackend(name);
          if (ok) {
            await tf.ready();
            if (name === 'webgl') {
              // 모바일 GPU 메모리 절약: 텍스처 재사용 임계값
              tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
            }
            return tf.getBackend();
          }
        } catch {
          // 다음 백엔드 시도
        }
      }
      throw new Error('사용 가능한 연산 백엔드가 없습니다.');
    })();
    backendPromise.catch(() => {
      backendPromise = null;
    });
  }
  return backendPromise;
}

/** 로컬 모델 파일 존재 여부 확인 후 사용할 URL 결정 */
export async function resolveModelUrl(def: ModelDefinition): Promise<string> {
  const local = new URL(def.localPath, document.baseURI).toString();
  try {
    const res = await fetch(local, { method: 'GET', cache: 'no-cache' });
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) return local;
    if (res.ok) {
      // 일부 정적 서버는 content-type 을 지정하지 않음: 본문으로 확인
      const text = await res.text();
      if (text.trimStart().startsWith('{')) return local;
    }
  } catch {
    // 오프라인 + 캐시 없음 등
  }
  return def.remoteUrl;
}
