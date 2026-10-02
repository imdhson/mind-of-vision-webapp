import { VisionScene } from './VisionScene';
export function VisionTab({ active }: { active:boolean }) {
  return <section className={`tab-page vision-page ${active?'show':'hide'}`} aria-hidden={!active}><div className="thin-toolbar"><div className="toolbar-title">3D 시각화</div><span className="muted">드래그 회전 · 핀치/휠 확대</span></div><div className="vision-stage"><VisionScene active={active}/></div></section>;
}
