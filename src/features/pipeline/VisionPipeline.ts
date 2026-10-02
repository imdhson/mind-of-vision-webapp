import { ObjectDetector } from '@/features/detection/ObjectDetector';
import { ObjectTracker } from '@/features/tracking/ObjectTracker';
import { buildSpatialObject } from './objectBuilder';
import type { CameraProfile, SpatialObject } from '@/types';
import type { CalibrationManager } from '@/features/calibration/CalibrationManager';
import type { ModelId } from '@/features/detection/ModelLoader';

export class VisionPipeline {
  detector = new ObjectDetector();
  tracker = new ObjectTracker();
  private running = false;
  private generation = 0;
  private timer = 0;
  maxFps = 14;

  async init(modelId?: ModelId) {
    await this.detector.init(modelId);
  }
  start(args: {
    video: HTMLVideoElement;
    profile: () => CameraProfile;
    liveTiltDeg: () => number | undefined;
    calibration: CalibrationManager;
    onObjects: (objects: SpatialObject[]) => void;
    onError: (error: unknown) => void;
  }) {
    this.stop();
    this.running = true;
    const generation = ++this.generation;
    const loop = async () => {
      if (!this.running || generation !== this.generation) return;
      const started = performance.now();
      try {
        const { video } = args;
        const detections = await this.detector.detect(video);
        if (!this.running || generation !== this.generation) return;
        const tracks = this.tracker.update(detections);
        const objects = tracks.map((t) =>
          buildSpatialObject(t, {
            width: video.videoWidth || 1280,
            height: video.videoHeight || 720,
            profile: args.profile(),
            liveTiltDeg: args.liveTiltDeg(),
            calibration: args.calibration,
          }),
        );
        args.onObjects(objects);
      } catch (e) {
        args.onError(e);
      }
      const delay = Math.max(0, 1000 / this.maxFps - (performance.now() - started));
      this.timer = window.setTimeout(loop, delay);
    };
    loop();
  }
  stop() {
    this.running = false;
    this.generation++;
    clearTimeout(this.timer);
    this.tracker.clear();
  }
}
