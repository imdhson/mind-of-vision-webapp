import { useEffect, useRef } from 'react';
import { useObjectStore } from '@/stores/objectStore';
import { radToDeg } from '@/utils/math';
import { CalibrationPanel } from '@/components/calibration/CalibrationPanel';

export function ObjectDetailsSheet() {
  const selectedId = useObjectStore((s) => s.selectedId);
  const o = useObjectStore((s) => (selectedId ? s.objects.find((x) => x.id === selectedId) : undefined));
  const select = useObjectStore((s) => s.select);

  const sheetRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Use a stable boolean to represent open/closed state so we don't steal focus
  // when the object's properties (like distance/confidence) update rapidly.
  const isOpen = !!selectedId;

  useEffect(() => {
    if (isOpen) {
      if (!triggerRef.current) {
        triggerRef.current = document.activeElement as HTMLElement;
      }
      sheetRef.current?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!o) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [o, select]);

  if (!o) return null;
  return (
    <aside
      className="details-sheet"
      role="dialog"
      aria-labelledby="details-sheet-title"
      aria-modal="false"
      tabIndex={-1}
      ref={sheetRef}
    >
      <div className="sheet-head">
        <div>
          <strong id="details-sheet-title">{o.label}</strong>
          <span>{o.id}</span>
        </div>
        <button onClick={() => select(null)} aria-label="닫기 (Escape)" title="닫기 (Escape)">
          닫기
        </button>
      </div>
      <dl>
        <dt>신뢰도</dt>
        <dd>{Math.round(o.score * 100)}%</dd>
        <dt>거리</dt>
        <dd>{o.distanceM.toFixed(2)} m</dd>
        <dt>좌표</dt>
        <dd>
          {o.position.x.toFixed(2)}, {o.position.y.toFixed(2)}, {o.position.z.toFixed(2)}
        </dd>
        <dt>크기</dt>
        <dd>
          {o.size.width.toFixed(2)} × {o.size.height.toFixed(2)} × {o.size.depth.toFixed(2)} m
        </dd>
        <dt>방향</dt>
        <dd>
          {o.yawRad == null ? '미확정' : `${radToDeg(o.yawRad).toFixed(0)}°`} · {o.moving ? '이동 중' : '정지'}
        </dd>
        <dt>보정</dt>
        <dd>{o.correctionSource ?? '기본값'}</dd>
      </dl>
      <CalibrationPanel object={o} onApplied={() => {}} />
    </aside>
  );
}
