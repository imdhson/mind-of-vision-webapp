import { registerSW } from 'virtual:pwa-register';

/** Service Worker 등록 (프로덕션 빌드에서만 생성됨) */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    registerSW({ immediate: true });
  } catch {
    // 등록 실패해도 앱은 정상 동작
  }
}
