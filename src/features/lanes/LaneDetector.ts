/**
 * 차선(도로 경계) 인식 — 추가 AI 모델 없이 고전적인 영상 처리로 동작합니다.
 *
 *  축소 프레임 → 명암 → 가벼운 흐림 → Sobel 경계 → 관심 영역(지평선 아래) → Hough 직선 → 좌/우 경계 선택
 *
 * - 관심 영역은 카메라 기울기(피치)로 계산한 지평선 아래만 사용합니다(하늘·건물 등 제외).
 * - 거의 수평인 경계(그림자·연석 윗면·보도블록 이음새 등)는 제외합니다.
 * - 영상 좌표계에서 위로 갈수록 오른쪽으로 기우는 직선은 왼쪽 경계, 왼쪽으로 기우는 직선은 오른쪽 경계입니다.
 * - 결과는 정규화 영상 좌표(0..1)로 표현합니다. 직선은 x = bottomX + slope·(y − 1) (slope = dx/dy).
 */
export type LaneSide = 'left' | 'right';

export interface LaneCandidate {
  side: LaneSide;
  /** 영상 맨 아래(y=1)에서의 x (정규화, 영상 밖일 수 있음) */
  bottomX: number;
  /** dx/dy (정규화 좌표). 왼쪽 경계는 음수, 오른쪽 경계는 양수 */
  slope: number;
  /** 0..1 — 관심 영역 높이 대비 직선 위 경계 화소 비율 */
  confidence: number;
}

export interface LaneDetection {
  left: LaneCandidate | null;
  right: LaneCandidate | null;
  /** 관심 영역 시작(정규화 y) */
  roiTop: number;
}

export interface LaneDetectorConfig {
  /** 수평선으로부터 이 각도(°) 미만으로 기운 직선은 제외 */
  minAngleDeg: number;
  /** Hough 각도 간격(°) */
  thetaStepDeg: number;
  /** 경계 화소로 인정할 최소 기울기 크기 */
  minEdgeMagnitude: number;
  /** 관심 영역에서 경계로 남길 상위 비율 (적응형 임계값) */
  edgeFraction: number;
  /** 관심 영역 높이 대비 최소 투표 비율 */
  minVoteRatio: number;
}

export const DEFAULT_LANE_DETECTOR_CONFIG: LaneDetectorConfig = {
  minAngleDeg: 20,
  thetaStepDeg: 2,
  minEdgeMagnitude: 60,
  edgeFraction: 0.07,
  minVoteRatio: 0.3,
};

/** 지평선 아래로 이만큼(정규화) 떨어진 곳부터 관심 영역 */
const HORIZON_MARGIN = 0.04;
const MIN_ROI_TOP = 0.3;
const MAX_ROI_TOP = 0.8;

/**
 * 카메라 피치(rad, +는 아래를 봄)와 초점거리로 지평선 위치(정규화 y)를 계산해 관심 영역 시작점을 정합니다.
 * @param fyOverHeight fy / 영상 높이
 */
export function roiTopFor(pitch: number | null, fyOverHeight: number | null): number {
  if (pitch == null || fyOverHeight == null || !Number.isFinite(pitch) || !Number.isFinite(fyOverHeight)) return 0.5;
  const horizon = 0.5 - fyOverHeight * Math.tan(pitch);
  return Math.min(MAX_ROI_TOP, Math.max(MIN_ROI_TOP, horizon + HORIZON_MARGIN));
}

/**
 * RGBA 프레임에서 좌/우 차선(도로 경계) 직선을 찾습니다.
 * @param data RGBA 화소 (ImageData.data)
 */
export function detectLanes(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiTop: number,
  config: LaneDetectorConfig = DEFAULT_LANE_DETECTOR_CONFIG,
): LaneDetection {
  const y0 = Math.max(1, Math.min(height - 2, Math.floor(roiTop * height)));
  const empty: LaneDetection = { left: null, right: null, roiTop: y0 / height };
  if (width < 8 || height - y0 < 8) return empty;

  // 1) 명암 + 3×3 평균 흐림 (관심 영역과 경계 1줄만)
  const gray = new Float32Array(width * height);
  for (let y = y0 - 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      gray[y * width + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  const blur = new Float32Array(width * height);
  for (let y = y0; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const r = (y + dy) * width + x;
        s += gray[r - 1] + gray[r] + gray[r + 1];
      }
      blur[y * width + x] = s / 9;
    }
  }

  // 2) Sobel 경계. 거의 수평인 경계(기울기 방향이 거의 수직)는 제외
  const minGxRatio = Math.tan(config.minAngleDeg * (Math.PI / 180));
  const mag = new Float32Array(width * height);
  const values: number[] = [];
  for (let y = y0 + 1; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x;
      const gx =
        blur[i - width + 1] +
        2 * blur[i + 1] +
        blur[i + width + 1] -
        blur[i - width - 1] -
        2 * blur[i - 1] -
        blur[i + width - 1];
      const gy =
        blur[i + width - 1] +
        2 * blur[i + width] +
        blur[i + width + 1] -
        blur[i - width - 1] -
        2 * blur[i - width] -
        blur[i - width + 1];
      const m = Math.hypot(gx, gy);
      if (m < config.minEdgeMagnitude || Math.abs(gx) < Math.abs(gy) * minGxRatio) continue;
      mag[i] = m;
      values.push(m);
    }
  }
  if (values.length === 0) return empty;

  // 3) 적응형 임계값: 관심 영역 화소 중 상위 edgeFraction 만 경계로 사용 (잔디·아스팔트 질감 잡음 억제)
  const roiPixels = (height - y0) * width;
  const keep = Math.max(1, Math.floor(roiPixels * config.edgeFraction));
  let threshold = config.minEdgeMagnitude;
  if (values.length > keep) {
    values.sort((a, b) => b - a);
    threshold = Math.max(threshold, values[keep - 1]);
  }

  // 4) Hough 변환 (rho = x·cosθ + y·sinθ). 수평에 가까운 θ(≈90°)는 제외
  const thetas: number[] = [];
  for (let deg = 0; deg < 180; deg += config.thetaStepDeg) {
    if (Math.abs(deg - 90) >= 90 - config.minAngleDeg) continue;
    thetas.push(deg);
  }
  const cos = thetas.map((d) => Math.cos((d * Math.PI) / 180));
  const sin = thetas.map((d) => Math.sin((d * Math.PI) / 180));
  const diag = Math.ceil(Math.hypot(width, height));
  const nRho = diag * 2 + 1;
  const acc = new Uint16Array(thetas.length * nRho);
  for (let y = y0 + 1; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (mag[y * width + x] < threshold) continue;
      for (let t = 0; t < thetas.length; t++) {
        const rho = Math.round(x * cos[t] + y * sin[t]) + diag;
        acc[t * nRho + rho]++;
      }
    }
  }

  // 5) 좌/우 각각 가장 많은 표를 받은 직선
  const roiH = height - y0;
  const minVotes = Math.max(8, Math.round(roiH * config.minVoteRatio));
  const best: Record<LaneSide, { votes: number; t: number; rho: number } | null> = { left: null, right: null };
  for (let t = 0; t < thetas.length; t++) {
    for (let r = 0; r < nRho; r++) {
      const votes = acc[t * nRho + r];
      if (votes < minVotes) continue;
      const rho = r - diag;
      const side = sideOf(thetas[t], cos[t], sin[t], rho, width, height);
      if (!side) continue;
      const cur = best[side];
      if (!cur || votes > cur.votes) best[side] = { votes, t, rho };
    }
  }

  const toCandidate = (side: LaneSide): LaneCandidate | null => {
    const b = best[side];
    if (!b) return null;
    // x = (rho − y·sinθ) / cosθ  → 정규화
    const c = cos[b.t];
    const s = sin[b.t];
    const xBottomPx = (b.rho - height * s) / c;
    const slopePx = -s / c; // dx/dy (화소)
    return {
      side,
      bottomX: xBottomPx / width,
      slope: (slopePx * height) / width,
      confidence: Math.min(1, b.votes / roiH),
    };
  };
  return { left: toCandidate('left'), right: toCandidate('right'), roiTop: y0 / height };
}

/**
 * Hough 직선이 왼쪽 경계인지 오른쪽 경계인지 판정합니다.
 * θ=0 부근(수직선)은 기울기가 거의 없으므로 영상 아래쪽 위치로 판정합니다.
 */
function sideOf(deg: number, c: number, s: number, rho: number, width: number, height: number): LaneSide | null {
  if (Math.abs(c) < 1e-6) return null;
  const xBottom = (rho - height * s) / c;
  // 영상 아래에서 너무 멀리 벗어난 직선은 제외 (영상 폭의 1배 이상 바깥)
  if (xBottom < -width || xBottom > 2 * width) return null;
  const slope = -s / c;
  if (Math.abs(slope) < 0.05 || deg === 0) return xBottom < width / 2 ? 'left' : 'right';
  if (slope < 0) return xBottom < width * 0.75 ? 'left' : null;
  return xBottom > width * 0.25 ? 'right' : null;
}
