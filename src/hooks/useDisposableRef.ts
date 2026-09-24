import { useLayoutEffect, useRef } from 'react';

/**
 * useMemo 로 만든 three.js 객체(재질 등)를 useFrame 안에서 안전하게 변경할 수 있도록 ref 로 노출합니다.
 * (린트 규칙상 훅이 반환한 값을 직접 변경할 수 없으므로, ObjectMesh 의 group/mesh ref 와 같은 방식으로 감쌉니다.)
 * 레이아웃 효과: 화면에 그려지기 전에 ref 를 새 값으로 바꿔 한 프레임도 이전 값을 사용하지 않습니다.
 */
export function useMutableRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/** useMutableRef 와 동일하지만, 교체되거나 언마운트되면 dispose() 도 호출합니다(재질·지오메트리 등 GPU 자원용). */
export function useDisposableRef<T extends { dispose(): void }>(value: T) {
  const ref = useMutableRef(value);
  useLayoutEffect(() => () => value.dispose(), [value]);
  return ref;
}
