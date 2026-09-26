import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
fs.mkdirSync(path.join(pub, 'sounds'), { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function pngCircle(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  const cx = (size - 1) / 2;
  const r = size / 2 - 1.2;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      const edge = Math.max(0, Math.min(1, r - d + 0.6));
      raw[o++] = 108;
      raw[o++] = 99;
      raw[o++] = 230;
      raw[o++] = Math.round(255 * edge);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync(path.join(pub, 'icon.png'), pngCircle(256));
fs.writeFileSync(path.join(pub, 'tray.png'), pngCircle(32));

const rate = 44100;
const seconds = 0.72;
const n = Math.floor(rate * seconds);
const samples = Buffer.alloc(44 + n * 2);
samples.write('RIFF', 0);
samples.writeUInt32LE(36 + n * 2, 4);
samples.write('WAVE', 8);
samples.write('fmt ', 12);
samples.writeUInt32LE(16, 16);
samples.writeUInt16LE(1, 20);
samples.writeUInt16LE(1, 22);
samples.writeUInt32LE(rate, 24);
samples.writeUInt32LE(rate * 2, 28);
samples.writeUInt16LE(2, 32);
samples.writeUInt16LE(16, 34);
samples.write('data', 36);
samples.writeUInt32LE(n * 2, 40);

function env(t, attack, dur) {
  if (t < 0 || t > dur) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-4.2 * ((t - attack) / (dur - attack)));
}

for (let i = 0; i < n; i++) {
  const t = i / rate;
  const a = Math.sin(2 * Math.PI * 880 * t) * env(t, 0.012, 0.34) * 0.32;
  const t2 = t - 0.15;
  const b = Math.sin(2 * Math.PI * 1318.51 * t2) * env(t2, 0.01, 0.52) * 0.26;
  const h = Math.sin(2 * Math.PI * 1760 * t2) * env(t2, 0.01, 0.4) * 0.06;
  let s = a + b + h;
  const fade = Math.min(1, (seconds - t) / 0.03);
  s *= fade;
  const v = Math.max(-1, Math.min(1, s));
  samples.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}

fs.writeFileSync(path.join(pub, 'sounds', 'chime.wav'), samples);
console.log('assets written');
