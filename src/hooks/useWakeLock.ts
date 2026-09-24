import { useEffect, useRef, useState } from 'react';

export type WakeLockStatus = 'unsupported' | 'inactive' | 'active' | 'error';

/**
 * Screen Wake Lock API: active=true 인 동안 화면 꺼짐을 방지합니다.
 * - 페이지가 숨겨지면 브라우저가 자동 해제하므로, 다시 보일 때 재요청합니다.
 * - 미지원 브라우저에서는 아무 것도 하지 않습니다(나머지 기능 정상 동작).
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'inactive' : 'unsupported');
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    const release = async () => {
      const s = sentinel.current;
      sentinel.current = null;
      if (s && !s.released) {
        try {
          await s.release();
        } catch {
          /* 무시 */
        }
      }
    };

    const request = async () => {
      if (!active || document.visibilityState !== 'visible' || sentinel.current) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled || !active) {
          await s.release();
          return;
        }
        sentinel.current = s;
        setStatus('active');
        s.addEventListener('release', () => {
          if (sentinel.current === s) sentinel.current = null;
          setStatus('inactive');
        });
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    if (active) void request();
    else void release();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void release();
    };
  }, [active, supported]);

  // 비활성 상태는 입력값에서 바로 결정(해제 완료 이벤트를 기다리지 않음)
  if (!supported) return 'unsupported';
  return active ? status : 'inactive';
}
