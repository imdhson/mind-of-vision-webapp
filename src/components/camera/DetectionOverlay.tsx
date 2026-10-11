import { useObjectStore } from '@/stores/objectStore';

import type { SpatialObject } from '@/types';

const EMPTY_ARRAY: SpatialObject[] = [];

export function DetectionOverlay({ video, active }: { video: HTMLVideoElement | null; active: boolean }) {
  // ⚡ Bolt Performance Optimization:
  // Conditional Zustand selector returns a static empty array when the tab is inactive.
  // This completely bypasses React reconciliation for this DOM-heavy component,
  // saving CPU cycles that would otherwise be wasted updating hidden DOM elements 14 times per second.
  const objects = useObjectStore((s) => (active ? s.objects : EMPTY_ARRAY));
  const onSelect = useObjectStore((s) => s.select);

  if (!active) return null;

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
