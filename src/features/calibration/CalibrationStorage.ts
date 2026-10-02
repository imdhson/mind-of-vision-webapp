import { openDB } from 'idb';
import type { CalibrationRecord } from '@/types';
const dbp = openDB('mind-of-vision', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('calibrations')) db.createObjectStore('calibrations', { keyPath: 'id' });
  }
});
export async function listCalibrationRecords(): Promise<CalibrationRecord[]> {
  return (await dbp).getAll('calibrations');
}
export async function putCalibrationRecord(record: CalibrationRecord) {
  return (await dbp).put('calibrations', record);
}
export async function deleteCalibrationRecord(id: string) {
  return (await dbp).delete('calibrations', id);
}
