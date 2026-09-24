#!/usr/bin/env node
/**
 * 의존성 없이 PNG 앱 아이콘을 생성합니다 (public/icons).
 * 디자인: 검정 배경 + 원형 사용자 마커 + 거리 링 + 객체 블록 (icon.svg 와 동일 콘셉트)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function encodePng(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { rounded, pad }) {
  const S = 512;
  const k = S / size;
  const inset = pad ? 0.12 : 0; // maskable safe zone
  return encodePng(size, (px, py) => {
    // supersampling 3x3
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < 3; sy++)
      for (let sx = 0; sx < 3; sx++) {
        const x = (px - 0.5 + (sx + 0.5) / 3) * k;
        const y = (py - 0.5 + (sy + 0.5) / 3) * k;
        const c = shade(x, y);
        acc = acc.map((v, i) => v + c[i] / 9);
      }
    return acc.map((v) => Math.round(v));
  });

  function shade(x, y) {
    const bg = [10, 10, 11, 255];
    if (rounded && !inRoundRect(x, y, 0, 0, S, S, 112)) return [0, 0, 0, 0];
    // 콘텐츠 좌표 (maskable 은 안쪽으로 축소)
    const cx = (x - S / 2) / (1 - inset * 2) + S / 2;
    const cy = (y - S / 2) / (1 - inset * 2) + S / 2;
    if (Math.hypot(cx - 256, cy - 300) <= 26) return [250, 250, 250, 255];
    if (inRoundRect(cx, cy, 318, 150, 84, 110, 16)) return [228, 228, 231, 255];
    if (inRoundRect(cx, cy, 120, 180, 64, 80, 14)) return [161, 161, 170, 255];
    const e1 = Math.abs(Math.hypot((cx - 256) / 170, (cy - 300) / 62) - 1) * 62;
    if (e1 < 5) return [63, 63, 70, 255];
    const e2 = Math.abs(Math.hypot((cx - 256) / 100, (cy - 300) / 36) - 1) * 36;
    if (e2 < 5) return [82, 82, 91, 255];
    return bg;
  }
}

function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const dx = Math.max(rx + r - x, 0, x - (rx + w - r));
  const dy = Math.max(ry + r - y, 0, y - (ry + h - r));
  return dx * dx + dy * dy <= r * r;
}

const out = [
  ['icon-192.png', 192, { rounded: true, pad: false }],
  ['icon-512.png', 512, { rounded: true, pad: false }],
  ['icon-maskable-512.png', 512, { rounded: false, pad: true }],
  ['apple-touch-icon.png', 180, { rounded: false, pad: false }],
];
for (const [name, size, opts] of out) {
  writeFileSync(join(OUT, name), drawIcon(size, opts));
  console.log('icon:', name);
}
