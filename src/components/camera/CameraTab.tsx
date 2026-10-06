import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectStore } from '@/stores/objectStore';
import { useShallow } from 'zustand/react/shallow';
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
  const s = useObjectStore(
    useShallow((state) => ({
      activeDeviceId: state.activeDeviceId,
      cameraDevices: state.cameraDevices,
      cameraRunning: state.cameraRunning,
      modelId: state.modelId,
      modelStatus: state.modelStatus,
      setModelState: state.setModelState,
      setActiveDeviceId: state.setActiveDeviceId,
      setCameraDevices: state.setCameraDevices,
      setCameraRunning: state.setCameraRunning,
      setObjects: state.setObjects,
    })),
  );

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
        onError: (e) => {
          console.error('Pipeline error:', e);
          useObjectStore.getState().setModelState({ message: '파이프라인 실행 중 오류가 발생했습니다.' });
        },
      });
    } catch (e) {
      console.error('Camera start error:', e);
      setError('카메라 시작 중 오류가 발생했습니다.');
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
          aria-label="카메라 선택"
          value={s.activeDeviceId}
          onChange={(e) => switchDevice(e.target.value)}
          disabled={!s.cameraDevices.length || s.modelStatus === 'loading'}
          title={s.modelStatus === 'loading' ? 'AI 모델 로딩 중에는 카메라를 변경할 수 없습니다.' : '카메라 선택'}
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
          <button
            onClick={() => start(s.activeDeviceId || undefined)}
            disabled={s.modelStatus === 'loading'}
            aria-busy={s.modelStatus === 'loading'}
          >
            {s.modelStatus === 'loading' ? '로딩 중…' : '시작'}
          </button>
        )}
      </div>
      <div className="camera-stage">
        <video ref={setVideoRef} muted playsInline autoPlay />
        <DetectionOverlay video={videoEl} />
        {!s.cameraRunning && (
          <div className="empty-state">
            <div className="panel-block">
              <p>카메라를 시작하면 객체 인식이 표시됩니다.</p>
              <button
                className="primary"
                onClick={() => start(s.activeDeviceId || undefined)}
                disabled={s.modelStatus === 'loading'}
                aria-busy={s.modelStatus === 'loading'}
              >
                {s.modelStatus === 'loading' ? '로딩 중…' : '카메라 시작하기'}
              </button>
            </div>
          </div>
        )}
        {!!error && (
          <div className="error-banner" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
