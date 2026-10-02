import { listVideoDevices } from './CameraDeviceService';
import type { CameraDevice } from '@/types';

export class CameraManager {
  stream: MediaStream | null = null;
  devices: CameraDevice[] = [];
  currentDeviceId = '';
  generation = 0;

  async refreshDevices() {
    this.devices = await listVideoDevices();
    return this.devices;
  }

  async start(video: HTMLVideoElement, deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라 API를 지원하지 않습니다.');
    this.stop();
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.generation++;
    video.srcObject = this.stream;
    await video.play();
    const settings = this.stream.getVideoTracks()[0]?.getSettings();
    this.currentDeviceId = settings?.deviceId || deviceId || '';
    await this.refreshDevices();
    return settings;
  }

  async switch(video: HTMLVideoElement, deviceId: string) {
    return this.start(video, deviceId);
  }

  async setZoom(value: number) {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
      zoom?: { min: number; max: number; step: number };
    };
    if (!caps?.zoom) return;
    await track.applyConstraints({
      advanced: [{ zoom: Math.max(caps.zoom.min, Math.min(caps.zoom.max, value)) } as MediaTrackConstraintSet],
    });
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.generation++;
  }
}
