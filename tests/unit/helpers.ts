import type { Detection, NormalizedBox } from '../../src/types';

export const box = (x: number, y: number, width: number, height: number): NormalizedBox => ({ x, y, width, height });

export const det = (classId: string, b: NormalizedBox, score = 0.9): Detection => ({ classId, score, box: b });
