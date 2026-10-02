import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    ...(mode === 'https' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,json}'],
        globIgnores: ['models/**'],
        maximumFileSizeToCacheInBytes: 80 * 1024 * 1024,
        runtimeCaching: [
          {
            // 앱과 함께 배포된 로컬 모델: 최초 로드 시 캐시 → 이후 오프라인 사용
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mov-models',
              expiration: { maxEntries: 64 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/tfjs-models\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tfjs-models',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    https: mode === 'https' ? {} : undefined,
    allowedHosts: ['vision.cciicc.cc'],
  },
  preview: {
    allowedHosts: ['vision.cciicc.cc'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
  },
}));
