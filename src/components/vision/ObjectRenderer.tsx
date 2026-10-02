import type { SpatialObject } from '@/types';
import { classMeta } from '@/features/detection/classCatalog';
import { Text } from '@react-three/drei';

export function ObjectRenderer({ object, selected, onSelect }: { object: SpatialObject; selected:boolean; onSelect:()=>void }) {
  const meta = classMeta(object.className);
  const pos: [number,number,number] = [object.position.x, Math.max(object.size.height/2, 0.05), object.position.z];
  const rot: [number,number,number] = [0, object.yawRad ?? 0, 0];
  const geom = meta.shape === 'round' ? <cylinderGeometry args={[object.size.width/2, object.size.width/2, object.size.height, 18]} />
    : <boxGeometry args={[object.size.width, object.size.height, Math.max(0.15, object.size.depth)]} />;
  return <group position={pos} rotation={rot} onClick={(e)=>{e.stopPropagation();onSelect();}}>
    <mesh>{geom}<meshStandardMaterial color={selected ? '#ffffff' : '#9da3ad'} roughness={0.7} metalness={0.05}/></mesh>
    <Text position={[0, object.size.height/2 + 0.18, 0]} fontSize={0.14} color="#cfd3da" anchorX="center">{object.label}</Text>
  </group>;
}
