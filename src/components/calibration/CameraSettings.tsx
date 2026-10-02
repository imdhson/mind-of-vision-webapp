import { runtimeExtras } from '@/app/AppRuntime';
import { saveProfile } from '@/features/camera/CameraCalibration';
import type { CameraProfile } from '@/types';
export function CameraSettings() {
  const rt = runtimeExtras(); const p = rt?.profile;
  if (!p) return null;
  const patch=(k:keyof CameraProfile,v:any)=>{const n={...p,[k]:v};rt.setProfile(n);saveProfile(n)};
  return <div className="panel-block"><h3>카메라 보정</h3><div className="form-grid">
    <label><span>세로 FOV</span><div><input type="number" value={p.fovDeg} onChange={(e)=>patch('fovDeg',Number(e.target.value))}/><em>°</em></div></label>
    <label><span>카메라 높이</span><div><input type="number" step="0.01" value={p.heightM} onChange={(e)=>patch('heightM',Number(e.target.value))}/><em>m</em></div></label>
    <label><span>거리 배율</span><div><input type="number" step="0.01" value={p.distanceScale} onChange={(e)=>patch('distanceScale',Number(e.target.value))}/><em>x</em></div></label>
    <label><span>기본 기울기</span><div><input type="number" step="0.1" value={p.tiltDeg} onChange={(e)=>patch('tiltDeg',Number(e.target.value))}/><em>°</em></div></label>
  </div><label className="toggle"><input type="checkbox" checked={p.useTiltSensor} onChange={(e)=>patch('useTiltSensor',e.target.checked)}/> 기울기 센서 사용</label></div>;
}
