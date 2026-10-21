(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const fract = n => n - Math.floor(n);
  const smooth = (a, b, n) => { const x = clamp((n - a) / (b - a)); return x * x * (3 - 2 * x); };
  const mix = (a, b, n) => a + (b - a) * n;
  const polar = (a, r) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const color = (hex, a = 1) => `rgba(${rgb(hex).join(',')},${clamp(a)})`;
  const noise = (x, y, seed = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * .13) * 43758.5453);
  const arc = (start, length, radius, count = 48, wobble = () => 0) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const u = i / count;
      return { ...polar(start + length * u, radius + wobble(u)), t: u };
    });

  function stroke(ctx, pts, tint, width = 1, opacity = 1, glow = 0) {
    if (pts.length < 2 || opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(opacity);
    ctx.strokeStyle = tint;
    ctx.lineWidth = width;
    ctx.shadowColor = tint;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  }

  function outsideFace(ctx, radius = 34) {
    ctx.beginPath();
    ctx.rect(-120, -120, 240, 240);
    ctx.arc(0, 0, radius, 0, TAU, true);
    ctx.clip('evenodd');
  }

  function glint(ctx, x, y, size, tint, alpha) {
    if (alpha < .015) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = clamp(alpha);
    ctx.fillStyle = tint;
    ctx.shadowColor = tint;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * .1, -size * .12, size * .62, 0);
    ctx.quadraticCurveTo(size * .1, size * .12, 0, size);
    ctx.quadraticCurveTo(-size * .1, size * .12, -size * .62, 0);
    ctx.quadraticCurveTo(-size * .1, -size * .12, 0, -size);
    ctx.fill();
    ctx.restore();
  }

  function crystal(ctx, x, y, size, angle, tint, opacity = 1, aspect = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(aspect, 1);
    ctx.globalAlpha = opacity;
    const gradient = ctx.createLinearGradient(-size, -size, size, size);
    gradient.addColorStop(0, color('#f6feff', .9));
    gradient.addColorStop(.36, color(tint, .42));
    gradient.addColorStop(.56, color('#e5f5ff', .85));
    gradient.addColorStop(1, color(tint, .12));
    ctx.fillStyle = gradient;
    ctx.strokeStyle = color('#e8f9ff', .68);
    ctx.lineWidth = .45;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * .4, -size * .3);
    ctx.lineTo(size * .3, size * .52);
    ctx.lineTo(-size * .08, size);
    ctx.lineTo(-size * .4, size * .2);
    ctx.lineTo(-size * .3, -size * .6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    stroke(ctx, [{ x: 0, y: -size }, { x: -.06 * size, y: .2 * size }, { x: -.08 * size, y: size }], '#f0fbff', .5, .7);
    stroke(ctx, [{ x: -.06 * size, y: .2 * size }, { x: size * .4, y: -size * .3 }], '#f0fbff', .4, .6);
    ctx.restore();
  }

  function snowflake(ctx, x, y, size, rotation, opacity, detail = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = '#d9f4ff';
    ctx.lineWidth = .55;
    ctx.shadowColor = '#97d8ff';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (let arm = 0; arm < 6; arm++) {
      const a = arm * TAU / 6;
      const end = polar(a, size);
      ctx.moveTo(0, 0);
      ctx.lineTo(end.x, end.y);
      if (!detail) continue;
      for (const k of [.48, .75]) {
        const q = polar(a, size * k);
        for (const side of [-1, 1]) {
          const tip = polar(a + side * .85, size * .24);
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - tip.x, q.y - tip.y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Precomputed noise fields keep the small volumetric textures inexpensive.
  function textureCache(r) {
    if (r.magicTexture) return r.magicTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 176;
    const ctx = canvas.getContext('2d', { alpha: true });
    const field = new Float32Array(128 * 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) field[y * 128 + x] = noise(x, y, r.seed);
    }
    r.magicTexture = { canvas, ctx, field, image: ctx.createImageData(176, 176), frame: -1 };
    return r.magicTexture;
  }

  function sample(field, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let dx = x - ix, dy = y - iy;
    dx = dx * dx * (3 - 2 * dx);
    dy = dy * dy * (3 - 2 * dy);
    const a = field[(iy & 127) * 128 + (ix & 127)];
    const b = field[(iy & 127) * 128 + ((ix + 1) & 127)];
    const c = field[((iy + 1) & 127) * 128 + (ix & 127)];
    const d = field[((iy + 1) & 127) * 128 + ((ix + 1) & 127)];
    return mix(mix(a, b, dx), mix(c, d, dx), dy);
  }

  function cloud(r, t, mode) {
    const cache = textureCache(r);
    const frame = Math.floor(t * 20);
    if (cache.frame !== frame) {
      const time = frame / 20, pixels = cache.image.data;
      const low = mode === 'cold' ? [57, 112, 158] : [53, 15, 105];
      const mid = mode === 'cold' ? [150, 212, 239] : [151, 68, 219];
      const high = mode === 'cold' ? [235, 251, 255] : [238, 166, 249];
      for (let py = 0; py < 176; py++) {
        const y = py / 176 * 128 - 64;
        for (let px = 0; px < 176; px++) {
          const x = px / 176 * 128 - 64, radius = Math.hypot(x, y);
          const i = (py * 176 + px) * 4;
          let envelope = 0;
          if (mode === 'nebula') {
            const a = Math.atan2(y, x);
            const center = 41.5 + Math.sin(a * 3 + time * .17) * 2.4;
            const lobes = .46 + .32 * Math.sin(a * 2 - .8) + .2 * Math.sin(a * 5 + time * .12);
            envelope = Math.exp(-(((radius - center) / (5 + lobes * 5)) ** 2)) * clamp(lobes + .28);
          } else if (mode === 'incense') {
            const rise = clamp((44 - y) / 93);
            const left = -32 - Math.sin(rise * 6 - time * .55) * 10;
            const right = 32 + Math.sin(rise * 5 + time * .42) * 7;
            envelope = (Math.exp(-(((x - left) / (3 + rise * 5)) ** 2))
              + .65 * Math.exp(-(((x - right) / (2 + rise * 4)) ** 2)))
              * Math.sin(clamp((y + 51) / 100) * Math.PI) * .92;
          } else {
            envelope = Math.exp(-(((radius - 39) / 6) ** 2))
              * smooth(-4, 29, y) * (.65 + Math.sin(x * .08 + time * .3) * .16);
          }
          envelope *= smooth(31, 37, radius) * (1 - smooth(54, 62, radius));
          if (envelope < .005) { pixels[i + 3] = 0; continue; }
          const nx = x * .065, ny = y * .065 + time * .24;
          const warp = sample(cache.field, nx + time * .09, ny) * 2.2;
          const n = sample(cache.field, nx + warp, ny - warp)
            * .55 + sample(cache.field, nx * 2.07 - time * .12, ny * 2.07) * .3
            + sample(cache.field, nx * 4.1 + warp, ny * 4.1 - time * .11) * .15;
          const density = smooth(.2, .78, n);
          const highlight = smooth(.54, .85, n);
          const shadow = smooth(.12, .59, n);
          for (let ch = 0; ch < 3; ch++) pixels[i + ch] = mix(mix(low[ch], mid[ch], shadow), high[ch], highlight);
          pixels[i + 3] = clamp(envelope * density * (mode === 'nebula' ? 1.3 : 1.05)) * 255;
        }
      }
      cache.ctx.putImageData(cache.image, 0, 0);
      cache.frame = frame;
    }
    r.back.drawImage(cache.canvas, -64, -64, 128, 128);
    r.front.save();
    outsideFace(r.front, 34.5);
    r.front.globalAlpha = mode === 'nebula' ? .58 : .42;
    r.front.drawImage(cache.canvas, -64, -64, 128, 128);
    r.front.restore();
  }

  function veil(r, t, p) {
    for (let side = 0; side < 2; side++) {
      for (let fold = 0; fold < 4; fold++) {
        const start = side ? -.95 : 2.1;
        const points = arc(start, 1.35, 40 + fold * 1.1, 52, u =>
          Math.sin(u * 5.5 + t * .43 + fold * .65) * (2 + fold * .6));
        const gradient = r.back.createLinearGradient(-50, -40, 50, 40);
        gradient.addColorStop(0, color(p[0], 0));
        gradient.addColorStop(.3, color(p[2], .18));
        gradient.addColorStop(.55, color(p[0], .38));
        gradient.addColorStop(1, color(p[1], 0));
        r.ribbon(r.back, points, u => Math.sin(u * Math.PI) * (3.5 - fold * .6), gradient);
        stroke(r.front, points.slice(12, 34), p[2], .45, .12 + .06 * Math.sin(t + fold));
      }
    }
  }

  function corruption(r, t, p) {
    const points = arc(.18, Math.PI - .36, 39, 88, u =>
      Math.sin(u * 17 + t * .55) * 1.2 + Math.sin(u * 31 - t * .37) * .7);
    const g = r.front.createLinearGradient(0, 29, 0, 49);
    g.addColorStop(0, color('#133b2b', .25));
    g.addColorStop(.5, color('#123828', .94));
    g.addColorStop(.8, color(p[1], .8));
    g.addColorStop(1, color(p[0], .1));
    r.ribbon(r.front, points, u => .5 + Math.sin(Math.PI * u) * (2.8 + Math.sin(u * 22 + t) * 1.3), g);
    for (let i = 0; i < 5; i++) {
      const a = .35 + i * .61;
      const q = polar(a, 39);
      const beat = .5 + .5 * Math.sin(t * .73 + i * 1.9);
      r.front.save();
      r.front.translate(q.x, q.y);
      r.front.rotate(a - Math.PI / 2);
      r.front.fillStyle = color(p[1], .75);
      r.front.shadowColor = p[0];
      r.front.shadowBlur = 4;
      r.front.beginPath();
      r.front.moveTo(-3.2, 0);
      r.front.bezierCurveTo(-2, 3 + beat * 4, 3, 4 + beat * 6, 2.5, .5);
      r.front.bezierCurveTo(1, -2 - beat * 2, -1.6, -2, -3.2, 0);
      r.front.fill();
      r.front.restore();
      const vein = arc(a - .1, .26, 39 + beat, 16, u => Math.sin(u * 9 + i) * .65);
      stroke(r.front, vein, p[0], .65, .2 + beat * .45, 3);
    }
  }

  function rifts(r, t, p) {
    for (let i = 0; i < 3; i++) {
      const phase = fract(t * .17 + i * .337);
      const strength = Math.sin(Math.PI * phase) ** 4;
      const cycle = Math.floor(t * .17 + i * .337);
      const a = i * 2.13 + .4 + noise(cycle, i, r.seed) * .4;
      const center = polar(a, 42), points = [];
      for (let j = 0; j <= 12; j++) {
        const v = j / 12;
        const along = (v - .5) * 25;
        const jitter = (noise(j, i, r.seed) - .5) * 3;
        points.push({
          x: center.x + Math.cos(a + Math.PI / 2) * along + Math.cos(a) * jitter,
          y: center.y + Math.sin(a + Math.PI / 2) * along + Math.sin(a) * jitter, t: v,
        });
      }
      r.ribbon(r.back, points, u => Math.sin(u * Math.PI) * (1.1 + strength * 1.7), color('#160c28', .95), strength);
      stroke(r.front, points, p[0], 2.2, strength * .36, 8);
      stroke(r.front, points, p[2], .6, strength * .86, 3);
      if (strength > .45) glint(r.front, center.x, center.y, strength * 2.1, p[2], strength * .5);
    }
  }

  function echo(r, t, p) {
    for (let i = 0; i < 4; i++) {
      const life = fract(t * .16 + i * .25);
      const a = i * 1.67 - .7;
      const points = arc(a, .75, 38 + life * 8, 40, u => Math.sin(u * 5 + t * .4) * life);
      const alpha = Math.sin(life * Math.PI) ** 1.5 * (1 - life) * .65;
      r.ribbon(r.back, points, u => Math.sin(u * Math.PI) * (1.8 + life), color(p[0], alpha));
      stroke(r.front, points, p[2], .5, alpha * .7, 2);
    }
  }

  const GLYPHS = [
    [[-2, 3], [0, -3], [2, 3], [0, 1], [-2, 3]],
    [[-2, -3], [2, -3], [0, 0], [2, 3], [-2, 3]],
    [[0, -3], [-2, 0], [0, 3], [2, 0], [0, -3], [0, 3]],
    [[-2, 2], [-2, -2], [2, 0], [-2, 2], [2, 3]],
    [[-2, -1], [1, -3], [1, 3], [-2, 1], [2, 1]],
  ];

  function runes(r, t, p) {
    for (let group = 0; group < 2; group++) {
      for (let i = 0; i < 5; i++) {
        const life = fract(t * .12 + group * .5 - i * .045 + 1);
        const alpha = smooth(0, .12, life) * (1 - smooth(.58, .86, life));
        const a = group * Math.PI + 2.6 + i * .17;
        const q = polar(a, 42);
        const glyph = GLYPHS[(i + group * 2) % GLYPHS.length];
        const count = Math.min(glyph.length, 1 + Math.floor(life * 25));
        r.front.save();
        r.front.translate(q.x, q.y);
        r.front.rotate(a + Math.PI / 2);
        stroke(r.front, glyph.slice(0, count).map(([x, y]) => ({ x, y })), p[0], .8, alpha * .8, 3);
        r.front.restore();
      }
    }
  }

  function shards(r, t, p) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.13 + .2;
      const q = polar(a, 42 + Math.sin(t * .45 + i * 1.7) * 2.1);
      const phase = t * .42 + i * 1.82;
      const width = .35 + Math.abs(Math.cos(phase)) * .6;
      crystal(r.front, q.x, q.y, 3 + r.noise(i) * 2.5, a + Math.sin(phase) * .3, p[0], .6 + Math.sin(phase) * .1, width);
      glint(r.front, q.x, q.y - 1.5, 3.3, p[2], Math.max(0, Math.sin(phase + .6)) ** 18 * .8);
    }
  }

  function voidTouch(r, t, p) {
    for (let i = 0; i < 2; i++) {
      const phase = fract(t * .13 + i * .5);
      const open = Math.sin(phase * Math.PI) ** 2;
      const a = i * Math.PI + 2.35;
      const q = polar(a, 42);
      r.front.save();
      r.front.translate(q.x, q.y);
      r.front.rotate(a);
      r.front.fillStyle = color('#070511', open);
      r.front.shadowBlur = 5;
      r.front.shadowColor = p[0];
      r.front.beginPath();
      r.front.ellipse(0, 0, open * 2.1 + .1, 6.5 * open, .1, 0, TAU);
      r.front.fill();
      r.front.strokeStyle = color(p[0], open * .7);
      r.front.lineWidth = .65;
      r.front.stroke();
      r.front.restore();
      for (let j = 0; j < 5; j++) {
        const u = fract(t * (.19 + j * .008) + j * .21);
        const dist = (1 - u) ** 1.6 * 13;
        const angle = a + (j - 2) * .38 + u;
        const trail = [{ x: q.x + Math.cos(angle) * dist, y: q.y + Math.sin(angle) * dist }];
        trail.push({ x: q.x + Math.cos(angle + .15) * (dist + 1.2), y: q.y + Math.sin(angle + .15) * (dist + 1.2) });
        stroke(r.front, trail, p[2], .6, Math.sin(u * Math.PI) * open * .6);
      }
    }
  }

  function nebula(r, t, p) {
    cloud(r, t, 'nebula');
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, q = polar(a, 39 + r.noise(i) * 10);
      const pulse = Math.max(0, Math.sin(t * (.35 + r.noise(i, 1) * .25) + i * 2.7)) ** 9;
      glint(r.front, q.x, q.y, 1.1 + pulse * 1.1, p[2], .12 + pulse * .5);
    }
  }

  function incense(r, t) {
    cloud(r, t, 'incense');
  }

  function mindLink(r, t, p) {
    const chains = [
      [[-20,-37],[-34,-33],[-43,-18],[-41,-3],[-45,10],[-34,27]],
      [[17,37],[32,30],[42,15],[40,1],[43,-12],[33,-29]],
    ];
    chains.forEach((nodes, chain) => {
      const pts = nodes.map(([x, y], i) => ({ x: x + Math.sin(t * .35 + i) * .7, y }));
      stroke(r.back, pts, p[1], .8, .4);
      const flow = fract(t * .21 + chain * .45) * (pts.length - 1);
      for (let i = 0; i < pts.length - 1; i++) {
        const start = pts[i], end = pts[i + 1];
        const strength = Math.max(0, 1 - Math.abs(flow - i - .5) / 1.2);
        stroke(r.front, [start, end], p[0], 1, .12 + strength * .55, strength * 5);
        if (flow >= i && flow < i + 1) {
          const u = flow - i;
          glint(r.front, mix(start.x, end.x, u), mix(start.y, end.y, u), 2.3, p[2], .9);
        }
        r.dot(r.front, start.x, start.y, .7 + strength * .45, color(p[2], .25 + strength * .6));
      }
    });
  }

  function telepathy(r, t, p) {
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 3; i++) {
        const u = fract(t * .25 - i * .18 + side * .46 + 1);
        const alpha = Math.sin(Math.PI * u) ** 2 * .6;
        const points = arc((side ? Math.PI : 0) - .4, .8, 37 + u * 13, 38);
        stroke(r.back, points, p[0], 2.4 * (1 - u) + .2, alpha * .35, 5);
        stroke(r.front, points, p[2], .55, alpha);
      }
    }
  }

  function aurora(r, t, p) {
    for (let fold = 0; fold < 3; fold++) {
      const points = [];
      for (let i = 0; i <= 65; i++) {
        const u = i / 65, a = Math.PI + .18 + u * (Math.PI - .36);
        const rad = 39 + Math.sin(u * 7.2 - t * .4 + fold * .5) * 2;
        points.push({ ...polar(a, rad), t: u });
      }
      const grad = r.back.createLinearGradient(0, -55, 0, -31);
      grad.addColorStop(0, color(p[0], 0));
      grad.addColorStop(.5, color(p[1], .26));
      grad.addColorStop(.85, color(p[0], .5));
      grad.addColorStop(1, color(p[2], 0));
      r.ribbon(r.back, points, u => Math.sin(Math.PI * u) * (3 + 2 * Math.sin(u * 9 - t * .7 + fold)), grad, .7);
      stroke(r.front, points.slice(9, 56), p[2], .35, .15);
    }
  }

  function dreamDust(r, t, p) {
    // Fine grains coalesce into short, soft-focus streams at the sides.
    for (let i = 0; i < 25; i++) {
      const u = fract(t * (.065 + r.noise(i) * .055) + r.noise(i, 3));
      const side = i % 2 ? 1 : -1;
      const y = 43 - u * 85;
      const edge = Math.sqrt(Math.max(0, 38 * 38 - y * y));
      const x = side * (Math.max(8, edge) + 3 + Math.sin(u * 7 + i) * 4);
      const alpha = Math.sin(u * Math.PI) ** 2 * (.3 + r.noise(i, 2) * .45);
      if (i % 5 === 0) glint(r.front, x, y, 2, p[2], alpha);
      else r.dot(r.back, x, y, .4 + r.noise(i, 4) * .55, color(p[0], alpha), 2);
    }
  }

  function diamondDust(r, t, p) {
    for (let i = 0; i < 15; i++) {
      const a = i * 2.399 + Math.sin(t * .15 + i) * .04;
      const q = polar(a, 39 + r.noise(i) * 9 + Math.sin(t * .37 + i) * 1.6);
      const pulse = Math.max(0, Math.sin(t * (.7 + r.noise(i, 2) * .4) + i * 2.4)) ** 16;
      crystal(r.front, q.x, q.y, .9 + r.noise(i, 1) * 1.7, t * .12 + i, p[0], .2 + pulse * .6);
      glint(r.front, q.x, q.y, 2.3 + pulse, p[2], pulse * .9);
    }
  }

  function snowfall(r, t, p) {
    for (let i = 0; i < 12; i++) {
      const u = fract(t * (.095 + r.noise(i) * .045) + r.noise(i, 4));
      const y = -51 + u * 104;
      const side = i % 2 ? 1 : -1;
      let x = side * (18 + r.noise(i, 1) * 23) + Math.sin(t * .45 + i) * 3;
      if (Math.abs(y) < 29) x = side * Math.max(Math.abs(x), 29 + r.noise(i) * 9);
      const alpha = Math.sin(u * Math.PI) * (.42 + r.noise(i, 3) * .35);
      snowflake(i % 3 === 0 ? r.back : r.front, x, y, 1.5 + r.noise(i, 2) * 2.6, Math.sin(t * .25 + i) * .3 + i, alpha, i % 2 === 0);
    }
  }

  function frost(r, t, p) {
    for (let plant = 0; plant < 3; plant++) {
      const life = fract(t * .085 + plant * .29);
      const grow = smooth(0, .54, life), opacity = 1 - smooth(.72, 1, life);
      const start = .36 + plant * 2.05;
      const length = .62 * grow;
      const points = arc(start, length, 39.5, 32);
      stroke(r.front, points, p[0], .7, opacity * .7, 2);
      for (let j = 1; j < 10; j++) {
        const u = j / 10;
        if (u > grow) continue;
        const a = start + u * .62, q = polar(a, 39.5);
        const twig = (2 + Math.sin(j * 2.3 + plant) * .8) * smooth(u, u + .18, grow);
        for (const side of [-1, 1]) {
          const end = polar(a + .045, 39.5 + twig * side);
          stroke(r.front, [q, end], p[2], .5, opacity * .78);
          const middle = { x: mix(q.x, end.x, .7), y: mix(q.y, end.y, .7) };
          const tip = polar(a + .072, 39.5 + twig * side * .6);
          stroke(r.front, [middle, tip], p[0], .35, opacity * .6);
        }
      }
    }
  }

  function iceShards(r, t, p) {
    for (let i = 0; i < 5; i++) {
      const a = .43 + i * 1.33;
      const q = polar(a + Math.sin(t * .32 + i * 2) * .035, 41.5 + Math.cos(t * .4 + i) * 1.8);
      const rotation = a + Math.sin(t * .25 + i) * .13;
      const size = 3.4 + r.noise(i) * 3;
      crystal(r.front, q.x, q.y, size, rotation, p[0], .72, .6 + Math.abs(Math.cos(t * .45 + i)) * .3);
      const shine = Math.max(0, Math.sin(t * .63 + i * 2.2)) ** 20;
      glint(r.front, q.x - 1, q.y - size * .5, 3, p[2], shine);
    }
  }

  function coldBreath(r, t, p) {
    cloud(r, t, 'cold');
    for (let i = 0; i < 5; i++) {
      const u = fract(t * .12 + i * .21);
      const a = .4 + i * .55;
      const q = polar(a, 38 + u * 8);
      glint(r.front, q.x, q.y - u * 3, 1.1, p[2], Math.sin(u * Math.PI) * .55);
    }
  }

  function iceFracture(r, t, p) {
    for (let i = 0; i < 3; i++) {
      const u = fract(t * .16 + i * .31);
      const a = i * 2.11 + .8;
      const points = arc(a - .24, .5, 40, 9, v => Math.sin(v * 24 + i) * 1.5);
      const length = Math.max(2, Math.floor(smooth(0, .2, u) * points.length));
      const opacity = (1 - smooth(.5, .85, u)) * .75;
      stroke(r.front, points.slice(0, length), p[0], 1.8, opacity * .25, 4);
      stroke(r.front, points.slice(0, length), p[2], .65, opacity);
      for (let j = 0; j < 3; j++) {
        const root = points[2 + j * 2], end = polar(a - .17 + j * .16, 45);
        stroke(r.front, [root, end], p[2], .4, opacity * smooth(.12 + j * .05, .35, u));
        if (u > .5) {
          const drift = (u - .5) * 8;
          crystal(r.front, end.x + Math.cos(a) * drift, end.y + drift, 1.6, a + u, p[0], (1 - u) * 1.1);
        }
      }
    }
  }

  function lightningPath(r, pts, seed, amplitude = 1.9) {
    return pts.map((q, i) => {
      if (!i || i === pts.length - 1) return q;
      const prev = pts[i - 1], next = pts[i + 1];
      const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
      const offset = (noise(i, seed, r.seed) - .5) * amplitude * 2;
      return { x: q.x - (next.y - prev.y) / len * offset, y: q.y + (next.x - prev.x) / len * offset };
    });
  }

  function bolt(ctx, pts, p, opacity = 1, width = .8) {
    stroke(ctx, pts, p[0], width * 3.8, opacity * .12, 5);
    stroke(ctx, pts, p[0], width * 1.8, opacity * .65, 3);
    stroke(ctx, pts, p[2], width * .65, opacity * .95);
  }

  function lightningChain(r, t, p) {
    const clock = t * .65, phase = fract(clock);
    for (let i = 0; i < 5; i++) {
      const a = -.38 + i * 1.28;
      const power = Math.max(0, 1 - Math.abs(phase - i * .18) / .24);
      const base = arc(a, .88, 40.5, 17);
      const points = lightningPath(r, base, Math.floor(t * 8) + i * 41, 1.55);
      bolt(r.front, points, p, .12 + power * .8);
      if (power > .4) {
        const q = points[9], end = polar(a + .54, 46);
        bolt(r.front, lightningPath(r, [q, { x: (q.x + end.x) / 2, y: (q.y + end.y) / 2 }, end], Math.floor(t * 7), 1.2), p, power * .5, .5);
      }
    }
  }

  function creepingCurrent(r, t, p) {
    for (let i = 0; i < 3; i++) {
      const local = t * (.13 + i * .025) + i * .31;
      const a = i * 2.2 + Math.sin(local) * .45;
      const power = .3 + Math.max(0, Math.sin(t * 3.4 + i * 3)) ** 4 * .7;
      const points = lightningPath(r, arc(a, .43 + .08 * Math.sin(t + i), 38.7, 14), Math.floor(t * 11) + i, 1.1);
      bolt(r.front, points, p, power, .65);
      r.dot(r.front, points[0].x, points[0].y, .7, color(p[2], power), 4);
    }
  }

  function stormFork(r, t, p) {
    const phase = fract(t * .32);
    const energy = Math.exp(-(((phase - .22) / .07) ** 2)) + .6 * Math.exp(-(((phase - .42) / .035) ** 2));
    const seed = Math.floor(t * 7);
    const top = lightningPath(r, arc(3.36, 2.75, 41, 34), seed, 2.1);
    bolt(r.back, top, p, .13 + energy * .82);
    const root = top[14];
    const fork = lightningPath(r, [root, { x: root.x - 6, y: root.y - 4 }, { x: root.x - 9, y: root.y - 7 }, { x: root.x - 15, y: root.y - 6 }], seed + 10, 1.4);
    bolt(r.back, fork, p, energy * .65, .65);
    for (const q of [top[0], top[top.length - 1]]) glint(r.front, q.x, q.y, 2, p[2], energy * .65);
  }

  function staticCharge(r, t, p) {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399 + .1;
      const power = Math.max(0, Math.sin(t * (1.8 + r.noise(i) * 1.3) + i * 2.1)) ** 8;
      const base = polar(a, 39);
      const end = polar(a + .045, 42 + power * 3);
      const midpoint = polar(a - .02, 40.5);
      bolt(r.front, [base, midpoint, end], p, .12 + power * .75, .45);
      if (power > .6) glint(r.front, end.x, end.y, 1.3, p[2], power * .65);
    }
  }

  function electricPulse(r, t, p) {
    for (let side = 0; side < 2; side++) {
      const u = fract(t * .42 + side * .5);
      const center = side * Math.PI + .1;
      const length = .25 + Math.sin(Math.PI * u) * .8;
      const power = Math.sin(u * Math.PI) ** 3;
      const radius = 38.5 + u * 5;
      const base = arc(center - length / 2, length, radius, 23);
      const pts = lightningPath(r, base, Math.floor(t * 10) + side * 13, 1 + power);
      bolt(r.front, pts, p, power * .8, .8);
      stroke(r.back, arc(center - .4, .8, 39, 20), p[0], 1.2, .12, 4);
    }
  }

  function ionRain(r, t, p) {
    for (let i = 0; i < 9; i++) {
      const u = fract(t * (.3 + r.noise(i) * .16) + r.noise(i, 2));
      const side = i % 2 ? -1 : 1;
      const y = -47 + u * 90;
      const x = side * (Math.sqrt(Math.max(0, 40 * 40 - y * y)) + 3 + r.noise(i, 1) * 3);
      const pts = [{ x: x - side * 1.5, y: y - 5 }, { x: x + side, y: y - 2.8 }, { x, y }];
      const alpha = Math.sin(u * Math.PI) * .65;
      bolt(r.front, pts, p, alpha, .5);
      if (i % 3 === 0) stroke(r.front, [{ x, y: y - 3 }, { x: x + side * 2.5, y: y - 4 }], p[0], .4, alpha * .7);
    }
  }

  const catalogue = [
    ['ethereal-veil', 'Эфирная вуаль', 'mystic', ['#cbb7fa','#7a95c7','#f8eaff'], 'перламутровые складки', veil,
      'Невесомые складки света медленно раскрываются у боковых краёв.',
      'Полупрозрачная вуаль ловит свет отдельными складками. Две стороны движутся с разным ритмом, сохраняя открытыми лицо и рисунок рамки.'],
    ['fel-breath', 'Дыхание скверны', 'mystic', ['#b2f66b','#22583e','#e4ffad'], 'вязкое просачивание', corruption,
      'Тёмная живая субстанция сочится из-под рамки и втягивается обратно.',
      'По нижнему краю медленно набухают вязкие наплывы. Внутри проступают ядовитые прожилки, их свет просвечивает через тёмную оболочку.'],
    ['reality-rift', 'Разлом реальности', 'mystic', ['#b385ff','#422759','#f4ddff'], 'раскрывающиеся трещины', rifts,
      'Тонкие разрывы открывают фиолетовую глубину рядом с портретом.',
      'Неровные разломы по очереди раскрываются, светятся изнутри и затягиваются. Свет сосредоточен на краях трещины.'],
    ['phantom-echo', 'Призрачное эхо', 'mystic', ['#bbd4ea','#8179ae','#eff7ff'], 'отделяющиеся следы', echo,
      'Бледные отпечатки отделяются от края и растворяются в воздухе.',
      'Короткий участок свечения отходит от рамки, постепенно теряет плотность и исчезает. Следы рождаются с независимыми задержками.'],
    ['living-script', 'Живая вязь', 'mystic', ['#dcb4ff','#8a5bb9','#fff0ff'], 'проявление письмен', runes,
      'Магические знаки прорисовываются короткими фразами у рамки.',
      'Каждая фраза появляется штрих за штрихом и мягко стирается. Знаки занимают два небольших участка вокруг портрета.'],
    ['spell-shards', 'Осколки чар', 'mystic', ['#c5b4fa','#7465a6','#fff3ff'], 'зачарованное стекло', shards,
      'Небольшие стеклянные осколки покачиваются и ловят свет гранями.',
      'У каждого осколка свой наклон и темп движения. Прозрачные грани кратко вспыхивают, когда поворачиваются к свету.'],
    ['void-touch', 'Прикосновение пустоты', 'mystic', ['#a276dd','#1e122f','#d5b5ff'], 'втягивание материи', voidTouch,
      'Тёмные складки у рамки притягивают и поглощают редкие пылинки.',
      'Два небольших разрыва медленно дышат. Близкие частицы ускоряются у самого края складки и пропадают в её глубине.'],
    ['amethyst-nebula', 'Аметистовая туманность', 'violet', ['#bc83f7','#513081','#f4c3ff'], 'космический дым', nebula,
      'Объёмные фиолетовые облака открывают светлые прожилки и редкие звёзды.',
      'Неоднородная туманность перетекает вплотную к портрету. Тёмные пустоты разделяют плотные сиреневые облака, а внутри постепенно раскрываются жемчужные участки.'],
    ['violet-incense', 'Эфирный дым', 'violet', ['#b58aee','#5b328b','#efc9ff'], 'восходящие струи', incense,
      'Тонкие струи фиолетового дыма поднимаются вдоль портрета.',
      'Дым расходится двумя независимыми потоками: у основания он плотнее, выше завивается и рассеивается. Внутри сохраняются мелкие неоднородности.'],
    ['mental-link', 'Ментальная связь', 'violet', ['#cd9fff','#6e4aa4','#fff0ff'], 'передача импульса', mindLink,
      'Световой сигнал проходит по коротким связям между узлами.',
      'Две асимметричные цепочки охватывают боковые участки портрета. Каждый импульс последовательно пробуждает следующий узел, оставляя затухающий след.'],
    ['telepathic-resonance', 'Телепатический резонанс', 'violet', ['#bf8cff','#6d3db0','#e9d3ff'], 'волны у висков', telepathy,
      'От боковых краёв расходятся тонкие пакеты психических волн.',
      'Короткие волны рождаются поочерёдно с двух сторон, расширяются на небольшое расстояние и теряют яркость. В центре остаётся только портрет.'],
    ['astral-curtain', 'Астральное сияние', 'violet', ['#c785ff','#7452ce','#f0bfff'], 'световая завеса', aurora,
      'Над верхним краем переливается тонкая складчатая завеса.',
      'Сиреневая завеса изгибается медленными волнами, похожими на полярное сияние. Яркость собирается у нижних складок и растворяется кверху.'],
    ['dream-dust', 'Пыль сновидений', 'violet', ['#c29cf4','#7e59aa','#ffe7fc'], 'невесомые потоки', dreamDust,
      'Сиреневые крупинки всплывают вдоль рамки и ненадолго искрятся.',
      'Два неплотных потока поднимаются с разной скоростью. Небольшие искры раскрываются среди матовых пылинок и быстро теряют свет.'],
    ['diamond-dust', 'Алмазная пыль', 'cryo', ['#a5ddf4','#5586aa','#ffffff'], 'мерцающие микрокристаллы', diamondDust,
      'Мелкие льдинки сверкают вокруг портрета отдельными острыми бликами.',
      'Льдинки почти невесомы: они едва смещаются и независимо поворачиваются. Короткие блики подчёркивают прозрачные грани.'],
    ['quiet-snow', 'Тихий снег', 'cryo', ['#c2e9fb','#709bb7','#f6feff'], 'падающие снежинки', snowfall,
      'Редкие шестилучевые снежинки мягко проходят вдоль аватарки.',
      'Снежинки отличаются размером, скоростью и глубиной. Они покачиваются в воздухе, часть проходит за портретом, часть около его краёв.'],
    ['hoarfrost', 'Письмена инея', 'cryo', ['#9fd5eb','#578798','#edfdff'], 'рост ледяных ветвей', frost,
      'Тончайшие кристаллические ветви вырастают и тают на кромке.',
      'Иней развивается последовательно: сначала центральная жилка, затем маленькие ответвления. Старые участки исчезают, уступая место новым.'],
    ['glacial-shards', 'Ледяные осколки', 'cryo', ['#91d1ee','#3d6f96','#ffffff'], 'прозрачные ледяные грани', iceShards,
      'Пять небольших льдинок медленно меняют наклон возле рамки.',
      'Холодное прозрачное стекло с несколькими читаемыми гранями. Нерегулярное покачивание и короткие блики создают объём без плотного кольца.'],
    ['winter-breath', 'Дыхание зимы', 'cryo', ['#b5e3ed','#5688a0','#f3ffff'], 'морозный пар', coldBreath,
      'У нижнего края клубится холодный пар с редкими ледяными искрами.',
      'Низкая полоса морозного воздуха медленно перекатывается перед рамкой. Пар остаётся прозрачным и рассеивается у боковых краёв.'],
    ['ice-fracture', 'Ледяной раскол', 'cryo', ['#8bd8ff','#497dab','#f4feff'], 'трещины и распад', iceFracture,
      'Короткая ледяная трещина ветвится и распадается на мелкие льдинки.',
      'Трещина сначала пробегает вдоль небольшого участка рамки, затем выпускает ответвления. После свечения отделяются несколько прозрачных крошек.'],
    ['lightning-chain', 'Цепная молния', 'electro', ['#92bfff','#5663c5','#f5fcff'], 'последовательный разряд', lightningChain,
      'Пульсирующая цепочка разрядов передаёт заряд по периметру.',
      'Заряд движется через несколько разомкнутых участков цепи. Короткие ответвления возникают только рядом с активным импульсом.'],
    ['creeping-current', 'Блуждающий разряд', 'electro', ['#a6d5ff','#577cc0','#ffffff'], 'короткие живые дуги', creepingCurrent,
      'Три небольших разряда переползают по самой кромке аватара.',
      'Дуги меняют форму и локально смещаются, сохраняя разный ритм. Между ними остаётся свободное место и видимая рамка.'],
    ['storm-fork', 'Грозовой разлом', 'electro', ['#b7a9ff','#6052bd','#f9f6ff'], 'ветвящаяся верхняя дуга', stormFork,
      'Над аватаркой вспыхивает ломаная молния с коротким ответвлением.',
      'Разряд накапливает свет, вспыхивает и оставляет бледный след. После основной вспышки иногда возникает более слабый повторный импульс.'],
    ['static-charge', 'Статический заряд', 'electro', ['#b5d7ff','#547dae','#f8fdff'], 'короткие электрические иглы', staticCharge,
      'У рамки независимо вспыхивают тонкие электрические усики.',
      'Небольшие игольчатые разряды возникают с разными задержками. Их концы ненадолго светятся, затем заряд гаснет у основания.'],
    ['electric-resonance', 'Электрический резонанс', 'electro', ['#b49aff','#6546bc','#f3eaff'], 'пульсирующие боковые дуги', electricPulse,
      'По бокам поочерёдно раскрываются короткие фиолетовые дуги.',
      'Электрический импульс расширяет дугу на несколько пикселей, разрывает её на зубчатые участки и гаснет. Две стороны отвечают друг другу с задержкой.'],
    ['ion-rain', 'Ионный дождь', 'electro', ['#91e1fa','#3d8bba','#f4ffff'], 'каскад электрических искр', ionRain,
      'Тонкие разветвлённые искры стекают вдоль краёв портрета.',
      'Разряды движутся короткими ступенями вниз. Каждый имеет небольшой яркий кончик, бледный хвост и собственную скорость.'],
  ];

  const renderers = new Map();
  const effects = catalogue.map((entry, index) => {
    const [id, name, category, palette, layout, render, short, description] = entry;
    renderers.set(id, render);
    return {
      id, name, category, palette, layout, short, description, kind: 'magic',
      code: `FX${String(index + 12).padStart(2, '0')}`,
      loop: category === 'electro' ? 'Импульсы с паузами' : 'Независимые ритмы',
      tags: [category === 'violet' ? 'фиолетовая магия' : category === 'cryo' ? 'лёд снег мороз' : category === 'electro' ? 'электричество молния' : 'мистика эфир скверна', name],
      isNew: true,
    };
  });

  window.FXMagic = Object.freeze({
    effects,
    draw(renderer, time) {
      const render = renderers.get(renderer.effect.id);
      if (render) render(renderer, time, renderer.effect.palette);
    },
  });
})();
