import { useUIStore, type TabId } from '../../stores/uiStore';
import { IconCamera, IconCube, IconList } from './Icons';
import { cx } from './ui';

const TABS: { id: TabId; label: string; Icon: typeof IconCamera }[] = [
  { id: 'camera', label: '카메라', Icon: IconCamera },
  { id: 'vision', label: '3D 시각화', Icon: IconCube },
  { id: 'objects', label: '객체 목록', Icon: IconList },
];

/** 하단 탭 (푸터 역할, 48px + 안전 영역) */
export function TabBar() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  return (
    <nav className="safe-bottom shrink-0 border-t border-line bg-bg" role="tablist" aria-label="화면 전환">
      <div className="mx-auto flex h-12 max-w-xl">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cx(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors',
              tab === id ? 'text-fg' : 'text-muted',
            )}
          >
            <Icon size={19} strokeWidth={tab === id ? 2.1 : 1.6} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
