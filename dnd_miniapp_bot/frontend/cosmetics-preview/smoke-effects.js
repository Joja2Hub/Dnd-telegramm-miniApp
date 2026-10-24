(() => {
  'use strict';

  const SIZE = 256;
  const SPAN = 152;
  const HALF = SPAN / 2;
  const clamp = n => Math.max(0, Math.min(1, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  const gaussian = (x, width) => Math.exp(-(x * x) / (width * width));

  const definitions = [
    {
      id: 'nebula-smoke', name: 'Перламутровая туманность', mode: 'nebula',
      palette: ['#bd89f5', '#5fafe1', '#efb8d5'],
      colors: [[67, 34, 117], [145, 87, 216], [87, 181, 222], [233, 147, 196], [220, 204, 246]],
      density: 1.45, speed: .5, layout: 'космическое облако',
      short: 'Сиреневые складки переходят в голубой и розовый, расступаясь у лица.',
      description: 'Асимметричная туманность медленно переливается внутри собственных завихрений. Плотные складки соседствуют с почти прозрачными просветами; цвет течёт сквозь облако, не вращаясь кольцом.',
    },
    {
      id: 'jade-smoke', name: 'Нефритовый дурман', mode: 'bowl',
      palette: ['#88cdb3', '#337f91', '#d2dfa2'],
      colors: [[25, 70, 72], [53, 140, 123], [126, 197, 166], [181, 201, 132], [202, 230, 198]],
      density: 1.45, speed: .45, layout: 'медленные клубы снизу',
      short: 'Зелёная дымка собирается снизу и мягкими клубами поднимается вдоль краёв.',
      description: 'Тяжёлый нефритовый дым наполняет нижнюю часть композиции, затем редеет и закручивается по бокам. Тёмная бирюза в глубине переходит в светлый шалфей на тонких краях.',
    },
    {
      id: 'ink-smoke', name: 'Чернильное облако', mode: 'ink',
      palette: ['#9982ce', '#45355d', '#9f9acb'],
      colors: [[20, 18, 32], [49, 36, 73], [94, 65, 132], [125, 105, 166], [172, 158, 200]],
      density: 1.9, speed: .3, layout: 'густой нисходящий дым',
      short: 'Тёмный дым медленно стекает по одной стороне; лиловый свет проступает в складках.',
      description: 'Более плотный и тёмный характер: чернильные клубы опускаются вниз, выворачиваются и рассеиваются. Свет появляется внутри облака, не очерчивая его неоновой линией.',
    },
    {
      id: 'silver-smoke', name: 'Серебряный водопад', mode: 'cascade',
      palette: ['#c1d2df', '#91a3c1', '#e8dbe2'],
      colors: [[61, 77, 104], [126, 150, 180], [192, 206, 218], [205, 184, 210], [237, 238, 232]],
      density: 1.4, speed: .55, layout: 'нисходящая дымовая волна',
      short: 'Серебристый дым переливается через верхний край и мягко стекает по бокам.',
      description: 'Холодный пар ниспадает, а не поднимается: над головой он плотнее, по бокам вытягивается и истончается. Стальной, молочный и едва розовый оттенки сменяются без ярких вспышек.',
    },
  ];

  const palettes = [
    { id: 'cosmos', name: 'Космос', colors: [[48, 27, 105], [128, 75, 202], [78, 172, 214], [219, 119, 185], [225, 193, 244]] },
    { id: 'sorbet', name: 'Розовый лёд', colors: [[56, 75, 121], [106, 181, 214], [193, 143, 204], [238, 167, 193], [235, 225, 244]] },
    { id: 'lagoon', name: 'Лагуна', colors: [[20, 57, 88], [28, 114, 148], [81, 188, 177], [151, 203, 166], [205, 239, 221]] },
    { id: 'sunset', name: 'Закат', colors: [[57, 33, 98], [118, 63, 157], [211, 99, 137], [226, 167, 103], [242, 208, 178]] },
    { id: 'copper', name: 'Медь и бирюза', colors: [[36, 70, 80], [62, 140, 143], [173, 114, 89], [216, 178, 128], [220, 227, 205]] },
    { id: 'poison', name: 'Зелье', colors: [[31, 52, 62], [57, 118, 91], [149, 183, 96], [119, 117, 167], [218, 226, 174]] },
    { id: 'pearl', name: 'Жемчуг', colors: [[79, 99, 125], [149, 183, 199], [203, 176, 204], [219, 206, 176], [239, 242, 238]] },
    { id: 'monochrome', name: 'Белый пар', colors: [[87, 103, 119], [151, 169, 182], [201, 213, 220], [220, 224, 226], [246, 248, 246]] },
  ];

  const effects = definitions.map((effect, i) => ({
    ...effect, kind: 'smoke', category: 'smoke', isNew: false,
    code: `SM${String(i + 1).padStart(2, '0')}`,
    loop: 'непрерывное течение',
    tags: ['дым', 'пар', 'туманность', 'переливы'],
  }));

  function normalizeSettings(value = {}) {
    const number = (n, min, max) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 1;
    const customColors = Array.isArray(value?.customColors) && value.customColors.length === 3
      && value.customColors.every(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) ? [...value.customColors] : null;
    const palette = value?.palette === 'custom' && customColors ? 'custom'
      : palettes.some(p => p.id === value?.palette) ? value.palette : '';
    return { density: number(value?.density, .4, 1.8), speed: number(value?.speed, .3, 1.8), palette, customColors };
  }

  function createPreferences(storage) {
    const key = 'fx-lab-smoke-settings-v1';
    let saved = {};
    try {
      storage ??= window.localStorage;
      saved = JSON.parse(storage?.getItem(key) || '{}') || {};
    } catch { /* Private browsing can disable local storage. */ }
    const settings = Object.fromEntries(effects.map(effect => [effect.id, normalizeSettings(saved[effect.id])]));
    return {
      get(id) { return settings[id] || normalizeSettings(); },
      set(id, patch) {
        if (!Object.hasOwn(settings, id)) return;
        settings[id] = normalizeSettings({ ...settings[id], ...patch });
        try { storage?.setItem(key, JSON.stringify(settings)); } catch { /* Keep in-memory settings usable. */ }
      },
    };
  }

  function colorsFor(effect, options = {}) {
    if (options.palette === 'custom' && options.customColors?.length === 3) {
      const stops = options.customColors.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
      return [stops[0].map(c => c * .4), ...stops, stops[2].map(c => mix(c, 255, .28))];
    }
    return palettes.find(p => p.id === options.palette)?.colors || effect.colors;
  }

  function sample(field, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const row = (iy & 255) << 8, next = ((iy + 1) & 255) << 8;
    return mix(mix(field[row + (ix & 255)], field[row + ((ix + 1) & 255)], u),
      mix(field[next + (ix & 255)], field[next + ((ix + 1) & 255)], u), v);
  }

  function fbm(field, x, y) {
    return sample(field, x, y) * .52
      + sample(field, x * 2.03 + 23.7, y * 2.03 + 19.2) * .27
      + sample(field, x * 4.11 + 71.3, y * 4.11 + 41.4) * .14
      + sample(field, x * 8.23 + 133.7, y * 8.23 + 91.2) * .07;
  }

  function silhouette(mode, x, y, radius) {
    const angle = Math.atan2(y, x);
    switch (mode) {
      case 'nebula': {
        const ridge = 40 + Math.sin(angle * 3 + .7) * 3;
        const width = 6.8 + 2.8 * Math.sin(angle * 2 - .7);
        const lobes = .51 + .39 * Math.sin(angle * 2 + .6);
        return gaussian(radius - ridge, width) * lobes
          + .45 * gaussian(x + 31, 14) * gaussian(y + 28, 12);
      }
      case 'bowl':
        return gaussian(radius - 39.5, 7.8) * smooth(-17, 24, y)
          + .23 * gaussian(x + 36, 6) * gaussian(y, 25);
      case 'ink':
        return gaussian(x - (34 + Math.sin(y * .11) * 5), 6.5 + (y + 40) * .045)
          * gaussian(y - 2, 37) + .32 * gaussian(radius - 39, 6) * smooth(22, 37, y);
      case 'cascade':
        return gaussian(radius - 40, 5.7) * smooth(-16, 29, -y)
          + .55 * gaussian(x - 38 + Math.sin(y * .1) * 3, 4.6) * gaussian(y, 30);
      default: return 0;
    }
  }

  function cacheFor(renderer) {
    if (renderer.smokeCache) return renderer.smokeCache;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { alpha: true });
    const field = new Float32Array(65536);
    let seed = (renderer.seed + 1677619) >>> 0;
    for (let i = 0; i < field.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      field[i] = (seed >>> 0) / 4294967296;
    }
    const geometry = new Float32Array(SIZE * SIZE * 4);
    const mode = renderer.effect.mode;
    for (let py = 0; py < SIZE; py++) {
      const y = (py + .5) / SIZE * SPAN - HALF;
      for (let px = 0; px < SIZE; px++) {
        const x = (px + .5) / SIZE * SPAN - HALF;
        const radius = Math.hypot(x, y), at = (py * SIZE + px) * 4;
        geometry[at] = x;
        geometry[at + 1] = y;
        geometry[at + 2] = silhouette(mode, x, y, radius)
          * smooth(28, 36, radius) * (1 - smooth(56, 69, radius));
        geometry[at + 3] = radius;
      }
    }
    renderer.smokeCache = { canvas, ctx, field, geometry,
      image: ctx.createImageData(SIZE, SIZE), frame: -1, avatar: '', settings: '' };
    return renderer.smokeCache;
  }

  function renderTexture(renderer, time) {
    const cache = cacheFor(renderer), effect = renderer.effect;
    const options = renderer.smokeOptions || {};
    const frame = Math.floor(time * 30);
    const settingsKey = `${options.density ?? 1}:${options.speed ?? 1}:${options.palette ?? ''}:${options.customColors?.join(',') || ''}`;
    if (cache.frame === frame && cache.avatar === renderer.avatar && cache.settings === settingsKey) return cache;
    const t = frame / 30, flow = t * effect.speed;
    const densityScale = effect.density * (options.density ?? 1);
    const field = cache.field, geometry = cache.geometry, pixels = cache.image.data;
    const mode = effect.mode;
    const colors = colorsFor(effect, options);
    for (let i = 0; i < pixels.length; i += 4) {
      const x = geometry[i], y = geometry[i + 1];
      const envelope = geometry[i + 2];
      if (envelope < .001) { pixels[i + 3] = 0; continue; }

      // Advected, domain-warped density: the folds move through the cloud,
      // instead of moving the entire cloud or orbiting a particle sprite.
      let u = x * .075, v = y * .075;
      if (mode === 'ink' || mode === 'cascade') v -= flow * .65;
      else { v += flow * .7; u += flow * .13; }
      const wx = sample(field, u * .65 + 27, v * .65 + flow * .12);
      const wy = sample(field, u * .65 + 71, v * .65 - flow * .1);
      const qx = u + (wx - .5) * 3.6, qy = v + (wy - .5) * 3.6;
      const n = fbm(field, qx, qy);
      const ridge = 1 - Math.abs(fbm(field, qx + 9.2, qy + 4.7) * 2 - 1);
      const structure = smooth(.22, .78, n);
      const filament = Math.pow(ridge, 10) * .38;
      const mass = structure * (.64 + filament);
      const alpha = 1 - Math.exp(-envelope * mass * densityScale * 1.8);
      if (alpha < .002) { pixels[i + 3] = 0; continue; }

      const hue = (Math.sin(x * .034 + y * .021 + flow * .23 + wx * 1.7) * .5 + .5) * 2.999;
      const segment = Math.floor(hue), blend = smooth(0, 1, hue - segment);
      const light = smooth(.39, .77, n) * .5 + filament * .6;
      const shade = .59 + structure * .41;
      for (let channel = 0; channel < 3; channel++) {
        const pigment = mix(colors[segment][channel], colors[segment + 1][channel], blend);
        pixels[i + channel] = mix(pigment * shade, colors[4][channel], light);
      }
      pixels[i + 3] = Math.min(.88, alpha) * 255;
    }
    cache.ctx.putImageData(cache.image, 0, 0);
    cache.frame = frame;
    cache.avatar = renderer.avatar;
    cache.settings = settingsKey;
    return cache;
  }

  function draw(renderer, time) {
    const speed = renderer.smokeOptions?.speed ?? 1;
    const clock = renderer.smokeClock ||= { previous: time, current: time };
    clock.current += Math.max(0, time - clock.previous) * speed;
    clock.previous = time;
    const cache = renderTexture(renderer, clock.current);
    renderer.back.drawImage(cache.canvas, -HALF, -HALF, SPAN, SPAN);
    // The portrait occludes the back layer; only smoke crossing its edge is
    // redrawn in front. This avoids doubling opacity outside the avatar.
    renderer.front.save();
    renderer.front.beginPath();
    renderer.front.arc(0, 0, 37.75, 0, Math.PI * 2);
    renderer.front.clip();
    renderer.front.drawImage(cache.canvas, -HALF, -HALF, SPAN, SPAN);
    renderer.front.restore();
  }

  window.FXSmoke = Object.freeze({ effects, palettes, draw, createPreferences, colorsFor });
})();
