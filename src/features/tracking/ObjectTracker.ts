import type { RawDetection, Track } from '@/types';
import { centerDistance, iou } from '@/utils/math';

export class ObjectTracker {
  private tracks = new Map<string, Track>();
  private seq = 1;
  constructor(private graceMs = 900) {}

  update(detections: RawDetection[], now = performance.now()): Track[] {
    const existing = [...this.tracks.values()];
    const used = new Set<string>();
    const out: Track[] = [];

    for (const det of detections) {
      let best: Track | undefined;
      let bestScore = -Infinity;
      for (const tr of existing) {
        if (used.has(tr.id) || tr.className !== det.className) continue;
        const overlap = iou(tr.bbox, det.bbox);
        const dist = centerDistance(tr.bbox, det.bbox);
        const norm = dist / Math.max(40, tr.bbox.width, tr.bbox.height);
        const score = overlap * 2.2 - norm * 0.55;
        if ((overlap > 0.08 || norm < 1.3) && score > bestScore) { bestScore = score; best = tr; }
      }
      if (best) {
        used.add(best.id);
        const oldCx = best.bbox.x + best.bbox.width / 2;
        const oldCy = best.bbox.y + best.bbox.height / 2;
        const newCx = det.bbox.x + det.bbox.width / 2;
        const newCy = det.bbox.y + det.bbox.height / 2;
        best.velocity = {
          x: best.velocity.x * 0.68 + (newCx - oldCx) * 0.32,
          y: best.velocity.y * 0.68 + (newCy - oldCy) * 0.32
        };
        Object.assign(best, det, { lastSeen: now, misses: 0 });
        out.push(best);
      } else {
        const id = `${det.className.replace(/\s+/g, '-')}-${this.seq++}`;
        const tr: Track = { ...det, id, createdAt: now, lastSeen: now, misses: 0, velocity: { x: 0, y: 0 } };
        this.tracks.set(id, tr); out.push(tr);
      }
    }

    for (const tr of existing) {
      if (!used.has(tr.id) && now - tr.lastSeen <= this.graceMs) { tr.misses++; out.push(tr); }
      else if (now - tr.lastSeen > this.graceMs) this.tracks.delete(tr.id);
    }
    return out;
  }

  clear() { this.tracks.clear(); }
}
