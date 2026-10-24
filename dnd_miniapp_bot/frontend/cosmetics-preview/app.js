(() => {
  'use strict';

  const AVATARS = {
    fantasy: { src: './assets/avatar-fantasy.webp?v=4', fallback: 'Ф' },
    mystic: { src: './assets/avatar-mystic.webp?v=4', fallback: 'М' },
    cyber: { src: './assets/avatar-cyber.webp?v=4', fallback: 'К' },
  };

  const CATEGORY_LABELS = {
    all: 'Все',
    smoke: 'Дым и туман',
    fire: 'Огонь',
    energy: 'Энергия и электричество',
    cosmos: 'Космос и астрал',
    magic: 'Чары и мистика',
    light: 'Свет и сияние',
    nature: 'Природа',
    scifi: 'Sci-Fi и голограммы',
  };

  const restoredEffects = [
    ['bard-refrain','Рефрен барда','magic','bard',['#d7b66e','#665582','#fff0ba'],'Ноты движутся по музыкальному полукругу у нижнего края портрета.'],
    ['forest-lights','Огни старого леса','nature','forest-lights',['#c3e690','#497e69','#f4ffd1'],'Светлячки мягко мигают и независимо летают рядом с портретом.'],
    ['willow-whisper','Дождь сакуры','nature','willow-whisper',['#eaa4be','#a76591','#ffe4ee'],'Лепестки сакуры падают перед портретом и за ним.'],
  ];
  restoredEffects.push(
    ['wildfire','Мантия живого огня','fire','wildfire',['#ff9b38','#df431c','#fff4a3'],'Плотная стенка пламени охватывает нижний край портрета полукругом.','#fffbd9'],
    ['fire-ring','Огненный венец','fire','fire-ring',['#ff9b38','#df431c','#fff4a3'],'Живое пламя окружает портрет близко к его контуру.','#fffbd9'],
  );
  const legacyEffects = restoredEffects.map(([id,name,category,kind,palette,short,core],i)=>({
    id,name,category,kind,palette,short,core,isNew:false,
    code:`FX${String(i+1).padStart(2,'0')}`,description:short,
    layout:kind==='wildfire'?'нижний огненный полукруг':kind==='fire-ring'?'пламя по периметру':kind==='bard'?'нотный полукруг':kind==='forest-lights'?'светлячки рядом с портретом':'падающие лепестки',
    loop:'непрерывная композиция',tags:[name],
  }));
  const EFFECTS = [...legacyEffects, ...(window.FXSmoke?.effects || []), ...(window.FXArcane?.effects || [])];

  const state = {
    category: 'all',
    query: '',
    avatar: 'fantasy',
    size: 64,
    backdrop: 'ink',
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    dialogEffect: null,
  };
  const smokeSettings = window.FXSmoke.createPreferences();
  const effectColors = window.FXArcane.createPreferences(undefined,EFFECTS);
  const hasColorControls = effect => ['arcane','wildfire','fire-ring'].includes(effect?.kind);
  const requestedCategory = new URLSearchParams(window.location.search).get('category');
  if (requestedCategory && CATEGORY_LABELS[requestedCategory]) state.category = requestedCategory;

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
    dialogPrevious: document.getElementById('dialog-previous'),
    dialogNext: document.getElementById('dialog-next'),
    dialogPosition: document.getElementById('dialog-position'),
    smokeControls: document.getElementById('smoke-controls'),
    smokeDensity: document.getElementById('smoke-density'),
    smokeSpeed: document.getElementById('smoke-speed'),
    densityValue: document.getElementById('density-value'),
    speedValue: document.getElementById('speed-value'),
    smokePalettes: document.getElementById('smoke-palettes'),
    smokeColors: [...document.querySelectorAll('#smoke-colors input')],
    colorControls: document.getElementById('effect-color-controls'),
    colorMode: document.getElementById('effect-color-mode'),
    colorInputs: [...document.querySelectorAll('#effect-colors input')],
    colorPalettes: document.getElementById('effect-palettes'),
    colorAngleControl: document.getElementById('effect-angle-control'),
    colorAngle: document.getElementById('effect-gradient-angle'),
    colorAngleValue: document.getElementById('effect-angle-value'),
    colorReset: document.getElementById('effect-color-reset'),
    starControl: document.getElementById('star-color-control'),
    starEnabled: document.getElementById('star-color-enabled'),
    starColor: document.getElementById('star-color'),
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
      button.setAttribute('aria-pressed', String(state.category === category));
      button.textContent = `${categoryName(category)} · ${count}`;
      button.addEventListener('click', () => {
        state.category = category;
        const url = new URL(window.location.href);
        url.searchParams.set('category', category);
        window.history.replaceState(null, '', url);
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
    card.dataset.effectId = effect.id;
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
    refs.smokeControls.hidden = effect.kind !== 'smoke';
    if (effect.kind === 'smoke') renderSmokeControls(effect);
    refs.colorControls.hidden = !hasColorControls(effect);
    if (hasColorControls(effect)) renderColorControls(effect);
    refs.dialogDescription.textContent = effect.description;
    refs.dialogLayout.textContent = effect.layout;
    refs.dialogLoop.textContent = effect.loop;
    refs.dialogTags.replaceChildren(...effect.tags.map(text => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = text;
      return tag;
    }));
    const items = filteredEffects();
    refs.dialogPosition.textContent = `${items.indexOf(effect) + 1} / ${items.length}`;
    refs.dialogPrevious.disabled = refs.dialogNext.disabled = items.length < 2;
    if (!refs.dialog.open) refs.dialog.showModal();
    requestAnimationFrame(() => engine.refresh());
  }

  function moveDialog(direction) {
    const items = filteredEffects();
    const current = items.indexOf(state.dialogEffect);
    if (items.length) openDialog(items[(current + direction + items.length) % items.length]);
  }

  function renderColorControls(effect) {
    const settings=effectColors.get(effect.id);
    refs.colorMode.value=settings.mode;
    refs.colorInputs.forEach((input,i)=>{
      input.value=settings.colors[i];
      input.disabled=settings.mode==='original' || (settings.mode==='solid' && i>0);
    });
    refs.colorAngleControl.hidden=settings.mode!=='gradient';
    refs.colorAngle.value=settings.angle;
    refs.colorAngleValue.value=`${settings.angle}°`;
    refs.starControl.hidden=effect.mode!=='summoning';
    refs.starEnabled.checked=Boolean(settings.starColor);
    refs.starColor.hidden=!settings.starColor;
    refs.starColor.value=settings.starColor || settings.colors[0];
    refs.colorPalettes.replaceChildren(...window.FXArcane.presets.map(preset=>{
      const button=document.createElement('button');
      button.type='button';button.className='palette-swatch';button.title=preset.name;
      button.setAttribute('aria-label',preset.name);
      button.setAttribute('aria-pressed',String(settings.mode==='gradient' && preset.colors.every((c,i)=>c===settings.colors[i])));
      button.style.background=`linear-gradient(135deg, ${preset.colors.join(',')})`;
      button.addEventListener('click',()=>{
        effectColors.set(effect.id,{mode:'gradient',colors:preset.colors});
        renderColorControls(effect);engine.refresh();
      });
      return button;
    }));
  }

  function renderSmokeControls(effect) {
    const settings = smokeSettings.get(effect.id);
    refs.smokeDensity.value = Math.round(settings.density * 100);
    refs.densityValue.value = `${refs.smokeDensity.value}%`;
    refs.smokeSpeed.value = Math.round(settings.speed * 100);
    refs.speedValue.value = `${refs.smokeSpeed.value}%`;
    const stops = window.FXSmoke.colorsFor(effect, settings).slice(1, 4);
    refs.smokeColors.forEach((input, i) => {
      input.value = `#${stops[i].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
    });
    renderSmokePalettes(effect);
  }

  function renderSmokePalettes(effect) {
    const settings = smokeSettings.get(effect.id);
    const choices = [{ id: '', name: 'Исходная палитра', colors: effect.colors }, ...window.FXSmoke.palettes];
    refs.smokePalettes.replaceChildren(...choices.map(palette => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-swatch';
      button.title = palette.name;
      button.setAttribute('aria-label', palette.name);
      button.setAttribute('aria-pressed', String(settings.palette === palette.id));
      button.style.background = `linear-gradient(135deg, ${palette.colors.slice(1, 4).map(rgb => `rgb(${rgb.join(',')})`).join(',')})`;
      if (!palette.id) button.classList.add('palette-original');
      button.addEventListener('click', () => {
        smokeSettings.set(effect.id, { palette: palette.id, customColors: null });
        renderSmokeControls(effect);
        engine.refresh();
      });
      return button;
    }));
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
  refs.dialogPrevious.addEventListener('click', () => moveDialog(-1));
  refs.dialogNext.addEventListener('click', () => moveDialog(1));
  refs.colorMode.addEventListener('change',()=>{
    if(!hasColorControls(state.dialogEffect))return;
    effectColors.set(state.dialogEffect.id,{mode:refs.colorMode.value});
    renderColorControls(state.dialogEffect);engine.refresh();
  });
  refs.colorInputs.forEach(input=>input.addEventListener('input',()=>{
    if(!hasColorControls(state.dialogEffect))return;
    effectColors.set(state.dialogEffect.id,{colors:refs.colorInputs.map(field=>field.value)});
    refs.colorPalettes.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed','false'));
    engine.refresh();
  }));
  refs.colorAngle.addEventListener('input',()=>{
    if(!hasColorControls(state.dialogEffect))return;
    const angle=Number(refs.colorAngle.value);
    effectColors.set(state.dialogEffect.id,{angle});refs.colorAngleValue.value=`${angle}°`;engine.refresh();
  });
  refs.starEnabled.addEventListener('change',()=>{
    if(state.dialogEffect?.mode!=='summoning')return;
    effectColors.set(state.dialogEffect.id,{starColor:refs.starEnabled.checked?refs.starColor.value:null});
    renderColorControls(state.dialogEffect);engine.refresh();
  });
  refs.starColor.addEventListener('input',()=>{
    if(state.dialogEffect?.mode!=='summoning')return;
    effectColors.set(state.dialogEffect.id,{starColor:refs.starColor.value});engine.refresh();
  });
  refs.colorReset.addEventListener('click',()=>{
    const effect=state.dialogEffect;if(!hasColorControls(effect))return;
    effectColors.set(effect.id,{mode:'original',colors:effect.palette,angle:45,starColor:null});
    renderColorControls(effect);engine.refresh();
  });
  refs.smokeDensity.addEventListener('input', () => {
    if (state.dialogEffect?.kind !== 'smoke') return;
    smokeSettings.set(state.dialogEffect.id, { density: Number(refs.smokeDensity.value) / 100 });
    refs.densityValue.value = `${refs.smokeDensity.value}%`;
    engine.refresh();
  });
  refs.smokeSpeed.addEventListener('input', () => {
    if (state.dialogEffect?.kind !== 'smoke') return;
    smokeSettings.set(state.dialogEffect.id, { speed: Number(refs.smokeSpeed.value) / 100 });
    refs.speedValue.value = `${refs.smokeSpeed.value}%`;
    engine.refresh();
  });
  refs.smokeColors.forEach(input => input.addEventListener('input', () => {
    if (state.dialogEffect?.kind !== 'smoke') return;
    smokeSettings.set(state.dialogEffect.id, { palette: 'custom', customColors: refs.smokeColors.map(field => field.value) });
    renderSmokePalettes(state.dialogEffect);
    engine.refresh();
  }));
  refs.dialog.addEventListener('keydown', event => {
    if (event.target.matches('input, select')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveDialog(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
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
    let frozenTime = 3.7;
    let previousFrame = 0;
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
      renderer.localTime = effect.previewTime ?? frozenTime;
      renderer.draw(renderer.localTime);
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
      const dt = previousFrame ? Math.min((nowMs - previousFrame) / 1000, .05) : 1 / 60;
      previousFrame = nowMs;
      let keepRunning = false;
      for (const [host, renderer] of renderers) {
        if (!isAnimated(host)) continue;
        if (visible.get(host) !== false) {
          renderer.localTime += dt;
          renderer.draw(renderer.localTime);
          keepRunning = true;
        }
      }
      if (keepRunning) frameId = requestAnimationFrame(tick);
      else previousFrame = 0;
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
        previousFrame = 0;
      } else {
        start();
      }
    }

    function refresh() {
      prune();
      for (const renderer of renderers.values()) renderer.draw(renderer.localTime);
      start();
    }

    return { register, prune, refresh, setActive, setPaused };
  }

  class EffectRenderer extends window.FXPreviewRenderer {
    draw(time) {
      this.colorOptions=effectColors.get(this.effect.id);
      this.smokeOptions=smokeSettings.get(this.effect.id);
      this.avatar=state.avatar;
      super.draw(time);
    }
  }
})();
