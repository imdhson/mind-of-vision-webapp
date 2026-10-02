import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectStore } from '@/stores/objectStore';
import { useRuntime, runtimeExtras, profileForCurrentCamera } from '@/app/AppRuntime';
import { DetectionOverlay } from './DetectionOverlay';

export function CameraTab({ active }: { active: boolean }) {
  const { camera, pipeline, calibration } = useRuntime();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);
  const [error, setError] = useState('');
  const s = useObjectStore();

  useEffect(() => {
    const rt = runtimeExtras();
    if (rt) rt.videoRef.current = videoRef.current;
  }, []);

  async function start(deviceId?: string) {
    try {
      setError('');
      s.setModelState({ modelStatus: 'loading', message: 'AI 모델 로딩 중…' });
      if (!window.isSecureContext && location.hostname !== 'localhost')
        throw new Error('카메라는 HTTPS 또는 localhost에서만 사용할 수 있습니다.');
      await camera.start(videoRef.current!, deviceId);
      const p = await profileForCurrentCamera(camera);
      runtimeExtras().setProfile(p);
      s.setActiveDeviceId(camera.currentDeviceId);
      s.setCameraDevices(camera.devices);
      s.setCameraRunning(true);
      if (!pipeline.detector || pipeline.detector.backend === 'unknown') await pipeline.init(s.modelId);
      s.setModelState({ modelStatus: 'ready', backend: pipeline.detector.backend, message: '' });
      pipeline.start({
        video: videoRef.current!,
        profile: () => runtimeExtras().profile,
        liveTiltDeg: () => runtimeExtras().pitch,
        calibration,
        onObjects: (objects) => useObjectStore.getState().setObjects(objects),
        onError: (e) => useObjectStore.getState().setModelState({ message: String(e) }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      s.setModelState({ modelStatus: 'error' });
    }
  }
  function stop() {
    pipeline.stop();
    camera.stop();
    s.setCameraRunning(false);
    s.setObjects([]);
  }
  async function switchDevice(id: string) {
    stop();
    await start(id);
  }

  return (
    <section className={`tab-page camera-page ${active ? 'show' : 'hide'}`} aria-hidden={!active}>
      <div className="thin-toolbar">
        <div className="toolbar-title">카메라</div>
        <select
          value={s.activeDeviceId}
          onChange={(e) => switchDevice(e.target.value)}
          disabled={!s.cameraDevices.length}
        >
          <option value="">자동 카메라</option>
          {s.cameraDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label} · {d.kind}
            </option>
          ))}
        </select>
        {s.cameraRunning ? (
          <button onClick={stop}>중지</button>
        ) : (
          <button onClick={() => start(s.activeDeviceId || undefined)}>시작</button>
        )}
      </div>
      <div className="camera-stage">
        <video ref={setVideoRef} muted playsInline autoPlay />
        <DetectionOverlay objects={s.objects} video={videoEl} onSelect={s.select} />
        {!s.cameraRunning && <div className="empty-state">카메라를 시작하면 객체 인식이 표시됩니다.</div>}
        {!!error && <div className="error-banner">{error}</div>}
      </div>
    </section>
  );
}
