import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { useObjectStore } from '../../stores/objectStore';
import { useDisposableRef, useMutableRef } from '../../hooks/useDisposableRef';
import { dampFactor } from '../../utils/math';
import type { GroundSegment } from '../lanes/laneGeometry';
import type { ScenePalette } from './palette';

const LANE_Y = 0.01; // 궤적(0.008)보다 살짝 위
const FILL_Y = 0.004; // 거리 링(0.003) 바로 위

/**
 * 인식된 차선(도로 경계)을 바닥에 선으로, 두 경계 사이를 옅은 면으로 표시합니다.
 * 추론 주기(약 10Hz)와 무관하게 부드럽게 따라가도록 useFrame 에서 끝점을 보간합니다.
 */
export const LaneLines = memo(function LaneLines({ palette }: { palette: ScenePalette }) {
  const geometries = useMemo(() => {
    const make = (n: number) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3));
      return g;
    };
    const fill = make(4);
    fill.setIndex([0, 1, 2, 0, 2, 3]);
    return { left: make(2), right: make(2), fill };
  }, []);
  const lineMaterial = useMemo(
    () => new LineBasicMaterial({ color: palette.lane, transparent: true, opacity: 0.9, depthWrite: false }),
    [palette.lane],
  );
  const fillMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.lane,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: DoubleSide,
      }),
    [palette.lane],
  );
  const objects = useMemo(() => {
    const left = new Line(geometries.left, lineMaterial);
    const right = new Line(geometries.right, lineMaterial);
    const fill = new Mesh(geometries.fill, fillMaterial);
    for (const o of [left, right, fill]) {
      o.visible = false;
      o.raycast = () => undefined;
      o.frustumCulled = false;
    }
    return { left, right, fill };
  }, [geometries, lineMaterial, fillMaterial]);

  useDisposableRef(geometries.left);
  useDisposableRef(geometries.right);
  useDisposableRef(geometries.fill);
  useDisposableRef(lineMaterial);
  useDisposableRef(fillMaterial);
  const objectsRef = useMutableRef(objects);
  const shownRef = useRef<Record<'left' | 'right', GroundSegment | null>>({ left: null, right: null });

  useFrame((_, delta) => {
    const o = objectsRef.current;
    const cur = shownRef.current;
    const { lanes } = useObjectStore.getState();
    const k = dampFactor(Math.min(delta, 0.1), 0.08);
    for (const side of ['left', 'right'] as const) {
      const target = lanes[side]?.ground ?? null;
      const line = o[side];
      if (!target) {
        cur[side] = null;
        line.visible = false;
        continue;
      }
      const p = cur[side];
      const next: GroundSegment = p
        ? {
            near: { x: p.near.x + (target.near.x - p.near.x) * k, z: p.near.z + (target.near.z - p.near.z) * k },
            far: { x: p.far.x + (target.far.x - p.far.x) * k, z: p.far.z + (target.far.z - p.far.z) * k },
          }
        : target;
      cur[side] = next;
      const attr = line.geometry.getAttribute('position') as BufferAttribute;
      attr.setXYZ(0, next.near.x, LANE_Y, next.near.z);
      attr.setXYZ(1, next.far.x, LANE_Y, next.far.z);
      attr.needsUpdate = true;
      line.visible = true;
    }
    const { left, right } = cur;
    if (left && right) {
      const attr = o.fill.geometry.getAttribute('position') as BufferAttribute;
      attr.setXYZ(0, left.near.x, FILL_Y, left.near.z);
      attr.setXYZ(1, left.far.x, FILL_Y, left.far.z);
      attr.setXYZ(2, right.far.x, FILL_Y, right.far.z);
      attr.setXYZ(3, right.near.x, FILL_Y, right.near.z);
      attr.needsUpdate = true;
      o.fill.visible = true;
    } else o.fill.visible = false;
  });

  return (
    <>
      <primitive object={objects.fill} />
      <primitive object={objects.left} />
      <primitive object={objects.right} />
    </>
  );
});
