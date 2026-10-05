import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve('assets/branding/forge');
const pngSignature = '89504e470d0a1a0a';

function read(relativePath) {
  return readFileSync(path.join(root, relativePath));
}

async function inspectPng(relativePath, width, height, transparentCorner) {
  const image = await loadImage(read(relativePath));
  assert.equal(image.width, width, `${relativePath} width`);
  assert.equal(image.height, height, `${relativePath} height`);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const alpha = context.getImageData(0, 0, 1, 1).data[3];
  const centerAlpha = context.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data[3];
  if (transparentCorner) {
    assert.equal(alpha, 0, `${relativePath} corner transparency`);
  } else {
    assert.equal(centerAlpha, 255, `${relativePath} center opacity`);
  }
}

const svgFiles = [
  'master/furypipe-forge-symbol.svg',
  'master/furypipe-forge-wordmark.svg',
  'variants/furypipe-logo-dark.svg',
  'variants/furypipe-logo-light.svg',
  'variants/furypipe-logo-monochrome-dark.svg',
  'variants/furypipe-logo-monochrome-light.svg',
  'variants/furypipe-logo-transparent.svg',
  'variants/furypipe-symbol-white.svg',
  'variants/furypipe-symbol-black.svg',
  'variants/furypipe-favicon.svg',
  'variants/furypipe-app-icon.svg',
];

for (const relativePath of svgFiles) {
  const source = read(relativePath).toString('utf8');
  assert.match(source, /<svg\b/u, `${relativePath} svg root`);
  assert.doesNotMatch(source, /<(image|foreignObject)\b/iu, `${relativePath} remains vector source`);
  assert.doesNotMatch(source, /<(linearGradient|radialGradient|filter)\b/iu, `${relativePath} remains flat`);
}

const wordmark = read('master/furypipe-forge-wordmark.svg').toString('utf8');
assert.doesNotMatch(wordmark, /<text\b/iu, 'master wordmark is path-only');
assert.match(wordmark, /#FF6A00/u, 'wordmark uses Forge Orange');
assert.match(wordmark, /#F5F4F0/u, 'wordmark uses Off White');
const symbol = read('master/furypipe-forge-symbol.svg').toString('utf8');
assert.match(symbol, /#FF6A00/u, 'symbol uses Forge Orange');
assert.match(symbol, /#F5F4F0/u, 'symbol uses Off White');

for (const size of [1024, 512, 256, 192]) await inspectPng(`icons/app-icon-${size}.png`, size, size, false);
for (const size of [256, 128, 64, 48, 32, 24, 20, 16]) {
  await inspectPng(`icons/favicon-${size}.png`, size, size, false);
  await inspectPng(`icons/symbol-${size}.png`, size, size, true);
}
await inspectPng('icons/wordmark-transparent.png', 900, 230, true);
await inspectPng('icons/wordmark-dark.png', 900, 230, false);
await inspectPng('icons/wordmark-light.png', 900, 230, false);
await inspectPng('icons/symbol-monochrome-white-512.png', 512, 512, true);
await inspectPng('icons/symbol-monochrome-black-512.png', 512, 512, true);

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

console.log('FORGE_03_ASSET_VALIDATION=PASS');
