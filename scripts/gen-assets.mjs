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

function pngIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const mix = (a, b, amount) => Math.round(a + (b - a) * amount);
  const distanceToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length)) : 0;
    const x = x1 + t * dx;
    const y = y1 + t * dy;
    return Math.hypot(px - x, py - y);
  };
  const roundedBoxDistance = (px, py, width, height, radius) => {
    const qx = Math.abs(px - 0.5) - width / 2 + radius;
    const qy = Math.abs(py - 0.5) - height / 2 + radius;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  };
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;
      const box = roundedBoxDistance(px, py, 0.82, 0.82, 0.17);
      let color = [22, 27, 38];
      let alpha = box <= 0 ? 1 : Math.max(0, Math.min(1, 1 - box * size / 1.4));
      if (box <= 0) {
        const shade = Math.min(1, Math.max(0, (px + py - 0.22) * 0.62));
        color = [mix(27, 49, shade), mix(32, 39, shade), mix(45, 76, shade)];
        if (box > -0.018) {
          const edge = Math.max(0, Math.min(1, (box + 0.018) / 0.018));
          color = [mix(86, color[0], edge), mix(91, color[1], edge), mix(145, color[2], edge)];
        }

        const ring = Math.abs(Math.hypot(px - 0.5, py - 0.5) - 0.275);
        if (ring < 0.032) {
          const ringColor = px + py < 1 ? [165, 158, 240] : [86, 190, 210];
          const ringAmount = Math.max(0, Math.min(1, (0.032 - ring) * size / 2.2));
          color = color.map((value, index) => mix(value, ringColor[index], ringAmount));
        }

        const handOne = distanceToSegment(px, py, 0.5, 0.5, 0.5, 0.335);
        const handTwo = distanceToSegment(px, py, 0.5, 0.5, 0.625, 0.5);
        if (Math.min(handOne, handTwo) < 0.028) color = [236, 238, 245];
        if (Math.hypot(px - 0.5, py - 0.5) < 0.045) color = [236, 238, 245];

        const dot = Math.hypot(px - 0.725, py - 0.27);
        if (dot < 0.045) color = [76, 194, 215];
      }
      raw[o++] = color[0];
      raw[o++] = color[1];
      raw[o++] = color[2];
      raw[o++] = Math.round(255 * alpha);
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

fs.writeFileSync(path.join(pub, 'icon.png'), pngIcon(256));
fs.writeFileSync(path.join(pub, 'tray.png'), pngIcon(32));

const rate = 44100;
const seconds = 1.02;
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

const notes = [
  { at: 0, frequency: 523.25, gain: 0.17, duration: 0.82 },
  { at: 0.09, frequency: 659.25, gain: 0.13, duration: 0.86 },
  { at: 0.18, frequency: 783.99, gain: 0.09, duration: 0.92 },
];

function bell(t, note) {
  const local = t - note.at;
  if (local < 0 || local > note.duration) return 0;
  const attack = Math.min(1, local / 0.035);
  const release = Math.exp(-3.5 * (local / note.duration));
  const fade = Math.min(1, (seconds - t) / 0.05);
  const fundamental = Math.sin(2 * Math.PI * note.frequency * local);
  const harmonic = Math.sin(2 * Math.PI * note.frequency * 2 * local) * 0.1;
  return (fundamental + harmonic) * attack * release * fade * note.gain;
}

for (let i = 0; i < n; i++) {
  const t = i / rate;
  const sample = notes.reduce((value, note) => value + bell(t, note), 0);
  const value = Math.max(-1, Math.min(1, sample));
  samples.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}

fs.writeFileSync(path.join(pub, 'sounds', 'chime.wav'), samples);
console.log('assets written');
