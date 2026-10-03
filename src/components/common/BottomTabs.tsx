import { useObjectStore } from '@/stores/objectStore';
import { useShallow } from 'zustand/react/shallow';
const tabs = [
  ['camera', '카메라'],
  ['vision', '3D 시각화'],
  ['settings', '설정'],
] as const;
export function BottomTabs() {
  const { tab, setTab } = useObjectStore(useShallow((s) => ({ tab: s.tab, setTab: s.setTab })));
  return (
    <nav className="bottom-tabs" aria-label="주요 메뉴">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          className={tab === id ? 'active' : ''}
          onClick={() => setTab(id)}
          aria-current={tab === id ? 'page' : undefined}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
