const tg = window.Telegram?.WebApp;
const FORCE_WINDOW_MODE = localStorage.getItem('force_window_mode') === '1';
if (tg) {
  tg.ready();
  if (FORCE_WINDOW_MODE) {
    try { if (tg.exitFullscreen && tg.isFullscreen) tg.exitFullscreen(); } catch (_) {}
  } else {
    tg.expand();
    try { if (tg.requestFullscreen && !tg.isFullscreen) tg.requestFullscreen(); } catch (_) {}
  }
  try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (_) {}
  try { tg.setHeaderColor && tg.setHeaderColor('#0d1117'); } catch (_) {}
  try { tg.setBackgroundColor && tg.setBackgroundColor('#0d1117'); } catch (_) {}
  setTimeout(() => {
    try {
      if (FORCE_WINDOW_MODE) { if (tg.exitFullscreen && tg.isFullscreen) tg.exitFullscreen(); }
      else { tg.expand(); if (tg.requestFullscreen && !tg.isFullscreen) tg.requestFullscreen(); }
    } catch (_) {}
  }, 250);
}


const UI_STATE_VERSION = '49';
// Карты временно отключены: вкладка скрыта, API состояния не запрашивает карты.
const MAPS_FEATURE_ENABLED = false;
if (localStorage.getItem('ui_state_version') !== UI_STATE_VERSION) {
  localStorage.removeItem('open_sections');
  localStorage.setItem('ui_state_version', UI_STATE_VERSION);
}

const state = {
  me: null,
  currentCampaignId: Number(localStorage.getItem('campaign_id') || 0),
  campaignState: null,
  tab: 'characters',
  lastGeneratorText: '',
  lastGeneratorPayload: null,
  lastGeneratorKind: '',
  lastEventId: 0,
  autoRefreshTimer: null,
  expandedCharacters: new Set(),
  combatListOpen: false,
  homeOpen: '',
  initiativeCarouselScroll: 0,
  bottomNavScroll: Number(localStorage.getItem('bottom_nav_scroll') || 0),
  openSections: new Set(JSON.parse(localStorage.getItem('open_sections') || '[]')),
  profileCache: {},
  firingAnimation: false,
  firingItemId: 0,
  pendingInventoryRequest: false,
};
const CUSTOMIZATION_COLLAPSED_BY_DEFAULT_KEYS = new Set([
  'player-custom-frames', 'player-custom-effects',
  'shop-frames', 'shop-effects', 'shop-history'
]);
CUSTOMIZATION_COLLAPSED_BY_DEFAULT_KEYS.forEach(key => state.openSections.delete(key));
localStorage.setItem('open_sections', JSON.stringify([...state.openSections]));

const CHARACTER_COLORS = [
  '#72a7ff', '#54d38a', '#ffd166', '#ff8a65', '#ff6b9a', '#b388ff',
  '#4dd0e1', '#a3e635', '#f472b6', '#f59e0b', '#ef4444', '#94a3b8',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb7185', '#f97316',
  '#eab308', '#84cc16', '#10b981', '#0ea5e9', '#64748b', '#ffffff',
  '#111827', '#7f1d1d', '#14532d', '#1e3a8a', '#581c87', '#78350f'
];

const UNIQUE_FRAMES = [
  {id:'aurora', label:'Аврора', emoji:'🌌'},
  {id:'ruby', label:'Рубин', emoji:'♦️'},
  {id:'emerald', label:'Изумруд', emoji:'💚'},
  {id:'sapphire', label:'Сапфир', emoji:'🔷'},
  {id:'gold', label:'Золото', emoji:'✨'},
  {id:'violet', label:'Фиолет', emoji:'💜'},
  {id:'frost', label:'Иней', emoji:'❄️'},
];

function cosmetics() { return state.campaignState?.cosmetics || []; }
function cosmeticEffects() { return state.campaignState?.cosmetic_effects || []; }
function cosmeticById(id) { return cosmetics().find(c => String(c.id) === String(id)); }
function cosmeticImgPath(c) { return c?.thumb_path || c?.asset_path || ''; }
function cosmeticFullImgPath(c) { return c?.asset_path || c?.thumb_path || ''; }
function cosmeticAssetPath(id) { const c = cosmeticById(id); return cosmeticImgPath(c); }
function isImageIcon(value) { const v = String(value || ''); return v.startsWith('/uploads/') || v.startsWith('data:image/') || /^https?:\/\//.test(v); }
function achIconHtml(icon, cls='', thumb='') { const src = thumb || icon; return isImageIcon(src) ? `<img loading="lazy" class="ach-img ${esc(cls)}" src="${esc(src)}" alt="">` : `<span>${esc(icon || '🏆')}</span>`; }
function achIconFullPath(a) { return isImageIcon(a?.icon || a?.icon_thumb || '') ? (a?.icon || a?.icon_thumb || '') : ''; }
function effectById(id) { return cosmeticEffects().find(c => String(c.id) === String(id)); }
function cosmeticTags() { return state.campaignState?.cosmetic_tags || []; }
function tagById(id) { return cosmeticTags().find(c => String(c.id) === String(id)); }
function unlockedTagSet() { return new Set(state.campaignState?.unlocked_tag_ids || []); }
function tagShapes() { return cosmeticTags().filter(c => ['base','tag_shape'].includes(String(c.category || '')) && c.id !== 'tag_none'); }
function tagTexts() { return cosmeticTags().filter(c => String(c.category || '') === 'tag_text'); }
function baseTags() { return tagShapes().filter(c => c.category === 'base'); }
function uniqueTags() { return tagTexts().concat(tagShapes().filter(c => c.category !== 'base')); }
function tagClassFor(id) { const t=tagById(id); return t?.css_class || (id ? String(id).replace(/^tag_shape_/, 'tag-shape-').replace(/_/g, '-') : ''); }
function defaultTagShapeId() { return 'tag_shape_classic'; }
function tagIsUnlocked(t) { return !t || String(t.id)==='tag_none' || String(t.category || '') === 'base' || unlockedTagSet().has(String(t.id)); }
function currencyBalance() { return Number(state.campaignState?.currency_balance || 0); }
function priceOf(item) { return item?.price == null ? ({common:60, rare:180, epic:500, legendary:1300, unique:null}[item?.rarity || 'common'] ?? 25) : item.price; }
function priceLabel(item) { const p = priceOf(item); return p == null || String(item?.rarity)==='unique' ? 'только за ачивку' : `✦ ${p}`; }
function cosmeticMetaLabel(item) { return `${rarityEmoji(displayRarity(item))} ${rarityRu(displayRarity(item))}`; }
function effectMetaLabel(item) { return `${rarityEmoji(item?.rarity || 'common')} ${rarityRu(item?.rarity || 'common')}`; }
function tagMetaLabel(item) { return `${rarityEmoji(item?.rarity || 'common')} ${rarityRu(item?.rarity || 'common')}`; }
function availableFirst(items, isAvailable) { return [...items].sort((a,b) => (isAvailable(b)?1:0) - (isAvailable(a)?1:0) || (Number(a.sort_order||0)-Number(b.sort_order||0)) || String(a.name||'').localeCompare(String(b.name||''), 'ru')); }
const RARITY_ORDER = {common:1, rare:2, epic:3, legendary:4, unique:5};
function sortByRarity(items) { return [...items].sort((a,b) => (RARITY_ORDER[a?.rarity || displayRarity(a) || 'common'] || 99) - (RARITY_ORDER[b?.rarity || displayRarity(b) || 'common'] || 99) || (Number(a?.sort_order||0)-Number(b?.sort_order||0)) || String(a?.name||'').localeCompare(String(b?.name||''), 'ru')); }
function unlockedCosmeticSet() { return new Set(state.campaignState?.unlocked_cosmetic_ids || []); }
function unlockedEffectSet() { return new Set(state.campaignState?.unlocked_effect_ids || []); }
function baseCosmetics() { return cosmetics().filter(c => c.category === 'base'); }
function uniqueCosmetics() { return cosmetics().filter(c => c.category === 'unique'); }
function baseEffects() { return cosmeticEffects().filter(c => c.category === 'base'); }
function uniqueEffects() { return cosmeticEffects().filter(c => c.category === 'unique'); }

const TAG_STYLE_OPTIONS = [
  {id:'tag-custom-gold', name:'Золото', emoji:'✨', sample:'Фарт'},
  {id:'tag-custom-cyber', name:'Кибер', emoji:'💻', sample:'NETRUN'},
  {id:'tag-custom-shadow', name:'Тень', emoji:'🌑', sample:'Тень'},
  {id:'tag-custom-blood', name:'Кровь', emoji:'🩸', sample:'Охота'},
  {id:'tag-custom-arcane', name:'Аркана', emoji:'🔮', sample:'Магия'},
  {id:'tag-custom-neon', name:'Неон', emoji:'🎤', sample:'Сцена'},
  {id:'tag-custom-emerald', name:'Изумруд', emoji:'🍃', sample:'След'},
  {id:'tag-custom-frost', name:'Иней', emoji:'❄️', sample:'Холод'},
  {id:'tag-custom-royal', name:'Королевский', emoji:'👑', sample:'Лорд'},
  {id:'tag-custom-glitch', name:'Глитч', emoji:'▣', sample:'ERROR'},
  {id:'tag-custom-sunset', name:'Закат', emoji:'🌅', sample:'Закат'},
  {id:'tag-custom-steel', name:'Сталь', emoji:'⚙️', sample:'Сталь'},
];

const HIDDEN_EFFECT_IDS = new Set();
const MODERN_EFFECT_IDS = new Set(['silver_motes', 'soft_mist', 'dew_drift', 'shadow_dust', 'heavy_rain', 'snow_squall', 'black_rain', 'midnight_snow', 'soot_rain', 'moon_sigils', 'toxic_drizzle', 'star_chorus', 'coin_whirl', 'grave_whispers', 'storm_lash', 'oracle_glyphs', 'grave_candles', 'necrotic_ash', 'night_script', 'neon_rain', 'holo_glitch', 'quantum_pixels', 'meridian_orbit', 'thunder_throne', 'nightfall', 'oblivion_script', 'golden_glint', 'amethyst_dust', 'halo_of_dawn', 'umbra_crown', 'rune_ascent', 'brutalist_hud', 'corporate_veil', 'gear_orbit', 'silver_glint', 'gem_grotto', 'low_equator_orbit', 'red_equator_scan', 'matrix_rain', 'diamond_shimmer', 'matrix_rain_cyan', 'matrix_rain_violet', 'matrix_rain_gold', 'matrix_orbit', 'quantum_hex', 'hex_beacon', 'ring_glints', 'holo_iris', 'aether_loom', 'effect_none']);
function isModernEffectId(id) { return MODERN_EFFECT_IDS.has(String(id || '')); }
function normalizedEffectId(id) { return isModernEffectId(id) ? String(id || '') : ''; }
function visibleEffects() { return cosmeticEffects().filter(e => e.id !== 'effect_none' && isModernEffectId(e.id)); }
function frameClassFor(id) {
  const c = cosmeticById(id);
  return c?.css_class || (id ? `frame-${String(id).replace(/_/g, '-')}` : '');
}
function effectClassFor(id) {
  const c = effectById(id);
  return c?.css_class || (id ? `effect-${String(id).replace(/_/g, '-')}` : '');
}
function emptyCustomizationItem(kind) {
  return kind === 'effect'
    ? {id:'', name:'Без эффекта', description:'Отключить дополнительный эффект и оставить только выбранную рамку.', rarity:'common', category:'base', emoji:'○'}
    : {id:'', name:'Без рамки', description:'Отключить рамку и оставить только цвет персонажа.', rarity:'common', category:'base', emoji:'○'};
}

const CANVAS_EFFECT_TYPE_MAP = {
  'silver_motes':'motesSilver',
  'soft_mist':'mistSoft',
  'dew_drift':'dew',
  'shadow_dust':'shadowDust',
  'heavy_rain':'heavyRain',
  'snow_squall':'snowSquall',
  'black_rain':'blackRain',
  'midnight_snow':'midnightSnow',
  'soot_rain':'sootRain',
  'moon_sigils':'moonSigils',
  'toxic_drizzle':'toxicDrizzle',
  'star_chorus':'starChorus',
  'coin_whirl':'coinWhirl',
  'grave_whispers':'graveWhispers',
  'storm_lash':'stormLash',
  'oracle_glyphs':'oracleGlyphs',
  'grave_candles':'graveCandles',
  'necrotic_ash':'necroticAsh',
  'night_script':'nightScript',
  'neon_rain':'neonRain',
  'holo_glitch':'holoGlitch',
  'quantum_pixels':'quantumPixels',
  'meridian_orbit':'meridianOrbit',
  'thunder_throne':'thunderThrone',
  'nightfall':'nightfall',
  'oblivion_script':'oblivionScript',
  'golden_glint':'goldenGlint',
  'amethyst_dust':'amethystDust',
  'halo_of_dawn':'haloDawn',
  'umbra_crown':'umbraCrown',
  'rune_ascent':'runeAscent',
  'brutalist_hud':'brutalistHud',
  'corporate_veil':'corporateVeil',
  'gear_orbit':'gearOrbit',
  'silver_glint':'silverGlint',
  'gem_grotto':'gemGrotto',
  'low_equator_orbit':'lowEquatorOrbit',
  'red_equator_scan':'redEquatorScan',
  'matrix_rain':'matrixRain',
  'diamond_shimmer':'diamondShimmer',
  'matrix_rain_cyan':'matrixRainCyan',
  'matrix_rain_violet':'matrixRainViolet',
  'matrix_rain_gold':'matrixRainGold',
  'matrix_orbit':'matrixOrbit',
  'quantum_hex':'quantumHex',
  'hex_beacon':'hexBeacon',
  'ring_glints':'ringGlints',
  'holo_iris':'holoIris',
  'aether_loom':'aetherLoom'
};
const CANVAS_EFFECT_IDS = new Set(Object.keys(CANVAS_EFFECT_TYPE_MAP));
function canvasEffectTypeForId(id) { return CANVAS_EFFECT_TYPE_MAP[String(id || '')] || ''; }

// v64: effects keep their large visual radius, but selected effects are clipped
// by a round particle mask. This avoids square seams while keeping particles from
// flying far outside the avatar. Matrix/code effects already had this behavior.
const FALLING_EFFECT_TYPES = new Set([
  'dew', 'heavyRain', 'snowSquall', 'blackRain', 'midnightSnow', 'sootRain',
  'toxicDrizzle', 'neonRain', 'nightfall'
]);
const LARGE_ROUND_CLIP_EFFECT_TYPES = new Set([
  'stormLash', 'necroticAsh', 'thunderThrone'
]);
// v65: effects that spawn text/dust/sparks and lift them upward should also
// disappear on a round boundary instead of drifting far outside the portrait.
const RISING_ROUND_CLIP_EFFECT_TYPES = new Set([
  'motesSilver', 'mistSoft', 'shadowDust', 'moonSigils', 'starChorus',
  'graveWhispers', 'oracleGlyphs', 'nightScript', 'goldenGlint', 'amethystDust',
  'runeAscent', 'silverGlint', 'gemGrotto', 'oblivionScript'
]);
function effectRoundClipRadiusForType(type) {
  const safe = String(type || '');
  if (safe === 'stormLash') return 104;
  if (safe === 'thunderThrone') return 96;
  if (safe === 'necroticAsh') return 92;
  if (safe === 'oblivionScript') return 94;
  if (RISING_ROUND_CLIP_EFFECT_TYPES.has(safe)) return 88;
  if (FALLING_EFFECT_TYPES.has(safe)) return 84;
  return 0;
}

let paused = false;
class EffectEngine {
      constructor(canvas, type) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.type = type;
        this.particles = [];
        this.last = performance.now();
        this.spawnAcc = 0;
        this.active = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
      }

      setActive(value) {
        this.active = !!value;
        this.last = performance.now();
        if (!this.active) {
          this.particles = [];
          this.spawnAcc = 0;
          this.ctx.clearRect(0, 0, this.w, this.h);
        }
      }

      resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
        // v56: the canvas may be physically larger for safe glow padding, but the
        // drawing radius is always calculated from the real avatar diameter.
        // This keeps the effect on the avatar circle instead of stretching to the
        // square preview/card container.
        // v59: the virtual stage is larger than the effect radius.
        // Some preview effects draw rings wider than 80px; with a 160px stage they
        // were cut into visible square/flat bands. Larger stage = transparent padding.
        this.stage = 260;
        const anchorBase = Math.max(24, Number(this.canvas.dataset.effectAnchorBase || 0) || Math.min(rect.width || 0, rect.height || 0) || 80);
        // v63: the visual radius is restored to the previous larger scale.
        // Clipping is handled by a much larger transparent canvas, not by shrinking
        // the particle scene. 140 matches the v61 radius while still allowing CSS
        // to override it for special cases.
        const densityBase = Math.max(120, Number(this.canvas.dataset.effectFitBase || 140) || 140);
        const fit = anchorBase / densityBase;
        const offsetX = (((rect.width || this.stage) - this.stage * fit) / 2) * dpr;
        const offsetY = (((rect.height || this.stage) - this.stage * fit) / 2) * dpr;
        this.ctx.setTransform(dpr * fit, 0, 0, dpr * fit, offsetX, offsetY);
        this.w = this.stage;
        this.h = this.stage;
        this.cx = this.stage / 2;
        this.cy = this.stage / 2;
        this.fit = fit;
      }

      rand(a,b){ return a + Math.random()*(b-a); }
      pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
      effectClipRadius(kind='') {
        return effectRoundClipRadiusForType(this.type);
      }
      fallingClipRadius() {
        return FALLING_EFFECT_TYPES.has(String(this.type || '')) ? effectRoundClipRadiusForType(this.type) : 0;
      }
      clippedFallLife(y, vy, extra=0) {
        const clipR = this.fallingClipRadius();
        if (!clipR) return 0;
        const bottom = this.cy + clipR - Math.max(0, extra || 0);
        return Math.max(.34, Math.min(5.2, ((bottom - y) / Math.max(1, vy || 1)) * this.rand(.96, 1.05)));
      }

      spawn(dtMs) {
        const rates = {
          embers:38, motesSilver:46, mistSoft:96, fireflies:54, dew:72, snowDust:34, amberDust:42, shadowDust:42,
          heavyRain:48, snowSquall:58, blackRain:50, midnightSnow:56, sootRain:56, obsidianSplinters:30,
          arcSparks:60, thornBloom:45, moonSigils:50, toxicDrizzle:50, starChorus:76, frostOrbit:42, spiritLanterns:48, sunShards:44, coinWhirl:82, graveWhispers:42,
          stormLash:70, bloodRite:42, riftGlass:42, dragonCinders:34, oracleGlyphs:42, clockHalo:42, graveCandles:48, crystalPulse:42, shadowChains:44, necroticAsh:40, voidShards:40, shadowNeedles:30, inkComets:34, nightScript:42,
          neonRain:50, holoGlitch:96, dataSparks:44, laserSights:90, plasmaCircuit:48, quantumPixels:80, orbitalScan:22, cyberGhost:46, ionTrails:34, glitchFrame:26, phaseOrbit:32, meridianOrbit:30, equatorOrbit:30, tracerTail:24,
          ghostFireflies:28, goldenFireflies:30, goldenGlint:78, violetAether:34, amethystDust:34, retroSunset:26, vhsGlitch:42, haloDawn:24, umbraCrown:26, chronoDial:30, timeSands:30, runeAscent:34, arcaneWreath:36, tacticalLock:34, brutalistHud:78, corporateVeil:78, kanjiStream:38, gearOrbit:92, steamValves:32,
          silverGlint:82, gemGrotto:72, lowEquatorOrbit:62, redEquatorScan:30, matrixRain:26, matrixRainCyan:26, matrixRainViolet:26, matrixRainGold:26, diamondShimmer:76, prismaticRibbons:12, matrixOrbit:42, quantumHex:78, hexBeacon:76, signalWave:44, ringGlints:74, triNet:110, starConstellations:240, webRunner:26, relayMesh:28, fractureBloom:90, holoIris:118, solarIris:82, violetIris:86, sentinelRelay:42, violetRelay:46, hypnoSpiral:60, aetherLoom:34, mobiusRibbon:36, pulsarRose:34,
          eclipseCrown:34, prismMonarch:34, thunderThrone:58, hyperspaceJump:10, blackIce:40, infernoCrown:18, nightfall:54, oblivionScript:28, blackAurora:28
        };
        this.spawnAcc += dtMs;
        const rate = rates[this.type] || 45;
        while (this.spawnAcc > rate) {
          this.spawnOne();
          this.spawnAcc -= rate;
        }
      }

      posOnRing(minR=58, maxR=124) {
        const angle = Math.random() * Math.PI * 2;
        const r = this.rand(minR, maxR);
        return {
          angle,
          x: this.cx + Math.cos(angle) * r,
          y: this.cy + Math.sin(angle) * r,
          r
        };
      }

      posInAvatar(maxR=80) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * maxR;
        return {
          angle,
          x: this.cx + Math.cos(angle) * r,
          y: this.cy + Math.sin(angle) * r,
          r
        };
      }

      pushText(chars, palette, options={}) {
        const p = this.posOnRing(options.minR || 56, options.maxR || 124);
        this.particles.push({
          kind:'text',
          char:this.pick(chars),
          x:p.x,
          y:p.y,
          vx:this.rand(-14,14),
          vy:this.rand(options.vy0 ?? -48, options.vy1 ?? -14),
          life:this.rand(options.life0 || 1.2, options.life1 || 2.5),
          age:0,
          size:this.rand(options.size0 || 14, options.size1 || 26),
          color:this.pick(palette),
          shadow: options.shadow || 16,
          rot: Math.random() * Math.PI * 2,
          spin: this.rand(-1.5, 1.5)
        });
      }

      pushDot(palette, mode='rise', options={}) {
        const p = this.posOnRing(options.minR || 58, options.maxR || 124);
        this.particles.push({
          kind:'dot',
          mode,
          x0:p.x,
          x:p.x,
          y:p.y,
          amp:this.rand(options.amp0 || 10, options.amp1 || 30) * (Math.random()<.5?-1:1),
          phase:Math.random()*Math.PI*2,
          freq:this.rand(2.0,4.4),
          vx:this.rand(-12,12),
          vy:this.rand(options.vy0 ?? -64, options.vy1 ?? -16),
          life:this.rand(options.life0 || .9, options.life1 || 2.2),
          age:0,
          size:this.rand(options.size0 || 2.4, options.size1 || 5.2),
          color:this.pick(palette),
          shadow: options.shadow || 13
        });
      }

      pushEmber() {
        const p = this.posOnRing(58, 122);
        this.particles.push({
          kind:'ember',
          x0:p.x,
          x:p.x,
          y:p.y,
          amp:this.rand(12,30) * (Math.random()<.5?-1:1),
          phase:Math.random()*Math.PI*2,
          freq:this.rand(2.0,4.2),
          vy:this.rand(-66,-26),
          life:this.rand(1.1,2.0),
          age:0,
          size:this.rand(3.2,6.2),
          hot:this.pick(['#fff7ad','#fde047','#fbbf24']),
          mid:this.pick(['#fb923c','#f97316','#ea580c']),
          cold:this.pick(['#57534e','#44403c','#292524']),
          shadow:14
        });
      }

      pushRain(palette, options={}) {
        const clipR = Number(options.clipR || this.fallingClipRadius() || 0);
        const x0 = options.x0 ?? (clipR ? this.cx - clipR + 4 : 8);
        const x1 = options.x1 ?? (clipR ? this.cx + clipR - 4 : this.w - 8);
        const y0 = options.y0 ?? (clipR ? this.cy - clipR + 3 : this.cy - 112);
        const y1 = options.y1 ?? (clipR ? this.cy - clipR + 18 : this.cy - 82);
        const y = this.rand(y0, y1);
        const vy = this.rand(options.vy0 || 190, options.vy1 || 340);
        const len = this.rand(options.len0 || 8, options.len1 || 19);
        const explicitLife = options.life0 != null || options.life1 != null;
        const life = clipR ? this.clippedFallLife(y, vy, len * .15) : (explicitLife ? this.rand(options.life0 || .9, options.life1 || 1.3) : this.rand(.9, 1.3));
        this.particles.push({
          kind:'rain',
          x:this.rand(x0, x1),
          y,
          vy,
          len,
          life,
          age:0,
          color:this.pick(palette),
          alpha:this.rand(options.alpha0 ?? .45, options.alpha1 ?? .95),
          width: options.width || 1.5,
          clipR: clipR || 0
        });
      }

      pushSmoke(palette, options={}) {
        const p = this.posOnRing(52, 112);
        this.particles.push({
          kind:'smoke',
          x:p.x,
          y:p.y,
          vx:this.rand(-12,12),
          vy:this.rand(options.vy0 ?? -20, options.vy1 ?? -4),
          life:this.rand(options.life0 || 1.6, options.life1 || 3.2),
          age:0,
          size:this.rand(options.size0 || 20, options.size1 || 42),
          color:this.pick(palette)
        });
      }

      pushArc(colors, options={}) {
        const p1 = this.posOnRing(62, 126);
        const p2 = this.posOnRing(62, 126);
        this.particles.push({
          kind:'arc',
          start:p1,
          end:p2,
          ctrl:{x:this.cx + this.rand(-34,34), y:this.cy + this.rand(-34,34)},
          life:this.rand(options.life0 || .55, options.life1 || 1.1),
          age:0,
          color1:colors[0],
          color2:colors[1],
          width:this.rand(options.w0 || 1.8, options.w1 || 3.8)
        });
      }

      pushBolt(palette, branches=1) {
        for (let b=0;b<branches;b++) {
          const start = this.posOnRing(78, 128);
          let x = start.x, y = start.y;
          const pts=[{x,y}];
          const seg=4+Math.floor(Math.random()*5)+(branches>1?2:0);
          for(let i=0;i<seg;i++){
            x += this.rand(-23,23);
            y += this.rand(-23,23);
            pts.push({x,y});
          }
          this.particles.push({
            kind:'bolt',
            points:pts,
            life:this.rand(.16,.42),
            age:0,
            width:this.rand(1.4,3.4),
            core:this.pick(palette)
          });
        }
      }

      pushLeaf(palette) {
        const p = this.posOnRing(60, 126);
        this.particles.push({
          kind:'leaf',
          x:p.x,
          y:p.y,
          vx:this.rand(-14,14),
          vy:this.rand(-18,12),
          rot:Math.random()*Math.PI*2,
          spin:this.rand(-2.4,2.4),
          life:this.rand(1.5,3.0),
          age:0,
          size:this.rand(9,16),
          color:this.pick(palette)
        });
      }

      pushShard(palette) {
        const p = this.posOnRing(28, 116);
        this.particles.push({
          kind:'shard',
          x:p.x,
          y:p.y,
          vx:this.rand(-30,30),
          vy:this.rand(-30,30),
          rot:Math.random()*Math.PI*2,
          spin:this.rand(-3.4,3.4),
          life:this.rand(.9,1.8),
          age:0,
          size:this.rand(7,13),
          color:this.pick(palette)
        });
      }

      pushOrbitText(chars,palette) {
        const p = this.posOnRing(78, 120);
        this.particles.push({
          kind:'orbiterText',
          char:this.pick(chars),
          ang:p.angle,
          r:p.r,
          dang:this.rand(-1.5,1.5),
          life:this.rand(1.9,3.3),
          age:0,
          size:this.rand(14,22),
          color:this.pick(palette),
          rot:0,
          spin:this.rand(-2.5,2.5),
          shadow:14
        });
      }

      pushOrbitDot(palette) {
        const p = this.posOnRing(76, 120);
        this.particles.push({
          kind:'orbiterDot',
          ang:p.angle,
          r:p.r,
          dang:this.rand(-1.6,1.6),
          life:this.rand(1.8,3.2),
          age:0,
          size:this.rand(3.5,7),
          color:this.pick(palette),
          shadow:14
        });
      }

      pushRingPulse(palette) {
        this.particles.push({
          kind:'ringPulse',
          r0:this.rand(64,92),
          growth:this.rand(22,40),
          startAng:Math.random()*Math.PI*2,
          sweep:this.rand(.8,1.9),
          life:this.rand(.7,1.35),
          age:0,
          color:this.pick(palette)
        });
      }

      pushSnowParticle(palette, options={}) {
        const clipR = Number(options.clipR || this.fallingClipRadius() || 0);
        const x0 = options.x0 ?? (clipR ? this.cx - clipR + 5 : 8);
        const x1 = options.x1 ?? (clipR ? this.cx + clipR - 5 : this.w - 8);
        const y0 = options.y0 ?? (clipR ? this.cy - clipR + 4 : this.cy - 108);
        const y1 = options.y1 ?? (clipR ? this.cy - clipR + 22 : this.cy - 76);
        const y = this.rand(y0, y1);
        const vy = this.rand(options.vy0 ?? 34, options.vy1 ?? 86);
        const explicitLife = options.life0 != null || options.life1 != null;
        const life = clipR ? this.clippedFallLife(y, vy, 0) : (explicitLife ? this.rand(options.life0 || 1.8, options.life1 || 3.8) : this.rand(1.8, 3.8));
        this.particles.push({
          kind:'snow',
          x:this.rand(x0, x1),
          y,
          vx:this.rand(options.vx0 ?? -18, options.vx1 ?? 18),
          vy,
          life,
          age:0,
          phase:Math.random()*Math.PI*2,
          size:this.rand(options.size0 || 2.4, options.size1 || 5.0),
          color:this.pick(palette),
          clipR: clipR || 0
        });
      }

      pushFallingShard(palette, options={}) {
        const clipR = Number(options.clipR || this.fallingClipRadius() || 0);
        const y = this.rand(options.y0 ?? (clipR ? this.cy - clipR + 5 : this.cy - 110), options.y1 ?? (clipR ? this.cy - clipR + 22 : this.cy - 78));
        const vy = this.rand(options.vy0 ?? 70, options.vy1 ?? 145);
        const explicitLife = options.life0 != null || options.life1 != null;
        const life = clipR ? this.clippedFallLife(y, vy, 0) : (explicitLife ? this.rand(options.life0 || 1.2, options.life1 || 2.4) : this.rand(1.2, 2.4));
        this.particles.push({
          kind:'shard',
          x:this.rand(options.x0 ?? (clipR ? this.cx - clipR + 5 : 8), options.x1 ?? (clipR ? this.cx + clipR - 5 : this.w - 8)),
          y,
          vx:this.rand(options.vx0 ?? -18, options.vx1 ?? 18),
          vy,
          rot:Math.random()*Math.PI*2,
          spin:this.rand(-3.5,3.5),
          life,
          age:0,
          size:this.rand(options.size0 || 6, options.size1 || 12),
          color:this.pick(palette),
          shadow: options.shadow || 12,
          clipR: clipR || 0
        });
      }

      pushComet(palette, options={}) {
        const x = this.rand(-22,this.w * .64);
        const y = this.rand(16,this.h * .50);
        this.particles.push({
          kind:'comet',
          x,
          y,
          px:x,
          py:y,
          vx:this.rand(options.vx0 ?? 72, options.vx1 ?? 128),
          vy:this.rand(options.vy0 ?? 42, options.vy1 ?? 96),
          life:this.rand(options.life0 || .95, options.life1 || 1.65),
          age:0,
          size:this.rand(options.size0 || 4.5, options.size1 || 8.5),
          color:this.pick(palette),
          trail:this.pick(options.trail || ['rgba(15,23,42,.48)','rgba(88,28,135,.34)'])
        });
      }

      pushNeonRain(options={}) {
        const clipR = Number(options.clipR || this.fallingClipRadius() || 0);
        const x0 = options.x0 ?? (clipR ? this.cx - clipR + 4 : this.cx - 76);
        const x1 = options.x1 ?? (clipR ? this.cx + clipR - 4 : this.cx + 76);
        const y0 = options.y0 ?? (clipR ? this.cy - clipR + 3 : this.cy - 112);
        const y1 = options.y1 ?? (clipR ? this.cy - clipR + 18 : this.cy - 82);
        const y = this.rand(y0, y1);
        const vy = this.rand(options.vy0 || 190, options.vy1 || 330);
        const len = this.rand(options.len0 || 7, options.len1 || 16);
        const explicitLife = options.life0 != null || options.life1 != null;
        const life = clipR ? this.clippedFallLife(y, vy, len * .15) : (explicitLife ? this.rand(options.life0 || .75, options.life1 || 1.18) : this.rand(.75, 1.18));
        this.particles.push({
          kind:'rain',
          x:this.rand(x0, x1),
          y,
          vy,
          len,
          life,
          age:0,
          color:this.pick(['rgba(34,211,238,.9)','rgba(244,114,182,.88)','rgba(59,130,246,.82)']),
          alpha:this.rand(options.alpha0 ?? .45, options.alpha1 ?? .82),
          width:this.rand(options.w0 || 1.1, options.w1 || 1.8),
          clipR: clipR || 0
        });
      }

      pushGlitchRect(palette, options={}) {
        this.particles.push({
          kind:'glitchRect',
          x:this.rand(options.x0 ?? this.cx-92, options.x1 ?? this.cx+92),
          y:this.rand(options.y0 ?? this.cy-92, options.y1 ?? this.cy+92),
          w:this.rand(options.w0 || 18, options.w1 || 58),
          h:this.rand(options.h0 || 2, options.h1 || 8),
          vx:this.rand(options.vx0 ?? -18, options.vx1 ?? 18),
          vy:this.rand(options.vy0 ?? -8, options.vy1 ?? 8),
          life:this.rand(options.life0 || .16, options.life1 || .42),
          age:0,
          color:this.pick(palette),
          clipAvatar: !!options.clipAvatar
        });
      }

      pushLaserLine(palette) {
        const horizontal = Math.random() < .5;
        const pos = horizontal ? this.rand(this.cy-90, this.cy+90) : this.rand(this.cx-90, this.cx+90);
        this.particles.push({
          kind:'laserLine',
          horizontal,
          pos,
          offset:this.rand(-18,18),
          life:this.rand(.18,.38),
          age:0,
          width:this.rand(1.4,2.8),
          color:this.pick(palette)
        });
      }

      pushHyperspaceStreak(palette, options={}) {
        const angle = Math.random() * Math.PI * 2;
        const startR = this.rand(options.startR0 ?? 2, options.startR1 ?? 16);
        const speed = this.rand(options.speed0 ?? 260, options.speed1 ?? 520);
        this.particles.push({
          kind:'streak',
          angle,
          r:startR,
          speed,
          life:this.rand(options.life0 ?? .42, options.life1 ?? .82),
          age:0,
          len:this.rand(options.len0 ?? 64, options.len1 ?? 132),
          width:this.rand(options.width0 ?? 1.8, options.width1 ?? 4.2),
          color:this.pick(palette)
        });
      }

      pushFrameGlitch(palette) {
        const side = Math.floor(Math.random() * 4);
        let x = this.cx, y = this.cy, w = this.rand(20, 60), h = this.rand(2, 7);
        if (side === 0) { x = this.cx + this.rand(-92, 92); y = this.cy - this.rand(84, 100); }
        else if (side === 1) { x = this.cx + this.rand(-92, 92); y = this.cy + this.rand(84, 100); }
        else if (side === 2) { x = this.cx - this.rand(84, 100); y = this.cy + this.rand(-92, 92); w = this.rand(2, 7); h = this.rand(20, 60); }
        else { x = this.cx + this.rand(84, 100); y = this.cy + this.rand(-92, 92); w = this.rand(2, 7); h = this.rand(20, 60); }
        this.particles.push({
          kind:'glitchRect',
          x, y, w, h,
          vx:this.rand(-8,8), vy:this.rand(-8,8),
          life:this.rand(.16, .42), age:0,
          color:this.pick(palette)
        });
      }

      pushPhaseOrbiter(palette) {
        const p = this.posOnRing(84, 104);
        this.particles.push({
          kind:'orbiterDot',
          ang:p.angle,
          r:p.r,
          dang:this.rand(1.25, 2.35) * (Math.random() < .5 ? -1 : 1),
          life:this.rand(2.2, 3.8),
          age:0,
          size:this.rand(4.5, 8.5),
          color:this.pick(palette),
          shadow:18,
          avatarOcclude:true,
          trailColor:this.pick(['rgba(34,211,238,.42)','rgba(196,181,253,.38)','rgba(255,255,255,.32)'])
        });
      }

      pushPerimeterStreak(palette) {
        const p = this.posOnRing(86, 102);
        this.particles.push({
          kind:'orbitStreak',
          ang:p.angle,
          r:p.r,
          dang:this.rand(3.8, 6.2) * (Math.random() < .5 ? -1 : 1),
          life:this.rand(.55, 1.05),
          age:0,
          len:this.rand(20, 42),
          width:this.rand(2.0, 4.0),
          color:this.pick(palette),
          shadow:18,
          avatarOcclude:true
        });
      }

      pushMeridianOrbiter(palette) {
        this.particles.push({
          kind:'meridianOrbiter',
          ang:Math.random() * Math.PI * 2,
          rx:this.rand(30, 42),
          ry:this.rand(88, 104),
          dang:this.rand(1.15, 2.05) * (Math.random() < .5 ? -1 : 1),
          life:this.rand(2.2, 3.8),
          age:0,
          size:this.rand(4.5, 8.0),
          color:this.pick(palette),
          shadow:18,
          trailColor:this.pick(['rgba(34,211,238,.42)','rgba(196,181,253,.38)','rgba(255,255,255,.32)','rgba(244,114,182,.28)'])
        });
      }

      pushFlameTongue() {
        const angle = this.rand(Math.PI * 0.12, Math.PI * 0.88);
        const r = this.rand(78, 104);
        const x = this.cx + Math.cos(angle) * r;
        const y = this.cy + Math.sin(angle) * r + this.rand(8, 22);
        this.particles.push({
          kind:'flame',
          x0:x,
          x,
          y,
          amp:this.rand(4, 14) * (Math.random() < .5 ? -1 : 1),
          phase:Math.random() * Math.PI * 2,
          freq:this.rand(4.5, 8.0),
          vy:this.rand(-54, -92),
          life:this.rand(.62, 1.18),
          age:0,
          size:this.rand(10, 18),
          inner:this.pick(['rgba(255,244,180,.98)','rgba(254,240,138,.96)']),
          core:this.pick(['rgba(251,146,60,.95)','rgba(249,115,22,.95)','rgba(245,158,11,.95)']),
          outer:this.pick(['rgba(239,68,68,.72)','rgba(220,38,38,.68)','rgba(251,146,60,.54)'])
        });
      }


      pushFirefly(palette, options={}) {
        const p = this.posOnRing(options.minR || 58, options.maxR || 102);
        this.particles.push({
          kind:'firefly',
          x0:p.x,
          y0:p.y,
          x:p.x,
          y:p.y,
          ampX:this.rand(options.ampX0 || 8, options.ampX1 || 22) * (Math.random()<.5?-1:1),
          ampY:this.rand(options.ampY0 || 6, options.ampY1 || 16),
          phase:Math.random()*Math.PI*2,
          phaseY:Math.random()*Math.PI*2,
          freqX:this.rand(options.freqX0 || 1.1, options.freqX1 || 2.3),
          freqY:this.rand(options.freqY0 || 1.0, options.freqY1 || 1.9),
          driftX:this.rand(options.vx0 ?? -8, options.vx1 ?? 8),
          driftY:this.rand(options.vy0 ?? -24, options.vy1 ?? -8),
          life:this.rand(options.life0 || 1.9, options.life1 || 3.6),
          age:0,
          size:this.rand(options.size0 || 2.4, options.size1 || 4.8),
          color:this.pick(palette),
          shadow: options.shadow || 16
        });
      }

      pushEquatorOrbiter(palette, options={}) {
        this.particles.push({
          kind:'equatorOrbiter',
          ang:Math.random() * Math.PI * 2,
          rx:this.rand(options.rx0 || 80, options.rx1 || 102),
          ry:this.rand(options.ry0 || 22, options.ry1 || 36),
          cyOff: options.cyOff ?? 0,
          dang:this.rand(options.d0 || 1.05, options.d1 || 1.85) * (Math.random() < .5 ? -1 : 1),
          life:this.rand(2.4, 3.9),
          age:0,
          size:this.rand(options.size0 || 3.6, options.size1 || 6.2),
          color:this.pick(palette),
          shadow:14,
          trailColor:this.pick(options.trails || ['rgba(34,211,238,.26)','rgba(196,181,253,.24)','rgba(255,255,255,.18)'])
        });
      }

      pushSparkle(palette, options={}) {
        const p = this.posOnRing(options.minR || 68, options.maxR || 106);
        this.particles.push({
          kind:'sparkle',
          x:p.x,
          y:p.y,
          vx:this.rand(options.vx0 ?? -4, options.vx1 ?? 4),
          vy:this.rand(options.vy0 ?? -6, options.vy1 ?? 6),
          life:this.rand(options.life0 || .55, options.life1 || 1.1),
          age:0,
          size:this.rand(options.size0 || 5, options.size1 || 10),
          color:this.pick(palette),
          rot:Math.random()*Math.PI*2,
          spin:this.rand(-3.2, 3.2),
          shadow: options.shadow || 14
        });
      }

      pushHaloArc(palette, options={}) {
        this.particles.push({
          kind:'haloArc',
          yOff: options.yOff ?? -74,
          rx: this.rand(options.rx0 || 34, options.rx1 || 52),
          ry: this.rand(options.ry0 || 7, options.ry1 || 13),
          life: this.rand(options.life0 || 1.2, options.life1 || 2.2),
          age:0,
          width: this.rand(options.w0 || 1.8, options.w1 || 3.6),
          color:this.pick(palette),
          shadow: options.shadow || 16,
          phase:Math.random()*Math.PI*2,
          dark: !!options.dark
        });
      }


      pushGemGlint(palette, options={}) {
        const p = options.withinAvatar ? this.posInAvatar(options.maxR || 70) : this.posOnRing(options.minR || 58, options.maxR || 104);
        this.particles.push({
          kind:'gemGlint',
          x:p.x,
          y:p.y,
          life:this.rand(options.life0 || 1.1, options.life1 || 2.0),
          age:0,
          size:this.rand(options.size0 || 3.4, options.size1 || 7.2),
          color:this.pick(palette),
          rot:Math.random() * Math.PI * 2,
          spin:this.rand(-1.2,1.2),
          shadow: options.shadow || 12,
          flare: this.rand(.72, 1.08),
          twinkle: this.rand(4.8, 7.2)
        });
      }

      pushMatrixGlyph(palette, glyphs, options={}) {
        const clipR = options.clipR || 78;
        const cols = options.cols || 11;
        const col = Math.floor(this.rand(0, cols));
        const spacing = (clipR * 2 - 10) / cols;
        const x = this.cx - clipR + 5 + col * spacing + this.rand(-2.5,2.5);
        this.particles.push({
          kind:'matrixGlyph',
          x,
          y:this.cy - clipR + this.rand(4, 18),
          vy:this.rand(options.vy0 || 58, options.vy1 || 110),
          life:this.rand(options.life0 || 1.5, options.life1 || 2.6),
          age:0,
          size:this.rand(options.size0 || 11, options.size1 || 16),
          color:this.pick(palette),
          glyphs,
          char:this.pick(glyphs),
          nextSwap:this.rand(.05,.18),
          shadow: options.shadow || 14,
          clipR
        });
      }

      pushCrossScan(palette, options={}) {
        const rx = this.rand(options.rx0 || 78, options.rx1 || 98);
        const ry = this.rand(options.ry0 || 78, options.ry1 || 98);
        const rangeFactor = options.rangeFactor || .68;
        const x0 = this.cx + (options.cxOff || 0);
        const y0 = this.cy + (options.cyOff || 0);
        const tx = this.rand(this.cx - rx * rangeFactor, this.cx + rx * rangeFactor);
        const ty = this.rand(this.cy - ry * rangeFactor, this.cy + ry * rangeFactor);
        this.particles.push({
          kind:'crossScan',
          xPos:x0,
          yPos:y0,
          targetX:tx,
          targetY:ty,
          speedX:this.rand(options.sx0 || 52, options.sx1 || 88) * (tx > x0 ? 1 : -1),
          speedY:this.rand(options.sy0 || 52, options.sy1 || 88) * (ty > y0 ? 1 : -1),
          holdX:0,
          holdY:0,
          rx, ry,
          rangeFactor,
          life:this.rand(options.life0 || 3.4, options.life1 || 5.0),
          age:0,
          color:this.pick(palette),
          width:this.rand(options.w0 || 1.3, options.w1 || 2.3),
          shadow: options.shadow || 12
        });
      }

      pushRibbon(palette, options={}) {
        const baseAng = this.rand(0, Math.PI * 2);
        this.particles.push({
          kind:'ribbon',
          ang:baseAng,
          arc:this.rand(options.arc0 || .8, options.arc1 || 1.35),
          r:this.rand(options.r0 || 64, options.r1 || 88),
          phase:Math.random() * Math.PI * 2,
          amp:this.rand(options.amp0 || 6, options.amp1 || 14),
          life:this.rand(options.life0 || 1.6, options.life1 || 2.8),
          age:0,
          width:this.rand(options.w0 || 4, options.w1 || 8),
          color:this.pick(palette),
          shadow: options.shadow || 16,
          spin:this.rand(options.spin0 || -0.6, options.spin1 || 0.6)
        });
      }

      pushOrbitGlyph(palette, glyphs, options={}) {
        this.particles.push({
          kind:'orbitGlyph',
          ang:Math.random() * Math.PI * 2,
          dang:this.rand(options.d0 || 0.6, options.d1 || 1.2) * (Math.random() < .5 ? -1 : 1),
          r:this.rand(options.r0 || 84, options.r1 || 106),
          wobble:this.rand(4, 10),
          phase:Math.random() * Math.PI * 2,
          life:this.rand(options.life0 || 1.6, options.life1 || 3.2),
          age:0,
          size:this.rand(options.size0 || 10, options.size1 || 16),
          color:this.pick(palette),
          glyphs,
          char:this.pick(glyphs),
          nextSwap:this.rand(.08, .24),
          shadow: options.shadow || 16
        });
      }

      pushHexCell(palette, options={}) {
        const p = this.posOnRing(options.minR || 58, options.maxR || 100);
        this.particles.push({
          kind:'hexCell',
          x:p.x,
          y:p.y,
          size:this.rand(options.size0 || 8, options.size1 || 16),
          rot:Math.random() * Math.PI * 2,
          spin:this.rand(-1.1,1.1),
          life:this.rand(options.life0 || 1.2, options.life1 || 2.4),
          age:0,
          color:this.pick(palette),
          shadow: options.shadow || 14,
          pulse:this.rand(.8, 1.5)
        });
      }

      pushConstellation(palette, options={}) {
        const count = Math.floor(this.rand(options.count0 || 4, options.count1 || 7));
        const points = [];
        for (let i = 0; i < count; i++) {
          const p = this.posInAvatar(options.maxR || 66);
          points.push({ x:p.x, y:p.y, size:this.rand(1.6, 2.8) });
        }
        points.sort((a,b) => a.x - b.x || a.y - b.y);
        const edges = [];
        for (let i = 0; i < points.length - 1; i++) edges.push([i, i + 1]);
        if (points.length >= 5) edges.push([0, 2]);
        if (points.length >= 6) edges.push([2, 4]);
        this.particles.push({
          kind:'constellation',
          points,
          edges,
          life:this.rand(options.life0 || 1.8, options.life1 || 3.4),
          age:0,
          color:this.pick(palette),
          nodeColor:this.pick(options.nodePalette || ['rgba(255,255,255,.98)']),
          width:this.rand(options.w0 || 1.0, options.w1 || 1.8),
          shadow: options.shadow || 12
        });
      }

      pushWebSwarm(kind='webSwarm', palette, options={}) {
        const count = options.count || 4;
        const radius = options.radius || 60;
        const nodes = [];
        for (let i = 0; i < count; i++) {
          const p = this.posInAvatar(radius);
          nodes.push({
            x:p.x, y:p.y,
            vx:this.rand(options.vx0 || -28, options.vx1 || 28),
            vy:this.rand(options.vy0 || -28, options.vy1 || 28)
          });
        }
        this.particles.push({
          kind,
          nodes,
          radius,
          connectDist: options.connectDist || 76,
          life:this.rand(options.life0 || 60, options.life1 || 60),
          age:0,
          color:this.pick(palette),
          nodeColor:this.pick(options.nodePalette || ['rgba(255,255,255,.95)']),
          width:this.rand(options.w0 || 1.0, options.w1 || 1.7),
          shadow: options.shadow || 12,
          pulseT:0,
          pulseEdge:0
        });
      }

      pushFractureBloom(palette, options={}) {
        const origin = this.posInAvatar(options.maxR || 30);
        const branchCount = Math.floor(this.rand(options.b0 || 4, options.b1 || 7));
        const branches = [];
        for (let i = 0; i < branchCount; i++) {
          const pts = [{x:origin.x, y:origin.y}];
          let x = origin.x, y = origin.y;
          let ang = Math.random() * Math.PI * 2;
          const segs = Math.floor(this.rand(2, 5));
          for (let s = 0; s < segs; s++) {
            ang += this.rand(-0.55, 0.55);
            const len = this.rand(10, 24) * (1 - s * 0.12);
            x += Math.cos(ang) * len;
            y += Math.sin(ang) * len;
            pts.push({x, y});
            if (Math.hypot(x - this.cx, y - this.cy) > 72) break;
          }
          branches.push(pts);
        }
        this.particles.push({
          kind:'fractureBloom',
          origin:{x:origin.x,y:origin.y},
          branches,
          life:this.rand(options.life0 || 1.8, options.life1 || 3.1),
          age:0,
          color:this.pick(palette),
          coreColor:this.pick(options.corePalette || ['rgba(255,255,255,.96)']),
          width:this.rand(options.w0 || 1.1, options.w1 || 2.0),
          shadow: options.shadow || 14
        });
      }


      pushRingRelay(palette, options={}) {
        const count = options.count || 5;
        const rx = options.rx || 72;
        const ry = options.ry || 72;
        const nodes = [];
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
          nodes.push({
            ang: base + (Math.PI * 2 * i / count),
            dang: this.rand(options.d0 || 0.18, options.d1 || 0.42) * (Math.random() < .5 ? -1 : 1)
          });
        }
        this.particles.push({
          kind:'ringRelay',
          nodes,
          rx, ry,
          life:this.rand(options.life0 || 60, options.life1 || 60),
          age:0,
          color:this.pick(palette),
          nodeColor:this.pick(options.nodePalette || ['rgba(255,255,255,.96)']),
          width:this.rand(options.w0 || 1.1, options.w1 || 1.8),
          shadow: options.shadow || 12,
          pulseEdge:0,
          pulseT:0,
          mode: options.mode || 'normal'
        });
      }

      pushIrisSector(palette, options={}) {
        this.particles.push({
          kind:'irisSector',
          ang:this.rand(0, Math.PI * 2),
          sweep:this.rand(options.s0 || .34, options.s1 || .82),
          inner:this.rand(options.in0 || 28, options.in1 || 48),
          outer:this.rand(options.out0 || 58, options.out1 || 78),
          rot:this.rand(-0.18, 0.18),
          life:this.rand(options.life0 || 1.1, options.life1 || 2.2),
          age:0,
          color:this.pick(palette),
          edgeColor:this.pick(options.edgePalette || ['rgba(255,255,255,.92)']),
          shadow: options.shadow || 16
        });
      }

      pushHypnoSpiral(palette, options={}) {
        this.particles.push({
          kind:'hypnoSpiral',
          rot:Math.random() * Math.PI * 2,
          spin:this.rand(options.spin0 || 0.32, options.spin1 || 0.72) * (Math.random() < .5 ? -1 : 1),
          life:this.rand(options.life0 || 60, options.life1 || 60),
          age:0,
          color:this.pick(palette),
          color2:this.pick(options.palette2 || palette),
          turns:this.rand(options.t0 || 1.6, options.t1 || 2.5),
          maxR:this.rand(options.r0 || 64, options.r1 || 78),
          width:this.rand(options.w0 || 1.2, options.w1 || 2.0),
          shadow: options.shadow || 14
        });
      }

      pushAetherLoom(palette, options={}) {
        this.particles.push({
          kind:'aetherLoom',
          life:this.rand(options.life0 || 60, options.life1 || 60),
          age:0,
          phase:Math.random() * Math.PI * 2,
          drift:this.rand(options.d0 || 0.4, options.d1 || 0.8) * (Math.random() < .5 ? -1 : 1),
          amp1:this.rand(options.a10 || 5, options.a11 || 9),
          amp2:this.rand(options.a20 || 3, options.a21 || 7),
          freq1:this.rand(options.f10 || 4.0, options.f11 || 6.2),
          freq2:this.rand(options.f20 || 3.4, options.f21 || 5.4),
          color:this.pick(palette),
          color2:this.pick(options.palette2 || palette),
          shadow: options.shadow || 14,
          width:this.rand(options.w0 || 1.1, options.w1 || 2.0),
          baseR:this.rand(options.r0 || 66, options.r1 || 74)
        });
      }

      pushMobiusRibbon(palette, options={}) {
        this.particles.push({
          kind:'mobiusRibbon',
          life:this.rand(options.life0 || 60, options.life1 || 60),
          age:0,
          rot:Math.random() * Math.PI * 2,
          spin:this.rand(options.spin0 || 0.26, options.spin1 || 0.48) * (Math.random() < .5 ? -1 : 1),
          band:this.rand(options.band0 || 18, options.band1 || 26),
          scale:this.rand(options.s0 || 52, options.s1 || 64),
          color:this.pick(palette),
          color2:this.pick(options.palette2 || palette),
          shadow: options.shadow || 16,
          width:this.rand(options.w0 || 1.5, options.w1 || 2.6)
        });
      }

      pushRosePulse(palette, options={}) {
        this.particles.push({
          kind:'rosePulse',
          life:this.rand(options.life0 || 60, options.life1 || 60),
          age:0,
          rot:Math.random() * Math.PI * 2,
          spin:this.rand(options.spin0 || 0.22, options.spin1 || 0.42) * (Math.random() < .5 ? -1 : 1),
          petals:this.rand(options.p0 || 4, options.p1 || 7),
          radius:this.rand(options.r0 || 44, options.r1 || 64),
          amp:this.rand(options.a0 || 16, options.a1 || 24),
          color:this.pick(palette),
          color2:this.pick(options.palette2 || palette),
          shadow: options.shadow || 16,
          width:this.rand(options.w0 || 1.3, options.w1 || 2.4)
        });
      }

      pushTriNet(palette, options={}) {
        const mkPoint = () => {
          const a = Math.random() * Math.PI * 2;
          const r = this.rand(options.r0 || 42, options.r1 || 72);
          return { a, r };
        };
        this.particles.push({
          kind:'triNet',
          points:[mkPoint(), mkPoint(), mkPoint()],
          rot:Math.random() * Math.PI * 2,
          spin:this.rand(-0.42,0.42),
          life:this.rand(options.life0 || 1.9, options.life1 || 3.2),
          age:0,
          color:this.pick(palette),
          nodeColor: this.pick(options.nodePalette || ['rgba(255,255,255,.96)']),
          width:this.rand(options.w0 || 1.2, options.w1 || 2.2),
          shadow: options.shadow || 14,
          pulse:this.rand(.8,1.4)
        });
      }

      pushWaveSlice(palette, options={}) {
        this.particles.push({
          kind:'waveSlice',
          ang:this.rand(0, Math.PI * 2),
          arc:this.rand(options.arc0 || .36, options.arc1 || .82),
          r:this.rand(options.r0 || 54, options.r1 || 74),
          vr:this.rand(options.vr0 || 24, options.vr1 || 42),
          life:this.rand(options.life0 || .9, options.life1 || 1.6),
          age:0,
          width:this.rand(options.w0 || 1.4, options.w1 || 3.0),
          color:this.pick(palette),
          shadow: options.shadow || 14
        });
      }

      pushScanAxis(palette, options={}) {
        this.particles.push({
          kind:'scanAxis',
          ang:Math.random() * Math.PI * 2,
          dang:this.rand(0.85, 1.2) * (Math.random() < .5 ? -1 : 1),
          rx:this.rand(options.rx0 || 78, options.rx1 || 100),
          ry:this.rand(options.ry0 || 26, options.ry1 || 38),
          cyOff: options.cyOff ?? 6,
          life:this.rand(options.life0 || 1.6, options.life1 || 2.8),
          age:0,
          color:this.pick(palette),
          width:this.rand(options.w0 || 1.4, options.w1 || 2.6),
          shadow: options.shadow || 12
        });
      }

      spawnOne() {
        switch(this.type){
          case 'embers': return this.pushEmber();
          case 'motesSilver': return this.pushDot(['#e2e8f0','#cbd5e1','#f8fafc'],'drift',{life0:1.8,life1:3,size0:2.2,size1:4});
          case 'mistSoft':
            return this.pushSmoke(['rgba(226,232,240,.26)','rgba(148,163,184,.20)','rgba(255,255,255,.18)'], {size0:12,size1:26,life0:2.2,life1:4.0,vy0:-8,vy1:-2});

          case 'fireflies': return this.pushDot(['#86efac','#fde047','#22c55e'],'orb',{size0:3,size1:6,life0:1.4,life1:2.7});
          case 'ashFall':
            if (Math.random()<.7) return this.particles.push({kind:'fallDot', x:this.rand(8,this.w-8), y:this.rand(this.cy-108,this.cy-78), vy:this.rand(38,82), vx:this.rand(-10,10), life:this.rand(1.4,2.3), age:0, size:this.rand(2.4,4.2), color:this.pick(['#a8a29e','#d6d3d1','#fb923c']), shadow:7});
            return this.pushSmoke(['rgba(120,113,108,.36)','rgba(168,162,158,.30)'], {size0:14,size1:28});
          case 'dew':
            if (Math.random()<.84) return this.pushDot(['rgba(147,197,253,.78)','rgba(103,232,249,.72)','rgba(224,242,254,.68)'],'drift',{size0:1.7,size1:3.2,life0:.9,life1:1.6,minR:56,maxR:92,vy0:-8,vy1:6});
            return this.pushRain(['rgba(186,230,253,.68)'],{x0:this.cx-70,x1:this.cx+70,vy0:130,vy1:220,len0:5,len1:12,width:1.0,alpha0:.28,alpha1:.58});

          case 'snowDust':
            if (Math.random()<.7) return this.particles.push({kind:'snow', x:this.rand(8,this.w-8), y:this.rand(this.cy-108,this.cy-76), vx:this.rand(-12,12), vy:this.rand(28,70), life:this.rand(2.0,3.8), age:0, size:this.rand(2.4,4.8), color:'#f8fafc'});
            return this.pushShard(['#dbeafe','#bfdbfe']);
          case 'amberDust': return this.pushDot(['#facc15','#fde68a','#f59e0b'],'drift',{size0:2.6,size1:4.8});

          case 'heavyRain':
            if (Math.random()<.92) return this.pushRain(['rgba(147,197,253,.82)','rgba(186,230,253,.72)','rgba(96,165,250,.68)'], {x0:this.cx-78,x1:this.cx+78,vy0:220,vy1:350,len0:7,len1:16,width:1.15,alpha0:.38,alpha1:.78});
            return this.pushDot(['#bfdbfe','#60a5fa'],'drift',{size0:1.4,size1:2.8,life0:.5,life1:1.0,minR:56,maxR:90});

          case 'snowSquall':
            return this.pushSnowParticle(['rgba(248,250,252,.92)','rgba(219,234,254,.86)','rgba(191,219,254,.78)'], {x0:this.cx-76,x1:this.cx+76,vx0:-12,vx1:12,vy0:34,vy1:72,size0:1.4,size1:3.0,life0:2.2,life1:4.2});

          case 'midnightSnow':
            if (Math.random()<.86) return this.pushSnowParticle(['rgba(17,24,39,.88)','rgba(49,46,129,.82)','rgba(167,139,250,.76)','rgba(100,116,139,.72)'], {x0:this.cx-74,x1:this.cx+74,vx0:-10,vx1:10,vy0:30,vy1:68,size0:1.4,size1:3.0,life0:2.1,life1:4.0});
            return this.pushSmoke(['rgba(30,27,75,.24)','rgba(15,23,42,.28)'], {size0:12,size1:22,life0:1.8,life1:3.2});

          case 'sootRain':
            if (Math.random()<.86) return this.particles.push({kind:'fallDot', x:this.rand(this.cx-76,this.cx+76), y:this.rand(this.cy-108,this.cy-78), vy:this.rand(36,78), vx:this.rand(-6,6), life:this.rand(1.4,2.8), age:0, size:this.rand(1.5,3.2), color:this.pick(['#020617','#111827','#292524','#44403c']), shadow:4});
            return this.pushSmoke(['rgba(15,23,42,.28)','rgba(68,64,60,.20)'], {size0:12,size1:24});

          case 'obsidianSplinters':
            if (Math.random()<.82) return this.pushFallingShard(['#020617','#111827','#4c1d95','#7c3aed'], {vx0:-22,vx1:22,vy0:74,vy1:150,size0:6,size1:13});
            return this.pushDot(['#a78bfa','#4c1d95'],'drift',{size0:2.2,size1:4.2,life0:.8,life1:1.4});
          case 'arcSparks':
            if (Math.random()<.45) return this.pushArc(['rgba(96,165,250,.95)','rgba(191,219,254,.8)'], {w0:1.4,w1:2.7});
            return this.pushDot(['#60a5fa','#dbeafe'],'drift',{life0:.8,life1:1.5});
          case 'thornBloom':
            if (Math.random()<.62) return this.pushLeaf(['#86efac','#22c55e','#fef08a']);
            return this.pushShard(['#bef264','#65a30d','#84cc16']);
          case 'moonSigils': return this.pushText(['☽','✧','✦','⭒'], ['rgba(226,232,240,1)','rgba(196,181,253,1)','rgba(191,219,254,1)'], {vy0:-34,vy1:-10});
          case 'toxicDrizzle':
            if (Math.random()<.82) return this.pushRain(['rgba(74,222,128,.78)','rgba(110,231,183,.70)'],{x0:this.cx-72,x1:this.cx+72,vy0:150,vy1:260,len0:6,len1:14,width:1.2,alpha0:.32,alpha1:.68});
            return this.pushDot(['#86efac','#4ade80'],'drift',{size0:1.4,size1:3.0,life0:.8,life1:1.4,minR:56,maxR:88});

          case 'starChorus':
            if (Math.random()<.72) return this.pushText(['✦','✧','✶','·'], ['rgba(219,234,254,.9)','rgba(191,219,254,.86)','rgba(253,230,138,.82)','rgba(255,255,255,.88)'], {vy0:-8,vy1:4,size0:10,size1:18,life0:1.4,life1:2.8,shadow:10,minR:58,maxR:96});
            return this.pushDot(['#fef3c7','#dbeafe','#c4b5fd'],'drift',{size0:1.4,size1:3.2,life0:1.2,life1:2.4,minR:62,maxR:96,vy0:-8,vy1:6});

          case 'frostOrbit':
            if (Math.random()<.6) return this.pushOrbitDot(['#dbeafe','#bfdbfe']);
            return this.pushShard(['#dbeafe','#93c5fd']);
          case 'spiritLanterns':
            if (Math.random()<.52) return this.particles.push({kind:'lantern', ang:Math.random()*Math.PI*2, r:this.rand(78,112), dang:this.rand(-.6,.6), life:this.rand(2.2,3.5), age:0, size:this.rand(10,16), color:this.pick(['rgba(165,243,252,.95)','rgba(196,181,253,.95)','rgba(254,240,138,.95)'])});
            return this.pushSmoke(['rgba(165,243,252,.22)','rgba(196,181,253,.20)'], {size0:14,size1:26});
          case 'sunShards':
            if (Math.random()<.6) return this.pushShard(['#fde68a','#facc15','#fb923c']);
            return this.pushText(['✦','✶','✹'], ['rgba(254,240,138,1)','rgba(253,224,71,1)'], {vy0:-24,vy1:-6});
          case 'inkPetals':
            if (Math.random()<.65) return this.pushLeaf(['#a855f7','#7c3aed','#4338ca']);
            return this.pushSmoke(['rgba(91,33,182,.38)','rgba(30,27,75,.32)'], {size0:18,size1:32});
          case 'coinWhirl':
            if (Math.random()<.68) return this.particles.push({kind:'orbiterText', char:this.pick(['◍','●','¤']), ang:Math.random()*Math.PI*2, r:this.rand(72,92), dang:this.rand(-.48,.48), life:this.rand(2.8,4.6), age:0, size:this.rand(12,18), color:this.pick(['#facc15','#fde68a','#f59e0b']), rot:0, spin:this.rand(-.8,.8), shadow:12});
            return this.pushDot(['#fde68a','#facc15','#f59e0b'],'orb',{size0:1.8,size1:3.6,life0:1.4,life1:2.4,minR:62,maxR:92});

          case 'stormLash':
            if (Math.random()<.45) return this.pushBolt(['#dbeafe','#93c5fd'],1);
            return this.pushDot(['#60a5fa','#dbeafe'],'drift',{size0:3,size1:6,life0:.7,life1:1.2});
          case 'verdantHalo':
            if (Math.random()<.55) return this.pushRingPulse(['rgba(34,197,94,.9)','rgba(134,239,172,.85)']);
            return this.pushLeaf(['#22c55e','#86efac','#bbf7d0']);
          case 'bloodRite': {
            if (Math.random()<.22) return this.pushText(['⛧','☽','✦'], ['rgba(248,113,113,1)','rgba(185,28,28,1)','rgba(127,29,29,1)'], {vy0:-18,vy1:-3});
            const p = this.posOnRing(60,118);
            return this.particles.push({kind:'blood', x:p.x, y:p.y-8, vx:this.rand(-5,5), vy:this.rand(8,26), life:this.rand(1.7,2.7), age:0, size:this.rand(5,10), color:this.pick(['#ef4444','#dc2626','#991b1b','#7f1d1d']), fadeIn:.28});
          }
          case 'riftGlass':
            if (Math.random()<.4) return this.pushArc(['rgba(103,232,249,.95)','rgba(216,180,254,.82)'], {w0:1.8,w1:3.4});
            return this.pushShard(['#67e8f9','#a5f3fc','#c4b5fd']);
          case 'dragonCinders':
            if (Math.random()<.28) return this.pushArc(['rgba(251,146,60,.95)','rgba(254,215,170,.8)'], {w0:2,w1:4});
            return this.pushDot(['#f97316','#fb923c','#facc15'],'rise',{size0:3,size1:6});
          case 'oracleGlyphs': return this.pushText(['ᚠ','ᚢ','ᚱ','ᚨ','ᛞ','ᛟ','✶','✧'], ['rgba(196,181,253,1)','rgba(191,219,254,1)','rgba(165,243,252,1)'], {vy0:-42,vy1:-16,size0:16,size1:28});
          case 'clockHalo':
            if (Math.random()<.58) return this.pushOrbitText(['⚙','⛭','✶'], ['#f8fafc','#cbd5e1','#facc15']);
            return this.pushOrbitDot(['#cbd5e1','#fde68a']);
          case 'seafoam':
            if (Math.random()<.42) return this.pushArc(['rgba(165,243,252,.95)','rgba(125,211,252,.82)'], {w0:1.8,w1:3.2});
            return this.pushDot(['#67e8f9','#a5f3fc','#e0f2fe'],'drift');
          case 'graveCandles': {
            if (Math.random()<.48) {
              const p = this.posOnRing(62,118);
              return this.particles.push({kind:'candle', x:p.x, y:p.y+6, vx:this.rand(-3,3), vy:this.rand(-7,2), life:this.rand(2.2,3.4), age:0, size:this.rand(10,15), fadeIn:.35});
            }
            return this.pushSmoke(['rgba(196,181,253,.30)','rgba(241,245,249,.24)'], {size0:16,size1:28});
          }
          case 'crystalPulse':
            if (Math.random()<.72) return this.pushShard(['#67e8f9','#a5f3fc','#dbeafe']);
            return this.pushDot(['#67e8f9','#a5f3fc','#dbeafe'],'drift',{size0:3,size1:6,life0:.8,life1:1.4});

          case 'shadowDust':
            if (Math.random()<.62) return this.pushSmoke(['rgba(30,27,75,.38)','rgba(15,23,42,.42)','rgba(88,28,135,.28)'], {size0:16,size1:34});
            return this.pushDot(['#a78bfa','#6d28d9','#334155'],'drift',{size0:2.4,size1:4.4,life0:1.1,life1:2.2});
          case 'graveWhispers':
            if (Math.random()<.42) return this.pushText(['☠','☽','✧','ᛟ'], ['rgba(226,232,240,1)','rgba(196,181,253,1)','rgba(134,239,172,1)'], {vy0:-32,vy1:-8,size0:14,size1:23});
            return this.pushSmoke(['rgba(148,163,184,.30)','rgba(196,181,253,.24)','rgba(22,101,52,.22)'], {size0:16,size1:30});
          case 'blackRain':
            if (Math.random()<.88) return this.pushRain(['rgba(15,23,42,.86)','rgba(30,41,59,.82)','rgba(76,29,149,.72)'], {x0:this.cx-76,x1:this.cx+76,vy0:190,vy1:315,len0:7,len1:16,width:1.25,alpha0:.35,alpha1:.75});
            return this.pushDot(['#a78bfa','#64748b'],'drift',{size0:1.4,size1:2.8,life0:.7,life1:1.2,minR:56,maxR:88});

          case 'shadowChains':
            if (Math.random()<.55) return this.pushOrbitText(['⛓','⌁','⛓'], ['#cbd5e1','#94a3b8','#a78bfa']);
            if (Math.random()<.55) return this.pushText(['⛓','⌁'], ['rgba(203,213,225,1)','rgba(167,139,250,1)'], {vy0:-24,vy1:-8,size0:14,size1:22});
            return this.pushSmoke(['rgba(15,23,42,.46)','rgba(88,28,135,.24)'], {size0:16,size1:30});
          case 'necroticAsh':
            if (Math.random()<.36) return this.pushText(['☠','✣','ᚱ','✧'], ['rgba(134,239,172,1)','rgba(74,222,128,1)','rgba(203,213,225,1)'], {vy0:-30,vy1:-6,size0:14,size1:22});
            if (Math.random()<.65) return this.pushDot(['#86efac','#4ade80','#a3a3a3'],'rise',{size0:2.4,size1:5.0,life0:1.1,life1:2.0});
            return this.pushSmoke(['rgba(22,101,52,.28)','rgba(63,63,70,.30)'], {size0:16,size1:32});
          case 'voidShards':
            if (Math.random()<.68) return this.pushShard(['#a78bfa','#7c3aed','#4c1d95','#e879f9']);
            return this.pushSmoke(['rgba(76,29,149,.32)','rgba(15,23,42,.44)'], {size0:18,size1:34});
          case 'shadowNeedles':
            if (Math.random()<.86) return this.pushFallingShard(['#020617','#111827','#312e81','#6d28d9'], {vx0:-8,vx1:8,vy0:105,vy1:190,size0:7,size1:15,life0:1.0,life1:1.9});
            return this.pushDot(['#a78bfa','#4c1d95'],'drift',{size0:2,size1:4});
          case 'inkComets':
            if (Math.random()<.72) return this.pushComet(['#020617','#111827','#312e81','#4c1d95'], {vx0:70,vx1:125,vy0:45,vy1:100,size0:4.5,size1:8.5,trail:['rgba(15,23,42,.55)','rgba(88,28,135,.36)','rgba(2,6,23,.62)']});
            return this.pushSmoke(['rgba(15,23,42,.42)','rgba(88,28,135,.24)'], {size0:16,size1:30});
          case 'nightScript':
            if (Math.random()<.55) return this.pushText(['ᚾ','ᛟ','☽','✧','⛧'], ['rgba(15,23,42,1)','rgba(49,46,129,1)','rgba(167,139,250,1)'], {vy0:-28,vy1:-8,size0:15,size1:25,shadow:16});
            return this.pushSmoke(['rgba(15,23,42,.44)','rgba(49,46,129,.25)'], {size0:14,size1:28});
          case 'neonRain':
            if (Math.random()<.94) return this.pushNeonRain({x0:this.cx-76,x1:this.cx+76,vy0:185,vy1:320,len0:6,len1:15,w0:1.0,w1:1.6,alpha0:.34,alpha1:.72});
            return this.pushDot(['#22d3ee','#f472b6','#60a5fa'],'drift',{size0:1.4,size1:2.8,life0:.6,life1:1.2,minR:58,maxR:90});

          case 'holoGlitch':
            return this.pushGlitchRect(['rgba(34,211,238,.74)','rgba(244,114,182,.70)','rgba(255,255,255,.58)'], {x0:this.cx-66,x1:this.cx+66,y0:this.cy-66,y1:this.cy+66,w0:10,w1:34,h0:1,h1:4,life0:.14,life1:.32,vx0:-8,vx1:8,vy0:-4,vy1:4,clipAvatar:true});

          case 'dataSparks':
            if (Math.random()<.55) return this.pushText(['0','1','{ }','<>','▢','▣'], ['rgba(34,211,238,1)','rgba(74,222,128,1)','rgba(244,114,182,1)'], {vy0:-34,vy1:-8,size0:12,size1:20,life0:.9,life1:1.7,shadow:12});
            return this.pushDot(['#22d3ee','#4ade80','#f472b6'],'rise',{size0:2.4,size1:4.8,life0:.8,life1:1.5});
          case 'laserSights':
            if (Math.random()<.78) return this.pushLaserLine(['rgba(239,68,68,.95)','rgba(248,113,113,.95)','rgba(244,114,182,.85)']);
            return this.pushDot(['#ef4444','#f472b6'],'drift',{size0:2,size1:4,life0:.5,life1:1.0});
          case 'plasmaCircuit':
            if (Math.random()<.48) return this.pushArc(['rgba(34,211,238,.98)','rgba(59,130,246,.84)'], {w0:1.8,w1:3.8,life0:.45,life1:.9});
            if (Math.random()<.55) return this.pushGlitchRect(['rgba(34,211,238,.72)','rgba(59,130,246,.68)'], {w0:12,w1:36,h0:2,h1:5,life0:.18,life1:.38});
            return this.pushDot(['#22d3ee','#60a5fa','#e0f2fe'],'drift',{size0:2.5,size1:5.2,life0:.7,life1:1.3});
          case 'quantumPixels':
            if (Math.random()<.84) return this.pushFrameGlitch(['rgba(167,139,250,.72)','rgba(34,211,238,.68)','rgba(248,250,252,.62)']);
            return this.pushDot(['#a78bfa','#22d3ee','#f8fafc'],'orb',{size0:1.6,size1:3.2,life0:.8,life1:1.4,minR:72,maxR:92});

          case 'orbitalScan':
            if (Math.random() < .72) {
              const horizontal = Math.random() < .6;
              const pos = horizontal ? this.rand(this.cy - 84, this.cy + 84) : this.rand(this.cx - 84, this.cx + 84);
              return this.particles.push({
                kind:'laserLine',
                horizontal,
                pos,
                offset:this.rand(-3,3),
                life:this.rand(.36, .82),
                age:0,
                width:this.rand(2.6, 5.2),
                color:this.pick(['rgba(125,211,252,.98)','rgba(34,211,238,.96)','rgba(255,255,255,.92)'])
              });
            }
            if (Math.random() < .55) return this.pushGlitchRect(['rgba(34,211,238,.66)','rgba(125,211,252,.62)','rgba(255,255,255,.44)'], {w0:36,w1:104,h0:1,h1:3,life0:.24,life1:.60});
            return this.pushText(['SCAN','▣','//'], ['rgba(34,211,238,1)','rgba(125,211,252,1)','rgba(255,255,255,.95)'], {vy0:-12,vy1:8,size0:11,size1:16,life0:.45,life1:.9,shadow:10});
          case 'cyberGhost':
            if (Math.random()<.46) return this.pushText(['ghost','404','▣','░'], ['rgba(167,139,250,1)','rgba(34,211,238,1)','rgba(148,163,184,.95)'], {vy0:-22,vy1:4,size0:12,size1:18,life0:.7,life1:1.4,shadow:16});
            if (Math.random()<.58) return this.pushGlitchRect(['rgba(167,139,250,.62)','rgba(15,23,42,.74)','rgba(34,211,238,.48)'], {w0:10,w1:46,h0:3,h1:9,life0:.18,life1:.44});
            return this.pushSmoke(['rgba(15,23,42,.42)','rgba(76,29,149,.28)'], {size0:16,size1:34});
          case 'ionTrails':
            return this.pushComet(['#22d3ee','#60a5fa','#a5f3fc'], {vx0:92,vx1:170,vy0:36,vy1:86,size0:3.5,size1:7,life0:.8,life1:1.35,trail:['rgba(34,211,238,.38)','rgba(96,165,250,.32)']});
          case 'glitchFrame':
            if (Math.random() < .74) return this.pushFrameGlitch(['rgba(34,211,238,.92)','rgba(244,114,182,.86)','rgba(255,255,255,.86)','rgba(167,139,250,.82)']);
            return this.pushLaserLine(['rgba(34,211,238,.72)','rgba(244,114,182,.66)','rgba(255,255,255,.68)']);
          case 'phaseOrbit':
            if (Math.random() < .72) return this.pushPhaseOrbiter(['#22d3ee','#c4b5fd','#f8fafc','#f472b6']);
            return this.pushDot(['#22d3ee','#c4b5fd','#e0f2fe'],'drift',{size0:1.8,size1:3.8,life0:.7,life1:1.3,minR:78,maxR:110,vy0:-8,vy1:8});
          case 'meridianOrbit':
            if (Math.random() < .74) return this.pushMeridianOrbiter(['#22d3ee','#c4b5fd','#f8fafc','#f472b6']);
            return this.pushDot(['#22d3ee','#c4b5fd','#e0f2fe'],'drift',{size0:1.8,size1:3.4,life0:.7,life1:1.2,minR:58,maxR:94,vy0:-10,vy1:6});
          case 'tracerTail':
            return this.pushComet(['#f8fafc','#22d3ee','#60a5fa','#f472b6'], {vx0:70,vx1:130,vy0:-14,vy1:72,size0:4.0,size1:7.5,life0:.9,life1:1.55,trail:['rgba(125,211,252,.42)','rgba(244,114,182,.30)','rgba(255,255,255,.28)']});
          case 'infernoCrown':
            if (Math.random() < .52) return this.pushFlameTongue();
            if (Math.random() < .74) return this.pushSmoke(['rgba(68,12,0,.28)','rgba(120,53,15,.24)','rgba(38,38,38,.20)'], {size0:18,size1:32,vy0:-28,vy1:-6});
            return this.pushEmber();
          case 'hyperspaceJump':
            if (Math.random() < .82) return this.pushPerimeterStreak(['rgba(255,255,255,.98)','rgba(125,211,252,.98)','rgba(96,165,250,.92)','rgba(196,181,253,.90)']);
            return this.pushDot(['#ffffff','#bfdbfe','#c4b5fd'],'drift',{size0:1.8,size1:4.2,life0:.42,life1:.82,minR:84,maxR:104,vy0:-5,vy1:5});
          case 'blackIce':

            if (Math.random()<.38) return this.pushGlitchRect(['rgba(2,6,23,.9)','rgba(239,68,68,.8)','rgba(15,23,42,.86)'], {w0:18,w1:60,h0:3,h1:9,life0:.2,life1:.55});
            if (Math.random()<.65) return this.pushFallingShard(['#020617','#111827','#ef4444','#7f1d1d'], {vx0:-12,vx1:12,vy0:80,vy1:155,size0:6,size1:12});
            return this.pushText(['ERR','404','!','▣'], ['rgba(239,68,68,1)','rgba(248,113,113,1)','rgba(15,23,42,1)'], {vy0:-18,vy1:5,size0:12,size1:18,life0:.7,life1:1.4,shadow:16});

          case 'ghostFireflies':
            return this.pushFirefly(['rgba(191,219,254,.98)','rgba(165,243,252,.94)','rgba(255,255,255,.92)'], {size0:2.8,size1:4.8,life0:2.1,life1:3.8,vy0:-20,vy1:-6});
          case 'goldenFireflies':
            return this.pushFirefly(['rgba(253,224,71,.98)','rgba(255,244,180,.95)','rgba(251,191,36,.90)'], {size0:2.8,size1:5.2,life0:2.0,life1:3.6,vy0:-18,vy1:-4});
          case 'equatorOrbit':
            if (Math.random() < .78) return this.pushEquatorOrbiter(['#e0f2fe','#c4b5fd','#f8fafc'], {cyOff:4, rx0:78, rx1:100, ry0:22, ry1:34});
            return this.pushDot(['#e0f2fe','#c4b5fd'],'drift',{size0:1.4,size1:3.0,life0:.8,life1:1.35,minR:70,maxR:104,vy0:-6,vy1:5});
          case 'goldenGlint':
            return this.pushGemGlint(['rgba(255,244,180,.98)','rgba(253,224,71,.98)','rgba(251,191,36,.92)'], {withinAvatar:true,maxR:74,size0:2.2,size1:4.8,life0:1.0,life1:1.8,shadow:8});
          case 'violetAether':
            if (Math.random() < .58) return this.pushSmoke(['rgba(88,28,135,.26)','rgba(167,139,250,.28)','rgba(76,29,149,.22)'], {size0:18,size1:32,vy0:-18,vy1:-4});
            if (Math.random() < .82) return this.pushDot(['#c4b5fd','#e9d5ff','#a78bfa'],'rise',{size0:2.0,size1:4.8,life0:1.0,life1:1.9,minR:56,maxR:104,vy0:-42,vy1:-12});
            return this.pushSparkle(['rgba(196,181,253,.95)','rgba(233,213,255,.92)'], {size0:4,size1:8});
          case 'amethystDust':
            if (Math.random() < .74) return this.pushDot(['#a78bfa','#c4b5fd','#ddd6fe'],'drift',{size0:1.6,size1:3.2,life0:.9,life1:1.7,minR:58,maxR:102,vy0:-10,vy1:6});
            return this.pushSmoke(['rgba(109,40,217,.18)','rgba(167,139,250,.18)'], {size0:16,size1:28,vy0:-10,vy1:-2});
          case 'retroSunset':
            if (Math.random() < .45) return this.pushLaserLine(['rgba(244,114,182,.82)','rgba(34,211,238,.72)','rgba(253,186,116,.68)']);
            if (Math.random() < .75) return this.pushGlitchRect(['rgba(244,114,182,.72)','rgba(34,211,238,.68)','rgba(251,146,60,.55)'], {w0:22,w1:72,h0:2,h1:6,life0:.16,life1:.5});
            return this.pushRingPulse(['rgba(244,114,182,.72)','rgba(34,211,238,.68)','rgba(251,146,60,.55)']);
          case 'vhsGlitch':
            if (Math.random() < .62) return this.pushGlitchRect(['rgba(239,68,68,.62)','rgba(34,211,238,.62)','rgba(255,255,255,.52)'], {w0:30,w1:96,h0:1,h1:4,life0:.12,life1:.36});
            return this.pushText(['REC','//','▣','||'], ['rgba(239,68,68,.92)','rgba(34,211,238,.88)','rgba(255,255,255,.82)'], {vy0:-8,vy1:8,size0:10,size1:15,life0:.45,life1:.9,shadow:10});
          case 'haloDawn':
            if (Math.random() < .68) return this.pushHaloArc(['rgba(255,244,180,.96)','rgba(255,255,255,.92)','rgba(253,224,71,.88)'], {yOff:-76,rx0:34,rx1:48,ry0:7,ry1:12});
            return this.pushDot(['#fde68a','#ffffff','#fef3c7'],'rise',{size0:1.6,size1:3.2,life0:.9,life1:1.5,minR:62,maxR:96,vy0:-28,vy1:-10});
          case 'umbraCrown':
            if (Math.random() < .66) return this.pushHaloArc(['rgba(2,6,23,.94)','rgba(88,28,135,.72)','rgba(124,58,237,.66)'], {yOff:-76,rx0:36,rx1:50,ry0:8,ry1:14,dark:true,shadow:12});
            return this.pushSmoke(['rgba(2,6,23,.30)','rgba(76,29,149,.24)','rgba(88,28,135,.18)'], {size0:18,size1:30,vy0:-12,vy1:-2});
          case 'chronoDial':
            if (Math.random() < .42) return this.pushOrbitText(['I','II','III','VI','IX','XII'], ['rgba(255,244,180,.94)','rgba(191,219,254,.88)','rgba(255,255,255,.88)']);
            if (Math.random() < .74) return this.pushRingPulse(['rgba(191,219,254,.74)','rgba(255,244,180,.65)','rgba(196,181,253,.62)']);
            return this.pushArc(['rgba(191,219,254,.78)','rgba(255,244,180,.65)'], {life0:.45,life1:.92,w0:1.2,w1:2.6});
          case 'timeSands':
            if (Math.random() < .72) return this.pushFirefly(['rgba(255,244,180,.92)','rgba(253,224,71,.88)','rgba(245,158,11,.84)'], {size0:1.8,size1:3.6,life0:1.6,life1:2.8,vy0:-8,vy1:12,ampX0:4,ampX1:12,ampY0:4,ampY1:10});
            return this.pushSparkle(['rgba(255,244,180,.88)','rgba(245,158,11,.76)'], {size0:3,size1:6,life0:.35,life1:.8});
          case 'runeAscent':
            return this.pushText(['ᚱ','ᛟ','ᚨ','ᛉ','✧','ᚾ'], ['rgba(196,181,253,.96)','rgba(255,255,255,.92)','rgba(34,211,238,.88)'], {vy0:-34,vy1:-12,size0:14,size1:22,life0:1.1,life1:2.1,shadow:14});
          case 'arcaneWreath':
            if (Math.random() < .42) return this.pushText(['ᚱ','ᛟ','ᛇ','ᚨ','✦'], ['rgba(196,181,253,.96)','rgba(233,213,255,.94)','rgba(34,211,238,.88)'], {vy0:-28,vy1:-8,size0:14,size1:24,life0:1.2,life1:2.2,shadow:16});
            if (Math.random() < .72) return this.pushArc(['rgba(167,139,250,.82)','rgba(34,211,238,.66)'], {life0:.35,life1:.86,w0:1.2,w1:2.6});
            return this.pushRingPulse(['rgba(167,139,250,.72)','rgba(34,211,238,.62)','rgba(255,255,255,.52)']);
          case 'tacticalLock':
            if (Math.random() < .48) return this.pushLaserLine(['rgba(248,113,113,.92)','rgba(255,255,255,.82)','rgba(148,163,184,.62)']);
            if (Math.random() < .78) return this.pushGlitchRect(['rgba(248,113,113,.68)','rgba(255,255,255,.55)','rgba(148,163,184,.55)'], {w0:18,w1:58,h0:2,h1:5,life0:.15,life1:.42});
            return this.pushText(['LOCK','ARM','//','01'], ['rgba(248,113,113,.94)','rgba(255,255,255,.88)','rgba(148,163,184,.82)'], {vy0:-10,vy1:6,size0:10,size1:15,life0:.45,life1:.9,shadow:8});
          case 'brutalistHud':
            return this.pushGlitchRect(['rgba(245,158,11,.62)','rgba(255,255,255,.46)','rgba(100,116,139,.52)'], {x0:this.cx-68,x1:this.cx+68,y0:this.cy-68,y1:this.cy+68,w0:16,w1:48,h0:3,h1:7,life0:.18,life1:.46,vx0:-6,vx1:6,vy0:-4,vy1:4,clipAvatar:true});

          case 'corporateVeil':
            if (Math.random() < .72) return this.pushGlitchRect(['rgba(229,231,235,.56)','rgba(148,163,184,.48)','rgba(220,38,38,.38)'], {x0:this.cx-68,x1:this.cx+68,y0:this.cy-68,y1:this.cy+68,w0:14,w1:44,h0:2,h1:5,life0:.16,life1:.40,vx0:-5,vx1:5,vy0:-3,vy1:3,clipAvatar:true});
            return this.pushText(['SEC','NET','01'], ['rgba(229,231,235,.80)','rgba(148,163,184,.76)','rgba(220,38,38,.64)'], {vy0:-4,vy1:4,size0:9,size1:13,life0:.65,life1:1.05,shadow:7,minR:54,maxR:72});

          case 'kanjiStream':
            return this.pushText(['企','戦','安','全','網','技','社'], ['rgba(34,211,238,.96)','rgba(255,255,255,.90)','rgba(248,113,113,.86)'], {vy0:10,vy1:24,size0:12,size1:18,life0:.7,life1:1.45,shadow:10});
          case 'gearOrbit':
            if (Math.random() < .78) return this.particles.push({kind:'orbiterText', char:this.pick(['⚙','⛭','⛯']), ang:Math.random()*Math.PI*2, r:this.rand(72,90), dang:this.rand(-.36,.36), life:this.rand(3.0,5.0), age:0, size:this.rand(12,17), color:this.pick(['rgba(245,158,11,.82)','rgba(251,191,36,.76)','rgba(255,244,180,.70)']), rot:0, spin:this.rand(-.5,.5), shadow:10});
            return this.pushSparkle(['rgba(245,158,11,.62)','rgba(255,244,180,.58)'], {size0:2.2,size1:4.6,life0:.45,life1:1.0,minR:64,maxR:88});

          case 'steamValves':
            if (Math.random() < .56) return this.pushSmoke(['rgba(180,83,9,.22)','rgba(148,163,184,.26)','rgba(120,53,15,.20)'], {size0:18,size1:34,vy0:-18,vy1:-4});
            if (Math.random() < .84) return this.pushOrbitText(['⚙','•','⛭'], ['rgba(180,83,9,.88)','rgba(255,244,180,.74)','rgba(148,163,184,.66)']);
            return this.pushSparkle(['rgba(245,158,11,.72)','rgba(255,244,180,.72)'], {size0:3,size1:7,life0:.3,life1:.7});

          case 'silverGlint':
            return this.pushGemGlint(['rgba(255,255,255,.98)','rgba(226,232,240,.96)','rgba(191,219,254,.92)'], {withinAvatar:true,maxR:74,size0:2.1,size1:4.5,life0:1.0,life1:1.8,shadow:8});
          case 'gemGrotto':
            return this.pushGemGlint(['rgba(34,211,238,.96)','rgba(196,181,253,.94)','rgba(253,224,71,.92)','rgba(244,114,182,.92)'], {withinAvatar:true,maxR:74,size0:2.3,size1:4.9,life0:1.0,life1:1.9,shadow:9});
          case 'lowEquatorOrbit':
            if (Math.random() < .82) return this.pushEquatorOrbiter(['#e0f2fe','#c4b5fd','#f8fafc'], {cyOff:10, rx0:72, rx1:90, ry0:18, ry1:26, size0:2.4, size1:4.0, d0:.72,d1:1.10, trails:['rgba(34,211,238,.14)','rgba(196,181,253,.12)','rgba(255,255,255,.10)']});
            return this.pushDot(['#e0f2fe','#c4b5fd'],'drift',{size0:1.0,size1:2.1,life0:.8,life1:1.2,minR:66,maxR:88,vy0:-3,vy1:4});

          case 'redEquatorScan':
            if (!this.particles.some(p => p.kind === 'crossScan')) return this.pushCrossScan(['rgba(248,113,113,.96)','rgba(239,68,68,.92)'], {rx0:76,rx1:82,ry0:76,ry1:82,w0:1.6,w1:2.2,rangeFactor:.54,life0:60,life1:60,sx0:40,sx1:66,sy0:40,sy1:66});
            return;
          case 'matrixRain':
            return this.pushMatrixGlyph(['rgba(34,197,94,.96)','rgba(74,222,128,.92)','rgba(187,247,208,.88)'], ['0','1','ア','ネ','ﾊ','ｦ','ｶ','ｻ','ﾂ','ｵ','ﾏ','ﾘ','ﾄ','ﾖ'], {clipR:76});
          case 'diamondShimmer':
            return this.pushGemGlint(['rgba(255,255,255,.98)','rgba(224,231,255,.94)','rgba(191,219,254,.92)'], {withinAvatar:true,maxR:74,size0:1.9,size1:4.4,life0:.95,life1:1.75,shadow:8});
          case 'matrixRainCyan':
            return this.pushMatrixGlyph(['rgba(34,211,238,.96)','rgba(125,211,252,.92)','rgba(224,242,254,.88)'], ['0','1','<>','//','::','[]','{}','*'], {clipR:76});
          case 'matrixRainViolet':
            return this.pushMatrixGlyph(['rgba(196,181,253,.96)','rgba(167,139,250,.92)','rgba(233,213,255,.88)'], ['0','1','ᚱ','ᛟ','✦','◇','⊙','ᚨ'], {clipR:76});
          case 'matrixRainGold':
            return this.pushMatrixGlyph(['rgba(253,224,71,.96)','rgba(251,191,36,.92)','rgba(255,244,180,.88)'], ['0','1','¥','¤','+',':','//','□'], {clipR:76});
          case 'prismaticRibbons':
            return this.pushRibbon(['rgba(34,211,238,.88)','rgba(244,114,182,.86)','rgba(253,224,71,.78)','rgba(196,181,253,.86)']);
          case 'matrixOrbit':
            return this.pushOrbitGlyph(['rgba(34,197,94,.92)','rgba(74,222,128,.88)','rgba(187,247,208,.84)'], ['0','1','ア','ネ','ﾊ','ｦ','ｶ','ｻ','ﾂ','ｵ','ﾏ','ﾘ','ﾄ','ﾖ','<>','//'], {d0:0.22,d1:0.48,r0:88,r1:100,size0:9,size1:13,life0:2.2,life1:4.2,shadow:13});
          case 'quantumHex':
            return this.pushHexCell(['rgba(34,211,238,.78)','rgba(125,211,252,.72)','rgba(196,181,253,.68)','rgba(255,255,255,.72)'], {minR:70,maxR:84,size0:4,size1:8,life0:.9,life1:1.6,shadow:10});

          case 'hexBeacon':
            return this.pushHexCell(['rgba(56,189,248,.88)','rgba(224,231,255,.86)','rgba(196,181,253,.8)'], {minR:40,maxR:88,size0:7,size1:11,life0:.8,life1:1.5,shadow:10});
          case 'signalWave':
            if (Math.random() < .78) return this.pushWaveSlice(['rgba(248,113,113,.92)','rgba(56,189,248,.88)','rgba(255,255,255,.82)'], {r0:56,r1:72,vr0:22,vr1:36,arc0:.32,arc1:.68});
            return this.pushDot(['#fca5a5','#93c5fd','#ffffff'],'drift',{size0:1.1,size1:2.8,life0:.5,life1:1.1,minR:58,maxR:78,vy0:-4,vy1:4});
          case 'ringGlints':
            return this.pushGemGlint(['rgba(255,255,255,.98)','rgba(253,224,71,.94)','rgba(191,219,254,.92)','rgba(196,181,253,.90)'], {minR:58,maxR:74,size0:2.0,size1:4.5,life0:1.0,life1:1.8,shadow:8});
          case 'triNet':
            if (!this.particles.some(p => p.kind === 'triNet')) return this.pushTriNet(['rgba(56,189,248,.82)','rgba(244,114,182,.76)','rgba(196,181,253,.78)'], {nodePalette:['rgba(255,255,255,.96)','rgba(224,231,255,.92)'], r0:42,r1:72, life0:2.1, life1:3.4});
            return;
          case 'starConstellations':
            return this.pushConstellation(['rgba(191,219,254,.92)','rgba(196,181,253,.88)','rgba(167,243,208,.82)'], {nodePalette:['rgba(255,255,255,.98)','rgba(219,234,254,.95)'], maxR:74, life0:2.4, life1:4.1});
          case 'webRunner':
            if (!this.particles.some(p => p.kind === 'webSwarm')) return this.pushWebSwarm('webSwarm', ['rgba(34,211,238,.82)','rgba(96,165,250,.82)','rgba(244,114,182,.74)'], {count:4, radius:66, connectDist:82, life0:60, life1:60, nodePalette:['rgba(255,255,255,.96)','rgba(191,219,254,.94)']});
            return;
          case 'relayMesh':
            if (!this.particles.some(p => p.kind === 'ringRelay')) return this.pushRingRelay(['rgba(56,189,248,.80)','rgba(196,181,253,.76)'], {count:5, rx:74, ry:74, life0:60, life1:60, nodePalette:['rgba(255,255,255,.96)','rgba(224,231,255,.94)'], d0:0.12, d1:0.28});
            return;
          case 'fractureBloom':
            return this.pushFractureBloom(['rgba(244,114,182,.90)','rgba(125,211,252,.88)','rgba(250,204,21,.84)'], {corePalette:['rgba(255,255,255,.98)','rgba(254,249,195,.95)'], maxR:34, life0:1.8, life1:3.0});
          case 'holoIris':
            return this.pushIrisSector(['rgba(34,211,238,.16)','rgba(196,181,253,.17)','rgba(56,189,248,.14)','rgba(244,114,182,.12)'], {edgePalette:['rgba(255,255,255,.76)','rgba(224,231,255,.70)'], in0:58, in1:66, out0:72, out1:84, life0:.75, life1:1.35, s0:.18, s1:.34, shadow:10});

          case 'solarIris':
            return this.pushIrisSector(['rgba(253,224,71,.24)','rgba(251,191,36,.20)','rgba(255,244,180,.18)'], {edgePalette:['rgba(255,251,235,.96)','rgba(254,240,138,.92)'], in0:26, in1:46, out0:60, out1:80, life0:1.0, life1:1.8, s0:.34, s1:.62, shadow:14});
          case 'violetIris':
            return this.pushIrisSector(['rgba(196,181,253,.24)','rgba(167,139,250,.22)','rgba(244,114,182,.16)'], {edgePalette:['rgba(233,213,255,.94)','rgba(255,255,255,.84)'], in0:22, in1:42, out0:58, out1:78, life0:1.05, life1:1.9, s0:.28, s1:.54, shadow:15});
          case 'sentinelRelay':
            if (!this.particles.some(p => p.kind === 'ringRelay')) return this.pushRingRelay(['rgba(34,211,238,.80)','rgba(224,242,254,.76)'], {count:4, rx:74, ry:74, life0:60, life1:60, nodePalette:['rgba(255,255,255,.96)','rgba(186,230,253,.92)'], d0:0.10, d1:0.22, w0:1.0, w1:1.5});
            return;
          case 'violetRelay':
            if (!this.particles.some(p => p.kind === 'ringRelay')) return this.pushRingRelay(['rgba(196,181,253,.82)','rgba(244,114,182,.72)'], {count:6, rx:74, ry:74, life0:60, life1:60, nodePalette:['rgba(255,255,255,.94)','rgba(233,213,255,.92)'], d0:0.10, d1:0.22, w0:1.0, w1:1.5, mode:'violet'});
            return;
          case 'hypnoSpiral':
            if (!this.particles.some(p => p.kind === 'hypnoSpiral')) return this.pushHypnoSpiral(['rgba(34,211,238,.92)','rgba(196,181,253,.88)','rgba(253,224,71,.78)'], {palette2:['rgba(255,255,255,.96)','rgba(244,114,182,.80)'], t0:1.7, t1:2.6, r0:66, r1:80, w0:1.3, w1:2.2, shadow:16, life0:60, life1:60});
            return;
          case 'aetherLoom':
            if (!this.particles.some(p => p.kind === 'aetherLoom')) return this.pushAetherLoom(['rgba(34,211,238,.90)','rgba(196,181,253,.88)','rgba(255,255,255,.84)'], {palette2:['rgba(244,114,182,.74)','rgba(125,211,252,.78)'], a10:6,a11:9,a20:3,a21:7,f10:4.2,f11:6.0,f20:3.4,f21:5.2,w0:1.2,w1:2.0,shadow:15,r0:67,r1:74,life0:60,life1:60});
            return;
          case 'mobiusRibbon':
            if (!this.particles.some(p => p.kind === 'mobiusRibbon')) return this.pushMobiusRibbon(['rgba(34,211,238,.96)','rgba(244,114,182,.90)','rgba(255,255,255,.92)'], {palette2:['rgba(196,181,253,.90)','rgba(125,211,252,.86)'], band0:22,band1:30,s0:58,s1:70,w0:2.1,w1:3.0,shadow:18,life0:60,life1:60,spin0:0.32,spin1:0.52});
            return;
          case 'pulsarRose':
            if (!this.particles.some(p => p.kind === 'rosePulse')) return this.pushRosePulse(['rgba(34,211,238,.92)','rgba(196,181,253,.90)','rgba(255,255,255,.88)'], {palette2:['rgba(250,204,21,.78)','rgba(244,114,182,.76)'], p0:4,p1:7,r0:48,r1:66,a0:14,a1:22,w0:1.5,w1:2.4,shadow:16,life0:60,life1:60});
            return;
          case 'eclipseCrown':
            if (Math.random()<.4) return this.pushOrbitDot(['#f8fafc','#c4b5fd','#fde68a']);
            return this.pushSmoke(['rgba(168,85,247,.36)','rgba(30,27,75,.32)'], {size0:18,size1:34});
          case 'celestialChoir':
            if (Math.random()<.5) return this.pushText(['✦','✶','☼','✹'], ['rgba(254,240,138,1)','rgba(255,251,235,1)','rgba(253,224,71,1)'], {vy0:-30,vy1:-6,size0:16,size1:28});
            return this.pushArc(['rgba(254,240,138,.95)','rgba(255,251,235,.8)'], {w0:1.8,w1:3.4});
          case 'phoenixTrail':
            if (Math.random()<.32) return this.particles.push({kind:'feather', x:this.posOnRing().x, y:this.posOnRing().y, vx:this.rand(-8,8), vy:this.rand(-40,-12), rot:Math.random()*Math.PI*2, spin:this.rand(-2,2), life:this.rand(1.4,2.2), age:0, size:this.rand(11,20), color:this.pick(['#fb923c','#facc15','#fca5a5'])});
            return this.pushDot(['#f97316','#fb923c','#fde68a'],'rise',{size0:3,size1:6});
          case 'worldTreeVeins':
            if (Math.random()<.5) return this.pushRingPulse(['rgba(34,197,94,.9)','rgba(110,231,183,.85)']);
            return this.pushLeaf(['#22c55e','#bbf7d0','#fef08a']);
          case 'prismMonarch':
            if (Math.random()<.5) return this.pushArc([this.pick(['rgba(96,165,250,.95)','rgba(244,114,182,.95)','rgba(250,204,21,.95)']), this.pick(['rgba(34,211,238,.82)','rgba(192,132,252,.82)','rgba(253,186,116,.82)'])], {w0:2,w1:4});
            return this.pushDot(['#60a5fa','#f472b6','#facc15','#22d3ee','#c084fc'],'drift',{size0:3,size1:6});
          case 'nightfall':
            if (Math.random()<.62) return this.pushRain(['rgba(2,6,23,.84)','rgba(15,23,42,.78)','rgba(49,46,129,.70)'], {x0:this.cx-78,x1:this.cx+78,vy0:170,vy1:300,len0:7,len1:16,width:1.25,alpha0:.32,alpha1:.70});
            if (Math.random()<.5) return this.pushText(['✦','✧','·'], ['rgba(100,116,139,.84)','rgba(167,139,250,.80)','rgba(226,232,240,.72)'], {vy0:-8,vy1:6,size0:10,size1:16,life0:1.0,life1:1.8,shadow:10,minR:58,maxR:90});
            return this.pushSmoke(['rgba(2,6,23,.42)','rgba(49,46,129,.24)'], {size0:14,size1:28});

          case 'oblivionScript':
            if (Math.random()<.62) return this.pushText(['ᛟ','ᚱ','⛧','☽','𓂀'], ['rgba(15,23,42,1)','rgba(88,28,135,1)','rgba(216,180,254,1)'], {vy0:-34,vy1:-10,size0:18,size1:30,shadow:18});
            return this.pushSmoke(['rgba(15,23,42,.58)','rgba(88,28,135,.34)'], {size0:18,size1:38});
          case 'blackAurora':
            if (Math.random()<.46) return this.pushArc(['rgba(15,23,42,.9)','rgba(167,139,250,.72)'], {w0:2,w1:4.5,life0:.8,life1:1.5});
            if (Math.random()<.6) return this.pushDot(['#a78bfa','#4c1d95','#111827'],'drift',{size0:2.5,size1:5.5,life0:1.0,life1:1.8});
            return this.pushSmoke(['rgba(15,23,42,.52)','rgba(76,29,149,.28)'], {size0:18,size1:36});
          case 'thunderThrone':
            if (Math.random()<.55) return this.pushBolt(['#ffffff','#93c5fd'], 2 + Math.floor(Math.random()*2));
            return this.pushDot(['#dbeafe','#60a5fa'],'drift',{size0:3,size1:6});
          case 'netherSigil':
            if (Math.random()<.35) return this.pushText(['⛧','✦','☽','✶'], ['rgba(248,113,113,1)','rgba(234,88,12,1)','rgba(168,85,247,1)'], {vy0:-32,vy1:-6,size0:16,size1:28});
            return this.pushSmoke(['rgba(127,29,29,.34)','rgba(88,28,135,.30)'], {size0:18,size1:34});
        }
      }

      update(now) {
        try {
          const dt = Math.min((now - this.last) / 1000, 0.033);
          this.last = now;
          const ctx = this.ctx;
          ctx.clearRect(0,0,this.w,this.h);

          if (!this.active) return;
          if (paused) {
            this.drawPause();
            return;
          }

          this.spawn(dt * 1000);
          const next = [];

          for (const p of this.particles) {
            p.age += dt;
            if (p.age > p.life) continue;
            const t = p.age / p.life;

            switch (p.kind) {
              case 'text':
              case 'smoke':
              case 'leaf':
              case 'shard':
              case 'blood':
              case 'candle':
              case 'feather':
              case 'flame':
                p.x += (p.vx || 0) * dt;
                p.y += (p.vy || 0) * dt;
                if (p.kind === 'leaf' || p.kind === 'shard' || p.kind === 'feather' || p.kind === 'text') p.rot += (p.spin || 0) * dt;
                if (p.kind === 'smoke') p.x += Math.sin(p.age * 1.8 + (p.phase || 0)) * 0.25;
                if (p.kind === 'flame') p.x = p.x0 + Math.sin(p.age * (p.freq || 5) + (p.phase || 0)) * (p.amp || 6);
                break;
              case 'ember':
                p.y += p.vy * dt;
                p.x = p.x0 + Math.sin(p.age * p.freq + p.phase) * p.amp;
                break;
              case 'dot':
                if (p.mode === 'rise') {
                  p.y += p.vy * dt;
                  p.x = p.x0 + Math.sin(p.age * p.freq + p.phase) * p.amp;
                } else if (p.mode === 'orb') {
                  p.x += Math.cos(p.age * 2 + p.phase) * 0.55;
                  p.y += Math.sin(p.age * 2 + p.phase) * 0.55;
                } else {
                  p.x += (p.vx || 0) * dt;
                  p.y += (p.vy || 0) * dt * 0.25;
                }
                break;
              case 'comet':
                p.px = p.x;
                p.py = p.y;
                p.x += (p.vx || 0) * dt;
                p.y += (p.vy || 0) * dt;
                break;
              case 'glitchRect':
                p.x += (p.vx || 0) * dt;
                p.y += (p.vy || 0) * dt;
                break;
              case 'rain':
                p.y += (p.vy || 0) * dt;
                break;
              case 'snow':
                p.y += (p.vy || 0) * dt;
                p.x += (p.vx || 0) * dt + Math.sin(p.age * 2.2 + (p.phase || 0)) * 0.34;
                break;
              case 'fallDot':
                p.y += (p.vy || 0) * dt;
                p.x += (p.vx || 0) * dt;
                break;
              case 'orbiterText':
              case 'orbiterDot':
              case 'lantern':
              case 'orbitStreak':
                p.ang += (p.dang || 0) * dt;
                if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
                break;
              case 'meridianOrbiter':
              case 'equatorOrbiter':
                p.ang += (p.dang || 0) * dt;
                break;
              case 'firefly':
                p.x = p.x0 + Math.sin(p.age * p.freqX + p.phase) * p.ampX + (p.driftX || 0) * p.age;
                p.y = p.y0 + Math.cos(p.age * p.freqY + p.phaseY) * p.ampY + (p.driftY || 0) * p.age;
                break;
              case 'sparkle':
                p.x += (p.vx || 0) * dt;
                p.y += (p.vy || 0) * dt;
                p.rot = (p.rot || 0) + (p.spin || 0) * dt;
                break;
              case 'haloArc':
                break;
              case 'matrixGlyph':
                p.y += (p.vy || 80) * dt;
                p.nextSwap -= dt;
                if (p.nextSwap <= 0) {
                  p.char = this.pick(p.glyphs || ['0','1']);
                  p.nextSwap = this.rand(.05,.18);
                }
                break;
              case 'scanAxis':
                p.ang += (p.dang || 0) * dt;
                break;
              case 'crossScan': {
                const moveAxis = (posKey, targetKey, speedKey, holdKey, minV, maxV) => {
                  if (p[holdKey] > 0) { p[holdKey] -= dt; return; }
                  const d = p[targetKey] - p[posKey];
                  const step = p[speedKey] * dt;
                  if (Math.abs(d) <= Math.abs(step)) {
                    p[posKey] = p[targetKey];
                    p[holdKey] = this.rand(.32,.85);
                    p[targetKey] = this.rand(minV, maxV);
                    p[speedKey] = this.rand(46, 82) * (p[targetKey] > p[posKey] ? 1 : -1);
                  } else {
                    p[posKey] += step;
                  }
                };
                const f = p.rangeFactor || .68;
                moveAxis('xPos','targetX','speedX','holdX', this.cx - p.rx * f, this.cx + p.rx * f);
                moveAxis('yPos','targetY','speedY','holdY', this.cy - p.ry * f, this.cy + p.ry * f);
                break;
              }
              case 'waveSlice':
                p.r += (p.vr || 30) * dt;
                break;
              case 'triNet':
                p.rot += (p.spin || 0) * dt;
                break;
              case 'webSwarm':
              case 'relayMesh': {
                const limit = p.radius || 60;
                p.nodes.forEach(node => {
                  node.x += node.vx * dt;
                  node.y += node.vy * dt;
                  const dx = node.x - this.cx;
                  const dy = node.y - this.cy;
                  const dist = Math.hypot(dx, dy);
                  if (dist > limit) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    node.x = this.cx + nx * limit;
                    node.y = this.cy + ny * limit;
                    const dot = node.vx * nx + node.vy * ny;
                    node.vx -= 2 * dot * nx;
                    node.vy -= 2 * dot * ny;
                  }
                });
                if (p.kind === 'relayMesh') {
                  p.pulseT += dt * 0.9;
                  if (p.pulseT >= 1) {
                    p.pulseT = 0;
                    p.pulseEdge = (p.pulseEdge + 1) % p.nodes.length;
                  }
                }
                break;
              }
              case 'ringRelay':
                p.nodes.forEach(node => node.ang += (node.dang || 0) * dt);
                p.pulseT += dt * 1.15;
                if (p.pulseT >= 1) {
                  p.pulseT = 0;
                  p.pulseEdge = (p.pulseEdge + 1) % p.nodes.length;
                }
                break;
              case 'irisSector':
                p.ang += (p.rot || 0) * dt;
                break;
              case 'hypnoSpiral':
                p.rot += (p.spin || 0) * dt;
                break;
              case 'aetherLoom':
                p.phase += (p.drift || 0.9) * dt;
                break;
              case 'mobiusRibbon':
                p.rot += (p.spin || 0.36) * dt;
                break;
              case 'rosePulse':
                p.rot += (p.spin || 0.3) * dt;
                break;
              case 'orbitGlyph':
                p.ang += (p.dang || 0) * dt;
                p.nextSwap -= dt;
                if (p.nextSwap <= 0) {
                  p.char = this.pick(p.glyphs || ['0','1']);
                  p.nextSwap = this.rand(.08,.24);
                }
                break;
              case 'hexCell':
                p.rot += (p.spin || 0) * dt;
                break;
              case 'ribbon':
                p.ang += (p.spin || 0) * dt;
                break;
              case 'streak':
                p.r += (p.speed || 0) * dt;
                break;
            }

            try {
              this.drawParticle(p, t);
              next.push(p);
            } catch (particleError) {
              // битая частица не ломает весь предпросмотр
            }
          }

          this.particles = next;
        } catch (effectError) {
          this.particles = [];
          this.spawnAcc = 0;
          try { this.ctx.clearRect(0,0,this.w,this.h); } catch (_) {}
        }
      }

      drawParticle(p,t){
        const ctx = this.ctx;
        let alpha = Math.max(0, 1 - t);

        const clipR = Number(p.clipR || this.effectClipRadius(p.kind) || 0);
        if (clipR > 0 && !p.__roundClipActive) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(this.cx, this.cy, clipR, 0, Math.PI * 2);
          ctx.clip();
          p.__roundClipActive = true;
          try { this.drawParticle(p, t); }
          finally { delete p.__roundClipActive; ctx.restore(); }
          return;
        }

        switch(p.kind){
          case 'text': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            ctx.font = `${p.size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.fillText(p.char, 0, 0);
            ctx.restore();
            break;
          }
          case 'ember': {
            const emberIn = Math.min(1, t / 0.18);
            const emberAlpha = alpha * emberIn;
            const emberColor = t < 0.28 ? p.hot : (t < 0.62 ? p.mid : p.cold);
            const emberSize = Math.max(1.1, p.size * (1 - t * 0.42));
            ctx.save();
            ctx.globalAlpha = emberAlpha;
            ctx.fillStyle = emberColor;
            ctx.shadowColor = emberColor;
            ctx.shadowBlur = t < 0.62 ? 16 : 4;
            ctx.beginPath();
            ctx.arc(p.x,p.y,emberSize,0,Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'flame': {
            const fadeIn = Math.min(1, t / 0.12);
            const flameAlpha = alpha * fadeIn;
            const h = p.size * (1.55 - t * 0.25);
            const w = p.size * (0.58 + Math.sin(p.age * 10 + p.phase) * 0.08);
            ctx.save();
            ctx.globalAlpha = flameAlpha;
            ctx.translate(p.x, p.y);
            ctx.beginPath();
            ctx.moveTo(0, -h);
            ctx.bezierCurveTo(w * .95, -h * .35, w * .78, h * .18, 0, h * .9);
            ctx.bezierCurveTo(-w * .78, h * .18, -w * .95, -h * .35, 0, -h);
            const g = ctx.createLinearGradient(0, -h, 0, h);
            g.addColorStop(0, p.inner);
            g.addColorStop(.38, p.core);
            g.addColorStop(1, p.outer);
            ctx.fillStyle = g;
            ctx.shadowColor = p.core;
            ctx.shadowBlur = 18;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -h * .62);
            ctx.bezierCurveTo(w * .42, -h * .18, w * .32, h * .10, 0, h * .48);
            ctx.bezierCurveTo(-w * .32, h * .10, -w * .42, -h * .18, 0, -h * .62);
            ctx.fillStyle = 'rgba(255,248,200,.72)';
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'dot':
          case 'fallDot': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 10;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'orbiterDot': {
            const x = this.cx + Math.cos(p.ang) * p.r;
            const y = this.cy + Math.sin(p.ang) * p.r;
            const front = Math.sin(p.ang) > 0;
            if (p.avatarOcclude && !front) alpha *= 0.20;
            if (p.trailColor) {
              ctx.save();
              ctx.globalAlpha = alpha * (front ? 0.48 : 0.16);
              ctx.strokeStyle = p.trailColor;
              ctx.lineWidth = Math.max(1.5, p.size * .42);
              ctx.lineCap = 'round';
              ctx.shadowColor = p.trailColor;
              ctx.shadowBlur = 8;
              ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const aa = p.ang - (p.dang > 0 ? 1 : -1) * i * 0.15;
                const tx = this.cx + Math.cos(aa) * p.r;
                const ty = this.cy + Math.sin(aa) * p.r;
                if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
              }
              ctx.stroke();
              ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            ctx.beginPath();
            ctx.arc(x,y, front ? p.size : p.size * .86, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'orbiterText': {
            const x = this.cx + Math.cos(p.ang) * p.r;
            const y = this.cy + Math.sin(p.ang) * p.r;
            const front = Math.sin(p.ang) > 0;
            const localAlpha = alpha * (front ? 1 : 0.22);
            ctx.save();
            ctx.globalAlpha = localAlpha;
            ctx.translate(x, y);
            ctx.rotate(p.rot || 0);
            ctx.font = `${p.size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.fillText(p.char, 0, 0);
            ctx.restore();
            break;
          }
          case 'orbitStreak': {
            const x1 = this.cx + Math.cos(p.ang) * p.r;
            const y1 = this.cy + Math.sin(p.ang) * p.r;
            const tangent = p.ang + (p.dang >= 0 ? Math.PI / 2 : -Math.PI / 2);
            const x0 = x1 - Math.cos(tangent) * p.len;
            const y0 = y1 - Math.sin(tangent) * p.len;
            const front = Math.sin(p.ang) > 0;
            const localAlpha = alpha * (front ? 1 : 0.24);
            ctx.save();
            ctx.globalAlpha = localAlpha;
            const grad = ctx.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(.55, p.color);
            grad.addColorStop(1, 'rgba(255,255,255,.98)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = p.width || 2.5;
            ctx.lineCap = 'round';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 16;
            ctx.beginPath();
            ctx.moveTo(x0,y0);
            ctx.lineTo(x1,y1);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'meridianOrbiter': {
            const x = this.cx + Math.cos(p.ang) * p.rx;
            const y = this.cy + Math.sin(p.ang) * p.ry;
            const front = Math.cos(p.ang) > 0;
            const localAlpha = alpha * (front ? 1 : 0.22);
            if (p.trailColor) {
              ctx.save();
              ctx.globalAlpha = localAlpha * .45;
              ctx.strokeStyle = p.trailColor;
              ctx.lineWidth = Math.max(1.5, (p.size || 5) * .42);
              ctx.lineCap = 'round';
              ctx.shadowColor = p.trailColor;
              ctx.shadowBlur = 8;
              ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const aa = p.ang - (p.dang > 0 ? 1 : -1) * i * 0.18;
                const tx = this.cx + Math.cos(aa) * p.rx;
                const ty = cy + Math.sin(aa) * p.ry;
                if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
              }
              ctx.stroke();
              ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha = localAlpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 16;
            ctx.beginPath();
            ctx.arc(x, y, front ? p.size : p.size * .86, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }

          case 'equatorOrbiter': {
            const cy = this.cy + (p.cyOff || 0);
            const x = this.cx + Math.cos(p.ang) * p.rx;
            const y = cy + Math.sin(p.ang) * p.ry;
            const front = Math.sin(p.ang) > 0;
            const localAlpha = alpha * (front ? 1 : 0.20);
            if (p.trailColor) {
              ctx.save();
              ctx.globalAlpha = localAlpha * .42;
              ctx.strokeStyle = p.trailColor;
              ctx.lineWidth = Math.max(1.2, (p.size || 4) * .34);
              ctx.lineCap = 'round';
              ctx.shadowColor = p.trailColor;
              ctx.shadowBlur = 6;
              ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const aa = p.ang - (p.dang > 0 ? 1 : -1) * i * 0.18;
                const tx = this.cx + Math.cos(aa) * p.rx;
                const ty = cy + Math.sin(aa) * p.ry;
                if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
              }
              ctx.stroke();
              ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha = localAlpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.beginPath();
            ctx.arc(x, y, front ? p.size : p.size * .82, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'firefly': {
            const pulse = 0.45 + Math.sin(p.age * 4.8 + p.phase) * 0.25;
            ctx.save();
            ctx.globalAlpha = alpha * (0.55 + pulse);
            const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size * 3.2);
            g.addColorStop(0,p.color);
            g.addColorStop(.35,p.color);
            g.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.size * 3.2,0,Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.92)';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 16;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'sparkle': {
            const flare = 0.4 + Math.sin(t * Math.PI) * 0.9;
            const s = p.size * flare;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.beginPath();
            ctx.moveTo(-s,0); ctx.lineTo(s,0);
            ctx.moveTo(0,-s); ctx.lineTo(0,s);
            ctx.moveTo(-s*.65,-s*.65); ctx.lineTo(s*.65,s*.65);
            ctx.moveTo(-s*.65,s*.65); ctx.lineTo(s*.65,-s*.65);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'haloArc': {
            ctx.save();
            ctx.globalAlpha = alpha * (.55 + Math.sin((p.age || 0) * 4 + p.phase) * .12);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 2.2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 16;
            ctx.beginPath();
            ctx.ellipse(this.cx, this.cy + p.yOff, p.rx, p.ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            if (!p.dark) {
              ctx.globalAlpha *= .22;
              ctx.beginPath();
              ctx.ellipse(this.cx, this.cy + p.yOff, p.rx * .75, p.ry * .55, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
            break;
          }

          case 'gemGlint': {
            const fade = Math.sin(Math.min(1, t) * Math.PI);
            const s = p.size * (.35 + fade * p.flare);
            ctx.save();
            ctx.globalAlpha = alpha * (.12 + fade * .78);
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot || 0) + t * (p.spin || 0));
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.05;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            ctx.beginPath();
            ctx.moveTo(-s,0); ctx.lineTo(s,0);
            ctx.moveTo(0,-s); ctx.lineTo(0,s);
            ctx.stroke();
            ctx.globalAlpha *= .4;
            ctx.beginPath();
            ctx.moveTo(-s*.46,-s*.46); ctx.lineTo(s*.46,s*.46);
            ctx.moveTo(-s*.46,s*.46); ctx.lineTo(s*.46,-s*.46);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'matrixGlyph': {
            const fadeIn = Math.min(1, t / .12);
            const fadeOut = Math.max(0, 1 - Math.max(0, t - .76) / .24);
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, p.clipR || 76, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = alpha * fadeIn * fadeOut;
            ctx.font = `${p.size}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.fillText(p.char, p.x, p.y);
            ctx.globalAlpha *= .24;
            ctx.fillText(p.char, p.x, p.y - p.size * 1.1);
            ctx.restore();
            break;
          }
          case 'scanAxis': {
            const cy = this.cy + (p.cyOff || 0);
            const x = this.cx + Math.cos(p.ang) * p.rx;
            const y = cy + Math.sin(p.ang) * p.ry;
            ctx.save();
            ctx.globalAlpha = alpha * .95;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            ctx.beginPath();
            ctx.moveTo(this.cx - p.rx, cy);
            ctx.lineTo(this.cx + p.rx, cy);
            ctx.moveTo(this.cx, cy - p.ry);
            ctx.lineTo(this.cx, cy + p.ry);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 4.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.96)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(248,113,113,.9)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y);
            ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'crossScan': {
            const glow = (p.holdX > 0 && p.holdY > 0) ? 1 : 0.52;
            const r = 72;
            const dy = p.yPos - this.cy;
            const dx = p.xPos - this.cx;
            const halfW = Math.sqrt(Math.max(0, r * r - dy * dy));
            const halfH = Math.sqrt(Math.max(0, r * r - dx * dx));
            ctx.save();
            ctx.globalAlpha = .96;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.8;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            ctx.beginPath();
            ctx.moveTo(this.cx - halfW, p.yPos);
            ctx.lineTo(this.cx + halfW, p.yPos);
            ctx.moveTo(p.xPos, this.cy - halfH);
            ctx.lineTo(p.xPos, this.cy + halfH);
            ctx.stroke();
            ctx.globalAlpha = .38 + glow * .62;
            const g = ctx.createRadialGradient(p.xPos,p.yPos,0,p.xPos,p.yPos,15);
            g.addColorStop(0,'rgba(255,255,255,.98)');
            g.addColorStop(.34,'rgba(248,113,113,.92)');
            g.addColorStop(1,'rgba(248,113,113,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.xPos,p.yPos,15,0,Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.95)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.xPos-6,p.yPos); ctx.lineTo(p.xPos+6,p.yPos);
            ctx.moveTo(p.xPos,p.yPos-6); ctx.lineTo(p.xPos,p.yPos+6);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'ringRelay': {
            const pts = (p.nodes || []).map(n => ({
              x: this.cx + Math.cos(n.ang) * p.rx,
              y: this.cy + Math.sin(n.ang) * p.ry
            }));
            ctx.save();
            ctx.globalAlpha = .86;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.3;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            if (pts.length > 1) {
              ctx.beginPath();
              ctx.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.closePath();
              ctx.stroke();
              if (p.mode === 'violet' && pts.length >= 5) {
                ctx.globalAlpha = .42;
                ctx.strokeStyle = 'rgba(244,114,182,.72)';
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 2; i < pts.length + 2; i += 2) {
                  const q = pts[i % pts.length];
                  ctx.lineTo(q.x, q.y);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.globalAlpha = .18;
                ctx.fillStyle = 'rgba(196,181,253,.38)';
                ctx.fill();
                ctx.globalAlpha = .86;
                ctx.strokeStyle = p.color;
              }
              const edgeIndex = p.pulseEdge % pts.length;
              const a = pts[edgeIndex];
              const b = pts[(edgeIndex + 1) % pts.length];
              const x = a.x + (b.x - a.x) * (p.pulseT || 0);
              const y = a.y + (b.y - a.y) * (p.pulseT || 0);
              ctx.fillStyle = 'rgba(255,255,255,.98)';
              ctx.shadowColor = p.nodeColor || 'rgba(255,255,255,.96)';
              ctx.shadowBlur = 14;
              ctx.beginPath(); ctx.arc(x, y, p.mode === 'violet' ? 3.8 : 3.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowColor = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowBlur = 10;
            pts.forEach((pt, idx) => { 
              ctx.beginPath(); 
              ctx.arc(pt.x, pt.y, p.mode === 'violet' && idx % 2 === 0 ? 3.0 : 2.5, 0, Math.PI * 2); 
              ctx.fill(); 
            });
            ctx.restore();
            break;
          }
          case 'irisSector': {
            const fade = Math.sin(Math.min(1, t) * Math.PI);
            const a0 = p.ang - p.sweep * .5;
            const a1 = p.ang + p.sweep * .5;
            ctx.save();
            ctx.globalAlpha = alpha * (.18 + fade * .82);
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, p.outer, a0, a1);
            ctx.arc(this.cx, this.cy, p.inner, a1, a0, true);
            ctx.closePath();
            const g = ctx.createRadialGradient(this.cx, this.cy, p.inner, this.cx, this.cy, p.outer);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(.38, p.color);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.shadowColor = p.edgeColor || 'rgba(255,255,255,.9)';
            ctx.shadowBlur = p.shadow || 16;
            ctx.fill();
            ctx.strokeStyle = p.edgeColor || 'rgba(255,255,255,.92)';
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'hypnoSpiral': {
            const clipR = 76;
            const pulse = .75 + Math.sin(p.age * 2.8) * .18;
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, clipR, 0, Math.PI * 2);
            ctx.clip();
            const drawSpiral = (baseRot, color, phaseShift=0) => {
              ctx.beginPath();
              const steps = 88;
              for (let i = 0; i <= steps; i++) {
                const t2 = i / steps;
                const ang = baseRot + phaseShift + t2 * p.turns * Math.PI * 2;
                const r = 8 + t2 * (p.maxR - 8);
                const wobble = Math.sin(t2 * Math.PI * 6 + p.rot * 1.8 + phaseShift) * 2.8;
                const x = this.cx + Math.cos(ang) * (r + wobble);
                const y = this.cy + Math.sin(ang) * (r + wobble);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.strokeStyle = color;
              ctx.lineWidth = (p.width || 1.6) * pulse;
              ctx.shadowColor = color;
              ctx.shadowBlur = p.shadow || 14;
              ctx.stroke();
            };
            ctx.globalAlpha = .88;
            drawSpiral(p.rot, p.color, 0);
            ctx.globalAlpha = .72;
            drawSpiral(-p.rot * 1.08 + Math.sin(p.age * 1.2) * .12, p.color2 || p.color, Math.PI);
            ctx.globalAlpha = .92;
            ctx.fillStyle = 'rgba(255,255,255,.92)';
            ctx.shadowColor = p.color2 || p.color;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, 2.2 + pulse * 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'aetherLoom': {
            ctx.save();
            const drawRingWeave = (baseR, amp, freq, phase, color, alphaMul=1, widthMul=1) => {
              ctx.beginPath();
              const steps = 220;
              for (let i = 0; i <= steps; i++) {
                const u = i / steps;
                const ang = u * Math.PI * 2;
                const r = baseR + Math.sin(ang * freq + phase) * amp + Math.cos(ang * (freq * .5) - phase * .8) * amp * .42;
                const x = this.cx + Math.cos(ang) * r;
                const y = this.cy + Math.sin(ang) * r;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.closePath();
              ctx.globalAlpha = alphaMul;
              ctx.strokeStyle = color;
              ctx.lineWidth = (p.width || 1.9) * widthMul;
              ctx.shadowColor = color;
              ctx.shadowBlur = p.shadow || 16;
              ctx.stroke();
            };
            drawRingWeave(p.baseR + 2, p.amp1 + 1.5, p.freq1, p.phase, p.color, .95, 1.15);
            drawRingWeave(p.baseR + 0.5, p.amp2 + 1, p.freq2, -p.phase * 1.05, p.color2 || p.color, .82, 1);
            drawRingWeave(p.baseR - 1.8, p.amp2 * .76, p.freq2 + .9, p.phase + Math.PI * .5, 'rgba(255,255,255,.72)', .42, .78);
            ctx.restore();
            break;
          }
          case 'mobiusRibbon': {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, 82, 0, Math.PI * 2);
            ctx.clip();
            const drawRibbon = (phaseShift, color, widthMul=1) => {
              ctx.beginPath();
              const steps = 240;
              for (let i = 0; i <= steps; i++) {
                const t3 = (i / steps) * Math.PI * 2;
                const a = t3 + p.rot + phaseShift;
                const radius = p.scale + Math.sin(t3 * 2 + p.rot + phaseShift) * (p.band * .32);
                const x = this.cx + Math.cos(a) * radius;
                const y = this.cy + Math.sin(a) * (p.scale * .62) + Math.cos(t3 * 2 + phaseShift) * (p.band * .52);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.strokeStyle = color;
              ctx.lineWidth = (p.width || 2.2) * widthMul;
              ctx.shadowColor = color;
              ctx.shadowBlur = p.shadow || 18;
              ctx.stroke();
            };
            ctx.globalAlpha = .92;
            drawRibbon(0, p.color, 1);
            ctx.globalAlpha = .82;
            drawRibbon(Math.PI, p.color2 || p.color, .88);
            ctx.globalAlpha = .42;
            ctx.strokeStyle = 'rgba(255,255,255,.78)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, 12 + Math.sin(p.age * 2.4) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'rosePulse': {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, 80, 0, Math.PI * 2);
            ctx.clip();
            const drawRose = (k, radius, rot, color, alphaMul=1, widthMul=1) => {
              ctx.beginPath();
              const steps = 260;
              for (let i = 0; i <= steps; i++) {
                const ang = (i / steps) * Math.PI * 2;
                const r = radius * Math.cos(k * ang + rot);
                const x = this.cx + Math.cos(ang) * r;
                const y = this.cy + Math.sin(ang) * r;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.globalAlpha = alphaMul;
              ctx.strokeStyle = color;
              ctx.lineWidth = (p.width || 1.8) * widthMul;
              ctx.shadowColor = color;
              ctx.shadowBlur = p.shadow || 16;
              ctx.stroke();
            };
            drawRose(Math.round(p.petals), p.radius, p.rot, p.color, .86, 1);
            drawRose(Math.round(p.petals)+1, p.radius * .72, -p.rot * 1.2, p.color2 || p.color, .66, .86);
            ctx.restore();
            break;
          }
          case 'constellation': {
            const fade = Math.sin(Math.min(1, t) * Math.PI);
            ctx.save();
            ctx.globalAlpha = alpha * (.18 + fade * .82);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            p.edges.forEach(([a,b]) => {
              const p0 = p.points[a], p1 = p.points[b];
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
            });
            ctx.fillStyle = p.nodeColor || 'rgba(255,255,255,.98)';
            ctx.shadowColor = p.nodeColor || 'rgba(255,255,255,.98)';
            ctx.shadowBlur = 10;
            p.points.forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.restore();
            break;
          }
          case 'webSwarm': {
            const nodes = p.nodes || [];
            ctx.save();
            ctx.globalAlpha = .94;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 12;
            // fill triangles when all three nodes are close enough
            for (let i = 0; i < nodes.length; i++) {
              for (let j = i + 1; j < nodes.length; j++) {
                for (let k = j + 1; k < nodes.length; k++) {
                  const a = nodes[i], b = nodes[j], c = nodes[k];
                  const d1 = Math.hypot(a.x-b.x, a.y-b.y);
                  const d2 = Math.hypot(a.x-c.x, a.y-c.y);
                  const d3 = Math.hypot(b.x-c.x, b.y-c.y);
                  if (d1 < p.connectDist && d2 < p.connectDist && d3 < p.connectDist) {
                    ctx.globalAlpha = .10;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.closePath();
                    ctx.fill();
                    ctx.globalAlpha = .88;
                    ctx.strokeStyle = p.color;
                    ctx.beginPath();
                    ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.closePath();
                    ctx.stroke();
                  }
                }
              }
            }
            ctx.globalAlpha = .96;
            ctx.fillStyle = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowColor = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowBlur = 9;
            nodes.forEach(n => { ctx.beginPath(); ctx.arc(n.x,n.y,2.4,0,Math.PI*2); ctx.fill(); });
            ctx.restore();
            break;
          }
          case 'relayMesh': {
            const nodes = p.nodes || [];
            ctx.save();
            ctx.globalAlpha = .9;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.1;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 10;
            const edges = [];
            for (let i = 0; i < nodes.length; i++) {
              for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const d = Math.hypot(a.x-b.x, a.y-b.y);
                if (d < p.connectDist) {
                  edges.push([i,j,d]);
                  ctx.globalAlpha = .22;
                  ctx.beginPath();
                  ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
                }
              }
            }
            ctx.globalAlpha = .92;
            ctx.fillStyle = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowColor = p.nodeColor || 'rgba(255,255,255,.96)';
            nodes.forEach(n => { ctx.beginPath(); ctx.arc(n.x,n.y,2.1,0,Math.PI*2); ctx.fill(); });
            if (edges.length) {
              const edge = edges[p.pulseEdge % edges.length];
              const a = nodes[edge[0]], b = nodes[edge[1]];
              const tt = p.pulseT || 0;
              const x = a.x + (b.x - a.x) * tt;
              const y = a.y + (b.y - a.y) * tt;
              ctx.globalAlpha = .95;
              ctx.fillStyle = 'rgba(255,255,255,.98)';
              ctx.shadowColor = p.color;
              ctx.shadowBlur = 14;
              ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
            break;
          }
          case 'fractureBloom': {
            const fade = Math.sin(Math.min(1, t) * Math.PI);
            ctx.save();
            ctx.globalAlpha = alpha * (.16 + fade * .84);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            (p.branches || []).forEach(branch => {
              if (!branch.length) return;
              ctx.beginPath();
              ctx.moveTo(branch[0].x, branch[0].y);
              for (let i = 1; i < branch.length; i++) ctx.lineTo(branch[i].x, branch[i].y);
              ctx.stroke();
            });
            ctx.fillStyle = p.coreColor || 'rgba(255,255,255,.96)';
            ctx.shadowColor = p.coreColor || 'rgba(255,255,255,.96)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(p.origin.x, p.origin.y, 3.1 + fade * 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'triNet': {
            const pulse = .78 + Math.sin(p.age * 3.2 * p.pulse) * .14;
            const pts = p.points.map(pt => {
              const a = pt.a + (p.rot || 0);
              return {
                x: this.cx + Math.cos(a) * pt.r,
                y: this.cy + Math.sin(a) * pt.r
              };
            });
            ctx.save();
            ctx.globalAlpha = alpha * .92;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = (p.width || 1.6) * pulse;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
            ctx.lineTo(pts[2].x, pts[2].y);
            ctx.closePath();
            ctx.stroke();
            ctx.globalAlpha *= .08;
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.globalAlpha = alpha * .96;
            ctx.fillStyle = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowColor = p.nodeColor || 'rgba(255,255,255,.96)';
            ctx.shadowBlur = 10;
            pts.forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 2.4 + Math.sin(p.age * 4.2) * .35, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.restore();
            break;
          }
          case 'waveSlice': {
            ctx.save();
            ctx.globalAlpha = alpha * .9;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 2.2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, p.r, p.ang - p.arc, p.ang + p.arc);
            ctx.stroke();
            ctx.globalAlpha *= .26;
            ctx.lineWidth = Math.max(1, (p.width || 2.2) * .48);
            ctx.strokeStyle = 'rgba(255,255,255,.75)';
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, p.r + 2, p.ang - p.arc * .76, p.ang + p.arc * .76);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'orbitGlyph': {
            const rr = p.r + Math.sin(p.phase + p.age * 2.2) * p.wobble;
            const x = this.cx + Math.cos(p.ang) * rr;
            const y = this.cy + Math.sin(p.ang) * rr * .86;
            ctx.save();
            ctx.globalAlpha = alpha * .9;
            ctx.font = `${p.size}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 16;
            ctx.fillText(p.char, x, y);
            ctx.globalAlpha *= .22;
            ctx.fillText(p.char, x - Math.cos(p.ang) * 8, y - Math.sin(p.ang) * 6);
            ctx.restore();
            break;
          }
          case 'hexCell': {
            const pulse = .75 + Math.sin(p.age * 4.5) * .18 + Math.sin(t * Math.PI) * .15;
            const s = p.size * pulse;
            ctx.save();
            ctx.globalAlpha = alpha * .88;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 14;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = Math.PI / 3 * i;
              const px = Math.cos(a) * s;
              const py = Math.sin(a) * s;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.globalAlpha *= .18;
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'ribbon': {
            ctx.save();
            ctx.globalAlpha = alpha * .82;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 5;
            ctx.lineCap = 'round';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 16;
            ctx.beginPath();
            const steps = 24;
            for (let i = 0; i <= steps; i++) {
              const tt = i / steps;
              const a = p.ang + (tt - .5) * p.arc;
              const rr = p.r + Math.sin(tt * Math.PI * 2 + p.phase + p.age * 2.2) * p.amp;
              const x = this.cx + Math.cos(a) * rr;
              const y = this.cy + Math.sin(a) * rr * .86;
              if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            }
            ctx.stroke();
            ctx.globalAlpha *= .32;
            ctx.lineWidth = Math.max(1.4, (p.width || 5) * .38);
            ctx.strokeStyle = 'rgba(255,255,255,.85)';
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'smoke': {
            ctx.save();
            ctx.globalAlpha = alpha * .48;
            const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
            g.addColorStop(0,p.color);
            g.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'comet': {
            const x = Number.isFinite(p.x) ? p.x : this.cx;
            const y = Number.isFinite(p.y) ? p.y : this.cy;
            const px = Number.isFinite(p.px) ? p.px : x - (p.vx || 80) * 0.08;
            const py = Number.isFinite(p.py) ? p.py : y - (p.vy || 60) * 0.08;
            const dx = x - px;
            const dy = y - py;
            const len = Math.max(34, Math.min(110, Math.hypot(dx, dy) * 6.0));
            const angle = Math.atan2(dy || 1, dx || 1);
            const tx = x - Math.cos(angle) * len;
            const ty = y - Math.sin(angle) * len;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.trail || 'rgba(125,211,252,.36)';
            ctx.lineWidth = Math.max(2, (p.size || 5) * .78);
            ctx.lineCap = 'round';
            ctx.shadowColor = p.color || '#ffffff';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.fillStyle = p.color || '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, Math.max(2, p.size || 5), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'rain': {
            ctx.save();
            ctx.globalAlpha = (p.alpha || .8) * alpha;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 1.5;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(p.x,p.y);
            ctx.lineTo(p.x-2,p.y+p.len);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'snow': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color || 'rgba(241,245,249,.95)';
            ctx.shadowColor = p.color || 'rgba(191,219,254,.8)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'leaf': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x,p.y);
            ctx.rotate(p.rot || 0);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(0,0,p.size*.8,p.size*.45,0,0,Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(20,83,45,.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-p.size*.5,0);
            ctx.lineTo(p.size*.5,0);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'shard': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x,p.y);
            ctx.rotate(p.rot || 0);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.shadow || 10;
            ctx.beginPath();
            ctx.moveTo(0,-p.size);
            ctx.lineTo(p.size*.65,0);
            ctx.lineTo(0,p.size);
            ctx.lineTo(-p.size*.65,0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'blood': {
            const fadeIn = Math.min(1, t / (p.fadeIn || 0.22));
            const localAlpha = alpha * fadeIn;
            const s = p.size;
            ctx.save();
            ctx.globalAlpha = localAlpha;
            ctx.translate(p.x, p.y);
            ctx.scale(1, 1 + t * .45);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.15);
            ctx.bezierCurveTo(s * .85, -s * .25, s * .75, s * .85, 0, s * 1.35);
            ctx.bezierCurveTo(-s * .75, s * .85, -s * .85, -s * .25, 0, -s * 1.15);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'candle': {
            const fadeIn = Math.min(1, t / (p.fadeIn || 0.25));
            const localAlpha = alpha * fadeIn;
            const flicker = 0.82 + Math.sin((p.age || 0) * 18 + p.x) * 0.18;
            ctx.save();
            ctx.globalAlpha = localAlpha;
            ctx.fillStyle='rgba(226,232,240,.82)';
            ctx.fillRect(p.x-2.4,p.y-5.5,4.8,11);
            ctx.fillStyle='rgba(148,163,184,.45)';
            ctx.fillRect(p.x-2.4,p.y+3.5,4.8,2);
            ctx.beginPath();
            ctx.fillStyle=`rgba(254,240,138,${0.82 * flicker})`;
            ctx.shadowColor='rgba(254,240,138,.95)';
            ctx.shadowBlur=12 * flicker;
            ctx.ellipse(p.x,p.y-8,3.1*flicker,5.4*flicker,0,0,Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle=`rgba(251,146,60,${0.55 * flicker})`;
            ctx.ellipse(p.x,p.y-7.3,1.5*flicker,3.2*flicker,0,0,Math.PI*2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'feather': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.quadraticCurveTo(p.size*.58, -p.size*.18, 0, p.size);
            ctx.quadraticCurveTo(-p.size*.36, 0, 0, -p.size);
            ctx.fill();
            ctx.strokeStyle = 'rgba(226,232,240,.28)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -p.size*.92);
            ctx.lineTo(0, p.size*.92);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'lantern': {
            const x = this.cx + Math.cos(p.ang) * p.r;
            const y = this.cy + Math.sin(p.ang) * p.r;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color || 'rgba(196,181,253,.9)';
            ctx.shadowColor = p.color || 'rgba(196,181,253,.9)';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(x, y, p.size || 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }
          case 'ringPulse': {
            const r = p.r0 + p.growth * t;
            ctx.save();
            ctx.globalAlpha = alpha * .55;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2.2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, r, p.startAng, p.startAng + p.sweep);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'arc': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.lineWidth = p.width || 2;
            ctx.strokeStyle = p.color1;
            ctx.shadowColor = p.color2 || p.color1;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(p.start.x, p.start.y);
            ctx.quadraticCurveTo(p.ctrl.x, p.ctrl.y, p.end.x, p.end.y);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'bolt': {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.core;
            ctx.lineWidth = p.width || 2;
            ctx.shadowColor = p.core;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            p.points.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,.82)';
            ctx.lineWidth = Math.max(1, (p.width || 2) * .45);
            ctx.beginPath();
            p.points.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'glitchRect': {
            const fadeIn = Math.min(1, t / .15);
            const jitter = (Math.random() - .5) * 2.4;
            const w = Math.max(2, p.w || 12);
            const h = Math.max(1, p.h || 3);
            ctx.save();
            if (p.clipAvatar) {
              ctx.beginPath();
              ctx.arc(this.cx, this.cy, 76, 0, Math.PI * 2);
              ctx.clip();
            }
            ctx.globalAlpha = alpha * fadeIn;
            ctx.fillStyle = p.color || 'rgba(34,211,238,.8)';
            ctx.shadowColor = p.color || 'rgba(34,211,238,.8)';
            ctx.shadowBlur = 7;
            ctx.fillRect((p.x || this.cx) + jitter, p.y || this.cy, w, h);
            if (Math.random() < .26) {
              ctx.globalAlpha *= .48;
              ctx.fillRect((p.x || this.cx) - jitter * 2, (p.y || this.cy) + h + 3, w * .48, Math.max(1, h * .5));
            }
            ctx.restore();
            break;
          }
          case 'laserLine': {
            const fadeIn = Math.min(1, t / .12);
            ctx.save();
            ctx.globalAlpha = alpha * fadeIn;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width || 2.2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            if (p.horizontal) {
              ctx.moveTo(12, p.pos + (p.offset || 0));
              ctx.lineTo(this.w - 12, p.pos - (p.offset || 0));
            } else {
              ctx.moveTo(p.pos + (p.offset || 0), 12);
              ctx.lineTo(p.pos - (p.offset || 0), this.h - 12);
            }
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'streak': {
            const x1 = this.cx + Math.cos(p.angle) * p.r;
            const y1 = this.cy + Math.sin(p.angle) * p.r;
            const x0 = this.cx + Math.cos(p.angle) * Math.max(0, p.r - p.len);
            const y0 = this.cy + Math.sin(p.angle) * Math.max(0, p.r - p.len);
            ctx.save();
            ctx.globalAlpha = alpha;
            const grad = ctx.createLinearGradient(x0,y0,x1,y1);
            grad.addColorStop(0,'rgba(255,255,255,0)');
            grad.addColorStop(.35,p.color);
            grad.addColorStop(1,'rgba(255,255,255,.98)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = p.width || 2;
            ctx.lineCap = 'round';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(x0,y0);
            ctx.lineTo(x1,y1);
            ctx.stroke();
            ctx.restore();
            break;
          }
        }
      }

      drawPause(){
        const ctx=this.ctx;
        ctx.save();
        ctx.fillStyle='rgba(2,6,23,.34)';
        ctx.fillRect(0,0,this.w,this.h);
        ctx.fillStyle='rgba(255,255,255,.85)';
        ctx.font='600 14px Inter, sans-serif';
        ctx.textAlign='center';
        ctx.fillText('Пауза', this.cx, this.cy);
        ctx.restore();
      }
    }

const activeCanvasEffects = new Map();
let activeCanvasEffectsRaf = 0;
let activeCanvasResizeBound = false;

function isCanvasManagedEffectId(id) { return CANVAS_EFFECT_IDS.has(String(id || '')); }
function activationWrapperForEffectTarget(el) {
  return el?.closest?.('.fx-avatar-shell, .effect-choice-preview, .avatar-shell, .frame-demo.effect-demo') || el;
}
function desiredCanvasEffectState(el) {
  if (!el) return false;
  const wrapper = activationWrapperForEffectTarget(el);
  const inPreviewModal = !!(el.closest?.('.cosmetic-preview-modal') || wrapper?.closest?.('.cosmetic-preview-modal'));
  const forced = !!(el.classList?.contains('effect-force-active') || wrapper?.classList?.contains('effect-force-active'));
  if (inPreviewModal || forced) return true;
  // Applied character effects are rendered by avatarCircle() as fx-avatar-shell
  // without the fx-preview-shell marker. These must stay alive everywhere: shop
  // header/settings preview, party, combat, public/profile windows, etc.
  if (el.classList?.contains('avatar') && el.classList.contains('cosmetic-effect')) return true;
  if (el.classList?.contains('fx-avatar-shell') && !el.classList?.contains('fx-preview-shell')) return true;
  // Static effect cards may wake on hover/focus, but they do not run permanently.
  if (wrapper?.closest?.('.frame-choice') && !inPreviewModal) return false;
  try {
    return !!(wrapper?.matches?.(':hover') || el?.matches?.(':hover'));
  } catch(_) {
    return false;
  }
}
function bindCanvasHostWake(wrapper) {
  if (!wrapper || wrapper.dataset.effectCanvasWakeBound === '1') return;
  wrapper.dataset.effectCanvasWakeBound = '1';
  const wake = () => scheduleCanvasEffectsFrame();
  ['pointerenter','pointermove','pointerleave','touchstart','click','focusin','focusout'].forEach(evt => wrapper.addEventListener(evt, wake, {passive:true}));
}
function ensureCanvasEffectHost(el) {
  if (!el || !el.isConnected) return null;
  const effectId = String(el.dataset.effectId || '');
  const type = canvasEffectTypeForId(effectId);
  if (!type) return null;
  let rec = activeCanvasEffects.get(el);
  if (!rec) {
    const canvas = document.createElement('canvas');
    canvas.className = 'effect-engine-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    rec = {el, canvas, engine:new EffectEngine(canvas, type), type};
    activeCanvasEffects.set(el, rec);
  } else if (rec.type !== type) {
    rec.type = type;
    rec.engine = new EffectEngine(rec.canvas, type);
  }
  el.dataset.effectRender = 'canvas';
  el.classList.add('effect-canvas-host');
  const wrapper = activationWrapperForEffectTarget(el);
  bindCanvasHostWake(wrapper);
  sizeCanvasEffectHost(rec);
  return rec;
}
function effectAnchorMetrics(el) {
  if (!el || !el.isConnected) return {base:24, x:0, y:0};
  const rectOf = (node) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect?.();
    if (!rect) return null;
    const width = Math.max(rect.width || 0, node.offsetWidth || 0);
    const height = Math.max(rect.height || 0, node.offsetHeight || 0);
    if (!width && !height) return null;
    return {left:rect.left || 0, top:rect.top || 0, width, height};
  };
  const centerOffset = (anchor, host) => {
    if (!anchor || !host) return {x:0, y:0};
    return {
      x: (anchor.left + anchor.width / 2) - (host.left + host.width / 2),
      y: (anchor.top + anchor.height / 2) - (host.top + host.height / 2),
    };
  };
  const metricsFrom = (anchorNode, hostNode, minBase=24) => {
    const anchor = rectOf(anchorNode);
    const host = rectOf(hostNode || anchorNode);
    const offset = centerOffset(anchor, host);
    return {base:Math.max(anchor?.width || 0, anchor?.height || 0, minBase), x:offset.x || 0, y:offset.y || 0};
  };
  if (el.classList?.contains('fx-avatar-shell')) {
    const direct = Array.from(el.children || []);
    const avatarShell = direct.find(node => node.classList?.contains('avatar-shell'));
    const directAvatar = direct.find(node => node.classList?.contains('avatar'));
    const avatar = directAvatar || avatarShell?.querySelector('.avatar');
    const frame = avatarShell?.querySelector('.avatar-shell-frame');
    // If an uploaded/image frame exists, align and scale the effect to that frame's
    // actual displayed circle. Otherwise the avatar border is the frame radius.
    return metricsFrom(frame || avatar || el, el, 24);
  }
  if (el.classList?.contains('effect-preview-layer')) {
    const sample = el.closest('.effect-choice-preview')?.querySelector('.frame-demo.plain, .effect-avatar-sample');
    return metricsFrom(sample || el, el, 32);
  }
  if (el.classList?.contains('frame-demo') && el.classList.contains('effect-demo')) {
    return metricsFrom(el, el, 40);
  }
  if (el.classList?.contains('avatar')) {
    return metricsFrom(el, el, 24);
  }
  const shell = el.closest?.('.avatar-shell');
  if (shell) return metricsFrom(shell.querySelector('.avatar-shell-frame') || shell.querySelector('.avatar') || shell, shell, 24);
  return metricsFrom(el, el, 24);
}
function effectAnchorBaseSize(el) {
  return effectAnchorMetrics(el).base;
}
function applyCanvasEffectGeometry(rec, size, base, x=0, y=0) {
  const safeSize = Math.round(Math.max(1, Number(size) || 1));
  const safeBase = Math.round(Math.max(1, Number(base) || 1));
  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  rec.canvas.dataset.effectAnchorBase = String(safeBase);
  rec.el.style.setProperty('--effect-canvas-size', `${safeSize}px`);
  rec.el.style.setProperty('--effect-center-x', `${safeX.toFixed(2)}px`);
  rec.el.style.setProperty('--effect-center-y', `${safeY.toFixed(2)}px`);
  rec.canvas.style.setProperty('--effect-canvas-size', `${safeSize}px`);
  rec.canvas.style.setProperty('--effect-center-x', `${safeX.toFixed(2)}px`);
  rec.canvas.style.setProperty('--effect-center-y', `${safeY.toFixed(2)}px`);
  rec.canvas.style.width = `${safeSize}px`;
  rec.canvas.style.height = `${safeSize}px`;
  rec.canvas.style.left = `calc(50% + ${safeX.toFixed(2)}px)`;
  rec.canvas.style.top = `calc(50% + ${safeY.toFixed(2)}px)`;
  rec.canvas.style.transform = 'translate(-50%, -50%)';
  rec.engine.resize();
}
function sizeCanvasEffectHost(rec) {
  if (!rec?.el?.isConnected) return;
  const metrics = effectAnchorMetrics(rec.el);
  const base = metrics.base;
  if (rec.el.classList?.contains('fx-avatar-shell')) {
    // The canvas is centered on the visible frame, not merely on the avatar box.
    // This keeps particles/rings on the frame radius for every avatar size and for
    // uploaded frames with their own scale/offset.
    const style = getComputedStyle(rec.el);
    const rawPad = Number(style.getPropertyValue('--fx-canvas-scale') || 3.10);
    const padScale = Math.max(2.60, Math.min(4.10, Number.isFinite(rawPad) ? rawPad : 3.10));
    const fitBaseRaw = Number(style.getPropertyValue('--fx-effect-fit-base') || 140);
    const fitBase = Math.max(120, Math.min(160, Number.isFinite(fitBaseRaw) ? fitBaseRaw : 140));
    rec.canvas.dataset.effectFitBase = String(fitBase);
    const size = Math.round(Math.max(72, base * padScale));
    applyCanvasEffectGeometry(rec, size, base, metrics.x, metrics.y);
    return;
  }
  const wrapper = activationWrapperForEffectTarget(rec.el);
  const css = getComputedStyle(rec.el);
  const wrapperCss = wrapper && wrapper !== rec.el ? getComputedStyle(wrapper) : null;
  const rawScale = Number(css.getPropertyValue('--effect-canvas-scale') || wrapperCss?.getPropertyValue('--effect-canvas-scale') || 2.40);
  const hostScale = Math.max(1.90, Math.min(3.30, Number.isFinite(rawScale) ? rawScale : 2.40));
  const fitBaseRaw = Number(css.getPropertyValue('--effect-fit-base') || wrapperCss?.getPropertyValue('--effect-fit-base') || 140);
  const fitBase = Math.max(120, Math.min(160, Number.isFinite(fitBaseRaw) ? fitBaseRaw : 140));
  rec.canvas.dataset.effectFitBase = String(fitBase);
  const size = Math.round(Math.max(64, base * hostScale));
  applyCanvasEffectGeometry(rec, size, base, metrics.x, metrics.y);
}
function pruneCanvasEffects() {
  for (const [el, rec] of [...activeCanvasEffects.entries()]) {
    if (!el.isConnected) {
      try { rec.engine.setActive(false); } catch(_) {}
      try { rec.canvas.remove(); } catch(_) {}
      activeCanvasEffects.delete(el);
    }
  }
}
function scheduleCanvasEffectsFrame() {
  if (!activeCanvasEffectsRaf) activeCanvasEffectsRaf = requestAnimationFrame(runCanvasEffectsFrame);
}
function runCanvasEffectsFrame(now) {
  activeCanvasEffectsRaf = 0;
  pruneCanvasEffects();
  let keepAlive = false;
  for (const rec of activeCanvasEffects.values()) {
    if (!rec.el.isConnected) continue;
    const shouldBeActive = desiredCanvasEffectState(rec.el);
    if (!!rec.engine.active !== shouldBeActive) rec.engine.setActive(shouldBeActive);
    if (shouldBeActive || rec.engine.active || (rec.engine.particles && rec.engine.particles.length)) {
      try { rec.engine.update(now); } catch(_) {}
      if (shouldBeActive || (rec.engine.particles && rec.engine.particles.length)) keepAlive = true;
    }
  }
  if (keepAlive) scheduleCanvasEffectsFrame();
}
function upgradeLegacyEffectAvatars() {
  document.querySelectorAll('.avatar.cosmetic-effect[data-effect-id]').forEach(avatar => {
    if (!avatar || !avatar.isConnected || avatar.closest('.fx-avatar-shell')) return;
    const effectId = String(avatar.dataset.effectId || '');
    if (!isCanvasManagedEffectId(effectId)) return;
    const cls = effectClassFor(effectId);
    const size = ['xs','sm','md','lg','xl','xxl'].find(s => avatar.classList.contains(s)) || 'md';
    const frameShell = avatar.closest('.avatar-shell');
    const node = frameShell && !frameShell.closest('.fx-avatar-shell') ? frameShell : avatar;
    const computed = getComputedStyle(avatar);
    const color = computed.getPropertyValue('--char-color') || avatar.style.getPropertyValue('--char-color') || '#72a7ff';
    avatar.classList.remove('cosmetic-effect');
    if (cls) avatar.classList.remove(cls);
    avatar.removeAttribute('data-effect-id');

    const shell = document.createElement('span');
    shell.className = `fx-avatar-shell ${size} ${cls}`;
    shell.dataset.effectId = effectId;
    shell.style.setProperty('--char-color', color.trim() || '#72a7ff');

    node.parentNode.insertBefore(shell, node);
    shell.appendChild(node);
  });
}

function setupCanvasEffects() {
  upgradeLegacyEffectAvatars();
  document.querySelectorAll('.fx-avatar-shell[data-effect-id], .avatar.cosmetic-effect[data-effect-id], .effect-preview-layer[data-effect-id], .frame-demo.effect-demo[data-effect-id]').forEach(el => {
    if (isCanvasManagedEffectId(el.dataset.effectId)) ensureCanvasEffectHost(el);
  });
  pruneCanvasEffects();
  if (!activeCanvasResizeBound) {
    activeCanvasResizeBound = true;
    window.addEventListener('resize', () => {
      for (const rec of activeCanvasEffects.values()) sizeCanvasEffectHost(rec);
      scheduleCanvasEffectsFrame();
    }, {passive:true});
  }
}
function rarityRu(r) { return {common:'обычная', rare:'редкая', epic:'эпическая', legendary:'легендарная', unique:'уникальная'}[r] || (r || '—'); }
function rarityEmoji(r) { return {common:'▫️', rare:'🔹', epic:'💜', legendary:'🌟', unique:'💎'}[r] || '•'; }
function displayRarity(item) { return item?.asset_path ? 'unique' : (item?.rarity || 'common'); }

function normalizeHexColor(value) {
  const text = String(value || '#72a7ff').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : '#72a7ff';
}

function randomCharacterColor() {
  return CHARACTER_COLORS[Math.floor(Math.random() * CHARACTER_COLORS.length)] || '#72a7ff';
}

function isMaxCharacter(ch) { return false; }

function esc(v) {
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function authHeaders() {
  const headers = {'Content-Type': 'application/json'};
  const devViewCharacterId = localStorage.getItem('dev_view_character_id') || '';
  if (devViewCharacterId) headers['X-Dev-View-Character-Id'] = devViewCharacterId;
  const initData = tg?.initData || '';
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  else {
    let dev = localStorage.getItem('dev_tg_id');
    if (!dev) {
      dev = prompt('Dev-режим: введи свой Telegram ID. В Telegram Mini App это окно не появится.') || '';
      if (dev) localStorage.setItem('dev_tg_id', dev);
    }
    if (dev) headers['X-Dev-Telegram-Id'] = dev;
  }
  return headers;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: authHeaders(),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok) throw new Error(data.detail || data.message || `Ошибка ${res.status}`);
  return data;
}

function authUploadHeaders() {
  const headers = authHeaders();
  delete headers['Content-Type'];
  return headers;
}

async function apiUpload(path, fileInputId) {
  const input = document.getElementById(fileInputId);
  const file = input?.files?.[0];
  if (!file) throw new Error('Выбери файл изображения');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(path, {method: 'POST', headers: authUploadHeaders(), body: form});
  let data = null;
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok) throw new Error(data.detail || data.message || `Ошибка ${res.status}`);
  return data;
}

async function apiUploadForm(path, fileInputId, fields={}) {
  const input = document.getElementById(fileInputId);
  const file = input?.files?.[0];
  if (!file) throw new Error('Выбери файл изображения');
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v == null ? '' : String(v));
  const res = await fetch(path, {method: 'POST', headers: authUploadHeaders(), body: form});
  let data = null;
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok) throw new Error(data.detail || data.message || `Ошибка ${res.status}`);
  return data;
}

function sectionAttrs(key) {
  const safe = esc(key);
  return `data-section-key="${safe}" ${state.openSections.has(key) ? 'open' : ''}`;
}

function rememberOpenSections() {
  document.querySelectorAll('details[data-section-key]').forEach(d => {
    const key = d.dataset.sectionKey;
    if (!key) return;
    if (d.open) state.openSections.add(key); else state.openSections.delete(key);
  });
  localStorage.setItem('open_sections', JSON.stringify([...state.openSections]));
}


function getEffectActivationTarget(el) {
  if (!el) return null;
  if (el.classList?.contains('fx-avatar-shell')) return el;
  if (el.classList?.contains('effect-preview-layer')) return el;
  if (el.classList?.contains('frame-demo') && el.classList.contains('effect-demo')) return el;
  if (el.classList?.contains('effect-choice-preview')) return el.querySelector('.fx-avatar-shell, .effect-preview-layer');
  if (el.classList?.contains('avatar') && el.classList.contains('cosmetic-effect')) return el;
  if (el.classList?.contains('avatar-shell')) return el.closest('.fx-avatar-shell') || el.querySelector('.avatar.cosmetic-effect');
  return el.querySelector?.('.fx-avatar-shell, .avatar.cosmetic-effect, .effect-preview-layer, .frame-demo.effect-demo') || null;
}

function toggleEffectActivation(el) {
  const target = getEffectActivationTarget(el);
  if (!target) return;
  const wasActive = target.classList.contains('effect-force-active');
  document.querySelectorAll('.effect-force-active').forEach(x => { if (x !== target) x.classList.remove('effect-force-active'); });
  target.classList.toggle('effect-force-active', !wasActive);
  scheduleCanvasEffectsFrame();
}

function bindEffectActivation() {
  document.querySelectorAll('.fx-avatar-shell, .avatar.cosmetic-effect, .avatar-shell, .effect-choice-preview, .frame-demo.effect-demo').forEach(el => {
    if (el.dataset.effectActivationBound === '1') return;
    if (!getEffectActivationTarget(el)) return;
    el.dataset.effectActivationBound = '1';
    const wakePreview = () => scheduleCanvasEffectsFrame();
    ['pointerenter','pointermove','touchstart','focusin'].forEach(evt => el.addEventListener(evt, wakePreview, {passive:true}));
  });
}

function bindAfterRender() {
  document.querySelectorAll('details[data-section-key]').forEach(d => {
    d.addEventListener('toggle', () => {
      const key = d.dataset.sectionKey;
      if (!key) return;
      if (d.open) state.openSections.add(key); else state.openSections.delete(key);
      localStorage.setItem('open_sections', JSON.stringify([...state.openSections]));
    });
  });
  document.querySelectorAll('input[type="number"]').forEach(el => {
    el.addEventListener('focus', () => {
      if (el.dataset.clearedOnce !== '1') {
        el.value = '';
        el.dataset.clearedOnce = '1';
      }
    });
  });

  bindEffectActivation();
  setupCanvasEffects();
  scheduleCanvasEffectsFrame();
  setTimeout(() => { setupCanvasEffects(); for (const rec of activeCanvasEffects.values()) sizeCanvasEffectHost(rec); scheduleCanvasEffectsFrame(); }, 80);
  setTimeout(() => { setupCanvasEffects(); for (const rec of activeCanvasEffects.values()) sizeCanvasEffectHost(rec); scheduleCanvasEffectsFrame(); }, 320);
}
function app(html) { document.getElementById('app').innerHTML = html; bindAfterRender(); }
function rememberUiScroll(){
  rememberOpenSections();
  const el=document.getElementById('initiativeCarousel');
  if(el) state.initiativeCarouselScroll = el.scrollLeft || 0;
  const nav=document.querySelector('.bottom-nav');
  if(nav) {
    state.bottomNavScroll = nav.scrollLeft || 0;
    localStorage.setItem('bottom_nav_scroll', String(state.bottomNavScroll));
  }
}
function restoreUiScroll(){ setTimeout(()=>{
  const el=document.getElementById('initiativeCarousel');
  if(el && Number.isFinite(state.initiativeCarouselScroll)) el.scrollLeft = state.initiativeCarouselScroll;
  const nav=document.querySelector('.bottom-nav');
  if(nav) {
    const wideNav = window.matchMedia && window.matchMedia('(min-width: 561px)').matches;
    nav.scrollLeft = wideNav ? 0 : (Number.isFinite(state.bottomNavScroll) ? state.bottomNavScroll : 0);
    nav.addEventListener('scroll', () => { state.bottomNavScroll = nav.scrollLeft || 0; localStorage.setItem('bottom_nav_scroll', String(state.bottomNavScroll)); }, {passive:true});
  }
}, 0); }
function msg(text, type='success') { return `<div class="${type}">${esc(text)}</div>`; }
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
function num(id, fallback=0) { const v = val(id); return v === '' ? fallback : Number(v); }
function checked(id) { return !!document.getElementById(id)?.checked; }

function showToast(text, kind='info') {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `app-toast ${kind}`;
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.classList.add('show'), 20);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3100);
}

function showModalNotice(text, kind='error') {
  showToast(text, kind);
}

function setupPullToRefresh() {
  // Отключено: в Telegram Mini App жест часто конфликтует со скроллом вкладок.
  const ind = document.getElementById('pullIndicator');
  if (ind) ind.remove();
}

async function init() {
  try {
    state.me = await api('/api/me');
    if (!state.currentCampaignId && state.me.campaigns.length) state.currentCampaignId = state.me.campaigns[0].id;
    await render();
    startAutoRefresh();
    setupPullToRefresh();
  } catch (e) {
    app(`<div class="card"><div class="title">Ошибка входа</div>${msg(e.message, 'error')}<p class="muted">Если запускаешь не внутри Telegram, включи DEV_MODE=1 и введи Telegram ID.</p><button onclick="resetDev()">Сбросить dev ID</button></div>`);
  }
}

function resetDev() { localStorage.removeItem('dev_tg_id'); location.reload(); }

function startAutoRefresh() {
  if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
  state.autoRefreshTimer = setInterval(silentRefresh, 3500);
}

function userIsEditing() {
  const a = document.activeElement;
  return !!(a && ['INPUT','TEXTAREA','SELECT'].includes(a.tagName));
}

async function silentRefresh() {
  if (!state.currentCampaignId || !state.campaignState) return;
  if (state.firingAnimation) return;
  if (document.getElementById('modal') || userIsEditing()) return;
  try {
    const fresh = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    const newId = Number(fresh.events?.[0]?.id || 0);
    if (newId !== state.lastEventId) {
      const flashKind = detectPlayerFlash(fresh.events || [], state.lastEventId, fresh);
      const notice = detectPlayerNotice(fresh.events || [], state.lastEventId, fresh);
      state.campaignState = fresh;
      state.lastEventId = newId;
      renderCampaign();
      if (flashKind) triggerScreenFlash(flashKind);
      if (notice) showToast(notice.text, notice.kind);
    }
  } catch (_) {}
}

async function render() {
  if (!state.currentCampaignId) return renderHome();
  try {
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    state.lastEventId = Number(state.campaignState.events?.[0]?.id || 0);
    renderCampaign();
  } catch (_) {
    state.currentCampaignId = 0;
    localStorage.removeItem('campaign_id');
    renderHome();
  }
}

function header(title, subtitle='') {
  const campaigns = state.me?.campaigns || [];
  const options = campaigns.map(c => `<option value="${c.id}" ${c.id===state.currentCampaignId?'selected':''}>${esc(c.name)} — ${c.role === 'master' ? 'мастер' : 'игрок'}</option>`).join('');
  return `<div class="header"><div><div class="title">${esc(title)}</div>${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}</div><div class="row top-actions"><select onchange="switchCampaign(this.value)"><option value="0">Главная</option>${options}</select></div></div>`;
}

async function refreshAll() { state.me = await api('/api/me'); await render(); }
function switchCampaign(id) {
  state.currentCampaignId = Number(id);
  localStorage.removeItem('dev_view_character_id');
  if (state.currentCampaignId) localStorage.setItem('campaign_id', String(state.currentCampaignId)); else localStorage.removeItem('campaign_id');
  state.tab='characters';
  render();
}

function renderHome(extra='') {
  const campaigns = state.me?.campaigns || [];
  const campaignCards = campaigns.length
    ? campaigns.map(c => `<button class="campaign-pick" onclick="switchCampaign(${c.id})"><span class="pick-icon">${c.role === 'master' ? '🎲' : '🧍'}</span><span><b>${esc(c.name)}</b><small>${c.role === 'master' ? 'Панель мастера' : 'Карточка игрока'}</small></span></button>`).join('')
    : '<div class="empty-state">Пока нет кампаний. Создай свою или присоединись по коду.</div>';
  app(`${header('D&D Mini App', `Telegram ID: ${state.me?.user?.id || '—'}`)}${extra}
    <div class="home-hero card">
      <div>
        <div class="hero-kicker">⚔️ Панель кампаний</div>
        <div class="hero-title">Что хочешь сделать?</div>
        <div class="hero-sub"><span class="green">Создать</span> новую игру, <span class="blue">присоединиться</span> по коду или <span class="gold">открыть</span> уже существующую кампанию.</div>
      </div>
    </div>
    <div class="home-accordion">
      <details class="card stack home-section create-card">
        <summary><span>✨</span><b>Создать кампанию</b><small>новая игра мастера</small></summary>
        <div class="stack home-section-body">
          <label>Название</label><input id="newName" placeholder="Например: Тёмные земли">
          <label class="checkline"><input id="newInj" type="checkbox" checked> Модификатор травм</label>
          <label class="checkline"><input id="newArmor" type="checkbox"> Система брони</label>
          <label class="checkline"><input id="newWeapons" type="checkbox"> Система оружия и магазинов</label>
          <button onclick="createCampaign()">Создать игру</button>
        </div>
      </details>
      <details class="card stack home-section join-card">
        <summary><span>🔑</span><b>Присоединиться по коду</b><small>/join через Mini App</small></summary>
        <div class="stack home-section-body">
          <label>Код приглашения</label><input id="joinCode" placeholder="ABC123">
          <button onclick="joinCampaign()">Найти кампанию</button>
          <div id="joinResult"></div>
        </div>
      </details>
      <details class="card stack home-section choose-card">
        <summary><span>📚</span><b>Мои кампании</b><small>быстрый выбор</small></summary>
        <div class="campaign-list home-section-body">${campaignCards}</div>
      </details>
    </div>`);
}

async function createCampaign() {
  try {
    const name = val('newName');
    if (!name) throw new Error('Введите название кампании');
    const out = await api('/api/campaigns', {method:'POST', body:{name, injuries_enabled:checked('newInj'), armor_enabled:checked('newArmor'), weapons_enabled:checked('newWeapons')}});
    state.currentCampaignId = out.campaign.id;
    localStorage.setItem('campaign_id', state.currentCampaignId);
    state.me = await api('/api/me');
    await render();
  } catch(e) { renderHome(msg(e.message, 'error')); }
}

async function joinCampaign(characterId=null) {
  const code = val('joinCode') || localStorage.getItem('last_join_code') || '';
  localStorage.setItem('last_join_code', code);
  try {
    const out = await api('/api/join', {method:'POST', body:{code, character_id:characterId}});
    if (out.need_character) {
      showJoinCharacterModal(out.campaign, out.characters || []);
      return;
    }
    state.me = await api('/api/me');
    state.currentCampaignId = out.campaign.id;
    localStorage.setItem('campaign_id', state.currentCampaignId);
    closeModal();
    await render();
  } catch(e) {
    const box = document.getElementById('joinResult');
    if (box) box.innerHTML = msg(e.message, 'error'); else showModalNotice(e.message, 'error');
  }
}

function showJoinCharacterModal(campaign, characters) {
  const cards = characters.length
    ? characters.map(ch => `<button class="join-character-card" style="--char-color:${esc(ch.color || '#72a7ff')}" onclick="joinCampaign(${ch.id})">${avatarCircle(ch, 'sm')}<span><b>${esc(ch.name)}</b><small>${hpText(ch)}</small></span></button>`).join('')
    : '<div class="empty-state">Свободных персонажей пока нет. Попроси мастера создать персонажа.</div>';
  showModal(`<div class="modal-card join-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">🔑 ${esc(campaign?.name || 'Кампания')}</div><p class="muted">Выбери персонажа, которого хочешь привязать к своему Telegram.</p><div class="join-character-grid">${cards}</div><div class="row modal-actions"><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
}


function navLabel(id, role='player') {
  return ({characters: role === 'master' ? 'Персонажи' : 'Персонаж', party:'Отряд', maps:'Карты', combat:'Бой', requests:'Заявки', generators:'Генераторы', achievements:'Достижения', journal:'Журнал', settings:'Настройки'})[id] || id;
}
function navIcon(id) {
  const icons = {
    characters:'🧙',
    party:'👥',
    maps:'🗺️',
    combat:'⚔️',
    requests:'📨',
    generators:'🎲',
    achievements:'🏆',
    journal:'📜',
    settings:'⚙️'
  };
  return `<span class="nav-emoji" aria-hidden="true">${icons[id] || '•'}</span>`;
}


function renderCampaign() {
  rememberUiScroll();
  const c = state.campaignState.campaign;
  const role = state.campaignState.role;
  const tabs = role === 'master'
    ? ['characters','combat', ...(MAPS_FEATURE_ENABLED ? ['maps'] : []), 'requests','generators','achievements','settings','journal']
    : ['characters','party', ...(MAPS_FEATURE_ENABLED ? ['maps'] : []), 'combat','achievements','settings'];
  if (!tabs.includes(state.tab)) state.tab = 'characters';
  const unreadAchievements = (state.campaignState?.achievement_grants || []).some(g => !g.opened_at);
  const tabHtml = `<nav class="tabs bottom-nav">${tabs.map(id => `<button class="${state.tab===id?'active':''}" title="${esc(navLabel(id, role))}" aria-label="${esc(navLabel(id, role))}" onclick="setTab('${id}')">${navIcon(id)}${id==='achievements' && unreadAchievements ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>`;
  let body = '';
  if (state.tab === 'characters') body = role === 'master' ? renderMasterCharacters() : renderPlayerCharacter();
  if (state.tab === 'combat') body = role === 'master' ? renderMasterCombat() : renderPlayerCombat();
  if (state.tab === 'maps' && MAPS_FEATURE_ENABLED) body = renderMaps();
  if (state.tab === 'requests') body = renderRequests();
  if (state.tab === 'party') body = renderParty();
  if (state.tab === 'settings') body = role === 'master' ? renderMasterSettings() : renderPlayerSettings();
  if (state.tab === 'generators') body = renderGenerators();
  if (state.tab === 'achievements') body = role === 'master' ? renderMasterAchievements() : renderPlayerAchievements();
  if (state.tab === 'journal') body = role === 'master' ? renderJournal() : '<div class="card muted">Журнал доступен только мастеру.</div>';
  app(`<main class="campaign-screen">${body}</main>${tabHtml}`);
  restoreUiScroll();
  if (state.tab === 'achievements') setTimeout(renderCustomTagStyleGrid, 0);
}
function setTab(t) { rememberUiScroll(); if (t === 'maps' && !MAPS_FEATURE_ENABLED) t = 'characters'; state.tab=t; renderCampaign(); }

function showInviteModal() {
  const c = state.campaignState?.campaign;
  if (!c?.invite_code) return alert('Код приглашения не найден');
  showModal(`<div class="modal-card compact invite-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">🔗 Пригласить игрока</div><div class="invite-code-modal" id="inviteCodeText">${esc(c.invite_code)}</div><div class="invite-command">Игроку нужно открыть бота и написать:<br><b>/join ${esc(c.invite_code)}</b></div><div class="row modal-actions"><button class="ok" onclick="copyInviteCode('${esc(c.invite_code)}')">Скопировать код</button><button class="secondary" onclick="closeModal()">Закрыть</button></div></div>`);
}

async function copyInviteCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    alert(`Код скопирован: ${code}`);
  } catch (_) {
    alert(`Код приглашения: ${code}`);
  }
}

function allChars() { return state.campaignState?.characters || []; }
function findChar(id) { return allChars().find(ch => Number(ch.id) === Number(id)); }
function findInjury(charId, injuryId) { return (findChar(charId)?.injuries || []).find(i => Number(i.id) === Number(injuryId)); }
function hpClass(ch) {
  const max = Math.max(1, Number(ch.current_max_hp || 1));
  const r = Number(ch.current_hp || 0) / max;
  if (r >= .7) return 'hp-good';
  if (r >= .35) return 'hp-mid';
  if (r > 0) return 'hp-low';
  return 'hp-zero';
}
function painClass(p) { p=Number(p||0); if(p<15) return 'pain-good'; if(p<55) return 'pain-mid'; if(p<75) return 'pain-high'; return 'pain-critical'; }
function severityClass(sev, stabilized=false) { if(stabilized) return 'injury-stable'; return {light:'injury-light', medium:'injury-medium', heavy:'injury-heavy'}[sev] || 'injury-medium'; }
function tempHp(ch) { return Math.max(0, Number(ch?.temp_hp || 0)); }
function tempHpBadge(ch, compact=false) { const t=tempHp(ch); return t>0 ? `<span class="temp-hp-badge ${compact?'compact':''}">✨ +${esc(t)} врем.</span>` : ''; }
function hpText(ch) { return `HP ${esc(ch?.current_hp ?? 0)}/${esc(ch?.current_max_hp ?? ch?.max_hp_base ?? '—')}${tempHp(ch)>0 ? ` · +${esc(tempHp(ch))} врем.` : ''}`; }
function hpPill(ch) { return `<span class="pill stat hp-pill ${hpClass(ch)}"><strong>HP</strong> <span>${ch.current_hp}/${ch.current_max_hp}</span>${tempHpBadge(ch, true)}</span>`; }
function armorPill(ch) { return ch.armor_enabled ? `<span class="pill stat armor"><strong>Броня</strong> ${ch.armor_current}/${ch.current_max_armor}</span>` : ''; }
function painPill(ch) { return ch.injuries_enabled ? `<button class="pill stat pain ${painClass(ch.pain)}" onclick="showPain(${ch.id})"><strong>Боль</strong> ${ch.pain}/100</button>` : ''; }
function injuryBadge(ch) { const count=(ch.injuries||[]).filter(i=>!i.healed).length; return ch.injuries_enabled ? `<span class="badge ${count?'danger':'ok'}">травмы: ${count || 'нет'}</span>` : ''; }
function injTitle(i) { return `${i.location_ru || i.location}. ${i.severity_ru || i.severity}`; }
function injuryChip(ch, i, master=false) {
  const cls = severityClass(i.severity, i.stabilized);
  const stab = i.stabilized ? 'стаб.' : 'нестаб.';
  return `<button class="injury-chip ${cls}" onclick="openInjuryModal(${ch.id},${i.id},${master ? 'true':'false'})">${esc(injTitle(i))} · ${stab}</button>`;
}


function characterTagPill(ch, cls='') {
  const textTag = String(ch?.custom_tag_text || '');
  const textId = String(ch?.custom_tag || '');
  const textObj = tagById(textId);
  const finalText = textTag || (textObj && String(textObj.category || '') !== 'tag_shape' ? String(textObj.name || '') : '');
  if (!finalText) return '';
  let styleId = String(ch?.custom_tag_style || defaultTagShapeId());
  if (!styleId || styleId === 'tag_none') styleId = defaultTagShapeId();
  const style = tagById(styleId) || tagById(defaultTagShapeId()) || {rarity:'common', emoji:'🏷️', css_class:'tag-shape-classic'};
  const rarity = style.rarity || (textObj?.rarity) || 'common';
  return `<span class="character-tag ${esc(cls)} rarity-${esc(rarity)} ${esc(style.css_class || tagClassFor(styleId))}">${style.emoji?`<span>${esc(style.emoji)}</span>`:''}<b>${esc(finalText)}</b></span>`;
}

function characterNameWithTag(ch) {
  return `<span class="char-name-line"><span>${esc(ch?.name || 'Персонаж')}</span>${characterTagPill(ch)}</span>`;
}
function avatarCircle(ch, size='md') {
  const color = ch?.color || '#72a7ff';
  const avatarSrc = ['lg','xl','xxl'].includes(size) ? (ch?.avatar_path || ch?.avatar_thumb_path || '') : (ch?.avatar_thumb_path || ch?.avatar_path || '');
  const initial = String(ch?.name || '?').trim().slice(0,1).toUpperCase() || '?';
  const frame = String(ch?.custom_frame || '');
  const effect = normalizedEffectId(ch?.custom_effect || '');
  const frameObj = frame ? cosmeticById(frame) : null;
  const frameAsset = frameObj ? (['md','lg','xl','xxl'].includes(size) ? cosmeticFullImgPath(frameObj) : cosmeticImgPath(frameObj)) : '';
  const frameScale = Math.max(0.50, Math.min(3.50, Number(frameObj?.frame_scale || 1.55)));
  const frameOffsetX = Math.max(-80, Math.min(80, Number(frameObj?.frame_offset_x || 0)));
  const frameOffsetY = Math.max(-80, Math.min(80, Number(frameObj?.frame_offset_y || 0)));
  const frameClass = frame && !frameAsset ? ` cosmetic-frame ${frameClassFor(frame)}` : '';
  const avatarBase = avatarSrc
    ? `<span class="avatar ${size}${frameClass}" style="--char-color:${esc(color)}"><img loading="lazy" class="avatar-photo" src="${esc(avatarSrc)}" alt=""></span>`
    : `<span class="avatar ${size} avatar-empty${frameClass}" style="--char-color:${esc(color)}"><span class="avatar-initial">${esc(initial)}</span></span>`;
  let avatarNode = avatarBase;
  if (frameAsset) {
    const frameSize = `${(frameScale * 100).toFixed(2)}%`;
    avatarNode = `<span class="avatar-shell ${size}" style="--char-color:${esc(color)};--frame-scale:${esc(frameScale)};--frame-size:${esc(frameSize)};--frame-offset-x:${esc(frameOffsetX)}%;--frame-offset-y:${esc(frameOffsetY)}%">${avatarBase}<img loading="lazy" class="avatar-shell-frame" src="${esc(frameAsset)}" alt=""></span>`;
  }
  if (effect) {
    const cls = effectClassFor(effect);
    // Same composition as the standalone HTML previews: outer shell + centered avatar/frame + canvas layer.
    return `<span class="fx-avatar-shell ${size} ${esc(cls)}" data-effect-id="${esc(effect)}" style="--char-color:${esc(color)}">${avatarNode}</span>`;
  }
  return avatarNode;
}

function playerChar() {
  return state.campaignState?.player_character || allChars()[0] || null;
}

function detectPlayerFlash(events, oldId, fresh) {
  if (fresh.role !== 'player') return '';
  const own = fresh.player_character || fresh.characters?.[0];
  if (!own) return '';
  const items = [...events].filter(e => Number(e.id) > Number(oldId || 0) && Number(e.character_id || 0) === Number(own.id)).sort((a,b)=>Number(a.id)-Number(b.id));
  let kind = '';
  for (const e of items) {
    const p = e.payload || {};
    if (e.kind === 'damage') kind = 'damage';
    else if (e.kind === 'armor_repair') kind = 'repair';
    else if (e.kind === 'full_heal' || e.kind === 'injury') kind = 'heal';
    else if (e.kind === 'request') {
      const t = p.type || p.request_type;
      if (t === 'repair') kind = 'repair';
      else if (['heal','stabilize','injury_heal','customization_unlock'].includes(t)) kind = 'heal';
    }
  }
  return kind;
}


function detectPlayerNotice(events, oldId, fresh) {
  if (fresh.role !== 'player') return null;
  const own = fresh.player_character || fresh.characters?.[0];
  if (!own) return null;
  const items = [...events].filter(e => Number(e.id) > Number(oldId || 0) && Number(e.character_id || 0) === Number(own.id)).sort((a,b)=>Number(b.id)-Number(a.id));
  const e = items[0];
  if (!e) return null;
  const p = e.payload || {};
  if (e.kind === 'damage') return {kind:'damage', text:`Получен урон: ${p.damage ?? '—'}`};
  if (e.kind === 'achievement') return {kind:'heal', text:'🏆 Получено новое достижение'};
  if (e.kind === 'currency') return {kind:'heal', text:`✦ Получено искр: ${p.amount ?? '—'}`};
  if (e.kind === 'armor_repair') return {kind:'repair', text:'Броня починена'};
  if (e.kind === 'full_heal') return {kind:'heal', text:'Полное излечение применено'};
  if (e.kind === 'injury') return {kind:'heal', text:e.title || 'Травма обновлена'};
  if (e.kind === 'request') {
    const t = p.type || p.request_type;
    if (t === 'repair') return {kind:'repair', text:'Заявка на ремонт обработана'};
    if (t === 'injury_heal') return {kind:'heal', text:'Травма вылечена'};
    if (t === 'stabilize') return {kind:'heal', text:'Травма стабилизирована'};
    if (t === 'heal') return {kind:'heal', text:'Лечение применено'};
    if (t === 'customization_unlock') return {kind:'heal', text:'Уникальная кастомизация разблокирована'};
  }
  return null;
}

function triggerScreenFlash(kind) {
  const el = document.getElementById('screenFlash');
  if (!el) return;
  el.className = `screen-flash ${kind}`;
  void el.offsetWidth;
  el.classList.add('run');
  setTimeout(() => { el.className = 'screen-flash'; }, 1100);
}


function colorPickerHtml(inputId, selected='#72a7ff') {
  const safe = normalizeHexColor(selected);
  const buttons = CHARACTER_COLORS.map(c => `<button type="button" class="color-choice ${c.toLowerCase()===safe?'selected':''}" style="--pick-color:${esc(c)}" onclick="selectColor('${inputId}','${esc(c)}')" aria-label="${esc(c)}"><span></span></button>`).join('');
  return `<div class="color-picker" data-input-id="${esc(inputId)}">
    <input id="${esc(inputId)}" type="hidden" value="${esc(safe)}">
    <div class="color-grid">${buttons}</div>
  </div>`;
}

function selectColor(inputId, color) {
  const safe = normalizeHexColor(color);
  const input = document.getElementById(inputId);
  if (input) input.value = safe;
  const preview = document.getElementById(`${inputId}Preview`);
  if (preview) preview.style.background = safe;
  const label = document.getElementById(`${inputId}Label`);
  if (label) label.textContent = safe;
  document.querySelectorAll(`.color-picker[data-input-id="${inputId}"] .color-choice`).forEach(btn => {
    const current = (btn.style.getPropertyValue('--pick-color') || '').trim().toLowerCase();
    btn.classList.toggle('selected', current === safe);
  });
  if (inputId === 'selfColor') applySelfColor(safe);
}

let selfColorSaveTimer = null;
function applySelfColor(color) {
  const ch = playerChar();
  if (!ch) return;
  const safe = normalizeHexColor(color);
  ch.color = safe;
  document.querySelectorAll('.settings-card, .profile-settings-hero, .avatar').forEach(el => {
    try { el.style.setProperty('--char-color', safe); } catch (_) {}
  });
  clearTimeout(selfColorSaveTimer);
  selfColorSaveTimer = setTimeout(async () => {
    try {
      await api(`/api/characters/${ch.id}/self`, {method:'PATCH', body:{color:safe}});
      showToast('Цвет применён', 'info');
    } catch(e) {
      showToast(e.message, 'error');
    }
  }, 220);
}

async function addCharacter() {
  try {
    const name = val('chName');
    if (!name) throw new Error('Введите имя персонажа');
    const hp = num('chHp', 0);
    const ac = num('chAc', 0);
    const armor = state.campaignState.campaign.armor_enabled ? num('chArmor', 0) : 0;
    const color = randomCharacterColor();
    if (hp <= 0) throw new Error('HP должно быть больше 0');
    if (ac <= 0) throw new Error('КД должно быть больше 0');
    const out = await api(`/api/campaigns/${state.currentCampaignId}/characters`, {method:'POST', body:{name, hp, ac, armor, color}});
    if (out?.character?.id) {
      state.expandedCharacters.clear();
      state.expandedCharacters.add(Number(out.character.id));
    }
    state.tab = 'characters';
    await render();
  } catch(e) { alert(e.message); }
}


function toggleCharacterCard(id) {
  id = Number(id);
  if (state.expandedCharacters.has(id)) {
    state.expandedCharacters.delete(id);
  } else {
    state.expandedCharacters.clear();
    state.expandedCharacters.add(id);
  }
  renderCampaign();
}

function renderMasterCharacters() {
  const chars = [...allChars()].sort((a, b) => {
    const ae = state.expandedCharacters.has(Number(a.id)) ? 0 : 1;
    const be = state.expandedCharacters.has(Number(b.id)) ? 0 : 1;
    if (ae !== be) return ae - be;
    return Number(a.id) - Number(b.id);
  });
  return `<div class="stack">
    ${chars.length ? `<div class="character-compact-grid">${chars.map(renderCharacterCard).join('')}</div>` : '<div class="card muted">Персонажей пока нет.</div>'}
    <details class="card add-character" ${sectionAttrs('master-add-character')}><summary>➕ Добавить персонажа</summary>
      <div class="stack" style="margin-top:12px">
        <label>Имя</label><input id="chName" placeholder="Артан">
        <div class="grid"><div><label>HP</label><input id="chHp" type="number" value="30"></div><div><label>КД</label><input id="chAc" type="number" value="15"></div></div>
        ${state.campaignState.campaign.armor_enabled ? '<label>Броня</label><input id="chArmor" type="number" value="0">' : ''}
        <button class="ok" onclick="addCharacter()">Добавить персонажа</button>
      </div>
    </details>
    <div class="card invite-mini"><button class="secondary" onclick="showInviteModal()">🔗 Пригласить игрока</button></div>
  </div>`;
}

function renderCharacterCard(ch) {
  const color = ch.color || '#72a7ff';
  const opened = state.expandedCharacters.has(Number(ch.id));
  if (!opened) {
    return `<div class="character-collapsed" style="--char-color:${esc(color)}" onclick="toggleCharacterCard(${ch.id})">
      ${avatarCircle(ch, 'sm')}
      <span class="collapsed-main"><span class="collapsed-name">${esc(ch.name)}</span><span class="collapsed-hp ${hpClass(ch)}">${hpText(ch)}</span></span>
      ${injuryBadge(ch)}
    </div>`;
  }
  const statuses = (ch.statuses||[]).map((s,i)=>`<div class="row"><span class="pill">${esc(s)}</span><button class="danger small" onclick="removeStatus(${ch.id},${i})">×</button></div>`).join('') || '<div class="muted">нет</div>';
  const injuries = (ch.injuries||[]).filter(i=>!i.healed).map(i => injuryChip(ch, i, true)).join('') || '<div class="muted">нет</div>';
  return `<div class="card stack character-card character-expanded" style="--char-color:${esc(color)}">
    <button class="character-expand-head" onclick="toggleCharacterCard(${ch.id})">
      ${avatarCircle(ch, 'sm')}
      <span class="collapsed-name">${esc(ch.name)}</span>
      <span class="collapse-hint">свернуть</span>
    </button>
    <div class="row" style="justify-content:space-between">${injuryBadge(ch)}</div>
    <div class="row">${hpPill(ch)} ${armorPill(ch)} <span class="pill stat ac"><strong>КД</strong> ${ch.ac}</span> ${painPill(ch)} <span class="pill">${ch.telegram_user_id ? '🔗 привязан' : 'не привязан'}</span></div>
    ${renderInventoryBlock(ch)}
    <details class="details" ${sectionAttrs(`char-${ch.id}-injuries`)}><summary>Травмы и статусы</summary><div class="stack" style="margin-top:10px"><div><b>Травмы:</b><div class="chips">${injuries}</div></div><div><b>Статусы:</b>${statuses}</div><div class="row"><input id="status_${ch.id}" placeholder="Новый статус"><button class="small" onclick="addStatus(${ch.id})">Добавить статус</button></div></div></details>
    <details class="details" ${sectionAttrs(`char-${ch.id}-manual`)}><summary>Ручная правка</summary>${manualButtons(ch)}</details>
    <div class="row"><button class="ok small" onclick="fullHeal(${ch.id})">Полное излечение</button>${ch.armor_enabled ? `<button class="warn small" onclick="quickRepair(${ch.id})">Ремонт брони</button>` : ''}</div>
  </div>`;
}

function manualButtons(ch) {
  const items = [
    ['current_hp','Текущее HP', ch.current_hp, 'number'],
    ['temp_hp','Временные HP', ch.temp_hp || 0, 'number'],
    ['max_hp_base','База макс. HP', ch.max_hp_base, 'number'],
    ['max_hp_penalty','Штраф макс. HP', ch.max_hp_penalty, 'number'],
    ['ac','КД', ch.ac, 'number'],
    ['pain','Боль', ch.pain, 'number'],
    ['color','Цвет персонажа', ch.color || '#72a7ff', 'color'],
  ];
  if (ch.armor_enabled) {
    items.push(['armor_current','Текущая броня', ch.armor_current, 'number']);
    items.push(['armor_max_base','База макс. брони', ch.armor_max_base, 'number']);
    items.push(['armor_max_penalty','Износ брони', ch.armor_max_penalty, 'number']);
  }
  return `<div class="manual-buttons">${items.map(([field,label,value,type]) => `<button class="secondary small" onclick="openManualModal(${ch.id},'${field}','${label}', '${esc(value)}', '${type}')">${label}: ${esc(value)}</button>`).join('')}</div>`;
}

function openManualModal(charId, field, label, current, type='number') {
  if (type === 'color') {
    const color = normalizeHexColor(current);
    showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${esc(label)}</div>${colorPickerHtml('manualValue', color)}<div class="row modal-actions"><button class="ok" onclick="saveManualField(${charId},'${field}','color')">Сохранить цвет</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
    return;
  }
  const value = esc(current);
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${esc(label)}</div><p class="muted">Введи новое значение или нажми отмену.</p><input id="manualValue" type="number" value="${value}"><div class="row modal-actions"><button class="ok" onclick="saveManualField(${charId},'${field}','${type}')">Сохранить</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
  setTimeout(() => { const el=document.getElementById('manualValue'); el?.focus(); if (el?.select) el.select(); }, 30);
}

async function saveManualField(id, field, type='number') {
  const raw = val('manualValue');
  if (raw === '') return alert('Введите значение');
  const body = {};
  body[field] = type === 'color' ? raw : Number(raw);
  try { await api(`/api/characters/${id}`, {method:'PATCH', body}); closeModal(); await render(); } catch(e) { alert(e.message); }
}
async function fullHeal(id) { if(confirm('Применить полное излечение?')) { await api(`/api/characters/${id}/full-heal`, {method:'POST'}); await render(); } }
async function quickRepair(id) { const roll = prompt('Бросок ремонта d20:'); if(!roll) return; try { const out = await api(`/api/characters/${id}/repair-armor`, {method:'POST', body:{roll:Number(roll)}}); alert(out.result_text); await render(); } catch(e) { alert(e.message); } }
async function addStatus(id) { const text=val(`status_${id}`); if(!text) return; await api(`/api/characters/${id}/statuses`, {method:'POST', body:{text}}); await render(); }
async function removeStatus(id, idx) { await api(`/api/characters/${id}/statuses/${idx}`, {method:'DELETE'}); await render(); }

function targetSelect(id='target') {
  return `<select id="${id}" class="target-select">${allChars().map(ch=>`<option value="${ch.id}">${esc(ch.name)} · ${hpText(ch)}${ch.armor_enabled ? ` · Броня ${ch.armor_current}/${ch.current_max_armor}` : ''}</option>`).join('')}</select>`;
}

function combatTargetCards(id='directTarget') {
  const chars = allChars();
  const first = chars[0]?.id || '';
  const cards = chars.map((ch, index)=>`<button type="button" class="combat-target ${index===0?'selected':''}" style="--char-color:${esc(ch.color || '#72a7ff')}" onclick="selectCombatTarget('${id}', ${ch.id}, this)">
    ${avatarCircle(ch, 'sm')}
    <span class="combat-target-main"><b>${esc(ch.name)}</b><small>${hpText(ch)}${ch.armor_enabled ? ` · Броня ${ch.armor_current}/${ch.current_max_armor}` : ''}</small></span>
  </button>`).join('') || '<div class="muted">Нет персонажей.</div>';
  return `<input id="${id}" type="hidden" value="${first}"><div class="combat-target-grid">${cards}</div>`;
}

function selectCombatTarget(id, charId, el) {
  const input = document.getElementById(id);
  if (input) input.value = String(charId);
  const grid = el?.closest?.('.combat-target-grid');
  (grid ? grid.querySelectorAll('.combat-target') : document.querySelectorAll('.combat-target')).forEach(btn => btn.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

function injuryLocationOptions(selected='torso') {
  const items = [['torso','Корпус'], ['head','Голова'], ['arm_r','Правая рука'], ['arm_l','Левая рука'], ['leg_r','Правая нога'], ['leg_l','Левая нога']];
  return items.map(([id, label]) => `<option value="${id}" ${id===selected?'selected':''}>${label}</option>`).join('');
}
function injurySeverityOptions(selected='light') {
  const items = [['light','Лёгкая'], ['medium','Средняя'], ['heavy','Тяжёлая']];
  return items.map(([id, label]) => `<option value="${id}" ${id===selected?'selected':''}>${label}</option>`).join('');
}
function armorModeOptions() {
  const c = state.campaignState?.campaign || {};
  return `<option value="normal">Обычный</option>${c.armor_enabled ? '<option value="piercing">Бронебойный</option>' : ''}<option value="ignore">Игнорировать броню</option>`;
}

function activeCombat() { return state.campaignState?.active_combat || null; }
function combatItems() { return activeCombat()?.combatants || []; }
function currentCombatantId() { return Number(activeCombat()?.current_combatant_id || activeCombat()?.current?.id || 0); }

function renderMasterCombat() {
  const combat = activeCombat();
  const oldTools = renderQuickDamageTools();
  if (!combat) {
    return `<div class="stack">
      <div class="card combat-start-card">
        <div class="combat-hero-title">⚔️ Контроллер боя</div>
        <div class="muted">Создай сцену боя, собери инициативу игроков, добавь врагов и управляй ходами.</div>
        <button class="ok" onclick="startCombatTracker()">Начать бой</button>
      </div>
      ${oldTools}
    </div>`;
  }
  return `<div class="stack">
    ${renderCombatTrackerMaster(combat)}
    ${oldTools}
  </div>`;
}

function renderQuickDamageTools() {
  const c = state.campaignState.campaign;
  const chars = allChars();
  const combat = activeCombat();
  const enemies = (combat?.combatants || []).filter(x => x.kind === 'enemy');
  const enemyTargets = enemies.length
    ? enemies.map(e=>`<label class="target-check enemy-target" style="--char-color:${esc(e.color || '#ef4444')}"><input class="massEnemyTarget" type="checkbox" value="${e.id}">${avatarCircle(e, 'xs')}<span>${esc(e.name)}</span><small>HP ${esc(e.current_hp)}/${esc(e.max_hp)} · ${esc(e.public_condition || '')}</small></label>`).join('')
    : '<div class="muted">В активном бою нет врагов.</div>';
  return `<div class="combat-tools-grid">
    <details class="card stack combat-section" ${sectionAttrs('combat-direct-damage')}><summary>🎯 Обычная атака по персонажу</summary><div class="stack section-body"><label>Цель</label>${combatTargetCards('directTarget')}<label>Урон</label><input id="directDamage" type="number" value="0"><div class="row"><button onclick="doDirect(false)">Применить урон</button>${c.armor_enabled ? '<button class="warn" onclick="doDirect(true)">Бронебойный</button>' : ''}</div><div id="combatOut2"></div></div></details>
    <details class="card stack combat-section debug-damage-section" ${sectionAttrs('combat-debug-damage')}><summary>🧪 Дебаг урона и травмы</summary><div class="stack section-body"><label>Цель</label>${combatTargetCards('debugTarget')}<div class="grid two"><div><label>Урон</label><input id="debugDamage" type="number" value="0"></div><div><label>Режим брони</label><select id="debugArmorMode">${armorModeOptions()}</select></div><div><label>Часть тела</label><select id="debugLocation">${injuryLocationOptions()}</select></div><div><label>Степень травмы</label><select id="debugSeverity">${injurySeverityOptions('medium')}</select></div></div><label class="checkline"><input id="debugForceInjury" type="checkbox" checked> Создать выбранную травму принудительно</label><button class="warn" onclick="doDebugDamage()">Применить дебаг-урон</button><div id="combatOutDebug"></div></div></details>
    <details class="card stack wide combat-section" ${sectionAttrs('combat-mass-damage')}><summary>💥 Массовый урон по персонажам</summary><div class="stack section-body"><label>Урон всем выбранным</label><input id="massDamage" type="number" value="0"><div class="mass-targets">${chars.map(ch=>`<label class="target-check" style="--char-color:${esc(ch.color || '#72a7ff')}"><input class="massTarget" type="checkbox" value="${ch.id}">${avatarCircle(ch, 'xs')}<span>${esc(ch.name)}</span><small>${hpText(ch)}${ch.armor_enabled ? ` · Броня ${ch.armor_current}/${ch.current_max_armor}` : ''}</small></label>`).join('')}</div>${c.armor_enabled ? '<label class="checkline"><input id="massPiercing" type="checkbox"> Бронебойный массовый урон</label>' : ''}<button onclick="doMass()">Применить массовый урон</button><div id="combatOut3"></div></div></details>
    <details class="card stack wide combat-section" ${sectionAttrs('combat-mass-enemy-damage')}><summary>👹 Массовый урон по врагам</summary><div class="stack section-body"><label>Урон всем выбранным врагам</label><input id="massEnemyDamage" type="number" value="0"><div class="mass-targets enemy-mass-targets">${enemyTargets}</div><button class="danger" onclick="doMassEnemyDamage()" ${enemies.length?'':'disabled'}>Применить урон по врагам</button><div id="combatOutEnemies"></div></div></details>
  </div>`;
}

function renderCombatTrackerMaster(combat) {
  const statusText = combat.status === 'setup' ? 'сбор инициативы' : 'бой идёт';
  const current = combat.current;
  return `<details class="card stack combat-controller combat-section" ${sectionAttrs('combat-controller')}><summary>⚔️ Контроллер боя</summary><div class="stack section-body">
    <div class="combat-head">
      <div><div class="combat-hero-title">Раунд ${esc(combat.round || 1)}</div><div class="muted">Статус: ${esc(statusText)}${current ? ` · сейчас ходит: ${esc(current.name)}` : ''}</div></div>
      <div class="row"><button class="danger small" onclick="finishCombat(${combat.id})">Закончить бой</button>${combat.status === 'setup' ? `<button class="ok small" onclick="beginCombat(${combat.id})">Начать порядок ходов</button>` : `<button class="ok small" onclick="nextTurn(${combat.id})">Передать ход</button>`}</div>
    </div>
    ${combat.status === 'setup' ? `<div class="setup-note">Игроки вводят инициативу в своей вкладке “Бой”. Мастер добавляет врагов ниже. Когда всё готово — нажми “Начать порядок ходов”.</div>` : ''}
    ${renderInitiativeCarousel(combat, true)}
    <div class="row"><button class="secondary" onclick="openEnemyModal(${combat.id})">➕ Добавить врага</button></div>
    ${renderCombatantManagement(combat)}
  </div></details>`;
}

function renderInitiativeCarousel(combat, master=false) {
  const rawItems = combat.combatants || [];
  if (!rawItems.length) return '<div class="empty-state">В инициативе пока никого нет.</div>';
  const currentId = Number(combat.current_combatant_id || combat.current?.id || 0);
  const currentIdx = rawItems.findIndex(x => Number(x.id) === currentId);
  const items = (combat.status === 'active' && currentIdx > 0)
    ? rawItems.slice(currentIdx).concat([{kind:'round_marker', id:'round-end'}], rawItems.slice(0, currentIdx))
    : rawItems.concat([{kind:'round_marker', id:'round-end'}]);
  return `<div class="initiative-carousel" id="initiativeCarousel" onscroll="state.initiativeCarouselScroll=this.scrollLeft">${items.map((it) => {
    if (it.kind === 'round_marker') {
      return `<div class="initiative-token round-marker"><b>Конец раунда</b></div>`;
    }
    const cur = Number(it.id) === currentId;
    const isEnemy = it.kind === 'enemy';
    const onClick = isEnemy ? (master ? `onclick="openEnemyDetailMaster(${it.id})"` : `onclick="openEnemyPublicModal(${it.id})"`) : '';
    const roleLabel = isEnemy ? 'враг' : 'персонаж';
    return `<button type="button" class="initiative-token ${cur?'current':''} ${it.kind} ${isEnemy?'clickable':''}" style="--char-color:${esc(it.color || '#72a7ff')}" ${onClick}>
      ${avatarCircle(it, 'sm')}<span class="initiative-token-text"><b>${esc(it.name)}</b><small>${esc(roleLabel)}</small></span>${cur?'<span class="turn-dot">ход</span>':''}
    </button>`;
  }).join('')}</div>`;
}

function renderCombatantManagement(combat) {
  const items = combat.combatants || [];
  const open = !!state.combatListOpen;
  return `<div class="initiative-table-card ${open?'open':'collapsed'}">
    <button class="initiative-table-toggle" onclick="toggleCombatList()">
      <span>📋 Участники инициативы</span>
      <small>${items.length} участников · нажми, чтобы ${open?'свернуть':'развернуть'}</small>
      <b>${open?'▲':'▼'}</b>
    </button>
    ${open ? `<div class="combatant-list" id="combatantList">${items.map(it => renderCombatantRow(it, combat)).join('')}</div>` : ''}
  </div>`;
}
function toggleCombatList(){ state.combatListOpen = !state.combatListOpen; renderCampaign(); }

function renderCombatantRow(it, combat) {
  const cur = Number(it.id) === Number(combat.current_combatant_id || combat.current?.id);
  const isEnemy = it.kind === 'enemy';
  const info = isEnemy
    ? `HP ${it.current_hp}/${it.max_hp} · КД ${it.ac} · ${it.hidden_hp ? 'HP скрыто' : it.public_condition}`
    : `HP ${it.current_hp}/${it.max_hp} · КД ${it.ac}`;
  return `<div class="combatant-row ${cur?'current':''}" data-id="${it.id}" style="--char-color:${esc(it.color || '#72a7ff')}">
    <div class="combatant-main" onclick="${isEnemy ? `openEnemyDetailMaster(${it.id})` : `openCombatantInitiativeModal(${it.id})`}">${avatarCircle(it, 'sm')}<div><b>${esc(it.name)}</b><small>${esc(info)}</small></div></div>
    <div class="combatant-actions"><span class="badge">иниц. ${esc(it.initiative ?? '—')}</span>${isEnemy ? `<button class="danger small" onclick="openEnemyDetailMaster(${it.id})">Урон</button>` : `<button class="secondary small" onclick="openCombatantInitiativeModal(${it.id})">Инициатива</button>`}</div>
  </div>`;
}

function renderPlayerCombat() {
  const combat = activeCombat();
  const ch = playerChar();
  if (!combat) return '<div class="card muted">Сейчас активного боя нет.</div>';
  const own = (combat.combatants || []).find(x => x.kind === 'character' && Number(x.character_id) === Number(ch?.id));
  return `<div class="stack">
    <details class="card stack combat-controller combat-section" ${sectionAttrs('player-combat-order')}><summary>⚔️ Бой · раунд ${esc(combat.round || 1)}</summary><div class="stack section-body">
      <div class="muted">${combat.status === 'setup' ? 'Сбор инициативы' : 'Порядок ходов'}</div>
      ${own ? renderPlayerInitiativeInput(ch, own, combat) : ''}
      ${renderInitiativeCarousel(combat, false)}
    </div></details>
    <details class="card stack combat-section" ${sectionAttrs('player-combat-enemies')}><summary>👹 Враги</summary><div class="section-body">${renderPlayerEnemyList(combat)}</div></details>
  </div>`;
}

function renderPlayerInitiativeInput(ch, own, combat) {
  if (combat.status !== 'setup') {
    return '';
  }
  return `<div class="initiative-submit" style="--char-color:${esc(ch?.color || '#72a7ff')}">${avatarCircle(ch, 'sm')}<div><b>Твоя инициатива</b><small>Введи результат броска d20 + модификаторы</small></div><input id="playerInitiative" type="number" value="${esc(own.initiative ?? '')}" placeholder="17"><button class="ok" onclick="submitPlayerInitiative(${ch.id})">Записать</button></div>`;
}

function renderPlayerEnemyList(combat) {
  const enemies = (combat.combatants || []).filter(x => x.kind === 'enemy');
  if (!enemies.length) return '<div class="muted">Врагов пока не добавили.</div>';
  return `<div><div class="enemy-public-grid">${enemies.map(e => `<button class="enemy-public-card" style="--char-color:${esc(e.color || '#ef4444')}" onclick="openEnemyPublicModal(${e.id})">${avatarCircle(e, 'sm')}<b>${esc(e.name)}</b><small>${esc(e.public_condition || 'Состояние неизвестно')}</small></button>`).join('')}</div></div>`;
}

async function doAttack() { try { const out=await api(`/api/characters/${val('atkTarget')}/damage/attack`, {method:'POST', body:{attack_roll:num('atkRoll',0), damage:num('atkDamage',0)}}); alert(out.result_text); state.tab='combat'; await render(); } catch(e){document.getElementById('combatOut1').innerHTML=msg(e.message,'error');} }
async function doDirect(piercing) { try { const path = piercing ? 'piercing':'direct'; const out=await api(`/api/characters/${val('directTarget')}/damage/${path}`, {method:'POST', body:{damage:num('directDamage',0)}}); alert(out.result_text); state.tab='combat'; await render(); } catch(e){document.getElementById('combatOut2').innerHTML=msg(e.message,'error');} }
async function doDebugDamage() {
  try {
    const target = Number(val('debugTarget') || 0);
    if (!target) throw new Error('Выбери цель');
    const out = await api(`/api/characters/${target}/damage/debug`, {method:'POST', body:{damage:num('debugDamage',0), armor_mode:val('debugArmorMode') || 'normal', location:val('debugLocation') || 'torso', severity:val('debugSeverity') || 'medium', force_injury:checked('debugForceInjury')}});
    alert(out.result_text); state.tab='combat'; await render();
  } catch(e) { document.getElementById('combatOutDebug').innerHTML = msg(e.message, 'error'); }
}
async function doMass() { try { const ids=[...document.querySelectorAll('.massTarget:checked')].map(x=>Number(x.value)); const out=await api(`/api/campaigns/${state.currentCampaignId}/damage/mass`, {method:'POST', body:{target_ids:ids, damage:num('massDamage',0), piercing:checked('massPiercing')}}); alert(out.result_text); state.tab='combat'; await render(); } catch(e){document.getElementById('combatOut3').innerHTML=msg(e.message,'error');} }
async function doMassEnemyDamage() {
  try {
    const ids=[...document.querySelectorAll('.massEnemyTarget:checked')].map(x=>Number(x.value));
    const out=await api(`/api/campaigns/${state.currentCampaignId}/combatants/enemies/damage/mass`, {method:'POST', body:{target_ids:ids, damage:num('massEnemyDamage',0)}});
    alert(out.result_text); state.tab='combat'; await render();
  } catch(e){document.getElementById('combatOutEnemies').innerHTML=msg(e.message,'error');}
}


async function startCombatTracker() {
  try { await api(`/api/campaigns/${state.currentCampaignId}/combat/start`, {method:'POST'}); state.tab='combat'; await render(); }
  catch(e){ alert(e.message); }
}
async function beginCombat(id) { try { await api(`/api/combats/${id}/begin`, {method:'POST'}); await render(); } catch(e){ alert(e.message); } }
async function nextTurn(id) { try { await api(`/api/combats/${id}/next`, {method:'POST'}); await render(); } catch(e){ alert(e.message); } }
async function finishCombat(id) { if(!confirm('Завершить бой?')) return; try { await api(`/api/combats/${id}/finish`, {method:'POST'}); await render(); } catch(e){ alert(e.message); } }
async function submitPlayerInitiative(charId) { try { const out=await api(`/api/characters/${charId}/initiative`, {method:'POST', body:{initiative:num('playerInitiative',0)}}); showToast(out.message || 'Инициатива записана', 'info'); await render(); } catch(e){ showToast(e.message, 'error'); } }
function openEnemyModal(combatId) {
  showModal(`<div class="modal-card compact enemy-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">➕ Новый враг</div>
    <label>Имя</label><input id="enemyName" placeholder="Гоблин 1">
    <div class="grid"><div><label>HP</label><input id="enemyHp" type="number" value="20"></div><div><label>КД</label><input id="enemyAc" type="number" value="13"></div></div>
    <label>Инициатива</label><input id="enemyInit" type="number" value="10">
    <div class="modal-title-lite">Цвет врага</div>${colorPickerHtml('enemyColor', '#ef4444')}
    <label class="checkline"><input id="enemyHidden" type="checkbox"> Скрыть состояние здоровья от игроков</label>
    <label>Описание для игроков</label><textarea id="enemyNote" rows="3" placeholder="Высокий рыцарь в чёрной броне. Дышит тяжело, но держит меч уверенно."></textarea>
    <div class="row modal-actions"><button class="ok" onclick="createEnemy(${combatId})">Добавить</button><button class="secondary" onclick="closeModal()">Отмена</button></div>
  </div>`);
}
async function createEnemy(combatId) {
  try {
    const name=val('enemyName'); if(!name) throw new Error('Введите имя врага');
    await api(`/api/combats/${combatId}/enemies`, {method:'POST', body:{name, hp:num('enemyHp',1), ac:num('enemyAc',10), initiative:num('enemyInit',0), color:normalizeHexColor(val('enemyColor') || '#ef4444'), hidden_hp:checked('enemyHidden'), public_note:val('enemyNote')}});
    closeModal(); await render();
  } catch(e){ alert(e.message); }
}
function combatantById(id) { return (activeCombat()?.combatants || []).find(x => Number(x.id) === Number(id)); }
function openCombatantInitiativeModal(id) {
  const it = combatantById(id); if(!it) return;
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">Инициатива: ${esc(it.name)}</div><input id="combatantInit" type="number" value="${esc(it.initiative ?? '')}" placeholder="15"><div class="row modal-actions"><button class="ok" onclick="saveCombatantInitiative(${id})">Сохранить</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
}
async function saveCombatantInitiative(id) { try { await api(`/api/combatants/${id}`, {method:'PATCH', body:{initiative:num('combatantInit',0)}}); closeModal(); await render(); } catch(e){ alert(e.message); } }
function openEnemyDetailMaster(id) {
  const e = combatantById(id); if(!e) return;
  showModal(`<div class="modal-card enemy-detail-modal" style="--char-color:${esc(e.color || '#ef4444')}"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="enemy-detail-head">${avatarCircle(e, 'md')}<div><div class="name">${esc(e.name)}</div><div class="muted">Враг · инициатива ${esc(e.initiative ?? '—')}</div></div></div>
    <div class="row"> <span class="pill hp-low">HP ${esc(e.current_hp)}/${esc(e.max_hp)}</span><span class="pill stat ac">КД ${esc(e.ac)}</span><span class="pill ${e.hidden_hp?'warn':'ok'}">${e.hidden_hp?'HP скрыто':'HP видно'}</span></div>
    <div class="injury-section combat"><span>👁 Видят игроки</span><p>${esc(e.public_note || e.public_condition || 'Описание не задано.')}</p></div>
    <div class="enemy-damage-box"><label>Нанести урон врагу</label><input id="enemyDamage" type="number" value="0"><div class="row modal-actions"><button class="danger" onclick="damageEnemy(${e.id})">Применить урон</button><button class="secondary" onclick="duplicateEnemy(${e.id})">Дублировать</button><button class="secondary" onclick="openEnemyEditModal(${e.id})">Изменить</button><button class="danger secondary" onclick="removeCombatant(${e.id})">Удалить</button></div></div>
  </div>`);
}
function openEnemyEditModal(id) {
  const e = combatantById(id); if(!e) return;
  showModal(`<div class="modal-card enemy-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">Изменить врага</div>
    <label>Имя</label><input id="enemyEditName" value="${esc(e.name)}">
    <div class="grid"><div><label>HP</label><input id="enemyEditHp" type="number" value="${esc(e.current_hp)}"></div><div><label>Макс. HP</label><input id="enemyEditMaxHp" type="number" value="${esc(e.max_hp)}"></div></div>
    <div class="grid"><div><label>КД</label><input id="enemyEditAc" type="number" value="${esc(e.ac)}"></div><div><label>Инициатива</label><input id="enemyEditInit" type="number" value="${esc(e.initiative ?? '')}"></div></div>
    <div class="modal-title-lite">Цвет врага</div>${colorPickerHtml('enemyEditColor', e.color || '#ef4444')}
    <label class="checkline"><input id="enemyEditHidden" type="checkbox" ${e.hidden_hp?'checked':''}> Скрыть состояние здоровья от игроков</label>
    <label>Описание для игроков</label><textarea id="enemyEditNote" rows="3">${esc(e.public_note || '')}</textarea>
    <div class="row modal-actions"><button class="ok" onclick="saveEnemyEdit(${id})">Сохранить</button><button class="secondary" onclick="closeModal()">Отмена</button></div>
  </div>`);
}
async function saveEnemyEdit(id) {
  try {
    await api(`/api/combatants/${id}`, {method:'PATCH', body:{name:val('enemyEditName'), hp:num('enemyEditHp',0), max_hp:num('enemyEditMaxHp',1), ac:num('enemyEditAc',10), initiative:num('enemyEditInit',0), color:normalizeHexColor(val('enemyEditColor')||'#ef4444'), hidden_hp:checked('enemyEditHidden'), public_note:val('enemyEditNote')}});
    closeModal(); await render();
  } catch(e){ alert(e.message); }
}
function incrementEnemyName(name) {
  const text = String(name || 'Враг').trim() || 'Враг';
  const m = text.match(/^(.*?)(\d+)\s*$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `${text} 2`;
}
async function duplicateEnemy(id) {
  const e = combatantById(id); if(!e) return;
  try {
    const name = incrementEnemyName(e.name);
    await api(`/api/combats/${e.combat_id}/enemies`, {method:'POST', body:{
      name,
      hp:Number(e.max_hp || e.current_hp || 1),
      ac:Number(e.ac || 10),
      initiative:e.initiative == null ? null : Number(e.initiative),
      color:normalizeHexColor(e.color || '#ef4444'),
      hidden_hp:!!e.hidden_hp,
      public_note:e.public_note || ''
    }});
    closeModal(); await render();
  } catch(err){ alert(err.message); }
}
async function damageEnemy(id) { try { const out=await api(`/api/combatants/${id}/damage`, {method:'POST', body:{damage:num('enemyDamage',0)}}); alert(out.message); closeModal(); await render(); } catch(e){ alert(e.message); } }
async function removeCombatant(id) { if(!confirm('Удалить из инициативы?')) return; try { await api(`/api/combatants/${id}`, {method:'DELETE'}); closeModal(); await render(); } catch(e){ alert(e.message); } }

function openEnemyPublicModal(id) {
  const e = combatantById(id); if(!e) return;
  showModal(`<div class="modal-card enemy-public-modal" style="--char-color:${esc(e.color || '#ef4444')}"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="enemy-detail-head">${avatarCircle(e, 'md')}<div><div class="name">${esc(e.name)}</div><div class="muted">Враг в инициативе</div></div></div>
    <div class="enemy-condition">${esc(e.public_condition || 'Состояние неизвестно.')}</div>
    <div class="injury-section exploration"><span>👁 Что видно</span><p>${esc(e.public_note || 'Мастер не добавил отдельное описание.')}</p></div>
  </div>`);
}

function renderRequests() {
  const reqs = state.campaignState.requests || [];
  const inv = renderInventoryRequests();
  const base = reqs.length ? `<div class="grid">${reqs.map(r => `<div class="card stack"><div class="name">${esc(r.character?.name || 'Персонаж')}</div><div class="pill">Тип: ${esc(reqLabel(r))}</div>${requestExtra(r)}<div class="row"><button class="ok" onclick="decideReq(${r.id},true)">Подтвердить</button><button class="danger" onclick="decideReq(${r.id},false)">Отклонить</button></div></div>`).join('')}</div>` : '<div class="card muted">Открытых заявок нет.</div>';
  return `<div class="stack">${base}${inv}</div>`;
}
function reqLabel(r){ return {heal:'лечение', stabilize:'стабилизация травмы', injury_heal:'полное лечение травмы', repair:'ремонт брони', customization_unlock:'устаревший запрос кастомизации'}[r.request_type] || r.request_type; }
function requestExtra(r){
  const p = r.payload || {}; const ch = r.character || {};
  if (r.request_type === 'heal') return `<div class="pill">Восстановить: ${esc(p.hp_amount)} HP</div>`;
  if (r.request_type === 'repair') return `<div class="pill">Бросок ремонта: ${esc(p.roll)}</div>`;
  if (r.request_type === 'customization_unlock') return `<div class="pill unique-request-pill">⚠️ Устаревший запрос кастомизации</div>`;
  if (r.request_type === 'stabilize' || r.request_type === 'injury_heal') {
    const inj = (ch.injuries || []).find(i => Number(i.id) === Number(p.injury_id));
    return `<div class="pill">Травма: ${esc(inj ? injTitle(inj) : '#'+p.injury_id)}</div>`;
  }
  return '';
}
async function decideReq(id, approve) { try { const out=await api(`/api/requests/${id}/decision`, {method:'POST', body:{approve}}); alert(out.message); await render(); } catch(e){alert(e.message);} }

function openImageModal(src, title='Изображение') {
  if (!src || !isImageIcon(src)) return showToast('У этого достижения нет отдельной картинки', 'info');
  const old = document.getElementById('imageModal');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'imageModal';
  wrap.className = 'modal-backdrop image-modal-backdrop';
  wrap.innerHTML = `<div class="modal-card image-view-modal"><button class="modal-close" onclick="closeImageModal()">×</button><div class="name">${esc(title)}</div><div class="image-view-box"><img class="full-quality-image" loading="eager" src="${esc(src)}" alt=""></div><button class="secondary image-view-close" onclick="closeImageModal()">Закрыть</button></div>`;
  document.body.appendChild(wrap);
}
function closeImageModal(){ const m=document.getElementById('imageModal'); if(m) m.remove(); }
function openAchievementImageFromData(grantId, telegramId=0) {
  let g = null;
  if (telegramId && state.profileCache && state.profileCache[String(telegramId)]) g = (state.profileCache[String(telegramId)].achievement_grants || []).find(x => Number(x.id) === Number(grantId));
  if (!g) g = (state.campaignState?.achievement_grants || []).find(x => Number(x.id) === Number(grantId));
  const a = g?.achievement || {};
  openImageModal(achIconFullPath(a), a.title || 'Достижение');
}

function renderPlayerCharacter() {
  const ch = playerChar();
  if (!ch) return '<div class="card">Персонаж не найден.</div>';
  const injuries = (ch.injuries||[]).filter(i=>!i.healed).map(i=>injuryChip(ch, i, false)).join('') || '<div class="muted">нет</div>';
  const statuses = (ch.statuses||[]).map(s=>`<div class="pill">${esc(s)}</div>`).join('') || '<div class="muted">нет</div>';
  const color = ch.color || '#72a7ff';
  return `<div class="card stack player-card" style="--char-color:${esc(color)}">
    <div class="player-hero">${avatarCircle(ch, 'lg')}<div><div class="name">${characterNameWithTag(ch)}</div><div class="muted">Твоя карточка персонажа</div></div></div>
    <div class="row">${hpPill(ch)} ${armorPill(ch)} <span class="pill stat ac"><strong>КД</strong> ${ch.ac}</span> ${painPill(ch)}</div>
    <div><b>Травмы:</b><div class="chips">${injuries}</div></div>
    <div><b>Статусы:</b>${statuses}</div>
    <div class="row"><button onclick="requestHeal(${ch.id})">Запросить лечение</button>${ch.armor_enabled ? `<button class="warn" onclick="requestRepair(${ch.id})">Ремонт брони</button>`:''}</div>
    <div class="muted">Чтобы запросить стабилизацию или полное лечение травмы, нажми на саму травму.</div>
    ${renderInventoryBlock(ch)}
    <div id="playerOut"></div>
  </div>`;
}


async function openUserProfile(telegramId) {
  if (!telegramId) return showToast('Профиль игрока недоступен: персонаж не привязан к Telegram.', 'error');
  try {
    const profile = await api(`/api/users/${telegramId}/profile`);
    state.profileCache[String(telegramId)] = profile;
    const main = profile.main_character || {};
    const grants = profile.achievement_grants || [];
    const chars = profile.characters || [];
    const camps = profile.campaigns || [];
    const ach = grants.slice(0, 18).map(g => `<button class="achievement-row-card profile-ach-row" onclick="openProfileAchievement(${Number(g.id)}, ${Number(telegramId)})"><span class="achievement-row-icon">${achIconHtml(g.achievement?.icon || '🏆', '', g.achievement?.icon_thumb || '')}</span><span><b>${esc(g.achievement?.title || 'Достижение')}</b></span></button>`).join('') || '<div class="muted">Достижений пока нет.</div>';
    const charList = chars.map(ch => `<div class="profile-line" style="--char-color:${esc(ch.color || '#72a7ff')}">${avatarCircle(ch, 'xs')}<b>${esc(ch.name)}</b>${characterTagPill(ch)}<small>${hpText(ch)}</small></div>`).join('') || '<div class="muted">Персонажей нет.</div>';
    const campList = camps.map(c => `<span class="tag-pill">${esc(c.name)}</span>`).join('') || '<span class="muted">Кампаний нет.</span>';
    showModal(`<div class="modal-card profile-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="profile-hero-big">${avatarCircle(main, 'xxl')}<div><div class="name profile-name-line">${esc(main.name || 'Профиль игрока')} ${characterTagPill(main)}</div><div class="muted">Telegram ID: ${esc(profile.telegram_user_id)}</div></div></div><div class="profile-section"><div class="profile-section-title">🏆 Ачивки</div><div class="achievement-row-list">${ach}</div></div><div class="profile-section"><div class="profile-section-title">🧙 Персонажи</div><div class="stack">${charList}</div></div><div class="profile-section"><div class="profile-section-title">🗺️ Кампании</div><div class="chips">${campList}</div></div></div>`);
  } catch(e) { showToast(e.message, 'error'); }
}
function showSubModal(html) {
  const old = document.getElementById('subModalRoot');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'subModalRoot';
  wrap.className = 'submodal-backdrop';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
}
function closeSubModal() {
  const old = document.getElementById('subModalRoot');
  if (old) old.remove();
}
async function openProfileAchievement(grantId, telegramId) {
  const profile = state.profileCache?.[String(telegramId)] || await api(`/api/users/${telegramId}/profile`);
  state.profileCache[String(telegramId)] = profile;
  const g = (profile.achievement_grants || []).find(x => Number(x.id) === Number(grantId));
  if (!g) return;
  const a = g.achievement || {};
  showSubModal(`<div class="modal-card achievement-modal sub-achievement-modal"><button class="modal-close" onclick="closeSubModal()">×</button><div class="achievement-full-head"><button class="ach-icon huge icon-open-btn" onclick="openImageModal('${esc(achIconFullPath(a))}', '${esc(a.title || 'Достижение')}')">${achIconHtml(a.icon || '🏆', '', '')}</button><div><div class="name">${esc(a.title || 'Достижение')}</div></div></div><p>${esc(a.description || 'Без описания')}</p>${g.master_comment?`<div class="master-comment"><b>Комментарий мастера</b><p>${esc(g.master_comment)}</p></div>`:''}<div class="muted">Получено: ${esc(g.created_at_msk || formatMsk(g.created_at))}</div><button class="secondary" onclick="closeSubModal()">Назад к профилю</button></div>`);
}

function renderParty() {
  const team = state.campaignState?.team_characters || [];
  if (!team.length) return '<div class="card muted">В отряде пока никого нет.</div>';
  return `<div class="card stack"><div class="name">🧭 Отряд</div><div class="muted">Нажми на персонажа, чтобы открыть профиль игрока.</div><div class="party-grid">${team.map(ch => `<button class="party-card party-card-button" style="--char-color:${esc(ch.color || '#72a7ff')}" onclick="openUserProfile(${Number(ch.telegram_user_id || 0)})">${avatarCircle(ch, 'md')}<div class="party-main"><b>${esc(ch.name)}</b>${characterTagPill(ch)}<span class="${hpClass(ch)}">${hpText(ch)}</span></div><span class="badge ${ch.injury_count ? 'danger':'ok'}">травмы: ${ch.injury_count || 'нет'}</span></button>`).join('')}</div></div>`;
}

function isActualMasterOfCurrentCampaign() {
  return !!(state.me?.campaigns || []).find(c => Number(c.id) === Number(state.currentCampaignId) && c.role === 'master');
}

function devViewCharacterOptions() {
  const own = state.campaignState?.player_character ? [state.campaignState.player_character] : [];
  const all = state.campaignState?.role === 'master' ? allChars() : (state.campaignState?.team_characters || []);
  const seen = new Set();
  return [...own, ...all].filter(ch => ch && !seen.has(Number(ch.id)) && seen.add(Number(ch.id)));
}

function devViewPanel() {
  if (!state.me?.dev_mode || !isActualMasterOfCurrentCampaign()) return '';
  const current = localStorage.getItem('dev_view_character_id') || '';
  const chars = devViewCharacterOptions();
  const options = chars.map(ch => `<option value="${ch.id}" ${String(ch.id)===String(current)?'selected':''}>${esc(ch.name)}</option>`).join('');
  return `<div class="dev-switch-box">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><b>🧪 DEV-сборка</b><p class="muted">Можно тестировать игрока с этого же устройства. В PROD поставь <code>DEV_MODE=0</code> в .env.</p></div>
      <span class="tag-pill">DEV_MODE=1</span>
    </div>
    <label>Тестовый вид</label>
    <select onchange="setDevViewCharacter(this.value)">
      <option value="" ${!current?'selected':''}>Мастер</option>
      ${options}
    </select>
  </div>`;
}

function renderCampaignSettingsCard() {
  const c = state.campaignState?.campaign || {};
  const role = state.campaignState?.role === 'master' ? 'мастер' : 'игрок';
  const campaigns = state.me?.campaigns || [];
  const options = campaigns.map(x => `<option value="${x.id}" ${x.id===state.currentCampaignId?'selected':''}>${esc(x.name)} — ${x.role === 'master' ? 'мастер' : 'игрок'}</option>`).join('');
  return `<details class="card stack campaign-settings-card custom-collapse" ${sectionAttrs('campaign-info-settings')}>
    <summary><div class="unique-custom-head"><span>🎛</span><div><b>${esc(c.name || 'Кампания')}</b><small>Информация о кампании, режим окна и переключение</small></div></div></summary>
    <div class="custom-collapse-body stack">
      <div class="muted">Роль: ${esc(role)} · травмы: ${c.injuries_enabled?'включены':'выключены'} · броня: ${c.armor_enabled?'включена':'выключена'} · оружие: ${c.weapons_enabled?'включено':'выключено'}</div>
      <label>Переключить кампанию</label><select onchange="switchCampaign(this.value)"><option value="0">Главная</option>${options}</select>
      <div class="row"><button class="secondary" onclick="switchCampaign(0)">На главную</button></div>
      <div class="row"><button class="secondary" onclick="toggleWindowMode()">${localStorage.getItem('force_window_mode') === '1' ? 'Вернуться в fullscreen' : 'Оконный режим на ПК'}</button></div>
      <div class="muted">Также можно обновить экран свайпом вниз, как в Telegram.</div>
      ${devViewPanel()}
    </div>
  </details>`;
}

function setDevViewCharacter(value) {
  rememberUiScroll();
  if (value) localStorage.setItem('dev_view_character_id', String(value));
  else localStorage.removeItem('dev_view_character_id');
  state.tab = 'characters';
  refreshAll().then(() => showToast(value ? 'Открыт тестовый вид игрока' : 'Открыт вид мастера', 'info')).catch(e => alert(e.message));
}


function sparkManagement() { return state.campaignState?.spark_management || {}; }
function sparkKindLabel(kind) {
  return ({grant:'выдача', revoke:'коррекция', topup:'пополнение', achievement:'ачивка'})[String(kind || '')] || String(kind || 'операция');
}
function sparkGuideHtml() {
  return `<div class="spark-guide">
    <div class="spark-guide-title">Как выдавать искры, чтобы не сломать магазин</div>
    <p>Искры — это не ежедневная зарплата, а редкая награда за моменты, которые делают игру ярче. Лучше выдавать меньше, но осознанно: игрок должен понимать, за что получил награду.</p>
    <div class="spark-guide-grid">
      <div><b>10–25 ✦</b><span>маленькая сцена, удачная реплика, помощь группе, хорошая идея</span></div>
      <div><b>25–60 ✦</b><span>сильный отыгрыш, рискованное решение, вклад в атмосферу</span></div>
      <div><b>60–150 ✦</b><span>важная сцена персонажа, победа над сложной задачей, мини-достижение</span></div>
      <div><b>150–350 ✦</b><span>крупная сюжетная победа, редкая ачивка, завершение значимой арки</span></div>
    </div>
    <p class="muted">Ориентир магазина: обычное качество примерно 40–90 ✦, редкое 120–260 ✦, эпическое 350–750 ✦, легендарное 1000–2000 ✦. Две легендарные вещи могут стоить по-разному: простая легендарка ближе к 1000 ✦, уникальная и визуально сильная — ближе к 2000 ✦.</p>
  </div>`;
}
function sparkHistoryHtml(history) {
  const rows = history || [];
  if (!rows.length) return '<div class="muted">История выдачи пока пустая.</div>';
  return `<div class="spark-history-list">${rows.map(t => {
    const delta = Number(t.reserve_delta || 0);
    const amount = Number(t.amount || 0);
    const sign = amount > 0 ? '+' : '';
    const target = t.target_character_name || (t.target_tg_id ? `TG ${t.target_tg_id}` : 'запас мастера');
    const cls = delta >= 0 ? 'plus' : 'minus';
    return `<div class="spark-history-row ${cls}"><b>${sign}${esc(amount)} ✦</b><div><span>${esc(sparkKindLabel(t.kind))} · ${esc(target)}</span><small>${esc(t.comment || t.campaign_name || '')}</small></div><em>${esc(t.created_at_msk || '')}</em></div>`;
  }).join('')}</div>`;
}
function renderSparkAdminMasters(sm) {
  const masters = sm.masters || [];
  if (!masters.length) return '<div class="muted">Мастеров с кампаниями пока нет.</div>';
  return `<div class="spark-master-list">${masters.map(m => {
    const id = Number(m.master_tg_id || 0);
    return `<details class="spark-master-card custom-collapse" ${sectionAttrs('spark-master-'+id)}>
      <summary><div><b>${esc(m.display_name || ('Мастер TG '+id))}</b><small>${esc(m.campaign_names || 'Кампании не указаны')}</small></div><span class="spark-balance-pill">✦ ${esc(m.balance || 0)}</span></summary>
      <div class="custom-collapse-body stack">
        <div class="grid two"><label>Пополнить запас<input id="sparkTopupAmount_${id}" type="number" min="1" value="500"></label><label>Комментарий<input id="sparkTopupComment_${id}" placeholder="Плановая выдача / бонус за сезон"></label></div>
        <button class="ok small" onclick="topUpMasterSparks(${id})">Пополнить запас мастера</button>
        <div class="spark-subtitle">История мастера</div>${sparkHistoryHtml(m.history || [])}
      </div>
    </details>`;
  }).join('')}</div>`;
}
function renderSparkManagementCard() {
  const sm = sparkManagement();
  const balance = Number(sm.balance || 0);
  const isAdmin = !!sm.is_admin;
  return `<details class="card stack spark-management-card custom-collapse" ${sectionAttrs('spark-management')}>
    <summary><div class="unique-custom-head"><span>✦</span><div><b>Менеджмент искр</b><small>Запас мастера, правила выдачи и история операций</small></div></div><span class="spark-balance-pill">✦ ${esc(balance)}</span></summary>
    <div class="custom-collapse-body stack">
      <div class="spark-balance-hero"><div><span>Запас искр мастера</span><b>✦ ${esc(balance)}</b></div><small>Из этого запаса списываются ручные выдачи игрокам и награды искрами за достижения.</small></div>
      ${sparkGuideHtml()}
      <details class="custom-section nested-shop" ${sectionAttrs('spark-my-history')}><summary><b>📜 Моя история выдачи</b></summary>${sparkHistoryHtml(sm.history || [])}</details>
      ${isAdmin ? `<details class="custom-section nested-shop" ${sectionAttrs('spark-admin')}><summary><b>👑 Главное управление запасами</b><small>Все мастера, их баланс и история</small></summary>${renderSparkAdminMasters(sm)}</details>` : ''}
    </div>
  </details>`;
}
async function topUpMasterSparks(masterId) {
  try {
    const amount = Number(val(`sparkTopupAmount_${masterId}`) || 0);
    if (!amount || amount < 1) throw new Error('Укажи положительное пополнение');
    const out = await api('/api/sparks/admin/top-up', {method:'POST', body:{master_tg_id:Number(masterId), amount, comment:val(`sparkTopupComment_${masterId}`)}});
    state.campaignState.spark_management = out.spark_management || state.campaignState.spark_management;
    showToast('Запас искр пополнен', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}

function renderMasterSettings() {
  return `<div class="stack">${renderSparkManagementCard()}${renderCampaignSettingsCard()}</div>`;
}

function renderPlayerSettings() {
  const ch = playerChar();
  if (!ch) return '<div class="card">Персонаж не найден.</div>';
  const customBlock = renderUniqueCustomizationBlock(ch);
  return `<div class="stack settings-page">
    <div class="card stack settings-card profile-basic-card" style="--char-color:${esc(ch.color || '#72a7ff')}">
      <div class="player-hero profile-settings-hero">${avatarCircle(ch, 'lg')}<div><div class="name">⚙️ Настройки персонажа</div><div class="muted">Имя, цвет и аватарка.</div><div class="currency-pill big">✦ ${currencyBalance()} искр</div></div></div>
      <div class="grid two profile-settings-main-grid">
        <div class="name-edit-box"><label>Имя персонажа<input id="selfName" value="${esc(ch.name)}" maxlength="80"></label><button class="ok save-name-btn" onclick="savePlayerSettings(${ch.id})">Сохранить имя</button></div>
        <div><div class="modal-title-lite">Цвет персонажа</div>${colorPickerHtml('selfColor', ch.color || '#72a7ff')}</div>
      </div>
      <div class="hr"></div>
      <div class="avatar-upload-block">
        <div class="name">Аватарка</div>
        <p class="muted">Выбери изображение, перетащи его в нужное положение и сохрани.</p>
        <input id="avatarFile" class="visually-hidden" type="file" accept="image/*" onchange="openAvatarCropModal(${ch.id}, 'avatarFile')">
        <div id="avatarPreview" class="avatar-preview">${avatarCircle(ch, 'xl')}</div>
        <label class="file-button" for="avatarFile">Выбрать новую аватарку</label>
      </div>
      <div id="settingsOut"></div>
    </div>
    <div class="card stack customization-card"><div class="shop-standalone-head"><div><div class="name">🎨 Кастомизация</div><p class="muted">Нажми на любую рамку или эффект, чтобы открыть предпросмотр. Купленную косметику можно применить из окна предпросмотра.</p></div><span class="currency-pill">✦ ${currencyBalance()}</span></div>${customBlock}</div>
    ${renderCampaignSettingsCard()}
  </div>`;
}


function groupByRarity(items) {
  const order = ['common','rare','epic','legendary','unique'];
  const groups = {};
  for (const it of items) (groups[displayRarity(it)] ||= []).push(it);
  return order.filter(r => groups[r]?.length).map(r => ({rarity:r, items:groups[r]}));
}
function rarityGroupHtml(title, items, renderCard) {
  const groups = groupByRarity(items);
  if (!groups.length) return '<div class="muted">Пока пусто.</div>';
  return groups.map(g => `<div class="rarity-group rarity-${esc(g.rarity)}"><div class="rarity-title">${rarityEmoji(g.rarity)} ${esc(rarityRu(g.rarity))}</div><div class="frame-grid">${g.items.map(renderCard).join('')}</div></div>`).join('');
}
function renderUniqueCustomizationBlock(ch) {
  const selected = String(ch.custom_frame || '');
  const selectedEffect = normalizedEffectId(ch.custom_effect || '');
  const selectedText = String(ch.custom_tag || '');
  const selectedShape = String(ch.custom_tag_style || defaultTagShapeId()) === 'tag_none' ? defaultTagShapeId() : String(ch.custom_tag_style || defaultTagShapeId());
  const unlocked = unlockedCosmeticSet();
  const unlockedEffects = unlockedEffectSet();
  const frameIsAvailable = c => displayRarity(c) === 'common' || unlocked.has(c.id);
  const effectIsAvailable = e => String(e.id) === 'effect_none' || String(e.rarity || 'common') === 'common' || unlockedEffects.has(e.id);
  const textIsAvailable = t => tagIsUnlocked(t);
  const shapeIsAvailable = t => tagIsUnlocked(t);
  const frames = availableFirst(baseCosmetics().concat(uniqueCosmetics()), frameIsAvailable);
  const effects = availableFirst(visibleEffects(), effectIsAvailable);
  const shapes = availableFirst(tagShapes(), shapeIsAvailable);
  const texts = availableFirst(tagTexts(), textIsAvailable);
  const noFrame = `<button type="button" class="frame-choice plain ${selected===''?'selected':''}" onclick="showCosmeticPreviewModal('frame', emptyCustomizationItem('frame'), false, ${ch.id})"><span class="frame-demo plain">○</span><b>Без рамки</b><small>только цвет персонажа</small></button>`;
  const noEffect = `<button type="button" class="frame-choice plain ${selectedEffect===''?'selected':''}" onclick="showCosmeticPreviewModal('effect', emptyCustomizationItem('effect'), false, ${ch.id})"><span class="frame-demo plain">○</span><b>Без эффекта</b><small>только выбранная рамка</small></button>`;
  const frameHtml = `<div class="frame-grid">${noFrame}</div>` + rarityGroupHtml('Рамки', frames, c => cosmeticChoiceCard(ch.id, c, frameIsAvailable(c), selected));
  const effectHtml = `<div class="frame-grid">${noEffect}</div>` + rarityGroupHtml('Эффекты', effects, e => effectChoiceCard(ch.id, e, effectIsAvailable(e), selectedEffect));
  const currentText = ch.custom_tag_text || (tagById(selectedText)?.name || '');
  const tagPreview = currentText ? `<div class="tag-current-preview"><span>Сейчас:</span>${characterTagPill(ch, 'preview')}</div>` : `<div class="tag-current-preview muted">Тэг сейчас выключен.</div>`;
  const noTag = `<button type="button" class="frame-choice plain ${selectedText===''?'selected':''}" onclick="saveCustomTagText(${ch.id}, '')"><span class="tag-preview-demo">—</span><b>Без текста</b><small>тэг не отображается</small></button>`;
  const shapeHtml = rarityGroupHtml('Формы', shapes, t => tagShapeChoiceCard(ch.id, t, shapeIsAvailable(t), selectedShape, currentText || 'Пример'));
  const textHtml = `<div class="frame-grid">${noTag}</div>` + rarityGroupHtml('Тексты', texts, t => tagTextChoiceCard(ch.id, t, textIsAvailable(t), selectedText, selectedShape));
  return `<div class="customization-sections compact-customization">
    <details class="custom-section frames custom-collapse" ${sectionAttrs('player-custom-frames')}>
      <summary><div class="unique-custom-head"><span>🖼️</span><div><b>Рамки</b><small>Базовые и открытые уникальные рамки. Разделены по редкости.</small></div></div></summary>
      <div class="custom-collapse-body">${frameHtml}</div>
    </details>
    <details class="custom-section effects custom-collapse" ${sectionAttrs('player-custom-effects')}>
      <summary><div class="unique-custom-head"><span>✨</span><div><b>Эффекты рамок</b><small>Дополняют рамку и не заменяют её.</small></div></div></summary>
      <div class="custom-collapse-body">${effectHtml}</div>
    </details>
    <div class="custom-section tags custom-collapse disabled-tags-section" aria-disabled="true">
      <div class="disabled-tags-inner">
        <div class="unique-custom-head"><span>🏷️</span><div><b>Тэги</b><small>Раздел временно закрыт.</small></div></div>
        <div class="disabled-tags-message"><b>Добавится потом</b><span>Формы и тексты тэгов пока недоступны для выбора и покупки. Мы вернём этот раздел после доработки баланса и интерфейса.</span></div>
      </div>
    </div>
  </div>`;
}

function cosmeticChoiceCard(charId, c, available, selected) {
  const cls = frameClassFor(c.id);
  const cRarity = displayRarity(c);
  const isSelected = selected === c.id;
  const demo = c.asset_path ? `<span class="frame-demo image-frame-demo"><img loading="lazy" src="${esc(cosmeticImgPath(c))}" alt=""></span>` : `<span class="frame-demo ${esc(cls)}">${esc(c.emoji || '✨')}</span>`;
  if (!available) {
    return `<button type="button" class="frame-choice locked-choice rarity-${esc(cRarity)} ${esc(cls)}" onclick="showLockedCosmetic('${esc(c.id)}', ${Number(charId)})">${demo}<span class="lock-badge">🔒</span><b>${esc(c.name)}</b><small>${cosmeticMetaLabel(c)}</small></button>`;
  }
  return `<button type="button" class="frame-choice unlocked-choice rarity-${esc(cRarity)} ${esc(cls)} ${isSelected?'selected':''}" onclick="showCosmeticPreviewModal('frame', cosmeticById('${esc(c.id)}'), false, ${Number(charId)})">${demo}<span class="owned-badge">✓</span><b>${esc(c.name)}</b><small>${cosmeticMetaLabel(c)}</small></button>`;
}


function effectChoiceCard(charId, e, available, selected) {
  const cls = effectClassFor(e.id);
  const isSelected = selected === e.id;
  const demo = effectPreviewHtml(e, '', isSelected);
  if (!available) {
    return `<button type="button" class="frame-choice locked-choice effect-card rarity-${esc(e.rarity || 'common')} ${esc(cls)}" onclick="showLockedEffect('${esc(e.id)}', ${Number(charId)})">${demo}<span class="lock-badge">🔒</span><b>${esc(e.name)}</b><small>${effectMetaLabel(e)}</small></button>`;
  }
  return `<button type="button" class="frame-choice unlocked-choice effect-card rarity-${esc(e.rarity || 'common')} ${esc(cls)} ${isSelected?'selected':''}" onclick="showCosmeticPreviewModal('effect', effectById('${esc(e.id)}'), false, ${Number(charId)})">${demo}<span class="owned-badge">✓</span><b>${esc(e.name)}</b><small>${effectMetaLabel(e)}</small></button>`;
}



function tagShapePreview(t, text='Пример') {
  return `<span class="tag-preview-demo"><span class="character-tag rarity-${esc(t.rarity || 'common')} ${esc(t.css_class || tagClassFor(t.id))}">${t.emoji?`<span>${esc(t.emoji)}</span>`:''}<b>${esc(text || 'Пример')}</b></span></span>`;
}
function tagTextPreview(t, shapeId='') {
  const shape = tagById(shapeId) || tagById(defaultTagShapeId()) || {rarity:'common', emoji:'🏷️', css_class:'tag-shape-classic'};
  return `<span class="tag-preview-demo"><span class="character-tag rarity-${esc(shape.rarity || t.rarity || 'common')} ${esc(shape.css_class || tagClassFor(shape.id))}">${shape.emoji?`<span>${esc(shape.emoji)}</span>`:''}<b>${esc(t.name)}</b></span></span>`;
}
function tagShapeChoiceCard(charId, t, available, selected, sampleText='Пример') {
  const isSelected = selected === t.id || (!selected && t.id === defaultTagShapeId());
  const demo = tagShapePreview(t, sampleText);
  if (!available) return `<button type="button" class="frame-choice locked-choice tag-card rarity-${esc(t.rarity || 'common')}" onclick="showLockedTag('${esc(t.id)}')">${demo}<span class="lock-badge">🔒</span><b>${esc(t.name)}</b><small>${tagMetaLabel(t)}</small></button>`;
  return `<button type="button" class="frame-choice unlocked-choice tag-card rarity-${esc(t.rarity || 'common')} ${isSelected?'selected':''}" onclick="saveCustomTagShape(${charId}, '${esc(t.id)}')">${demo}<span class="owned-badge">✓</span><b>${esc(t.name)}</b><small>${tagMetaLabel(t)}</small></button>`;
}
function tagTextChoiceCard(charId, t, available, selected, shapeId='') {
  const isSelected = selected === t.id;
  const demo = tagTextPreview(t, shapeId);
  if (!available) return `<button type="button" class="frame-choice locked-choice tag-card rarity-${esc(t.rarity || 'common')}" onclick="showLockedTag('${esc(t.id)}')">${demo}<span class="lock-badge">🔒</span><b>${esc(t.name)}</b><small>${tagMetaLabel(t)}</small></button>`;
  return `<button type="button" class="frame-choice unlocked-choice tag-card rarity-${esc(t.rarity || 'common')} ${isSelected?'selected':''}" onclick="saveCustomTagText(${charId}, '${esc(t.id)}')">${demo}<span class="owned-badge">✓</span><b>${esc(t.name)}</b><small>${tagMetaLabel(t)}</small></button>`;
}
function showLockedTag(id) {
  showToast('Раздел тэгов добавится позже', 'warn'); return;
  const t = tagById(id);
  const isShape = String(t?.category || '') === 'tag_shape' || String(t?.category || '') === 'base';
  showModal(`<div class="modal-card compact unique-modal locked-custom-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="name">🔒 ${esc(t?.name || 'Тэг закрыт')}</div>
    <div class="locked-preview-card rarity-${esc(t?.rarity || 'legendary')}">${isShape ? tagShapePreview(t || {}, 'Пример') : tagTextPreview(t || {}, defaultTagShapeId())}<small>${tagMetaLabel(t)}</small><p class="muted">${esc(t?.description || '')}</p></div>
    <div class="row modal-actions">${shopActionButton('tag', t)}<button class="secondary" onclick="closeModal()">Назад</button></div>
  </div>`);
}
async function saveCustomTagShape(id, shapeId) {
  showToast('Раздел тэгов пока недоступен', 'warn'); return;
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_tag_style: shapeId || defaultTagShapeId()}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast('Форма тэга применена', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}
async function saveCustomTagText(id, tag) {
  showToast('Раздел тэгов пока недоступен', 'warn'); return;
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_tag: tag || ''}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(tag ? 'Текст тэга применён' : 'Тэг отключён', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}
// обратная совместимость со старыми onclick
async function saveCustomTag(id, tag) { return saveCustomTagText(id, tag); }

function renderShopBlock(ch) {
  return `<div class="card stack shop-standalone-card">
    <div class="shop-standalone-head"><div><div class="name">🛒 Магазин косметики</div><div class="muted">Покупка рамок и эффектов за искры. Раздел тэгов временно закрыт и вернётся позже.</div></div><span class="currency-pill">✦ ${currencyBalance()}</span></div>
    <div class="shop-tabs">
      <details class="custom-section nested-shop" ${sectionAttrs('shop-frames')}><summary><b>🖼️ Рамки</b></summary>${shopItemsHtml('frame', cosmetics().filter(x=>x.category !== 'base'))}</details>
      <details class="custom-section nested-shop" ${sectionAttrs('shop-effects')}><summary><b>✨ Эффекты</b></summary>${shopItemsHtml('effect', cosmeticEffects().filter(x=>x.id !== 'effect_none' && x.category !== 'base' && isModernEffectId(x.id)))}</details>
      <div class="custom-section nested-shop disabled-tags-section shop-disabled-tags" aria-disabled="true"><div class="disabled-tags-inner"><div class="unique-custom-head"><span>🏷️</span><div><b>Тэги</b><small>Добавится потом</small></div></div><div class="disabled-tags-message"><b>Раздел тэгов закрыт</b><span>Формы и тексты тэгов временно недоступны для покупки.</span></div></div></div>
      <details class="custom-section nested-shop" ${sectionAttrs('shop-history')}><summary><b>📜 История искр</b></summary>${currencyHistoryHtml()}</details>
    </div>
  </div>`;
}

function shopItemsHtml(kind, items) {
  const unlocked = kind==='frame' ? unlockedCosmeticSet() : kind==='effect' ? unlockedEffectSet() : unlockedTagSet();
  return rarityGroupHtml('shop', items, item => shopItemCard(kind, item, unlocked.has(item.id) || displayRarity(item)==='common'));
}
function shopItemCard(kind, item, unlocked) {
  const isUnique = displayRarity(item) === 'unique' || item.rarity === 'unique';
  let preview = '';
  if (kind === 'frame') preview = item.asset_path ? `<span class="frame-demo image-frame-demo"><img loading="lazy" src="${esc(cosmeticImgPath(item))}" alt=""></span>` : `<span class="frame-demo ${esc(frameClassFor(item.id))}">${esc(item.emoji || '✨')}</span>`;
  if (kind === 'effect') {
    const ch = playerChar();
    const isApplied = normalizedEffectId(ch?.custom_effect || '') === String(item.id || '');
    preview = effectPreviewHtml(item, '', isApplied);
  }
  if (kind === 'tag') preview = String(item.category || '') === 'tag_shape' ? tagShapePreview(item, 'Пример') : tagTextPreview(item, defaultTagShapeId());
  const action = unlocked ? '<span class="shop-status owned">куплено</span>' : isUnique ? '<span class="shop-status locked">только за ачивку</span>' : `<span class="shop-status price">${priceLabel(item)}</span>`;
  return `<div class="frame-choice shop-buy-card rarity-${esc(displayRarity(item))}" role="button" tabindex="0" onclick="openShopPreview('${kind}','${esc(item.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openShopPreview('${kind}','${esc(item.id)}')}">${preview}<b>${esc(item.name)}</b><small>${rarityEmoji(displayRarity(item))} ${esc(rarityRu(displayRarity(item)))}</small>${action}</div>`;
}
async function buyShopItem(kind, id, charId=null) {
  try {
    const out = await api('/api/shop/purchase', {method:'POST', body:{item_type:kind, item_id:id}});
    state.campaignState.unlocked_cosmetic_ids = out.unlocked_cosmetic_ids || state.campaignState.unlocked_cosmetic_ids;
    state.campaignState.unlocked_effect_ids = out.unlocked_effect_ids || state.campaignState.unlocked_effect_ids;
    state.campaignState.unlocked_tag_ids = out.unlocked_tag_ids || state.campaignState.unlocked_tag_ids;
    state.campaignState.currency_balance = out.currency_balance;
    state.campaignState.currency_transactions = out.currency_transactions || state.campaignState.currency_transactions;
    showToast(out.message || 'Покупка выполнена', 'heal');
    renderCampaign();
    const item = kind === 'frame' ? cosmeticById(id) : kind === 'effect' ? effectById(id) : null;
    if (item) showCosmeticPreviewModal(kind, item, false, charId);
    else closeModal();
  } catch(e) { showToast(e.message, 'error'); }
}
function currencyHistoryHtml(){
  const tx = state.campaignState?.currency_transactions || [];
  if (!tx.length) return '<div class="muted">Истории операций пока нет.</div>';
  return `<div class="stack">${tx.map(t=>`<div class="currency-row ${Number(t.amount)>=0?'plus':'minus'}"><b>${Number(t.amount)>=0?'+':''}${esc(t.amount)} ✦</b><span>${esc(t.reason || 'операция')}</span><small>${esc(t.created_at_msk || '')}</small></div>`).join('')}</div>`;
}

function shopItemAvailable(kind, item) {
  if (!item) return false;
  if (kind === 'frame') return String(item.id || '') === '' || displayRarity(item) === 'common' || unlockedCosmeticSet().has(String(item.id));
  if (kind === 'effect') return String(item.id || '') === '' || String(item.id) === 'effect_none' || String(item.rarity || 'common') === 'common' || unlockedEffectSet().has(String(item.id));
  return false;
}
function shopItemSelected(kind, item, charId=null) {
  const ch = charId ? findChar(Number(charId)) : playerChar();
  if (!ch || !item) return false;
  if (kind === 'frame') return String(ch.custom_frame || '') === String(item.id || '');
  if (kind === 'effect') return normalizedEffectId(ch.custom_effect || '') === String(item.id || '');
  return false;
}
async function applyShopItem(kind, id, charId=null) {
  const ch = charId ? findChar(Number(charId)) : playerChar();
  if (!ch?.id) return showToast('Сначала выбери персонажа', 'error');
  if (kind === 'frame') return saveCustomFrame(Number(ch.id), String(id || ''));
  if (kind === 'effect') return saveCustomEffect(Number(ch.id), String(id || ''));
}
function shopActionButton(kind, item, charId=null) {
  if (!item || kind === 'tag') return '';
  const rarity = displayRarity(item);
  const available = shopItemAvailable(kind, item);
  if (available) {
    const selected = shopItemSelected(kind, item, charId);
    if (selected) return `<button class="ok" disabled>Применено</button>`;
    return `<button class="ok" onclick="event.stopPropagation(); applyShopItem('${kind}','${esc(item.id || '')}', ${charId ? Number(charId) : 'null'})">Применить</button>`;
  }
  if (rarity === 'unique' || item.rarity === 'unique' || item.purchasable === 0) {
    return '<span class="shop-status locked">Можно получить только за достижение</span>';
  }
  return `<button class="ok" onclick="event.stopPropagation(); buyShopItem('${kind}','${esc(item.id)}', ${charId ? Number(charId) : 'null'})">Купить за ${priceLabel(item)}</button>`;
}

function framePreviewHtml(c, extraClass='') {
  if (!c) return `<span class="frame-demo plain ${esc(extraClass)}">○</span>`;
  return c.asset_path
    ? `<span class="frame-demo image-frame-demo ${esc(extraClass)}"><img loading="lazy" src="${esc(cosmeticImgPath(c))}" alt=""></span>`
    : `<span class="frame-demo ${esc(frameClassFor(c.id))} ${esc(extraClass)}">${esc(c.emoji || '✨')}</span>`;
}

function effectPreviewHtml(e, extraClass='', active=false) {
  const id = String(e?.id || '');
  if (!id || id === 'effect_none') return `<div class="effect-choice-preview ${esc(extraClass)}"><span class="frame-demo plain effect-none-demo">○</span></div>`;
  const cls = effectClassFor(id);
  const activeClass = active ? ' effect-force-active' : '';
  return `<div class="effect-choice-preview ${esc(extraClass)}"><span class="fx-avatar-shell md fx-preview-shell${activeClass} ${esc(cls)}" data-effect-id="${esc(id)}"><span class="avatar md avatar-empty effect-avatar-sample" style="--char-color:#ff6b8a"><span class="avatar-initial">○</span></span></span></div>`;
}

function showCosmeticPreviewModal(kind, item, locked=false, charId=null) {
  if (!item) return;
  if (kind === 'tag') { showToast('Раздел тэгов добавится позже', 'warn'); return; }
  const rarity = kind === 'frame' ? displayRarity(item) : (item.rarity || 'common');
  const preview = kind === 'frame' ? framePreviewHtml(item, 'modal-frame-preview-active') : effectPreviewHtml(item, 'modal-effect-preview-active', true);
  const titleIcon = kind === 'frame' ? '🖼️' : '✨';
  const title = `${locked ? '🔒 ' : ''}${titleIcon} ${esc(item.name || item.id)}`;
  const desc = esc(item.description || (kind === 'frame' ? 'Рамка для аватарки персонажа.' : 'Эффект проигрывается в предпросмотре и будет масштабироваться под размер аватарки.'));
  showModal(`<div class="modal-card compact unique-modal locked-custom-modal cosmetic-preview-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="name">${title}</div>
    <div class="locked-preview-card rarity-${esc(rarity)} ${kind === 'effect' ? 'effect-card' : ''}">${preview}<b>${esc(item.name || item.id)}</b><small>${kind === 'frame' ? cosmeticMetaLabel(item) : effectMetaLabel(item)}</small></div>
    <p class="muted centered-text">${desc}</p>
    <div class="row modal-actions">${shopActionButton(kind, item, charId)}<button class="secondary" onclick="closeModal()">Назад</button></div>
  </div>`);
}

function openShopPreview(kind, id) {
  const ch = playerChar();
  if (kind === 'frame') return showCosmeticPreviewModal('frame', cosmeticById(id), false, ch?.id || null);
  if (kind === 'effect') return showCosmeticPreviewModal('effect', effectById(id), false, ch?.id || null);
  showToast('Раздел тэгов добавится позже', 'warn');
}

function showLockedCosmetic(id, charId=null) {
  const c = cosmeticById(id);
  showCosmeticPreviewModal('frame', c || {id: id ? String(id) : '__locked_frame__', name:'Рамка закрыта', rarity:'legendary', purchasable:0}, true, charId);
}

function showLockedEffect(id, charId=null) {
  const e = effectById(id);
  showCosmeticPreviewModal('effect', e || {id: id ? String(id) : '__locked_effect__', name:'Эффект закрыт', rarity:'legendary', purchasable:0}, true, charId);
}


function openUniqueCustomizationLocked(){ showLockedCosmetic(''); }

async function saveCustomFrame(id, frame) {
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_frame: frame}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(frame ? 'Сверкающая рамка применена' : 'Рамка отключена', 'heal');
    closeModal();
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}


async function saveCustomEffect(id, effect) {
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_effect: effect}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(effect ? 'Эффект рамки применён' : 'Эффект отключён', 'heal');
    closeModal();
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}

async function sendPlayerRequest(id, type, payload={}) {
  try {
    const out=await api(`/api/characters/${id}/request`, {method:'POST', body:{request_type:type, ...payload}});
    closeModal();
    showToast(out.message || 'Заявка отправлена мастеру', 'heal');
    const el=document.getElementById('playerOut'); if(el) el.innerHTML=msg(out.message);
  } catch(e){
    showModalNotice(e.message, 'error');
  }
}
function requestHeal(id) {
  const ch = findChar(id);
  showModal(`<div class="modal-card compact heal-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">💚 Запрос лечения</div><p class="muted">${esc(ch?.name || 'Персонаж')} сейчас: ${hpText(ch)}. Укажи, сколько HP хочешь восстановить.</p><input id="healAmount" class="big-number" type="number" min="1" placeholder="Например: 12"><div class="row modal-actions"><button class="ok" onclick="submitHealRequest(${id})">Отправить мастеру</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
  setTimeout(() => document.getElementById('healAmount')?.focus(), 30);
}
function submitHealRequest(id) { const amount = num('healAmount', 0); if (amount <= 0) return showModalNotice('Введите число больше 0', 'error'); sendPlayerRequest(id, 'heal', {hp_amount: amount}); }
function requestRepair(id) {
  showModal(`<div class="modal-card compact heal-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">🛠 Запрос ремонта брони</div><p class="muted">Кинь d20 и введи результат. Ровно 20 = крит, больше 20 не считается критом.</p><input id="repairRoll" class="big-number" type="number" min="1" placeholder="Результат d20"><div class="row modal-actions"><button class="warn" onclick="submitRepairRequest(${id})">Отправить мастеру</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
  setTimeout(() => document.getElementById('repairRoll')?.focus(), 30);
}
function submitRepairRequest(id) { const roll = num('repairRoll', 0); if (roll <= 0) return showModalNotice('Введите результат броска', 'error'); sendPlayerRequest(id, 'repair', {roll}); }

async function savePlayerSettings(id) {
  try {
    const name = val('selfName');
    if (!name) throw new Error('Введите имя персонажа');
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{name}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast('Настройки сохранены', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}


let avatarCropState = null;
function openAvatarCropModal(characterId, inputId) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('Выбери изображение', 'error');
  const url = URL.createObjectURL(file);
  avatarCropState = {characterId, file, url, scale: 1.15, x: 0, y: 0, dragging:false, lastX:0, lastY:0, pinchDist:0, pinchScale:1.15};
  showModal(`<div class="modal-card avatar-crop-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">🖼️ Настрой аватарку</div><p class="muted">Перетащи изображение пальцем или мышью. Колёсиком мыши или кнопками можно приблизить/отдалить.</p><div id="avatarCropCircle" class="avatar-crop-stage"><div class="avatar-crop-circle"><img id="avatarCropImg" src="${esc(url)}" alt=""></div></div><div class="avatar-crop-controls"><button class="secondary" onclick="zoomAvatarCrop(-0.08)">−</button><span id="avatarCropZoomLabel">115%</span><button class="secondary" onclick="zoomAvatarCrop(0.08)">+</button><button class="secondary" onclick="resetAvatarCrop()">Сброс</button></div><div class="row modal-actions"><button class="ok" onclick="saveCroppedAvatar()">Сохранить аватарку</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
  setTimeout(() => { bindAvatarCropDrag(); updateAvatarCropPreview(); }, 30);
}
function clampAvatarCrop() {
  if (!avatarCropState) return;
  avatarCropState.scale = Math.max(0.6, Math.min(2.8, avatarCropState.scale));
  avatarCropState.x = Math.max(-180, Math.min(180, avatarCropState.x));
  avatarCropState.y = Math.max(-180, Math.min(180, avatarCropState.y));
}
function updateAvatarCropPreview() {
  const img = document.getElementById('avatarCropImg');
  if (!img || !avatarCropState) return;
  clampAvatarCrop();
  const {scale, x, y} = avatarCropState;
  img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
  const lbl = document.getElementById('avatarCropZoomLabel'); if (lbl) lbl.textContent = Math.round(scale * 100) + '%';
}
function zoomAvatarCrop(delta) {
  if (!avatarCropState) return;
  avatarCropState.scale += delta;
  updateAvatarCropPreview();
}
function resetAvatarCrop() {
  if (!avatarCropState) return;
  avatarCropState.scale = 1.15; avatarCropState.x = 0; avatarCropState.y = 0;
  updateAvatarCropPreview();
}
function bindAvatarCropDrag() {
  const stage = document.getElementById('avatarCropCircle');
  if (!stage || stage.dataset.bound === '1') return;
  stage.dataset.bound = '1';
  const dist = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  stage.addEventListener('pointerdown', e => {
    if (!avatarCropState) return;
    stage.setPointerCapture?.(e.pointerId);
    avatarCropState.dragging = true;
    avatarCropState.lastX = e.clientX;
    avatarCropState.lastY = e.clientY;
  });
  stage.addEventListener('pointermove', e => {
    if (!avatarCropState?.dragging) return;
    const dx = e.clientX - avatarCropState.lastX;
    const dy = e.clientY - avatarCropState.lastY;
    avatarCropState.lastX = e.clientX;
    avatarCropState.lastY = e.clientY;
    avatarCropState.x += dx;
    avatarCropState.y += dy;
    updateAvatarCropPreview();
  });
  const stop = e => { if (avatarCropState) avatarCropState.dragging = false; };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAvatarCrop(e.deltaY > 0 ? -0.06 : 0.06);
  }, {passive:false});
  stage.addEventListener('touchstart', e => {
    if (!avatarCropState || e.touches.length !== 2) return;
    avatarCropState.pinchDist = dist(e.touches);
    avatarCropState.pinchScale = avatarCropState.scale;
  }, {passive:false});
  stage.addEventListener('touchmove', e => {
    if (!avatarCropState || e.touches.length !== 2 || !avatarCropState.pinchDist) return;
    e.preventDefault();
    avatarCropState.scale = avatarCropState.pinchScale * (dist(e.touches) / avatarCropState.pinchDist);
    updateAvatarCropPreview();
  }, {passive:false});
}
async function saveCroppedAvatar() {
  if (!avatarCropState) return;
  try {
    const img = document.getElementById('avatarCropImg');
    await new Promise((resolve, reject) => { if (img.complete) resolve(); else { img.onload=resolve; img.onerror=reject; } });
    const size = 512;
    const canvas = document.createElement('canvas'); canvas.width=size; canvas.height=size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,size,size);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const base = Math.max(size/iw, size/ih) * avatarCropState.scale;
    const dw = iw * base, dh = ih * base;
    const dx = (size - dw)/2 + avatarCropState.x * (size/320);
    const dy = (size - dh)/2 + avatarCropState.y * (size/320);
    ctx.drawImage(img, dx, dy, dw, dh);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.92));
    const form = new FormData();
    form.append('file', blob, 'avatar.png');
    const res = await fetch(`/api/characters/${avatarCropState.characterId}/avatar`, {method:'POST', headers: authUploadHeaders(), body: form});
    let data = {}; try { data = await res.json(); } catch(_) {}
    if (!res.ok) throw new Error(data.detail || data.message || `Ошибка ${res.status}`);
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal();
    showToast('Аватарка сохранена', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}
function toggleWindowMode() {
  const cur = localStorage.getItem('force_window_mode') === '1';
  localStorage.setItem('force_window_mode', cur ? '0' : '1');
  showToast(cur ? 'Полноэкранный режим будет включён после перезапуска окна' : 'Оконный режим будет включён после перезапуска окна', 'info');
  try { if (!cur && tg?.exitFullscreen) tg.exitFullscreen(); } catch(_) {}
}

function previewAvatarFile(inputId, targetId) {
  const input = document.getElementById(inputId);
  const target = document.getElementById(targetId);
  const file = input?.files?.[0];
  if (!file || !target) return;
  const url = URL.createObjectURL(file);
  const ch = playerChar() || {color:'#72a7ff', name:'?'};
  target.innerHTML = avatarCircle({...ch, avatar_path:url, avatar_thumb_path:url}, 'xl');
  setupCanvasEffects();
}

async function uploadAvatar(id, inputId) {
  try {
    await apiUpload(`/api/characters/${id}/avatar`, inputId);
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast('Аватарка загружена', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}


function currentInventory(ch) {
  return state.campaignState?.inventories?.[String(ch.id)] || [];
}
function renderInventoryBlock(ch) {
  const items = currentInventory(ch);
  const c = state.campaignState?.campaign || {};
  const list = items.length ? items.map((it, idx) => renderInventoryItem(ch, it, idx, items.length)).join('') : '<div class="muted">Инвентарь пуст.</div>';
  const weaponBtn = c.weapons_enabled ? `<button class="secondary" onclick="openItemModal(${ch.id}, 'weapon')">🔫 Оружие</button>` : '';
  const hint = c.weapons_enabled ? '' : '<div class="muted small">Оружейная система выключена в этой кампании.</div>';
  return `<details class="card stack inventory-section custom-collapse" ${sectionAttrs('inventory-'+ch.id)}><summary>🎒 Инвентарь</summary><div class="stack section-body"><div class="inventory-list">${list}</div><div class="row"><button class="secondary" onclick="openItemModal(${ch.id}, 'normal')">➕ Предмет</button>${weaponBtn}</div>${hint}</div></details>`;
}
function ammoTypePill(type, desc='') {
  const t = type || 'обычные';
  const cls = /брон/i.test(t) ? 'ap' : /эксп|кров|огн/i.test(t) ? 'hot' : /пул|слаг/i.test(t) ? 'slug' : /дроб|карт/i.test(t) ? 'shot' : 'normal';
  return `<span class="ammo-type ${cls}" title="${esc(desc||'')}">${esc(t)}</span>`;
}
function inventoryMoveControls(itemId, idx=0, total=1) {
  const upDisabled = idx <= 0 ? ' disabled' : '';
  const downDisabled = idx >= total - 1 ? ' disabled' : '';
  return `<div class="inventory-order-controls" aria-label="Порядок предмета"><button class="secondary small inventory-move-btn"${upDisabled} onclick="moveInventoryItem(${itemId}, 'up')" title="Поднять выше">↑</button><button class="secondary small inventory-move-btn"${downDisabled} onclick="moveInventoryItem(${itemId}, 'down')" title="Опустить ниже">↓</button></div>`;
}
function renderInventoryItem(ch, it, idx=0, total=1) {
  const icon = it.emoji ? `<span class="item-emoji">${esc(it.emoji)}</span>` : '<span class="item-emoji">•</span>';
  if (it.item_type === 'weapon') {
    if (it.reload_type === 'shell') return renderShellWeapon(ch, it, icon, idx, total);
    return renderMagazineWeapon(ch, it, icon, idx, total);
  }
  return `<div class="inventory-item"><div class="inventory-main">${icon}<div><b>${esc(it.name)}</b><small>Количество: ${esc(it.quantity || 1)}</small>${it.description?`<p>${esc(it.description)}</p>`:''}</div></div><div class="inventory-actions-row">${inventoryMoveControls(it.id, idx, total)}<div class="row inventory-edit-actions"><button class="secondary small" onclick="openItemEditModal(${it.id})">Изменить</button><button class="secondary small" onclick="editItemQty(${it.id}, ${it.quantity || 1})">Кол-во</button><button class="danger small" onclick="deleteItem(${it.id})">Удалить</button></div></div></div>`;
}
function weaponSettingsButton(itemId) {
  return `<button class="weapon-settings-btn" onclick="openWeaponSettings(${itemId})" title="Настройки оружия">⚙</button>`;
}
function weaponHeader(it, icon, reloadText, idx=0, total=1) {
  return `<div class="weapon-head"><div class="inventory-main">${icon}<div><b>${esc(it.name)}</b><small class="weapon-reload-kind">${esc(reloadText)}</small>${it.description?`<p>${esc(it.description)}</p>`:''}</div></div><div class="weapon-head-actions">${inventoryMoveControls(it.id, idx, total)}${weaponSettingsButton(it.id)}</div></div>`;
}
function renderMagazineWeapon(ch, it, icon, idx=0, total=1) {
  const firingClass = Number(state.firingItemId || 0) === Number(it.id) ? ' firing' : '';
  const active = it.active_magazine || null;
  const modes = (it.fire_modes||[]).length ? (it.fire_modes||[]) : [{id:0,name:'Атака',ammo_cost:it.ammo_per_attack||1, description:''}];
  const modeBtns = modes.map(m=>`<button class="small weapon-fire-btn" title="${esc(m.description || '')}" onclick="fireWeapon(${it.id}, ${Number(m.id||0)})"><span>${esc(m.name)}</span><b>${esc(m.ammo_cost)} патр.</b>${m.description?`<small>${esc(m.description)}</small>`:''}</button>`).join('');
  const sortedMags = [...(it.magazines || [])].sort((a,b)=>{
    const aa = Number(a.id) === Number(it.active_magazine_id) ? -1 : 0;
    const bb = Number(b.id) === Number(it.active_magazine_id) ? -1 : 0;
    return aa - bb || Number(a.sort_order || a.id || 0) - Number(b.sort_order || b.id || 0);
  });
  const mags = sortedMags.map(m => `<button class="mag-pill compact-mag ${Number(m.id)===Number(it.active_magazine_id)?'active':''}" onclick="openMagazineModal(${it.id}, ${m.id})"><span class="mag-ammo"><b>${esc(m.ammo_current)}</b>/${esc(m.ammo_max)}</span>${ammoTypePill(m.ammo_type, m.description)}</button>`).join('') || '<div class="muted small">Магазинов пока нет. Нажми ⚙ в правом верхнем углу и добавь магазин.</div>';
  const activeHtml = active
    ? `<span>Активный магазин: <b>${esc(active.ammo_current)}/${esc(active.ammo_max)}</b> ${ammoTypePill(active.ammo_type || '', active.description || '')}</span>`
    : '<span class="muted">Активный магазин не выбран.</span>';
  return `<div class="inventory-item weapon-item${firingClass}">${weaponHeader(it, icon, 'магазинная перезарядка', idx, total)}<div class="ammo-line">${activeHtml}</div><div class="weapon-fire-modes">${modeBtns}</div><button class="secondary reload-weapon-btn" onclick="chooseReloadMag(${it.id})">🔄 Перезарядить / выбрать магазин</button><div class="mag-list compact-mag-list">${mags}</div></div>`;
}
function renderShellWeapon(ch, it, icon, idx=0, total=1) {
  const firingClass = Number(state.firingItemId || 0) === Number(it.id) ? ' firing' : '';
  const maxLoaded = Number(it.mag_capacity || 2);
  const loaded = it.loaded_shells || [];
  const stocks = it.shell_stocks || [];
  const modes = (it.fire_modes||[]).length ? it.fire_modes : [{id:0,name:'Атака',ammo_cost:it.ammo_per_attack||1, description:''}];
  const modeBtns = modes.map(m=>`<button class="small weapon-fire-btn" title="${esc(m.description || '')}" onclick="fireWeapon(${it.id}, ${Number(m.id||0)})"><span>${esc(m.name)}</span><b>${esc(m.ammo_cost)} заряд.</b>${m.description?`<small>${esc(m.description)}</small>`:''}</button>`).join('');
  const loadedHtml = loaded.length ? loaded.map(sh=>`<span class="shell-pill">${esc(sh.ammo_type)}</span>`).join('') : '<span class="muted">пусто</span>';
  const stocksHtml = stocks.length ? stocks.map(st=>`<button class="mag-pill compact-mag shell-stock-pill" onclick="openShellStockModal(${it.id}, ${st.id})"><span class="mag-ammo"><b>${esc(st.quantity)}</b> шт.</span>${ammoTypePill(st.ammo_type, st.description)}</button>`).join('') : '<div class="muted small">Стопок патронов пока нет. Нажми ⚙ в правом верхнем углу и добавь стопку.</div>';
  return `<div class="inventory-item weapon-item shotgun-item${firingClass}">${weaponHeader(it, icon, `поштучная зарядка · ${loaded.length}/${maxLoaded}`, idx, total)}<div class="ammo-line"><span>Заряжено: ${loadedHtml}</span></div><div class="weapon-fire-modes">${modeBtns}</div><button class="secondary reload-weapon-btn" onclick="chooseLoadShells(${it.id})">🔄 Зарядить</button><div class="mag-list compact-mag-list shell-stock-list">${stocksHtml}</div></div>`;
}
function openItemModal(charId, type) {
  const isWeapon = type === 'weapon';
  showModal(`<div class="modal-card ${isWeapon?'weapon-create-modal':''}"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${isWeapon?'🔫 Новое оружие':'🎒 Новый предмет'}</div><label>Название<input id="itemName" placeholder="Например: Револьвер, Дробовик, Винтовка"></label>${isWeapon?'':`<label>Эмоджи<input id="itemEmoji" placeholder="например 🧪"></label>`}<label>Описание<textarea id="itemDesc" placeholder="Коротко опиши предмет"></textarea></label>${isWeapon?`<div class="weapon-create-type-grid"><button type="button" id="reloadMagazineBtn" class="weapon-type-choice active" onclick="setWeaponReloadType('magazine')"><b>Магазины</b><small>Пистолет, автомат, винтовка</small></button><button type="button" id="reloadShellBtn" class="weapon-type-choice" onclick="setWeaponReloadType('shell')"><b>Поштучно</b><small>Дробовик, револьвер, трубчатый магазин</small></button></div><input id="reloadType" type="hidden" value="magazine"><label>Патронов за обычную атаку<input id="ammoPerAttack" type="number" min="1" value="1"></label><div id="shellFields" class="stack hidden"><label>Сколько максимум помещается в оружие<input id="shellCapacity" type="number" min="1" value="2"></label></div><div class="fire-mode-builder"><div class="fire-mode-head"><div><b>Дополнительные режимы стрельбы</b><small>Обычная атака создаётся сама. Нажми плюс, если нужны очередь, автоогонь или особая атака.</small></div><button type="button" class="secondary add-fire-mode-btn" onclick="addFireModeRow()">＋</button></div><div id="fireModeRows" class="fire-mode-rows"></div></div><small class="muted weapon-create-hint">Оружие создаётся пустым. Магазины или стопки патронов добавишь в карточке оружия.</small>`:`<label>Количество<input id="itemQty" type="number" value="1"></label>`}<div class="row modal-actions"><button class="ok" onclick="createItem(${charId}, '${type}')">Добавить</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
}
function addFireModeRow(name='', cost='', description=''){
  const host = document.getElementById('fireModeRows');
  if (!host) return;
  const row = document.createElement('div');
  row.className = 'fire-mode-row';
  row.innerHTML = `<div class="fire-mode-row-main"><label>Название атаки<input class="fire-mode-name" placeholder="Например: Очередь" value="${esc(name)}"></label><label>Патронов за атаку<input class="fire-mode-cost" type="number" min="1" value="${esc(cost || '')}" placeholder="6"></label><button type="button" class="danger fire-mode-remove" title="Убрать режим" onclick="removeFireModeRow(this)">×</button></div><label class="fire-mode-desc-wrap">Описание, если нужно<input class="fire-mode-desc" placeholder="Например: короткая очередь" value="${esc(description)}"></label>`;
  host.appendChild(row);
  row.querySelector('.fire-mode-name')?.focus();
}
function removeFireModeRow(btn){ btn?.closest('.fire-mode-row')?.remove(); }
function setWeaponReloadType(type){
  const rt = type === 'shell' ? 'shell' : 'magazine';
  const input = document.getElementById('reloadType');
  if (input) input.value = rt;
  document.getElementById('reloadMagazineBtn')?.classList.toggle('active', rt==='magazine');
  document.getElementById('reloadShellBtn')?.classList.toggle('active', rt==='shell');
  document.getElementById('shellFields')?.classList.toggle('hidden', rt!=='shell');
}
function toggleWeaponCreateFields(){ setWeaponReloadType(val('reloadType') || 'magazine'); }
function parseExtraFireModes(text, baseCost=1){
  const modes = [{name:'Атака', ammo_cost:Math.max(1, Number(baseCost||1)), description:'Основная атака'}];
  String(text||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach((line,i)=>{
    const parts = line.split('|');
    const name = (parts[0] || `Режим ${i+2}`).trim();
    const ammo_cost = Math.max(1, Number(parts[1] || 1));
    const description = (parts.slice(2).join('|') || '').trim();
    if (name) modes.push({name, ammo_cost, description});
  });
  return modes;
}
function collectFireModes(baseCost=1){
  const modes = [{name:'Атака', ammo_cost:Math.max(1, Number(baseCost||1)), description:'Основная атака'}];
  document.querySelectorAll('#fireModeRows .fire-mode-row').forEach((row, i) => {
    const name = (row.querySelector('.fire-mode-name')?.value || '').trim();
    const costRaw = row.querySelector('.fire-mode-cost')?.value || '';
    const description = (row.querySelector('.fire-mode-desc')?.value || '').trim();
    if (!name && !costRaw && !description) return;
    modes.push({
      name: name || `Режим ${i+2}`,
      ammo_cost: Math.max(1, Number(costRaw || 1)),
      description
    });
  });
  return modes;
}
function parseFireModes(text){ return parseExtraFireModes(text, 1); }
function parseMagazines(text){ return []; }
function parseShellStocks(text){ return []; }
async function createItem(charId, type) {
  try {
    const body = {item_type:type, name:val('itemName'), emoji:val('itemEmoji'), description:val('itemDesc')};
    if (type==='weapon') {
      const rt=val('reloadType')||'magazine';
      const ammoCost = num('ammoPerAttack',1);
      Object.assign(body, {weapon_type:rt==='shell'?'Поштучное':'Магазинное', reload_type:rt, ammo_per_attack:ammoCost, fire_modes:collectFireModes(ammoCost), magazines:[], shell_stocks:[], loaded_count:0});
      if (rt==='shell') body.mag_capacity = num('shellCapacity',2);
      else body.mag_capacity = 0;
    } else body.quantity = num('itemQty',1);
    await api(`/api/characters/${charId}/inventory`, {method:'POST', body});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`); closeModal(); showToast(type==='weapon'?'Оружие добавлено':'Предмет добавлен','heal'); renderCampaign();
  } catch(e){ showToast(e.message,'error'); }
}
function openWeaponSettings(itemId){
  const it=itemById(itemId);
  if(!it) return showToast('Оружие не найдено','error');
  const addText = it.reload_type === 'shell' ? '➕ Добавить стопку патронов' : '➕ Добавить магазин';
  const addAction = it.reload_type === 'shell' ? `openShellStockCreateModal(${itemId})` : `openMagazineCreateModal(${itemId})`;
  showModal(`<div class="modal-card compact weapon-settings-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">⚙ Настройки оружия</div><label>Название оружия<input id="weaponRenameName" value="${esc(it.name||'')}" maxlength="100"></label><label>Описание оружия<textarea id="weaponRenameDesc" maxlength="1000" placeholder="Описание оружия">${esc(it.description||'')}</textarea></label><button class="ok" onclick="saveWeaponRename(${itemId})">Сохранить название и описание</button><button class="secondary" onclick="${addAction}">${addText}</button><button class="danger" onclick="deleteWeaponFromSettings(${itemId})">Удалить оружие</button><button class="secondary" onclick="closeModal()">Назад</button></div>`);
}
async function saveWeaponRename(itemId){
  const name = val('weaponRenameName').trim();
  if(!name) return showToast('Введи название оружия','error');
  try{
    await api(`/api/inventory/items/${itemId}`, {method:'PATCH', body:{name, description:val('weaponRenameDesc')}});
    state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal(); showToast('Оружие переименовано','heal'); renderCampaign();
  }catch(e){ showToast(e.message,'error'); }
}
async function deleteWeaponFromSettings(itemId){
  if(!confirm('Удалить оружие?')) return;
  try{
    await api(`/api/inventory/items/${itemId}`, {method:'DELETE'});
    state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal(); showToast('Оружие удалено','info'); renderCampaign();
  }catch(e){ showToast(e.message,'error'); }
}

function openItemEditModal(itemId){
  const it=itemById(itemId);
  if(!it) return showToast('Предмет не найден','error');
  const qtyField = it.item_type === 'weapon' ? '' : `<label>Количество<input id="itemEditQty" type="number" min="1" value="${esc(it.quantity || 1)}"></label>`;
  const emojiField = it.item_type === 'weapon' ? '' : `<label>Эмоджи<input id="itemEditEmoji" maxlength="8" value="${esc(it.emoji || '')}" placeholder="например 🧪"></label>`;
  showModal(`<div class="modal-card compact item-edit-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">✏️ Изменить предмет</div><label>Название<input id="itemEditName" maxlength="100" value="${esc(it.name || '')}"></label>${emojiField}<label>Описание<textarea id="itemEditDesc" maxlength="1000" placeholder="Описание предмета">${esc(it.description || '')}</textarea></label>${qtyField}<div class="row modal-actions"><button class="ok" onclick="saveItemEdit(${itemId})">Сохранить</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
}
async function saveItemEdit(itemId){
  const it=itemById(itemId);
  const name=val('itemEditName').trim();
  if(!name) return showToast('Введи название предмета','error');
  const body={name, description:val('itemEditDesc')};
  if(it?.item_type !== 'weapon') { body.emoji=val('itemEditEmoji'); body.quantity=Math.max(1, num('itemEditQty',1)); }
  try{
    await api(`/api/inventory/items/${itemId}`, {method:'PATCH', body});
    state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal(); showToast('Предмет обновлён','heal'); renderCampaign();
  }catch(e){showToast(e.message,'error')}
}
async function deleteItem(itemId){ if(!confirm('Удалить предмет?')) return; try{ await api(`/api/inventory/items/${itemId}`, {method:'DELETE'}); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }
async function editItemQty(itemId, oldQty){ const q=prompt('Количество', oldQty); if(!q) return; try{ await api(`/api/inventory/items/${itemId}`, {method:'PATCH', body:{quantity:Number(q)}}); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }
async function moveInventoryItem(itemId, direction){
  try{
    const res = await api(`/api/inventory/items/${itemId}/move`, {method:'POST', body:{direction}});
    const movedInventory = res.inventory || [];
    const characterId = movedInventory[0]?.character_id || findCharacterIdByInventoryItem(itemId);
    if(characterId) replaceInventoryForCharacter(characterId, movedInventory);
    else state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    renderCampaign();
  }catch(e){showToast(e.message,'error')}
}
function findCharacterIdByInventoryItem(itemId){
  const inventories = state.campaignState?.inventories || {};
  for(const [characterId, items] of Object.entries(inventories)){
    if((items || []).some(it => Number(it.id) === Number(itemId))) return Number(characterId);
  }
  return null;
}

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
function replaceInventoryForCharacter(characterId, inventory){
  if (!state.campaignState?.inventories || !characterId) return;
  state.campaignState.inventories[String(characterId)] = inventory || [];
}
function setAnimatedMagazineAmmo(itemId, magazineId, ammo){
  const it = itemById(itemId);
  if (!it) return;
  const mag = (it.magazines || []).find(m => Number(m.id) === Number(magazineId));
  if (mag) mag.ammo_current = Math.max(0, Number(ammo || 0));
  if (it.active_magazine && Number(it.active_magazine.id) === Number(magazineId)) it.active_magazine.ammo_current = Math.max(0, Number(ammo || 0));
}
function removeOneAnimatedShell(itemId){
  const it = itemById(itemId);
  if (!it || !Array.isArray(it.loaded_shells)) return;
  it.loaded_shells = it.loaded_shells.slice(1);
}
async function animateWeaponSpend(itemId, fireLog, finalInventory, characterId){
  const log = fireLog || {};
  const before = log.before || {};
  const after = log.after || {};
  const spent = Math.max(0, Number(log.spent || 0));
  // Делаем очередь заметной: backend уже списал патроны безопасно,
  // а здесь показываем игроку выпуск пуль одну за другой.
  const delay = spent > 30 ? 82 : spent > 18 ? 105 : spent > 8 ? 135 : 190;
  state.firingItemId = itemId;
  if (before.magazine_id) {
    const from = Number(before.ammo || 0);
    const to = Number(after.ammo ?? Math.max(0, from - spent));
    for (let ammo = from - 1; ammo >= to; ammo--) {
      setAnimatedMagazineAmmo(itemId, before.magazine_id, ammo);
      renderCampaign();
      await sleep(delay);
    }
  } else if (before.loaded != null) {
    for (let i = 0; i < spent; i++) {
      removeOneAnimatedShell(itemId);
      renderCampaign();
      await sleep(delay);
    }
  }
  replaceInventoryForCharacter(characterId, finalInventory);
  state.firingItemId = 0;
  renderCampaign();
}
async function fireWeapon(itemId, fireModeId=0){
  if (state.firingAnimation) return;
  const beforeItem = itemById(itemId);
  state.firingAnimation = true;
  state.firingItemId = itemId;
  try{
    const result = await api(`/api/inventory/items/${itemId}/fire`, {method:'POST', body:{fire_mode_id:fireModeId || null}});
    const characterId = Number(result.item?.character_id || beforeItem?.character_id || 0);
    await animateWeaponSpend(itemId, result.fire_log || {}, result.inventory || [], characterId);
    showToast('Выстрел учтён','damage');
  }catch(e){
    state.firingItemId = 0;
    showToast(e.message,'error');
    renderCampaign();
  } finally {
    state.firingAnimation = false;
  }
}
function itemById(itemId){ const invs=state.campaignState?.inventories||{}; for(const arr of Object.values(invs)){ const it=(arr||[]).find(x=>Number(x.id)===Number(itemId)); if(it) return it; } return null; }
function chooseReloadMag(itemId){
  const it=itemById(itemId);
  if(!it) return;
  const sortedMags=[...(it.magazines||[])].sort((a,b)=>{
    const aa = Number(a.id)===Number(it.active_magazine_id) ? -1 : 0;
    const bb = Number(b.id)===Number(it.active_magazine_id) ? -1 : 0;
    return aa - bb || Number(a.sort_order || a.id || 0) - Number(b.sort_order || b.id || 0);
  });
  const mags=sortedMags.map(m=>`<button class="mag-select ${Number(m.id)===Number(it.active_magazine_id)?'active':''}" onclick="requestReload(${itemId}, ${m.id})"><span class="mag-ammo"><b>${esc(m.ammo_current)}</b>/${esc(m.ammo_max)}</span>${ammoTypePill(m.ammo_type,m.description)}${Number(m.id)===Number(it.active_magazine_id)?'<small>Активный магазин сейчас</small>':''}</button>`).join('') || '<div class="muted">Сначала добавь магазин через ⚙ настройки оружия.</div>';
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">Выбрать магазин: ${esc(it.name)}</div><div class="stack">${mags}</div><button class="secondary" onclick="closeModal()">Отмена</button></div>`);
}
async function sendInventoryRequest(path, body){
  if(state.pendingInventoryRequest) return showToast('Заявка уже отправляется','info');
  state.pendingInventoryRequest = true;
  try{
    await api(path, {method:'POST', body});
    state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal();
    showToast('Заявка мастеру отправлена','heal');
    renderCampaign();
  }catch(e){
    showToast(e.message,'error');
  }finally{
    state.pendingInventoryRequest = false;
  }
}
async function requestReload(itemId, magId){ return sendInventoryRequest(`/api/inventory/items/${itemId}/reload-request`, {magazine_id:magId}); }
function openMagazineModal(itemId, magId){
  const it=itemById(itemId);
  const m=(it?.magazines||[]).find(x=>Number(x.id)===Number(magId))||{};
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${esc(m.name||'Магазин')}</div><p><b>${esc(m.ammo_current||0)}/${esc(m.ammo_max||0)}</b> ${ammoTypePill(m.ammo_type,m.description)}</p>${m.description?`<p class="muted">${esc(m.description)}</p>`:''}<button onclick="requestRefill(${itemId}, ${magId})">Запросить пополнение</button><button class="secondary" onclick="closeModal()">Назад</button></div>`);
}
async function requestRefill(itemId, magId){ return sendInventoryRequest(`/api/inventory/items/${itemId}/refill-request`, {magazine_id:magId}); }
function openMagazineCreateModal(itemId){
  const it=itemById(itemId)||{};
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">➕ Магазин для ${esc(it.name||'оружия')}</div><label>Название магазина<input id="newMagName" placeholder="Например: основной, запасной"></label><label>Максимум патронов<input id="newMagMax" type="number" min="1" value="30"></label><label>Сколько сейчас<input id="newMagCurrent" type="number" min="0" value="30"></label><label>Тип патронов<input id="newMagAmmoType" placeholder="обычные, бронебойные, дробь"></label><label>Описание<textarea id="newMagDesc" placeholder="Необязательно"></textarea></label><div class="row modal-actions"><button class="ok" onclick="createMagazine(${itemId})">Создать</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
}
async function createMagazine(itemId){
  try{
    const maxAmmo=num('newMagMax',1);
    const curRaw=val('newMagCurrent');
    await api(`/api/inventory/items/${itemId}/magazines`, {method:'POST', body:{name:val('newMagName'), ammo_max:maxAmmo, ammo_current:curRaw===''?maxAmmo:Number(curRaw), ammo_type:val('newMagAmmoType')||'обычные', description:val('newMagDesc')}});
    state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal(); showToast('Магазин создан','heal'); renderCampaign();
  }catch(e){showToast(e.message,'error')}
}
function chooseLoadShells(itemId){
  const it=itemById(itemId);
  if(!it) return;
  const maxLoad=Math.max(0, Number(it.mag_capacity||2) - (it.loaded_shells||[]).length);
  const stocks=(it.shell_stocks||[]).map(st=>`<div class="mag-select shell-load-option"><div class="shell-load-info"><span class="mag-ammo"><b>${esc(st.quantity)}</b> шт.</span>${ammoTypePill(st.ammo_type,st.description)}${st.description?`<small>${esc(st.description)}</small>`:''}</div><div class="shell-load-controls"><input id="loadCount_${st.id}" type="number" min="1" max="${Math.max(1, Math.min(maxLoad, Number(st.quantity||0)))}" value="${Math.max(1, Math.min(maxLoad || 1, Number(st.quantity||0) || 1))}"><button class="ok small" onclick="requestLoadShells(${itemId}, ${st.id}, ${maxLoad})">Зарядить</button></div></div>`).join('') || '<div class="muted">Сначала добавь стопку патронов через ⚙ настройки оружия.</div>';
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">Зарядить: ${esc(it.name)}</div><div class="muted">Свободно мест: ${maxLoad}.</div><div class="stack">${stocks}</div><button class="secondary" onclick="closeModal()">Отмена</button></div>`);
}
async function requestLoadShells(itemId, stockId, maxLoad){
  if(maxLoad<=0) return showToast('Оружие уже заряжено полностью','info');
  const count=Number(val(`loadCount_${stockId}`) || 0);
  if(!count) return showToast('Укажи количество','error');
  return sendInventoryRequest(`/api/inventory/items/${itemId}/load-shells-request`, {stock_id:stockId, count});
}
function openShellStockModal(itemId, stockId){
  const it=itemById(itemId);
  const st=(it?.shell_stocks||[]).find(x=>Number(x.id)===Number(stockId))||{};
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${esc(st.ammo_type||'Боеприпас')}</div><p>В стопке: <b>${esc(st.quantity||0)}</b></p>${st.description?`<p class="muted">${esc(st.description)}</p>`:''}<button onclick="requestRefillShellStock(${itemId}, ${stockId})">Запросить пополнение</button><button class="secondary" onclick="closeModal()">Назад</button></div>`);
}
async function requestRefillShellStock(itemId, stockId){
  const amount=Number(prompt('Сколько добавить?', 1) || 0);
  if(!amount) return;
  return sendInventoryRequest(`/api/inventory/items/${itemId}/refill-shell-stock-request`, {stock_id:stockId, amount});
}
function openShellStockCreateModal(itemId){
  const it=itemById(itemId)||{};
  showModal(`<div class="modal-card compact"><button class="modal-close" onclick="closeModal()">×</button><div class="name">➕ Стопка патронов для ${esc(it.name||'оружия')}</div><label>Название патронов<input id="newStockAmmoType" placeholder="Например: дробь, пуля, огненный заряд"></label><label>Количество<input id="newStockQty" type="number" min="0" value="10"></label><label>Описание<textarea id="newStockDesc" placeholder="Необязательно"></textarea></label><div class="row modal-actions"><button class="ok" onclick="createShellStock(${itemId})">Создать</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
}
async function createShellStock(itemId){
  try{
    await api(`/api/inventory/items/${itemId}/shell-stocks`, {method:'POST', body:{ammo_type:val('newStockAmmoType')||'стандартные', quantity:num('newStockQty',0), emoji:'', description:val('newStockDesc')}});
    state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal(); showToast('Стопка создана','heal'); renderCampaign();
  }catch(e){showToast(e.message,'error')}
}
function renderInventoryRequests() {
  const reqs = state.campaignState?.inventory_requests || [];
  if (!reqs.length) return '';
  const label = (r)=>({reload_weapon:'перезарядка оружия', refill_magazine:'пополнение магазина', load_shells:'зарядка оружия', refill_shell_stock:'пополнение стопки'}[r.request_type]||r.request_type);
  const requestDetails = (r)=>{
    const p=r.payload||{}; const it=r.item||{};
    if(r.request_type==='reload_weapon'){
      const m=(it.magazines||[]).find(x=>Number(x.id)===Number(p.magazine_id));
      return m?`Выбрать: ${m.ammo_current}/${m.ammo_max} ${m.ammo_type||'патроны'}${m.name?' · '+m.name:''}`:'Выбрать новый магазин';
    }
    if(r.request_type==='refill_magazine'){
      const m=(it.magazines||[]).find(x=>Number(x.id)===Number(p.magazine_id));
      return m?`Пополнить: ${m.ammo_current}/${m.ammo_max} ${m.ammo_type||'патроны'}`:'Пополнить магазин';
    }
    if(r.request_type==='load_shells'){
      const st=(it.shell_stocks||[]).find(x=>Number(x.id)===Number(p.stock_id));
      return `Зарядить ${p.count||1} из ${st ? `${st.ammo_type} · в стопке ${st.quantity}` : 'выбранной стопки'}`;
    }
    if(r.request_type==='refill_shell_stock'){
      const st=(it.shell_stocks||[]).find(x=>Number(x.id)===Number(p.stock_id));
      return `Добавить ${p.amount||1} в ${st ? st.ammo_type : 'стопку'}`;
    }
    return JSON.stringify(p||{});
  };
  return `<details class="card stack custom-collapse" ${sectionAttrs('inventory-requests')}><summary>🎒 Заявки инвентаря (${reqs.length})</summary><div class="section-body stack">${reqs.map(r=>`<div class="request-card"><b>${esc(r.character?.name || 'Персонаж')}</b><small>${esc(label(r))}</small><p>${esc(r.item?.name || '')}</p><div class="muted small">${esc(requestDetails(r))}</div><div class="row"><button class="ok small" onclick="decideInventoryRequest(${r.id}, true)">Подтвердить</button><button class="danger small" onclick="decideInventoryRequest(${r.id}, false)">Отклонить</button></div></div>`).join('')}</div></details>`;
}
async function decideInventoryRequest(id, approve){ try{ await api(`/api/inventory/requests/${id}/decide`, {method:'POST', body:{approve}}); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }

function renderMaps() {
  if (!MAPS_FEATURE_ENABLED) return '<div class="card muted">Карты временно отключены.</div>';
  const role = state.campaignState?.role;
  const maps = state.campaignState?.maps || [];
  const activeId = Number(localStorage.getItem(`active_map_${state.currentCampaignId}`) || maps[0]?.id || 0);
  const active = maps.find(m=>Number(m.id)===activeId) || maps[0];
  return `<div class="stack maps-page"><div class="card stack"><div class="name">🗺️ Карты</div><p class="muted">Игроки и мастер могут приближать карту и ставить временные пинги. Пинг мастера выделен золотым.</p>${role==='master'?`<div class="map-upload"><input id="mapName" placeholder="Название карты"><input id="mapFile" type="file" accept="image/*"><button onclick="uploadMap()">Загрузить карту</button></div>`:''}<div class="map-tabs">${maps.map(m=>`<button class="${active&&Number(active.id)===Number(m.id)?'active':''}" onclick="selectMap(${m.id})">${esc(m.name)}</button>`).join('')}</div></div>${active?renderMapViewer(active):'<div class="card muted">Карт пока нет.</div>'}</div>`;
}
function renderMapViewer(m) {
  const pings = (state.campaignState?.map_pings || []).filter(p=>Number(p.map_id)===Number(m.id));
  return `<div class="card stack map-card"><div class="row" style="justify-content:space-between"><b>${esc(m.name)}</b><small class="muted">Клик/тап по карте — пинг</small></div><div class="map-scroll"><div class="map-canvas" onclick="sendMapPing(event, ${m.id})"><img loading="lazy" src="${esc(m.image_path)}" alt="${esc(m.name)}">${pings.map(p=>`<span class="map-ping ${p.is_master?'master':''}" style="left:${Number(p.x)}%;top:${Number(p.y)}%;--ping-color:${esc(p.color||'#72a7ff')}"><b>${esc(p.label||'')}</b></span>`).join('')}</div></div></div>`;
}
function selectMap(id){ localStorage.setItem(`active_map_${state.currentCampaignId}`, String(id)); renderCampaign(); }
async function uploadMap(){ try{ const file=document.getElementById('mapFile')?.files?.[0]; if(!file) return showToast('Выбери изображение карты','error'); const fd=new FormData(); fd.append('name', val('mapName')||'Карта'); fd.append('file', file); const res=await fetch(`/api/campaigns/${state.currentCampaignId}/maps`, {method:'POST', headers:authUploadHeaders(), body:fd}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.detail||'Ошибка загрузки'); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }
async function sendMapPing(ev, mapId){ try{ const rect=ev.currentTarget.getBoundingClientRect(); const x=(ev.clientX-rect.left)/rect.width*100; const y=(ev.clientY-rect.top)/rect.height*100; await api(`/api/campaigns/${state.currentCampaignId}/maps/${mapId}/pings`, {method:'POST', body:{x,y}}); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }

function renderGenerators() {
  return `<div class="grid"><div class="card stack"><div class="name">Настроение</div><label>Мораль</label><input id="moodMorale" type="number" value="50"><label>n / накопление</label><input id="moodN" type="number" value="0"><label>Категории: 1 бой, 2 социалка, 3 исследование</label><input id="moodCats" value="123"><button onclick="genMood()">Сгенерировать</button></div><div class="card stack"><div class="name">Погода и события</div><button onclick="genWeather()">Погода</button><button onclick="genEvents()">События недели</button><button class="secondary" onclick="broadcastLast()">Отправить последний результат игрокам</button></div><div class="card stack wide"><div class="name">Результат</div><div id="genOut">${renderGeneratorResult()}</div></div></div>`;
}
function renderGeneratorResult(){
  if (!state.lastGeneratorText) return '<div class="output muted">Пока ничего не сгенерировано.</div>';
  if (state.lastGeneratorKind === 'mood' && state.lastGeneratorPayload) return renderMoodPayload(state.lastGeneratorPayload);
  return `<div class="output">${esc(state.lastGeneratorText)}</div>`;
}
function renderMoodPayload(result){
  const effects = result.effects || [];
  const cards = effects.map(e => {
    const dur=e.duration||{}; const tier=e.tier||''; const cat=e.category||'';
    return `<div class="mood-effect tier-${tier.toLowerCase()} cat-${cat}"><div class="row" style="justify-content:space-between"><b>${esc(e.name)}</b><span>${tierEmoji(tier)} ${tierRu(tier)}</span></div><div class="muted">${catEmoji(cat)} ${catRu(cat)} · ${esc(dur.value)} ${esc(dur.unit)}</div><p>${esc(e.combat_text)}</p>${e.aftermath?`<p class="muted"><b>После данжа:</b> ${esc(e.aftermath)}</p>`:''}${e.coping?`<p class="muted"><b>Как жить:</b> ${esc(e.coping)}</p>`:''}</div>`;
  }).join('') || '<div class="output">Ничего не произошло.</div>';
  return `<div class="stack"><div class="output"><b>🧠 Генератор настроения</b>\nМораль: ${esc(result.morale)} | Накопление: ${esc(result.n)}\nФаза: ${esc(result.phase?.name || '—')}\nЭффектов: ${esc(result.count || 0)}</div>${cards}</div>`;
}
function tierRu(t){ return {EXCELLENT:'Отличный',GOOD:'Хороший',NEUTRAL:'Нейтральный',BAD:'Плохой',AWFUL:'Ужасный'}[t] || t; }
function tierEmoji(t){ return {EXCELLENT:'🌟',GOOD:'🟢',NEUTRAL:'🟡',BAD:'🔴',AWFUL:'💀'}[t] || '•'; }
function catRu(c){ return {combat:'Бой',social:'Социалка',exploration:'Исследование'}[c] || c; }
function catEmoji(c){ return {combat:'⚔️',social:'🎭',exploration:'🧭'}[c] || '•'; }
async function genMood(){ try{ const out=await api(`/api/campaigns/${state.currentCampaignId}/generators/mood`, {method:'POST', body:{morale:num('moodMorale',50), n:num('moodN',0), categories:val('moodCats')||'123'}}); state.lastGeneratorText=out.text; state.lastGeneratorPayload=out.payload; state.lastGeneratorKind='mood'; renderCampaign(); }catch(e){alert(e.message);} }
async function genWeather(){ try{ const out=await api(`/api/campaigns/${state.currentCampaignId}/generators/weather`, {method:'POST'}); state.lastGeneratorText=out.text; state.lastGeneratorPayload=out.payload; state.lastGeneratorKind='weather'; renderCampaign(); }catch(e){alert(e.message);} }
async function genEvents(){ try{ const out=await api(`/api/campaigns/${state.currentCampaignId}/generators/events`, {method:'POST'}); state.lastGeneratorText=out.text; state.lastGeneratorPayload=out.payload; state.lastGeneratorKind='events'; renderCampaign(); }catch(e){alert(e.message);} }
async function broadcastLast(){ if(!state.lastGeneratorText) return alert('Сначала сгенерируй результат.'); try{ const out=await api(`/api/campaigns/${state.currentCampaignId}/broadcast`, {method:'POST', body:{text:state.lastGeneratorText}}); alert(`Отправлено: ${out.sent}`); }catch(e){alert(e.message);} }

function renderMasterAchievements() {
  const templates = state.campaignState?.achievement_templates || [];
  const list = templates.length ? templates.map(a => `<div class="achievement-template-card card" onclick="openMasterAchievement(${Number(a.id)})">
    <div class="ach-icon big">${achIconHtml(a.icon || '🏆', '', '')}</div><div class="ach-main"><b>${esc(a.title)}</b><small>${esc(a.tag || 'Без тэга')}</small>${a.cosmetic_reward?`<span class="pill reward">${esc(a.cosmetic_reward.emoji || '✨')} рамка: ${esc(a.cosmetic_reward.name)}</span>`:''}${a.cosmetic_effect_reward?`<span class="pill reward effect">${esc(a.cosmetic_effect_reward.emoji || '✨')} эффект: ${esc(a.cosmetic_effect_reward.name)}</span>`:''}${a.tag_reward?`<span class="pill reward">🏷️ тэг: ${esc(a.tag_reward.name)}</span>`:''}${a.currency_reward?`<span class="pill reward">✦ ${esc(a.currency_reward)} искр</span>`:''}</div>
  </div>`).join('') : '<div class="empty-state">Достижений пока нет. Создай первое.</div>';
  return `<div class="stack achievements-screen">
    <details class="card stack achievement-create" ${sectionAttrs('master-ach-create')}><summary><span>🏆</span><b>Создать достижение</b><small>PNG/JPG-иконка, описание, тэг и визуальная награда</small></summary>
      <div class="grid two achievement-form">
        <label class="wide">Иконка достижения<input id="achIconFile" type="file" accept="image/*" onchange="previewAchievementIcon()"></label>
        <input id="achIconPath" type="hidden" value=""><input id="achIconThumb" type="hidden" value="">
        <div class="wide achievement-icon-upload-row">
          <div id="achIconPreview" class="ach-icon huge"><span>🏆</span></div>
          <div class="muted">Загрузи маленькую PNG/JPG/WEBP-иконку. Она будет показываться в списке достижений игрока.</div>
        </div>
        <label>Тэг / раздел<input id="achTag" value="${esc(state.campaignState?.campaign?.name || 'Кампания')}" maxlength="80"></label>
        <label class="wide">Название<input id="achTitle" placeholder="Например: Неистовая удача" maxlength="80"></label>
        <label class="wide">Описание<textarea id="achDescription" placeholder="За что выдаётся достижение" maxlength="2000"></textarea></label>
        <input id="achReward" type="hidden" value="">
        <input id="achEffectReward" type="hidden" value=""><input id="achTagReward" type="hidden" value="">
        <div class="wide achievement-rewards-grid">
          <div class="reward-picker-box"><div class="reward-picker-head"><b>Награда-рамка</b><button class="secondary small" onclick="openRewardPicker('frame')">Выбрать</button></div><div id="achRewardPreview" class="reward-empty">Без рамки</div><button class="small warn" onclick="openCustomFrameModal()">➕ Добавить кастомную рамку</button></div>
          <div class="reward-picker-box"><div class="reward-picker-head"><b>Награда-эффект</b><button class="secondary small" onclick="openRewardPicker('effect')">Выбрать</button></div><div id="achEffectRewardPreview" class="reward-empty">Без эффекта</div></div>
          <div class="reward-picker-box tag-reward-box"><div class="reward-picker-head"><b>Награда-текст тэга</b><button class="secondary small" onclick="chooseReadyTagReward()">Выбрать готовый текст</button></div><div id="achTagRewardPreview" class="reward-empty">Без текста тэга</div><details class="custom-tag-create-details"><summary><b>➕ Создать уникальный текст</b><small>Например: «Кровожадный» за достижение «Кровожадность». Игрок потом сможет поставить этот текст на любую открытую форму.</small></summary><div class="unique-tag-create"><label>Текст тэга<input id="achCustomTagName" placeholder="Например: Кровожадный" maxlength="40" oninput="updateCustomTagPreview(); clearReadyTagRewardIfCustom()"></label><input id="achCustomTagEmoji" type="hidden" value=""><input id="achCustomTagStyle" type="hidden" value="tag_shape_classic"><div id="customTagPreview" class="tag-preview-demo tag-style-preview"><span class="character-tag rarity-unique tag-shape-classic"><span>🏷️</span><b>Кровожадный</b></span></div><small class="muted">За достижение выдаётся только текст. Форму тэга игрок выбирает отдельно в магазине/кастомизации.</small></div></details></div>
          <label class="reward-picker-box"><b>Искры ✦</b><input id="achCurrencyReward" type="number" min="0" value="0" placeholder="Например: 100"><small class="muted">Начисляются игроку, когда он раскрывает ачивку.</small></label>
        </div>
      </div>
      <button class="ok" onclick="createAchievement()">Создать достижение</button><div id="achCreateOut"></div>
    </details>
    <details class="card stack" ${sectionAttrs('master-currency-grant')}><summary><span>✦</span><b>Выдать искры</b><small>Ручная награда валютой игроку.</small></summary>${renderCurrencyGrantForm()}</details>
    <div class="card stack"><div class="name">🎖 Библиотека достижений кампании</div>${list}</div>
  </div>`;
}


function renderCurrencyGrantForm(){
  const chars = allChars().filter(ch => ch.telegram_user_id);
  const options = chars.map(ch => `<option value="${ch.id}">${esc(ch.name)}</option>`).join('');
  const reserve = Number(state.campaignState?.spark_management?.balance || 0);
  return `<div class="spark-inline-note"><b>Запас мастера: ✦ ${esc(reserve)}</b><span>Ручная выдача списывается из твоего запаса. Если запас закончится, выдача будет заблокирована.</span></div><div class="quick-spark-row"><button class="small secondary" onclick="setVal('currencyGrantAmount', 25)">+25</button><button class="small secondary" onclick="setVal('currencyGrantAmount', 60)">+60</button><button class="small secondary" onclick="setVal('currencyGrantAmount', 150)">+150</button><button class="small secondary" onclick="setVal('currencyGrantAmount', 350)">+350</button></div><div class="grid two"><label>Игрок<select id="currencyGrantChar">${options || '<option value="">Нет привязанных игроков</option>'}</select></label><label>Искры<input id="currencyGrantAmount" type="number" value="25"></label><label class="wide">Комментарий<input id="currencyGrantComment" placeholder="За хороший отыгрыш"></label></div><button class="ok" onclick="grantCurrency()">Выдать искры</button>`;
}
async function grantCurrency(){
  try{
    const character_id=Number(val('currencyGrantChar')||0); const amount=num('currencyGrantAmount',0);
    if(!character_id) throw new Error('Выбери игрока');
    if(!amount) throw new Error('Укажи количество искр');
    const out = await api(`/api/campaigns/${state.currentCampaignId}/currency/grant`, {method:'POST', body:{character_id, amount, comment:val('currencyGrantComment')}});
    if (out.spark_management) state.campaignState.spark_management = out.spark_management;
    showToast('Искры выданы', 'heal'); await refreshAll();
  } catch(e){ showToast(e.message, 'error'); }
}

function rewardFramePreview(c) {
  if (!c) return '<div class="reward-empty">Без рамки</div>';
  const cls = frameClassFor(c.id);
  const img = c.asset_path ? `<span class="frame-demo image-frame-demo"><img loading="lazy" src="${esc(cosmeticImgPath(c))}" alt=""></span>` : `<span class="frame-demo ${esc(cls)}">${esc(c.emoji || '✨')}</span>`;
  return `<div class="reward-preview inline">${img}<div><b>${esc(c.name)}</b><small>${rarityEmoji(displayRarity(c))} ${esc(rarityRu(displayRarity(c)))} · ${esc(c.description || '')}</small></div></div>`;
}
function rewardEffectPreview(e) {
  if (!e) return '<div class="reward-empty">Без эффекта</div>';
  return `<div class="reward-preview inline"><span class="frame-demo effect-demo ${esc(effectClassFor(e.id))}" data-effect-id="${esc(e.id)}"></span><div><b>${esc(e.name)}</b><small>${rarityEmoji(e.rarity)} ${esc(rarityRu(e.rarity))} · ${esc(e.description || '')}</small></div></div>`;
}
function rewardFrameCard(c) {
  if (!c) return `<button class="shop-card reward-none" onclick="selectAchReward('frame','')"><span class="frame-demo plain">○</span><b>Без рамки</b><small>Достижение не выдаёт рамку</small></button>`;
  const cls = frameClassFor(c.id);
  const demo = c.asset_path ? `<span class="frame-demo image-frame-demo"><img loading="lazy" src="${esc(cosmeticImgPath(c))}" alt=""></span>` : `<span class="frame-demo ${esc(cls)}">${esc(c.emoji || '✨')}</span>`;
  return `<button class="shop-card rarity-${esc(displayRarity(c))}" onclick="selectAchReward('frame','${esc(c.id)}')">${demo}<b>${esc(c.name)}</b><small>${rarityEmoji(displayRarity(c))} ${esc(rarityRu(displayRarity(c)))}</small><p>${esc(c.description || '')}</p></button>`;
}
function rewardEffectCard(e) {
  if (!e) return `<button class="shop-card reward-none" onclick="selectAchReward('effect','')"><span class="frame-demo plain">○</span><b>Без эффекта</b><small>Достижение не выдаёт эффект</small></button>`;
  const cls = effectClassFor(e.id);
  return `<button class="shop-card effect-card reward-effect-card rarity-${esc(e.rarity || 'common')} ${esc(cls)}" onclick="selectAchReward('effect','${esc(e.id)}')"><div class="effect-shop-preview">${effectPreviewHtml(e, 'reward-effect-preview')}</div><b>${esc(e.name)}</b><small>${rarityEmoji(e.rarity)} ${esc(rarityRu(e.rarity))}</small><p>${esc(e.description || '')}</p></button>`;
}
function rewardTagPreview(t) {
  if (!t) return '<div class="reward-empty">Без текста тэга</div>';
  return `<div class="reward-preview inline">${tagTextPreview(t, defaultTagShapeId())}<div><b>Текст: ${esc(t.name)}</b><small>${rarityEmoji(t.rarity)} ${esc(rarityRu(t.rarity))} · ${esc(t.description || '')}</small></div></div>`;
}
function rewardTagCard(t) {
  if (!t) return `<button class="shop-card reward-none" onclick="selectAchReward('tag','')"><span class="tag-preview-demo">—</span><b>Без текста</b><small>Достижение не выдаёт текст тэга</small></button>`;
  return `<button class="shop-card rarity-${esc(t.rarity || 'common')}" onclick="selectAchReward('tag','${esc(t.id)}')">${tagTextPreview(t, defaultTagShapeId())}<b>${esc(t.name)}</b><small>${rarityEmoji(t.rarity)} ${esc(rarityRu(t.rarity))}</small><p>${esc(t.description || '')}</p></button>`;
}
function openRewardPicker(kind) {
  const isFrame = kind === 'frame';
  const isEffect = kind === 'effect';
  const isTag = kind === 'tag';
  const rewardEligible = x => String(x?.rarity || 'common') !== 'common';
  const items = sortByRarity(
    isFrame ? baseCosmetics().concat(uniqueCosmetics()).filter(rewardEligible)
    : isEffect ? baseEffects().filter(e=>e.id!=='effect_none').concat(uniqueEffects()).filter(rewardEligible)
    : tagTexts().filter(rewardEligible)
  );
  const cards = [(isFrame ? rewardFrameCard(null) : isEffect ? rewardEffectCard(null) : rewardTagCard(null))].concat(items.map(x => isFrame ? rewardFrameCard(x) : isEffect ? rewardEffectCard(x) : rewardTagCard(x))).join('');
  showModal(`<div class="modal-card reward-shop-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${isFrame ? '🖼️ Выбор рамки-награды' : isEffect ? '✨ Выбор эффекта-награды' : '🏷️ Выбор тэга-награды'}</div><p class="muted">В награды показывается косметика и тексты тэгов выше обычного качества. Формы тэгов покупаются отдельно в магазине.</p><div class="reward-shop-grid ${isFrame ? 'frame-shop-grid' : 'effect-shop-grid'}">${cards}</div></div>`);
}
function selectAchReward(kind, id) {
  if (kind === 'frame') {
    const input = document.getElementById('achReward'); if (input) input.value = id;
    const box = document.getElementById('achRewardPreview'); if (box) box.innerHTML = rewardFramePreview(cosmeticById(id));
  } else if (kind === 'effect') {
    const input = document.getElementById('achEffectReward'); if (input) input.value = id;
    const box = document.getElementById('achEffectRewardPreview'); if (box) box.innerHTML = rewardEffectPreview(effectById(id));
  } else {
    const input = document.getElementById('achTagReward'); if (input) input.value = id;
    const box = document.getElementById('achTagRewardPreview'); if (box) box.innerHTML = rewardTagPreview(tagById(id));
  }
  closeModal();
  showToast('Награда выбрана', 'info');
}

function chooseReadyTagReward() {
  const name = document.getElementById('achCustomTagName');
  const emoji = document.getElementById('achCustomTagEmoji');
  if (name) name.value = '';
  if (emoji) emoji.value = '';
  updateCustomTagPreview();
  openRewardPicker('tag');
}
function clearReadyTagRewardIfCustom() {
  if (!val('achCustomTagName')) return;
  const input = document.getElementById('achTagReward');
  if (input) input.value = '';
  const box = document.getElementById('achTagRewardPreview');
  if (box) box.innerHTML = '<span class="reward-empty">Будет создан новый уникальный тэг</span>';
}

function renderCustomTagStyleGrid() {
  const grid = document.getElementById('customTagStyleGrid');
  if (!grid) return;
  const current = val('achCustomTagStyle') || 'tag-custom-gold';
  const name = val('achCustomTagName') || 'Пример';
  const emoji = val('achCustomTagEmoji') || '✦';
  grid.innerHTML = TAG_STYLE_OPTIONS.map(opt => `
    <button type="button" class="tag-style-btn ${current===opt.id?'selected':''}" onclick="chooseCustomTagStyle('${esc(opt.id)}')">
      <span class="character-tag rarity-unique ${esc(opt.id)}"><span>${esc(emoji || opt.emoji)}</span><b>${esc(name || opt.sample)}</b></span>
      <small>${esc(opt.name)}</small>
    </button>
  `).join('');
}
function chooseCustomTagStyle(style) {
  const input = document.getElementById('achCustomTagStyle');
  if (input) input.value = style;
  renderCustomTagStyleGrid();
  updateCustomTagPreview();
}
function updateCustomTagPreview() {
  const box = document.getElementById('customTagPreview');
  if (!box) return;
  const name = val('achCustomTagName') || 'Кровожадный';
  const style = tagById(defaultTagShapeId()) || {rarity:'unique', emoji:'🏷️', css_class:'tag-shape-classic'};
  box.innerHTML = `<span class="character-tag rarity-unique ${esc(style.css_class || tagClassFor(style.id))}">${style.emoji ? `<span>${esc(style.emoji)}</span>` : ''}<b>${esc(name)}</b></span>`;
}
function previewAchievementIcon() {
  const input = document.getElementById('achIconFile');
  const box = document.getElementById('achIconPreview');
  const file = input?.files?.[0];
  if (!file || !box) return;
  const url = URL.createObjectURL(file);
  box.innerHTML = `<img class="ach-img" src="${esc(url)}" alt="">`;
}
async function uploadAchievementIconIfNeeded() {
  const input = document.getElementById('achIconFile');
  if (!input?.files?.[0]) return val('achIconPath') || '🏆';
  const out = await apiUpload(`/api/campaigns/${state.currentCampaignId}/achievement-icon`, 'achIconFile');
  const hidden = document.getElementById('achIconPath'); if (hidden) hidden.value = out.icon_path || '';
  const thumb = document.getElementById('achIconThumb'); if (thumb) thumb.value = out.icon_thumb_path || '';
  return out.icon_path || '🏆';
}
const customFramePreviewState = {url:'', scale:1.55, x:0, y:0, dragging:false, startX:0, startY:0, baseX:0, baseY:0};
function customFrameAvatarPreviewHtml() {
  const ch = allChars()[0] || playerChar() || {};
  const src = ch.avatar_thumb_path || ch.avatar_path || '';
  const letter = String(ch.name || 'A').trim().slice(0,1).toUpperCase() || 'A';
  return src ? `<span class="avatar xl" style="--char-color:${esc(ch.color || '#72a7ff')}"><img class="avatar-photo" src="${esc(src)}" alt=""></span>` : `<span class="avatar xl avatar-empty" style="--char-color:${esc(ch.color || '#72a7ff')}"><span class="avatar-initial">${esc(letter)}</span></span>`;
}
function openCustomFrameModal() {
  customFramePreviewState.url = ''; customFramePreviewState.scale = 1.55; customFramePreviewState.x = 0; customFramePreviewState.y = 0;
  showModal(`<div class="modal-card custom-frame-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">🖼️ Добавить кастомную рамку</div><p class="muted">Загрузи рамку и подгони её прямо на аватарке: перетаскивай рамку пальцем/мышью, меняй размер кнопками.</p><label>Название рамки<input id="customFrameName" placeholder="Например: Тройной фарт" maxlength="80"></label><label>Файл рамки<input id="customFrameFile" type="file" accept="image/*" onchange="prepareCustomFramePreview()"></label><div id="customFramePreviewStage" class="custom-frame-preview-stage"><div id="customFramePreviewShell" class="avatar-shell xl custom-frame-preview-shell" style="--avatar-size:112px;--frame-scale:1.55;--frame-size:155%;--frame-offset-x:0%;--frame-offset-y:0%">${customFrameAvatarPreviewHtml()}<img id="customFramePreviewImg" class="avatar-shell-frame custom-frame-preview-img" src="" alt="" style="display:none"></div></div><div class="custom-frame-mini-controls"><button class="secondary" onclick="zoomCustomFramePreview(-0.05)">−</button><span id="customFrameScaleLabel">1.55×</span><button class="secondary" onclick="zoomCustomFramePreview(0.05)">+</button><button class="secondary" onclick="resetCustomFramePreview()">Сброс</button></div><div class="row modal-actions"><button class="ok" onclick="uploadCustomFrame()">Загрузить рамку</button><button class="secondary" onclick="closeModal()">Отмена</button></div><div id="customFrameOut"></div></div>`);
  setTimeout(bindCustomFramePreviewDrag, 0);
}
function updateCustomFramePreviewTransform() {
  const shell = document.getElementById('customFramePreviewShell');
  if (shell) {
    shell.style.setProperty('--frame-scale', customFramePreviewState.scale.toFixed(2));
    shell.style.setProperty('--frame-size', `${(customFramePreviewState.scale * 100).toFixed(2)}%`);
    shell.style.setProperty('--frame-offset-x', `${customFramePreviewState.x.toFixed(1)}%`);
    shell.style.setProperty('--frame-offset-y', `${customFramePreviewState.y.toFixed(1)}%`);
    // legacy preview vars kept for older CSS snippets if present
    shell.style.setProperty('--frame-preview-scale', customFramePreviewState.scale.toFixed(2));
    shell.style.setProperty('--frame-preview-x', `${customFramePreviewState.x.toFixed(1)}%`);
    shell.style.setProperty('--frame-preview-y', `${customFramePreviewState.y.toFixed(1)}%`);
  }
  const label = document.getElementById('customFrameScaleLabel');
  if (label) label.textContent = customFramePreviewState.scale.toFixed(2) + '×';
}
function prepareCustomFramePreview() {
  const input = document.getElementById('customFrameFile');
  const img = document.getElementById('customFramePreviewImg');
  const file = input?.files?.[0];
  if (!file || !img) return;
  if (customFramePreviewState.url) URL.revokeObjectURL(customFramePreviewState.url);
  customFramePreviewState.url = URL.createObjectURL(file);
  customFramePreviewState.scale = 1.55; customFramePreviewState.x = 0; customFramePreviewState.y = 0;
  img.src = customFramePreviewState.url;
  img.style.display = '';
  updateCustomFramePreviewTransform();
}
function zoomCustomFramePreview(delta) {
  customFramePreviewState.scale = Math.max(0.50, Math.min(3.50, customFramePreviewState.scale + Number(delta || 0)));  // v39: allow real frame fitting
  updateCustomFramePreviewTransform();
}
function resetCustomFramePreview() {
  customFramePreviewState.scale = 1.55; customFramePreviewState.x = 0; customFramePreviewState.y = 0;
  updateCustomFramePreviewTransform();
}
function bindCustomFramePreviewDrag() {
  const stage = document.getElementById('customFramePreviewStage');
  if (!stage || stage.dataset.bound === '1') return;
  stage.dataset.bound = '1';
  stage.addEventListener('pointerdown', e => {
    if (!document.getElementById('customFramePreviewImg')?.src) return;
    customFramePreviewState.dragging = true;
    customFramePreviewState.startX = e.clientX;
    customFramePreviewState.startY = e.clientY;
    customFramePreviewState.baseX = customFramePreviewState.x;
    customFramePreviewState.baseY = customFramePreviewState.y;
    stage.setPointerCapture?.(e.pointerId);
  });
  const stop = () => customFramePreviewState.dragging = false;
  stage.addEventListener('pointermove', e => {
    if (!customFramePreviewState.dragging) return;
    const rect = stage.getBoundingClientRect();
    const denom = Math.max(80, Math.min(rect.width, rect.height) * 0.45);
    customFramePreviewState.x = Math.max(-80, Math.min(80, customFramePreviewState.baseX + ((e.clientX - customFramePreviewState.startX) / denom) * 100));
    customFramePreviewState.y = Math.max(-80, Math.min(80, customFramePreviewState.baseY + ((e.clientY - customFramePreviewState.startY) / denom) * 100));
    updateCustomFramePreviewTransform();
  });
  stage.addEventListener('pointerup', stop); stage.addEventListener('pointercancel', stop);
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomCustomFramePreview(e.deltaY > 0 ? -0.04 : 0.04); }, {passive:false});
}
async function uploadCustomFrame() {
  try {
    const name = val('customFrameName') || 'Кастомная рамка';
    const frame_scale = Number(customFramePreviewState.scale || 1.55);
    const frame_offset_x = Number(customFramePreviewState.x || 0);
    const frame_offset_y = Number(customFramePreviewState.y || 0);
    const out = await apiUploadForm(`/api/campaigns/${state.currentCampaignId}/custom-frames`, 'customFrameFile', {name, description: '', rarity: 'unique', frame_scale, frame_offset_x, frame_offset_y});
    state.campaignState.cosmetics = out.cosmetics || state.campaignState.cosmetics;
    closeModal();
    showToast('Кастомная рамка добавлена в библиотеку', 'heal');
    renderCampaign();
  } catch(e) { const el=document.getElementById('customFrameOut'); if(el) el.innerHTML=msg(e.message,'error'); else alert(e.message); }
}

function openMasterAchievement(id) {
  const a = (state.campaignState?.achievement_templates || []).find(x => Number(x.id) === Number(id));
  if (!a) return;
  const chars = allChars().filter(ch => ch.telegram_user_id);
  const options = chars.map(ch => `<option value="${ch.id}">${esc(ch.name)}</option>`).join('');
  const multiTargets = chars.length
    ? chars.map(ch => `<label class="target-check achievement-grant-target" style="--char-color:${esc(ch.color || '#72a7ff')}"><input class="grantMultiChar" type="checkbox" value="${ch.id}">${avatarCircle(ch, 'xs')}<span>${esc(ch.name)}</span><small>TG ${esc(ch.telegram_user_id)}</small></label>`).join('')
    : '<div class="muted">Нет привязанных игроков</div>';
  showModal(`<div class="modal-card achievement-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="achievement-full-head"><button class="ach-icon huge icon-open-btn" onclick="openImageModal('${esc(achIconFullPath(a))}', '${esc(a.title || 'Достижение')}')">${achIconHtml(a.icon || '🏆', '', '')}</button><div><div class="name">${esc(a.title)}</div></div></div>
    <p>${esc(a.description || 'Без описания')}</p>
    ${a.cosmetic_reward ? frameRewardPreviewHtml(a.cosmetic_reward) : ''}
    ${a.cosmetic_effect_reward ? effectRewardPreviewHtml(a.cosmetic_effect_reward) : ''}
    ${a.tag_reward?`<div class="reward-preview">${tagTextPreview(a.tag_reward, defaultTagShapeId())}<div><b>Текст тэга: ${esc(a.tag_reward.name)}</b><small>${esc(a.tag_reward.description || '')}</small></div></div>`:''}
    ${a.currency_reward?`<div class="reward-preview"><span class="currency-icon">✦</span><div><b>Искры: +${esc(a.currency_reward)}</b><small>Валюта аккаунта</small></div></div>`:''}
    <div class="hr"></div>
    <details class="grant-mode" open><summary>Выдать одному игроку</summary><label>Игрок</label><select id="grantChar">${options || '<option value="">Нет привязанных игроков</option>'}</select><button class="ok" onclick="grantAchievement(${Number(a.id)})">Выдать одному</button></details>
    <details class="grant-mode"><summary>Выдать нескольким игрокам</summary><div class="mass-targets achievement-grant-targets">${multiTargets}</div><div class="row"><button class="secondary small" onclick="toggleGrantTargets(true)">Выбрать всех</button><button class="secondary small" onclick="toggleGrantTargets(false)">Снять выбор</button></div><button class="ok" onclick="grantAchievementMany(${Number(a.id)})">Выдать выбранным</button></details>
    <label>Комментарий мастера</label><textarea id="grantComment" placeholder="Например: За безумный добивающий удар"></textarea>
    <div class="row modal-actions"><button class="danger" onclick="deleteAchievement(${Number(a.id)})">Удалить достижение</button><button class="secondary" onclick="closeModal()">Закрыть</button></div><div id="grantOut"></div>
  </div>`);
}

function toggleGrantTargets(on) {
  document.querySelectorAll('.grantMultiChar').forEach(x => x.checked = !!on);
}

async function deleteAchievement(id) {
  if (!confirm('Удалить достижение? Если оно было выдано, связанные выдачи тоже будут удалены.')) return;
  try {
    await api(`/api/campaigns/${state.currentCampaignId}/achievements/${id}`, {method:'DELETE'});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    closeModal();
    showToast('Достижение удалено', 'info');
    renderCampaign();
  } catch(e) {
    const el=document.getElementById('grantOut'); if(el) el.innerHTML=msg(e.message,'error'); else alert(e.message);
  }
}

async function createAchievement() {
  try {
    const title = val('achTitle');
    if (!title) throw new Error('Введите название достижения');
    const icon = await uploadAchievementIconIfNeeded();
    const icon_thumb = val('achIconThumb') || '';
    const customTagName = val('achCustomTagName');
    await api(`/api/campaigns/${state.currentCampaignId}/achievements`, {method:'POST', body:{
      icon, icon_thumb, title, description: val('achDescription'), tag: val('achTag'), cosmetic_reward_id: val('achReward') || null, cosmetic_effect_reward_id: val('achEffectReward') || null, tag_reward_id: customTagName ? null : (val('achTagReward') || null), custom_tag_name: customTagName, custom_tag_emoji: val('achCustomTagEmoji'), custom_tag_style: val('achCustomTagStyle') || 'tag_shape_classic', currency_reward: num('achCurrencyReward', 0)
    }});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast('Достижение создано', 'heal'); renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}

async function grantAchievement(id) {
  try {
    const character_id = Number(val('grantChar') || 0);
    if (!character_id) throw new Error('Выбери игрока');
    await api(`/api/campaigns/${state.currentCampaignId}/achievements/${id}/grant`, {method:'POST', body:{character_id, master_comment: val('grantComment')}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast('Достижение выдано', 'heal'); closeModal(); renderCampaign();
  } catch(e) { const el=document.getElementById('grantOut'); if(el) el.innerHTML=msg(e.message,'error'); else alert(e.message); }
}

async function grantAchievementMany(id) {
  try {
    const character_ids = [...document.querySelectorAll('.grantMultiChar:checked')].map(x => Number(x.value));
    if (!character_ids.length) throw new Error('Выбери хотя бы одного игрока');
    const out = await api(`/api/campaigns/${state.currentCampaignId}/achievements/${id}/grant-many`, {method:'POST', body:{character_ids, master_comment: val('grantComment')}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(out.message || 'Достижения выданы', 'heal'); closeModal(); renderCampaign();
  } catch(e) { const el=document.getElementById('grantOut'); if(el) el.innerHTML=msg(e.message,'error'); else alert(e.message); }
}

function renderPlayerAchievements() {
  const grants = state.campaignState?.achievement_grants || [];
  if (!grants.length) return '<div class="card empty-state">🏆 Достижений пока нет. Когда мастер выдаст ачивку, она появится здесь.</div>';
  const groups = {};
  for (const g of grants) {
    const tag = g.achievement?.tag || 'Без тэга';
    (groups[tag] ||= []).push(g);
  }
  return `<div class="stack achievements-screen player-achievements">${Object.entries(groups).map(([tag, items]) => `<section class="card stack ach-group"><div class="name">${esc(tag)}</div><div class="achievement-row-list">${items.map(g => `<button class="achievement-row-card ${!g.opened_at ? 'unread-achievement' : ''}" onclick="openPlayerAchievement(${Number(g.id)})"><span class="unread-dot"></span><span class="achievement-row-icon">${achIconHtml(g.achievement?.icon || '🏆', '', g.achievement?.icon_thumb || '')}</span><span class="achievement-row-text"><b>${esc(g.achievement?.title || 'Достижение')}</b></span></button>`).join('')}</div></section>`).join('')}</div>`;
}


function rewardFrameDescription(frame) {
  if (!frame) return '';
  const id = String(frame.id || '');
  const templates = state.campaignState?.achievement_templates || [];
  const byTemplate = templates.find(x => String(x.cosmetic_reward_id || x.cosmetic_reward?.id || '') === id);
  if (byTemplate?.description) return byTemplate.description;
  const grant = (state.campaignState?.achievement_grants || []).find(g => String(g.achievement?.cosmetic_reward_id || g.achievement?.cosmetic_reward?.id || '') === id);
  if (grant?.achievement?.description) return grant.achievement.description;
  return frame.description || '';
}
function frameRewardPreviewHtml(frame) {
  if (!frame) return '';
  const img = frame.asset_path ? `<span class="frame-demo image-frame-demo"><img loading="lazy" src="${esc(cosmeticFullImgPath(frame))}" alt=""></span>` : `<span class="frame-demo ${esc(frameClassFor(frame.id))}">${esc(frame.emoji || '✨')}</span>`;
  return `<div class="reward-preview"><button class="reward-image-button ${frame.asset_path ? 'clickable' : ''}" ${frame.asset_path ? `onclick="openImageModal('${esc(cosmeticFullImgPath(frame))}', '${esc(frame.name || 'Рамка')}')"` : ''}>${img}</button><div><b>Рамка: ${esc(frame.name)}</b><small>${esc(rewardFrameDescription(frame) || 'Описание появится из достижения, которое выдаёт рамку.')}</small></div></div>`;
}
function effectRewardPreviewHtml(effect) {
  if (!effect) return '';
  return `<div class="reward-preview"><span class="frame-demo effect-demo ${esc(effectClassFor(effect.id))}" data-effect-id="${esc(effect.id)}"></span><div><b>Эффект: ${esc(effect.name)}</b><small>${esc(effect.description || '')}</small></div></div>`;
}
function tagRewardPreviewHtml(tag) {
  if (!tag) return '';
  return `<div class="reward-preview">${tagTextPreview(tag, defaultTagShapeId())}<div><b>Текст тэга: ${esc(tag.name)}</b><small>${esc(tag.description || '')}</small></div></div>`;
}
function achievementRewardsHtml(a) {
  const parts = [];
  if (a.cosmetic_reward) parts.push(frameRewardPreviewHtml(a.cosmetic_reward));
  if (a.cosmetic_effect_reward) parts.push(effectRewardPreviewHtml(a.cosmetic_effect_reward));
  if (a.tag_reward) parts.push(tagRewardPreviewHtml(a.tag_reward));
  if (Number(a.currency_reward || 0) > 0) parts.push(`<div class="reward-preview"><div class="currency-icon">✦</div><div><b>Искры: +${esc(a.currency_reward)}</b><small>Валюта аккаунта</small></div></div>`);
  return parts.join('');
}

async function openPlayerAchievement(grantId) {
  let g = (state.campaignState?.achievement_grants || []).find(x => Number(x.id) === Number(grantId));
  if (!g) return;
  const firstOpen = !g.opened_at;
  if (firstOpen) {
    try {
      const out = await api(`/api/achievement-grants/${grantId}/open`, {method:'POST'});
      state.campaignState.achievement_grants = out.achievement_grants || state.campaignState.achievement_grants;
      state.campaignState.unlocked_cosmetic_ids = out.unlocked_cosmetic_ids || state.campaignState.unlocked_cosmetic_ids;
      state.campaignState.unlocked_effect_ids = out.unlocked_effect_ids || state.campaignState.unlocked_effect_ids;
      state.campaignState.unlocked_tag_ids = out.unlocked_tag_ids || state.campaignState.unlocked_tag_ids;
      state.campaignState.currency_balance = out.currency_balance ?? state.campaignState.currency_balance;
      state.campaignState.currency_transactions = out.currency_transactions || state.campaignState.currency_transactions;
      g = (state.campaignState?.achievement_grants || []).find(x => Number(x.id) === Number(grantId)) || out.grant || g;
      showToast('Награда за достижение получена', 'heal');
    } catch(e) { showToast(e.message, 'error'); }
  }
  const a = g.achievement || {};
  const rewards = achievementRewardsHtml(a) || '<div class="muted">Без награды</div>';
  const rewardsBlock = firstOpen
    ? `<div class="achievement-reveal-sequence"><div class="name small-title">Награды</div><div class="achievement-reward-burst">${rewards}</div></div>`
    : `<details class="achievement-rewards-collapse"><summary>🎁 Показать награды</summary><div class="achievement-reward-burst compact">${rewards}</div></details>`;
  showModal(`<div class="modal-card achievement-modal ${firstOpen ? 'first-open-achievement' : ''}"><button class="modal-close" onclick="closeModal(); renderCampaign();">×</button><div class="achievement-full-head achievement-reveal-main"><button class="ach-icon huge icon-open-btn" onclick="openImageModal('${esc(achIconFullPath(a))}', '${esc(a.title || 'Достижение')}')">${achIconHtml(a.icon || '🏆', '', '')}</button><div><div class="name">${esc(a.title || 'Достижение')}</div></div></div><p>${esc(a.description || 'Без описания')}</p>${g.master_comment?`<div class="quote-block">${esc(g.master_comment)}</div>`:''}<div class="hr"></div>${rewardsBlock}<div class="muted">Получено: ${esc(g.created_at_msk || '')}</div><div class="row modal-actions"><button class="secondary" onclick="closeModal(); renderCampaign();">Закрыть</button></div></div>`);
}


function renderJournal() {
  const ev = state.campaignState.events || [];
  const isMaster = state.campaignState.role === 'master';
  return `<div class="stack">${isMaster ? '<div class="card row"><button class="danger" onclick="undoLast()">↩ Отменить последнее действие</button><span class="muted">Откатывает последнюю правку/урон/лечение/ремонт, если для неё есть снимок.</span></div>' : ''}${ev.length ? ev.map(e=>`<div class="card journal-card clickable" onclick="openJournalEvent(${Number(e.id)})"><div class="row" style="justify-content:space-between"><b>${esc(e.title)}</b><span class="badge ${eventBadgeClass(e)}">${esc(eventKindLabel(e.kind))}</span></div><div class="muted">${esc(e.created_at_msk || formatMsk(e.created_at))}</div>${journalShort(e)}</div>`).join('') : '<div class="card muted">Журнал пуст.</div>'}</div>`;
}
function eventKindLabel(k){ return {damage:'Damage',manual:'Manual',request:'Request',injury:'Injury',armor_repair:'Armor',full_heal:'Heal',status:'Status',character:'Character',campaign:'Campaign',generator:'Generator',achievement:'Achievement',currency:'Искры',undo:'Undo',join:'Join',miss:'Miss',combat:'Combat',combat_damage:'Enemy Damage'}[k] || k; }
function eventBadgeClass(e){ if(e.kind === 'damage' || e.kind === 'combat_damage') return 'danger'; if(e.kind === 'achievement' || e.kind === 'currency') return 'ok'; if(e.kind === 'combat') return 'warn'; if(e.kind === 'undo') return 'ok'; if(e.kind === 'armor_repair') return 'warn'; return e.payload?.undo ? 'ok' : ''; }
function formatMsk(iso){ try { return new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Moscow', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}).format(new Date(iso)) + ' МСК'; } catch(_) { return iso || '—'; } }
function journalShort(e){
  const p = e.payload || {};
  if (e.kind === 'damage') return `<div class="journal-mini">Урон: <b>${esc(p.damage ?? '—')}</b>${p.armor_mode === 'piercing' ? ' · бронебойный' : ''}</div>`;
  if (e.kind === 'combat_damage') return `<div class="journal-mini">Урон врагу: <b>${esc(p.damage ?? '—')}</b></div>`;
  if (e.kind === 'combat') return `<div class="journal-mini">Контроллер боя</div>`;
  if (e.kind === 'achievement') return `<div class="journal-mini">🏆 ${esc(e.payload?.title || e.title || 'Достижение')}</div>`;
  if (e.kind === 'currency') return `<div class="journal-mini">✦ ${esc(e.payload?.amount ?? '')} искр</div>`;
  if (e.kind === 'manual') return `<div class="journal-mini">Изменено: ${esc(Object.keys(p.updates || {}).join(', ') || 'значения')}</div>`;
  if (e.kind === 'request') return `<div class="journal-mini">Заявка: ${esc(reqTypeRu(p.type || p.request_type))}</div>`;
  if (e.kind === 'injury') return `<div class="journal-mini">Травма #${esc(p.injury_id || '—')}</div>`;
  if (e.kind === 'armor_repair') return `<div class="journal-mini">Бросок: ${esc(p.roll ?? '—')} · износ: ${esc(p.max_loss ?? '—')}</div>`;
  return '';
}
function openJournalEvent(eventId){
  const e = (state.campaignState.events || []).find(x => Number(x.id) === Number(eventId));
  if (!e) return;
  showModal(`<div class="modal-card journal-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="journal-modal-head"><span class="badge ${eventBadgeClass(e)}">${esc(eventKindLabel(e.kind))}</span><div class="name">${esc(e.title)}</div><div class="muted">${esc(e.created_at_msk || formatMsk(e.created_at))}</div></div>${journalDetails(e)}<div class="row modal-actions"><button class="secondary" onclick="closeModal()">Закрыть</button></div></div>`);
}
function journalDetails(e){
  const p = e.payload || {};
  const before = firstUndoChar(p);
  const after = p.character_after || p.after || findChar(e.character_id);
  let rows = '';
  if (e.kind === 'damage') {
    rows += detailRow('Урон', p.damage ?? '—');
    rows += detailRow('Режим брони', p.armor_mode === 'piercing' ? 'бронебойный' : 'обычный');
    rows += charDeltaBlock(before, after);
    rows += injuryChangesBlock(before, after);
  } else if (e.kind === 'manual') {
    rows += detailRow('Изменённые поля', Object.keys(p.updates || {}).join(', ') || '—');
    rows += updatesBlock(p.updates || {}, before, after);
  } else if (e.kind === 'request') {
    rows += detailRow('Тип заявки', reqTypeRu(p.type || p.request_type));
    if (p.request_payload?.hp_amount || p.hp_amount) rows += detailRow('Запрошенное лечение', `${p.request_payload?.hp_amount || p.hp_amount} HP`);
    if (p.request_payload?.roll || p.roll) rows += detailRow('Бросок ремонта', p.request_payload?.roll || p.roll);
    if (p.request_payload?.injury_id || p.injury_id) rows += detailRow('Травма', injuryNameById(after || before, p.request_payload?.injury_id || p.injury_id));
    rows += charDeltaBlock(before, after);
    rows += injuryChangesBlock(before, after);
  } else if (e.kind === 'injury') {
    rows += detailRow('Травма', injuryNameById(after || before, p.injury_id));
    rows += injuryChangesBlock(before, after, p.injury_id);
    rows += charDeltaBlock(before, after);
  } else if (e.kind === 'armor_repair') {
    rows += detailRow('Бросок ремонта', p.roll ?? '—');
    rows += detailRow('Потеря максимума брони', p.max_loss ?? '—');
    rows += charDeltaBlock(before, after);
  } else if (e.kind === 'status') {
    rows += detailRow('Статус', p.text ?? `индекс ${p.idx ?? '—'}`);
    rows += statusesBlock(before, after);
  } else if (e.kind === 'full_heal') {
    rows += detailRow('Действие', 'полное излечение');
    rows += charDeltaBlock(before, after);
    rows += injuryChangesBlock(before, after);
  } else if (e.kind === 'combat_damage') {
    rows += detailRow('Урон по врагу', p.damage ?? '—');
    rows += detailRow('Было HP', p.before ? `${p.before.current_hp}/${p.before.max_hp}` : '—');
    rows += detailRow('Стало HP', p.after ? `${p.after.current_hp}/${p.after.max_hp}` : '—');
    if (p.after && p.after.alive === false) rows += detailRow('Итог', 'враг удалён из инициативы');
  } else if (e.kind === 'combat') {
    rows += detailRow('Бой', `#${p.combat_id || '—'}`);
    if (p.round) rows += detailRow('Раунд', p.round);
    if (p.current?.name) rows += detailRow('Текущий ход', p.current.name);
    if (p.enemy?.name) rows += detailRow('Враг', p.enemy.name);
  } else if (e.kind === 'generator') {
    rows += generatorDetailsBlock(p);
  } else if (e.kind === 'character') {
    rows += detailRow('Действие', 'создание персонажа');
  } else if (e.kind === 'join') {
    rows += detailRow('Действие', 'игрок подключился к персонажу');
  } else if (e.kind === 'undo') {
    rows += detailRow('Отменён лог', `#${p.undo_of || '—'}`);
  }
  if (!rows) rows = `<div class="detail-row"><span>Подробности</span><b>${esc(JSON.stringify(p, null, 2))}</b></div>`;
  return `<div class="journal-details">${rows}</div>`;
}
function firstUndoChar(p){ return (p.undo?.restore_characters || [])[0] || p.character_before || p.before || null; }
function detailRow(label, value){ return `<div class="detail-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`; }
function statDelta(label, a, b, suffix=''){ if (a === undefined && b === undefined) return ''; const changed = String(a) !== String(b); return `<div class="detail-row ${changed?'changed':''}"><span>${esc(label)}</span><b>${esc(a ?? '—')} → ${esc(b ?? '—')}${suffix}</b></div>`; }
function charDeltaBlock(before, after){
  if (!before && !after) return '';
  return `<div class="detail-block"><div class="detail-title">Состояние персонажа</div>${statDelta('HP', before?.current_hp, after?.current_hp)}${statDelta('Макс. HP', before?.current_max_hp, after?.current_max_hp)}${statDelta('Боль', before?.pain, after?.pain)}${statDelta('КД', before?.ac, after?.ac)}${(before?.armor_enabled || after?.armor_enabled) ? statDelta('Броня', before?.armor_current, after?.armor_current) + statDelta('Макс. броня', before?.current_max_armor, after?.current_max_armor) : ''}</div>`;
}
function updatesBlock(updates, before, after){
  const labels = {current_hp:'HP',temp_hp:'Временные HP',max_hp_base:'База макс. HP',max_hp_penalty:'Штраф макс. HP',ac:'КД',pain:'Боль',armor_current:'Броня',armor_max_base:'База макс. брони',armor_max_penalty:'Износ брони',color:'Цвет'};
  const body = Object.entries(updates).map(([k,v]) => statDelta(labels[k] || k, before?.[k], after?.[k] ?? v)).join('');
  return body ? `<div class="detail-block"><div class="detail-title">Ручные изменения</div>${body}</div>` : '';
}
function statusesBlock(before, after){
  return `<div class="detail-block"><div class="detail-title">Статусы</div>${detailRow('Было', (before?.statuses || []).join(', ') || 'нет')}${detailRow('Стало', (after?.statuses || []).join(', ') || 'нет')}</div>`;
}
function injuryChangesBlock(before, after, focusId=null){
  const list = [];
  const ids = new Set([...(before?.injuries || []).map(i=>i.id), ...(after?.injuries || []).map(i=>i.id)]);
  for (const id of ids) {
    if (focusId && Number(id) !== Number(focusId)) continue;
    const a = (before?.injuries || []).find(i=>Number(i.id)===Number(id));
    const b = (after?.injuries || []).find(i=>Number(i.id)===Number(id));
    if (!a && !b) continue;
    const changed = JSON.stringify(a || {}) !== JSON.stringify(b || {});
    if (!changed && focusId == null) continue;
    list.push(`<div class="injury-log-row"><b>${esc(injTitle(b || a))}</b><small>${esc(injuryStateShort(a))} → ${esc(injuryStateShort(b))}</small></div>`);
  }
  return list.length ? `<div class="detail-block"><div class="detail-title">Травмы</div>${list.join('')}</div>` : '';
}
function injuryStateShort(i){ if(!i) return 'нет'; return `${i.healed?'вылечена':i.stabilized?'стабилизирована':'активна'}, штраф ${injuryEffectivePenalty(i)}`; }
function injuryNameById(ch, id){ const inj = (ch?.injuries || []).find(i=>Number(i.id) === Number(id)); return inj ? injTitle(inj) : `#${id || '—'}`; }
function reqTypeRu(t){ return {heal:'лечение',stabilize:'стабилизация травмы',injury_heal:'полное лечение травмы',repair:'ремонт брони',customization_unlock:'устаревший запрос кастомизации'}[t] || (t || '—'); }
function generatorDetailsBlock(p){
  if (p.effects) return `<div class="detail-block"><div class="detail-title">Настроение</div>${detailRow('Мораль', p.morale)}${detailRow('Накопление', p.n)}${detailRow('Фаза', p.phase?.name || '—')}${detailRow('Эффектов', p.count || 0)}</div>`;
  if (p.events) return `<div class="detail-block"><div class="detail-title">События</div>${(p.events || []).map(x=>`<div class="detail-row"><span>•</span><b>${esc(x)}</b></div>`).join('')}</div>`;
  return `<div class="detail-block"><div class="detail-title">Данные генератора</div><pre>${esc(JSON.stringify(p, null, 2))}</pre></div>`;
}
async function undoLast(){ if(!confirm('Отменить последнее действие мастера?')) return; try{ const out=await api(`/api/campaigns/${state.currentCampaignId}/undo-last`, {method:'POST'}); alert(out.message); await render(); }catch(e){alert(e.message);} }


function showPain(charId){
  const ch=findChar(charId); if(!ch) return;
  showModal(`<div class="modal-card"><button class="modal-close" onclick="closeModal()">×</button><div class="name">Боль: ${esc(ch.pain)}/100</div><div class="pill ${painClass(ch.pain)}">Текущее состояние</div><p>${painHelp(ch.pain)}</p><div class="hr"></div><p class="muted">Это справка по текущему уровню боли. Значение меняет только мастер.</p></div>`);
}
function painHelp(p){ p=Number(p||0); if(p<15) return 'Боль фоновая. Штрафов нет.'; if(p<35) return '-1 к атакам и проверкам.'; if(p<55) return '-2 к атакам/проверкам, помеха на концентрацию.'; if(p<75) return 'Скорость -5 фт, помеха на атаки.'; if(p<90) return 'Скорость вдвое, помеха на все d20.'; return 'Критическая боль: риск оглушения, нужно срочно лечиться.'; }

function injuryPenaltyPill(i) {
  const loss = Number(i.max_hp_loss || 0);
  const restored = Number(i.max_hp_restored || 0);
  const effective = Number(i.max_hp_effective_loss ?? Math.max(0, loss - restored));
  if (i.healed) return `<span class="pill hp-good">штраф снят</span>`;
  if (restored > 0) return `<span class="pill hp-mid">штраф макс. HP: -${effective} <span class="muted">(было -${loss}, восстановлено ${restored})</span></span>`;
  return `<span class="pill hp-low">штраф макс. HP: -${loss}</span>`;
}

function openInjuryModal(charId, injuryId, master=false){
  const ch=findChar(charId); const i=findInjury(charId, injuryId); if(!ch||!i) return;
  const status = i.healed ? 'вылечена' : i.stabilized ? 'стабилизирована' : 'не стабилизирована';
  const sev = i.severity || 'medium';
  const statusClass = i.healed ? 'tag-healed' : i.stabilized ? 'tag-stable' : 'tag-active';
  const actions = master
    ? `<div class="row injury-actions"><button class="ok" onclick="masterStabilize(${i.id})" ${i.stabilized || i.healed ? 'disabled':''}>Стабилизировать</button><button class="warn" onclick="masterHealInjury(${i.id})" ${i.healed?'disabled':''}>Вылечить полностью</button></div>`
    : `<div class="row injury-actions"><button class="ok" onclick="sendPlayerRequest(${ch.id},'stabilize',{injury_id:${i.id}})" ${i.stabilized || i.healed ? 'disabled':''}>Запросить стабилизацию</button><button class="warn" onclick="sendPlayerRequest(${ch.id},'injury_heal',{injury_id:${i.id}})" ${i.healed?'disabled':''}>Запросить полное лечение</button></div>`;
  showModal(`<div class="modal-card injury-modal severity-${esc(sev)}"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="injury-hero">
      <div class="injury-icon">${injuryIcon(i.location)}</div>
      <div><div class="injury-kicker">Травма персонажа ${esc(ch.name)}</div><div class="injury-title">${esc(injTitle(i))}</div></div>
    </div>
    <div class="injury-tags">
      <span class="injury-tag ${severityClass(i.severity,i.stabilized)}">${esc(i.severity_ru || i.severity)}</span>
      <span class="injury-tag ${statusClass}">${esc(status)}</span>
      ${injuryPenaltyPill(i)}
    </div>
    ${i.notes ? `<div class="injury-note">${esc(i.notes)}</div>` : ''}
    <div class="injury-section combat"><span>⚔️ Бой</span><p>${esc(i.combat || '—')}</p></div>
    <div class="injury-section exploration"><span>🧭 Исследование</span><p>${esc(i.exploration || '—')}</p></div>
    <div class="injury-section social"><span>🎭 Социалка</span><p>${esc(i.social || '—')}</p></div>
    ${i.psych_effect?`<div class="injury-section psyche"><span>🧠 Психика</span><p>${esc(i.psych_effect)}</p></div>`:''}
    <div class="injury-section healing"><span>💚 Лечение</span><p>${esc(i.heal_rule || '—')}</p></div>
    ${actions}</div>`);
}
function injuryIcon(loc){ return {head:'🧠',torso:'🫁',arm_r:'💪',arm_l:'💪',leg_r:'🦵',leg_l:'🦵'}[loc] || '🩸'; }

async function masterStabilize(injuryId){ try{ const out=await api(`/api/injuries/${injuryId}/stabilize`, {method:'POST'}); alert(out.message); closeModal(); await render(); }catch(e){alert(e.message);} }
async function masterHealInjury(injuryId){ try{ const out=await api(`/api/injuries/${injuryId}/heal`, {method:'POST'}); alert(out.message); closeModal(); await render(); }catch(e){alert(e.message);} }
function showModal(html){ closeModal(); const wrap=document.createElement('div'); wrap.id='modal'; wrap.className='modal-backdrop'; wrap.innerHTML=html; document.body.appendChild(wrap); bindAfterRender(); }
function closeModal(){ const m=document.getElementById('modal'); if(m) m.remove(); }

init();
