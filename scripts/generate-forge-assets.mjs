import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, Path2D } from '@napi-rs/canvas';

const ROOT = path.resolve('assets/branding/forge/icons');
const ORANGE = '#FF6A00';
const BLACK = '#0B0D10';
const OFF_WHITE = '#F5F4F0';

const SYMBOL_ORANGE = new Path2D('M48 18H230L190 62H10Z');
const SYMBOL_BODY = [
  new Path2D('M26 64H92L54 101H26Z'),
  new Path2D('M26 126L58 97H184L153 131H91L80 142V173L53 201L26 224Z'),
];

const WORDMARK = [
  { fill: ORANGE, rule: 'nonzero', d: 'M73 24H241L205 60H36Z' },
  { fill: OFF_WHITE, rule: 'nonzero', d: 'M53 64H112L78 98L53 120Z' },
  { fill: OFF_WHITE, rule: 'nonzero', d: 'M53 126L82 97H184L153 131H91L80 142V173L53 201Z' },
  { fill: OFF_WHITE, rule: 'nonzero', d: 'M176 89H212V143L222 153H256L267 143V89H293V158L274 177H204L176 158Z' },
  { fill: OFF_WHITE, rule: 'nonzero', d: 'M304 111L326 89H372V121H340V177H304Z' },
  { fill: OFF_WHITE, rule: 'evenodd', d: 'M381 89H488V158L425 217H383L433 168L408 164L381 144ZM411 89H457V128L443 144H433L411 128Z' },
  { fill: ORANGE, rule: 'evenodd', d: 'M477 33H608L633 64V96L605 124H530V176L498 206V68ZM501 64H579L590 76V88L578 100H545L530 116V96L501 68Z' },
  { fill: OFF_WHITE, rule: 'nonzero', d: 'M624 89H643V177H609V104Z' },
  { fill: OFF_WHITE, rule: 'evenodd', d: 'M659 89H729L745 105V160L721 177H683V213H653V108ZM683 111H715V148H691V160H683Z' },
  { fill: OFF_WHITE, rule: 'evenodd', d: 'M767 89H832L850 107V144H782V148L792 152H850V177H775L754 156V108ZM782 112H820V128H790V136H782Z' },
];

mkdirSync(ROOT, { recursive: true });

function fillSymbol(context, size, { body = OFF_WHITE, background = null, rounded = false } = {}) {
  context.clearRect(0, 0, size, size);
  if (background) {
    context.fillStyle = background;
    if (rounded) {
      context.beginPath();
      context.roundRect(0, 0, size, size, Math.round(size * 0.19));
      context.fill();
    } else {
      context.fillRect(0, 0, size, size);
    }
  }
  const scale = size / 256 * 0.78;
  context.save();
  context.translate(size * 0.11, size * 0.13);
  context.scale(scale, scale);
  context.fillStyle = ORANGE;
  context.fill(SYMBOL_ORANGE);
  context.fillStyle = body;
  for (const bodyPath of SYMBOL_BODY) context.fill(bodyPath);
  context.restore();
  return context.canvas.toBuffer('image/png');
}

function drawWordmark({ foreground = OFF_WHITE, background = null } = {}) {
  const width = 900;
  const height = 230;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  for (const glyph of WORDMARK) {
    const pathValue = new Path2D(glyph.d);
    context.fillStyle = glyph.fill === OFF_WHITE ? foreground : glyph.fill;
    context.fill(pathValue, glyph.rule);
  }
  return canvas.toBuffer('image/png');
}

for (const size of [1024, 512, 256, 192]) {
  const canvas = createCanvas(size, size);
  writeFileSync(path.join(ROOT, `app-icon-${size}.png`), fillSymbol(canvas.getContext('2d'), size, { background: BLACK, rounded: true }));
}

for (const size of [256, 128, 64, 48, 32, 24, 20, 16]) {
  const faviconCanvas = createCanvas(size, size);
  writeFileSync(path.join(ROOT, `favicon-${size}.png`), fillSymbol(faviconCanvas.getContext('2d'), size, { background: BLACK, rounded: true }));
  const symbolCanvas = createCanvas(size, size);
  writeFileSync(path.join(ROOT, `symbol-${size}.png`), fillSymbol(symbolCanvas.getContext('2d'), size));
}

const monochromeWhite = createCanvas(512, 512);
writeFileSync(path.join(ROOT, 'symbol-monochrome-white-512.png'), fillSymbol(monochromeWhite.getContext('2d'), 512, { body: OFF_WHITE }));
const monochromeBlack = createCanvas(512, 512);
writeFileSync(path.join(ROOT, 'symbol-monochrome-black-512.png'), fillSymbol(monochromeBlack.getContext('2d'), 512, { body: BLACK }));
writeFileSync(path.join(ROOT, 'wordmark-transparent.png'), drawWordmark());
writeFileSync(path.join(ROOT, 'wordmark-dark.png'), drawWordmark({ background: BLACK }));
writeFileSync(path.join(ROOT, 'wordmark-light.png'), drawWordmark({ foreground: BLACK, background: '#F5F4F0' }));

const icoPngs = [16, 32, 48].map((size) => ({ size, data: requirePng(size) }));
const header = Buffer.alloc(6 + icoPngs.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoPngs.length, 4);
let offset = header.length;
for (const [index, icon] of icoPngs.entries()) {
  const at = 6 + index * 16;
  header.writeUInt8(icon.size, at);
  header.writeUInt8(icon.size, at + 1);
  header.writeUInt8(0, at + 2);
  header.writeUInt8(0, at + 3);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(icon.data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += icon.data.length;
}
writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([header, ...icoPngs.map((icon) => icon.data)]));

function requirePng(size) {
  const canvas = createCanvas(size, size);
  return fillSymbol(canvas.getContext('2d'), size, { background: BLACK, rounded: true });
}

console.log(`Generated FORGE 03 raster assets in ${ROOT}`);
