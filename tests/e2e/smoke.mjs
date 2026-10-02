import { chromium } from 'playwright-core';
const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) {
  console.log('CHROMIUM_PATH가 없어 E2E를 건너뜁니다. 빌드 후 실제 브라우저 경로를 지정하세요.');
  process.exit(0);
}
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(process.env.MOV_URL || 'http://127.0.0.1:4173');
await page.waitForSelector('text=Mind of Vision');
console.log('Smoke page loaded:', await page.title());
await browser.close();
