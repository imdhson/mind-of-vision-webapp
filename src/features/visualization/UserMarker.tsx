import { DoubleSide } from 'three';
import type { ScenePalette } from './palette';

/**
 * 사용자(카메라) 위치 마커: 원형 디스크 + 외곽 링 + 카메라 시야 부채꼴(매우 연함)
 * 텍스트 라벨은 표시하지 않습니다.
 */
export function UserMarker({ palette, hfovRad }: { palette: ScenePalette; hfovRad: number | null }) {
  const fov = hfovRad && Number.isFinite(hfovRad) ? Math.min(hfovRad, Math.PI * 0.95) : null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={() => null}>
        <circleGeometry args={[0.2, 48]} />
        <meshBasicMaterial color={palette.user} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} raycast={() => null}>
        <ringGeometry args={[0.3, 0.335, 64]} />
        <meshBasicMaterial color={palette.userRing} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {fov ? (
        // 카메라 시야 방향(-Z)을 향한 부채꼴. circleGeometry 는 XY 평면에서 +X 기준 각도 → -π/2 회전 후 -Z 방향 중심
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
          <circleGeometry args={[2.2, 32, Math.PI / 2 - fov / 2, fov]} />
          <meshBasicMaterial color={palette.fov} transparent opacity={0.05} depthWrite={false} side={DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}
