import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CameraProfile, ClassCalibration, InstanceCalibration } from '../../types';

/**
 * IndexedDB 영속 저장소
 *
 * 저장 범위:
 *  - cameraProfiles       : 카메라(렌즈) 장치별 보정 프로파일
 *  - classCalibrations    : 객체 클래스별 기본 보정값 (예: 모든 컵)
 *  - instanceCalibrations : 특정 물리 객체 하나의 개별 보정값 (재실행 후 수동 연결 필요)
 *  - settings             : 앱 설정(선택한 카메라, 모델 등)
 *
 * "현재 추적 중인 객체의 임시 보정값"은 의도적으로 저장하지 않습니다(메모리 전용).
 */
interface MovDB extends DBSchema {
  cameraProfiles: { key: string; value: CameraProfile };
  classCalibrations: { key: string; value: ClassCalibration };
  instanceCalibrations: { key: string; value: InstanceCalibration; indexes: { byClass: string } };
  settings: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = 'mind-of-vision';
const DB_VERSION = 1;

export class StorageError extends Error {
  constructor(
    message: string,
    readonly kind: 'quota' | 'unavailable' | 'unknown',
  ) {
    super(message);
  }
}

function wrapError(e: unknown): StorageError {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'QuotaExceededError') return new StorageError('브라우저 저장 공간이 부족합니다.', 'quota');
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'UnknownError')
    return new StorageError('브라우저 저장소를 사용할 수 없습니다(개인정보 보호 모드 등).', 'unavailable');
  return new StorageError(`저장 실패: ${(e as Error)?.message ?? String(e)}`, 'unknown');
}

export interface StoredData {
  profiles: CameraProfile[];
  classCalibrations: ClassCalibration[];
  instanceCalibrations: InstanceCalibration[];
  settings: Record<string, unknown>;
}

export class CalibrationStorage {
  private dbPromise: Promise<IDBPDatabase<MovDB>> | null = null;

  private db(): Promise<IDBPDatabase<MovDB>> {
    if (!this.dbPromise) {
      if (typeof indexedDB === 'undefined') {
        return Promise.reject(new StorageError('이 브라우저는 IndexedDB 를 지원하지 않습니다.', 'unavailable'));
      }
      this.dbPromise = openDB<MovDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          db.createObjectStore('cameraProfiles', { keyPath: 'id' });
          db.createObjectStore('classCalibrations', { keyPath: 'id' });
          const inst = db.createObjectStore('instanceCalibrations', { keyPath: 'id' });
          inst.createIndex('byClass', 'classId');
          db.createObjectStore('settings', { keyPath: 'key' });
        },
      }).catch((e) => {
        this.dbPromise = null;
        throw wrapError(e);
      });
    }
    return this.dbPromise;
  }

  async loadAll(): Promise<StoredData> {
    try {
      const db = await this.db();
      const [profiles, classCalibrations, instanceCalibrations, settingsRows] = await Promise.all([
        db.getAll('cameraProfiles'),
        db.getAll('classCalibrations'),
        db.getAll('instanceCalibrations'),
        db.getAll('settings'),
      ]);
      return {
        profiles,
        classCalibrations,
        instanceCalibrations,
        settings: Object.fromEntries(settingsRows.map((r) => [r.key, r.value])),
      };
    } catch (e) {
      throw e instanceof StorageError ? e : wrapError(e);
    }
  }

  private async run<T>(fn: (db: IDBPDatabase<MovDB>) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.db());
    } catch (e) {
      throw e instanceof StorageError ? e : wrapError(e);
    }
  }

  putProfile(p: CameraProfile) {
    return this.run((db) => db.put('cameraProfiles', p));
  }
  deleteProfile(id: string) {
    return this.run((db) => db.delete('cameraProfiles', id));
  }
  putClassCalibration(c: ClassCalibration) {
    return this.run((db) => db.put('classCalibrations', c));
  }
  deleteClassCalibration(id: string) {
    return this.run((db) => db.delete('classCalibrations', id));
  }
  putInstanceCalibration(c: InstanceCalibration) {
    return this.run((db) => db.put('instanceCalibrations', c));
  }
  deleteInstanceCalibration(id: string) {
    return this.run((db) => db.delete('instanceCalibrations', id));
  }
  loadSettings(): Promise<Record<string, unknown>> {
    return this.run(async (db) => {
      const rows = await db.getAll('settings');
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    });
  }
  putSetting(key: string, value: unknown) {
    return this.run((db) => db.put('settings', { key, value }));
  }
  clearAll() {
    return this.run(async (db) => {
      const tx = db.transaction(['cameraProfiles', 'classCalibrations', 'instanceCalibrations'], 'readwrite');
      await Promise.all([
        tx.objectStore('cameraProfiles').clear(),
        tx.objectStore('classCalibrations').clear(),
        tx.objectStore('instanceCalibrations').clear(),
        tx.done,
      ]);
    });
  }

  /** 테스트용: 연결 종료 */
  async close() {
    if (this.dbPromise) (await this.dbPromise).close();
    this.dbPromise = null;
  }
}

export const calibrationStorage = new CalibrationStorage();
