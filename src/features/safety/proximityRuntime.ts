import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { fmtDistance } from '../../utils/format';
import { DEFAULT_PROXIMITY_CONFIG, ProximityMonitor } from './ProximityMonitor';

/**
 * 근접 경고 런타임 연결: 공통 객체 상태가 갱신될 때마다 ProximityMonitor 로 평가하고,
 * 경고 대상이 있으면 토스트 + 짧은 알림음 + 진동(지원 시)으로 안내합니다.
 * 모델·오디오 등 다른 초기화와 마찬가지로 AppRuntime 에서 앱 시작 시 한 번만 연결합니다.
 */
let started = false;
let audioCtx: AudioContext | null = null;

function playAlertTone() {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // 오디오 미지원/차단(자동 재생 정책 등): 토스트·진동만으로 안내
  }
}

export function startProximityMonitor(): void {
  if (started) return;
  started = true;
  const monitor = new ProximityMonitor();
  let wasEnabled = useUIStore.getState().proximityAlertEnabled;

  useUIStore.subscribe((s) => {
    // 껐다가 다시 켰을 때 과거 쿨다운이 남아있지 않도록 초기화
    if (s.proximityAlertEnabled && !wasEnabled) monitor.reset();
    wasEnabled = s.proximityAlertEnabled;
  });

  useObjectStore.subscribe((s, prev) => {
    if (s.objects === prev.objects) return;
    const ui = useUIStore.getState();
    if (!ui.proximityAlertEnabled) return;
    const alerts = monitor.evaluate(Object.values(s.objects), performance.now(), {
      distanceM: ui.proximityAlertDistance,
      cooldownMs: DEFAULT_PROXIMITY_CONFIG.cooldownMs,
    });
    for (const a of alerts) {
      ui.toast(`근접 경고 · ${a.label} · ${fmtDistance(a.distance)}`, 'error');
      playAlertTone();
      navigator.vibrate?.(120);
    }
  });
}
