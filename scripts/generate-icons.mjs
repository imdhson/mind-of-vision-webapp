import { mkdir, writeFile } from 'node:fs/promises';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const body = Buffer.concat([t, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1); raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const dx = x - size / 2, dy = y - size / 2, r = Math.hypot(dx, dy);
      const ring = Math.abs(r - size * 0.27) < size * 0.055;
      const dot = r < size * 0.065;
      const v = ring || dot ? 245 : 12;
      raw[i] = raw[i+1] = raw[i+2] = v; raw[i+3] = 255;
    }
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
await mkdir('public/icons', { recursive: true });
for (const size of [192, 512]) await writeFile(`public/icons/icon-${size}.png`, png(size));
console.log('Generated icons.');
