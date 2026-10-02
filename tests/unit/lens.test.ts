import { describe,it,expect } from 'vitest';
import { classifyLens } from '@/features/camera/CameraDeviceService';
describe('lens',()=>{it('identifies ultra-wide and telephoto',()=>{expect(classifyLens('Back Ultra Wide Camera')).toBe('ultrawide');expect(classifyLens('Rear Telephoto Camera')).toBe('telephoto')})});
