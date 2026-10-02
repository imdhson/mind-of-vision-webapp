import { useEffect, useState } from 'react';
export function useDevicePitch() {
  const [pitch, setPitch] = useState<number | undefined>();
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === 'number') setPitch(e.beta - 90);
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);
  return pitch;
}
