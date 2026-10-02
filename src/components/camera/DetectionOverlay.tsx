import type { SpatialObject } from '@/types';
export function DetectionOverlay({
  objects,
  video,
  onSelect,
}: {
  objects: SpatialObject[];
  video: HTMLVideoElement | null;
  onSelect: (id: string) => void;
}) {
  const w = video?.videoWidth || 1,
    h = video?.videoHeight || 1;
  return (
    <div className="overlay">
      {objects.map((o) => {
        const s = {
          left: `${(o.bbox.x / w) * 100}%`,
          top: `${(o.bbox.y / h) * 100}%`,
          width: `${(o.bbox.width / w) * 100}%`,
          height: `${(o.bbox.height / h) * 100}%`,
        };
        return (
          <button key={o.id} className="bbox" style={s} onClick={() => onSelect(o.id)}>
            <span>
              {o.label} · {o.distanceM.toFixed(1)}m
            </span>
          </button>
        );
      })}
    </div>
  );
}
