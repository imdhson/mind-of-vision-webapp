import { useObjectStore } from '@/stores/objectStore';
import { VisionScene } from './VisionScene';

export function VisionTab({ active }: { active: boolean }) {
  const cameraRunning = useObjectStore((s) => s.cameraRunning);
  const setTab = useObjectStore((s) => s.setTab);

  return (
    <section className={`tab-page vision-page ${active ? 'show' : 'hide'}`} aria-hidden={!active}>
      <div className="thin-toolbar">
        <div className="toolbar-title">3D 시각화</div>
        <span className="muted">드래그 회전 · 핀치/휠 확대</span>
      </div>
      <div className="vision-stage">
        <VisionScene active={active} />
        {!cameraRunning && (
          <div className="empty-state">
            <div className="panel-block">
              <p>카메라가 중지되어 있습니다.</p>
              <button className="primary" onClick={() => setTab('camera')}>
                카메라 탭으로 이동
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
