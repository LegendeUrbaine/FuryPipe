import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve('assets/branding/flux');
const pngSignature = '89504e470d0a1a0a';

function read(relativePath) {
  return readFileSync(path.join(root, relativePath));
}

async function inspectPng(relativePath, size, transparentCorner) {
  const image = await loadImage(read(relativePath));
  assert.equal(image.width, size, `${relativePath} width`);
  assert.equal(image.height, size, `${relativePath} height`);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const alpha = context.getImageData(0, 0, 1, 1).data[3];
  assert.equal(alpha === 0, transparentCorner, `${relativePath} corner transparency`);
}

for (const relativePath of [
  'master/furypipe-flux-symbol.svg',
  'master/furypipe-flux-wordmark.svg',
  'variants/furypipe-logo-dark.svg',
  'variants/furypipe-logo-light.svg',
  'variants/furypipe-symbol-white.svg',
  'variants/furypipe-symbol-black.svg',
  'variants/furypipe-favicon.svg',
]) {
  const source = read(relativePath).toString('utf8');
  assert.match(source, /<svg\b/u, `${relativePath} svg root`);
  assert.doesNotMatch(source, /<(image|foreignObject)\b/iu, `${relativePath} remains vector source`);
  assert.doesNotMatch(source, /<(linearGradient|radialGradient|filter)\b/iu, `${relativePath} remains flat`);
}

const master = read('master/furypipe-flux-symbol.svg').toString('utf8');
assert.match(master, /#FF7A1A/u, 'master uses Flux orange');
assert.match(master, /viewBox="0 0 512 420"/u, 'master keeps canonical geometry');

for (const size of [1024, 512, 256, 192]) await inspectPng(`icons/app-icon-${size}.png`, size, true);
for (const size of [64, 48, 32, 24, 16]) {
  await inspectPng(`icons/favicon-${size}.png`, size, true);
  await inspectPng(`icons/symbol-${size}.png`, size, true);
}

const ico = read('icons/favicon.ico');
assert.equal(ico.readUInt16LE(0), 0, 'ico reserved field');
assert.equal(ico.readUInt16LE(2), 1, 'ico type');
assert.equal(ico.readUInt16LE(4), 3, 'ico image count');
for (let index = 0; index < 3; index += 1) {
  const entry = 6 + index * 16;
  const length = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  assert.equal(ico.subarray(offset, offset + 8).toString('hex'), pngSignature, `ico entry ${index} png payload`);
  assert.equal(offset + length <= ico.length, true, `ico entry ${index} bounds`);
}

console.log('FLUX_ASSET_VALIDATION=PASS');
