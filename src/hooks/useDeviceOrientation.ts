import { useEffect, useRef } from 'react';

// ⚡ Bolt Performance Optimization:
// Throttled the fast-firing deviceorientation event to 10Hz (100ms) and rounded
// the pitch value to 1 decimal place.
// Changed from useState to useRef to prevent top-level React re-renders
// in AppRuntime every 100ms, since this value is only polled by the vision pipeline.
export function useDevicePitch() {
  const pitchRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let lastUpdate = 0;

    const handler = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === 'number') {
        const now = performance.now();
        if (now - lastUpdate > 100) {
          lastUpdate = now;
          const newPitch = Math.round((e.beta - 90) * 10) / 10;
          pitchRef.current = newPitch;
        }
      }
    };

    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  return pitchRef;
}
