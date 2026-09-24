import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// `npm run dev:https` (mode=https)일 때 자체 서명 인증서로 HTTPS 개발 서버를 띄웁니다.
// 스마트폰에서 LAN IP로 접속해 카메라를 사용하려면 보안 컨텍스트(HTTPS)가 필요합니다.
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: false, // public/manifest.webmanifest 를 직접 사용
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        globIgnores: ['models/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // 로컬 번들 모델: 최초 로드 시 캐시에 저장 → 이후 오프라인 사용
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mov-models',
              expiration: { maxEntries: 64 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 원격 모델 대체 경로(Google Cloud Storage)
            urlPattern: ({ url }) => url.hostname === 'storage.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mov-models-remote',
              expiration: { maxEntries: 64 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ];
  if (mode === 'https') plugins.push(basicSsl());

  return {
    base: './',
    plugins,
    server: { host: mode === 'https' ? true : undefined },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('@tensorflow')) return 'tfjs';
            if (id.includes('three') || id.includes('@react-three')) return 'three';
            return undefined;
          },
        },
      },
    },
  };
});
