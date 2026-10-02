export function UserMarker() {
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.012,0]}><ringGeometry args={[0.17,0.23,48]}/><meshBasicMaterial color="#ffffff" transparent opacity={0.9}/></mesh>;
}
