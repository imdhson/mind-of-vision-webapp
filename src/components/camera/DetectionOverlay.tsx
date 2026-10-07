import { useObjectStore } from '@/stores/objectStore';

export function DetectionOverlay({ video }: { video: HTMLVideoElement | null }) {
  const objects = useObjectStore((s) => s.objects);
  const onSelect = useObjectStore((s) => s.select);
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
          <button
            key={o.id}
            className="bbox"
            style={s}
            onClick={() => onSelect(o.id)}
            aria-label={`${o.label}, 거리 ${o.distanceM.toFixed(1)}미터, 선택하여 상세 정보 보기`}
          >
            <span>
              {o.label} · {o.distanceM.toFixed(1)}m
            </span>
          </button>
        );
      })}
    </div>
  );
}
