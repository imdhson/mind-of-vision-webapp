import { useRuntime } from '@/app/AppRuntime';
import { useState } from 'react';
export function SavedCalibrationManager() {
  const { calibration } = useRuntime(); const [,redraw]=useState(0);
  return <div className="panel-block"><h3>저장된 보정</h3>{!calibration.records.length?<p className="muted">저장된 보정이 없습니다.</p>:<div className="saved-list">{calibration.records.map((r)=><div key={r.id}><span>{r.scope==='class'?'클래스':'객체'} · {r.className}</span><button onClick={async()=>{await calibration.remove(r.id);redraw((x)=>x+1)}}>삭제</button></div>)}</div>}</div>;
}
