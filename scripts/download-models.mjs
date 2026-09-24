#!/usr/bin/env node
/**
 * 객체 인식 모델(COCO-SSD) 파일을 public/models 아래로 내려받습니다.
 * 내려받은 모델은 앱과 함께 배포되고 Service Worker에 의해 캐싱되어 오프라인에서도 사용됩니다.
 *
 * 사용법:
 *   node scripts/download-models.mjs            # 기본(lite_mobilenet_v2)만
 *   node scripts/download-models.mjs --all      # mobilenet_v2(고정확도)까지
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://storage.googleapis.com/tfjs-models/savedmodel/';

const MODELS = [
  { id: 'coco-ssd-lite', remote: 'ssdlite_mobilenet_v2', default: true },
  { id: 'coco-ssd-mobilenet-v2', remote: 'ssd_mobilenet_v2', default: false },
];

const all = process.argv.includes('--all');
const force = process.argv.includes('--force');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

for (const model of MODELS) {
  if (!model.default && !all) continue;
  const outDir = join(ROOT, 'public', 'models', model.id);
  const modelJsonPath = join(outDir, 'model.json');
  if (!force && (await exists(modelJsonPath))) {
    console.log(`[skip] ${model.id} (이미 존재, 다시 받으려면 --force)`);
    continue;
  }
  await mkdir(outDir, { recursive: true });
  const baseUrl = `${BASE}${model.remote}/`;
  console.log(`[download] ${model.id} ← ${baseUrl}model.json`);
  const json = await fetchBuffer(`${baseUrl}model.json`);
  const manifest = JSON.parse(json.toString('utf8'));
  const paths = manifest.weightsManifest.flatMap((g) => g.paths);
  for (const p of paths) {
    const target = join(outDir, p);
    await mkdir(dirname(target), { recursive: true });
    const buf = await fetchBuffer(baseUrl + p);
    await writeFile(target, buf);
    console.log(`  - ${p} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  }
  await writeFile(modelJsonPath, json);
  console.log(`[done] ${model.id}`);
}
