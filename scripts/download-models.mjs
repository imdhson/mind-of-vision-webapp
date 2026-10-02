import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const all = process.argv.includes('--all');
const models = [
  ['coco-ssd-lite', 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json'],
  ...(all ? [['coco-ssd-mobilenet-v2', 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json']] : [])
];

async function download(url, out) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
}

for (const [id, modelUrl] of models) {
  const dir = path.resolve('public/models', id);
  await mkdir(dir, { recursive: true });
  console.log(`Downloading ${id}...`);
  const modelRes = await fetch(modelUrl);
  if (!modelRes.ok) throw new Error(`${modelRes.status} ${modelUrl}`);
  const json = await modelRes.json();
  await writeFile(path.join(dir, 'model.json'), JSON.stringify(json));
  const base = new URL('.', modelUrl);
  const shards = new Set();
  for (const group of json.weightsManifest ?? []) for (const p of group.paths ?? []) shards.add(p);
  for (const shard of shards) {
    const out = path.join(dir, shard);
    await mkdir(path.dirname(out), { recursive: true });
    await download(new URL(shard, base).toString(), out);
  }
  console.log(`Saved ${id} to ${dir}`);
}
