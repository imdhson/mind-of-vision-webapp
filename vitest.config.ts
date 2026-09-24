import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // jsdom 환경을 파일마다 새로 만드는 비용이 실행 시간의 대부분이라 워커당 한 번만 생성(파일별 격리는 유지)
    pool: 'vmThreads',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
