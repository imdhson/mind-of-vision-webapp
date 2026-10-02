import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { RawDetection } from '@/types';
import { MODEL_REGISTRY, type ModelId } from './ModelLoader';

export class ObjectDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  backend = 'unknown';
  modelId: ModelId = 'coco-ssd-lite';

  async init(modelId: ModelId = this.modelId) {
    this.modelId = modelId;
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      this.backend = tf.getBackend();
    } catch {
      await tf.setBackend('cpu');
      await tf.ready();
      this.backend = tf.getBackend();
    }
    const def = MODEL_REGISTRY[modelId];
    try {
      this.model = await cocoSsd.load({ base: def.base, modelUrl: new URL(def.localPath, document.baseURI).toString() });
    } catch {
      this.model = await cocoSsd.load({ base: def.base });
    }
  }

  async switchModel(modelId: ModelId) {
    this.model?.dispose?.();
    this.model = null;
    await this.init(modelId);
  }

  async detect(video: HTMLVideoElement): Promise<RawDetection[]> {
    if (!this.model || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return [];
    const result = await this.model.detect(video, 20, 0.38);
    return result.map((d) => ({
      className: d.class,
      score: d.score,
      bbox: { x: d.bbox[0], y: d.bbox[1], width: d.bbox[2], height: d.bbox[3] }
    }));
  }
}
