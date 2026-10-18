(() => {
  'use strict';

  const AVATARS = {
    fantasy: { src: './assets/avatar-fantasy.webp?v=4', fallback: 'Ф' },
    mystic: { src: './assets/avatar-mystic.webp?v=4', fallback: 'М' },
    cyber: { src: './assets/avatar-cyber.webp?v=4', fallback: 'К' },
  };

  const CATEGORY_LABELS = {
    all: 'Все',
    fire: 'Огонь',
    nature: 'Природа',
    class: 'Классы',
  };

  const EFFECTS = [
    {
      id: 'bards-refrain', code: 'FX01', name: 'Рефрен барда', category: 'class', kind: 'bard',
      palette: ['#edcd7a', '#8c70ad', '#f8e9ba'], layout: 'нотный полукруг', loop: '10 секунд',
      tags: ['бард', 'музыка', 'ноты'],
      short: 'Тесный нотный полукруг обнимает нижний край портрета, а ноты складываются в живую музыкальную фразу.',
      description: 'Пять тонких линий идут вплотную к портрету. Векторные ноты имеют головку, штиль и флажок, собираются в аккорды и мягко проходят перед нижней кромкой аватара.',
    },
    {
      id: 'wildfire-mantle', code: 'FX02', name: 'Мантия живого огня', category: 'fire', kind: 'wildfire',
      palette: ['#ffad4f', '#e34f2c', '#ffe3a0'], layout: 'огненная стенка в перспективе', loop: '7 секунд',
      core: '#fff7c4',
      tags: ['огонь', 'пламя', 'угли'],
      short: 'Плотная стенка живого пламени огибает аватар снизу и заходит на его нижний край.',
      description: 'Вертикальные языки растут из изогнутого основания: края уходят назад и вверх, а центр остаётся перед портретом. Так огонь окружает нижнюю часть аватара, не превращаясь в сферическую оболочку.',
    },
    {
      id: 'verdant-wildfire', code: 'FX03', name: 'Мантия изумрудного огня', category: 'fire', kind: 'wildfire',
      palette: ['#7cff70', '#07945a', '#dcff9b'], core: '#efffc7',
      layout: 'изумрудная стенка в перспективе', loop: '7 секунд',
      tags: ['зелёный огонь', 'ведьмин огонь', 'пламя'],
      short: 'Плотная изумрудная стенка огибает нижнюю часть портрета.',
      description: 'Почти белое зелёное ядро и насыщенный изумрудный корпус стоят на изогнутом основании. Боковые языки уходят назад, а центральные частично перекрывают низ аватара.',
    },
    {
      id: 'azure-wildfire', code: 'FX04', name: 'Мантия синего огня', category: 'fire', kind: 'wildfire',
      palette: ['#5edcff', '#2758d8', '#b9f5ff'], core: '#f0feff',
      layout: 'лазурная стенка в перспективе', loop: '7 секунд',
      tags: ['синий огонь', 'холодное пламя', 'мантия'],
      short: 'Сине-белая стенка пламени окружает аватар по нижней дуге.',
      description: 'Белое горячее ядро переходит в лазурный свет и глубокий кобальт. Стенка изгибается в перспективе и мягко охватывает нижнюю часть портрета.',
    },
    {
      id: 'amethyst-wildfire', code: 'FX05', name: 'Мантия аметистового огня', category: 'fire', kind: 'wildfire',
      palette: ['#d779ff', '#7432d3', '#f0bcff'], core: '#fff2ff',
      layout: 'аметистовая стенка в перспективе', loop: '7 секунд',
      tags: ['фиолетовый огонь', 'магическое пламя', 'мантия'],
      short: 'Плотная аметистовая стенка огибает и частично перекрывает низ портрета.',
      description: 'Светлое ядро, лиловое тело и глубокий фиолетовый край собраны в изогнутую стенку, которая окружает аватар снизу.',
    },
    {
      id: 'fire-circlet', code: 'FX06', name: 'Огненный венец', category: 'fire', kind: 'fire-ring',
      palette: ['#ffb447', '#df3d1e', '#fff0ad'], core: '#fff9d6',
      ringRadius: 42, ringScale: .62, layout: 'плотный венец по периметру', loop: '8 секунд',
      tags: ['огонь', 'венец', 'полный круг'],
      short: 'Неровная огненная кромка плотно охватывает портрет по всему периметру.',
      description: 'Венец следует самой кромке аватара. Верхняя половина уходит за портрет, нижняя проходит перед ним; языки различаются шириной, длиной и скоростью дыхания.',
    },
    {
      id: 'verdant-circlet', code: 'FX07', name: 'Изумрудный венец', category: 'fire', kind: 'fire-ring',
      palette: ['#72f77a', '#058855', '#d9ffad'], core: '#f3ffd3',
      ringRadius: 42, ringScale: .62, layout: 'ведьмин венец по периметру', loop: '8 секунд',
      tags: ['зелёный огонь', 'венец', 'ведьмин свет'],
      short: 'Изумрудное пламя вплотную замыкается вокруг аватара.',
      description: 'Кольцо держится у самой кромки портрета. Лаймовые ядра и насыщенные зелёные края дают ощущение дорогого ведьминого огня без лишней дымки.',
    },
    {
      id: 'azure-circlet', code: 'FX08', name: 'Лазурный венец', category: 'fire', kind: 'fire-ring',
      palette: ['#5bdcff', '#2856d2', '#c4f8ff'], core: '#f3ffff',
      ringRadius: 42, ringScale: .62, layout: 'холодный венец по периметру', loop: '8 секунд',
      tags: ['синий огонь', 'венец', 'холодное пламя'],
      short: 'Холодный синий огонь очерчивает аватар тонкой живой кромкой.',
      description: 'Белые ядра вспыхивают внутри лазурных языков, а кобальтовый край удерживает форму венца вплотную к портрету.',
    },
    {
      id: 'amethyst-circlet', code: 'FX09', name: 'Аметистовый венец', category: 'fire', kind: 'fire-ring',
      palette: ['#d97aff', '#7130ce', '#f1c4ff'], core: '#fff2ff',
      ringRadius: 42, ringScale: .62, layout: 'магический венец по периметру', loop: '8 секунд',
      tags: ['фиолетовый огонь', 'венец', 'магическое пламя'],
      short: 'Лиловое пламя замыкается вокруг портрета ровно по его кромке.',
      description: 'Жемчужное ядро, аметистовый корпус и глубокий фиолетовый край создают плотный магический огонь без ощущения неоновой рамки.',
    },
    {
      id: 'old-forest-lights', code: 'FX10', name: 'Огни старого леса', category: 'nature', kind: 'forest-lights',
      palette: ['#a7df70', '#426b4e', '#fff1a1'], layout: 'девять живых светлячков', loop: '20 секунд',
      tags: ['светлячки', 'лес', 'свечение'],
      short: 'Девять светлячков медленно собираются вокруг аватара и вспыхивают каждый в своём ритме.',
      description: 'Пять крупных и четыре более далёких светлячка движутся по небольшим разным петлям и несинхронно разгораются до тёплого свечения. Между вспышками остаются видны крылья и тёмное тельце, поэтому рой выглядит живым, а не как россыпь точек.',
    },
    {
      id: 'willow-whisper', code: 'FX11', name: 'Шёпот сакуры', category: 'nature', kind: 'willow-whisper',
      palette: ['#efb4bf', '#60493f', '#fff0e8'], layout: 'ветвь сакуры и падающие лепестки', loop: '19 секунд',
      tags: ['сакура', 'лепестки', 'ветвь'],
      short: 'Цветущая ветвь склоняется над аватаром, а редкие лепестки медленно опускаются перед портретом.',
      description: 'Живая ветвь сакуры остаётся над верхним краем аватара. Цветы собраны небольшими группами на развилках, а пять крупных лепестков падают разными путями перед портретом и мягко исчезают у нижнего края.',
    },
    {
      id: 'thorn-rose', code: 'FX12', name: 'Терновая роза', category: 'nature', kind: 'thorn-rose',
      palette: ['#b94f63', '#30483a', '#efb3aa'], layout: 'три розы, лоза и два побега', loop: '18 секунд',
      tags: ['роза', 'терн', 'лоза'],
      short: 'Три розы лежат на нижней лозе, а тонкие терновые побеги поднимаются по сторонам портрета.',
      description: 'Нижняя лоза образует собранный полукруг с тремя многослойными цветками. Из её концов вырастают два тонких асимметричных побега с шипами, листьями и закрытыми бутонами; движение остаётся почти незаметным.',
    },
  ];

  const state = {
    category: 'all',
    query: '',
    avatar: 'fantasy',
    size: 64,
    backdrop: 'ink',
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    dialogEffect: null,
  };

  const refs = {
    body: document.body,
    search: document.getElementById('search'),
    avatar: document.getElementById('avatar-select'),
    size: document.getElementById('size-select'),
    backdrop: document.getElementById('backdrop-select'),
    motion: document.getElementById('motion-toggle'),
    categories: document.getElementById('category-bar'),
    grid: document.getElementById('effect-grid'),
    count: document.getElementById('result-count'),
    empty: document.getElementById('empty-state'),
    dialog: document.getElementById('effect-dialog'),
    dialogClose: document.getElementById('dialog-close'),
    dialogStage: document.getElementById('dialog-stage'),
    dialogKicker: document.getElementById('dialog-kicker'),
    dialogTitle: document.getElementById('dialog-title'),
    dialogDescription: document.getElementById('dialog-description'),
    dialogLayout: document.getElementById('dialog-layout-name'),
    dialogLoop: document.getElementById('dialog-loop'),
    dialogTags: document.getElementById('dialog-tags'),
    total: document.getElementById('effect-total'),
  };

  const engine = createEngine();

  function categoryName(id) {
    return CATEGORY_LABELS[id] || id;
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('ru-RU');
  }

  function filteredEffects() {
    const query = normalize(state.query);
    return EFFECTS.filter(effect => {
      if (state.category !== 'all' && effect.category !== state.category) return false;
      if (!query) return true;
      return normalize([effect.name, effect.short, effect.description, categoryName(effect.category), ...effect.tags].join(' ')).includes(query);
    });
  }

  function renderCategories() {
    const categories = ['all', ...Object.keys(CATEGORY_LABELS).filter(key => key !== 'all' && EFFECTS.some(effect => effect.category === key))];
    refs.categories.replaceChildren(...categories.map(category => {
      const button = document.createElement('button');
      const count = category === 'all' ? EFFECTS.length : EFFECTS.filter(effect => effect.category === category).length;
      button.type = 'button';
      button.className = `category-button${state.category === category ? ' active' : ''}`;
      button.textContent = `${categoryName(category)} · ${count}`;
      button.addEventListener('click', () => {
        state.category = category;
        renderCategories();
        renderGrid();
      });
      return button;
    }));
  }

  function createComposition(effect, size, previewScale = 1, animateAlways = false) {
    const avatarSize = Math.round(size * previewScale);
    const fieldSize = Math.round(avatarSize * 3.18);
    const node = document.createElement('div');
    node.className = 'fx-composition';
    node.style.setProperty('--avatar-size', `${avatarSize}px`);
    node.style.setProperty('--field-size', `${fieldSize}px`);

    const back = document.createElement('canvas');
    back.className = 'fx-canvas fx-back';
    back.setAttribute('aria-hidden', 'true');
    const front = document.createElement('canvas');
    front.className = 'fx-canvas fx-front';
    front.setAttribute('aria-hidden', 'true');

    const avatar = document.createElement('span');
    avatar.className = 'avatar-shell';
    avatar.style.setProperty('--avatar-accent', effect.palette[0]);
    const fallback = document.createElement('span');
    fallback.className = 'avatar-fallback';
    fallback.textContent = AVATARS[state.avatar].fallback;
    fallback.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.loading = 'eager';
    img.decoding = 'async';
    img.addEventListener('load', () => avatar.classList.add('is-loaded'), { once:true });
    img.addEventListener('error', () => avatar.classList.add('is-error'), { once:true });
    img.src = AVATARS[state.avatar].src;
    avatar.append(fallback, img);
    node.append(back, avatar, front);
    engine.register(node, effect, back, front, fieldSize, animateAlways);
    return node;
  }

  function createCard(effect) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'effect-card';
    card.style.setProperty('--a', effect.palette[0]);
    card.style.setProperty('--b', effect.palette[1]);
    card.setAttribute('aria-label', `Открыть эффект: ${effect.name}`);

    const stage = document.createElement('span');
    stage.className = 'effect-stage';
    stage.dataset.backdrop = state.backdrop;
    const composition = createComposition(effect, state.size);
    stage.append(composition);

    const copy = document.createElement('span');
    copy.className = 'card-copy';
    const heading = document.createElement('span');
    heading.className = 'card-heading';
    const title = document.createElement('h3');
    title.textContent = effect.name;
    const code = document.createElement('span');
    code.className = 'effect-code';
    code.textContent = effect.code;
    heading.append(title, code);
    const description = document.createElement('p');
    description.textContent = effect.short;
    const footer = document.createElement('span');
    footer.className = 'card-footer';
    footer.innerHTML = `<span class="layout-chip">${categoryName(effect.category)}</span><span class="tag">${effect.layout}</span>`;
    copy.append(heading, description, footer);
    card.append(stage, copy);
    card.addEventListener('pointerenter', () => engine.setActive(composition, true));
    card.addEventListener('pointerleave', () => engine.setActive(composition, false));
    card.addEventListener('focus', () => engine.setActive(composition, true));
    card.addEventListener('blur', () => engine.setActive(composition, false));
    card.addEventListener('click', () => openDialog(effect));
    return card;
  }

  function renderGrid() {
    const effects = filteredEffects();
    refs.grid.replaceChildren(...effects.map(createCard));
    refs.count.textContent = `${effects.length} из ${EFFECTS.length}`;
    refs.empty.hidden = effects.length > 0;
    requestAnimationFrame(() => engine.refresh());
  }

  function openDialog(effect) {
    state.dialogEffect = effect;
    refs.dialogStage.dataset.backdrop = state.backdrop;
    refs.dialogStage.replaceChildren(createComposition(effect, Math.max(108, state.size), 1, true));
    refs.dialogKicker.textContent = `${categoryName(effect.category)} · ${effect.code}`;
    refs.dialogTitle.textContent = effect.name;
    refs.dialogDescription.textContent = effect.description;
    refs.dialogLayout.textContent = effect.layout;
    refs.dialogLoop.textContent = effect.loop;
    refs.dialogTags.replaceChildren(...effect.tags.map(text => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = text;
      return tag;
    }));
    if (!refs.dialog.open) refs.dialog.showModal();
    requestAnimationFrame(() => engine.refresh());
  }

  function updateMotion() {
    refs.body.classList.toggle('motion-paused', state.paused);
    refs.motion.setAttribute('aria-pressed', String(state.paused));
    refs.motion.title = state.paused ? 'Возобновить анимацию' : 'Приостановить анимацию';
    refs.motion.querySelector('i').textContent = state.paused ? '▶' : 'Ⅱ';
    engine.setPaused(state.paused);
  }

  refs.search.addEventListener('input', () => { state.query = refs.search.value; renderGrid(); });
  refs.avatar.addEventListener('change', () => {
    state.avatar = refs.avatar.value;
    renderGrid();
    if (refs.dialog.open && state.dialogEffect) openDialog(state.dialogEffect);
  });
  refs.size.addEventListener('change', () => {
    state.size = Number(refs.size.value) || 64;
    renderGrid();
    if (refs.dialog.open && state.dialogEffect) openDialog(state.dialogEffect);
  });
  refs.backdrop.addEventListener('change', () => {
    state.backdrop = refs.backdrop.value;
    renderGrid();
    if (refs.dialog.open) refs.dialogStage.dataset.backdrop = state.backdrop;
  });
  refs.motion.addEventListener('click', () => { state.paused = !state.paused; updateMotion(); });
  refs.dialogClose.addEventListener('click', () => refs.dialog.close());
  refs.dialog.addEventListener('click', event => { if (event.target === refs.dialog) refs.dialog.close(); });
  refs.dialog.addEventListener('close', () => engine.prune());

  queueMicrotask(() => {
    refs.total.textContent = EFFECTS.length;
    renderCategories();
    renderGrid();
    updateMotion();
  });

  function createEngine() {
    const renderers = new Map();
    const visible = new WeakMap();
    const active = new WeakMap();
    const alwaysAnimated = new WeakMap();
    let paused = false;
    let frameId = 0;
    let frozenTime = performance.now() / 1000;
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        visible.set(entry.target, entry.isIntersecting);
        if (entry.isIntersecting && isAnimated(entry.target)) start();
      });
    }, { rootMargin:'180px 0px' }) : null;

    function isAnimated(host) {
      return active.get(host) === true || alwaysAnimated.get(host) === true;
    }

    function register(host, effect, back, front, size, animateAlways = false) {
      const renderer = new EffectRenderer(effect, back, front, size);
      renderers.set(host, renderer);
      visible.set(host, true);
      active.set(host, false);
      alwaysAnimated.set(host, animateAlways);
      observer?.observe(host);
      renderer.draw(frozenTime);
      if (animateAlways) start();
    }

    function prune() {
      for (const [host] of renderers) {
        if (host.isConnected) continue;
        observer?.unobserve(host);
        renderers.delete(host);
      }
    }

    function tick(nowMs) {
      frameId = 0;
      prune();
      if (paused) return;
      frozenTime = nowMs / 1000;
      let keepRunning = false;
      for (const [host, renderer] of renderers) {
        if (!isAnimated(host)) continue;
        if (visible.get(host) !== false) {
          renderer.draw(frozenTime);
          keepRunning = true;
        }
      }
      if (keepRunning) frameId = requestAnimationFrame(tick);
    }

    function start() {
      if (!paused && !frameId && [...renderers.keys()].some(host => isAnimated(host) && visible.get(host) !== false)) {
        frameId = requestAnimationFrame(tick);
      }
    }

    function setActive(host, value) {
      if (!renderers.has(host)) return;
      active.set(host, value);
      if (value) start();
    }

    function setPaused(value) {
      paused = value;
      if (paused) {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        start();
      }
    }

    function refresh() {
      prune();
      for (const renderer of renderers.values()) renderer.draw(frozenTime);
      start();
    }

    return { register, prune, refresh, setActive, setPaused };
  }

  function rgba(hex, opacity) {
    const value = String(hex).replace('#', '');
    if (value.length !== 6) return hex;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }

  function hash(text) {
    let result = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      result ^= text.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  class EffectRenderer {
    constructor(effect, back, front, cssSize) {
      this.effect = effect;
      this.backCanvas = back;
      this.frontCanvas = front;
      this.cssSize = cssSize;
      this.logicalSize = 240;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.seed = hash(effect.id) % 100000;
      for (const canvas of [back, front]) {
        canvas.width = Math.round(cssSize * this.dpr);
        canvas.height = Math.round(cssSize * this.dpr);
        canvas.style.width = `${cssSize}px`;
        canvas.style.height = `${cssSize}px`;
      }
      // Chromium can promote only a small number of desynchronized canvases.
      // Later alpha canvases may then be composited as opaque black surfaces.
      this.back = back.getContext('2d', { alpha:true });
      this.front = front.getContext('2d', { alpha:true });
      if (!this.back || !this.front) throw new Error('Canvas 2D is unavailable');
    }

    noise(index, salt = 0) {
      const value = Math.sin(this.seed * .0017 + index * 12.9898 + salt * 78.233) * 43758.5453;
      return value - Math.floor(value);
    }

    prepare(ctx, canvas) {
      const scale = this.cssSize / this.logicalSize;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, canvas.width / 2, canvas.height / 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
    }

    draw(time) {
      this.prepare(this.back, this.backCanvas);
      this.prepare(this.front, this.frontCanvas);
      const p = this.effect.palette;
      switch (this.effect.kind) {
        case 'bard': this.drawBard(time, p); break;
        case 'wildfire': this.drawWildfire(time, p); break;
        case 'fire-ring': this.drawFireRing(time, p); break;
        case 'forest-lights': this.drawForestLights(time, p); break;
        case 'willow-whisper': this.drawWillowWhisper(time, p); break;
        case 'thorn-rose': this.drawThornRose(time, p); break;
        default: break;
      }
    }

    dot(ctx, x, y, radius, color, glow = 0) {
      ctx.save();
      ctx.fillStyle = color;
      if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = color; }
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    star(ctx, x, y, radius, color, rotation = 0, points = 4) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const angle = i * Math.PI / points;
        const r = i % 2 ? radius * .2 : radius;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    cubicPoints(a, b, c, d, count = 36) {
      const points = [];
      for (let i = 0; i <= count; i += 1) {
        const t = i / count;
        const u = 1 - t;
        points.push({
          x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
          y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y,
          t,
        });
      }
      return points;
    }

    ribbon(ctx, points, widthAt, fillStyle, opacity = 1) {
      if (points.length < 2) return;
      const left = [];
      const right = [];
      points.forEach((point, index) => {
        const previous = points[Math.max(0, index - 1)];
        const next = points[Math.min(points.length - 1, index + 1)];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const length = Math.hypot(dx, dy) || 1;
        const width = typeof widthAt === 'function' ? widthAt(point.t) : widthAt;
        const nx = -dy / length * width;
        const ny = dx / length * width;
        left.push({ x:point.x + nx, y:point.y + ny });
        right.push({ x:point.x - nx, y:point.y - ny });
      });
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      left.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      right.reverse().forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    waterBand(ctx, time, radius, width, colorA, colorB, speed, phase) {
      const outer = [];
      const inner = [];
      const count = 100;
      for (let i = 0; i <= count; i += 1) {
        const angle = i / count * Math.PI * 2;
        const wave = Math.sin(angle * 3 - time * speed + phase) * 3 + Math.sin(angle * 5 + time * speed * .45) * 1.3;
        const r = radius + wave;
        const w = width * (.72 + Math.sin(angle * 2 + time * .4) * .18);
        outer.push({ x:Math.cos(angle)*(r+w), y:Math.sin(angle)*(r+w)*.92 });
        inner.push({ x:Math.cos(angle)*(r-w), y:Math.sin(angle)*(r-w)*.92 });
      }
      const gradient = ctx.createLinearGradient(-70, -60, 70, 65);
      gradient.addColorStop(0, rgba(colorB, .08));
      gradient.addColorStop(.36, rgba(colorA, .48));
      gradient.addColorStop(.7, rgba(colorB, .28));
      gradient.addColorStop(1, rgba(colorA, .08));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(outer[0].x, outer[0].y);
      outer.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      inner.reverse().forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    drawTidal(time, p) {
      const back = this.back;
      const front = this.front;
      this.waterBand(back, time, 52, 5.5, p[0], p[1], .82, 0);
      this.waterBand(back, -time, 65, 3.2, p[2], p[1], .55, 1.6);

      back.save();
      back.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i += 1) {
        const angle = i * Math.PI / 4 + time * .08;
        const length = 8 + this.noise(i) * 9;
        back.strokeStyle = rgba(i % 2 ? p[0] : p[2], .18 + this.noise(i, 2) * .18);
        back.lineWidth = .8;
        back.beginPath();
        back.arc(0, 0, 59 + this.noise(i, 3) * 5, angle, angle + length / 60);
        back.stroke();
      }
      back.restore();

      const sweep = Math.sin(time * .55) * 4;
      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = rgba(p[2], .72);
      front.lineWidth = 2.4;
      front.shadowBlur = 9;
      front.shadowColor = p[0];
      front.beginPath();
      for (let i = 0; i <= 36; i += 1) {
        const angle = .13 * Math.PI + i / 36 * .74 * Math.PI;
        const radius = 51 + Math.sin(i * .58 - time * 1.2) * 2.5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius + sweep;
        if (!i) front.moveTo(x, y); else front.lineTo(x, y);
      }
      front.stroke();
      front.restore();

      for (let i = 0; i < 9; i += 1) {
        const angle = .18 * Math.PI + i / 8 * .62 * Math.PI + Math.sin(time * .3 + i) * .025;
        const radius = 54 + (i % 3) * 4;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius + sweep;
        front.save();
        front.strokeStyle = rgba(i % 3 ? p[2] : p[0], .38 + this.noise(i) * .3);
        front.lineWidth = .9;
        front.beginPath(); front.arc(x, y, 1.5 + this.noise(i, 4) * 2.5, 0, Math.PI * 2); front.stroke();
        front.restore();
      }
    }

    drawCelestial(time, p) {
      const back = this.back;
      const front = this.front;
      const nodes = [
        [-61,-26],[-38,-62],[-2,-72],[34,-57],[66,-25],[72,18],[43,56],[3,70],[-39,58],[-68,20],
      ];
      const links = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],[1,8],[3,6]];
      const phrase = (time * .18) % 1;

      back.save();
      back.globalCompositeOperation = 'lighter';
      const halo = back.createRadialGradient(0, 0, 39, 0, 0, 79);
      halo.addColorStop(0, rgba(p[1], 0));
      halo.addColorStop(.65, rgba(p[1], .07));
      halo.addColorStop(1, rgba(p[0], 0));
      back.fillStyle = halo;
      back.beginPath(); back.arc(0, 0, 80, 0, Math.PI * 2); back.fill();
      links.forEach((link, index) => {
        const local = (phrase * links.length - index + links.length) % links.length;
        const visibility = local < 3 ? (1 - local / 3) : .08;
        const a = nodes[link[0]], b = nodes[link[1]];
        back.strokeStyle = rgba(index % 3 ? p[0] : p[2], .08 + visibility * .32);
        back.lineWidth = .7 + visibility * .5;
        back.beginPath(); back.moveTo(a[0], a[1]); back.lineTo(b[0], b[1]); back.stroke();
      });
      back.restore();

      nodes.forEach((node, index) => {
        const beat = Math.pow(Math.max(0, Math.sin(time * .9 - index * .58)), 7);
        const radius = 1.7 + this.noise(index) * 1.6 + beat * 3.2;
        this.star(front, node[0], node[1], radius, rgba(index % 4 ? p[0] : p[2], .42 + beat * .52), time * .07 + index, index % 3 ? 4 : 6);
      });

      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = rgba(p[2], .24);
      front.lineWidth = 1.1;
      front.beginPath();
      for (let i = 0; i <= 52; i += 1) {
        const x = -66 + i * 132 / 52;
        const y = 68 + Math.sin(i * .48 - time * 1.1) * (2.5 + Math.sin(time * .3));
        if (!i) front.moveTo(x, y); else front.lineTo(x, y);
      }
      front.stroke();
      front.restore();
    }

    drawRune(ctx, type, x, y, size, rotation, color, glow = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.15;
      if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = color; }
      ctx.beginPath();
      switch (type % 8) {
        case 0: ctx.moveTo(-size, size); ctx.lineTo(0, -size); ctx.lineTo(size, size); ctx.moveTo(-size*.55, size*.15); ctx.lineTo(size*.55, size*.15); break;
        case 1: ctx.arc(0, 0, size*.76, .2, Math.PI*1.8); ctx.moveTo(0,-size); ctx.lineTo(0,size); break;
        case 2: ctx.moveTo(-size,0);ctx.lineTo(0,-size);ctx.lineTo(size,0);ctx.lineTo(0,size);ctx.closePath();ctx.moveTo(-size*.45,0);ctx.lineTo(size*.45,0); break;
        case 3: ctx.moveTo(-size,-size);ctx.lineTo(size,size);ctx.moveTo(size,-size);ctx.lineTo(-size,size);ctx.arc(0,0,size*.42,0,Math.PI*2); break;
        case 4: ctx.moveTo(-size,size);ctx.lineTo(-size,-size);ctx.lineTo(size,-size);ctx.lineTo(size,size);ctx.moveTo(-size,0);ctx.lineTo(size,0); break;
        case 5: ctx.moveTo(-size, -size);ctx.quadraticCurveTo(size*1.3,0,-size,size);ctx.moveTo(size,-size);ctx.lineTo(size,size); break;
        case 6: ctx.arc(0,0,size*.86,0,Math.PI*2);ctx.moveTo(-size*.6,-size*.6);ctx.lineTo(size*.6,size*.6); break;
        default: ctx.moveTo(-size,0);ctx.lineTo(0,-size);ctx.lineTo(size,0);ctx.lineTo(0,size);ctx.closePath();ctx.moveTo(0,-size);ctx.lineTo(0,size); break;
      }
      ctx.stroke();
      ctx.restore();
    }

    drawFormula(time, p) {
      const back = this.back;
      const front = this.front;

      back.save();
      back.rotate(time * .055);
      back.strokeStyle = rgba(p[0], .36);
      back.lineWidth = 1;
      back.setLineDash([1.5, 5.5]);
      back.beginPath(); back.arc(0, 0, 68, 0, Math.PI * 2); back.stroke();
      back.setLineDash([]);
      for (let i = 0; i < 32; i += 1) {
        const angle = i * Math.PI * 2 / 32;
        const length = i % 4 === 0 ? 6 : 3;
        back.strokeStyle = rgba(i % 4 === 0 ? p[2] : p[0], i % 4 === 0 ? .48 : .22);
        back.beginPath();
        back.moveTo(Math.cos(angle) * (62 - length), Math.sin(angle) * (62 - length));
        back.lineTo(Math.cos(angle) * 62, Math.sin(angle) * 62);
        back.stroke();
      }
      back.restore();

      back.save();
      back.rotate(-time * .09);
      back.strokeStyle = rgba(p[1], .38);
      back.lineWidth = .9;
      back.beginPath();
      for (let i = 0; i < 3; i += 1) {
        const angle = -Math.PI/2 + i*Math.PI*2/3;
        const x = Math.cos(angle)*55, y = Math.sin(angle)*55;
        if (!i) back.moveTo(x,y); else back.lineTo(x,y);
      }
      back.closePath(); back.stroke();
      back.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = i*Math.PI/3;
        const x = Math.cos(angle)*48, y = Math.sin(angle)*48;
        if (!i) back.moveTo(x,y); else back.lineTo(x,y);
      }
      back.closePath(); back.stroke();
      back.restore();

      const scanner = (time * .17) % 1;
      for (let i = 0; i < 8; i += 1) {
        const angle = -time * .045 + i * Math.PI / 4;
        const distance = Math.min(Math.abs(i/8-scanner), 1-Math.abs(i/8-scanner));
        const active = Math.max(0, 1 - distance * 9);
        this.drawRune(front, i, Math.cos(angle)*72, Math.sin(angle)*72, 4.2 + active, angle + Math.PI/2, rgba(active > .1 ? p[2] : p[0], .48 + active*.45), 3 + active*8);
      }

      const beadAngle = scanner * Math.PI * 2 - Math.PI / 2;
      this.star(front, Math.cos(beadAngle)*62, Math.sin(beadAngle)*62, 3.2, rgba(p[2], .82), beadAngle, 4);
    }

    staffPoint(progress, radius) {
      const angle = Math.PI * (.08 + progress * .84);
      return { x:Math.cos(angle)*radius, y:Math.sin(angle)*radius + 4, angle };
    }

    drawNote(ctx, x, y, size, rotation, color, doubleNote = false) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.beginPath(); ctx.ellipse(-1, 2, size*.58, size*.4, -.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size*.45, 1); ctx.lineTo(size*.45, -size*2.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size*.45, -size*2.4); ctx.bezierCurveTo(size*1.8,-size*2.05,size*1.75,-size*.75,size*.45,-size*.65); ctx.stroke();
      if (doubleNote) {
        ctx.beginPath(); ctx.ellipse(size*1.5, 3, size*.52, size*.37, -.28, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(size*1.9,2);ctx.lineTo(size*1.9,-size*2.05);ctx.lineTo(size*.45,-size*2.4);ctx.stroke();
      }
      ctx.restore();
    }

    drawBard(time, p) {
      const back = this.back;
      const front = this.front;
      const staffGradient = back.createLinearGradient(-80, 20, 80, 80);
      staffGradient.addColorStop(0, rgba(p[1], .12));
      staffGradient.addColorStop(.48, rgba(p[0], .5));
      staffGradient.addColorStop(1, rgba(p[2], .14));

      for (let line = 0; line < 5; line += 1) {
        const radius = 42 + line * 3.35;
        back.strokeStyle = staffGradient;
        back.lineWidth = line === 2 ? 1.15 : .78;
        back.beginPath();
        for (let i = 0; i <= 64; i += 1) {
          const point = this.staffPoint(i/64, radius);
          const y = point.y + Math.sin(i*.15 + time*.6) * .5;
          if (!i) back.moveTo(point.x, y); else back.lineTo(point.x, y);
        }
        back.stroke();
      }

      const barPositions = [.16, .42, .69, .88];
      barPositions.forEach((progress, index) => {
        const outer = this.staffPoint(progress, 57);
        const inner = this.staffPoint(progress, 41);
        back.strokeStyle = rgba(index % 2 ? p[1] : p[0], .3);
        back.lineWidth = .8;
        back.beginPath(); back.moveTo(inner.x, inner.y); back.lineTo(outer.x, outer.y); back.stroke();
      });

      const phrase = [0, .14, .31, .48, .68, .84];
      phrase.forEach((offset, index) => {
        const progress = (time*.045 + offset) % 1;
        const line = index % 5;
        const point = this.staffPoint(progress, 42 + line*3.35);
        const alpha = Math.sin(Math.PI * progress) * .72 + .18;
        this.drawNote(front, point.x, point.y, 3.4 + (index%2)*.7, point.angle - Math.PI/2, rgba(index%3 ? p[0] : p[2], alpha), index === 2 || index === 5);
      });

      const chord = Math.pow(Math.max(0, Math.sin(time * .74)), 7);
      front.save();
      front.strokeStyle = rgba(p[1], .12 + chord*.32);
      front.lineWidth = 2 + chord*2;
      front.shadowBlur = 11;
      front.shadowColor = p[1];
      front.beginPath(); front.arc(0, 4, 61 + chord*2, .13*Math.PI, .87*Math.PI); front.stroke();
      front.restore();
    }

    drawWisp(ctx, x, y, scale, sway, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const gradient = ctx.createLinearGradient(0, -35, 0, 32);
      gradient.addColorStop(0, rgba(color, opacity*.78));
      gradient.addColorStop(.35, rgba(color, opacity*.44));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.bezierCurveTo(-10+sway,-28,-13,-13,-7,-5);
      ctx.bezierCurveTo(-2,3,-9,13,-14,27);
      ctx.bezierCurveTo(-5,20,4,14,5,4);
      ctx.bezierCurveTo(7,-6,15,-17,8+sway,-28);
      ctx.bezierCurveTo(5,-32,2,-34,0,-34);
      ctx.fill();
      ctx.fillStyle = rgba('#eafbf5', opacity*.48);
      ctx.beginPath(); ctx.ellipse(-2,-22,1.2,1.7,0,0,Math.PI*2); ctx.ellipse(3,-22,1.2,1.7,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    drawCandle(ctx, x, y, height, phase, p) {
      ctx.save();
      ctx.translate(x, y);
      const width = 8.5;
      const wax = ctx.createLinearGradient(-width/2, 0, width/2, 0);
      wax.addColorStop(0, rgba('#889c94', .75));
      wax.addColorStop(.45, rgba('#d7dfcf', .86));
      wax.addColorStop(1, rgba('#647972', .72));
      ctx.fillStyle = wax;
      ctx.beginPath();
      ctx.moveTo(-width/2, 0);
      ctx.lineTo(-width/2, -height+2);
      ctx.quadraticCurveTo(-width/4,-height-1,0,-height+1);
      ctx.quadraticCurveTo(width/4,-height+3,width/2,-height);
      ctx.lineTo(width/2, 0);
      ctx.quadraticCurveTo(0,3,-width/2,0);
      ctx.fill();
      ctx.fillStyle = rgba('#eef1dc', .55);
      ctx.beginPath(); ctx.ellipse(0,-height,width/2,2,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = rgba('#cbd7c8', .65);
      ctx.fillRect(width*.14,-height+1,1.2,5+height*.18);
      ctx.strokeStyle = rgba('#232621', .9);
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(0,-height); ctx.lineTo(Math.sin(phase)*.6,-height-3); ctx.stroke();

      const flicker = 1 + Math.sin(phase)*.1 + Math.sin(phase*2.7)*.07;
      const flame = ctx.createRadialGradient(0,-height-8,1,0,-height-8,9);
      flame.addColorStop(0, rgba('#fff8c8', .96));
      flame.addColorStop(.34, rgba(p[2], .9));
      flame.addColorStop(.74, rgba(p[0], .4));
      flame.addColorStop(1, rgba(p[0], 0));
      ctx.fillStyle = flame;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p[2];
      ctx.beginPath();
      ctx.moveTo(0,-height-2);
      ctx.bezierCurveTo(-4*flicker,-height-7,-2,-height-13,Math.sin(phase)*1.4,-height-16*flicker);
      ctx.bezierCurveTo(4,-height-11,4,-height-6,0,-height-2);
      ctx.fill();
      ctx.restore();
    }

    drawVigil(time, p) {
      const back = this.back;
      const front = this.front;
      back.save();
      back.strokeStyle = rgba(p[1], .22);
      back.lineWidth = 4;
      back.shadowBlur = 14;
      back.shadowColor = p[1];
      back.beginPath();
      back.moveTo(-58,55);
      back.bezierCurveTo(-77,8,-58,-62,0,-76);
      back.bezierCurveTo(58,-62,77,8,58,55);
      back.stroke();
      back.strokeStyle = rgba(p[0], .16);
      back.lineWidth = 1.2;
      back.beginPath();
      back.moveTo(-52,53);back.bezierCurveTo(-66,4,-48,-51,0,-65);back.bezierCurveTo(48,-51,66,4,52,53);back.stroke();
      back.restore();

      this.drawWisp(back, -64 + Math.sin(time*.36)*5, -4, .85, Math.sin(time*.6)*3, p[0], .48);
      this.drawWisp(back, 64 + Math.sin(time*.31+2)*5, 5, .72, Math.sin(time*.55+1)*3, p[0], .38);
      this.drawWisp(back, 43 + Math.sin(time*.24+4)*4, -47, .48, 1, p[1], .28);

      const haze = front.createLinearGradient(0, 35, 0, 80);
      haze.addColorStop(0, rgba(p[0], 0));
      haze.addColorStop(1, rgba(p[0], .16));
      front.fillStyle = haze;
      front.beginPath(); front.ellipse(0, 66, 74, 17, 0, 0, Math.PI*2); front.fill();
      this.drawCandle(front, -42, 63, 18, time*3.1, p);
      this.drawCandle(front, 0, 67, 26, time*2.8+1.4, p);
      this.drawCandle(front, 42, 62, 16, time*3.4+2.5, p);
    }

    drawBreath(time, p) {
      const back = this.back;
      const front = this.front;
      const shift = Math.sin(time*.28)*5;
      const greenPath = this.cubicPoints(
        {x:-72,y:48}, {x:-88,y:-22+shift}, {x:-36,y:-86}, {x:38,y:-65}, 52
      );
      const goldPath = this.cubicPoints(
        {x:72,y:-40}, {x:86,y:19-shift}, {x:38,y:85}, {x:-42,y:67}, 52
      );
      const greenGradient = back.createLinearGradient(-80,60,42,-75);
      greenGradient.addColorStop(0, rgba(p[0], 0));
      greenGradient.addColorStop(.28, rgba(p[0], .24));
      greenGradient.addColorStop(.63, rgba(p[0], .58));
      greenGradient.addColorStop(1, rgba(p[0], .04));
      const goldGradient = back.createLinearGradient(80,-50,-45,75);
      goldGradient.addColorStop(0, rgba(p[1], 0));
      goldGradient.addColorStop(.35, rgba(p[1], .52));
      goldGradient.addColorStop(.8, rgba(p[2], .22));
      goldGradient.addColorStop(1, rgba(p[1], 0));
      this.ribbon(back, greenPath, t => 1.5 + Math.sin(Math.PI*t)*6.5, greenGradient, .92);
      this.ribbon(back, goldPath, t => 1 + Math.sin(Math.PI*t)*5.2, goldGradient, .88);

      back.save();
      back.strokeStyle = rgba(p[2], .18);
      back.lineWidth = 1;
      for (let offset = 0; offset < 3; offset += 1) {
        back.beginPath();
        back.moveTo(-73, 51 + offset*4);
        back.bezierCurveTo(-37,74+offset*2,31,78-offset*3,73,39-offset*2);
        back.stroke();
      }
      back.restore();

      for (let i = 0; i < 7; i += 1) {
        const progress = (time*.045 + i*.145) % 1;
        const index = Math.min(goldPath.length-1, Math.floor(progress*(goldPath.length-1)));
        const point = goldPath[index];
        const previous = goldPath[Math.max(0,index-2)];
        front.save();
        front.strokeStyle = rgba(i%2?p[2]:p[0], .18 + Math.sin(Math.PI*progress)*.32);
        front.lineWidth = .75 + (i%3)*.25;
        front.beginPath(); front.moveTo(previous.x,previous.y); front.lineTo(point.x,point.y); front.stroke();
        this.dot(front, point.x, point.y, 1 + (i%2)*.5, rgba(i%2?p[2]:p[0], .36), 5);
        front.restore();
      }
    }

    flameTongue(ctx, x, y, width, height, lean, phase, p, opacity = 1) {
      const pulse = .92 + Math.sin(phase) * .08 + Math.sin(phase * 2.7) * .045;
      const base = { x, y };
      const tip = {
        x:x + lean + Math.sin(phase * .73) * 2,
        y:y - height * pulse,
      };
      const left = { x:x - width, y };
      const right = { x:x + width, y };
      const gradient = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
      gradient.addColorStop(0, rgba(p[2], opacity * .96));
      gradient.addColorStop(.22, rgba(p[0], opacity * .96));
      gradient.addColorStop(.67, rgba(p[1], opacity * .78));
      gradient.addColorStop(1, rgba(p[1], 0));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 11;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.bezierCurveTo(
        left.x - width * .2,
        left.y - height * .3,
        tip.x - width * .3,
        tip.y + height * .25,
        tip.x, tip.y
      );
      ctx.bezierCurveTo(
        tip.x + width * .34,
        tip.y + height * .2,
        right.x + width * .16,
        right.y - height * .25,
        right.x, right.y
      );
      ctx.quadraticCurveTo(base.x, base.y + 3, left.x, left.y);
      ctx.fill();

      const coreTip = {
        x:base.x + lean * .32,
        y:base.y - height * .55,
      };
      const coreColor = this.effect.core || '#fff7c5';
      const coreGradient = ctx.createLinearGradient(base.x, base.y, coreTip.x, coreTip.y);
      coreGradient.addColorStop(0, rgba(coreColor, opacity * .9));
      coreGradient.addColorStop(.7, rgba(p[2], opacity * .56));
      coreGradient.addColorStop(1, rgba(p[2], 0));
      ctx.fillStyle = coreGradient;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(base.x - width * .3, base.y);
      ctx.quadraticCurveTo(
        coreTip.x - width * .2,
        coreTip.y + height * .18,
        coreTip.x, coreTip.y
      );
      ctx.quadraticCurveTo(
        coreTip.x + width * .23,
        coreTip.y + height * .18,
        base.x + width * .32,
        base.y
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    flameMantle(ctx, time, p, baseOffset, phase, opacity = 1) {
      const upper = [];
      const lower = [];
      const count = 88;
      const halfWidth = 44;
      for (let i = 0; i <= count; i += 1) {
        const progress = i / count;
        const x = -halfWidth + progress * halfWidth * 2;
        const center = Math.pow(Math.sin(progress * Math.PI), .76);
        const base = 34 + center * 15 + baseOffset;
        const primary = (Math.sin(progress * Math.PI * 10.2 - time * 2.28 + phase) + 1) * .5;
        const secondary = Math.max(0, Math.sin(progress * Math.PI * 21.4 + time * 1.52 + phase * 1.8));
        const height = 7.5 + center * 3 + primary * 7 + secondary * 4.5;
        upper.push({ x, y:base - height });
        lower.push({ x, y:base + 3.2 + Math.sin(progress * Math.PI * 3.2 + time * .45) * .65 });
      }
      const gradient = ctx.createLinearGradient(0, 58, 0, 12);
      gradient.addColorStop(0, rgba(p[2], opacity * .96));
      gradient.addColorStop(.3, rgba(p[0], opacity * .95));
      gradient.addColorStop(.74, rgba(p[1], opacity * .74));
      gradient.addColorStop(1, rgba(p[1], 0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(upper[0].x, upper[0].y);
      upper.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      lower.reverse().forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    radialFlame(ctx, angle, radius, width, height, lean, phase, p, opacity) {
      ctx.save();
      ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      this.flameTongue(ctx, 0, 0, width, height, lean, phase, p, opacity);
      ctx.restore();
    }

    flameCorona(ctx, time, p, startAngle, endAngle, radius, count, phase, opacity, scale = 1) {
      ctx.save();
      ctx.filter = `blur(${Math.max(1.2, 3 * scale)}px)`;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(p[0], opacity * .28);
      ctx.lineWidth = 7 * scale;
      ctx.shadowBlur = 10 + 4 * scale;
      ctx.shadowColor = p[0];
      ctx.beginPath(); ctx.arc(0, 0, radius, startAngle, endAngle); ctx.stroke();
      ctx.restore();

      const softCount = count * 2;
      ctx.save();
      ctx.filter = `blur(${Math.max(1, 2.3 * scale)}px)`;
      for (let i = 0; i < softCount; i += 1) {
        const progress = (i + this.noise(i, 171) * .68) / softCount;
        const angle = startAngle + (endAngle - startAngle) * progress + Math.sin(time * .28 + i) * .012;
        const baseRadius = radius + (this.noise(i, 172) - .5) * 5 * scale;
        this.radialFlame(
          ctx,
          angle,
          baseRadius,
          (6.5 + this.noise(i, 173) * 4.8) * scale,
          (14 + this.noise(i, 174) * 22) * scale,
          (this.noise(i, 175) - .5) * 9 * scale,
          time * (1.4 + this.noise(i, 176) * .45) + i * .73 + phase,
          p,
          opacity * (.18 + this.noise(i, 177) * .16)
        );
      }
      ctx.restore();

      for (let i = 0; i < count; i += 1) {
        const progress = (i + this.noise(i, 181) * .58) / count;
        const angle = startAngle + (endAngle - startAngle) * progress + Math.sin(time * .34 + i * 1.3) * .014;
        const accent = i % 5 === 2 ? 7 : 0;
        this.radialFlame(
          ctx,
          angle,
          radius + (this.noise(i, 182) - .5) * 4 * scale,
          (5.8 + this.noise(i, 183) * 3.6) * scale,
          (14 + this.noise(i, 184) * 18 + accent) * scale,
          (this.noise(i, 185) - .5) * 8 * scale,
          time * (1.55 + this.noise(i, 186) * .4) + i * .91 + phase,
          p,
          opacity * (.48 + this.noise(i, 187) * .24)
        );
      }
    }

    flameStream(ctx, points, p, width, opacity = 1, phase = 0) {
      if (points.length < 2) return;
      const start = points[0];
      const end = points[points.length - 1];
      const coreColor = this.effect.core || '#fff7cf';
      const outer = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      outer.addColorStop(0, rgba(p[2], opacity * .92));
      outer.addColorStop(.24, rgba(p[0], opacity * .94));
      outer.addColorStop(.72, rgba(p[1], opacity * .7));
      outer.addColorStop(1, rgba(p[1], 0));
      const core = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      core.addColorStop(0, rgba(coreColor, opacity * .9));
      core.addColorStop(.42, rgba(p[2], opacity * .66));
      core.addColorStop(1, rgba(p[2], 0));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 13;
      ctx.shadowColor = p[0];
      this.ribbon(
        ctx,
        points,
        progress => {
          const body = Math.pow(Math.sin(Math.PI * progress), .68);
          const lick = Math.max(0, Math.sin(progress * Math.PI * 7.4 + phase)) * .28;
          return .65 + body * width * (.66 + lick);
        },
        outer,
        .96
      );
      ctx.shadowBlur = 7;
      this.ribbon(
        ctx,
        points,
        progress => .22 + Math.pow(Math.sin(Math.PI * progress), .8) * width * .2,
        core,
        .88
      );
      ctx.restore();
    }

    drawWildfire(time, p) {
      const back = this.back;
      const front = this.front;

      back.save();
      back.filter = 'blur(4px)';
      this.flameMantle(back, time * .9, p, -1.5, 1.4, .2);
      back.restore();

      front.save();
      front.filter = 'blur(3px)';
      this.flameMantle(front, time * .94, p, 1.5, .8, .3);
      front.restore();

      this.flameMantle(front, time, p, 0, 0, .88);

      const tongues = Array.from({ length:13 }, (_, index) => {
        const progress = index / 12;
        const profile = Math.pow(Math.sin(progress * Math.PI), .76);
        return {
          x:-42 + progress * 84,
          y:34.5 + profile * 15 + (this.noise(index, 205) - .5) * 1.1,
          width:3.8 + profile * 1.05 + this.noise(index, 201) * .7,
          height:13.5 + profile * 4.5 + this.noise(index, 202) * 6,
          lean:(this.noise(index, 203) - .5) * 3.4 + (progress - .5) * 1.6,
          phase:time * (1.46 + this.noise(index, 204) * .22) + index * .79,
        };
      });

      front.save();
      front.filter = 'blur(2.2px)';
      tongues.forEach(flame => {
        this.flameTongue(
          front,
          flame.x,
          flame.y + 1,
          flame.width + 1.4,
          flame.height + 2.5,
          flame.lean,
          flame.phase,
          p,
          .2
        );
      });
      front.restore();

      tongues.forEach((flame, index) => {
        this.flameTongue(
          front,
          flame.x,
          flame.y,
          flame.width,
          flame.height,
          flame.lean,
          flame.phase,
          p,
          .72 + this.noise(index, 206) * .16
        );
      });

      const baseGlow = front.createLinearGradient(-44, 0, 44, 0);
      baseGlow.addColorStop(0, rgba(p[0], 0));
      baseGlow.addColorStop(.14, rgba(p[0], .58));
      baseGlow.addColorStop(.5, rgba(p[2], .92));
      baseGlow.addColorStop(.86, rgba(p[0], .58));
      baseGlow.addColorStop(1, rgba(p[0], 0));
      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = baseGlow;
      front.lineWidth = 1.8;
      front.shadowBlur = 6;
      front.shadowColor = p[0];
      front.beginPath();
      front.moveTo(-44, 36.5);
      front.quadraticCurveTo(0, 61.5, 44, 36.5);
      front.stroke();
      front.restore();
    }

    drawFireRing(time, p) {
      const back = this.back;
      const front = this.front;
      const radius = this.effect.ringRadius || 42;
      const scale = this.effect.ringScale || .62;
      const glow = back.createRadialGradient(0, 0, radius - 7, 0, 0, radius + 24);
      glow.addColorStop(0, rgba(p[1], 0));
      glow.addColorStop(.34, rgba(p[1], .08));
      glow.addColorStop(.64, rgba(p[0], .14));
      glow.addColorStop(1, rgba(p[0], 0));
      back.fillStyle = glow;
      back.beginPath(); back.arc(0, 0, radius + 24, 0, Math.PI * 2); back.fill();

      this.flameCorona(back, time, p, Math.PI, Math.PI * 2, radius, 11, .85, .94, scale);
      this.flameCorona(front, time * 1.03, p, 0, Math.PI, radius, 11, .15, .98, scale);

      for (let i = 0; i < 4; i += 1) {
        const life = (time * (.045 + this.noise(i, 11) * .02) + this.noise(i, 12)) % 1;
        const angle = -Math.PI * .86 + this.noise(i, 13) * Math.PI * 1.72;
        const emberRadius = radius + 8 + life * 14;
        this.dot(
          front,
          Math.cos(angle) * emberRadius,
          Math.sin(angle) * emberRadius - life * 5,
          .55 + (1 - life) * .72,
          rgba(i % 2 ? p[0] : p[2], (1 - life) * .44),
          4
        );
      }
    }

    pathSample(points, progress) {
      const clamped = Math.max(0, Math.min(1, progress));
      const scaled = clamped * (points.length - 1);
      const index = Math.min(points.length - 2, Math.floor(scaled));
      const mix = scaled - index;
      const current = points[index];
      const next = points[index + 1];
      return {
        x:current.x + (next.x - current.x) * mix,
        y:current.y + (next.y - current.y) * mix,
        angle:Math.atan2(next.y - current.y, next.x - current.x),
      };
    }

    strokeOrganicPath(ctx, points, color, width, opacity = 1, glow = 0) {
      ctx.save();
      ctx.strokeStyle = rgba(color, opacity);
      ctx.lineWidth = width;
      if (glow) {
        ctx.shadowBlur = glow;
        ctx.shadowColor = color;
      }
      ctx.beginPath();
      points.forEach((point, index) => {
        if (!index) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    natureLeaf(ctx, x, y, length, width, rotation, p, tone = 0, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const color = tone % 3 === 0 ? p[0] : tone % 3 === 1 ? p[2] : '#6f925d';
      const gradient = ctx.createLinearGradient(0, 0, length, 0);
      gradient.addColorStop(0, rgba(p[1], opacity * .96));
      gradient.addColorStop(.5, rgba(color, opacity * .9));
      gradient.addColorStop(1, rgba(p[2], opacity * .48));
      ctx.fillStyle = gradient;
      ctx.strokeStyle = rgba(p[2], opacity * .24);
      ctx.lineWidth = .65;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(length * .28, -width, length * .78, -width * .72, length, 0);
      ctx.bezierCurveTo(length * .76, width * .72, length * .28, width, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = rgba(p[2], opacity * .35);
      ctx.lineWidth = .5;
      ctx.beginPath();
      ctx.moveTo(length * .08, 0);
      ctx.lineTo(length * .84, 0);
      ctx.stroke();
      ctx.restore();
    }

    drawGroveWreath(time, p) {
      const back = this.back;
      const front = this.front;
      const sway = Math.sin(time * .38) * 2;
      const left = this.cubicPoints(
        { x:-8, y:61 }, { x:-51, y:68 }, { x:-73, y:12 }, { x:-55 + sway, y:-44 }, 54
      );
      const right = this.cubicPoints(
        { x:10, y:62 }, { x:55, y:58 }, { x:75, y:13 }, { x:60 - sway * .7, y:-38 }, 54
      );
      [left, right].forEach(path => {
        this.strokeOrganicPath(back, path, '#293a2c', 3.2, .9);
        this.strokeOrganicPath(back, path, p[0], .7, .48, 3);
      });

      const anchors = [
        [left,.16,-1],[left,.31,1],[left,.49,-1],[left,.67,1],[left,.84,-1],
        [right,.18,1],[right,.36,-1],[right,.55,1],[right,.73,-1],[right,.88,1],
      ];
      anchors.forEach((entry, index) => {
        const point = this.pathSample(entry[0], entry[1]);
        const side = entry[2];
        const leafSway = Math.sin(time * .55 + index * .83) * .06;
        const layer = index % 4 === 0 ? back : front;
        this.natureLeaf(
          layer,
          point.x,
          point.y,
          10.5 + (index % 3) * 1.7,
          3.1 + (index % 2) * .55,
          point.angle + side * (1.02 + leafSway),
          p,
          index,
          .76 + (index % 3) * .08
        );
      });
    }

    drawGrassBlade(ctx, x, y, height, lean, p, tone, opacity) {
      const blade = this.cubicPoints(
        { x, y },
        { x:x + lean * .12, y:y - height * .34 },
        { x:x + lean * .54, y:y - height * .76 },
        { x:x + lean, y:y - height },
        26
      );
      const gradient = ctx.createLinearGradient(x, y, x + lean, y - height);
      gradient.addColorStop(0, rgba(p[1], opacity * .94));
      gradient.addColorStop(.55, rgba(tone % 2 ? p[0] : '#769b68', opacity * .86));
      gradient.addColorStop(1, rgba(p[2], opacity * .34));
      this.ribbon(ctx, blade, progress => .18 + Math.pow(1 - progress, .78) * 1.45, gradient, 1);
      this.strokeOrganicPath(ctx, blade, p[2], .42, opacity * .24);
    }

    drawForestBreath(time, p) {
      const blades = [-48,-36,-24,-12,0,12,24,36,48];
      blades.forEach((x, index) => {
        const profile = Math.pow(Math.sin(index / (blades.length - 1) * Math.PI), .62);
        const baseY = 43 + profile * 8;
        const height = 17 + profile * 8 + (index % 3) * 2;
        const wave = Math.sin(time * .72 - index * .5);
        const lean = 4.5 + wave * 4.2;
        const layer = index % 3 === 0 || index === blades.length - 1 ? this.back : this.front;
        this.drawGrassBlade(layer, x, baseY, height, lean, p, index, .68 + profile * .2);
      });
    }

    drawFernFrond(ctx, base, controlA, controlB, tip, side, time, p, phase) {
      const animatedTip = {
        x:tip.x + Math.sin(time * .42 + phase) * 2.2,
        y:tip.y + Math.cos(time * .34 + phase) * 1.2,
      };
      const stem = this.cubicPoints(base, controlA, controlB, animatedTip, 54);
      this.strokeOrganicPath(ctx, stem, '#294536', 2.4, .92);
      this.strokeOrganicPath(ctx, stem, p[0], .55, .52, 3);
      for (let i = 0; i < 7; i += 1) {
        const progress = .12 + i * .115;
        const point = this.pathSample(stem, progress);
        const length = 13.5 - Math.abs(i - 3) * .72;
        [-1, 1].forEach((branchSide, branchIndex) => {
          const angle = point.angle + branchSide * (1.08 - i * .025) + Math.sin(time * .5 + i + phase) * .035;
          this.natureLeaf(
            ctx, point.x, point.y, length, 2.85, angle,
            p, i + branchIndex, .76 + i * .022
          );
        });
      }
      const crown = this.pathSample(stem, .91);
      this.natureLeaf(ctx, crown.x, crown.y, 9.5, 2.5, crown.angle + side * .06, p, 2, .84);
    }

    drawFernAwakening(time, p) {
      this.drawFernFrond(
        this.back,
        { x:-42, y:72 }, { x:-70, y:45 }, { x:-70, y:-12 }, { x:-49, y:-54 },
        -1, time, p, .4
      );
      this.drawFernFrond(
        this.back,
        { x:45, y:70 }, { x:72, y:42 }, { x:76, y:-2 }, { x:58, y:-45 },
        1, time, p, 2.1
      );
    }

    drawFirefly(ctx, x, y, scale, p, pulse, tilt = 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 16 * scale);
      halo.addColorStop(0, rgba(p[2], .46 * pulse));
      halo.addColorStop(.36, rgba(p[0], .26 * pulse));
      halo.addColorStop(1, rgba(p[0], 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = rgba('#edf7d5', .38 + pulse * .4);
      ctx.beginPath();
      ctx.ellipse(-2.45 * scale, -.5 * scale, 3.1 * scale, 1.05 * scale, -.38, 0, Math.PI * 2);
      ctx.ellipse(2.45 * scale, -.5 * scale, 3.1 * scale, 1.05 * scale, .38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba('#263529', .82);
      ctx.beginPath();
      ctx.ellipse(0, .15 * scale, .72 * scale, 1.8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.dot(ctx, x, y, 1.15 * scale, rgba(p[2], .45 + pulse * .52), 9 * scale);
    }

    drawForestLights(time, p) {
      const lights = [
        { x:-48, y:-27, rx:11, ry:7, speed:.19, phase:.2, scale:1.05, layer:this.back },
        { x:47, y:-24, rx:9, ry:12, speed:.16, phase:1.7, scale:.98, layer:this.back },
        { x:-49, y:25, rx:12, ry:8, speed:.14, phase:3.2, scale:1.08, layer:this.front },
        { x:47, y:29, rx:10, ry:7, speed:.17, phase:4.5, scale:1.15, layer:this.front },
        { x:7, y:-53, rx:13, ry:6, speed:.12, phase:5.6, scale:1, layer:this.front },
        { x:-18, y:-57, rx:7, ry:4, speed:.13, phase:.9, scale:.76, layer:this.back },
        { x:62, y:3, rx:6, ry:10, speed:.11, phase:2.5, scale:.8, layer:this.back },
        { x:-63, y:1, rx:7, ry:9, speed:.15, phase:4, scale:.84, layer:this.front },
        { x:18, y:56, rx:10, ry:5, speed:.12, phase:6.2, scale:.82, layer:this.front },
      ];
      lights.forEach((light, index) => {
        const angle = time * light.speed + light.phase;
        const x = light.x + Math.cos(angle) * light.rx + Math.sin(time * .09 + light.phase) * 2;
        const y = light.y + Math.sin(angle * .82) * light.ry + Math.cos(time * .11 + light.phase) * 1.6;
        const glow = (Math.sin(time * .43 + light.phase * 1.73) + 1) * .5;
        const pulse = .11 + Math.pow(glow, 2.65) * .89;
        const tilt = Math.atan2(Math.cos(angle * .82) * light.ry * .82, -Math.sin(angle) * light.rx);
        this.drawFirefly(light.layer, x, y, light.scale, p, pulse, tilt);
      });
    }

    natureFlower(ctx, x, y, size, rotation, p, openness) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.shadowBlur = 7;
      ctx.shadowColor = p[0];
      for (let i = 0; i < 6; i += 1) {
        ctx.save();
        ctx.rotate(i * Math.PI / 3);
        const petalLength = size * openness;
        const petal = ctx.createLinearGradient(0, 0, 0, -petalLength);
        petal.addColorStop(0, rgba(p[1], .58));
        petal.addColorStop(.42, rgba(p[0], .94));
        petal.addColorStop(1, rgba(p[2], .88));
        ctx.fillStyle = petal;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-size * .34, -size * .28, -size * .29, -petalLength * .82, 0, -petalLength);
        ctx.bezierCurveTo(size * .29, -petalLength * .82, size * .34, -size * .28, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.rotate(Math.PI / 6);
      for (let i = 0; i < 6; i += 1) {
        ctx.save();
        ctx.rotate(i * Math.PI / 3);
        ctx.fillStyle = rgba(p[2], .34);
        ctx.beginPath();
        ctx.ellipse(0, -size * .3, size * .14, size * .29, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.dot(ctx, 0, 0, size * .19, rgba('#d7ae65', .94), 3);
      ctx.restore();
    }

    natureBud(ctx, x, y, size, rotation, p, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = rgba(p[1], opacity * .86);
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(0, 0);
      ctx.stroke();
      const fill = ctx.createLinearGradient(0, 0, 0, -size);
      fill.addColorStop(0, rgba(p[0], opacity * .86));
      fill.addColorStop(1, rgba(p[2], opacity * .92));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.bezierCurveTo(-size * .42, -size * .2, -size * .32, -size * .82, 0, -size);
      ctx.bezierCurveTo(size * .32, -size * .82, size * .42, -size * .2, 0, 1);
      ctx.fill();
      ctx.restore();
    }

    drawWhiteBloom(time, p) {
      const back = this.back;
      const front = this.front;
      const vine = this.cubicPoints(
        { x:-61, y:42 }, { x:-36, y:70 }, { x:26, y:67 }, { x:61, y:27 }, 64
      );
      const vineGradient = back.createLinearGradient(-61, 42, 61, 27);
      vineGradient.addColorStop(0, rgba('#2e4431', .96));
      vineGradient.addColorStop(.62, rgba(p[1], .94));
      vineGradient.addColorStop(1, rgba(p[0], .74));
      this.ribbon(back, vine, progress => .45 + Math.sin(progress * Math.PI) * 1.15, vineGradient, .98);
      this.strokeOrganicPath(back, vine, p[2], .45, .25, 3);

      const twigStart = this.pathSample(vine, .72);
      const twig = this.cubicPoints(
        { x:twigStart.x, y:twigStart.y },
        { x:twigStart.x + 8, y:twigStart.y - 5 },
        { x:twigStart.x + 13, y:twigStart.y - 14 },
        { x:twigStart.x + 17, y:twigStart.y - 23 }, 24
      );
      this.strokeOrganicPath(back, twig, p[1], 1.35, .84);

      const leaves = [[.24,-1,11],[.39,1,9.5],[.66,-1,10.5],[.82,1,9]];
      leaves.forEach((entry, index) => {
        const point = this.pathSample(vine, entry[0]);
        const sway = Math.sin(time * .34 + index * 1.2) * .045;
        this.natureLeaf(index % 2 ? front : back, point.x, point.y, entry[2], 3.2, point.angle + entry[1] * (.92 + sway), p, index, .86);
      });
      const blooms = [[.16,8.1,-.14],[.51,10.2,.12],[.88,8.5,.38]];
      blooms.forEach((entry, index) => {
        const point = this.pathSample(vine, entry[0]);
        const openness = .82 + (Math.sin(time * .34 + index * 1.7) + 1) * .075;
        this.natureFlower(front, point.x, point.y - 4, entry[1], point.angle + entry[2], p, openness);
      });

      const budA = this.pathSample(twig, .92);
      const budB = this.pathSample(vine, .97);
      this.natureBud(front, budA.x, budA.y, 7.4, budA.angle + Math.PI / 2, p, .9);
      this.natureBud(front, budB.x, budB.y, 6.6, budB.angle + Math.PI / 2, p, .82);

      const glint = this.pathSample(vine, .12 + ((time * .025) % .76));
      this.dot(front, glint.x, glint.y, .72, rgba(p[2], .46), 4);
    }

    drawOakLeaf(ctx, x, y, size, rotation, p, tone = 0, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const leafColor = tone % 2 ? '#a6ad62' : p[0];
      const fill = ctx.createLinearGradient(0, 0, size, 0);
      fill.addColorStop(0, rgba(p[1], opacity * .94));
      fill.addColorStop(.58, rgba(leafColor, opacity * .96));
      fill.addColorStop(1, rgba(p[2], opacity * .58));
      ctx.fillStyle = fill;
      ctx.strokeStyle = rgba(p[2], opacity * .22);
      ctx.lineWidth = .65;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(size * .11, -size * .04, size * .12, -size * .2, size * .22, -size * .17);
      ctx.bezierCurveTo(size * .22, -size * .35, size * .36, -size * .4, size * .42, -size * .22);
      ctx.bezierCurveTo(size * .44, -size * .42, size * .58, -size * .46, size * .63, -size * .24);
      ctx.bezierCurveTo(size * .69, -size * .42, size * .84, -size * .33, size * .83, -size * .15);
      ctx.bezierCurveTo(size * .91, -size * .19, size * .98, -size * .08, size, 0);
      ctx.bezierCurveTo(size * .98, size * .08, size * .91, size * .19, size * .83, size * .15);
      ctx.bezierCurveTo(size * .84, size * .33, size * .69, size * .42, size * .63, size * .24);
      ctx.bezierCurveTo(size * .58, size * .46, size * .44, size * .42, size * .42, size * .22);
      ctx.bezierCurveTo(size * .36, size * .4, size * .22, size * .35, size * .22, size * .17);
      ctx.bezierCurveTo(size * .12, size * .2, size * .11, size * .04, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = rgba(p[2], opacity * .32);
      ctx.lineWidth = .52;
      ctx.beginPath();
      ctx.moveTo(size * .06, 0);
      ctx.lineTo(size * .9, 0);
      ctx.moveTo(size * .36, 0);
      ctx.lineTo(size * .5, -size * .27);
      ctx.moveTo(size * .58, 0);
      ctx.lineTo(size * .72, size * .27);
      ctx.stroke();
      ctx.restore();
    }

    drawAcorn(ctx, x, y, size, rotation, p, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = rgba('#554330', opacity * .9);
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(0, -size * .82);
      ctx.lineTo(0, -size * .35);
      ctx.stroke();
      const body = ctx.createLinearGradient(0, -size * .2, 0, size);
      body.addColorStop(0, rgba('#9b7845', opacity));
      body.addColorStop(1, rgba(p[2], opacity * .82));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-size * .42, -size * .1);
      ctx.bezierCurveTo(-size * .5, size * .35, -size * .26, size * .86, 0, size);
      ctx.bezierCurveTo(size * .26, size * .86, size * .5, size * .35, size * .42, -size * .1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba('#4d3e2e', opacity * .96);
      ctx.beginPath();
      ctx.ellipse(0, -size * .12, size * .48, size * .24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawOakBough(time, p) {
      const back = this.back;
      const front = this.front;
      const branch = this.cubicPoints(
        { x:-73, y:49 }, { x:-61, y:9 }, { x:7, y:-57 }, { x:71, y:-45 }, 72
      );
      const wood = back.createLinearGradient(-70, 47, 69, -43);
      wood.addColorStop(0, rgba('#302a22', .98));
      wood.addColorStop(.48, rgba('#67543a', .98));
      wood.addColorStop(1, rgba(p[2], .7));
      this.ribbon(back, branch, progress => .7 + Math.pow(1 - progress, .72) * 4.5, wood, .98);
      this.strokeOrganicPath(back, branch, p[2], .52, .2);

      const forkSeeds = [
        [.17, { x:-70, y:-23 }],
        [.58, { x:22, y:-78 }],
        [.81, { x:70, y:-70 }],
      ];
      const forks = forkSeeds.map(([progress, tip]) => {
        const start = this.pathSample(branch, progress);
        return this.cubicPoints(
          { x:start.x, y:start.y },
          { x:(start.x * 2 + tip.x) / 3, y:start.y - 5 },
          { x:(start.x + tip.x * 2) / 3, y:tip.y + 4 },
          tip, 30
        );
      });
      forks.forEach((fork, index) => {
        const fill = back.createLinearGradient(fork[0].x, fork[0].y, fork[fork.length - 1].x, fork[fork.length - 1].y);
        fill.addColorStop(0, rgba('#5c4b35', .96));
        fill.addColorStop(1, rgba(p[2], .56));
        this.ribbon(back, fork, progress => .34 + Math.pow(1 - progress, .8) * (1.7 - index * .14), fill, .96);
      });

      const knot = this.pathSample(branch, .39);
      back.save();
      back.translate(knot.x, knot.y);
      back.rotate(knot.angle);
      back.strokeStyle = rgba('#d0b46d', .34);
      back.lineWidth = .7;
      back.beginPath();
      back.ellipse(0, 0, 4.8, 2.1, 0, 0, Math.PI * 2);
      back.stroke();
      back.restore();

      const leafAnchors = [
        [branch,.03,24,-1],[forks[0],.9,25,-1],
        [forks[1],.88,27,1],[forks[2],.9,25,-1],[branch,.98,26,1],
      ];
      leafAnchors.forEach((entry, index) => {
        const point = this.pathSample(entry[0], entry[1]);
        const sway = Math.sin(time * .3 + index * .83) * .055;
        this.drawOakLeaf(back, point.x, point.y, entry[2], point.angle + entry[3] * (1.02 + sway), p, index, .84);
      });

      const acornPoint = this.pathSample(branch, .82);
      this.drawAcorn(front, acornPoint.x + 2, acornPoint.y + 10, 7, -.12, p, .96);
      this.drawAcorn(front, acornPoint.x + 11, acornPoint.y + 13, 6.2, .16, p, .9);
      const glint = this.pathSample(branch, .18 + ((time * .022) % .68));
      this.dot(front, glint.x, glint.y, .68, rgba(p[2], .4), 4);
    }

    drawWillowFrond(ctx, origin, length, side, time, phase, p, opacity = 1) {
      const wind = Math.sin(time * .32 + phase) * 5;
      const stem = this.cubicPoints(
        origin,
        { x:origin.x + side * 2 + wind * .12, y:origin.y + length * .3 },
        { x:origin.x + side * 7 + wind * .55, y:origin.y + length * .72 },
        { x:origin.x + side * 10 + wind, y:origin.y + length }, 50
      );
      this.strokeOrganicPath(ctx, stem, p[1], 1.25, opacity * .9);
      this.strokeOrganicPath(ctx, stem, p[0], .42, opacity * .38);
      for (let i = 0; i < 6; i += 1) {
        const progress = .18 + i * .125;
        const point = this.pathSample(stem, progress);
        const leafSide = i % 2 ? 1 : -1;
        this.natureLeaf(
          ctx, point.x, point.y, 7.4 - i * .18, 1.75,
          point.angle + leafSide * 1.08 + Math.sin(time * .37 + phase + i) * .035,
          p, i + (side > 0 ? 1 : 0), opacity * (.76 + i * .025)
        );
      }
    }

    drawSakuraPetal(ctx, x, y, size, rotation, p, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const fill = ctx.createLinearGradient(0, -size, 0, size * .55);
      fill.addColorStop(0, rgba(p[2], opacity * .96));
      fill.addColorStop(.48, rgba(p[0], opacity * .9));
      fill.addColorStop(1, rgba('#b97080', opacity * .76));
      ctx.fillStyle = fill;
      ctx.strokeStyle = rgba(p[2], opacity * .28);
      ctx.lineWidth = .52;
      ctx.beginPath();
      ctx.moveTo(0, size * .54);
      ctx.bezierCurveTo(-size * .28, size * .38, -size * .58, size * .1, -size * .47, -size * .27);
      ctx.bezierCurveTo(-size * .38, -size * .58, -size * .12, -size * .84, 0, -size);
      ctx.bezierCurveTo(size * .17, -size * .8, size * .43, -size * .56, size * .48, -size * .24);
      ctx.bezierCurveTo(size * .53, size * .08, size * .25, size * .4, 0, size * .54);
      ctx.closePath();
      ctx.shadowBlur = 5;
      ctx.shadowColor = rgba(p[0], opacity * .32);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba('#955867', opacity * .42);
      ctx.lineWidth = .45;
      ctx.beginPath();
      ctx.moveTo(0, size * .42);
      ctx.bezierCurveTo(size * .04, size * .05, -size * .04, -size * .42, 0, -size * .78);
      ctx.stroke();
      ctx.restore();
    }

    drawWillowWhisper(time, p) {
      const back = this.back;
      const front = this.front;
      const branch = this.cubicPoints(
        { x:-74, y:-51 }, { x:-43, y:-76 }, { x:22, y:-53 }, { x:73, y:-65 }, 72
      );
      const wood = back.createLinearGradient(-74, -51, 73, -65);
      wood.addColorStop(0, rgba('#342827', .98));
      wood.addColorStop(.55, rgba(p[1], .96));
      wood.addColorStop(1, rgba('#8a615b', .72));
      this.ribbon(back, branch, progress => .45 + Math.pow(1 - progress, .72) * 3.45, wood, .98);
      this.strokeOrganicPath(back, branch, p[2], .42, .18);

      const forkSpecs = [
        [.16, { x:-53, y:-80 }],
        [.42, { x:-13, y:-79 }],
        [.68, { x:37, y:-84 }],
        [.86, { x:67, y:-45 }],
      ];
      const forks = forkSpecs.map(([progress, tip]) => {
        const start = this.pathSample(branch, progress);
        return this.cubicPoints(
          { x:start.x, y:start.y },
          { x:(start.x * 2 + tip.x) / 3, y:start.y - 4 },
          { x:(start.x + tip.x * 2) / 3, y:tip.y + 3 },
          tip, 26
        );
      });
      forks.forEach((fork, index) => {
        const twig = back.createLinearGradient(fork[0].x, fork[0].y, fork[fork.length - 1].x, fork[fork.length - 1].y);
        twig.addColorStop(0, rgba('#59403b', .96));
        twig.addColorStop(1, rgba(index === 3 ? '#a06e68' : p[1], .62));
        this.ribbon(back, fork, progress => .25 + Math.pow(1 - progress, .75) * 1.15, twig, .92);
      });

      const blossoms = [
        [branch,.06,6.3,-.2],[branch,.29,7.5,.18],[branch,.55,6.7,-.1],
        [branch,.78,7.8,.2],[branch,.96,6.3,-.32],
        [forks[0],.88,6.6,.22],[forks[1],.84,7.1,-.16],
        [forks[2],.9,6.8,.12],[forks[3],.88,6.2,-.2],
      ];
      blossoms.forEach((entry, index) => {
        const point = this.pathSample(entry[0], entry[1]);
        const openness = .9 + Math.sin(time * .27 + index * 1.17) * .035;
        this.drawCherryBlossom(front, point.x, point.y, entry[2], point.angle + entry[3], p, openness, .9);
      });

      const budPalette = [p[0], p[1], p[2]];
      [
        [forks[0],.56,5.4,-.12],
        [forks[2],.56,5.8,.16],
        [forks[3],.5,5.1,.1],
      ].forEach(entry => {
        const point = this.pathSample(entry[0], entry[1]);
        this.natureBud(front, point.x, point.y, entry[2], point.angle + Math.PI / 2 + entry[3], budPalette, .82);
      });

      const falling = [
        { x:-37, drift:9, speed:.031, phase:.05, size:5.2, spin:.46 },
        { x:-14, drift:7, speed:.026, phase:.38, size:4.4, spin:-.38 },
        { x:7, drift:11, speed:.029, phase:.69, size:6.1, spin:.31 },
        { x:29, drift:8, speed:.024, phase:.14, size:4.8, spin:-.42 },
        { x:48, drift:10, speed:.027, phase:.82, size:5.5, spin:.35 },
      ];
      falling.forEach((petal, index) => {
        const progress = (time * petal.speed + petal.phase) % 1;
        const x = petal.x + Math.sin(progress * Math.PI * 2 + index * 1.3) * petal.drift;
        const y = -57 + progress * 126;
        const opacity = .12 + Math.sin(progress * Math.PI) * .78;
        const rotation = progress * Math.PI * 2 * petal.spin + Math.sin(time * .2 + index) * .22;
        this.drawSakuraPetal(front, x, y, petal.size, rotation, p, opacity);
      });
    }

    drawMapleLeaf(ctx, x, y, size, rotation, p, tone = 0, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const accent = tone % 3 === 0 ? p[0] : tone % 3 === 1 ? p[2] : '#c57f49';
      const fill = ctx.createLinearGradient(0, -size, 0, size * .72);
      fill.addColorStop(0, rgba(p[2], opacity * .78));
      fill.addColorStop(.5, rgba(accent, opacity * .96));
      fill.addColorStop(1, rgba(p[1], opacity * .9));
      ctx.fillStyle = fill;
      ctx.strokeStyle = rgba(p[2], opacity * .22);
      ctx.lineWidth = .65;
      ctx.beginPath();
      ctx.moveTo(0, size * .66);
      ctx.bezierCurveTo(-size * .22, size * .51, -size * .53, size * .25, -size * .52, -size * .1);
      ctx.bezierCurveTo(-size * .51, -size * .45, -size * .22, -size * .82, 0, -size);
      ctx.bezierCurveTo(size * .28, -size * .77, size * .56, -size * .42, size * .51, -size * .05);
      ctx.bezierCurveTo(size * .47, size * .28, size * .2, size * .52, 0, size * .66);
      ctx.closePath();
      ctx.shadowBlur = 5;
      ctx.shadowColor = rgba(accent, .35);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(p[2], opacity * .38);
      ctx.lineWidth = .56;
      ctx.beginPath();
      ctx.moveTo(0, size * .82);
      ctx.bezierCurveTo(size * .02, size * .2, -size * .03, -size * .42, 0, -size * .82);
      [-.36,-.06,.24].forEach(progress => {
        const veinY = progress * size;
        const reach = size * (.36 - Math.abs(progress) * .12);
        ctx.moveTo(0, veinY);
        ctx.lineTo(reach, veinY - size * .2);
        ctx.moveTo(0, veinY);
        ctx.lineTo(-reach, veinY - size * .16);
      });
      ctx.stroke();
      ctx.restore();
    }

    drawMapleDrift(time, p) {
      const leaves = [
        { x:-53, y:-34, rx:7, ry:5, speed:.18, phase:.2, size:17, rotation:-.72 },
        { x:-31, y:46, rx:8, ry:4, speed:.14, phase:1.7, size:14.5, rotation:.44 },
        { x:45, y:40, rx:6, ry:7, speed:.16, phase:3.1, size:18, rotation:-.28 },
        { x:52, y:-31, rx:7, ry:5, speed:.13, phase:4.5, size:15.5, rotation:1.02 },
        { x:4, y:-55, rx:5, ry:4, speed:.15, phase:5.6, size:12.5, rotation:.18 },
      ];
      leaves.forEach((leaf, index) => {
        const angle = leaf.phase + time * leaf.speed;
        const x = leaf.x + Math.cos(angle) * leaf.rx;
        const y = leaf.y + Math.sin(angle * .82) * leaf.ry;
        const layer = y > 7 ? this.front : this.back;
        const rotation = leaf.rotation + Math.sin(time * .22 + index * 1.4) * .13;
        this.drawMapleLeaf(layer, x, y, leaf.size, rotation, p, index, .88);
      });
    }

    drawRose(ctx, x, y, size, rotation, p, phase, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const breathe = .94 + Math.sin(phase) * .04;
      ctx.scale(breathe, breathe);
      ctx.shadowBlur = 6;
      ctx.shadowColor = rgba(p[0], .42);
      const rings = [
        { count:7, radius:size * .27, length:size * .58, width:size * .46, color:p[0], alpha:.86 },
        { count:6, radius:size * .16, length:size * .43, width:size * .37, color:p[2], alpha:.76 },
        { count:5, radius:size * .07, length:size * .29, width:size * .28, color:p[0], alpha:.98 },
      ];
      rings.forEach((ring, ringIndex) => {
        for (let i = 0; i < ring.count; i += 1) {
          ctx.save();
          ctx.rotate(i * Math.PI * 2 / ring.count + ringIndex * .31);
          ctx.translate(0, -ring.radius);
          ctx.fillStyle = rgba(ring.color, opacity * ring.alpha);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-ring.width, -ring.length * .08, -ring.width * .9, -ring.length * .62, 0, -ring.length);
          ctx.bezierCurveTo(ring.width * .9, -ring.length * .62, ring.width, -ring.length * .08, 0, 0);
          ctx.fill();
          ctx.restore();
        }
      });
      this.dot(ctx, 0, 0, size * .12, rgba('#d8a264', opacity * .72), 2);
      ctx.restore();
    }

    drawThornRose(time, p) {
      const back = this.back;
      const front = this.front;
      const vine = this.cubicPoints(
        { x:-64, y:31 }, { x:-42, y:68 }, { x:29, y:71 }, { x:65, y:7 }, 68
      );
      const vineFill = back.createLinearGradient(-63, 26, 64, 18);
      vineFill.addColorStop(0, rgba('#202f27', .96));
      vineFill.addColorStop(.52, rgba(p[1], .98));
      vineFill.addColorStop(1, rgba('#526348', .9));
      this.ribbon(back, vine, progress => .52 + Math.sin(progress * Math.PI) * 1.25, vineFill, .98);
      this.strokeOrganicPath(back, vine, p[2], .42, .2);

      const leftStart = this.pathSample(vine, .04);
      const rightStart = this.pathSample(vine, .95);
      const tendrils = [
        this.cubicPoints(
          { x:leftStart.x, y:leftStart.y }, { x:-76, y:12 }, { x:-67, y:-28 }, { x:-42, y:-47 }, 52
        ),
        this.cubicPoints(
          { x:rightStart.x, y:rightStart.y }, { x:77, y:-6 }, { x:66, y:-37 }, { x:42, y:-52 }, 52
        ),
      ];
      tendrils.forEach((path, index) => {
        const fill = back.createLinearGradient(path[0].x, path[0].y, path[path.length - 1].x, path[path.length - 1].y);
        fill.addColorStop(0, rgba(p[1], .96));
        fill.addColorStop(1, rgba(index ? '#718064' : '#516353', .66));
        this.ribbon(back, path, progress => .3 + Math.pow(1 - progress, .76) * 1.25, fill, .94);
        this.strokeOrganicPath(back, path, p[2], .35, .14);
      });

      const drawThorns = (ctx, path, positions, offset = 0, opacity = .76) => {
        positions.forEach((progress, index) => {
          const point = this.pathSample(path, progress);
          const direction = (index + offset) % 2 ? -1 : 1;
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(point.angle + direction * Math.PI / 2);
          ctx.fillStyle = rgba('#8e7250', opacity);
          ctx.beginPath();
          ctx.moveTo(-1.05, 0);
          ctx.lineTo(0, -5.2 - index % 2);
          ctx.lineTo(1.05, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      };
      drawThorns(front, vine, [.14,.25,.37,.63,.75,.86]);
      drawThorns(front, tendrils[0], [.28,.5,.72], 1, .68);
      drawThorns(front, tendrils[1], [.26,.48,.7], 0, .68);

      [[.17,1],[.31,-1],[.7,1],[.84,-1]].forEach((entry, index) => {
        const point = this.pathSample(vine, entry[0]);
        this.natureLeaf(back, point.x, point.y, 11.5 - (index % 2), 3.6, point.angle + entry[1] * .88, p, index, .72);
      });
      [[.07,9,-.2],[.49,12,.08],[.93,9.6,.3]].forEach((entry, index) => {
        const point = this.pathSample(vine, entry[0]);
        this.drawRose(front, point.x, point.y - 4, entry[1], point.angle + entry[2], p, time * .32 + index * 1.6, .94);
      });

      tendrils.forEach((path, index) => {
        const leafPoint = this.pathSample(path, .58);
        this.natureLeaf(
          back, leafPoint.x, leafPoint.y, 10.5, 3.2,
          leafPoint.angle + (index ? 1 : -1) * .9, p, index + 1, .74
        );
        const tip = this.pathSample(path, .98);
        const breathe = Math.sin(time * .28 + index * 1.7) * .03;
        this.natureBud(front, tip.x, tip.y, 8.4 * (1 + breathe), tip.angle + Math.PI / 2, p, .9);
      });
    }

    drawCherryBlossom(ctx, x, y, size, rotation, p, openness = 1, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.shadowBlur = 5;
      ctx.shadowColor = rgba(p[0], .4);
      for (let i = 0; i < 5; i += 1) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 5);
        const length = size * openness;
        const fill = ctx.createLinearGradient(0, 0, 0, -length);
        fill.addColorStop(0, rgba(p[0], opacity * .94));
        fill.addColorStop(1, rgba(p[2], opacity * .96));
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-size * .36, -size * .25, -size * .32, -length * .78, 0, -length);
        ctx.bezierCurveTo(size * .32, -length * .78, size * .36, -size * .25, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      this.dot(ctx, 0, 0, size * .16, rgba('#d48a72', opacity * .92), 2);
      ctx.restore();
    }

    drawCherryBranch(time, p) {
      const back = this.back;
      const front = this.front;
      const branch = this.cubicPoints(
        { x:-72, y:38 }, { x:-48, y:8 }, { x:17, y:-51 }, { x:72, y:-55 }, 72
      );
      const wood = back.createLinearGradient(-72, 38, 72, -55);
      wood.addColorStop(0, rgba('#352b28', .98));
      wood.addColorStop(.64, rgba(p[1], .96));
      wood.addColorStop(1, rgba('#876557', .82));
      this.ribbon(back, branch, progress => .42 + Math.pow(1 - progress, .75) * 3.35, wood, .98);
      this.strokeOrganicPath(back, branch, p[2], .42, .2);

      const forks = [
        [.18, { x:-61, y:-16 }],
        [.66, { x:39, y:-75 }],
        [.83, { x:69, y:-34 }],
      ].map(([progress, tip]) => {
        const start = this.pathSample(branch, progress);
        return this.cubicPoints(
          { x:start.x, y:start.y },
          { x:(start.x * 2 + tip.x) / 3, y:start.y - 4 },
          { x:(start.x + tip.x * 2) / 3, y:tip.y + 3 }, tip, 26
        );
      });
      forks.forEach(fork => this.strokeOrganicPath(back, fork, '#60483f', 1.55, .9));

      const blossoms = [
        [forks[0],.68,8.4,-.2],[forks[0],.94,7.1,.4],
        [forks[1],.58,8.8,.1],[forks[1],.86,7.3,-.35],[forks[1],.99,6.1,.2],
        [forks[2],.82,8.1,.22],
      ];
      blossoms.forEach((entry, index) => {
        const point = this.pathSample(entry[0], entry[1]);
        const openness = .9 + Math.sin(time * .29 + index * 1.25) * .035;
        this.drawCherryBlossom(front, point.x, point.y, entry[2], point.angle + entry[3], p, openness, .92);
      });

      const route = this.cubicPoints({x:65,y:-28},{x:82,y:-2},{x:53,y:38},{x:25,y:65},54);
      const petalPoint = this.pathSample(route, (time * .028) % 1);
      front.save();
      front.translate(petalPoint.x, petalPoint.y);
      front.rotate(petalPoint.angle + time * .18);
      front.fillStyle = rgba(p[2], .74);
      front.beginPath();
      front.moveTo(0, 0);
      front.bezierCurveTo(-2.2, -1.5, -2.1, -5, 0, -6.2);
      front.bezierCurveTo(2.1, -5, 2.2, -1.5, 0, 0);
      front.fill();
      front.restore();
    }

    drawCanopyLeaf(ctx, x, y, length, width, rotation, p, tone, light) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const accent = tone % 3 === 0 ? p[0] : tone % 3 === 1 ? '#537d58' : p[2];
      const fill = ctx.createLinearGradient(-length * .5, 0, length * .5, 0);
      fill.addColorStop(0, rgba(p[1], .94));
      fill.addColorStop(.52, rgba(accent, .86 + light * .1));
      fill.addColorStop(1, rgba(p[2], .38 + light * .28));
      ctx.fillStyle = fill;
      ctx.strokeStyle = rgba(p[2], .17 + light * .12);
      ctx.lineWidth = .62;
      ctx.beginPath();
      ctx.moveTo(-length * .5, 0);
      ctx.bezierCurveTo(-length * .2, -width, length * .2, -width, length * .5, 0);
      ctx.bezierCurveTo(length * .2, width, -length * .2, width, -length * .5, 0);
      ctx.closePath();
      ctx.shadowBlur = 4;
      ctx.shadowColor = rgba(accent, .26);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(p[2], .24 + light * .16);
      ctx.lineWidth = .48;
      ctx.beginPath();
      ctx.moveTo(-length * .38, 0);
      ctx.lineTo(length * .38, 0);
      ctx.stroke();
      ctx.restore();
    }

    drawLeafCanopy(time, p) {
      const back = this.back;
      const front = this.front;
      const branches = [
        this.cubicPoints({ x:-70, y:-18 }, { x:-61, y:-48 }, { x:-30, y:-72 }, { x:-4, y:-66 }, 48),
        this.cubicPoints({ x:68, y:-27 }, { x:57, y:-56 }, { x:33, y:-75 }, { x:10, y:-68 }, 48),
      ];
      branches.forEach((branch, index) => {
        const branchTone = index ? '#354b3b' : '#29382f';
        this.strokeOrganicPath(back, branch, branchTone, 2.6 - index * .25, .9);
        this.strokeOrganicPath(back, branch, p[2], .42, .16);
      });

      const leaves = [
        [branches[0],.1,19,6.5,-1],[branches[0],.3,23,7.8,1],
        [branches[0],.52,21,7,-1],[branches[0],.75,25,8.4,1],[branches[0],.96,19,6.5,-1],
        [branches[1],.12,21,7,1],[branches[1],.38,24,8,-1],
        [branches[1],.64,20,6.8,1],[branches[1],.9,23,7.6,-1],
      ];
      leaves.forEach((leaf, index) => {
        const point = this.pathSample(leaf[0], leaf[1]);
        const sway = Math.sin(time * .27 + index * .78) * .052;
        const light = (Math.sin(time * .22 - index * .51) + 1) * .5;
        this.drawCanopyLeaf(
          back, point.x, point.y, leaf[2], leaf[3],
          point.angle + leaf[4] * (.9 + sway), p, index, light
        );
      });

      [[branches[0],.04,-1],[branches[1],.05,1]].forEach((entry, index) => {
        const point = this.pathSample(entry[0], entry[1]);
        const sway = Math.sin(time * .3 + index * 1.7) * .04;
        this.drawCanopyLeaf(front, point.x, point.y + 3, 15, 5.2, point.angle + entry[2] * (.92 + sway), p, index + 1, .42);
      });
    }

    drawAntlerSide(ctx, side, time, p, phase) {
      const sway = Math.sin(time * .28 + phase) * 1.5;
      const main = this.cubicPoints(
        { x:side * 15, y:-24 },
        { x:side * 22, y:-47 },
        { x:side * 46, y:-61 },
        { x:side * (62 + sway), y:-77 },
        52
      );
      const wood = ctx.createLinearGradient(side * 12, -22, side * 65, -78);
      wood.addColorStop(0, rgba('#302c25', .98));
      wood.addColorStop(.48, rgba('#67593f', .98));
      wood.addColorStop(.82, rgba(p[0], .82));
      wood.addColorStop(1, rgba(p[2], .54));
      ctx.save();
      ctx.shadowBlur = 5;
      ctx.shadowColor = rgba(p[0], .28);
      this.ribbon(ctx, main, progress => .48 + Math.pow(1 - progress, .72) * 2.65, wood, .98);
      ctx.restore();
      this.strokeOrganicPath(ctx, main, p[2], .48, .24);

      const forks = [];
      [.27,.45,.62,.77].forEach((progress, index) => {
        const start = this.pathSample(main, progress);
        forks.push(this.cubicPoints(
          { x:start.x, y:start.y },
          { x:start.x - side * (2 + index * .6), y:start.y - 6 },
          { x:start.x - side * (7 + index * 1.5), y:start.y - 13 - index * 2.2 },
          { x:start.x - side * (10 + index * 2.1), y:start.y - 20 - index * 3.2 },
          28
        ));
      });
      forks.forEach((path, index) => {
        const branch = ctx.createLinearGradient(path[0].x, path[0].y, path[path.length - 1].x, path[path.length - 1].y);
        branch.addColorStop(0, rgba('#5a4d38', .96));
        branch.addColorStop(.72, rgba(p[0], .78));
        branch.addColorStop(1, rgba(p[2], .5));
        this.ribbon(ctx, path, progress => .24 + Math.pow(1 - progress, .78) * (1.42 - index * .1), branch, .96);
        this.strokeOrganicPath(ctx, path, p[2], .36, .2);
      });
      const glint = this.pathSample(main, .22 + ((time * .035 + phase * .1) % .62));
      this.dot(ctx, glint.x, glint.y, .74, rgba(p[2], .54), 4);
    }

    drawGuardianAntlers(time, p) {
      this.drawAntlerSide(this.back, -1, time, p, .4);
      this.drawAntlerSide(this.back, 1, time, p, 2.2);
    }

    drawOwlWing(ctx, side, lift, p) {
      ctx.save();
      ctx.scale(side, 1);
      const gradient = ctx.createLinearGradient(8, -50, 79, -17);
      gradient.addColorStop(0, rgba(p[1], .94));
      gradient.addColorStop(.56, rgba('#304139', .92));
      gradient.addColorStop(1, rgba(p[0], .52));
      ctx.fillStyle = gradient;
      ctx.strokeStyle = rgba(p[0], .42);
      ctx.lineWidth = .85;
      ctx.beginPath();
      ctx.moveTo(8, -42);
      ctx.bezierCurveTo(27, -62, 58, -65 + lift, 78, -41 + lift);
      ctx.bezierCurveTo(74, -31 + lift, 68, -24, 59, -18);
      ctx.quadraticCurveTo(55, -12, 49, -22);
      ctx.quadraticCurveTo(44, -14, 39, -25);
      ctx.quadraticCurveTo(33, -18, 28, -30);
      ctx.quadraticCurveTo(19, -27, 8, -42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = rgba(p[2], .17);
      ctx.lineWidth = .7;
      [[15,-43,48,-51,68,-38],[14,-38,39,-39,57,-25],[15,-33,31,-29,43,-20]].forEach(points => {
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawOwlGuardian(time, p) {
      const back = this.back;
      const front = this.front;
      const lift = Math.sin(time * .44) * 2.4;
      this.drawOwlWing(back, -1, lift, p);
      this.drawOwlWing(back, 1, lift, p);
      front.save();
      const face = front.createRadialGradient(0, -53, 2, 0, -53, 17);
      face.addColorStop(0, rgba(p[2], .28));
      face.addColorStop(.55, rgba(p[1], .98));
      face.addColorStop(1, rgba('#273730', .96));
      front.fillStyle = face;
      front.strokeStyle = rgba(p[0], .58);
      front.lineWidth = 1;
      front.beginPath();
      front.ellipse(0, -52, 14.5, 16.5, 0, 0, Math.PI * 2);
      front.fill();
      front.stroke();
      front.strokeStyle = rgba(p[2], .24);
      front.lineWidth = .72;
      [-1, 1].forEach(side => {
        front.beginPath();
        front.arc(side * 5.3, -51.5, 5.8, Math.PI * .16, Math.PI * 1.84);
        front.stroke();
      });
      const blink = Math.pow(Math.max(0, Math.sin(time * .54)), 12);
      [-5.3, 5.3].forEach(x => this.dot(front, x, -51.5, 1.3 - blink * .65, rgba(p[2], .9), 6));
      front.fillStyle = rgba('#c9a85d', .92);
      front.beginPath();
      front.moveTo(-2.3, -47.5);
      front.lineTo(2.3, -47.5);
      front.lineTo(0, -43.5);
      front.closePath();
      front.fill();
      front.restore();
    }

    drawFoxTail(time, p) {
      const back = this.back;
      const front = this.front;
      const sway = Math.sin(time * .42) * 3;
      const tail = this.cubicPoints(
        { x:-49, y:47 },
        { x:-30, y:82 },
        { x:55, y:76 },
        { x:61 + sway, y:-11 + sway * .28 },
        64
      );
      const gradient = back.createLinearGradient(-49, 47, 56, -8);
      gradient.addColorStop(0, rgba(p[1], .86));
      gradient.addColorStop(.24, rgba(p[0], .9));
      gradient.addColorStop(.78, rgba('#b96738', .96));
      gradient.addColorStop(1, rgba('#d78955', .92));
      back.save();
      back.shadowBlur = 8;
      back.shadowColor = rgba(p[0], .5);
      this.ribbon(back, tail, progress => .8 + Math.pow(Math.sin(Math.PI * progress), .72) * 10.5, gradient, .96);
      back.restore();

      const tipSource = tail.slice(44);
      const tip = tipSource.map((point, index) => ({ ...point, t:index / Math.max(1, tipSource.length - 1) }));
      const tipGradient = back.createLinearGradient(tip[0].x, tip[0].y, tip[tip.length - 1].x, tip[tip.length - 1].y);
      tipGradient.addColorStop(0, rgba(p[2], .08));
      tipGradient.addColorStop(.42, rgba(p[2], .78));
      tipGradient.addColorStop(1, rgba('#fff4d2', .96));
      this.ribbon(back, tip, progress => .45 + Math.pow(1 - progress, .55) * 7.1, tipGradient, .98);

      const foreground = tail.slice(0, 43);
      const frontGradient = front.createLinearGradient(-49, 47, 35, 69);
      frontGradient.addColorStop(0, rgba(p[1], .72));
      frontGradient.addColorStop(.32, rgba(p[0], .92));
      frontGradient.addColorStop(1, rgba('#bd6c3d', .74));
      this.ribbon(front, foreground, progress => .65 + Math.sin(Math.PI * progress) * 8.8, frontGradient, .9);
      this.strokeOrganicPath(front, foreground, p[2], .55, .22, 3);
      [.2,.36,.52,.67].forEach((progress, index) => {
        const point = this.pathSample(tail, progress);
        const length = 5.2 + index * .5;
        front.save();
        front.translate(point.x, point.y);
        front.rotate(point.angle - .28);
        front.strokeStyle = rgba(p[2], .12 + index * .025);
        front.lineWidth = .7;
        front.beginPath();
        front.moveTo(-length * .5, 0);
        front.quadraticCurveTo(0, -1.3, length * .5, 0);
        front.stroke();
        front.restore();
      });
    }

    drawDandelionSeed(ctx, x, y, scale, rotation, p, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = rgba(p[2], opacity);
      ctx.fillStyle = rgba(p[0], opacity * .82);
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8.5 * scale, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(1.35 * scale, 0, 1.5 * scale, .68 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI * .52 + i * Math.PI * .26;
        ctx.beginPath();
        ctx.moveTo(-8.5 * scale, 0);
        ctx.lineTo(-8.5 * scale + Math.cos(angle) * 6.5 * scale, Math.sin(angle) * 6.5 * scale);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawDandelionPath(time, p) {
      const back = this.back;
      const front = this.front;
      back.save();
      back.strokeStyle = rgba(p[1], .86);
      back.lineWidth = 1.8;
      back.beginPath();
      back.moveTo(-57, 67);
      back.quadraticCurveTo(-55, 37, -49, 10);
      back.stroke();
      back.strokeStyle = rgba(p[2], .62);
      back.lineWidth = .68;
      for (let i = 0; i < 9; i += 1) {
        if (i === 1 || i === 5 || i === 7) continue;
        const angle = i * Math.PI * 2 / 9;
        back.beginPath();
        back.moveTo(-49, 10);
        back.lineTo(-49 + Math.cos(angle) * 11.5, 10 + Math.sin(angle) * 11.5);
        back.stroke();
        this.dot(back, -49 + Math.cos(angle) * 11.5, 10 + Math.sin(angle) * 11.5, .68, rgba(p[2], .68), 2);
      }
      back.restore();

      const route = this.cubicPoints(
        { x:-43, y:4 }, { x:-12, y:-34 }, { x:33, y:-67 }, { x:71, y:-31 }, 64
      );
      [.02,.23,.48,.72].forEach((offset, index) => {
        const progress = (offset + time * (.012 + index * .001)) % 1;
        const point = this.pathSample(route, progress);
        const fade = Math.pow(Math.sin(progress * Math.PI), .45);
        this.drawDandelionSeed(
          front, point.x, point.y, 1 + index * .08,
          point.angle + Math.sin(time * .35 + index) * .12,
          p, fade * .82
        );
      });
    }

    drawRootRibbon(ctx, path, p, tone, opacity = 1) {
      const first = path[0];
      const last = path[path.length - 1];
      const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
      gradient.addColorStop(0, rgba('#27251f', opacity));
      gradient.addColorStop(.48, rgba(tone ? '#556141' : '#494b36', opacity * .96));
      gradient.addColorStop(.82, rgba(tone ? p[0] : p[1], opacity * .72));
      gradient.addColorStop(1, rgba(p[2], opacity * .34));
      this.ribbon(ctx, path, progress => .42 + Math.pow(1 - progress, .72) * 4.15, gradient, 1);
      this.strokeOrganicPath(ctx, path, p[2], .48, opacity * .18);
    }

    drawAncientRoots(time, p) {
      const back = this.back;
      const front = this.front;
      const roots = [
        this.cubicPoints({x:-3,y:36},{x:-17,y:49},{x:-44,y:64},{x:-72,y:67},46),
        this.cubicPoints({x:-7,y:38},{x:-29,y:42},{x:-51,y:30},{x:-74,y:35},46),
        this.cubicPoints({x:4,y:37},{x:18,y:51},{x:43,y:67},{x:72,y:68},46),
        this.cubicPoints({x:8,y:38},{x:31,y:42},{x:52,y:29},{x:75,y:34},46),
      ];
      roots.forEach((root, index) => {
        this.drawRootRibbon(back, root, p, index % 2, .98);
        const visibleSource = root.slice(0, 19);
        const visible = visibleSource.map((point, visibleIndex) => ({
          ...point,
          t:visibleIndex / Math.max(1, visibleSource.length - 1),
        }));
        this.drawRootRibbon(front, visible, p, index % 2, .58);
        if (index % 2 === 0) {
          const pulseProgress = .2 + ((time * .026 + index * .17) % .58);
          const point = this.pathSample(root, pulseProgress);
          this.dot(front, point.x, point.y, .76, rgba(p[2], .48), 5);
        }
      });
      const forks = [
        this.cubicPoints({x:-43,y:57},{x:-49,y:49},{x:-57,y:46},{x:-63,y:43},18),
        this.cubicPoints({x:42,y:59},{x:49,y:51},{x:58,y:48},{x:65,y:43},18),
      ];
      forks.forEach((fork, index) => {
        this.drawRootRibbon(front, fork, p, index, .7);
      });
    }

    orientedFlame(ctx, x, y, angle, width, height, lean, phase, p, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      this.flameTongue(ctx, 0, 0, width, height, lean, phase, p, opacity);
      ctx.restore();
    }

    drawFireWings(time, p) {
      const back = this.back;
      const front = this.front;
      const leftAngles = [2.5, 2.76, 3.02, 3.28, 3.53];
      const lengths = [19, 28, 39, 33, 24];

      back.save();
      back.filter = 'blur(3px)';
      [-1, 1].forEach(side => {
        leftAngles.forEach((leftAngle, index) => {
          const angle = side < 0 ? leftAngle : Math.PI - leftAngle;
          this.radialFlame(
            back,
            angle,
            40 + (index % 2) * 2,
            6.5 + index * .35,
            lengths[index] + 8,
            side * (index - 2) * 1.2,
            time * (1.48 + index * .05) + index * .72,
            p,
            .2
          );
        });
      });
      back.restore();

      [-1, 1].forEach(side => {
        leftAngles.forEach((leftAngle, index) => {
          const angle = side < 0 ? leftAngle : Math.PI - leftAngle;
          this.radialFlame(
            back,
            angle,
            40 + (index % 2) * 2,
            4.6 + index * .28,
            lengths[index],
            side * (index - 2) * 1.1,
            time * (1.7 + index * .06) + index * .83 + (side > 0 ? .6 : 0),
            p,
            .66 + index * .035
          );
        });
      });

      const bridge = front.createLinearGradient(-39, 38, 39, 38);
      bridge.addColorStop(0, rgba(p[1], 0));
      bridge.addColorStop(.28, rgba(p[0], .5));
      bridge.addColorStop(.5, rgba(p[2], .78));
      bridge.addColorStop(.72, rgba(p[0], .5));
      bridge.addColorStop(1, rgba(p[1], 0));
      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = bridge;
      front.lineWidth = 3;
      front.shadowBlur = 9;
      front.shadowColor = p[0];
      front.beginPath();
      front.moveTo(-39, 37);
      front.quadraticCurveTo(0, 48 + Math.sin(time * .8) * 1.5, 39, 37);
      front.stroke();
      front.restore();

      [-30, 0, 30].forEach((x, index) => {
        this.flameTongue(front, x, 39 + Math.abs(x) * .08, 4.4 + (index === 1 ? 1 : 0), 14 + (index === 1 ? 5 : 0), (index - 1) * 2.2, time * 1.9 + index, p, .62);
      });
    }

    orbitTrail(ctx, time, p, headAngle, direction, span, radius, width, opacity, salt) {
      const points = [];
      const count = 42;
      for (let i = 0; i <= count; i += 1) {
        const progress = i / count;
        const angle = headAngle - direction * span * progress;
        const localRadius = radius + Math.sin(Math.PI * progress) * 3.4 + Math.sin(time * 1.2 + progress * 8 + salt) * 1.2;
        points.push({
          x:Math.cos(angle) * localRadius,
          y:Math.sin(angle) * localRadius * .96,
          t:progress,
        });
      }
      this.flameStream(ctx, points, p, width, opacity, time * 1.4 + salt);
      const head = points[0];
      const motionAngle = headAngle + direction * Math.PI / 2;
      this.orientedFlame(ctx, head.x, head.y, motionAngle, width * .78, width * 2.3, -direction * 1.4, time * 2 + salt, p, opacity * .9);
      this.dot(ctx, head.x, head.y, width * .32, rgba(p[2], opacity * .92), 8);
      return { head, motionAngle };
    }

    drawFireOrbit(time, p) {
      const back = this.back;
      const front = this.front;
      const phase = time * .24;
      const rear = this.orbitTrail(back, time, p, phase - Math.PI * .72, 1, 1.34, 47, 5.1, .72, .4);
      const lead = this.orbitTrail(front, time, p, phase + Math.PI * .28, -1, 1.1, 45, 5.6, .9, 2.1);

      [rear, lead].forEach((item, index) => {
        const ctx = index ? front : back;
        for (let spark = 0; spark < 3; spark += 1) {
          const distance = 7 + spark * 5 + this.noise(spark, 211 + index) * 3;
          const x = item.head.x - Math.cos(item.motionAngle) * distance + Math.sin(item.motionAngle) * (spark - 1) * 2;
          const y = item.head.y - Math.sin(item.motionAngle) * distance - Math.cos(item.motionAngle) * (spark - 1) * 2;
          this.dot(ctx, x, y, .65 + spark * .12, rgba(spark === 0 ? p[2] : p[0], .58 - spark * .12), 5);
        }
      });
    }

    drawFireComets(time, p) {
      const back = this.back;
      const front = this.front;
      const tracks = [
        { radius:43, span:.58, offset:-1.55, width:4.8, layer:front },
        { radius:50, span:.48, offset:.58, width:4.1, layer:back },
        { radius:57, span:.4, offset:2.72, width:3.5, layer:front },
      ];

      tracks.forEach((track, index) => {
        const pulse = .62 + Math.pow(Math.max(0, Math.sin(time * .72 + index * 2.12)), 2) * .34;
        const direction = 1;
        const angle = track.offset + time * .17 + Math.sin(time * (.21 + index * .025) + index * 1.7) * .11;
        const result = this.orbitTrail(
          track.layer,
          time,
          p,
          angle,
          direction,
          track.span,
          track.radius,
          track.width,
          pulse,
          3.4 + index * 1.7
        );
        const tangent = result.motionAngle + Math.PI;
        for (let ember = 0; ember < 2; ember += 1) {
          const distance = 9 + ember * 8 + this.noise(index, 231 + ember) * 4;
          this.dot(
            track.layer,
            result.head.x + Math.cos(tangent) * distance,
            result.head.y + Math.sin(tangent) * distance,
            .65 + this.noise(index, 241 + ember) * .45,
            rgba(ember ? p[0] : p[2], pulse * (.46 - ember * .12)),
            5
          );
        }
      });
    }

    drawSolarFlares(time, p) {
      const back = this.back;
      const front = this.front;
      const loops = [
        this.cubicPoints({ x:-34, y:-20 }, { x:-72, y:-47 }, { x:-55, y:-79 }, { x:-14, y:-39 }, 46),
        this.cubicPoints({ x:-17, y:-39 }, { x:-17, y:-78 }, { x:35, y:-82 }, { x:28, y:-33 }, 46),
        this.cubicPoints({ x:31, y:-27 }, { x:73, y:-49 }, { x:76, y:-5 }, { x:40, y:10 }, 46),
      ];

      loops.forEach((points, index) => {
        back.save();
        back.filter = 'blur(3px)';
        this.flameStream(back, points, p, 7.2 - index * .55, .22, time + index);
        back.restore();
        this.flameStream(back, points, p, 4.4 - index * .3, .62 + index * .06, time * 1.2 + index * 1.7);
        const endpoint = points[points.length - 1];
        this.flameTongue(back, endpoint.x, endpoint.y, 3.6, 12 + index * 2, index - 1, time * 1.8 + index, p, .58);
      });

      const rim = front.createLinearGradient(-42, -34, 43, -25);
      rim.addColorStop(0, rgba(p[1], 0));
      rim.addColorStop(.18, rgba(p[0], .44));
      rim.addColorStop(.5, rgba(p[2], .78));
      rim.addColorStop(.82, rgba(p[0], .44));
      rim.addColorStop(1, rgba(p[1], 0));
      front.save();
      front.strokeStyle = rim;
      front.lineWidth = 2.2;
      front.shadowBlur = 9;
      front.shadowColor = p[0];
      front.beginPath();
      front.arc(0, 0, 41, Math.PI * 1.08, Math.PI * 1.92);
      front.stroke();
      front.restore();

      for (let i = 0; i < 5; i += 1) {
        const life = (time * (.035 + i * .003) + this.noise(i, 301)) % 1;
        const x = -50 + i * 24 + Math.sin(time + i) * 3;
        const y = -42 - life * (18 + i % 2 * 7);
        this.dot(front, x, y, .6 + (1 - life) * .7, rgba(i % 2 ? p[0] : p[2], (1 - life) * .48), 5);
      }
    }

    magmaShard(ctx, x, y, scale, rotation, heat, p, seed) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      const rock = ctx.createLinearGradient(-10, -12, 10, 12);
      rock.addColorStop(0, '#302b2b');
      rock.addColorStop(.55, '#49352f');
      rock.addColorStop(1, '#1a1a1d');
      ctx.fillStyle = rock;
      ctx.strokeStyle = rgba('#8d7769', .34 + heat * .16);
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 2 + heat * 4;
      ctx.shadowColor = '#000000';
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(-12 + this.noise(seed, 311) * 4, -4);
      ctx.lineTo(-5, -12);
      ctx.lineTo(7 + this.noise(seed, 312) * 3, -9);
      ctx.lineTo(12, 1);
      ctx.lineTo(6, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = rgba(heat > .55 ? p[2] : p[0], .18 + heat * .76);
      ctx.lineWidth = .75 + heat * .75;
      ctx.shadowBlur = 6 + heat * 7;
      ctx.beginPath();
      ctx.moveTo(-7, 5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, -6);
      ctx.moveTo(-2, 0);
      ctx.lineTo(4, 3);
      ctx.lineTo(8, -3);
      ctx.stroke();
      ctx.strokeStyle = rgba('#c0a38e', .12);
      ctx.lineWidth = .65;
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-4, -8); ctx.lineTo(5, -7); ctx.stroke();
      ctx.restore();
    }

    drawMagmaRift(time, p) {
      const back = this.back;
      const front = this.front;
      const glow = back.createRadialGradient(0, 47, 4, 0, 47, 70);
      glow.addColorStop(0, rgba(p[2], .22));
      glow.addColorStop(.42, rgba(p[0], .16));
      glow.addColorStop(1, rgba(p[1], 0));
      back.fillStyle = glow;
      back.beginPath(); back.ellipse(0, 50, 72, 35, 0, 0, Math.PI * 2); back.fill();

      const shards = [
        [-58,38,.82,-.26],[-42,50,1.02,.18],[-20,57,.96,-.12],[2,60,1.08,.08],
        [25,56,.94,.18],[46,48,1.04,-.16],[61,35,.78,.28],
      ];
      shards.forEach((values, index) => {
        const heat = .28 + Math.pow(Math.max(0, Math.sin(time * .72 - index * .48)), 4) * .72;
        const layer = index === 0 || index === shards.length - 1 ? back : front;
        this.magmaShard(layer, values[0], values[1], values[2], values[3], heat, p, index);
      });

      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = rgba(p[0], .42);
      front.lineWidth = 2.8;
      front.shadowBlur = 11;
      front.shadowColor = p[0];
      front.beginPath();
      for (let i = 0; i <= 24; i += 1) {
        const progress = i / 24;
        const x = -59 + progress * 118;
        const y = 54 + Math.sin(progress * Math.PI) * 9 + Math.sin(i * 1.7 + time * .45) * 1.6;
        if (!i) front.moveTo(x, y); else front.lineTo(x, y);
      }
      front.stroke();
      front.strokeStyle = rgba(p[2], .62);
      front.lineWidth = .8;
      front.stroke();
      front.restore();

      [[-34,52,3.4,11],[5,58,4,14],[38,51,3.3,10]].forEach((values, index) => {
        this.flameTongue(front, values[0], values[1], values[2], values[3], index - 1, time * 1.8 + index, p, .46);
      });

      for (let i = 0; i < 4; i += 1) {
        const life = (time * (.045 + i * .006) + this.noise(i, 321)) % 1;
        const x = -42 + i * 28 + Math.sin(time * .7 + i) * 3;
        const y = 48 - life * 31;
        this.dot(front, x, y, .7 + (1 - life) * .9, rgba(i % 2 ? p[0] : p[2], (1 - life) * .5), 6);
      }
    }

    drawDragonBreath(time, p) {
      const back = this.back;
      const front = this.front;
      const path = this.cubicPoints(
        { x:-62, y:42 },
        { x:-12, y:80 + Math.sin(time * .55) * 3 },
        { x:72, y:37 },
        { x:46, y:-67 },
        64
      );
      back.save();
      back.filter = 'blur(4px)';
      this.flameStream(back, path, p, 12, .22, time * 1.2);
      back.restore();
      this.flameStream(back, path, p, 8.2, .76, time * 1.45);

      [10, 20, 31, 43, 53].forEach((pointIndex, index) => {
        const point = path[pointIndex];
        const next = path[Math.min(path.length - 1, pointIndex + 2)];
        const tangent = Math.atan2(next.y - point.y, next.x - point.x);
        const normal = tangent - Math.PI / 2;
        this.orientedFlame(back, point.x, point.y, normal, 4.4 + index % 2, 14 + index * 2.1, index % 2 ? 2 : -2, time * 1.9 + index, p, .62);
      });

      const foreground = path.slice(0, 22);
      this.flameStream(front, foreground, p, 5.2, .56, time * 1.6 + 2);
      const head = path[path.length - 1];
      this.orientedFlame(back, head.x, head.y, -Math.PI / 2, 7, 24, 3, time * 2.1, p, .82);

      for (let i = 0; i < 5; i += 1) {
        const life = (time * .055 + i * .19) % 1;
        const x = head.x + 7 + life * 24 + Math.sin(i + time) * 3;
        const y = head.y - 2 - life * 17 + i * 2;
        this.dot(front, x, y, .6 + (1 - life) * .8, rgba(i % 2 ? p[0] : p[2], (1 - life) * .5), 5);
      }
    }

    drawDiademFlame(ctx, x, y, scale, rotation, phase, p, opacity) {
      const pulse = .96 + Math.sin(phase) * .035;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation + Math.sin(phase * .47) * .025);
      ctx.scale(scale, scale * pulse);
      const gradient = ctx.createLinearGradient(0, 3, 0, -27);
      gradient.addColorStop(0, rgba(p[2], opacity * .92));
      gradient.addColorStop(.26, rgba(p[0], opacity));
      gradient.addColorStop(.72, rgba(p[1], opacity * .72));
      gradient.addColorStop(1, rgba(p[1], 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 7;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(0, -27);
      ctx.bezierCurveTo(-1, -20, -8, -17, -5, -9);
      ctx.bezierCurveTo(-3, -4, -5, 0, 0, 3);
      ctx.bezierCurveTo(5, 0, 7, -5, 5, -11);
      ctx.bezierCurveTo(4, -16, 7, -21, 0, -27);
      ctx.fill();
      ctx.strokeStyle = rgba(this.effect.core || p[2], opacity * .72);
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.bezierCurveTo(2, -13, -2, -9, 0, -4);
      ctx.stroke();
      ctx.restore();
    }

    drawFlameCrown(time, p) {
      const back = this.back;
      const front = this.front;
      const radius = 44;
      const segments = [
        [1.1, 1.25], [1.29, 1.44],
        [1.56, 1.71], [1.75, 1.9],
      ];
      const band = front.createLinearGradient(-45, -34, 45, -34);
      band.addColorStop(0, rgba(p[1], .2));
      band.addColorStop(.3, rgba(p[0], .76));
      band.addColorStop(.5, rgba(p[2], .96));
      band.addColorStop(.7, rgba(p[0], .76));
      band.addColorStop(1, rgba(p[1], .2));

      back.save();
      back.filter = 'blur(3px)';
      back.strokeStyle = rgba(p[0], .18);
      back.lineWidth = 4.2;
      back.shadowBlur = 10;
      back.shadowColor = p[0];
      segments.forEach(([start, end]) => {
        back.beginPath();
        back.arc(0, 0, radius, start * Math.PI, end * Math.PI);
        back.stroke();
      });
      back.restore();

      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = rgba(p[1], .48);
      front.lineWidth = 2.8;
      segments.forEach(([start, end]) => {
        front.beginPath();
        front.arc(0, 0, radius, start * Math.PI, end * Math.PI);
        front.stroke();
      });
      front.strokeStyle = band;
      front.lineWidth = 1.05;
      front.shadowBlur = 6;
      front.shadowColor = p[0];
      segments.forEach(([start, end], index) => {
        const shimmer = Math.sin(time * .62 + index * 1.7) * .004;
        front.beginPath();
        front.arc(0, 0, radius, (start + shimmer) * Math.PI, (end + shimmer) * Math.PI);
        front.stroke();
      });
      front.restore();

      this.drawDiademFlame(front, 0, -48, .95, 0, time * .86, p, .9);
      this.drawDiademFlame(front, -31, -37, .44, -.42, time * .72 + 1.3, p, .72);
      this.drawDiademFlame(front, 31, -37, .44, .42, time * .72 + 2.7, p, .72);

      const innerAngle = Math.PI * 1.44;
      const innerX = Math.cos(innerAngle) * radius;
      const innerY = Math.sin(innerAngle) * radius;
      this.star(front, innerX, innerY, 1.65, rgba(p[2], .82), Math.PI / 4, 4);
      this.star(front, -innerX, innerY, 1.65, rgba(p[2], .82), Math.PI / 4, 4);

      for (let i = 0; i < 2; i += 1) {
        const life = (time * .035 + i * .52) % 1;
        const side = i ? 1 : -1;
        this.dot(
          back,
          side * (9 + life * 5),
          -67 - life * 9,
          .42 + (1 - life) * .25,
          rgba(i ? p[0] : p[2], (1 - life) * .3),
          3
        );
      }
    }

    drawEmberVortex(time, p) {
      const back = this.back;
      const front = this.front;
      const points = [];
      const count = 78;
      const headAngle = time * .31 - Math.PI * .45;
      for (let i = 0; i <= count; i += 1) {
        const progress = i / count;
        const angle = headAngle + progress * Math.PI * 1.62;
        const radius = 42 + progress * 22 + Math.sin(progress * 10 - time) * 1.3;
        points.push({ x:Math.cos(angle) * radius, y:Math.sin(angle) * radius * .93, t:progress });
      }

      back.save();
      back.filter = 'blur(3px)';
      this.flameStream(back, points, p, 7.2, .18, time);
      back.restore();
      this.flameStream(back, points, p, 4.9, .7, time * 1.25);

      let segment = [];
      const frontSegments = [];
      points.forEach(point => {
        if (point.y > 8) segment.push(point);
        else if (segment.length) { frontSegments.push(segment); segment = []; }
      });
      if (segment.length) frontSegments.push(segment);
      frontSegments.forEach(part => { if (part.length > 2) this.flameStream(front, part, p, 4.4, .72, time * 1.3 + 1); });

      const head = points[0];
      const motionAngle = headAngle - Math.PI / 2;
      this.orientedFlame(front, head.x, head.y, motionAngle, 5.4, 16, -2, time * 2, p, .88);
      for (let i = 0; i < 11; i += 1) {
        const progress = .2 + i / 12 * .8;
        const point = points[Math.floor(progress * count)];
        const drift = 3 + this.noise(i, 331) * 7;
        this.dot(
          front,
          point.x + Math.sin(headAngle + progress * 8) * drift,
          point.y - (i % 3) * 2,
          .45 + this.noise(i, 332) * .75,
          rgba(i % 3 ? p[0] : p[2], (.62 - progress * .42)),
          4
        );
      }
    }

    drawMeteorRain(time, p) {
      const back = this.back;
      const front = this.front;
      const lanes = [
        { x:45, y:-45, length:40, width:6.2, speed:.8, phase:0 },
        { x:-52, y:4, length:29, width:4.7, speed:.67, phase:2.1 },
        { x:55, y:31, length:23, width:3.8, speed:.58, phase:4.2 },
      ];

      lanes.forEach((lane, index) => {
        const travel = Math.sin(time * lane.speed + lane.phase) * 6;
        const head = {
          x:lane.x - travel * .62,
          y:lane.y + travel,
        };
        const tail = { x:head.x + lane.length * .72, y:head.y - lane.length };
        const points = this.cubicPoints(
          head,
          { x:head.x + lane.length * .2, y:head.y - lane.length * .28 },
          { x:tail.x - lane.length * .18, y:tail.y + lane.length * .18 },
          tail,
          28
        );
        this.flameStream(back, points, p, lane.width, .62 + index * .08, time * 1.4 + index);
        this.orientedFlame(back, head.x, head.y, Math.PI * .73, lane.width * .72, lane.width * 2.5, 1.5, time * 2 + index, p, .78);
        this.dot(back, head.x, head.y, lane.width * .36, rgba(p[2], .9), 9);

        for (let spark = 0; spark < 3; spark += 1) {
          const distance = 9 + spark * 7;
          this.dot(
            front,
            head.x + distance * .58 + this.noise(spark, 341 + index) * 4,
            head.y - distance + this.noise(spark, 351 + index) * 5,
            .55 + spark * .12,
            rgba(spark ? p[0] : p[2], .46 - spark * .09),
            5
          );
        }
      });
    }

    drawWillOWisps(time, p) {
      const back = this.back;
      const front = this.front;
      const wisps = [
        { x:-54, y:18, phase:0, layer:front, scale:1 },
        { x:0, y:-53, phase:2.1, layer:back, scale:.92 },
        { x:54, y:21, phase:4.2, layer:front, scale:.84 },
      ];

      wisps.forEach((wisp, index) => {
        const x = wisp.x + Math.sin(time * .55 + wisp.phase) * 4;
        const y = wisp.y + Math.cos(time * .72 + wisp.phase) * 5;
        const pulse = .56 + Math.pow(Math.max(0, Math.sin(time * .9 + wisp.phase)), 4) * .4;
        const aura = wisp.layer.createRadialGradient(x, y - 8, 2, x, y - 8, 19);
        aura.addColorStop(0, rgba(p[2], .12 + pulse * .12));
        aura.addColorStop(.5, rgba(p[0], .08 + pulse * .08));
        aura.addColorStop(1, rgba(p[1], 0));
        wisp.layer.fillStyle = aura;
        wisp.layer.beginPath(); wisp.layer.arc(x, y - 8, 19, 0, Math.PI * 2); wisp.layer.fill();
        this.flameTongue(
          wisp.layer,
          x,
          y,
          5.8 * wisp.scale,
          (20 + index * 2) * wisp.scale,
          Math.sin(time * .8 + wisp.phase) * 3,
          time * 1.7 + wisp.phase,
          p,
          pulse
        );
        this.dot(wisp.layer, x, y - 7, 1.3 * wisp.scale, rgba(p[2], .88), 7);

        for (let mote = 0; mote < 2; mote += 1) {
          const angle = time * (.35 + index * .04) + wisp.phase + mote * Math.PI;
          this.dot(wisp.layer, x + Math.cos(angle) * (9 + mote * 3), y - 8 + Math.sin(angle) * 6, .55, rgba(p[0], .36), 4);
        }
      });
    }

    flamePetal(ctx, x, y, width, height, rotation, phase, p, opacity) {
      const pulse = .94 + Math.sin(phase) * .045;
      const h = height * pulse;
      const coreColor = this.effect.core || '#fff7dc';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalCompositeOperation = 'lighter';
      const gradient = ctx.createLinearGradient(0, 0, 0, -h);
      gradient.addColorStop(0, rgba(p[2], opacity * .9));
      gradient.addColorStop(.3, rgba(p[0], opacity * .9));
      gradient.addColorStop(.78, rgba(p[1], opacity * .65));
      gradient.addColorStop(1, rgba(p[1], 0));
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 11;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(-width * .92, -h * .72, -width, -h * .24, 0, 0);
      ctx.bezierCurveTo(width, -h * .24, width * .92, -h * .72, 0, -h);
      ctx.fill();

      const core = ctx.createLinearGradient(0, 0, 0, -h * .68);
      core.addColorStop(0, rgba(coreColor, opacity * .82));
      core.addColorStop(.65, rgba(p[2], opacity * .42));
      core.addColorStop(1, rgba(p[2], 0));
      ctx.fillStyle = core;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, -h * .68);
      ctx.bezierCurveTo(-width * .31, -h * .45, -width * .3, -h * .14, 0, -2);
      ctx.bezierCurveTo(width * .3, -h * .14, width * .31, -h * .45, 0, -h * .68);
      ctx.fill();
      ctx.restore();
    }

    drawFlameLotus(time, p) {
      const front = this.front;
      const outer = [
        { x:-36, y:50, width:8.6, height:24, rotation:-.68 },
        { x:-26, y:56, width:9.4, height:31, rotation:-.48 },
        { x:-14, y:60, width:10, height:38, rotation:-.25 },
        { x:0, y:62, width:10.8, height:43, rotation:0 },
        { x:14, y:60, width:10, height:38, rotation:.25 },
        { x:26, y:56, width:9.4, height:31, rotation:.48 },
        { x:36, y:50, width:8.6, height:24, rotation:.68 },
      ];

      front.save();
      front.filter = 'blur(3px)';
      outer.forEach((petal, index) => {
        this.flamePetal(front, petal.x, petal.y, petal.width + 2, petal.height + 5, petal.rotation, time * 1.2 + index, p, .18);
      });
      front.restore();
      outer.forEach((petal, index) => {
        this.flamePetal(front, petal.x, petal.y, petal.width, petal.height, petal.rotation, time * 1.55 + index * .72, p, .66);
      });
      [-12, 0, 12].forEach((x, index) => {
        this.flamePetal(front, x, 62, 6.2, 25 + (index === 1 ? 7 : 0), (index - 1) * .2, time * 1.85 + index, [p[2], p[0], this.effect.core], .7);
      });

      front.save();
      front.strokeStyle = rgba(p[0], .34);
      front.lineWidth = 2;
      front.shadowBlur = 9;
      front.shadowColor = p[0];
      front.beginPath(); front.ellipse(0, 57, 43, 7, 0, 0, Math.PI * 2); front.stroke();
      front.restore();
    }

    drawSerpentHead(ctx, x, y, angle, p, pulse) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(-11, 0, 10, 0);
      gradient.addColorStop(0, rgba(p[1], .45));
      gradient.addColorStop(.55, rgba(p[0], .9));
      gradient.addColorStop(1, rgba(p[2], .92));
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 9;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.quadraticCurveTo(4, -7, -6, -5);
      ctx.lineTo(-10, -1);
      ctx.lineTo(-6, 5);
      ctx.quadraticCurveTo(4, 7, 11, 0);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', .72 + pulse * .22);
      ctx.beginPath(); ctx.arc(3, -2.2, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(p[2], .52);
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(14, -2); ctx.moveTo(9, 0); ctx.lineTo(14, 2); ctx.stroke();
      ctx.restore();
    }

    drawFireSerpent(time, p) {
      const back = this.back;
      const front = this.front;
      const headAngle = -Math.PI / 2 + time * Math.PI * 2 / 18;
      const arcLength = Math.PI * 1.48;
      const body = [];
      const count = 88;
      for (let i = 0; i <= count; i += 1) {
        const progress = i / count;
        const angle = headAngle - arcLength * progress;
        const wave = Math.sin(progress * Math.PI * 4.2 - time * .72) * 2.15;
        const radius = 49.5 + wave + Math.sin(progress * Math.PI) * 2.2;
        body.push({
          x:Math.cos(angle) * radius,
          y:Math.sin(angle) * radius * .96,
          t:progress,
        });
      }

      back.save();
      back.filter = 'blur(2.7px)';
      this.flameStream(back, body, p, 6.2, .16, time * .72);
      back.restore();
      this.flameStream(back, body, p, 4.5, .7, time * .86);

      const frontSegments = [];
      let segment = [];
      body.forEach(point => {
        if (point.y > 5) segment.push(point);
        else if (segment.length) {
          if (segment.length > 2) frontSegments.push(segment);
          segment = [];
        }
      });
      if (segment.length > 2) frontSegments.push(segment);
      frontSegments.forEach((points, index) => {
        this.flameStream(front, points, p, 4.15, .76, time * .9 + index * 1.7);
      });

      for (let i = 9; i < body.length - 8; i += 11) {
        const point = body[i];
        const layer = point.y > 5 ? front : back;
        const outward = Math.atan2(point.y, point.x);
        this.orientedFlame(
          layer,
          point.x,
          point.y,
          outward,
          1.85,
          5.8 + this.noise(i, 341) * 2.4,
          (this.noise(i, 342) - .5) * 1.2,
          time * 1.1 + i * .58,
          p,
          .42
        );
      }

      const head = body[0];
      const neck = body[3];
      const angle = Math.atan2(head.y - neck.y, head.x - neck.x);
      const pulse = .5 + Math.sin(time * 1.15) * .5;
      const headLayer = head.y > 5 ? front : back;
      this.drawSerpentHead(headLayer, head.x, head.y, angle, p, pulse);

      for (let i = 0; i < 5; i += 1) {
        const point = body[Math.max(0, body.length - 1 - i * 2)];
        const layer = point.y > 5 ? front : back;
        this.dot(layer, point.x, point.y, .42 + (4 - i) * .08, rgba(i % 2 ? p[0] : p[2], .22 + i * .045), 4);
      }
    }

    forgeShard(ctx, x, y, rotation, scale, heat, p, seed) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      const metal = ctx.createLinearGradient(-11, -8, 11, 8);
      metal.addColorStop(0, '#2a2c2f');
      metal.addColorStop(.45, '#57504a');
      metal.addColorStop(1, '#1c1b1d');
      ctx.fillStyle = metal;
      ctx.strokeStyle = rgba('#9e9287', .42);
      ctx.lineWidth = 1.1;
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#000000';
      ctx.beginPath();
      ctx.moveTo(-12, -7);
      ctx.lineTo(5, -10 + this.noise(seed, 361) * 3);
      ctx.lineTo(12, -2);
      ctx.lineTo(7, 9);
      ctx.lineTo(-8, 11);
      ctx.lineTo(-13, 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.strokeStyle = rgba(heat > .52 ? p[2] : p[0], .22 + heat * .68);
      ctx.lineWidth = .9 + heat * .65;
      ctx.shadowBlur = 5 + heat * 8;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(-11, -7);
      ctx.lineTo(5, -9);
      ctx.lineTo(11, -2);
      ctx.stroke();
      ctx.strokeStyle = rgba(p[0], .14 + heat * .54);
      ctx.lineWidth = .75;
      ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(1, 1); ctx.lineTo(7, -4); ctx.stroke();
      ctx.restore();
    }

    drawForgeHeat(time, p) {
      const back = this.back;
      const front = this.front;
      const shards = [
        { x:-55, y:-25, r:-.45, s:.82, layer:back },
        { x:55, y:-22, r:.52, s:.76, layer:back },
        { x:-45, y:43, r:.28, s:.88, layer:front },
        { x:45, y:42, r:-.32, s:.92, layer:front },
      ];

      shards.forEach((shard, index) => {
        const strike = Math.pow(Math.max(0, Math.sin(time * .82 - index * .72)), 8);
        const heat = .38 + strike * .62;
        this.forgeShard(shard.layer, shard.x, shard.y, shard.r, shard.s, heat, p, index);
        const direction = Math.atan2(shard.y, shard.x);
        for (let spark = 0; spark < 5; spark += 1) {
          const spread = (spark - 2) * .16;
          const distance = 8 + spark * 3 + strike * (12 + spark * 2);
          const x = shard.x + Math.cos(direction + spread) * distance;
          const y = shard.y + Math.sin(direction + spread) * distance;
          shard.layer.save();
          shard.layer.strokeStyle = rgba(spark % 2 ? p[0] : p[2], .16 + strike * (.7 - spark * .07));
          shard.layer.lineWidth = .7 + strike * .5;
          shard.layer.shadowBlur = 5;
          shard.layer.shadowColor = p[0];
          shard.layer.beginPath();
          shard.layer.moveTo(x, y);
          shard.layer.lineTo(x + Math.cos(direction + spread) * (3 + strike * 5), y + Math.sin(direction + spread) * (3 + strike * 5));
          shard.layer.stroke();
          shard.layer.restore();
        }
        if (index > 1) {
          this.flameTongue(shard.layer, shard.x, shard.y - 6, 3.2, 9 + strike * 7, index === 2 ? -2 : 2, time * 1.8 + index, p, .22 + strike * .45);
        }
      });

      const heat = back.createRadialGradient(0, 0, 31, 0, 0, 72);
      heat.addColorStop(0, rgba(p[0], 0));
      heat.addColorStop(.62, rgba(p[1], .08));
      heat.addColorStop(1, rgba(p[0], 0));
      back.fillStyle = heat;
      back.beginPath(); back.arc(0, 0, 72, 0, Math.PI * 2); back.fill();
    }

    drawSoulfire(time, p) {
      const back = this.back;
      const front = this.front;
      const sway = Math.sin(time * .56) * 5;
      const left = this.cubicPoints(
        { x:-28, y:68 },
        { x:-78 - sway, y:42 },
        { x:-73 + sway * .4, y:-43 },
        { x:-17 + sway * .35, y:-82 },
        58
      );
      const right = this.cubicPoints(
        { x:28, y:68 },
        { x:78 + sway, y:39 },
        { x:70 - sway * .4, y:-47 },
        { x:15 - sway * .35, y:-84 },
        58
      );

      const glow = back.createRadialGradient(0, -3, 30, 0, -3, 88);
      glow.addColorStop(0, rgba(p[1], 0));
      glow.addColorStop(.5, rgba(p[1], .1));
      glow.addColorStop(.77, rgba(p[0], .13));
      glow.addColorStop(1, rgba(p[0], 0));
      back.fillStyle = glow;
      back.beginPath(); back.arc(0, -3, 88, 0, Math.PI * 2); back.fill();

      this.flameStream(back, left, p, 5.2, .42, time * 1.1);
      this.flameStream(back, right, p, 5.2, .42, time * 1.1 + Math.PI);

      const lowerBridge = this.cubicPoints(
        { x:-29, y:66 },
        { x:-14, y:76 + Math.sin(time * .7) * 2 },
        { x:14, y:76 - Math.sin(time * .7) * 2 },
        { x:29, y:66 },
        34
      );
      this.flameStream(front, lowerBridge, p, 3.4, .38, time * 1.35);

      const drawColumns = soft => {
        [-1, 1].forEach((side, sideIndex) => {
          const total = soft ? 10 : 7;
          for (let i = 0; i < total; i += 1) {
            const y = 60 - i * (soft ? 12 : 17) + Math.sin(time * .42 + i * .9 + sideIndex) * 2;
            const x = side * (49 + Math.sin(time * .36 + i * 1.2) * 4);
            const target = y > 27 ? front : back;
            target.save();
            if (soft) target.filter = 'blur(2.2px)';
            this.flameTongue(
              target,
              x,
              y,
              (soft ? 9 : 7) + this.noise(i, 121 + sideIndex) * 3,
              (soft ? 29 : 25) + this.noise(i, 131 + sideIndex) * 14,
              -side * (3 + this.noise(i, 141) * 6),
              time * (1.72 + this.noise(i, 151) * .34) + i * .83 + sideIndex,
              p,
              soft ? .24 : .62 + (i % 3) * .08
            );
            target.restore();
          }
        });
      };
      drawColumns(true);
      drawColumns(false);

      this.flameTongue(back, left[left.length - 1].x, left[left.length - 1].y, 6, 27, -5, time * 1.72, p, .84);
      this.flameTongue(back, right[right.length - 1].x, right[right.length - 1].y, 6, 28, 5, time * 1.66 + 1.2, p, .84);
      [
        [-27, 66, 6.5, 22, -4],
        [0, 71, 7.5, 28, 1],
        [27, 66, 6.5, 23, 4],
      ].forEach((values, index) => {
        this.flameTongue(front, values[0], values[1], values[2], values[3], values[4], time * 2 + index * 1.3, p, .72);
      });

      for (let i = 0; i < 4; i += 1) {
        const life = (time * (.035 + i * .006) + this.noise(i, 42)) % 1;
        const x = (i % 2 ? 1 : -1) * (19 + life * 13) + Math.sin(time + i) * 3;
        const y = -68 - life * 23;
        this.dot(front, x, y, .7 + (1 - life) * .65, rgba(i % 2 ? p[0] : p[2], (1 - life) * .52), 6);
      }
    }

    drawFireCrescent(time, p) {
      const back = this.back;
      const front = this.front;
      const smokePalette = this.effect.smoke || ['#28163b', '#1a122c', '#100b1c'];
      const smokePoints = [];
      const count = 64;
      const startAngle = Math.PI * .28;
      const arcLength = Math.PI * 1.44;
      for (let i = 0; i <= count; i += 1) {
        const progress = i / count;
        const angle = startAngle + progress * arcLength;
        const wave = Math.sin(progress * Math.PI * 3.1 - time * .72) * 2.2;
        const radius = 59 + Math.sin(Math.PI * progress) * 4 + wave;
        const smokeRadius = radius + 13 + Math.sin(time * .31 + progress * 8) * 2;
        smokePoints.push({ x:Math.cos(angle) * smokeRadius, y:Math.sin(angle) * smokeRadius, t:progress });
      }

      const smoke = back.createLinearGradient(58, 48, 38, -78);
      smoke.addColorStop(0, rgba(smokePalette[0], .04));
      smoke.addColorStop(.38, rgba(smokePalette[0], .22));
      smoke.addColorStop(.78, rgba(smokePalette[1], .16));
      smoke.addColorStop(1, rgba(smokePalette[2], 0));
      this.ribbon(back, smokePoints, progress => 1.2 + Math.sin(Math.PI * progress) * 4.8, smoke, .82);

      this.flameCorona(back, time, p, Math.PI, startAngle + arcLength, 57, 8, 1.2, .9);
      this.flameCorona(front, time * 1.02, p, startAngle, Math.PI, 57, 8, .22, .96);

      const flareProgress = .42 + Math.sin(time * .42) * .04;
      const flareAngle = startAngle + flareProgress * arcLength;
      const flareRadius = 59 + Math.sin(Math.PI * flareProgress) * 4;
      this.dot(front, Math.cos(flareAngle) * flareRadius, Math.sin(flareAngle) * flareRadius, 2.2, rgba(p[2], .8), 12);
    }

    lightning(ctx, start, end, seed, color, opacity, width = 1.2) {
      const points = [start];
      const segments = 7;
      const dx = end.x-start.x, dy=end.y-start.y;
      const length = Math.hypot(dx,dy)||1;
      const nx=-dy/length, ny=dx/length;
      for(let i=1;i<segments;i+=1){const t=i/segments;const jitter=(this.noise(seed+i,9)-.5)*10;points.push({x:start.x+dx*t+nx*jitter,y:start.y+dy*t+ny*jitter});}
      points.push(end);
      ctx.save();
      ctx.strokeStyle=rgba(color,opacity);ctx.lineWidth=width;ctx.shadowBlur=10;ctx.shadowColor=color;ctx.beginPath();points.forEach((pt,i)=>{if(!i)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);});ctx.stroke();
      if(opacity>.4){for(let i=2;i<points.length-2;i+=2){const pt=points[i];const angle=Math.atan2(dy,dx)+(this.noise(seed+i,12)>.5?1:-1)*1.05;ctx.lineWidth=width*.62;ctx.beginPath();ctx.moveTo(pt.x,pt.y);ctx.lineTo(pt.x+Math.cos(angle)*(7+this.noise(i)*6),pt.y+Math.sin(angle)*(7+this.noise(i)*6));ctx.stroke();}}
      ctx.restore();
    }

    drawCloud(ctx, x, y, radius, color, opacity) {
      const gradient=ctx.createRadialGradient(x,y,radius*.1,x,y,radius);
      gradient.addColorStop(0,rgba(color,opacity));gradient.addColorStop(.48,rgba(color,opacity*.62));gradient.addColorStop(1,rgba(color,0));
      ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }

    drawStorm(time,p){
      const back=this.back,front=this.front;
      back.save();back.globalCompositeOperation='source-over';
      for(let i=0;i<9;i++){const angle=Math.PI*(1.08+i/8*.84);const radius=58+this.noise(i)*8;this.drawCloud(back,Math.cos(angle)*radius,Math.sin(angle)*radius*.78-4,18+this.noise(i,2)*7,i%2?'#28354f':'#41506b',.45);}
      back.restore();
      back.save();back.strokeStyle=rgba(p[1],.28);back.lineWidth=2;back.shadowBlur=9;back.shadowColor=p[1];back.beginPath();back.arc(0,0,61,Math.PI*1.08,Math.PI*1.92);back.stroke();back.restore();

      const anchors=[[-58,-23,-78,-5],[0,-58,-10,-84],[58,-22,78,2]];
      anchors.forEach((values,index)=>{const flash=Math.pow(Math.max(0,Math.sin(time*(.95+index*.08)+index*2.15)),13);const start={x:values[0],y:values[1]},end={x:values[2],y:values[3]};this.lightning(front,start,end,index*30+Math.floor(time*2),index===1?p[2]:p[0],.14+flash*.86,1+flash*.8);});
      const travel=(time*.24)%1;const angle=Math.PI*(1.08+travel*.84);this.star(front,Math.cos(angle)*61,Math.sin(angle)*61,2.3,rgba(p[2],.72),angle,4);
    }

    drawLeaf(ctx,x,y,scale,rotation,color,maple=false,opacity=1){
      ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.strokeStyle=rgba('#ffe7af',.28);ctx.lineWidth=.8;
      ctx.beginPath();
      if(maple){ctx.moveTo(0,-12);ctx.lineTo(3,-5);ctx.lineTo(8,-8);ctx.lineTo(7,-2);ctx.lineTo(13,0);ctx.lineTo(6,3);ctx.lineTo(7,9);ctx.lineTo(1,6);ctx.lineTo(0,13);ctx.lineTo(-1,6);ctx.lineTo(-7,9);ctx.lineTo(-6,3);ctx.lineTo(-13,0);ctx.lineTo(-7,-2);ctx.lineTo(-8,-8);ctx.lineTo(-3,-5);ctx.closePath();}
      else{ctx.moveTo(-10,1);ctx.bezierCurveTo(-5,-9,6,-11,11,-1);ctx.bezierCurveTo(4,10,-6,11,-10,1);ctx.closePath();}
      ctx.fill();ctx.stroke();ctx.strokeStyle=rgba('#ffeec9',.36);ctx.beginPath();ctx.moveTo(maple?0:-8,maple?10:1);ctx.lineTo(maple?0:8,maple?-8:-1);ctx.stroke();ctx.restore();
    }

    drawAutumn(time,p){
      const back=this.back,front=this.front;
      back.save();back.strokeStyle=rgba('#6f4a2f',.72);back.lineWidth=3.4;back.beginPath();back.moveTo(-73,51);back.bezierCurveTo(-40,70,19,75,72,42);back.stroke();
      for(let i=0;i<5;i++){const x=-48+i*24;const y=64-Math.abs(i-2)*3;back.strokeStyle=rgba('#8a5a35',.58);back.lineWidth=1.2;back.beginPath();back.moveTo(x,y);back.lineTo(x+(i%2?7:-7),y-12-this.noise(i)*5);back.stroke();}
      const wind=back.createLinearGradient(-82,-30,82,50);wind.addColorStop(0,rgba(p[0],0));wind.addColorStop(.42,rgba(p[0],.13));wind.addColorStop(.7,rgba(p[2],.08));wind.addColorStop(1,rgba(p[0],0));const points=this.cubicPoints({x:-86,y:-26},{x:-25,y:-66},{x:38,y:75},{x:88,y:22},44);this.ribbon(back,points,t=>1+Math.sin(Math.PI*t)*3.3,wind,.9);back.restore();

      for(let i=0;i<9;i++){const progress=(time*(.035+this.noise(i)*.016)+i/9)%1;const angle=-Math.PI*.9+progress*Math.PI*1.8;const radius=59+Math.sin(progress*Math.PI*2+i)*10;const x=Math.cos(angle)*radius+Math.sin(time*.45+i)*4;const y=Math.sin(angle)*radius*.9;const depth=.58+this.noise(i,2)*.35;this.drawLeaf(front,x,y,depth,angle+time*(.18+this.noise(i,3)*.16)+i,p[i%3],i%3===0,.48+depth*.42);}
    }

    drawMagma(time,p){
      const back=this.back,front=this.front;const pulse=.62+Math.sin(time*.72)*.18;
      back.save();back.rotate(time*.018);
      for(let i=0;i<13;i++){const start=i*Math.PI*2/13+this.noise(i)*.08;const length=.27+this.noise(i,2)*.15;const radius=56+(this.noise(i,3)-.5)*5;back.strokeStyle=rgba('#211817',.96);back.lineWidth=9+this.noise(i,4)*4;back.beginPath();back.arc(0,0,radius,start,start+length);back.stroke();back.strokeStyle=rgba('#43302a',.7);back.lineWidth=1.2;back.beginPath();back.arc(0,0,radius-2,start+.02,start+length-.02);back.stroke();}
      back.restore();

      front.save();front.rotate(time*.018);front.globalCompositeOperation='lighter';
      for(let i=0;i<13;i++){const start=i*Math.PI*2/13+this.noise(i)*.08;const length=.27+this.noise(i,2)*.15;const radius=56+(this.noise(i,3)-.5)*5;const local=.35+Math.pow(Math.max(0,Math.sin(time*.72-i*.42)),4)*.65;front.strokeStyle=rgba(i%4?p[0]:p[2],(.24+local*.52)*pulse);front.lineWidth=.85+local*1.1;front.shadowBlur=8+local*6;front.shadowColor=i%4?p[1]:p[2];front.beginPath();front.arc(0,0,radius,start+length+.015,start+length+.085);front.stroke();}
      front.restore();

      for(let band=0;band<3;band++){front.save();front.strokeStyle=rgba(p[2],.06+band*.025);front.lineWidth=1;front.beginPath();for(let i=0;i<=32;i++){const angle=Math.PI*(1.08+i/32*.84);const radius=69+band*5+Math.sin(i*.8-time*(1+band*.2))*2;const x=Math.cos(angle)*radius;const y=Math.sin(angle)*radius;if(!i)front.moveTo(x,y);else front.lineTo(x,y);}front.stroke();front.restore();}
      for(let i=0;i<4;i++){const life=(time*.07+i*.25)%1;const x=(i-1.5)*23+Math.sin(time+i)*2;const y=55+life*24;front.fillStyle=rgba(i%2?p[0]:p[2],(1-life)*.52);front.beginPath();front.moveTo(x,y-4);front.bezierCurveTo(x+3,y,x+3,y+4,x,y+5);front.bezierCurveTo(x-3,y+4,x-3,y,x,y-4);front.fill();}
    }

    drawWing(ctx, side, time, p) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const opening = 1 + Math.sin(time * .42) * .035;
      for (let i = 0; i < 6; i += 1) {
        const start = { x:side * (32 + i * 1.7), y:18 - i * 3.5 };
        const end = { x:side * (70 + i * 3.1) * opening, y:-47 + i * 14 };
        const path = this.cubicPoints(
          start,
          { x:side * (48 + i * 5), y:3 - i * 10 },
          { x:side * (65 + i * 5), y:-26 + i * 4 },
          end,
          28
        );
        const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        gradient.addColorStop(0, rgba(p[1], .08));
        gradient.addColorStop(.42, rgba(i % 2 ? p[0] : p[2], .42));
        gradient.addColorStop(1, rgba(p[2], .03));
        this.ribbon(ctx, path, progress => Math.sin(Math.PI * progress) * (5.4 - i * .38) + .6, gradient, .82);
        ctx.strokeStyle = rgba(p[2], .15 + i * .018);
        ctx.lineWidth = .65;
        ctx.beginPath();
        path.forEach((point, index) => { if (!index) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSacred(time, p) {
      const back = this.back;
      const front = this.front;
      back.save();
      back.globalCompositeOperation = 'lighter';
      const sweep = (Math.sin(time * .31) + 1) * .5;
      for (let i = 0; i < 7; i += 1) {
        const center = -66 + i * 22;
        const width = 7 + (i % 3) * 3;
        const alpha = .035 + Math.max(0, 1 - Math.abs(i / 6 - sweep) * 3) * .09;
        const ray = back.createLinearGradient(0, -85, 0, 55);
        ray.addColorStop(0, rgba(i % 2 ? p[0] : p[1], alpha));
        ray.addColorStop(1, rgba(p[2], 0));
        back.fillStyle = ray;
        back.beginPath();
        back.moveTo(center - width, -88);
        back.lineTo(center + width, -88);
        back.lineTo(center * .24 + 13, 54);
        back.lineTo(center * .24 - 13, 54);
        back.closePath();
        back.fill();
      }
      back.restore();
      this.drawWing(back, -1, time, p);
      this.drawWing(back, 1, time + .3, p);

      const pulse = .72 + Math.sin(time * .78) * .18;
      front.save();
      front.translate(0, -72);
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = rgba(p[0], pulse);
      front.fillStyle = rgba(p[2], .1 + pulse * .18);
      front.lineWidth = 1.2;
      front.shadowBlur = 14;
      front.shadowColor = p[0];
      front.beginPath();
      front.moveTo(0, -10); front.lineTo(9, 0); front.lineTo(0, 11); front.lineTo(-9, 0); front.closePath();
      front.fill(); front.stroke();
      front.beginPath();
      front.moveTo(-18, -1); front.lineTo(-7, -5); front.moveTo(18, -1); front.lineTo(7, -5);
      front.moveTo(-14, 8); front.lineTo(-5, 4); front.moveTo(14, 8); front.lineTo(5, 4);
      front.stroke();
      front.restore();
    }

    iceShard(ctx, x, y, size, rotation, p, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const width = size * .28;
      const gradient = ctx.createLinearGradient(0, -size, 0, size * .3);
      gradient.addColorStop(0, rgba(p[2], opacity * .9));
      gradient.addColorStop(.42, rgba(p[0], opacity * .44));
      gradient.addColorStop(1, rgba(p[1], opacity * .12));
      ctx.fillStyle = gradient;
      ctx.strokeStyle = rgba(p[2], opacity * .62);
      ctx.lineWidth = .75;
      ctx.shadowBlur = 9;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(width, size * .12);
      ctx.lineTo(width * .26, size * .42);
      ctx.lineTo(-width * .72, size * .17);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', opacity * .33);
      ctx.beginPath();
      ctx.moveTo(0, -size); ctx.lineTo(-width * .08, size * .1); ctx.lineTo(width * .26, size * .42);
      ctx.moveTo(-width * .08, size * .1); ctx.lineTo(width, size * .12);
      ctx.stroke();
      ctx.restore();
    }

    drawFrost(time, p) {
      const back = this.back;
      const front = this.front;
      const mistA = this.cubicPoints({x:-84,y:37},{x:-48,y:14},{x:-20,y:-73},{x:18,y:-81},42);
      const mistB = this.cubicPoints({x:85,y:45},{x:48,y:17},{x:34,y:-69},{x:-5,y:-83},42);
      const mistGradientA = back.createLinearGradient(-84, 40, 18, -82);
      mistGradientA.addColorStop(0, rgba(p[1], 0));
      mistGradientA.addColorStop(.52, rgba(p[0], .15));
      mistGradientA.addColorStop(1, rgba(p[2], 0));
      const mistGradientB = back.createLinearGradient(85, 45, -5, -83);
      mistGradientB.addColorStop(0, rgba(p[1], 0));
      mistGradientB.addColorStop(.48, rgba(p[2], .13));
      mistGradientB.addColorStop(1, rgba(p[0], 0));
      this.ribbon(back, mistA, t => 2 + Math.sin(Math.PI * t) * 7, mistGradientA, .9);
      this.ribbon(back, mistB, t => 2 + Math.sin(Math.PI * t) * 6, mistGradientB, .86);

      const shards = [
        [-64,-30,25,-.72],[-72,14,18,-1.16],[-48,55,16,-2.25],
        [61,-38,22,.72],[73,6,27,1.22],[51,55,17,2.22],[4,-74,20,.05],
      ];
      shards.forEach((values, index) => {
        const shimmer = .68 + Math.pow(Math.max(0, Math.sin(time * .8 + index * .83)), 6) * .3;
        this.iceShard(front, values[0], values[1], values[2], values[3] + Math.sin(time * .26 + index) * .035, p, shimmer);
      });

      front.save();
      front.strokeStyle = rgba(p[2], .56);
      front.lineWidth = .85;
      front.shadowBlur = 6;
      front.shadowColor = p[0];
      const frostRoots = [[-54,54,-20,70],[54,54,20,70]];
      frostRoots.forEach((root, rootIndex) => {
        front.beginPath();
        front.moveTo(root[0], root[1]);
        front.quadraticCurveTo(rootIndex ? 41 : -41, 69, root[2], root[3]);
        front.stroke();
        for (let i = 0; i < 4; i += 1) {
          const x = root[0] + (root[2] - root[0]) * (i + 1) / 5;
          const y = root[1] + (root[3] - root[1]) * (i + 1) / 5;
          const side = rootIndex ? 1 : -1;
          front.beginPath();
          front.moveTo(x, y); front.lineTo(x + side * (5 + i), y - 7 - i);
          front.moveTo(x, y); front.lineTo(x - side * (4 + i), y - 5);
          front.stroke();
        }
      });
      front.restore();
    }

    flower(ctx, x, y, size, rotation, p, openness) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i += 1) {
        const angle = i * Math.PI * 2 / 5;
        ctx.save();
        ctx.rotate(angle);
        const gradient = ctx.createLinearGradient(0, 0, 0, -size * openness);
        gradient.addColorStop(0, rgba(p[1], .8));
        gradient.addColorStop(1, rgba(p[2], .26));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-size * .48, -size * .25, -size * .38, -size * openness, 0, -size * openness);
        ctx.bezierCurveTo(size * .38, -size * openness, size * .48, -size * .25, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      this.dot(ctx, 0, 0, size * .18, rgba(p[2], .9), 5);
      ctx.restore();
    }

    drawBloom(time, p) {
      const back = this.back;
      const front = this.front;
      const leftVine = this.cubicPoints({x:-22,y:74},{x:-86,y:48},{x:-81,y:-24},{x:-23,y:-76},56);
      const rightVine = this.cubicPoints({x:21,y:75},{x:76,y:55},{x:85,y:4},{x:56,y:-52},50);
      back.save();
      back.strokeStyle = rgba('#416744', .9);
      back.lineWidth = 3.2;
      back.shadowBlur = 8;
      back.shadowColor = p[0];
      [leftVine, rightVine].forEach(vine => {
        back.beginPath();
        vine.forEach((point, index) => { if (!index) back.moveTo(point.x, point.y); else back.lineTo(point.x, point.y); });
        back.stroke();
      });
      back.strokeStyle = rgba(p[0], .52);
      back.lineWidth = .9;
      back.lineDashOffset = -time * 12;
      back.setLineDash([8, 16]);
      [leftVine, rightVine].forEach(vine => {
        back.beginPath();
        vine.forEach((point, index) => { if (!index) back.moveTo(point.x, point.y); else back.lineTo(point.x, point.y); });
        back.stroke();
      });
      back.restore();

      const leafAnchors = [
        [leftVine, .18,-1],[leftVine,.34,1],[leftVine,.52,-1],[leftVine,.69,1],[leftVine,.84,-1],
        [rightVine,.24,1],[rightVine,.46,-1],[rightVine,.68,1],[rightVine,.84,-1],
      ];
      leafAnchors.forEach((entry, index) => {
        const vine = entry[0];
        const point = vine[Math.floor(entry[1] * (vine.length - 1))];
        const sway = Math.sin(time * .7 + index) * .08;
        this.drawLeaf(front, point.x + entry[2] * 4, point.y, .38 + index % 3 * .045, entry[2] * 1.1 + sway, index % 2 ? p[0] : '#5f9a62', false, .85);
      });
      const blooms = [[-64,16,8.5],[54,31,7.5],[-43,-55,7],[57,-39,6.5]];
      blooms.forEach((values, index) => {
        const openness = .72 + Math.pow((Math.sin(time * .55 + index * 1.3) + 1) * .5, 2) * .28;
        this.flower(front, values[0], values[1], values[2], time * .05 + index, p, openness);
      });
    }

    drawBlood(time, p) {
      const back = this.back;
      const front = this.front;
      const left = this.cubicPoints(
        {x:-16,y:76},{x:-85,y:54},{x:-87,y:-26},{x:-28,y:-79 + Math.sin(time*.5)*3},52
      );
      const right = this.cubicPoints(
        {x:22,y:-77},{x:84,y:-43},{x:88,y:27},{x:14,y:77 + Math.sin(time*.47+1)*3},52
      );
      const leftGradient = back.createLinearGradient(-18,76,-29,-79);
      leftGradient.addColorStop(0, rgba(p[1], .05));
      leftGradient.addColorStop(.42, rgba(p[0], .58));
      leftGradient.addColorStop(1, rgba(p[2], .03));
      const rightGradient = back.createLinearGradient(22,-77,14,77);
      rightGradient.addColorStop(0, rgba(p[1], .06));
      rightGradient.addColorStop(.55, rgba(p[0], .52));
      rightGradient.addColorStop(1, rgba(p[2], .04));
      this.ribbon(back, left, t => 1 + Math.sin(Math.PI*t) * (6 + Math.sin(time*.6)*1.2), leftGradient, .92);
      this.ribbon(back, right, t => 1 + Math.sin(Math.PI*t) * (5.2 + Math.sin(time*.6+1)*1.1), rightGradient, .88);

      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = rgba(p[2], .28 + Math.sin(time*.8)*.08);
      front.lineWidth = 1.05;
      front.shadowBlur = 7;
      front.shadowColor = p[0];
      front.beginPath();
      front.moveTo(-22,67); front.bezierCurveTo(-6,53,-5,42,0,35);
      front.bezierCurveTo(7,45,9,57,24,68);
      front.moveTo(-16,61); front.lineTo(0,71); front.lineTo(16,61);
      front.stroke();
      front.restore();

      for (let i = 0; i < 3; i += 1) {
        const life = (time * .055 + i * .34) % 1;
        const x = -18 + i * 18 + Math.sin(time + i) * 2;
        const y = 67 + life * 20;
        front.save();
        front.globalAlpha = (1 - life) * .72;
        front.fillStyle = p[0];
        front.beginPath();
        front.moveTo(x, y - 5); front.bezierCurveTo(x + 4, y, x + 3, y + 5, x, y + 6);
        front.bezierCurveTo(x - 3, y + 5, x - 4, y, x, y - 5); front.fill();
        front.restore();
      }
    }

    holoPanel(ctx, x, y, width, height, skew, colorA, colorB, opacity) {
      const gradient = ctx.createLinearGradient(x - width/2, y, x + width/2, y);
      gradient.addColorStop(0, rgba(colorA, .02));
      gradient.addColorStop(.48, rgba(colorA, opacity));
      gradient.addColorStop(1, rgba(colorB, opacity * .15));
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.strokeStyle = rgba(colorA, opacity * 1.6);
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(x - width/2 + skew, y - height/2);
      ctx.lineTo(x + width/2 + skew, y - height/2);
      ctx.lineTo(x + width/2 - skew, y + height/2);
      ctx.lineTo(x - width/2 - skew, y + height/2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(colorB, opacity * .72);
      ctx.beginPath();
      ctx.moveTo(x - width*.28 + skew*.5, y - height*.19);
      ctx.lineTo(x + width*.24 + skew*.2, y - height*.19);
      ctx.moveTo(x - width*.34, y + height*.05);
      ctx.lineTo(x + width*.12, y + height*.05);
      ctx.stroke();
      ctx.restore();
    }

    drawNeural(time, p) {
      const back = this.back;
      const front = this.front;
      const shift = Math.sin(time * .55) * 3;
      const panels = [
        [-67,-34,35,24,-7],[-75,1,31,19,6],[-66,36,38,25,-5],
        [67,-39,34,21,6],[76,-4,28,18,-5],[66,34,39,24,7],
      ];
      panels.forEach((values, index) => {
        const ctx = index % 3 === 1 ? front : back;
        const depth = .16 + (index % 3) * .055;
        this.holoPanel(ctx, values[0] + (index < 3 ? -shift : shift), values[1], values[2], values[3], values[4], p[index % 2], p[(index + 1) % 2], depth);
      });

      const scan = -76 + ((time * .18) % 1) * 152;
      const scanGradient = front.createLinearGradient(0, scan - 8, 0, scan + 8);
      scanGradient.addColorStop(0, rgba(p[0], 0));
      scanGradient.addColorStop(.5, rgba(p[2], .26));
      scanGradient.addColorStop(1, rgba(p[0], 0));
      front.save();
      front.globalCompositeOperation = 'lighter';
      front.fillStyle = scanGradient;
      front.fillRect(-78, scan - 8, 156, 16);
      front.strokeStyle = rgba(p[0], .46);
      front.lineWidth = .75;
      front.beginPath(); front.moveTo(-75, scan); front.lineTo(75, scan); front.stroke();
      front.restore();

      front.save();
      front.strokeStyle = rgba(p[0], .56);
      front.lineWidth = 1.2;
      front.shadowBlur = 7;
      front.shadowColor = p[0];
      const brackets = [[-58,-58,-1],[-58,58,-1],[58,-58,1],[58,58,1]];
      brackets.forEach(values => {
        const x=values[0],y=values[1],side=values[2];
        front.beginPath(); front.moveTo(x,y-side*12); front.lineTo(x,y); front.lineTo(x+side*12,y); front.stroke();
      });
      front.restore();
    }

    drawInk(time, p) {
      const back = this.back;
      const front = this.front;
      const paths = [
        this.cubicPoints({x:-25,y:83},{x:-88,y:59},{x:-78,y:-20},{x:-37,y:-79},52),
        this.cubicPoints({x:28,y:82},{x:91,y:47},{x:71,y:-30},{x:35,y:-82},52),
        this.cubicPoints({x:-65,y:48},{x:-16,y:83},{x:48,y:78},{x:76,y:33},48),
      ];
      paths.forEach((path, index) => {
        const start = path[0], end = path[path.length-1];
        const gradient = back.createLinearGradient(start.x,start.y,end.x,end.y);
        gradient.addColorStop(0, rgba('#08070e', .94));
        gradient.addColorStop(.52, rgba(p[1], .88));
        gradient.addColorStop(.82, rgba(p[0], .34));
        gradient.addColorStop(1, rgba(p[2], 0));
        this.ribbon(back, path, t => .8 + Math.sin(Math.PI*t) * (7.5 - index), gradient, .96);
        back.save();
        back.strokeStyle = rgba(p[0], .14 + index*.045);
        back.lineWidth = .7;
        back.beginPath();
        path.forEach((point, pointIndex) => { if (!pointIndex) back.moveTo(point.x,point.y); else back.lineTo(point.x,point.y); });
        back.stroke();
        back.restore();
      });

      const tendrils = [
        this.cubicPoints({x:-58,y:42},{x:-84,y:12},{x:-64,y:-52},{x:-17,y:-72+Math.sin(time*.55)*4},34),
        this.cubicPoints({x:60,y:45},{x:88,y:8},{x:62,y:-51},{x:18,y:-74+Math.sin(time*.52+1)*4},34),
      ];
      tendrils.forEach((path,index) => {
        const gradient=front.createLinearGradient(path[0].x,path[0].y,path[path.length-1].x,path[path.length-1].y);
        gradient.addColorStop(0,rgba(p[1],.82));
        gradient.addColorStop(.68,rgba(p[0],.54));
        gradient.addColorStop(1,rgba(p[2],0));
        this.ribbon(front,path,t=>.5+Math.sin(Math.PI*t)*(3.2-index*.5),gradient,.82);
      });

      for (let i=0;i<2;i+=1) {
        const life=(time*.045+i*.5)%1;
        const x=(i?1:-1)*(36+Math.sin(time*.4+i)*6);
        const y=58+life*28;
        front.save();
        front.globalAlpha=(1-life)*.6;
        front.fillStyle=p[0];
        front.beginPath();
        front.moveTo(x,y-6);front.bezierCurveTo(x+4,y,x+3,y+6,x,y+7);front.bezierCurveTo(x-3,y+6,x-4,y,x,y-6);front.fill();
        front.restore();
      }
    }
  }
})();
