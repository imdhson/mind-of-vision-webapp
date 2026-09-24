#!/usr/bin/env node
/**
 * End-to-End 스모크 테스트 (실제 Chromium + 실제 AI 모델 + 가짜 카메라 영상)
 *
 * Chromium 의 가짜 카메라 기능에 실제 사진(MJPEG)을 넣어, 카메라 → 인식 → 추적 → 거리 → 3D → 선택 → 보정 저장 → 새로고침 후 유지
 * 흐름을 자동으로 검증하고 스크린샷을 tests/e2e/output 에 저장합니다.
 *
 * 사전 준비:  npm run build
 * 실행:       npm run test:e2e
 * 환경 변수:  CHROMIUM_PATH (기본: Playwright 설치 경로 자동 탐색), E2E_PORT (기본 4179)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'tests', 'e2e', 'output');
const FIX = join(ROOT, 'tests', 'e2e', 'fixtures');
const PORT = Number(process.env.E2E_PORT ?? 4179);
const BASE = `http://localhost:${PORT}/`;
mkdirSync(OUT, { recursive: true });
mkdirSync(FIX, { recursive: true });

const FIXTURE_URL = 'https://raw.githubusercontent.com/tensorflow/tfjs-models/master/coco-ssd/demo/image2.jpg';

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  for (const d of existsSync(base) ? readdirSync(base) : []) {
    const p = join(base, d, 'chrome-linux', 'chrome');
    if (d.startsWith('chromium-') && existsSync(p)) return p;
  }
  return undefined; // Playwright 기본 경로 사용
}

/**
 * 테스트 사진을 짝수 해상도 JPEG(640×426)로 다시 인코딩한 뒤 여러 프레임 MJPEG 로 만듭니다.
 * (Chromium 가짜 카메라는 홀수 해상도 MJPEG 를 제대로 디코딩하지 못함)
 */
async function ensureFixture(browser) {
  const jpg = join(FIX, 'dogs.jpg');
  if (!existsSync(jpg)) {
    const res = await fetch(FIXTURE_URL);
    if (!res.ok) throw new Error(`테스트 이미지 다운로드 실패: ${res.status}`);
    writeFileSync(jpg, Buffer.from(await res.arrayBuffer()));
  }
  const page = await browser.newPage();
  const dataUrl = `data:image/jpeg;base64,${readFileSync(jpg).toString('base64')}`;
  const b64 = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 426;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }, dataUrl);
  await page.close();
  const frame = Buffer.from(b64, 'base64');
  const mjpeg = join(FIX, 'dogs.mjpeg');
  writeFileSync(mjpeg, Buffer.concat(Array.from({ length: 30 }, () => frame)));
  return mjpeg;
}

function startServer() {
  const proc = spawn(
    process.execPath,
    [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('preview 서버 시작 시간 초과')), 20000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes(String(PORT))) {
        clearTimeout(t);
        resolve(proc);
      }
    });
    proc.on('exit', (code) => reject(new Error(`preview 종료 (${code})`)));
  });
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('먼저 npm run build 를 실행하세요.');
  const server = await startServer();
  const helper = await chromium.launch({ executablePath: findChromium() });
  const mjpeg = await ensureFixture(helper);
  await helper.close();
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${mjpeg}`,
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(`${BASE}?debug=1`);

    // 1) 카메라 자동 시작 + 실제 인식
    await page.waitForFunction(() => window.__movDebug?.camera.getState().status === 'running', null, {
      timeout: 30000,
    });
    check('카메라 스트림 시작', true);
    await page.waitForFunction(() => window.__movDebug.objects.getState().detectorStatus === 'ready', null, {
      timeout: 120000,
    });
    const backend = await page.evaluate(() => window.__movDebug.objects.getState().stats.backend);
    check('AI 모델 로드', true, `backend=${backend}`);
    await page.waitForFunction(
      () =>
        Object.values(window.__movDebug.objects.getState().objects).filter(
          (o) => o.classId === 'dog' && o.trackingState === 'tracking',
        ).length >= 2,
      null,
      { timeout: 60000 },
    );
    const objs = await page.evaluate(() => Object.values(window.__movDebug.objects.getState().objects));
    const dogs = objs.filter((o) => o.classId === 'dog');
    check(
      '같은 종류 객체 2개를 서로 다른 ID로 추적',
      new Set(dogs.map((d) => d.id)).size === 2,
      dogs.map((d) => `${d.label}(${d.id})`).join(', '),
    );
    check(
      '거리·3D 좌표 추정',
      dogs.every((d) => d.estimatedDistance > 0 && d.position),
      dogs.map((d) => `${d.label}=${d.estimatedDistance.toFixed(2)}m`).join(', '),
    );
    const ids1 = dogs
      .map((d) => d.id)
      .sort()
      .join();
    await page.waitForTimeout(3000);
    const ids2 = await page.evaluate(() =>
      Object.values(window.__movDebug.objects.getState().objects)
        .filter((o) => o.classId === 'dog')
        .map((o) => o.id)
        .sort()
        .join(),
    );
    check('3초 동안 추적 ID 유지', ids1 === ids2, `${ids1} → ${ids2}`);
    await page.screenshot({ path: join(OUT, '01-camera.png') });

    // 2) 카메라 화면에서 객체 클릭 → 선택
    const target = dogs[0];
    const pt = await page.evaluate((id) => {
      const o = window.__movDebug.objects.getState().objects[id];
      const cam = window.__movDebug.camera.getState().active;
      const canvas = document.querySelector('[data-testid="detection-overlay"]').getBoundingClientRect();
      const s = Math.min(canvas.width / cam.videoWidth, canvas.height / cam.videoHeight);
      const w = cam.videoWidth * s;
      const h = cam.videoHeight * s;
      const ox = canvas.left + (canvas.width - w) / 2;
      const oy = canvas.top + (canvas.height - h) / 2;
      return { x: ox + o.center.x * w, y: oy + o.center.y * h };
    }, target.id);
    await page.mouse.click(pt.x, pt.y);
    await page.waitForSelector('[data-testid="selected-sheet-camera"]');
    const selectedId = await page.evaluate(() => window.__movDebug.objects.getState().selectedId);
    check('카메라 화면 클릭 선택', selectedId === target.id, `${selectedId}`);

    // 3) 보정: 실제 거리 2.5 m (이 객체 · 저장)
    await page.getByRole('radio', { name: '보정' }).click();
    await page.getByRole('radio', { name: '이 객체 · 저장' }).click();
    await page.locator(`#cal-${target.id}-measuredDistance`).fill('2.5');
    await page.getByTestId('calibration-save').click();
    await page.waitForFunction(() =>
      /저장됨/.test(document.querySelector('[data-testid="calibration-status"]')?.textContent ?? ''),
    );
    await page.waitForTimeout(400);
    const after = await page.evaluate((id) => window.__movDebug.objects.getState().objects[id], target.id);
    check(
      '실제 거리 보정 저장 및 반영',
      Math.abs(after.correctedDistance - 2.5) < 0.2 &&
        Math.abs(after.estimatedDistance - target.estimatedDistance) < 0.5,
      `추정 ${after.estimatedDistance.toFixed(2)} → 보정 ${after.correctedDistance.toFixed(2)}`,
    );
    const hDist = Math.hypot(after.cameraPosition.x, after.cameraPosition.y, after.cameraPosition.z);
    check('보정 거리가 3D 좌표에 반영', Math.abs(hDist - after.correctedDistance) < 0.05, `|p|=${hDist.toFixed(2)}`);
    // 잘못된 입력은 저장 안 됨
    await page.locator(`#cal-${target.id}-offsetX`).fill('999');
    const disabled = await page.getByTestId('calibration-save').isDisabled();
    check('범위 밖 값 저장 차단', disabled);
    await page.getByRole('button', { name: '되돌리기' }).first().click();
    // 클래스 보정도 저장 (모든 강아지)
    await page.getByRole('radio', { name: '모든 강아지' }).click();
    await page.locator(`#cal-${target.id}-realHeight`).fill('0.4');
    await page.getByTestId('calibration-save').click();
    await page.waitForFunction(() =>
      /저장됨/.test(document.querySelector('[data-testid="calibration-status"]')?.textContent ?? ''),
    );
    await page.screenshot({ path: join(OUT, '02-camera-calibration.png') });

    // 4) 3D 탭: 선택 동기화 + 3D 클릭 선택
    await page.getByRole('tab', { name: '3D 시각화' }).click();
    await page.waitForSelector('[data-testid="selected-sheet-vision"]');
    const syncLabel = await page.getByTestId('selected-sheet-vision').getByTestId('selected-label').textContent();
    check('탭 전환 후 선택 상태 유지', syncLabel === after.label, syncLabel);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, '03-vision.png') });
    await page.getByRole('button', { name: '선택 해제' }).last().click();
    const other = dogs[1];
    const click3d = async (id) => {
      const p = await page.evaluate((i) => window.__movDebug.projectObject?.(i), id);
      if (!p) return null;
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(200);
      return page.evaluate(() => window.__movDebug.objects.getState().selectedId);
    };
    let sel = await click3d(other.id);
    check('3D 객체 클릭 선택 (기본 시점)', sel === other.id, `${sel}`);
    // 시점 회전 + 확대 후 다시 선택
    const canvasBox = await page.getByTestId('vision-canvas').boundingBox();
    const cx = canvasBox.x + canvasBox.width * 0.85;
    const cy = canvasBox.y + canvasBox.height * 0.2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 180, cy + 40, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(1200);
    const autoLabel = await page.getByRole('button', { name: '기본 시점으로 복귀' }).textContent();
    check('수동 조작 시 자동 확대·축소 해제', autoLabel.includes('기본 시점'), autoLabel);
    sel = await click3d(target.id);
    check('3D 객체 클릭 선택 (회전·확대 후)', sel === target.id, `${sel}`);
    await page.screenshot({ path: join(OUT, '04-vision-rotated.png') });
    await page.getByRole('button', { name: '기본 시점으로 복귀' }).click();
    await page.waitForTimeout(1500);
    const autoLabel2 = await page.getByRole('button', { name: '기본 시점으로 복귀' }).textContent();
    check('기본 시점 복귀 시 자동 모드 재개', autoLabel2.includes('자동'), autoLabel2);

    // 5) 설정 탭
    await page.getByRole('tab', { name: '설정' }).click();
    await page.waitForTimeout(500);
    const listCount = await page.getByTestId('object-list').locator('li').count();
    check('객체 목록 표시', listCount >= 2, `${listCount}개`);
    const lastId = await page.evaluate(() => window.__movDebug.objects.getState().order.at(-1));
    await page.evaluate((id) => window.__movDebug.objects.getState().select(id), lastId);
    await page.waitForTimeout(1200);
    const firstAria = await page
      .getByTestId('object-list')
      .locator('li')
      .first()
      .locator('button')
      .first()
      .getAttribute('aria-expanded');
    check('선택 객체 최상단 고정', firstAria === 'true', firstAria);
    await page.evaluate(() => window.__movDebug.objects.getState().select(null));
    const hasCameraSettings = await page.getByText('카메라 설정 · 보정').isVisible();
    check('설정 탭에 카메라 설정 존재', hasCameraSettings);
    await page.screenshot({ path: join(OUT, '05-objects.png'), fullPage: true });

    // 6) 새로고침 후 영속 보정값 유지 + 개별 보정은 자동 연결되지 않음
    await page.reload();
    await page.waitForFunction(() => window.__movDebug?.calibration.getState().loaded, null, { timeout: 20000 });
    const persisted = await page.evaluate(() => {
      const s = window.__movDebug.calibration.getState();
      return {
        classes: Object.keys(s.classCals),
        instances: Object.values(s.instances).map((i) => i.name),
        bindings: s.bindings,
      };
    });
    check(
      '새로고침 후 보정값 유지',
      persisted.classes.includes('class:dog') && persisted.instances.length === 1,
      JSON.stringify(persisted.instances),
    );
    await page.waitForFunction(() => Object.keys(window.__movDebug.objects.getState().objects).length > 0, null, {
      timeout: 60000,
    });
    await page.waitForTimeout(800);
    const autoBound = await page.evaluate(() => Object.keys(window.__movDebug.calibration.getState().bindings).length);
    check('재실행 후 개별 보정 자동 적용 안 함(수동 연결 필요)', autoBound === 0);
    const sw = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
    check('Service Worker 등록', sw);
    const manifest = await page.evaluate(async () =>
      (await fetch(document.querySelector('link[rel=manifest]').href)).json(),
    );
    check('Web App Manifest', manifest.display === 'standalone' && manifest.icons.length >= 3, manifest.name);

    // 7) 다크 모드 + 모바일 레이아웃
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('tab', { name: '3D 시각화' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, '06-vision-dark.png') });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('시스템 다크 모드 반영', bg === 'rgb(10, 10, 11)', bg);
    await context.close(); // 동시에 두 페이지가 추론하지 않도록 정리

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      permissions: ['camera'],
      colorScheme: 'light',
    });
    const m = await mobile.newPage();
    await m.goto(`${BASE}?debug=1`);
    await m.waitForFunction(() => Object.keys(window.__movDebug?.objects.getState().objects ?? {}).length >= 2, null, {
      timeout: 120000,
    });
    await m.waitForTimeout(1000);
    await m.screenshot({ path: join(OUT, '07-mobile-camera.png') });
    const headerH = await m.evaluate(() => document.querySelector('header').getBoundingClientRect().height);
    const navH = await m.evaluate(() => document.querySelector('nav').getBoundingClientRect().height);
    check('얇은 헤더/하단 탭', headerH <= 36 && navH <= 56, `header ${headerH}px, tabs ${navH}px`);
    // 터치로 선택
    const mid = await m.evaluate(
      () => Object.values(window.__movDebug.objects.getState().objects).find((o) => o.classId === 'dog')?.id,
    );
    const mpt = await m.evaluate((id) => {
      const o = window.__movDebug.objects.getState().objects[id];
      const cam = window.__movDebug.camera.getState().active;
      const r = document.querySelector('[data-testid="detection-overlay"]').getBoundingClientRect();
      const s = Math.min(r.width / cam.videoWidth, r.height / cam.videoHeight);
      return {
        x: r.left + (r.width - cam.videoWidth * s) / 2 + o.center.x * cam.videoWidth * s,
        y: r.top + (r.height - cam.videoHeight * s) / 2 + o.center.y * cam.videoHeight * s,
      };
    }, mid);
    await m.touchscreen.tap(mpt.x, mpt.y);
    await m.waitForTimeout(300);
    await m.getByRole('radio', { name: '보정' }).click();
    await m.waitForTimeout(300);
    await m.screenshot({ path: join(OUT, '08-mobile-calibration.png') });
    check('모바일 터치 선택', (await m.evaluate(() => window.__movDebug.objects.getState().selectedId)) === mid);
    await m.getByRole('tab', { name: '3D 시각화' }).click();
    await m.waitForTimeout(1500);
    await m.screenshot({ path: join(OUT, '09-mobile-vision.png') });
    await m.getByRole('tab', { name: '설정' }).click();
    await m.waitForTimeout(500);
    await m.screenshot({ path: join(OUT, '10-mobile-objects.png') });
    // 카메라 종료 → 추적 정리
    await m.getByRole('tab', { name: '카메라' }).click();
    await m.getByRole('button', { name: '카메라 종료' }).click();
    await m.waitForTimeout(500);
    const afterStop = await m.evaluate(() => ({
      status: window.__movDebug.camera.getState().status,
      n: Object.keys(window.__movDebug.objects.getState().objects).length,
    }));
    check(
      '카메라 종료 시 스트림·추적 정리',
      afterStop.status === 'idle' && afterStop.n === 0,
      JSON.stringify(afterStop),
    );
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 통과 · 스크린샷: tests/e2e/output`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
