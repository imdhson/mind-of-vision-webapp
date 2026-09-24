import { describe, expect, it } from 'vitest';
import { ObjectTracker } from '../../src/features/tracking/ObjectTracker';
import { box, det } from './helpers';

describe('ObjectTracker', () => {
  it('keeps the same ID while an object moves smoothly', () => {
    const t = new ObjectTracker();
    let tracks = t.update({ detections: [det('chair', box(0.1, 0.3, 0.2, 0.3))], timestamp: 0 });
    const id = tracks[0].id;
    for (let i = 1; i <= 20; i++) {
      tracks = t.update({ detections: [det('chair', box(0.1 + i * 0.01, 0.3, 0.2, 0.3))], timestamp: i * 100 });
    }
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe(id);
    expect(tracks[0].state).toBe('tracking');
  });

  it('assigns different IDs and ordinals to two objects of the same class', () => {
    const t = new ObjectTracker();
    const frame = (ts: number) =>
      t.update({
        detections: [det('chair', box(0.05, 0.4, 0.2, 0.3)), det('chair', box(0.6, 0.4, 0.2, 0.3))],
        timestamp: ts,
      });
    frame(0);
    const tracks = frame(100);
    expect(tracks).toHaveLength(2);
    expect(new Set(tracks.map((x) => x.id)).size).toBe(2);
    expect(tracks.map((x) => x.ordinal).sort()).toEqual([1, 2]);
  });

  it('does not swap identities of two same-class objects when detection order changes', () => {
    const t = new ObjectTracker();
    const a = box(0.05, 0.4, 0.2, 0.3);
    const b = box(0.6, 0.4, 0.2, 0.3);
    t.update({ detections: [det('cup', a), det('cup', b)], timestamp: 0 });
    const first = t.update({ detections: [det('cup', a), det('cup', b)], timestamp: 100 });
    const leftId = first.find((x) => x.box.x < 0.3)!.id;
    const swapped = t.update({ detections: [det('cup', b), det('cup', a)], timestamp: 200 });
    expect(swapped.find((x) => x.box.x < 0.3)!.id).toBe(leftId);
  });

  it('never matches across classes', () => {
    const t = new ObjectTracker();
    t.update({ detections: [det('cup', box(0.4, 0.4, 0.1, 0.1))], timestamp: 0 });
    const tracks = t.update({ detections: [det('bottle', box(0.4, 0.4, 0.1, 0.1))], timestamp: 100 });
    const cls = new Set(tracks.map((x) => x.classId));
    expect(cls.has('bottle')).toBe(true);
    const bottle = tracks.find((x) => x.classId === 'bottle')!;
    const cup = tracks.find((x) => x.classId === 'cup');
    if (cup) expect(cup.id).not.toBe(bottle.id);
  });

  it('applies a grace period, then marks lost, then removes', () => {
    const t = new ObjectTracker({ graceMs: 1000, lostRetentionMs: 500 });
    const b = box(0.3, 0.3, 0.2, 0.3);
    t.update({ detections: [det('person', b)], timestamp: 0 });
    t.update({ detections: [det('person', b)], timestamp: 100 });
    let tracks = t.update({ detections: [], timestamp: 500 });
    expect(tracks[0].state).toBe('temporarily_lost');
    // 다시 인식되면 같은 ID 로 복귀
    const id = tracks[0].id;
    tracks = t.update({ detections: [det('person', b)], timestamp: 700 });
    expect(tracks[0].id).toBe(id);
    expect(tracks[0].state).toBe('tracking');
    tracks = t.update({ detections: [], timestamp: 1800 });
    expect(tracks[0].state).toBe('lost');
    tracks = t.update({ detections: [], timestamp: 2400 });
    expect(tracks).toHaveLength(0);
  });

  it('drops unconfirmed one-frame false positives quickly', () => {
    const t = new ObjectTracker({ tentativeGraceMs: 300 });
    t.update({ detections: [det('dog', box(0.3, 0.3, 0.2, 0.2))], timestamp: 0 });
    const tracks = t.update({ detections: [], timestamp: 400 });
    expect(tracks).toHaveLength(0);
  });

  it('smooths jittery boxes', () => {
    const t = new ObjectTracker();
    t.update({ detections: [det('tv', box(0.4, 0.4, 0.2, 0.2))], timestamp: 0 });
    const tracks = t.update({ detections: [det('tv', box(0.44, 0.4, 0.2, 0.2))], timestamp: 100 });
    expect(tracks[0].box.x).toBeGreaterThan(0.4);
    expect(tracks[0].box.x).toBeLessThan(0.44);
    expect(tracks[0].rawBox.x).toBeCloseTo(0.44);
  });
});
