import type { CalibrationRecord, CalibrationValues, SpatialObject } from '@/types';
import { deleteCalibrationRecord, listCalibrationRecords, putCalibrationRecord } from './CalibrationStorage';
import { degToRad } from '@/utils/math';

export class CalibrationManager {
  records: CalibrationRecord[] = [];
  temp = new Map<string, CalibrationValues>();
  async init() { this.records = await listCalibrationRecords(); }
  validate(v: CalibrationValues) {
    const checks: [keyof CalibrationValues, number, number][] = [
      ['actualDistance', 0.1, 100], ['distanceOffset', -20, 20], ['actualHeight', 0.01, 50], ['actualWidth', 0.01, 50],
      ['offsetX', -20, 20], ['offsetY', -20, 20], ['offsetZ', -20, 20], ['yawOffsetDeg', -180, 180]
    ];
    for (const [k, min, max] of checks) { const x = v[k]; if (x != null && (!Number.isFinite(x) || x < min || x > max)) throw new Error(`${k} 값이 허용 범위를 벗어났습니다.`); }
  }
  setTemp(objectId: string, values: CalibrationValues) { this.validate(values); this.temp.set(objectId, values); }
  clearTemp(objectId: string) { this.temp.delete(objectId); }
  async save(scope: 'object'|'class', key: string, className: string, values: CalibrationValues) {
    this.validate(values);
    const id = `${scope}:${key}`;
    const old = this.records.find((r) => r.id === id);
    const now = Date.now();
    const rec: CalibrationRecord = { id, scope, key, className, values, createdAt: old?.createdAt ?? now, updatedAt: now };
    await putCalibrationRecord(rec);
    this.records = this.records.filter((r) => r.id !== id).concat(rec);
  }
  async remove(id: string) { await deleteCalibrationRecord(id); this.records = this.records.filter((r) => r.id !== id); }
  resolve(objectId: string, className: string) {
    const temp = this.temp.get(objectId); if (temp) return { values: temp, source: 'temporary' as const };
    const individual = this.records.find((r) => r.scope === 'object' && r.key === objectId); if (individual) return { values: individual.values, source: 'object' as const };
    const cls = this.records.find((r) => r.scope === 'class' && r.key === className); if (cls) return { values: cls.values, source: 'class' as const };
    return { values: {} as CalibrationValues, source: undefined };
  }
  apply(obj: SpatialObject, values: CalibrationValues) {
    if (values.actualDistance != null) {
      const ratio = values.actualDistance / Math.max(0.01, obj.distanceM);
      obj.distanceM = values.actualDistance;
      obj.position.x *= ratio; obj.position.z *= ratio;
    } else if (values.distanceOffset != null) {
      const old = obj.distanceM; obj.distanceM = Math.max(0.1, old + values.distanceOffset);
      const ratio = obj.distanceM / Math.max(0.01, old); obj.position.x *= ratio; obj.position.z *= ratio;
    }
    obj.position.x += values.offsetX ?? 0; obj.position.y += values.offsetY ?? 0; obj.position.z += values.offsetZ ?? 0;
    if (values.actualHeight != null) obj.size.height = values.actualHeight;
    if (values.actualWidth != null) obj.size.width = values.actualWidth;
    if (values.yawOffsetDeg != null) obj.yawRad = (obj.yawRad ?? 0) + degToRad(values.yawOffsetDeg);
    return obj;
  }
}
