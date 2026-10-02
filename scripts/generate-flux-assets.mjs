import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, Path2D } from '@napi-rs/canvas';

const ROOT = path.resolve('assets/branding/flux/icons');
const ORANGE = '#FF7A1A';
const CHARCOAL = '#0B0B0F';
const RIBBON = new Path2D('M64 302C106 302 123 228 163 171c29-41 61-64 100-64 45 0 69 25 94 64 26 40 50 75 91 75 32 0 57-18 76-52l45 27c-31 56-72 84-123 84-77 0-111-51-143-99-20-31-34-43-60-43-23 0-40 16-60 45-36 52-64 150-142 150-33 0-61-15-85-42l43-39c12 12 25 18 39 18Z');

mkdirSync(ROOT, { recursive: true });

function draw(size, background) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  if (background) {
    context.fillStyle = CHARCOAL;
    context.roundRect(0, 0, size, size, Math.round(size * 0.22));
    context.fill();
  }
  const scale = size / 620;
  context.save();
  context.translate(size * 0.055, size * 0.12);
  context.scale(scale, scale);
  context.fillStyle = ORANGE;
  context.fill(RIBBON);
  context.restore();
  return canvas.toBuffer('image/png');
}

const iconSizes = [1024, 512, 256, 192];
for (const size of iconSizes) writeFileSync(path.join(ROOT, `app-icon-${size}.png`), draw(size, true));

const faviconSizes = [64, 48, 32, 24, 16];
for (const size of faviconSizes) writeFileSync(path.join(ROOT, `favicon-${size}.png`), draw(size, true));
for (const size of faviconSizes) writeFileSync(path.join(ROOT, `symbol-${size}.png`), draw(size, false));

const icoPngs = [16, 32, 48].map((size) => ({ size, data: readFileSync(path.join(ROOT, `favicon-${size}.png`)) }));
const header = Buffer.alloc(6 + icoPngs.length * 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(icoPngs.length, 4);
let offset = header.length;
for (const [index, icon] of icoPngs.entries()) {
  const at = 6 + index * 16;
  header.writeUInt8(icon.size === 256 ? 0 : icon.size, at);
  header.writeUInt8(icon.size === 256 ? 0 : icon.size, at + 1);
  header.writeUInt8(0, at + 2); header.writeUInt8(0, at + 3);
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(icon.data.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += icon.data.length;
}
writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([header, ...icoPngs.map((icon) => icon.data)]));
console.log(`Generated ${iconSizes.length + faviconSizes.length * 2 + 1} Flux raster assets in ${ROOT}`);
