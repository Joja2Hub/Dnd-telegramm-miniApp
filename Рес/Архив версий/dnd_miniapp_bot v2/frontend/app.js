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


const UI_STATE_VERSION = '46';
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
function baseTags() { return cosmeticTags().filter(c => c.category === 'base'); }
function uniqueTags() { return cosmeticTags().filter(c => c.category !== 'base' && c.category !== 'hidden'); }
function tagClassFor(id) { const t=tagById(id); return t?.css_class || (id ? `tag-${String(id).replace(/_/g, '-')}` : ''); }
function currencyBalance() { return Number(state.campaignState?.currency_balance || 0); }
function priceOf(item) { return item?.price == null ? ({common:25, rare:75, epic:200, legendary:500, unique:null}[item?.rarity || 'common'] ?? 25) : item.price; }
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

const HIDDEN_EFFECT_IDS = new Set(['blue_static','tiny_glitch','neon_pulse','leaf_swirl','prism_glint']);
function visibleEffects() { return cosmeticEffects().filter(e => e.id !== 'effect_none' && !HIDDEN_EFFECT_IDS.has(String(e.id))); }
function frameClassFor(id) {
  const c = cosmeticById(id);
  return c?.css_class || (id ? `frame-${String(id).replace(/_/g, '-')}` : '');
}
function effectClassFor(id) {
  const c = effectById(id);
  return c?.css_class || (id ? `effect-${String(id).replace(/_/g, '-')}` : '');
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
    ? characters.map(ch => `<button class="join-character-card" style="--char-color:${esc(ch.color || '#72a7ff')}" onclick="joinCampaign(${ch.id})">${avatarCircle(ch, 'sm')}<span><b>${esc(ch.name)}</b><small>HP ${esc(ch.current_hp || ch.max_hp_base || '—')}/${esc(ch.current_max_hp || ch.max_hp_base || '—')}</small></span></button>`).join('')
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
function hpPill(ch) { return `<span class="pill stat ${hpClass(ch)}"><strong>HP</strong> ${ch.current_hp}/${ch.current_max_hp}</span>`; }
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
  const styleId = String(ch?.custom_tag_style || 'tag_none');
  if (textTag) {
    const style = tagById(styleId) || {rarity:'common', emoji:'', css_class:'tag-hero'};
    return `<span class="character-tag ${esc(cls)} rarity-${esc(style.rarity || 'common')} ${esc(style.css_class || tagClassFor(styleId))}">${style.emoji?`<span>${esc(style.emoji)}</span>`:''}<b>${esc(textTag)}</b></span>`;
  }
  const id = String(ch?.custom_tag || '');
  if (!id || id === 'tag_none') return '';
  const t = tagById(id) || {name:id, rarity:'common', emoji:'', css_class:''};
  return `<span class="character-tag ${esc(cls)} rarity-${esc(t.rarity || 'common')} ${esc(t.css_class || tagClassFor(id))}">${t.emoji?`<span>${esc(t.emoji)}</span>`:''}<b>${esc(t.name || id)}</b></span>`;
}

function characterNameWithTag(ch) {
  return `<span class="char-name-line"><span>${esc(ch?.name || 'Персонаж')}</span>${characterTagPill(ch)}</span>`;
}
function avatarCircle(ch, size='md') {
  const color = ch?.color || '#72a7ff';
  const avatarSrc = ['lg','xl','xxl'].includes(size) ? (ch?.avatar_path || ch?.avatar_thumb_path || '') : (ch?.avatar_thumb_path || ch?.avatar_path || '');
  const initial = String(ch?.name || '?').trim().slice(0,1).toUpperCase() || '?';
  const frame = String(ch?.custom_frame || '');
  const effect = String(ch?.custom_effect || '');
  const frameObj = frame ? cosmeticById(frame) : null;
  const frameAsset = frameObj ? (['md','lg','xl','xxl'].includes(size) ? cosmeticFullImgPath(frameObj) : cosmeticImgPath(frameObj)) : '';
  const frameScale = Math.max(0.50, Math.min(3.50, Number(frameObj?.frame_scale || 1.55)));  // v39: exact uploaded-frame scale
  const frameOffsetX = Math.max(-80, Math.min(80, Number(frameObj?.frame_offset_x || 0)));
  const frameOffsetY = Math.max(-80, Math.min(80, Number(frameObj?.frame_offset_y || 0)));
  const frameClass = frame && !frameAsset ? ` cosmetic-frame ${frameClassFor(frame)}` : '';
  const effectClass = effect ? ` cosmetic-effect ${effectClassFor(effect)}` : '';
  const avatarInner = avatarSrc
    ? `<span class="avatar ${size}${frameClass}${effectClass}" style="--char-color:${esc(color)}"><img loading="lazy" class="avatar-photo" src="${esc(avatarSrc)}" alt=""></span>`
    : `<span class="avatar ${size} avatar-empty${frameClass}${effectClass}" style="--char-color:${esc(color)}"><span class="avatar-initial">${esc(initial)}</span></span>`;
  // Uploaded PNG/WebP frames use an outer anchor shell. This prevents old avatar CSS
  // from treating the overlay as part of the avatar box and shifting it away from the
  // avatar center in character/profile/combat cards.
  if (frameAsset) {
    const frameSize = `${(frameScale * 100).toFixed(2)}%`;
    return `<span class="avatar-shell ${size}" style="--char-color:${esc(color)};--frame-scale:${esc(frameScale)};--frame-size:${esc(frameSize)};--frame-offset-x:${esc(frameOffsetX)}%;--frame-offset-y:${esc(frameOffsetY)}%">${avatarInner}<img loading="lazy" class="avatar-shell-frame" src="${esc(frameAsset)}" alt=""></span>`;
  }
  return avatarInner;
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
      <span class="collapsed-main"><span class="collapsed-name">${esc(ch.name)}</span><span class="collapsed-hp ${hpClass(ch)}">HP ${esc(ch.current_hp)}/${esc(ch.current_max_hp)}</span></span>
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
  return `<select id="${id}" class="target-select">${allChars().map(ch=>`<option value="${ch.id}">${esc(ch.name)} · HP ${ch.current_hp}/${ch.current_max_hp}${ch.armor_enabled ? ` · Броня ${ch.armor_current}/${ch.current_max_armor}` : ''}</option>`).join('')}</select>`;
}

function combatTargetCards(id='directTarget') {
  const chars = allChars();
  const first = chars[0]?.id || '';
  const cards = chars.map((ch, index)=>`<button type="button" class="combat-target ${index===0?'selected':''}" style="--char-color:${esc(ch.color || '#72a7ff')}" onclick="selectCombatTarget('${id}', ${ch.id}, this)">
    ${avatarCircle(ch, 'sm')}
    <span class="combat-target-main"><b>${esc(ch.name)}</b><small>HP ${ch.current_hp}/${ch.current_max_hp}${ch.armor_enabled ? ` · Броня ${ch.armor_current}/${ch.current_max_armor}` : ''}</small></span>
  </button>`).join('') || '<div class="muted">Нет персонажей.</div>';
  return `<input id="${id}" type="hidden" value="${first}"><div class="combat-target-grid">${cards}</div>`;
}

function selectCombatTarget(id, charId, el) {
  const input = document.getElementById(id);
  if (input) input.value = String(charId);
  document.querySelectorAll('.combat-target').forEach(btn => btn.classList.remove('selected'));
  if (el) el.classList.add('selected');
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
  return `<div class="combat-tools-grid">
    <details class="card stack combat-section" ${sectionAttrs('combat-direct-damage')}><summary>🎯 Обычная атака по персонажу</summary><div class="stack section-body"><label>Цель</label>${combatTargetCards('directTarget')}<label>Урон</label><input id="directDamage" type="number" value="0"><div class="row"><button onclick="doDirect(false)">Применить урон</button>${c.armor_enabled ? '<button class="warn" onclick="doDirect(true)">Бронебойный</button>' : ''}</div><div id="combatOut2"></div></div></details>
    <details class="card stack wide combat-section" ${sectionAttrs('combat-mass-damage')}><summary>💥 Массовый урон по персонажам</summary><div class="stack section-body"><label>Урон всем выбранным</label><input id="massDamage" type="number" value="0"><div class="mass-targets">${chars.map(ch=>`<label class="target-check" style="--char-color:${esc(ch.color || '#72a7ff')}"><input class="massTarget" type="checkbox" value="${ch.id}">${avatarCircle(ch, 'xs')}<span>${esc(ch.name)}</span><small>HP ${ch.current_hp}/${ch.current_max_hp}${ch.armor_enabled ? ` · Броня ${ch.armor_current}/${ch.current_max_armor}` : ''}</small></label>`).join('')}</div>${c.armor_enabled ? '<label class="checkline"><input id="massPiercing" type="checkbox"> Бронебойный массовый урон</label>' : ''}<button onclick="doMass()">Применить массовый урон</button><div id="combatOut3"></div></div></details>
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
async function doMass() { try { const ids=[...document.querySelectorAll('.massTarget:checked')].map(x=>Number(x.value)); const out=await api(`/api/campaigns/${state.currentCampaignId}/damage/mass`, {method:'POST', body:{target_ids:ids, damage:num('massDamage',0), piercing:checked('massPiercing')}}); alert(out.result_text); state.tab='combat'; await render(); } catch(e){document.getElementById('combatOut3').innerHTML=msg(e.message,'error');} }


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
    const charList = chars.map(ch => `<div class="profile-line" style="--char-color:${esc(ch.color || '#72a7ff')}">${avatarCircle(ch, 'xs')}<b>${esc(ch.name)}</b>${characterTagPill(ch)}<small>HP ${esc(ch.current_hp)}/${esc(ch.current_max_hp)}</small></div>`).join('') || '<div class="muted">Персонажей нет.</div>';
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
  return `<div class="card stack"><div class="name">🧭 Отряд</div><div class="muted">Нажми на персонажа, чтобы открыть профиль игрока.</div><div class="party-grid">${team.map(ch => `<button class="party-card party-card-button" style="--char-color:${esc(ch.color || '#72a7ff')}" onclick="openUserProfile(${Number(ch.telegram_user_id || 0)})">${avatarCircle(ch, 'md')}<div class="party-main"><b>${esc(ch.name)}</b>${characterTagPill(ch)}<span class="${hpClass(ch)}">HP ${esc(ch.current_hp)}/${esc(ch.current_max_hp)}</span></div><span class="badge ${ch.injury_count ? 'danger':'ok'}">травмы: ${ch.injury_count || 'нет'}</span></button>`).join('')}</div></div>`;
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

function renderMasterSettings() {
  return `<div class="stack">${renderCampaignSettingsCard()}</div>`;
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
    <div class="card stack customization-card"><div class="shop-standalone-head"><div><div class="name">🎨 Кастомизация</div><p class="muted">Выбирай доступное сразу. Закрытую косметику можно открыть нажатием: там будет цена или условие получения.</p></div><span class="currency-pill">✦ ${currencyBalance()}</span></div>${customBlock}</div>
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
  const selectedEffect = String(ch.custom_effect || '');
  const unlocked = unlockedCosmeticSet();
  const unlockedEffects = unlockedEffectSet();
  const selectedTag = String(ch.custom_tag || '');
  const unlockedTags = unlockedTagSet();
  const frameIsAvailable = c => displayRarity(c) === 'common' || unlocked.has(c.id);
  const effectIsAvailable = e => String(e.id) === 'effect_none' || String(e.rarity || 'common') === 'common' || unlockedEffects.has(e.id);
  const tagIsAvailable = t => String(t.id) === 'tag_none' || String(t.rarity || 'common') === 'common' || unlockedTags.has(t.id);
  const frames = availableFirst(baseCosmetics().concat(uniqueCosmetics()), frameIsAvailable);
  const effects = availableFirst(visibleEffects(), effectIsAvailable);
  const tags = availableFirst(baseTags().concat(uniqueTags()), tagIsAvailable);
  const noFrame = `<button type="button" class="frame-choice plain ${selected===''?'selected':''}" onclick="saveCustomFrame(${ch.id}, '')"><span class="frame-demo plain">○</span><b>Без рамки</b><small>только цвет персонажа</small></button>`;
  const noEffect = `<button type="button" class="frame-choice plain ${selectedEffect===''?'selected':''}" onclick="saveCustomEffect(${ch.id}, '')"><span class="frame-demo plain">○</span><b>Без эффекта</b><small>только выбранная рамка</small></button>`;
  const frameHtml = `<div class="frame-grid">${noFrame}</div>` + rarityGroupHtml('Рамки', frames, c => cosmeticChoiceCard(ch.id, c, frameIsAvailable(c), selected));
  const effectHtml = `<div class="frame-grid">${noEffect}</div>` + rarityGroupHtml('Эффекты', effects, e => effectChoiceCard(ch.id, e, effectIsAvailable(e), selectedEffect));
  const noTag = `<button type="button" class="frame-choice plain ${selectedTag===''?'selected':''}" onclick="saveCustomTag(${ch.id}, '')"><span class="tag-preview-demo">—</span><b>Без тэга</b><small>только имя</small></button>`;
  const tagHtml = `<div class="frame-grid">${noTag}</div>` + rarityGroupHtml('Тэги', tags.filter(t=>t.id!=='tag_none'), t => tagChoiceCard(ch.id, t, tagIsAvailable(t), selectedTag));
  return `<div class="customization-sections compact-customization">
    <details class="custom-section frames custom-collapse" ${sectionAttrs('player-custom-frames')}>
      <summary><div class="unique-custom-head"><span>🖼️</span><div><b>Рамки</b><small>Базовые и открытые уникальные рамки. Разделены по редкости.</small></div></div></summary>
      <div class="custom-collapse-body">${frameHtml}</div>
    </details>
    <details class="custom-section effects custom-collapse" ${sectionAttrs('player-custom-effects')}>
      <summary><div class="unique-custom-head"><span>✨</span><div><b>Эффекты рамок</b><small>Дополняют рамку и не заменяют её.</small></div></div></summary>
      <div class="custom-collapse-body">${effectHtml}</div>
    </details>
    <details class="custom-section tags custom-collapse" ${sectionAttrs('player-custom-tags')}>
      <summary><div class="unique-custom-head"><span>🏷️</span><div><b>Тэги</b><small>Отображаются рядом с именем персонажа.</small></div></div></summary>
      <div class="custom-collapse-body">${tagHtml}</div>
    </details>
  </div>`;
}


function cosmeticChoiceCard(charId, c, available, selected) {
  const cls = frameClassFor(c.id);
  const cRarity = displayRarity(c);
  const isSelected = selected === c.id;
  const demo = c.asset_path ? `<span class="frame-demo image-frame-demo"><img loading="lazy" src="${esc(cosmeticImgPath(c))}" alt=""></span>` : `<span class="frame-demo ${esc(cls)}">${esc(c.emoji || '✨')}</span>`;
  if (!available) {
    return `<button type="button" class="frame-choice locked-choice rarity-${esc(cRarity)} ${esc(cls)}" onclick="showLockedCosmetic('${esc(c.id)}')">${demo}<span class="lock-badge">🔒</span><b>${esc(c.name)}</b><small>${cosmeticMetaLabel(c)}</small></button>`;
  }
  return `<button type="button" class="frame-choice unlocked-choice rarity-${esc(cRarity)} ${esc(cls)} ${isSelected?'selected':''}" onclick="saveCustomFrame(${charId}, '${esc(c.id)}')">${demo}<span class="owned-badge">✓</span><b>${esc(c.name)}</b><small>${cosmeticMetaLabel(c)}</small></button>`;
}


function effectChoiceCard(charId, e, available, selected) {
  const cls = effectClassFor(e.id);
  const isSelected = selected === e.id;
  const demo = `<div class="effect-choice-preview"><span class="frame-demo plain">○</span><span class="effect-preview-layer ${esc(cls)}"></span></div>`;
  if (!available) {
    return `<button type="button" class="frame-choice locked-choice effect-card rarity-${esc(e.rarity || 'common')} ${esc(cls)}" onclick="showLockedEffect('${esc(e.id)}')">${demo}<span class="lock-badge">🔒</span><b>${esc(e.name)}</b><small>${effectMetaLabel(e)}</small></button>`;
  }
  return `<button type="button" class="frame-choice unlocked-choice effect-card rarity-${esc(e.rarity || 'common')} ${esc(cls)} ${isSelected?'selected':''}" onclick="saveCustomEffect(${charId}, '${esc(e.id)}')">${demo}<span class="owned-badge">✓</span><b>${esc(e.name)}</b><small>${effectMetaLabel(e)}</small></button>`;
}



function tagChoiceCard(charId, t, available, selected) {
  const isSelected = selected === t.id;
  const demo = `<span class="tag-preview-demo"><span class="character-tag rarity-${esc(t.rarity || 'common')} ${esc(t.css_class || tagClassFor(t.id))}">${t.emoji?`<span>${esc(t.emoji)}</span>`:''}<b>${esc(t.name)}</b></span></span>`;
  if (!available) return `<button type="button" class="frame-choice locked-choice tag-card rarity-${esc(t.rarity || 'common')}" onclick="showLockedTag('${esc(t.id)}')">${demo}<span class="lock-badge">🔒</span><small>${tagMetaLabel(t)}</small></button>`;
  return `<button type="button" class="frame-choice unlocked-choice tag-card rarity-${esc(t.rarity || 'common')} ${isSelected?'selected':''}" onclick="saveCustomTag(${charId}, '${esc(t.id)}')">${demo}<span class="owned-badge">✓</span><small>${tagMetaLabel(t)}</small></button>`;
}

function showLockedTag(id) {
  const t = tagById(id);
  showModal(`<div class="modal-card compact unique-modal locked-custom-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="name">🔒 ${esc(t?.name || 'Тэг закрыт')}</div>
    <div class="locked-preview-card rarity-${esc(t?.rarity || 'legendary')}"><span class="character-tag rarity-${esc(t?.rarity || 'common')} ${esc(t?.css_class || tagClassFor(id))}">${t?.emoji?`<span>${esc(t.emoji)}</span>`:''}<b>${esc(t?.name || id)}</b></span><small>${tagMetaLabel(t)}</small></div>
    <div class="row modal-actions">${shopActionButton('tag', t)}<button class="secondary" onclick="closeModal()">Назад</button></div>
  </div>`);
}


async function saveCustomTag(id, tag) {
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_tag: tag}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(tag ? 'Тэг применён' : 'Тэг отключён', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}

function renderShopBlock(ch) {
  return `<div class="card stack shop-standalone-card">
    <div class="shop-standalone-head"><div><div class="name">🛒 Магазин косметики</div><div class="muted">Покупка рамок, эффектов и тэгов за искры. Уникальное качество открывается только достижениями.</div></div><span class="currency-pill">✦ ${currencyBalance()}</span></div>
    <div class="shop-tabs">
      <details class="custom-section nested-shop" ${sectionAttrs('shop-frames')}><summary><b>🖼️ Рамки</b></summary>${shopItemsHtml('frame', cosmetics().filter(x=>x.category !== 'base'))}</details>
      <details class="custom-section nested-shop" ${sectionAttrs('shop-effects')}><summary><b>✨ Эффекты</b></summary>${shopItemsHtml('effect', cosmeticEffects().filter(x=>x.id !== 'effect_none' && x.category !== 'base'))}</details>
      <details class="custom-section nested-shop" ${sectionAttrs('shop-tags')}><summary><b>🏷️ Тэги</b></summary>${shopItemsHtml('tag', cosmeticTags().filter(x=>x.id !== 'tag_none' && x.category !== 'base'))}</details>
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
  if (kind === 'effect') preview = `<div class="effect-choice-preview"><span class="frame-demo plain">○</span><span class="effect-preview-layer ${esc(effectClassFor(item.id))}"></span></div>`;
  if (kind === 'tag') preview = `<span class="tag-preview-demo"><span class="character-tag rarity-${esc(item.rarity || 'common')} ${esc(item.css_class || tagClassFor(item.id))}">${item.emoji?`<span>${esc(item.emoji)}</span>`:''}<b>${esc(item.name)}</b></span></span>`;
  const action = unlocked ? '<span class="shop-status owned">куплено</span>' : isUnique ? '<span class="shop-status locked">только за ачивку</span>' : `<button class="small ok" onclick="buyShopItem('${kind}','${esc(item.id)}')">Купить за ${priceLabel(item)}</button>`;
  return `<div class="frame-choice shop-buy-card rarity-${esc(displayRarity(item))}">${preview}<b>${esc(item.name)}</b><small>${rarityEmoji(displayRarity(item))} ${esc(rarityRu(displayRarity(item)))}</small>${action}</div>`;
}
async function buyShopItem(kind, id) {
  try {
    const out = await api('/api/shop/purchase', {method:'POST', body:{item_type:kind, item_id:id}});
    state.campaignState.unlocked_cosmetic_ids = out.unlocked_cosmetic_ids || state.campaignState.unlocked_cosmetic_ids;
    state.campaignState.unlocked_effect_ids = out.unlocked_effect_ids || state.campaignState.unlocked_effect_ids;
    state.campaignState.unlocked_tag_ids = out.unlocked_tag_ids || state.campaignState.unlocked_tag_ids;
    state.campaignState.currency_balance = out.currency_balance;
    state.campaignState.currency_transactions = out.currency_transactions || state.campaignState.currency_transactions;
    showToast('Покупка выполнена', 'heal'); closeModal(); renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}
function currencyHistoryHtml(){
  const tx = state.campaignState?.currency_transactions || [];
  if (!tx.length) return '<div class="muted">Истории операций пока нет.</div>';
  return `<div class="stack">${tx.map(t=>`<div class="currency-row ${Number(t.amount)>=0?'plus':'minus'}"><b>${Number(t.amount)>=0?'+':''}${esc(t.amount)} ✦</b><span>${esc(t.reason || 'операция')}</span><small>${esc(t.created_at_msk || '')}</small></div>`).join('')}</div>`;
}

function shopActionButton(kind, item) {
  if (!item) return '';
  const rarity = displayRarity(item);
  if (rarity === 'unique' || item.rarity === 'unique' || item.purchasable === 0) {
    return '';
  }
  return `<button class="ok" onclick="buyShopItem('${kind}','${esc(item.id)}')">Купить за ${priceLabel(item)}</button>`;
}

function showLockedCosmetic(id) {
  const c = cosmeticById(id);
  const preview = c?.asset_path
    ? `<span class="frame-demo image-frame-demo locked-preview-img"><img loading="lazy" src="${esc(cosmeticImgPath(c))}" alt=""></span>`
    : `<span class="frame-demo ${esc(frameClassFor(id))}">${esc(c?.emoji || '✨')}</span>`;
  showModal(`<div class="modal-card compact unique-modal locked-custom-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="name">🔒 ${esc(c?.name || 'Рамка закрыта')}</div>
    <div class="locked-preview-card rarity-${esc(displayRarity(c) || 'legendary')}">${preview}<b>${esc(c?.name || id)}</b><small>${cosmeticMetaLabel(c)}</small></div>
    <p class="muted centered-text">${esc(rewardFrameDescription(c) || 'Рамку можно купить за искры прямо здесь, если она не уникальная. Уникальные рамки открываются достижениями.')}</p>
    <div class="row modal-actions">${shopActionButton('frame', c)}<button class="secondary" onclick="closeModal()">Назад</button></div>
  </div>`);
}

function showLockedEffect(id) {
  const e = effectById(id);
  const cls = effectClassFor(id);
  showModal(`<div class="modal-card compact unique-modal locked-custom-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="name">🔒 ${esc(e?.name || 'Эффект закрыт')}</div>
    <div class="locked-preview-card rarity-${esc(e?.rarity || 'legendary')} effect-card ${esc(cls)}"><div class="effect-choice-preview"><span class="frame-demo plain">○</span><span class="effect-preview-layer ${esc(cls)}"></span></div><b>${esc(e?.name || id)}</b><small>${effectMetaLabel(e)}</small></div>
    <div class="row modal-actions">${shopActionButton('effect', e)}<button class="secondary" onclick="closeModal()">Назад</button></div>
  </div>`);
}


function openUniqueCustomizationLocked(){ showLockedCosmetic(''); }

async function saveCustomFrame(id, frame) {
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_frame: frame}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(frame ? 'Сверкающая рамка применена' : 'Рамка отключена', 'heal');
    renderCampaign();
  } catch(e) { showToast(e.message, 'error'); }
}


async function saveCustomEffect(id, effect) {
  try {
    await api(`/api/characters/${id}/self`, {method:'PATCH', body:{custom_effect: effect}});
    state.campaignState = await api(`/api/campaigns/${state.currentCampaignId}/state`);
    showToast(effect ? 'Эффект рамки применён' : 'Эффект отключён', 'heal');
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
  showModal(`<div class="modal-card compact heal-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">💚 Запрос лечения</div><p class="muted">${esc(ch?.name || 'Персонаж')} сейчас: HP ${esc(ch?.current_hp)}/${esc(ch?.current_max_hp)}. Укажи, сколько HP хочешь восстановить.</p><input id="healAmount" class="big-number" type="number" min="1" placeholder="Например: 12"><div class="row modal-actions"><button class="ok" onclick="submitHealRequest(${id})">Отправить мастеру</button><button class="secondary" onclick="closeModal()">Отмена</button></div></div>`);
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
  const frame = String(ch.custom_frame || '');
  const effect = String(ch.custom_effect || '');
  const frameClass = frame ? ` cosmetic-frame ${frameClassFor(frame)}` : '';
  const effectClass = effect ? ` cosmetic-effect ${effectClassFor(effect)}` : '';
  target.innerHTML = `<span class="avatar xl${frameClass}${effectClass}" style="--char-color:${esc(ch.color || '#72a7ff')}"><img class="avatar-photo" src="${esc(url)}" alt=""></span>`;
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
  const list = items.length ? items.map(it => renderInventoryItem(ch, it)).join('') : '<div class="muted">Инвентарь пуст.</div>';
  const weaponBtn = c.weapons_enabled ? `<button class="secondary" onclick="openItemModal(${ch.id}, 'weapon')">🔫 Оружие</button>` : '';
  const hint = c.weapons_enabled ? '' : '<div class="muted small">Оружейная система выключена в этой кампании.</div>';
  return `<details class="card stack inventory-section custom-collapse" ${sectionAttrs('inventory-'+ch.id)}><summary>🎒 Инвентарь</summary><div class="stack section-body"><div class="inventory-list">${list}</div><div class="row"><button class="secondary" onclick="openItemModal(${ch.id}, 'normal')">➕ Предмет</button>${weaponBtn}</div>${hint}</div></details>`;
}
function ammoTypePill(type, desc='') {
  const t = type || 'обычные';
  const cls = /брон/i.test(t) ? 'ap' : /эксп|кров|огн/i.test(t) ? 'hot' : /пул|слаг/i.test(t) ? 'slug' : /дроб|карт/i.test(t) ? 'shot' : 'normal';
  return `<span class="ammo-type ${cls}" title="${esc(desc||'')}">${esc(t)}</span>`;
}
function renderInventoryItem(ch, it) {
  const icon = it.emoji ? `<span class="item-emoji">${esc(it.emoji)}</span>` : '<span class="item-emoji">•</span>';
  if (it.item_type === 'weapon') {
    if (it.reload_type === 'shell') return renderShellWeapon(ch, it, icon);
    return renderMagazineWeapon(ch, it, icon);
  }
  return `<div class="inventory-item"><div class="inventory-main">${icon}<div><b>${esc(it.name)}</b><small>Количество: ${esc(it.quantity || 1)}</small>${it.description?`<p>${esc(it.description)}</p>`:''}</div></div><div class="row"><button class="secondary small" onclick="editItemQty(${it.id}, ${it.quantity || 1})">Кол-во</button><button class="danger small" onclick="deleteItem(${it.id})">Удалить</button></div></div>`;
}
function weaponSettingsButton(itemId) {
  return `<button class="weapon-settings-btn" onclick="openWeaponSettings(${itemId})" title="Настройки оружия">⚙</button>`;
}
function weaponHeader(it, icon, reloadText) {
  return `<div class="weapon-head"><div class="inventory-main">${icon}<div><b>${esc(it.name)}</b><small class="weapon-reload-kind">${esc(reloadText)}</small>${it.description?`<p>${esc(it.description)}</p>`:''}</div></div>${weaponSettingsButton(it.id)}</div>`;
}
function renderMagazineWeapon(ch, it, icon) {
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
  return `<div class="inventory-item weapon-item${firingClass}">${weaponHeader(it, icon, 'магазинная перезарядка')}<div class="ammo-line">${activeHtml}</div><div class="weapon-fire-modes">${modeBtns}</div><button class="secondary reload-weapon-btn" onclick="chooseReloadMag(${it.id})">🔄 Перезарядить / выбрать магазин</button><div class="mag-list compact-mag-list">${mags}</div></div>`;
}
function renderShellWeapon(ch, it, icon) {
  const firingClass = Number(state.firingItemId || 0) === Number(it.id) ? ' firing' : '';
  const maxLoaded = Number(it.mag_capacity || 2);
  const loaded = it.loaded_shells || [];
  const stocks = it.shell_stocks || [];
  const modes = (it.fire_modes||[]).length ? it.fire_modes : [{id:0,name:'Атака',ammo_cost:it.ammo_per_attack||1, description:''}];
  const modeBtns = modes.map(m=>`<button class="small weapon-fire-btn" title="${esc(m.description || '')}" onclick="fireWeapon(${it.id}, ${Number(m.id||0)})"><span>${esc(m.name)}</span><b>${esc(m.ammo_cost)} заряд.</b>${m.description?`<small>${esc(m.description)}</small>`:''}</button>`).join('');
  const loadedHtml = loaded.length ? loaded.map(sh=>`<span class="shell-pill">${esc(sh.ammo_type)}</span>`).join('') : '<span class="muted">пусто</span>';
  const stocksHtml = stocks.length ? stocks.map(st=>`<button class="mag-pill compact-mag shell-stock-pill" onclick="openShellStockModal(${it.id}, ${st.id})"><span class="mag-ammo"><b>${esc(st.quantity)}</b> шт.</span>${ammoTypePill(st.ammo_type, st.description)}</button>`).join('') : '<div class="muted small">Стопок патронов пока нет. Нажми ⚙ в правом верхнем углу и добавь стопку.</div>';
  return `<div class="inventory-item weapon-item shotgun-item${firingClass}">${weaponHeader(it, icon, `поштучная зарядка · ${loaded.length}/${maxLoaded}`)}<div class="ammo-line"><span>Заряжено: ${loadedHtml}</span></div><div class="weapon-fire-modes">${modeBtns}</div><button class="secondary reload-weapon-btn" onclick="chooseLoadShells(${it.id})">🔄 Зарядить</button><div class="mag-list compact-mag-list shell-stock-list">${stocksHtml}</div></div>`;
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
  showModal(`<div class="modal-card compact weapon-settings-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">⚙ Настройки оружия</div><label>Название оружия<input id="weaponRenameName" value="${esc(it.name||'')}" maxlength="100"></label><button class="ok" onclick="saveWeaponRename(${itemId})">Сохранить название</button><button class="secondary" onclick="${addAction}">${addText}</button><button class="danger" onclick="deleteWeaponFromSettings(${itemId})">Удалить оружие</button><button class="secondary" onclick="closeModal()">Назад</button></div>`);
}
async function saveWeaponRename(itemId){
  const name = val('weaponRenameName').trim();
  if(!name) return showToast('Введи название оружия','error');
  try{
    await api(`/api/inventory/items/${itemId}`, {method:'PATCH', body:{name}});
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
async function deleteItem(itemId){ if(!confirm('Удалить предмет?')) return; try{ await api(`/api/inventory/items/${itemId}`, {method:'DELETE'}); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }
async function editItemQty(itemId, oldQty){ const q=prompt('Количество', oldQty); if(!q) return; try{ await api(`/api/inventory/items/${itemId}`, {method:'PATCH', body:{quantity:Number(q)}}); state.campaignState=await api(`/api/campaigns/${state.currentCampaignId}/state`); renderCampaign(); }catch(e){showToast(e.message,'error')} }
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
          <div class="reward-picker-box tag-reward-box"><div class="reward-picker-head"><b>Награда-тэг</b><button class="secondary small" onclick="chooseReadyTagReward()">Выбрать готовый</button></div><div id="achTagRewardPreview" class="reward-empty">Без тэга</div><details class="custom-tag-create-details"><summary><b>➕ Создать новый уникальный тэг</b><small>Открой, если хочешь создать тэг именно этой ачивкой.</small></summary><div class="unique-tag-create"><label>Текст тэга<input id="achCustomTagName" placeholder="Например: Ликвидатор" maxlength="40" oninput="updateCustomTagPreview(); clearReadyTagRewardIfCustom()"></label><label>Эмодзи<input id="achCustomTagEmoji" placeholder="🎯" maxlength="8" oninput="updateCustomTagPreview(); clearReadyTagRewardIfCustom()"></label><input id="achCustomTagStyle" type="hidden" value="tag-custom-gold"><div id="customTagPreview" class="tag-preview-demo tag-style-preview"><span class="character-tag rarity-unique tag-custom-gold"><span>🎯</span><b>Ликвидатор</b></span></div><details class="tag-style-examples"><summary>Показать стили тэга</summary><div id="customTagStyleGrid" class="tag-style-grid"></div></details><small class="muted">Выбери либо готовый тэг, либо создай новый. Если заполнено поле нового тэга, готовый тэг будет очищен.</small></div></details></div>
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
  return `<div class="grid two"><label>Игрок<select id="currencyGrantChar">${options || '<option value="">Нет привязанных игроков</option>'}</select></label><label>Искры<input id="currencyGrantAmount" type="number" value="25"></label><label class="wide">Комментарий<input id="currencyGrantComment" placeholder="За хороший отыгрыш"></label></div><button class="ok" onclick="grantCurrency()">Выдать искры</button>`;
}
async function grantCurrency(){
  try{
    const character_id=Number(val('currencyGrantChar')||0); const amount=num('currencyGrantAmount',0);
    if(!character_id) throw new Error('Выбери игрока');
    if(!amount) throw new Error('Укажи количество искр');
    await api(`/api/campaigns/${state.currentCampaignId}/currency/grant`, {method:'POST', body:{character_id, amount, comment:val('currencyGrantComment')}});
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
  return `<div class="reward-preview inline"><span class="frame-demo effect-demo ${esc(effectClassFor(e.id))}"></span><div><b>${esc(e.name)}</b><small>${rarityEmoji(e.rarity)} ${esc(rarityRu(e.rarity))} · ${esc(e.description || '')}</small></div></div>`;
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
  return `<button class="shop-card effect-card rarity-${esc(e.rarity || 'common')} ${esc(cls)}" onclick="selectAchReward('effect','${esc(e.id)}')"><div class="effect-shop-preview"><span class="frame-demo plain">○</span><span class="effect-preview-layer ${esc(cls)}"></span></div><b>${esc(e.name)}</b><small>${rarityEmoji(e.rarity)} ${esc(rarityRu(e.rarity))}</small><p>${esc(e.description || '')}</p></button>`;
}
function rewardTagPreview(t) {
  if (!t) return '<div class="reward-empty">Без тэга</div>';
  return `<div class="reward-preview inline"><span class="character-tag rarity-${esc(t.rarity || 'common')} ${esc(t.css_class || tagClassFor(t.id))}">${t.emoji?`<span>${esc(t.emoji)}</span>`:''}<b>${esc(t.name)}</b></span><div><b>${esc(t.name)}</b><small>${rarityEmoji(t.rarity)} ${esc(rarityRu(t.rarity))} · ${esc(t.description || '')}</small></div></div>`;
}
function rewardTagCard(t) {
  if (!t) return `<button class="shop-card reward-none" onclick="selectAchReward('tag','')"><span class="tag-preview-demo">—</span><b>Без тэга</b><small>Достижение не выдаёт тэг</small></button>`;
  return `<button class="shop-card rarity-${esc(t.rarity || 'common')}" onclick="selectAchReward('tag','${esc(t.id)}')"><span class="character-tag rarity-${esc(t.rarity || 'common')} ${esc(t.css_class || tagClassFor(t.id))}">${t.emoji?`<span>${esc(t.emoji)}</span>`:''}<b>${esc(t.name)}</b></span><b>${esc(t.name)}</b><small>${rarityEmoji(t.rarity)} ${esc(rarityRu(t.rarity))}</small><p>${esc(t.description || '')}</p></button>`;
}
function openRewardPicker(kind) {
  const isFrame = kind === 'frame';
  const isEffect = kind === 'effect';
  const isTag = kind === 'tag';
  const rewardEligible = x => String(x?.rarity || 'common') !== 'common';
  const items = sortByRarity(
    isFrame ? baseCosmetics().concat(uniqueCosmetics()).filter(rewardEligible)
    : isEffect ? baseEffects().filter(e=>e.id!=='effect_none').concat(uniqueEffects()).filter(rewardEligible)
    : baseTags().filter(t=>t.id!=='tag_none').concat(uniqueTags()).filter(rewardEligible)
  );
  const cards = [(isFrame ? rewardFrameCard(null) : isEffect ? rewardEffectCard(null) : rewardTagCard(null))].concat(items.map(x => isFrame ? rewardFrameCard(x) : isEffect ? rewardEffectCard(x) : rewardTagCard(x))).join('');
  showModal(`<div class="modal-card reward-shop-modal"><button class="modal-close" onclick="closeModal()">×</button><div class="name">${isFrame ? '🖼️ Выбор рамки-награды' : isEffect ? '✨ Выбор эффекта-награды' : '🏷️ Выбор тэга-награды'}</div><p class="muted">В награды показывается только косметика выше обычного качества.</p><div class="reward-shop-grid ${isFrame ? 'frame-shop-grid' : 'effect-shop-grid'}">${cards}</div></div>`);
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
  const name = val('achCustomTagName') || 'Ликвидатор';
  const emoji = val('achCustomTagEmoji') || '🎯';
  const style = val('achCustomTagStyle') || 'tag-custom-gold';
  box.innerHTML = `<span class="character-tag rarity-unique ${esc(style)}">${emoji ? `<span>${esc(emoji)}</span>` : ''}<b>${esc(name)}</b></span>`;
  renderCustomTagStyleGrid();
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
  showModal(`<div class="modal-card achievement-modal"><button class="modal-close" onclick="closeModal()">×</button>
    <div class="achievement-full-head"><button class="ach-icon huge icon-open-btn" onclick="openImageModal('${esc(achIconFullPath(a))}', '${esc(a.title || 'Достижение')}')">${achIconHtml(a.icon || '🏆', '', '')}</button><div><div class="name">${esc(a.title)}</div></div></div>
    <p>${esc(a.description || 'Без описания')}</p>
    ${a.cosmetic_reward ? frameRewardPreviewHtml(a.cosmetic_reward) : ''}
    ${a.cosmetic_effect_reward ? effectRewardPreviewHtml(a.cosmetic_effect_reward) : ''}
    ${a.tag_reward?`<div class="reward-preview"><span class="character-tag rarity-${esc(a.tag_reward.rarity || 'common')} ${esc(a.tag_reward.css_class || tagClassFor(a.tag_reward.id))}">${a.tag_reward.emoji?`<span>${esc(a.tag_reward.emoji)}</span>`:''}<b>${esc(a.tag_reward.name)}</b></span><div><b>Тэг: ${esc(a.tag_reward.name)}</b><small>${esc(a.tag_reward.description || '')}</small></div></div>`:''}
    ${a.currency_reward?`<div class="reward-preview"><span class="currency-icon">✦</span><div><b>Искры: +${esc(a.currency_reward)}</b><small>Валюта аккаунта</small></div></div>`:''}
    <div class="hr"></div>
    <label>Выдать игроку</label><select id="grantChar">${options || '<option value="">Нет привязанных игроков</option>'}</select>
    <label>Комментарий мастера</label><textarea id="grantComment" placeholder="Например: За безумный добивающий удар"></textarea>
    <div class="row modal-actions"><button class="ok" onclick="grantAchievement(${Number(a.id)})">Выдать</button><button class="danger" onclick="deleteAchievement(${Number(a.id)})">Удалить достижение</button><button class="secondary" onclick="closeModal()">Закрыть</button></div><div id="grantOut"></div>
  </div>`);
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
      icon, icon_thumb, title, description: val('achDescription'), tag: val('achTag'), cosmetic_reward_id: val('achReward') || null, cosmetic_effect_reward_id: val('achEffectReward') || null, tag_reward_id: customTagName ? null : (val('achTagReward') || null), custom_tag_name: customTagName, custom_tag_emoji: val('achCustomTagEmoji'), custom_tag_style: val('achCustomTagStyle') || 'tag-custom-gold', currency_reward: num('achCurrencyReward', 0)
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
  return `<div class="reward-preview"><span class="frame-demo effect-demo ${esc(effectClassFor(effect.id))}"></span><div><b>Эффект: ${esc(effect.name)}</b><small>${esc(effect.description || '')}</small></div></div>`;
}
function tagRewardPreviewHtml(tag) {
  if (!tag) return '';
  return `<div class="reward-preview"><div class="tag-preview-demo">${characterTagPill({custom_tag:tag.id}, 'preview')}</div><div><b>Тэг: ${esc(tag.name)}</b><small>${esc(tag.description || '')}</small></div></div>`;
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
  const labels = {current_hp:'HP',max_hp_base:'База макс. HP',max_hp_penalty:'Штраф макс. HP',ac:'КД',pain:'Боль',armor_current:'Броня',armor_max_base:'База макс. брони',armor_max_penalty:'Износ брони',color:'Цвет'};
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
