import { useEffect, useRef } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useCameraStore } from '../../stores/cameraStore';
import { useUIStore } from '../../stores/uiStore';
import { fitRect, pointInBox, boxArea } from '../../utils/geometry';
import { dampFactor } from '../../utils/math';
import { fmtDistance } from '../../utils/format';
import type { NormalizedBox } from '../../types';

/**
 * 인식 결과 오버레이 (Canvas 2D, requestAnimationFrame)
 * - 추론 주기(약 10Hz)와 무관하게 60fps 로 상자를 보간해 흔들림을 줄입니다.
 * - 정규화 좌표 + object-fit 사각형 변환으로 해상도/화면 크기 변화에도 정확히 정렬됩니다.
 * - 터치/클릭으로 객체를 선택합니다(모바일용 여유 판정 영역 포함).
 */
export function DetectionOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const shown = new Map<string, NormalizedBox>();
    let raf = 0;
    let last = performance.now();
    const fontFamily = getComputedStyle(document.body).fontFamily;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const panelHidden = useUIStore.getState().tab !== 'camera';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (panelHidden) return;
      const active = useCameraStore.getState().active;
      if (!active) {
        shown.clear();
        return;
      }
      const { objects, selectedId } = useObjectStore.getState();
      const rect = fitRect(w, h, active.videoWidth, active.videoHeight, useUIStore.getState().fitMode);
      const k = dampFactor(dt, 0.07);
      for (const id of shown.keys()) if (!objects[id]) shown.delete(id);

      const entries = Object.values(objects).sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0));
      for (const o of entries) {
        if (o.trackingState === 'lost') continue;
        const target = o.boundingBox;
        const prev = shown.get(o.id);
        const b = prev
          ? {
              x: prev.x + (target.x - prev.x) * k,
              y: prev.y + (target.y - prev.y) * k,
              width: prev.width + (target.width - prev.width) * k,
              height: prev.height + (target.height - prev.height) * k,
            }
          : { ...target };
        shown.set(o.id, b);
        const x = rect.x + b.x * rect.width;
        const y = rect.y + b.y * rect.height;
        const bw = b.width * rect.width;
        const bh = b.height * rect.height;
        const selected = o.id === selectedId;
        const tentative = o.trackingState === 'detected';
        const lostTemp = o.trackingState === 'temporarily_lost';
        ctx.globalAlpha = lostTemp ? 0.45 : tentative ? 0.6 : 1;
        ctx.setLineDash(lostTemp ? [6, 5] : []);
        const r = 6;
        // 어두운 외곽선 + 흰 선 → 어떤 영상 위에서도 잘 보임
        ctx.lineWidth = selected ? 5 : 3.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        roundRect(ctx, x, y, bw, bh, r);
        ctx.stroke();
        ctx.lineWidth = selected ? 3 : 1.5;
        ctx.strokeStyle = '#ffffff';
        roundRect(ctx, x, y, bw, bh, r);
        ctx.stroke();
        ctx.setLineDash([]);

        const dist = o.correctedDistance;
        const text = `${o.label}${dist != null ? ` · ${fmtDistance(dist)}` : ''}`;
        ctx.font = `${selected ? 600 : 500} 12px ${fontFamily}`;
        const tw = ctx.measureText(text).width;
        const lh = 20;
        const lx = Math.min(Math.max(x, 2), w - tw - 14);
        const ly = y - lh - 3 < 2 ? y + 3 : y - lh - 3;
        ctx.fillStyle = selected ? '#ffffff' : 'rgba(0,0,0,0.62)';
        roundRect(ctx, lx, ly, tw + 12, lh, 5);
        ctx.fill();
        ctx.fillStyle = selected ? '#000000' : '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx + 6, ly + lh / 2 + 0.5);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 터치/클릭 선택
  useEffect(() => {
    const canvas = canvasRef.current!;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return;
      down = null;
      const active = useCameraStore.getState().active;
      if (!active) return;
      const bounds = canvas.getBoundingClientRect();
      const rect = fitRect(
        bounds.width,
        bounds.height,
        active.videoWidth,
        active.videoHeight,
        useUIStore.getState().fitMode,
      );
      const nx = (e.clientX - bounds.left - rect.x) / rect.width;
      const ny = (e.clientY - bounds.top - rect.y) / rect.height;
      // 손가락 터치 여유(약 16px)
      const pad = 16 / Math.min(rect.width, rect.height);
      const { objects, select, selectedId } = useObjectStore.getState();
      const hits = Object.values(objects)
        .filter((o) => o.trackingState !== 'lost' && pointInBox(nx, ny, o.boundingBox, pad))
        .sort((a, b) => boxArea(a.boundingBox) - boxArea(b.boundingBox));
      if (hits.length === 0) {
        if (selectedId) select(null);
        return;
      }
      // 같은 위치를 다시 누르면 겹친 다음 객체 선택
      const idx = hits.findIndex((h) => h.id === selectedId);
      select(hits[(idx + 1) % hits.length].id);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-manipulation"
      aria-label="객체 인식 결과. 객체를 눌러 선택"
      data-testid="detection-overlay"
    />
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
