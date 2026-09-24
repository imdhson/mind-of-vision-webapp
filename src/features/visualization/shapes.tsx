import type { Material } from 'three';
import type { ShapeKind } from '../detection/classCatalog';

/**
 * 객체 종류별 간결한 기하학적 형상
 *
 * 모든 형상은 "단위 상자" 안에 만들어집니다: X[-0.5, 0.5] × Y[0, 1] × Z[-0.5, 0.5]
 * 부모 그룹의 scale(너비, 높이, 깊이)로 추정 크기에 맞춥니다.
 * 정면 방향: 가구·화면 등은 +Z, 몸체가 긴 객체(탈것·동물)는 +X (LONG_BODY 참고)
 */
export const LONG_BODY = new Set<ShapeKind>(['vehicle', 'twoWheeler', 'animal']);

type P = { m: Material };

function Box({ m, p, s }: P & { p: [number, number, number]; s: [number, number, number] }) {
  return (
    <mesh position={p} material={m} castShadow={false}>
      <boxGeometry args={s} />
    </mesh>
  );
}

function Cyl({
  m,
  p,
  r,
  r2,
  h,
  seg = 20,
}: P & { p: [number, number, number]; r: number; r2?: number; h: number; seg?: number }) {
  return (
    <mesh position={p} material={m}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
    </mesh>
  );
}

function Legs({ m, y0, y1, inset = 0.42, w = 0.07 }: P & { y0: number; y1: number; inset?: number; w?: number }) {
  const h = y1 - y0;
  const c = (y0 + y1) / 2;
  return (
    <>
      {[
        [-inset, inset],
        [inset, inset],
        [-inset, -inset],
        [inset, -inset],
      ].map(([x, z], i) => (
        <Box key={i} m={m} p={[x, c, z]} s={[w, h, w]} />
      ))}
    </>
  );
}

export function Shape({ kind, m }: { kind: ShapeKind; m: Material }) {
  switch (kind) {
    case 'person':
      return (
        <>
          <mesh position={[0, 0.41, 0]} material={m}>
            <capsuleGeometry args={[0.32, 0.5, 6, 16]} />
          </mesh>
          <mesh position={[0, 0.89, 0]} material={m}>
            <sphereGeometry args={[0.2, 20, 14]} />
          </mesh>
        </>
      );
    case 'chair':
      return (
        <>
          <Box m={m} p={[0, 0.49, 0.02]} s={[1, 0.07, 0.94]} />
          <Box m={m} p={[0, 0.76, -0.46]} s={[1, 0.5, 0.07]} />
          <Legs m={m} y0={0} y1={0.46} />
        </>
      );
    case 'couch':
      return (
        <>
          <Box m={m} p={[0, 0.25, 0.05]} s={[1, 0.3, 0.9]} />
          <Box m={m} p={[0, 0.62, -0.42]} s={[1, 0.6, 0.16]} />
          <Box m={m} p={[-0.47, 0.42, 0.05]} s={[0.06, 0.34, 0.9]} />
          <Box m={m} p={[0.47, 0.42, 0.05]} s={[0.06, 0.34, 0.9]} />
        </>
      );
    case 'bed':
      return (
        <>
          <Box m={m} p={[0, 0.5, 0.03]} s={[1, 0.45, 0.94]} />
          <Box m={m} p={[0, 0.55, -0.48]} s={[1, 1.1, 0.04]} />
          <Box m={m} p={[0, 0.14, 0.03]} s={[0.96, 0.28, 0.9]} />
        </>
      );
    case 'table':
      return (
        <>
          <Box m={m} p={[0, 0.96, 0]} s={[1, 0.07, 1]} />
          <Legs m={m} y0={0} y1={0.93} inset={0.44} w={0.05} />
        </>
      );
    case 'vehicle':
      return (
        <>
          <Box m={m} p={[0, 0.34, 0]} s={[1, 0.42, 1]} />
          <Box m={m} p={[-0.06, 0.73, 0]} s={[0.55, 0.36, 0.86]} />
          {[
            [0.32, 0.46],
            [-0.32, 0.46],
            [0.32, -0.46],
            [-0.32, -0.46],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.13, z]} rotation={[Math.PI / 2, 0, 0]} material={m}>
              <cylinderGeometry args={[0.13, 0.13, 0.08, 16]} />
            </mesh>
          ))}
        </>
      );
    case 'twoWheeler':
      return (
        <>
          {[0.32, -0.32].map((x, i) => (
            <mesh key={i} position={[x, 0.3, 0]} material={m}>
              <torusGeometry args={[0.18, 0.035, 8, 24]} />
            </mesh>
          ))}
          <Box m={m} p={[0, 0.5, 0]} s={[0.7, 0.05, 0.1]} />
          <Box m={m} p={[0.28, 0.72, 0]} s={[0.05, 0.4, 0.1]} />
          <Box m={m} p={[-0.12, 0.72, 0]} s={[0.2, 0.05, 0.3]} />
        </>
      );
    case 'animal':
      return (
        <>
          <mesh position={[-0.05, 0.58, 0]} scale={[0.42, 0.22, 0.36]} material={m}>
            <sphereGeometry args={[1, 18, 12]} />
          </mesh>
          <mesh position={[0.38, 0.8, 0]} scale={[0.14, 0.15, 0.24]} material={m}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          {[
            [0.2, 0.2],
            [0.2, -0.2],
            [-0.28, 0.2],
            [-0.28, -0.2],
          ].map(([x, z], i) => (
            <Box key={i} m={m} p={[x, 0.2, z]} s={[0.08, 0.4, 0.12]} />
          ))}
        </>
      );
    case 'screen':
      return (
        <>
          <Box m={m} p={[0, 0.55, 0]} s={[1, 0.9, 0.12]} />
          <Box m={m} p={[0, 0.05, 0]} s={[0.3, 0.1, 0.6]} />
        </>
      );
    case 'laptop':
      return (
        <>
          <Box m={m} p={[0, 0.04, 0.1]} s={[1, 0.08, 0.8]} />
          <mesh position={[0, 0.5, -0.3]} rotation={[-0.25, 0, 0]} material={m}>
            <boxGeometry args={[1, 0.9, 0.05]} />
          </mesh>
        </>
      );
    case 'bottle':
      return (
        <>
          <Cyl m={m} p={[0, 0.33, 0]} r={0.5} h={0.66} />
          <Cyl m={m} p={[0, 0.76, 0]} r={0.5} r2={0.2} h={0.2} />
          <Cyl m={m} p={[0, 0.93, 0]} r={0.2} h={0.14} />
        </>
      );
    case 'cup':
      return <Cyl m={m} p={[0, 0.5, 0]} r={0.42} r2={0.5} h={1} seg={24} />;
    case 'flat':
      return <Box m={m} p={[0, 0.5, 0]} s={[1, 1, 1]} />;
    case 'plant':
      return (
        <>
          <Cyl m={m} p={[0, 0.2, 0]} r={0.3} r2={0.38} h={0.4} />
          <mesh position={[0, 0.7, 0]} scale={[0.5, 0.32, 0.5]} material={m}>
            <sphereGeometry args={[1, 18, 12]} />
          </mesh>
        </>
      );
    case 'box':
    default:
      return <Box m={m} p={[0, 0.5, 0]} s={[1, 1, 1]} />;
  }
}
