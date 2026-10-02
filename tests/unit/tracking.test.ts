import { describe, it, expect } from 'vitest';
import { ObjectTracker } from '@/features/tracking/ObjectTracker';
const d = (x: number, cls = 'person') => ({ className: cls, score: 0.9, bbox: { x, y: 10, width: 50, height: 100 } });
describe('tracking', () => {
  it('keeps id across nearby frames', () => {
    const t = new ObjectTracker();
    const a = t.update([d(10)], 0)[0];
    const b = t.update([d(14)], 100)[0];
    expect(b.id).toBe(a.id);
  });
  it('separates same-class objects', () => {
    const t = new ObjectTracker();
    const a = t.update([d(10), d(300)], 0);
    expect(new Set(a.map((x) => x.id)).size).toBe(2);
  });
  it('rejects cross-class matching', () => {
    const t = new ObjectTracker();
    const a = t.update([d(10, 'person')], 0)[0];
    const b = t.update([d(10, 'dog')], 100).find((x) => x.className === 'dog')!;
    expect(b.id).not.toBe(a.id);
  });
});
