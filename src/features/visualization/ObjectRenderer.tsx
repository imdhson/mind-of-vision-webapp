import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Group,
  type Material,
  type Mesh,
} from 'three';
import { useObjectStore } from '../../stores/objectStore';
import { getClassInfo } from '../detection/classCatalog';
import { clamp, dampFactor, lerpAngle } from '../../utils/math';
import { fmtDistance } from '../../utils/format';
import { LONG_BODY, Shape } from './shapes';
import type { ScenePalette } from './palette';

/**
 * 인식 객체의 3D 표현
 *
 * - 위치·크기·방향은 공통 객체 상태(objectStore)에서 매 프레임 읽어와 보간합니다.
 *   (React 재렌더 없이 useFrame 에서 직접 갱신 → 추론 주기와 무관하게 부드럽게 이동)
 * - 방향 전환은 최단 각도 보간 + 감쇠로 급격한 회전을 방지합니다.
 * - 작은 객체도 쉽게 누를 수 있도록 최소 크기의 투명 선택 영역을 둡니다(Raycasting 대상).
 */
const POS_TC = 0.18; // 위치 보간 시간 상수(s)
const ROT_TC = 0.35; // 회전 보간 시간 상수(s)
const SCALE_TC = 0.3;
const MIN_HIT = 0.45; // 최소 선택 영역 (m)
const DISPLAY_MIN = 0.06;

/** 바닥 평면(XZ)에 놓인 +Z 방향 삼각형 화살표 */
const ARROW_GEOMETRY = (() => {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 1.45, -0.2, 0, 1.08, 0.2, 0, 1.08], 3));
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  return g;
})();

export const ObjectMesh = memo(function ObjectMesh({
  id,
  classId,
  palette,
}: {
  id: string;
  classId: string;
  palette: ScenePalette;
}) {
  const info = getClassInfo(classId);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const hit = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const facing = useRef<Group>(null);
  const motion = useRef<Group>(null);
  const labelAnchor = useRef<Group>(null);
  const labelEl = useRef<HTMLDivElement>(null);
  const state = useRef({ init: false, bodyYaw: 0, facingYaw: 0, sx: 0.3, sy: 0.3, sz: 0.3, opacity: 1, lastText: '' });

  const material = useMemo(
    () => new MeshStandardMaterial({ color: palette.object, roughness: 0.55, metalness: 0.05, transparent: true }),
    [palette.object],
  );
  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.ring,
        transparent: true,
        opacity: 0.5,
        side: DoubleSide,
        depthWrite: false,
      }),
    [palette.ring],
  );
  const arrowMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.selected,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: DoubleSide,
      }),
    [palette.selected],
  );
  const hitMat = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    [],
  );
  const tmpColor = useMemo(() => new Color(), []);
  // 매 프레임 바꾸는 재질은 ref 로 접근(렌더 중 만든 값을 직접 변경하지 않음)
  const materialRef = useDisposableRef(material);
  const ringMatRef = useDisposableRef(ringMat);
  useDisposableRef(arrowMat);
  useDisposableRef(hitMat);

  useFrame((_, delta) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const { objects, selectedId } = useObjectStore.getState();
    const o = objects[id];
    if (!o || !o.position || !o.size) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const s = state.current;
    const dt = Math.min(delta, 0.1);

    // 크기: 방향에 따라 보이는 너비가 달라지는 객체는 높이 기준으로 클래스 비율 적용
    let w = o.size.width;
    let h = o.size.height;
    let d = o.size.depth;
    if (LONG_BODY.has(info.shape) || info.shape === 'person') {
      const k = h / info.prior.height;
      w = info.prior.width * k;
      d = info.prior.depth * k;
    }
    w = clamp(w, DISPLAY_MIN, 40);
    h = clamp(h, DISPLAY_MIN, 40);
    d = clamp(d, DISPLAY_MIN, 40);

    const baseY = Math.max(0, o.position.y - h / 2);
    // 방향: 알 수 있을 때만 회전. 몸체가 긴 객체(+X 정면)는 방향을 모르면 영상에서 보이는 대로 옆으로(X축) 배치
    const facingYaw = o.orientation.facingYaw;
    const longBody = LONG_BODY.has(info.shape);
    const bodyTarget = longBody ? (facingYaw != null ? facingYaw - Math.PI / 2 : 0) : (facingYaw ?? 0);
    if (!s.init) {
      g.position.set(o.position.x, baseY, o.position.z);
      s.sx = w;
      s.sy = h;
      s.sz = d;
      s.bodyYaw = bodyTarget;
      s.facingYaw = facingYaw ?? 0;
      s.init = true;
    } else {
      const kp = dampFactor(dt, POS_TC);
      g.position.x += (o.position.x - g.position.x) * kp;
      g.position.y += (baseY - g.position.y) * kp;
      g.position.z += (o.position.z - g.position.z) * kp;
      const ks = dampFactor(dt, SCALE_TC);
      s.sx += (w - s.sx) * ks;
      s.sy += (h - s.sy) * ks;
      s.sz += (d - s.sz) * ks;
    }
    const kr = dampFactor(dt, ROT_TC);
    s.bodyYaw = lerpAngle(s.bodyYaw, bodyTarget, kr);
    if (facingYaw != null) s.facingYaw = lerpAngle(s.facingYaw, facingYaw, kr);
    b.rotation.y = s.bodyYaw;
    b.scale.set(s.sx, s.sy, s.sz);

    if (hit.current) {
      hit.current.scale.set(Math.max(s.sx, MIN_HIT), Math.max(s.sy, MIN_HIT), Math.max(s.sz, MIN_HIT));
      hit.current.position.y = Math.max(s.sy, MIN_HIT) / 2;
    }

    const selected = selectedId === id;
    const targetOpacity =
      o.trackingState === 'temporarily_lost'
        ? 0.35
        : o.trackingState === 'lost'
          ? 0.12
          : o.trackingState === 'detected'
            ? 0.6
            : 1;
    s.opacity += (targetOpacity - s.opacity) * dampFactor(dt, 0.2);
    const mat = materialRef.current;
    mat.opacity = s.opacity;
    mat.color.lerp(tmpColor.set(selected ? palette.selected : palette.object), dampFactor(dt, 0.12));
    mat.emissive.set(selected ? palette.selectedEmissive : '#000000');

    if (ring.current) {
      const r = Math.max(0.16, Math.max(s.sx, s.sz) * 0.6);
      ring.current.scale.set(r, r, r);
      const rm = ringMatRef.current;
      rm.color.set(selected ? palette.selected : palette.ring);
      rm.opacity = (selected ? 0.95 : 0.45) * s.opacity;
    }

    if (facing.current) {
      facing.current.visible = facingYaw != null;
      facing.current.rotation.y = s.facingYaw;
      const r = Math.max(0.2, Math.max(s.sx, s.sz) * 0.6);
      facing.current.position.set(0, 0.012, 0);
      facing.current.scale.setScalar(r);
    }
    if (motion.current) {
      const my = o.orientation.movementYaw;
      motion.current.visible = my != null && o.orientation.motionState === 'moving';
      if (my != null) motion.current.rotation.y = my;
      motion.current.scale.setScalar(Math.max(0.3, Math.min(2, (o.orientation.speed ?? 0) * 1.2)));
    }

    if (labelAnchor.current) labelAnchor.current.position.y = s.sy + 0.18;
    if (labelEl.current) {
      const text = `${o.label} · ${fmtDistance(o.correctedDistance)}`;
      if (text !== s.lastText) {
        labelEl.current.textContent = text;
        s.lastText = text;
      }
      labelEl.current.dataset.selected = selected ? '1' : '0';
      labelEl.current.style.opacity = String(Math.max(0.25, s.opacity));
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useObjectStore.getState().select(id);
  };

  return (
    <group
      ref={root}
      visible={false}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
      userData={{ objectId: id }}
    >
      <group ref={body}>
        <Shape kind={info.shape} m={material} />
      </group>
      {/* 선택 판정 영역 (투명, Raycasting 대상) */}
      <mesh ref={hit} material={hitMat} userData={{ objectId: id }}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {/* 바닥 위치 링: 작은 객체도 위치를 쉽게 파악 */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={ringMat} raycast={() => null}>
        <ringGeometry args={[0.9, 1, 48]} />
      </mesh>
      {/* 바라보는 방향 표시 (알 수 있을 때만) */}
      <group ref={facing} visible={false}>
        <mesh geometry={ARROW_GEOMETRY} material={arrowMat} raycast={() => null} />
      </group>
      {/* 이동 방향 표시 */}
      <group ref={motion} visible={false}>
        <mesh position={[0, 0.01, 0.9]} rotation={[-Math.PI / 2, 0, 0]} material={ringMat} raycast={() => null}>
          <planeGeometry args={[0.04, 0.8]} />
        </mesh>
      </group>
      <group ref={labelAnchor}>
        <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={labelEl}
            className="mov-label whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular"
          />
        </Html>
      </group>
    </group>
  );
});

/**
 * 재질을 ref 로 노출하고, 테마 변경으로 교체되거나 언마운트되면 GPU 자원을 해제합니다.
 * (레이아웃 효과: 화면에 그려지기 전에 ref 를 새 재질로 바꿔 한 프레임도 이전 재질을 갱신하지 않음)
 */
function useDisposableRef<T extends Material>(material: T) {
  const ref = useRef(material);
  useLayoutEffect(() => {
    ref.current = material;
    return () => material.dispose();
  }, [material]);
  return ref;
}
