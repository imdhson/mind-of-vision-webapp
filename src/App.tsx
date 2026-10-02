import { Header } from '@/components/common/Header';
import { BottomTabs } from '@/components/common/BottomTabs';
import { CameraTab } from '@/components/camera/CameraTab';
import { VisionTab } from '@/components/vision/VisionTab';
import { SettingsTab } from '@/components/objects/SettingsTab';
import { ObjectDetailsSheet } from '@/components/objects/ObjectDetailsSheet';
import { useObjectStore } from '@/stores/objectStore';
export default function App(){const tab=useObjectStore((s)=>s.tab);return <div className="app-shell"><Header/><main className="content"><CameraTab active={tab==='camera'}/><VisionTab active={tab==='vision'}/><SettingsTab active={tab==='settings'}/></main><ObjectDetailsSheet/><BottomTabs/></div>}
