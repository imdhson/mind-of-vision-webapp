import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useObjectStore } from '@/stores/objectStore';
import { ObjectRenderer } from './ObjectRenderer';
import { UserMarker } from './UserMarker';
import { AutoCameraController } from './AutoCameraController';

export function VisionScene({ active }: { active: boolean }) {
  const { objects, selectedId, select } = useObjectStore();
  return (
    <Canvas
      className="vision-canvas"
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 6, 10], fov: 50 }}
      dpr={[1, 2]}
      onPointerMissed={() => select(null)}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 10, 3]} intensity={1.4} />
      <Grid
        position={[0, 0, -8]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.35}
        cellColor="#6f7680"
        sectionSize={5}
        sectionThickness={0.55}
        sectionColor="#858d99"
        fadeDistance={30}
        fadeStrength={2.5}
        infiniteGrid
      />
      {[5, 10, 15, 20].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <ringGeometry args={[r - 0.015, r + 0.015, 96]} />
          <meshBasicMaterial color="#6f7680" transparent opacity={0.12} />
        </mesh>
      ))}
      <UserMarker />
      {objects.map((o) => (
        <ObjectRenderer key={o.id} object={o} selected={o.id === selectedId} onSelect={() => select(o.id)} />
      ))}
      <AutoCameraController objects={objects} enabled={!selectedId} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        target={[0, 0, -5]}
        minDistance={3}
        maxDistance={45}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
