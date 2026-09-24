import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Vector3 } from 'three';
import { useObjectStore } from '../../stores/objectStore';
import { dampFactor } from '../../utils/math';
import { AutoZoomController, homePose } from './AutoCameraController';
import { ObjectMesh } from './ObjectRenderer';
import { UserMarker } from './UserMarker';
import type { ScenePalette } from './palette';
import { getDebugBridge } from '../../services/debugBridge';

/**
 * Tesla 스타일 미니멀 3D 공간
 * - 원점 = 사용자(카메라) 바닥 위치, -Z = 카메라 전방 (src/types 좌표계 정의)
 * - 기본 시점에서는 AutoZoomController 가 매우 느리게 확대·축소
 * - 사용자가 조작(회전/줌/이동)을 시작하면 자동 조절 중지 → "기본 시점" 버튼으로 복귀
 */
export interface VisionSceneProps {
  active: boolean;
  palette: ScenePalette;
  hfovRad: number | null;
  autoMode: boolean;
  onUserInteract: () => void;
  /** 증가할 때마다 기본 시점으로 복귀 */
  resetToken: number;
}

export function VisionScene({ active, palette, hfovRad, autoMode, onUserInteract, resetToken }: VisionSceneProps) {
  const maxDpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const [dpr, setDpr] = useState(maxDpr);
  const pose = homePose(6);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 50, near: 0.05, far: 300, position: [pose.position.x, pose.position.y, pose.position.z] }}
      onPointerMissed={() => useObjectStore.getState().select(null)}
      data-testid="vision-canvas"
    >
      {/* 적응형 렌더링 해상도: 프레임 저하 시 DPR 을 낮추고, 여유가 생기면 다시 높임 */}
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={4}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
      />
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, 28, 80]} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight position={[4, 10, 6]} intensity={palette.key} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <Grid
        position={[0, 0, 0]}
        infiniteGrid
        cellSize={0.5}
        sectionSize={2.5}
        cellThickness={0.6}
        sectionThickness={0.9}
        cellColor={palette.gridCell}
        sectionColor={palette.gridSection}
        fadeDistance={45}
        fadeStrength={1.5}
        followCamera={false}
        raycast={() => null}
      />
      <DistanceRings color={palette.distanceRing} />
      <UserMarker palette={palette} hfovRad={hfovRad} />
      <Objects palette={palette} />
      <CameraRig autoMode={autoMode} onUserInteract={onUserInteract} resetToken={resetToken} />
      <DebugProjection />
    </Canvas>
  );
}

function Objects({ palette }: { palette: ScenePalette }) {
  // 객체 추가/제거 시에만 재렌더 (위치 갱신은 각 ObjectMesh 의 useFrame)
  const items = useObjectStore(useShallow((s) => s.order.map((id) => `${id}|${s.objects[id]?.classId ?? ''}`)));
  return (
    <>
      {items.map((key) => {
        const [id, classId] = key.split('|');
        return <ObjectMesh key={id} id={id} classId={classId} palette={palette} />;
      })}
    </>
  );
}

/** 1·2·3·5·10·20 m 거리 링 (매우 연하게) */
function DistanceRings({ color }: { color: string }) {
  const lines = useMemo(() => {
    const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    return [1, 2, 3, 5, 10, 20].map((r) => {
      const pts: number[] = [];
      const n = 96;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(Math.cos(a) * r, 0.003, Math.sin(a) * r);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pts, 3));
      const line = new Line(g, material);
      line.raycast = () => undefined;
      return line;
    });
  }, [color]);
  useEffect(
    () => () =>
      lines.forEach((l) => {
        l.geometry.dispose();
        (l.material as LineBasicMaterial).dispose();
      }),
    [lines],
  );
  return (
    <>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </>
  );
}

function CameraRig({
  autoMode,
  onUserInteract,
  resetToken,
}: {
  autoMode: boolean;
  onUserInteract: () => void;
  resetToken: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const zoom = useMemo(() => new AutoZoomController(), []);
  const returning = useRef(true);
  const tmpPos = useMemo(() => new Vector3(), []);
  const tmpTarget = useMemo(() => new Vector3(), []);

  // 기본 시점 복귀: 현재 객체 분포에 맞는 반경으로 즉시 목표를 맞추고 부드럽게 이동
  useEffect(() => {
    const { objects } = useObjectStore.getState();
    const pts = Object.values(objects)
      .filter((o) => o.position && o.trackingState !== 'lost')
      .map((o) => ({ x: o.position!.x, z: o.position!.z }));
    zoom.reset(zoom.desiredRadius(pts) ?? zoom.config.defaultRadius);
    returning.current = true;
  }, [resetToken, zoom]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const { objects } = useObjectStore.getState();
    const pts: { x: number; z: number }[] = [];
    for (const o of Object.values(objects)) {
      if (o.position && (o.trackingState === 'tracking' || o.trackingState === 'temporarily_lost')) {
        pts.push({ x: o.position.x, z: o.position.z });
      }
    }
    const r = zoom.update(pts, performance.now(), delta);
    if (!autoMode) return;
    const pose = homePose(r);
    tmpPos.set(pose.position.x, pose.position.y, pose.position.z);
    tmpTarget.set(pose.target.x, pose.target.y, pose.target.z);
    // 복귀 중에는 비교적 빠르게(0.45s), 이후에는 반경 변화만 따라감(반경 자체가 매우 느리게 변함)
    const k = dampFactor(Math.min(delta, 0.1), returning.current ? 0.45 : 0.25);
    camera.position.lerp(tmpPos, k);
    c.target.lerp(tmpTarget, k);
    if (returning.current && camera.position.distanceTo(tmpPos) < 0.02) returning.current = false;
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1}
      maxDistance={80}
      maxPolarAngle={Math.PI * 0.47}
      target={[0, 0, -2.3]}
      onStart={() => {
        // 사용자의 직접 조작 → 자동 확대·축소 중지
        if (autoMode) onUserInteract();
      }}
    />
  );
}

/** ?debug=1 일 때만: 3D 객체를 화면 좌표로 투영하는 함수를 테스트에 제공 */
function DebugProjection() {
  const { camera, scene, gl } = useThree();
  useEffect(() => {
    const bridge = getDebugBridge();
    if (!bridge) return;
    const v = new Vector3();
    bridge.projectObject = (id: string) => {
      let target: import('three').Object3D | null = null;
      scene.traverse((o) => {
        if (!target && o.type === 'Group' && o.userData.objectId === id) target = o;
      });
      if (!target) return null;
      const t = target as import('three').Object3D;
      const o = useObjectStore.getState().objects[id];
      t.getWorldPosition(v);
      v.y += (o?.size?.height ?? 0.4) / 2;
      v.project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    return () => {
      bridge.projectObject = undefined;
    };
  }, [camera, scene, gl]);
  return null;
}
