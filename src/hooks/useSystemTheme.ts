import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getSnapshot(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

/** 운영체제/브라우저 테마 설정을 실시간으로 따릅니다. */
export function useSystemTheme(): 'dark' | 'light' {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}
