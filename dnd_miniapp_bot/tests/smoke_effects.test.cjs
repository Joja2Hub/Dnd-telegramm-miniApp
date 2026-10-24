const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

function context2d() {
  return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, drawImage() {}, save() {}, beginPath() {}, arc() {}, clip() {}, restore() {} };
}
const sandbox = { Math, Float32Array, Uint8ClampedArray,
  window: {}, document: { createElement: () => ({ getContext: () => context2d() }) } };
vm.compileFunction(fs.readFileSync(path.join(__dirname, '../frontend/cosmetics-preview/smoke-effects.js'), 'utf8'),
  ['window', 'document'])(sandbox.window, sandbox.document);
const library = sandbox.window.FXSmoke;
function renderer(effect, avatar = 'fantasy') {
  return { effect, avatar, seed: 4811, back: context2d(), front: context2d(), smokeOptions: { density: 1, speed: 1 } };
}
function stats(r) {
  const p = r.smokeCache.image.data;
  let alpha = 0, active = 0, checksum = 0;
  for (let i = 0; i < p.length; i += 4) {
    alpha += p[i + 3];
    if (p[i + 3]) active++;
    checksum = (checksum + (p[i] + p[i + 1] * 3 + p[i + 2] * 7 + p[i + 3] * 11) * (i + 1)) >>> 0;
  }
  return { alpha, active, checksum, center: p[(128 * 256 + 128) * 4 + 3] };
}

test('only the four selected smoke effects remain', () => {
  assert.deepEqual(library.effects.map(e => e.id), ['nebula-smoke', 'jade-smoke', 'ink-smoke', 'silver-smoke']);
  assert.equal(new Set(library.effects.map(e => e.mode)).size, 4);
  assert.ok(library.effects.every(e => e.kind === 'smoke' && e.category === 'smoke'));
  const html = fs.readFileSync(path.join(__dirname, '../frontend/cosmetics-preview/index.html'), 'utf8');
  assert.match(html, /smoke-effects\.js/);
  assert.doesNotMatch(html, /magic-effects\.js/);
});

for (const effect of library.effects) {
  test(`${effect.id}: transparent, nonempty, moving texture`, () => {
    const r = renderer(effect), time = effect.previewTime ?? 3.7;
    library.draw(r, time);
    const initial = stats(r), p = r.smokeCache.image.data;
    assert.ok(initial.active > 200, `empty texture: ${initial.active}`);
    for (const i of [0, 255, 255 * 256, 65535]) assert.equal(p[i * 4 + 3], 0);
    assert.equal(initial.center, 0, 'face is obscured');
    library.draw(r, time + .6);
    assert.notEqual(stats(r).checksum, initial.checksum, 'texture did not change');
    const frozen = stats(r).checksum;
    library.draw(r, time + .6);
    assert.equal(stats(r).checksum, frozen, 'paused texture changed');
  });
}

test('density changes opacity, speed changes do not jump the smoke clock', () => {
  const r = renderer(library.effects[0]);
  library.draw(r, 3.7);
  const initial = stats(r).alpha;
  r.smokeOptions.density = 1.6;
  library.draw(r, 3.7);
  assert.ok(stats(r).alpha > initial * 1.2);
  r.smokeOptions.speed = .3;
  library.draw(r, 3.7);
  assert.equal(r.smokeClock.current, 3.7);
  library.draw(r, 4.7);
  assert.ok(Math.abs(r.smokeClock.current - 4) < .001);
});

test('texture generation benchmark', () => {
  const r = renderer(library.effects[0]);
  library.draw(r, 0);
  const start = performance.now();
  for (let i = 1; i <= 12; i++) library.draw(r, i / 20);
  console.log(`Smoke texture: ${((performance.now() - start) / 12).toFixed(1)} ms/frame (Node VM)`);
});

test('all eight gradients change colour without changing smoke opacity', () => {
  const r = renderer(library.effects[0]);
  library.draw(r, 3.7);
  const alpha = stats(r).alpha, hashes = new Set();
  assert.equal(library.palettes.length, 8);
  for (const palette of library.palettes) {
    r.smokeOptions.palette = palette.id;
    library.draw(r, 3.7);
    assert.equal(stats(r).alpha, alpha);
    hashes.add(stats(r).checksum);
  }
  assert.equal(hashes.size, 8);
});

test('custom colours invalidate the texture while preserving opacity', () => {
  const r = renderer(library.effects[0]);
  library.draw(r, 3.7);
  const before = stats(r);
  r.smokeOptions = { density: 1, speed: 1, palette: 'custom', customColors: ['#ff3300', '#f0d047', '#b32835'] };
  library.draw(r, 3.7);
  assert.equal(stats(r).alpha, before.alpha);
  assert.notEqual(stats(r).checksum, before.checksum);
});

test('settings are independent and survive reloading', () => {
  let saved;
  const storage = { getItem: () => saved, setItem: (_, data) => { saved = data; } };
  const store = library.createPreferences(storage);
  store.set('nebula-smoke', { density: 1.5, speed: .7, palette: 'custom', customColors: ['#335577', '#449988', '#ddbbff'] });
  store.set('jade-smoke', { density: .8, palette: 'sunset' });
  const restored = library.createPreferences(storage);
  assert.equal(restored.get('nebula-smoke').speed, .7);
  assert.equal(restored.get('nebula-smoke').density, 1.5);
  assert.equal(restored.get('nebula-smoke').palette, 'custom');
  assert.deepEqual(restored.get('nebula-smoke').customColors, ['#335577', '#449988', '#ddbbff']);
  assert.equal(restored.get('jade-smoke').density, .8);
  assert.equal(restored.get('jade-smoke').speed, 1);
  assert.equal(restored.get('ink-smoke').density, 1);
  store.set('removed-effect', { density: 1.5 });
  assert.equal(Object.keys(JSON.parse(saved)).length, 4);
});

test('invalid saved values and unavailable storage are safe', () => {
  const stored = JSON.stringify({ 'nebula-smoke': {density: 99, speed: -1, palette: 'custom', customColors: ['bad'] } });
  const store = library.createPreferences({ getItem: () => stored });
  assert.equal(store.get('nebula-smoke').density, 1.8);
  assert.equal(store.get('nebula-smoke').speed, .3);
  assert.equal(store.get('nebula-smoke').palette, '');
  assert.equal(library.createPreferences({ getItem: () => 'bad JSON' }).get('nebula-smoke').density, 1);
  const blocked = library.createPreferences({ getItem() { throw Error('unavailable'); }, setItem() { throw Error('unavailable'); } });
  blocked.set('silver-smoke', {speed: .5});
  assert.equal(blocked.get('silver-smoke').speed, .5);
});
