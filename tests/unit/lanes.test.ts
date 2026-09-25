import { describe, expect, it } from 'vitest';
import { detectLanes, roiTopFor, type LaneDetection } from '../../src/features/lanes/LaneDetector';
import { LaneTracker } from '../../src/features/lanes/LaneTracker';
import { imageToGround, laneToGround } from '../../src/features/lanes/laneGeometry';
import { computeIntrinsics } from '../../src/features/camera/CameraCalibration';
import { DEG } from '../../src/utils/math';

const W = 256;
const H = 192;

/** 어두운 노면(+약한 잡음) 위에 밝은 선을 그린 RGBA 프레임 */
function frame(lines: { x0: number; y0: number; x1: number; y1: number }[], thickness = 4): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 11) - 5;
  for (let i = 0; i < W * H; i++) {
    const v = 70 + noise();
    data.set([v, v, v, 255], i * 4);
  }
  for (const l of lines) {
    const steps = Math.max(Math.abs(l.y1 - l.y0), Math.abs(l.x1 - l.x0));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(l.x0 + ((l.x1 - l.x0) * s) / steps);
      const y = Math.round(l.y0 + ((l.y1 - l.y0) * s) / steps);
      for (let dx = -thickness / 2; dx < thickness / 2; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W || y < 0 || y >= H) continue;
        data.set([235, 235, 235, 255], (y * W + xx) * 4);
      }
    }
  }
  return data;
}

// 소실점(128, 90)으로 모이는 좌/우 차선
const LEFT = { x0: 40, y0: H - 1, x1: 120, y1: 100 };
const RIGHT = { x0: 216, y0: H - 1, x1: 136, y1: 100 };

describe('detectLanes', () => {
  it('finds left and right lane boundaries converging ahead', () => {
    const r = detectLanes(frame([LEFT, RIGHT]), W, H, 0.5);
    expect(r.left).not.toBeNull();
    expect(r.right).not.toBeNull();
    expect(r.left!.slope).toBeLessThan(0);
    expect(r.right!.slope).toBeGreaterThan(0);
    // 영상 아래쪽 위치가 그린 선 부근이어야 함 (정규화 오차 0.04 이내)
    expect(Math.abs(r.left!.bottomX - 40 / W)).toBeLessThan(0.04);
    expect(Math.abs(r.right!.bottomX - 216 / W)).toBeLessThan(0.04);
    const expectedSlope = ((120 - 40) / W / ((100 - (H - 1)) / H)) as number;
    expect(Math.abs(r.left!.slope - expectedSlope)).toBeLessThan(0.1);
  });

  it('reports only the side that is visible', () => {
    const r = detectLanes(frame([RIGHT]), W, H, 0.5);
    expect(r.left).toBeNull();
    expect(r.right).not.toBeNull();
  });

  it('ignores a plain road and near-horizontal edges', () => {
    expect(detectLanes(frame([]), W, H, 0.5)).toMatchObject({ left: null, right: null });
    const horizontal = detectLanes(
      frame([
        { x0: 0, y0: 150, x1: W - 1, y1: 150 },
        { x0: 0, y0: 120, x1: W - 1, y1: 128 },
      ]),
      W,
      H,
      0.5,
    );
    expect(horizontal).toMatchObject({ left: null, right: null });
  });

  it('ignores lines above the region of interest (sky, buildings)', () => {
    // 관심 영역(0.6) 위에만 있는 직선
    const r = detectLanes(frame([{ x0: 30, y0: 110, x1: 90, y1: 0 }]), W, H, 0.6);
    expect(r).toMatchObject({ left: null, right: null });
  });
});

describe('roiTopFor', () => {
  it('uses the horizon from camera pitch and clamps to a sane range', () => {
    expect(roiTopFor(0, 0.9)).toBeCloseTo(0.54, 5);
    // 아래를 볼수록 지평선이 위로 올라가 관심 영역도 위에서 시작
    expect(roiTopFor(10 * DEG, 0.9)).toBeLessThan(roiTopFor(0, 0.9));
    expect(roiTopFor(80 * DEG, 0.9)).toBe(0.3);
    expect(roiTopFor(-80 * DEG, 0.9)).toBe(0.8);
    expect(roiTopFor(null, null)).toBe(0.5);
  });
});

describe('LaneTracker', () => {
  const det = (bottomX: number | null, slope = -0.5): LaneDetection => ({
    left: bottomX == null ? null : { side: 'left', bottomX, slope, confidence: 0.6 },
    right: null,
    roiTop: 0.5,
  });

  it('shows a lane only after it is seen in consecutive frames', () => {
    const t = new LaneTracker({ minHits: 2 });
    expect(t.update(det(0.2), 0).left).toBeNull();
    const s = t.update(det(0.21), 100);
    expect(s.left).not.toBeNull();
    expect(s.left!.bottom.y).toBe(1);
    expect(s.left!.top.y).toBeCloseTo(0.5, 5);
  });

  it('holds a lane briefly when it is missed, then drops it', () => {
    const t = new LaneTracker({ minHits: 1, holdMs: 500 });
    t.update(det(0.2), 0);
    expect(t.update(det(null), 300).left).not.toBeNull();
    expect(t.update(det(null), 800).left).toBeNull();
  });

  it('treats a large jump as a new candidate instead of snapping to it', () => {
    const t = new LaneTracker({ minHits: 2, maxJump: 0.1 });
    t.update(det(0.2), 0);
    t.update(det(0.2), 100);
    expect(t.update(det(0.6), 200).left).toBeNull();
    expect(t.update(det(0.6), 300).left!.bottom.x).toBeCloseTo(0.6, 5);
  });

  it('smooths small changes', () => {
    const t = new LaneTracker({ minHits: 1, smoothing: 0.5 });
    t.update(det(0.2), 0);
    expect(t.update(det(0.3), 100).left!.bottom.x).toBeCloseTo(0.25, 5);
  });

  it('stops both lines at their crossing point and drops crossed pairs', () => {
    const t = new LaneTracker({ minHits: 1 });
    const s = t.update(
      {
        left: { side: 'left', bottomX: 0.2, slope: -0.8, confidence: 0.5 },
        right: { side: 'right', bottomX: 0.8, slope: 0.8, confidence: 0.5 },
        roiTop: 0.3,
      },
      0,
    );
    // 교차점 y = 1 + 0.6 / (−1.6) = 0.625
    expect(s.left!.top.y).toBeCloseTo(0.635, 3);
    expect(s.right!.top.y).toBeCloseTo(0.635, 3);

    const crossed = new LaneTracker({ minHits: 1 }).update(
      {
        left: { side: 'left', bottomX: 0.7, slope: -0.3, confidence: 0.3 },
        right: { side: 'right', bottomX: 0.4, slope: 0.3, confidence: 0.6 },
        roiTop: 0.5,
      },
      0,
    );
    expect(crossed.left).toBeNull();
    expect(crossed.right).not.toBeNull();
  });
});

describe('lane ground projection', () => {
  const K = computeIntrinsics({ hfovLongDeg: 68 }, 640, 480);
  const h = 1.3;

  it('projects image points below the horizon onto the floor ahead', () => {
    const p = imageToGround(0.5, 1, K, h, 0)!;
    // 피치 0: 영상 아래 가장자리 광선의 바닥 거리 = h · fy / (height/2)
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(-(h * K.fy) / 240, 5);
    expect(imageToGround(0.5, 0.4, K, h, 0)).toBeNull();
  });

  it('maps a lane through the vanishing point to a line parallel to the view direction', () => {
    // 영상 중심(소실점)으로 모이는 직선 = 바닥에서 X 가 일정한 직선
    const seg = laneToGround(
      { side: 'left', bottom: { x: 0.1, y: 1 }, top: { x: 0.42, y: 0.6 }, confidence: 1 },
      K,
      h,
      0,
    )!;
    expect(seg).not.toBeNull();
    expect(seg.far.x).toBeCloseTo(seg.near.x, 5);
    expect(seg.near.x).toBeLessThan(0);
    expect(seg.far.z).toBeLessThan(seg.near.z);
  });

  it('clips the far end at the maximum distance', () => {
    const seg = laneToGround(
      { side: 'left', bottom: { x: 0.2, y: 1 }, top: { x: 0.5, y: 0.5 }, confidence: 1 },
      K,
      h,
      0,
      20,
    )!;
    expect(Math.hypot(seg.far.x, seg.far.z)).toBeLessThanOrEqual(20);
    expect(Math.hypot(seg.far.x, seg.far.z)).toBeGreaterThan(19);
  });
});
