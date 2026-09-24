import { create } from 'zustand';
import type {
  AppearanceSignature,
  CalibrationScope,
  CalibrationValues,
  CameraProfile,
  ClassCalibration,
  InstanceCalibration,
} from '../types';
import { calibrationStorage } from '../features/calibration/CalibrationStorage';
import {
  classCalibrationId,
  cleanValues,
  isEmptyValues,
  newInstanceId,
  validateCalibrationValues,
  validateProfile,
} from '../features/calibration/CalibrationManager';

export interface SaveResult {
  ok: boolean;
  /** 영구 저장소 기록 성공 여부 (false면 이번 실행에만 적용) */
  persisted: boolean;
  error?: string;
}

/** 입력 중(저장 전) 미리보기 값 */
export interface CalibrationDraft {
  trackId: string;
  scope: CalibrationScope;
  values: CalibrationValues;
}

interface CalibrationState {
  loaded: boolean;
  loadError: string | null;
  profiles: Record<string, CameraProfile>;
  classCals: Record<string, ClassCalibration>;
  instances: Record<string, InstanceCalibration>;
  /** 추적 ID → 임시 보정값 (메모리 전용) */
  session: Record<string, CalibrationValues>;
  /** 추적 ID → 연결된 개별 보정 ID (메모리 전용, 재실행 시 사라짐) */
  bindings: Record<string, string>;
  draft: CalibrationDraft | null;

  load(): Promise<void>;
  saveProfile(profile: CameraProfile): Promise<SaveResult>;
  resetProfile(profileId: string): Promise<SaveResult>;
  saveClass(classId: string, values: CalibrationValues): Promise<SaveResult>;
  deleteClass(classId: string): Promise<SaveResult>;
  saveInstance(args: {
    trackId: string | null;
    instanceId?: string | null;
    classId: string;
    name: string;
    values: CalibrationValues;
    cameraKey: string | null;
    appearance: AppearanceSignature | null;
  }): Promise<SaveResult & { id?: string }>;
  renameInstance(id: string, name: string): Promise<SaveResult>;
  deleteInstance(id: string): Promise<SaveResult>;
  bind(trackId: string, instanceId: string): void;
  unbind(trackId: string): void;
  setSession(trackId: string, values: CalibrationValues): SaveResult;
  clearSession(trackId: string): void;
  setDraft(draft: CalibrationDraft | null): void;
  /** 더 이상 존재하지 않는 추적 ID 의 임시 보정/연결 정리 */
  pruneTracks(activeIds: Set<string>): void;
  clearAll(): Promise<SaveResult>;
}

function firstError(errors: Record<string, string | undefined>): string | null {
  const e = Object.entries(errors).find(([, v]) => v);
  return e ? `${e[0]}: ${e[1]}` : null;
}

async function persist(fn: () => Promise<unknown>): Promise<SaveResult> {
  try {
    await fn();
    return { ok: true, persisted: true };
  } catch (e) {
    return { ok: true, persisted: false, error: (e as Error).message };
  }
}

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  loaded: false,
  loadError: null,
  profiles: {},
  classCals: {},
  instances: {},
  session: {},
  bindings: {},
  draft: null,

  async load() {
    try {
      const data = await calibrationStorage.loadAll();
      set({
        loaded: true,
        loadError: null,
        profiles: Object.fromEntries(data.profiles.map((p) => [p.id, p])),
        classCals: Object.fromEntries(data.classCalibrations.map((c) => [c.id, c])),
        instances: Object.fromEntries(data.instanceCalibrations.map((c) => [c.id, c])),
      });
    } catch (e) {
      set({ loaded: true, loadError: (e as Error).message });
    }
  },

  async saveProfile(profile) {
    const err = firstError(validateProfile(profile));
    if (err) return { ok: false, persisted: false, error: err };
    const next: CameraProfile = { ...profile, userDefined: true, updatedAt: Date.now() };
    set((s) => ({ profiles: { ...s.profiles, [next.id]: next } }));
    return persist(() => calibrationStorage.putProfile(next));
  },

  async resetProfile(profileId) {
    set((s) => {
      const profiles = { ...s.profiles };
      delete profiles[profileId];
      return { profiles };
    });
    return persist(() => calibrationStorage.deleteProfile(profileId));
  },

  async saveClass(classId, values) {
    const clean = cleanValues(values);
    const err = firstError(validateCalibrationValues(clean));
    if (err) return { ok: false, persisted: false, error: err };
    const id = classCalibrationId(classId);
    if (isEmptyValues(clean)) return get().deleteClass(classId);
    const rec: ClassCalibration = { id, classId, values: clean, updatedAt: Date.now() };
    set((s) => ({ classCals: { ...s.classCals, [id]: rec } }));
    return persist(() => calibrationStorage.putClassCalibration(rec));
  },

  async deleteClass(classId) {
    const id = classCalibrationId(classId);
    set((s) => {
      const classCals = { ...s.classCals };
      delete classCals[id];
      return { classCals };
    });
    return persist(() => calibrationStorage.deleteClassCalibration(id));
  },

  async saveInstance({ trackId, instanceId, classId, name, values, cameraKey, appearance }) {
    const clean = cleanValues(values);
    const err = firstError(validateCalibrationValues(clean));
    if (err) return { ok: false, persisted: false, error: err };
    const existing = instanceId ? get().instances[instanceId] : undefined;
    // 다른 클래스의 개별 보정에 덮어쓰지 않도록 방지
    if (existing && existing.classId !== classId) {
      return { ok: false, persisted: false, error: '다른 종류의 객체에 연결된 보정값입니다.' };
    }
    const now = Date.now();
    const rec: InstanceCalibration = {
      id: existing?.id ?? newInstanceId(),
      classId,
      name: name.trim() || existing?.name || classId,
      values: clean,
      cameraKey: cameraKey ?? existing?.cameraKey ?? null,
      appearance: appearance ?? existing?.appearance ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    set((s) => ({
      instances: { ...s.instances, [rec.id]: rec },
      bindings: trackId ? { ...s.bindings, [trackId]: rec.id } : s.bindings,
    }));
    const r = await persist(() => calibrationStorage.putInstanceCalibration(rec));
    return { ...r, id: rec.id };
  },

  async renameInstance(id, name) {
    const existing = get().instances[id];
    if (!existing) return { ok: false, persisted: false, error: '존재하지 않는 보정값' };
    const rec = { ...existing, name: name.trim() || existing.name, updatedAt: Date.now() };
    set((s) => ({ instances: { ...s.instances, [id]: rec } }));
    return persist(() => calibrationStorage.putInstanceCalibration(rec));
  },

  async deleteInstance(id) {
    set((s) => {
      const instances = { ...s.instances };
      delete instances[id];
      const bindings = Object.fromEntries(Object.entries(s.bindings).filter(([, v]) => v !== id));
      return { instances, bindings };
    });
    return persist(() => calibrationStorage.deleteInstanceCalibration(id));
  },

  bind(trackId, instanceId) {
    const inst = get().instances[instanceId];
    if (!inst) return;
    set((s) => ({ bindings: { ...s.bindings, [trackId]: instanceId } }));
  },

  unbind(trackId) {
    set((s) => {
      const bindings = { ...s.bindings };
      delete bindings[trackId];
      return { bindings };
    });
  },

  setSession(trackId, values) {
    const clean = cleanValues(values);
    const err = firstError(validateCalibrationValues(clean));
    if (err) return { ok: false, persisted: false, error: err };
    set((s) => {
      const session = { ...s.session };
      if (isEmptyValues(clean)) delete session[trackId];
      else session[trackId] = clean;
      return { session };
    });
    return { ok: true, persisted: false };
  },

  clearSession(trackId) {
    set((s) => {
      const session = { ...s.session };
      delete session[trackId];
      return { session };
    });
  },

  setDraft(draft) {
    set({ draft });
  },

  pruneTracks(activeIds) {
    const s = get();
    const staleSession = Object.keys(s.session).filter((id) => !activeIds.has(id));
    const staleBindings = Object.keys(s.bindings).filter((id) => !activeIds.has(id));
    const staleDraft = s.draft && !activeIds.has(s.draft.trackId);
    if (!staleSession.length && !staleBindings.length && !staleDraft) return;
    const session = { ...s.session };
    staleSession.forEach((id) => delete session[id]);
    const bindings = { ...s.bindings };
    staleBindings.forEach((id) => delete bindings[id]);
    set({ session, bindings, draft: staleDraft ? null : s.draft });
  },

  async clearAll() {
    set({ profiles: {}, classCals: {}, instances: {}, session: {}, bindings: {}, draft: null });
    return persist(() => calibrationStorage.clearAll());
  },
}));
