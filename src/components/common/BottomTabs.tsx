import { useObjectStore } from '@/stores/objectStore';
const tabs = [
  ['camera', '카메라'],
  ['vision', '3D 시각화'],
  ['settings', '설정'],
] as const;
export function BottomTabs() {
  const { tab, setTab } = useObjectStore();
  return (
    <nav className="bottom-tabs">
      {tabs.map(([id, label]) => (
        <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          {label}
        </button>
      ))}
    </nav>
  );
}
