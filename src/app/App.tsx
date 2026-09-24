import { lazy, Suspense } from 'react';
import { AppRuntime } from './providers/AppRuntime';
import { Header } from '../components/common/Header';
import { TabBar } from '../components/common/TabBar';
import { Toasts } from '../components/common/Toasts';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { CameraTab } from '../components/camera/CameraTab';
import { ObjectsTab } from '../components/objects/ObjectsTab';
import { useUIStore, type TabId } from '../stores/uiStore';
import { cx } from '../components/common/ui';

const VisionTab = lazy(() => import('../components/vision/VisionTab'));

/**
 * 레이아웃: 얇은 헤더(32px) + 메인 콘텐츠(최대 영역) + 하단 탭(48px)
 * 세 탭은 항상 마운트된 상태로 유지하고 표시만 전환합니다.
 * → 탭을 바꿔도 카메라 스트림·추적 상태·3D 씬이 초기화되지 않습니다.
 */
export default function App() {
  const tab = useUIStore((s) => s.tab);
  return (
    <AppRuntime>
      <div className="safe-x flex h-[100dvh] flex-col overflow-hidden bg-bg text-fg">
        <Header />
        <main className="relative min-h-0 flex-1">
          <Panel id="camera" active={tab === 'camera'}>
            <ErrorBoundary name="카메라">
              <CameraTab />
            </ErrorBoundary>
          </Panel>
          <Panel id="vision" active={tab === 'vision'}>
            <ErrorBoundary name="3D 시각화">
              <Suspense fallback={<div className="grid h-full place-items-center text-muted">3D 준비 중…</div>}>
                <VisionTab active={tab === 'vision'} />
              </Suspense>
            </ErrorBoundary>
          </Panel>
          <Panel id="objects" active={tab === 'objects'}>
            <ErrorBoundary name="설정">
              <ObjectsTab />
            </ErrorBoundary>
          </Panel>
          <Toasts />
        </main>
        <TabBar />
      </div>
    </AppRuntime>
  );
}

function Panel({ id, active, children }: { id: TabId; active: boolean; children: React.ReactNode }) {
  return (
    <section
      id={`panel-${id}`}
      role="tabpanel"
      aria-hidden={!active}
      className={cx('absolute inset-0', active ? 'z-10' : 'pointer-events-none invisible z-0')}
    >
      {children}
    </section>
  );
}
