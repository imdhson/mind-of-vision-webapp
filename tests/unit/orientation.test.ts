import { describe,it,expect } from 'vitest';
import { estimateOrientation } from '@/features/orientation/OrientationEstimator';
const base:any={id:'x',className:'person',score:.9,bbox:{x:0,y:0,width:1,height:1},createdAt:0,lastSeen:0,misses:0};
describe('orientation',()=>{it('marks stationary as unknown',()=>expect(estimateOrientation({...base,velocity:{x:.1,y:.1}}).yawRad).toBeNull());it('detects movement',()=>expect(estimateOrientation({...base,velocity:{x:5,y:0}}).moving).toBe(true))});
