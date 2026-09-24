import { beforeEach, describe, expect, it } from 'vitest';
import { CalibrationStorage, calibrationStorage } from '../../src/features/calibration/CalibrationStorage';
import { useCalibrationStore } from '../../src/stores/calibrationStore';
import type { CameraProfile } from '../../src/types';

const profile = (deviceId: string, hfov: number): CameraProfile => ({
  id: `cam:${deviceId}`,
  deviceId,
  label: deviceId,
  hfovLongDeg: hfov,
  cameraHeight: 1.3,
  distanceScale: 1,
  pitchDeg: 0,
  useDeviceTilt: false,
  userDefined: true,
  updatedAt: 0,
});

describe('CalibrationStorage (IndexedDB)', () => {
  beforeEach(async () => {
    await calibrationStorage.clearAll();
    useCalibrationStore.setState({
      profiles: {},
      classCals: {},
      instances: {},
      session: {},
      bindings: {},
      draft: null,
    });
  });

  it('persists and reloads data in a fresh connection (simulated app restart)', async () => {
    const store = useCalibrationStore.getState();
    await store.saveClass('cup', { realHeight: 0.12 });
    const saved = await store.saveInstance({
      trackId: 'trk-1',
      classId: 'cup',
      name: '내 컵',
      values: { measuredDistance: 1.5, referenceRawDistance: 1.2 },
      cameraKey: 'cam-a',
      appearance: null,
    });
    await store.saveProfile(profile('cam-a', 70));
    expect(saved.persisted).toBe(true);

    const fresh = new CalibrationStorage();
    const data = await fresh.loadAll();
    expect(data.classCalibrations[0].values.realHeight).toBe(0.12);
    expect(data.instanceCalibrations[0].name).toBe('내 컵');
    expect(data.profiles[0].hfovLongDeg).toBe(70);
    await fresh.close();
  });

  it('after reload, instance calibrations are NOT auto-bound to any track', async () => {
    const store = useCalibrationStore.getState();
    await store.saveInstance({
      trackId: 'trk-9',
      classId: 'cup',
      name: 'a',
      values: { offsetX: 0.1 },
      cameraKey: null,
      appearance: null,
    });
    useCalibrationStore.setState({ instances: {}, bindings: {} });
    await useCalibrationStore.getState().load();
    expect(Object.keys(useCalibrationStore.getState().instances)).toHaveLength(1);
    expect(useCalibrationStore.getState().bindings).toEqual({});
  });

  it('invalid values are rejected and do not overwrite a valid saved value', async () => {
    const store = useCalibrationStore.getState();
    await store.saveClass('chair', { realHeight: 0.9 });
    const bad = await store.saveClass('chair', { realHeight: -1 });
    expect(bad.ok).toBe(false);
    expect(useCalibrationStore.getState().classCals['class:chair'].values.realHeight).toBe(0.9);
    const data = await calibrationStorage.loadAll();
    expect(data.classCalibrations.find((c) => c.classId === 'chair')!.values.realHeight).toBe(0.9);
  });

  it('camera profiles are independent per device', async () => {
    const store = useCalibrationStore.getState();
    await store.saveProfile(profile('wide', 70));
    await store.saveProfile(profile('ultra', 110));
    await store.resetProfile('cam:wide');
    const s = useCalibrationStore.getState();
    expect(s.profiles['cam:wide']).toBeUndefined();
    expect(s.profiles['cam:ultra'].hfovLongDeg).toBe(110);
  });

  it('deleting a class calibration only affects that class', async () => {
    const store = useCalibrationStore.getState();
    await store.saveClass('cup', { realHeight: 0.1 });
    await store.saveClass('bottle', { realHeight: 0.3 });
    await store.deleteClass('cup');
    const s = useCalibrationStore.getState();
    expect(s.classCals['class:cup']).toBeUndefined();
    expect(s.classCals['class:bottle']).toBeDefined();
  });

  it('refuses to save an instance calibration onto a different class', async () => {
    const store = useCalibrationStore.getState();
    const r = await store.saveInstance({
      trackId: 't1',
      classId: 'cup',
      name: 'c',
      values: { offsetX: 1 },
      cameraKey: null,
      appearance: null,
    });
    const bad = await store.saveInstance({
      trackId: 't2',
      instanceId: r.id,
      classId: 'bottle',
      name: 'b',
      values: { offsetX: 2 },
      cameraKey: null,
      appearance: null,
    });
    expect(bad.ok).toBe(false);
    expect(useCalibrationStore.getState().instances[r.id!].values.offsetX).toBe(1);
  });

  it('session calibrations are memory-only and pruned with their track', () => {
    const store = useCalibrationStore.getState();
    store.setSession('trk-5', { offsetZ: 0.5 });
    store.bind('trk-5', 'missing'); // 존재하지 않는 인스턴스는 연결되지 않음
    expect(useCalibrationStore.getState().bindings['trk-5']).toBeUndefined();
    useCalibrationStore.getState().pruneTracks(new Set(['trk-6']));
    expect(useCalibrationStore.getState().session['trk-5']).toBeUndefined();
  });
});
