/**
 * Generates the assets that are not the icon of the application.
 *
 * The icon itself is a tracked file, public/icon.png, and the tray icon is
 * derived from it, so both always show the same drawing.
 */
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

/** Reads a PNG of eight bits per channel and returns its pixels. */
function readPng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('not a PNG file');
  let width = 0;
  let height = 0;
  let colorType = 6;
  let interlace = 0;
  const parts = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('the icon must have eight bits per channel');
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      parts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (interlace !== 0) throw new Error('an interlaced icon cannot be read');
  if (colorType !== 6 && colorType !== 2) throw new Error(`the icon has an unexpected color type: ${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let previous = Buffer.alloc(stride);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[source++];
    const line = Buffer.from(raw.subarray(source, source + stride));
    source += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + left) & 0xff;
      else if (filter === 2) line[x] = (line[x] + up) & 0xff;
      else if (filter === 3) line[x] = (line[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const nearest = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        line[x] = (line[x] + nearest) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`the icon uses an unknown filter: ${filter}`);
      }
    }
    line.copy(pixels, y * stride);
    previous = line;
  }
  if (channels === 4) return { width, height, pixels };
  // The pixels without an alpha channel are opaque.
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = pixels[i * 3];
    rgba[i * 4 + 1] = pixels[i * 3 + 1];
    rgba[i * 4 + 2] = pixels[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, pixels: rgba };
}

/**
 * Reduces an image with a box filter, so every pixel is the average of the
 * ones it covers.
 */
function resize(image, size) {
  const out = Buffer.alloc(size * size * 4);
  const ratio = image.width / size;
  for (let y = 0; y < size; y++) {
    const from = Math.floor(y * ratio);
    const to = Math.max(from + 1, Math.floor((y + 1) * ratio));
    for (let x = 0; x < size; x++) {
      const left = Math.floor(x * ratio);
      const right = Math.max(left + 1, Math.floor((x + 1) * ratio));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = from; sy < to; sy++) {
        for (let sx = left; sx < right; sx++) {
          const index = (sy * image.width + sx) * 4;
          const alpha = image.pixels[index + 3] / 255;
          r += image.pixels[index] * alpha;
          g += image.pixels[index + 1] * alpha;
          b += image.pixels[index + 2] * alpha;
          a += image.pixels[index + 3];
          count += 1;
        }
      }
      const target = (y * size + x) * 4;
      const weight = a / 255;
      out[target] = weight ? Math.round(r / weight) : 0;
      out[target + 1] = weight ? Math.round(g / weight) : 0;
      out[target + 2] = weight ? Math.round(b / weight) : 0;
      out[target + 3] = Math.round(a / count);
    }
  }
  return out;
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const start = y * (size * 4 + 1);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * size * 4, (y + 1) * size * 4);
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

const icon = readPng(fs.readFileSync(path.join(pub, 'icon.png')));
// The tray icon is the same drawing at the size Windows asks for.
fs.writeFileSync(path.join(pub, 'tray.png'), encodePng(32, resize(icon, 32)));
console.log(`tray icon written from the ${icon.width}x${icon.height} icon`);

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
