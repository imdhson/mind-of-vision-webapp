import { useUIStore, type TabId } from '../../stores/uiStore';
import { IconCamera, IconCube, IconSliders } from './Icons';
import { cx } from './ui';

const TABS: { id: TabId; label: string; Icon: typeof IconCamera }[] = [
  { id: 'camera', label: '카메라', Icon: IconCamera },
  { id: 'vision', label: '3D 시각화', Icon: IconCube },
  { id: 'objects', label: '설정', Icon: IconSliders },
];

/** 하단 탭 (푸터 역할, 56px + 안전 영역, One UI 스타일 pill 강조) */
export function TabBar() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  return (
    <nav className="safe-bottom shrink-0 bg-bg" role="tablist" aria-label="화면 전환">
      <div className="mx-auto flex h-14 max-w-xl items-center px-2">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cx(
              'flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[10.5px] font-semibold transition-colors',
              tab === id ? 'text-accent' : 'text-muted',
            )}
          >
            <span
              className={cx(
                'grid h-7 w-12 place-items-center rounded-full transition-colors',
                tab === id && 'bg-accent-soft',
              )}
            >
              <Icon size={19} strokeWidth={tab === id ? 2.1 : 1.6} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
