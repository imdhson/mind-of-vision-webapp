import { useFrame } from '@react-three/fiber';
import type { SpatialObject } from '@/types';
export function AutoCameraController({ objects, enabled }: { objects: SpatialObject[]; enabled: boolean }) {
  useFrame(({ camera }) => {
    if (!enabled) return;
    const far = Math.max(5, ...objects.map((o) => Math.hypot(o.position.x, o.position.z)));
    const targetZ = Math.min(32, Math.max(8, far * 1.25 + 6));
    camera.position.z += (targetZ - camera.position.z) * 0.0018;
    camera.position.y += (Math.max(5, far * 0.32) - camera.position.y) * 0.0014;
    camera.lookAt(0, 0, -Math.min(8, far * 0.35));
  });
  return null;
}
