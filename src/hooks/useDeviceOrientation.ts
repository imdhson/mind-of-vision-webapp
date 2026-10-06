import { useEffect, useState } from 'react';

// ⚡ Bolt Performance Optimization:
// Throttled the fast-firing deviceorientation event to 10Hz (100ms) and rounded
// the pitch value to 1 decimal place. This significantly reduces top-level
// React re-renders in AppRuntime while maintaining smooth orientation data.
export function useDevicePitch() {
  const [pitch, setPitch] = useState<number | undefined>();

  useEffect(() => {
    let lastUpdate = 0;

    const handler = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === 'number') {
        const now = performance.now();
        if (now - lastUpdate > 100) {
          lastUpdate = now;
          const newPitch = Math.round((e.beta - 90) * 10) / 10;
          setPitch(newPitch);
        }
      }
    };

    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  return pitch;
}
