import { useEffect, useState } from 'react';
import { useObjectStore } from '@/stores/objectStore';
import { useShallow } from 'zustand/react/shallow';
import { CameraSettings } from '@/components/calibration/CameraSettings';
import { SavedCalibrationManager } from '@/components/calibration/SavedCalibrationManager';
import { MODEL_REGISTRY, type ModelId } from '@/features/detection/ModelLoader';
import { useRuntime } from '@/app/AppRuntime';
export function SettingsTab({ active }: { active: boolean }) {
  const s = useObjectStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      modelId: state.modelId,
      backend: state.backend,
      modelStatus: state.modelStatus,
      select: state.select,
      setModelId: state.setModelId,
      setModelState: state.setModelState,
    })),
  );
  const { pipeline } = useRuntime();
  const [snapshot, setSnapshot] = useState(() => useObjectStore.getState().objects);
  useEffect(() => {
    if (!active || s.selectedId) return;
    const refresh = () => setSnapshot(useObjectStore.getState().objects);
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active, s.selectedId]);
  async function model(id: ModelId) {
    s.setModelId(id);
    s.setModelState({ modelStatus: 'loading', message: '모델 변경 중…' });
    try {
      await pipeline.detector.switchModel(id);
      s.setModelState({ modelStatus: 'ready', backend: pipeline.detector.backend, message: '' });
    } catch (e) {
      s.setModelState({ modelStatus: 'error', message: String(e) });
    }
  }
  return (
    <section className={`tab-page settings-page ${active ? 'show' : 'hide'}`} aria-hidden={!active}>
      <div className="thin-toolbar">
        <div className="toolbar-title">설정</div>
        <span className="muted">객체 목록은 2초마다 갱신 · 선택 중 일시정지</span>
      </div>
      <div className="settings-scroll">
        <div className="panel-block">
          <h3>실시간 객체</h3>
          <div className="object-list">
            {snapshot.length ? (
              snapshot.map((o) => (
                <button key={o.id} className={s.selectedId === o.id ? 'active' : ''} onClick={() => s.select(o.id)}>
                  <span>{o.label}</span>
                  <em>
                    {o.distanceM.toFixed(1)}m · {Math.round(o.score * 100)}%
                  </em>
                </button>
              ))
            ) : (
              <p className="muted">인식된 객체가 없습니다.</p>
            )}
          </div>
        </div>
        <div className="panel-block">
          <h3>AI 모델</h3>
          <select
            aria-label="AI 모델 선택"
            value={s.modelId}
            onChange={(e) => model(e.target.value as ModelId)}
            disabled={s.modelStatus === 'loading'}
          >
            {Object.entries(MODEL_REGISTRY).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="hint">
            Backend: {s.backend} · {s.modelStatus}
          </p>
        </div>
        <CameraSettings />
        <SavedCalibrationManager />
      </div>
    </section>
  );
}
