import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { SpatialObject } from '@/types';

// ⚡ Bolt Performance Optimization:
// Memoized the O(N) calculation of the furthest object's distance (`far`).
// This prevents running an array mapping and Math.hypot() calculation
// 60+ times per second in the useFrame loop. Instead, it recalculates
// only when the `objects` array changes (max 14fps from the vision pipeline).
export function AutoCameraController({ objects, enabled }: { objects: SpatialObject[]; enabled: boolean }) {
  const far = useMemo(() => {
    let maxDist = 5;
    // ⚡ Bolt Performance Optimization:
    // Using a for loop instead of `Math.max(5, ...objects.map(...))` prevents
    // intermediate array allocations, garbage collection pressure, and call stack
    // limits when calculating the maximum distance of spatial objects.
    for (let i = 0; i < objects.length; i++) {
      const dist = Math.hypot(objects[i].position.x, objects[i].position.z);
      if (dist > maxDist) {
        maxDist = dist;
      }
    }
    return maxDist;
  }, [objects]);

  useFrame(({ camera }) => {
    if (!enabled) return;
    const targetZ = Math.min(32, Math.max(8, far * 1.25 + 6));
    camera.position.z += (targetZ - camera.position.z) * 0.0018;
    camera.position.y += (Math.max(5, far * 0.32) - camera.position.y) * 0.0014;
    camera.lookAt(0, 0, -Math.min(8, far * 0.35));
  });
  return null;
}
