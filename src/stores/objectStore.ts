import { create } from 'zustand';
import type { PipelineStats, TrackedObject } from '../types';
import { TrailTracker, type TrailPoint } from '../features/visualization/TrailTracker';
import { EMPTY_LANES, type LaneScene } from '../features/lanes/laneGeometry';

export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error';

const trailTracker = new TrailTracker();

interface ObjectState {
  /** 공통 객체 상태 — 카메라 화면·3D·목록이 모두 이 값을 사용 */
  objects: Record<string, TrackedObject>;
  /** 표시 순서 (처음 인식된 순서 — 목록이 계속 뒤바뀌지 않도록 고정) */
  order: string[];
  selectedId: string | null;
  /** 선택한 객체의 추적이 종료되었을 때 안내용 */
  selectionEndedLabel: string | null;
  detectorStatus: DetectorStatus;
  detectorMessage: string | null;
  stats: PipelineStats;
  /** 객체별 최근 이동 궤적 (시각화 좌표 X/Z, 바닥 평면). 2개 미만의 점은 포함하지 않음 */
  trails: Record<string, TrailPoint[]>;
  /** 인식된 차선(도로 경계). 카메라 화면 오버레이와 3D 바닥에 함께 표시 */
  lanes: LaneScene;

  setObjects(list: TrackedObject[]): void;
  clearObjects(): void;
  setLanes(lanes: LaneScene): void;
  select(id: string | null): void;
  dismissSelectionEnded(): void;
  setDetector(status: DetectorStatus, message?: string | null): void;
  setStats(stats: Partial<PipelineStats>): void;
}

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export const useObjectStore = create<ObjectState>((set, get) => ({
  objects: {},
  order: [],
  selectedId: null,
  selectionEndedLabel: null,
  detectorStatus: 'idle',
  detectorMessage: null,
  stats: { backend: null, modelId: null, inferenceMs: 0, detectionFps: 0, lastFrameAt: 0 },
  trails: {},
  lanes: EMPTY_LANES,

  setObjects(list) {
    const objects: Record<string, TrackedObject> = {};
    for (const o of list) objects[o.id] = o;
    const order = [...list].sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.id.localeCompare(b.id)).map((o) => o.id);
    const prev = get();
    let { selectedId, selectionEndedLabel } = prev;
    if (selectedId && !objects[selectedId]) {
      selectionEndedLabel = prev.objects[selectedId]?.label ?? '선택한 객체';
      selectedId = null;
    }
    const active = list
      .filter((o) => o.position && o.trackingState !== 'lost')
      .map((o) => ({ id: o.id, x: o.position!.x, z: o.position!.z }));
    const trails = trailTracker.update(active, performance.now());
    set({
      objects,
      order: sameOrder(order, prev.order) ? prev.order : order,
      selectedId,
      selectionEndedLabel,
      trails,
    });
  },

  clearObjects() {
    trailTracker.reset();
    set({ objects: {}, order: [], selectedId: null, trails: {}, lanes: EMPTY_LANES });
  },

  setLanes(lanes) {
    // 둘 다 없으면 항상 EMPTY_LANES 로 통일: 없음 → 없음은 구독자에게 변경 알림을 보내지 않음
    const next = lanes.left || lanes.right ? lanes : EMPTY_LANES;
    if (next !== get().lanes) set({ lanes: next });
  },

  select(id) {
    set({ selectedId: id, selectionEndedLabel: null });
  },

  dismissSelectionEnded() {
    set({ selectionEndedLabel: null });
  },

  setDetector(status, message = null) {
    set({ detectorStatus: status, detectorMessage: message });
  },

  setStats(stats) {
    set((s) => ({ stats: { ...s.stats, ...stats } }));
  },
}));
