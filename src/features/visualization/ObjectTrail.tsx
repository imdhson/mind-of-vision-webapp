import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial } from 'three';
import { useObjectStore } from '../../stores/objectStore';
import { DEFAULT_TRAIL_CONFIG } from './TrailTracker';
import type { ScenePalette } from './palette';

const TRAIL_Y = 0.008; // 바닥 격자(0.003)·거리 링보다 살짝 위, 위치 링(0.006)보다 위

/**
 * 객체의 최근 이동 경로를 바닥에 옅은 선으로 표시합니다.
 * 위치 갱신은 React 재렌더 없이 useFrame 에서 직접 store 를 읽어 반영합니다(ObjectMesh 와 동일한 방식).
 */
export const ObjectTrail = memo(function ObjectTrail({ id, palette }: { id: string; palette: ScenePalette }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(DEFAULT_TRAIL_CONFIG.maxPoints * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const material = useMemo(
    () => new LineBasicMaterial({ color: palette.trail, transparent: true, opacity: 0.55, depthWrite: false }),
    [palette.trail],
  );
  const line = useMemo(() => {
    const l = new Line(geometry, material);
    l.visible = false;
    l.raycast = () => undefined;
    return l;
  }, [geometry, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const trail = useObjectStore.getState().trails[id];
    if (!trail || trail.length < 2) {
      line.visible = false;
      return;
    }
    line.visible = true;
    const attr = geometry.getAttribute('position') as BufferAttribute;
    const n = Math.min(trail.length, DEFAULT_TRAIL_CONFIG.maxPoints);
    const start = trail.length - n;
    for (let i = 0; i < n; i++) {
      const p = trail[start + i];
      attr.setXYZ(i, p.x, TRAIL_Y, p.z);
    }
    attr.needsUpdate = true;
    geometry.setDrawRange(0, n);
  });

  return <primitive object={line} />;
});
