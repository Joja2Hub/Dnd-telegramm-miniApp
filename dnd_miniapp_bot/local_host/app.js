const state = {
  campaigns: [],
  active: null,
  characters: [],
  users: [],
  serverInfo: null,
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[ch]));

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: {'Content-Type': 'application/json'},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.detail || data.message || `Ошибка ${res.status}`);
  return data;
}

function campaignLabel(campaign) {
  const emoji = campaign.emoji || '🎲';
  const type = campaign.rule_type === 'cyberpunk' ? 'Cyberpunk' : 'Fantasy';
  return `${emoji} ${campaign.name} · ${type} · ${campaign.characters_count || 0} перс.`;
}

function avatarHtml(character) {
  const src = character.avatar_thumb_path || character.avatar_path || '';
  const initial = (character.name || '?').slice(0, 1).toUpperCase();
  if (src) return `<span class="avatar" style="--char-color:${esc(character.color || '#72a7ff')}"><img src="${esc(src)}" alt=""></span>`;
  return `<span class="avatar" style="--char-color:${esc(character.color || '#72a7ff')}">${esc(initial)}</span>`;
}

function renderCampaignPicker() {
  const select = $('campaignSelect');
  if (!state.campaigns.length) {
    select.innerHTML = '<option value="">Кампаний в базе пока нет</option>';
    select.disabled = true;
    $('activateBtn').disabled = true;
    return;
  }
  select.disabled = false;
  $('activateBtn').disabled = false;
  const activeId = state.active?.id || state.campaigns[0]?.id;
  select.innerHTML = state.campaigns
    .map((campaign) => `<option value="${campaign.id}" ${Number(campaign.id) === Number(activeId) ? 'selected' : ''}>${esc(campaignLabel(campaign))}</option>`)
    .join('');
}

function renderActive() {
  const box = $('activeBox');
  if (!state.active) {
    box.className = 'active-box error';
    box.innerHTML = '<b>Кампания пока не выбрана</b><span>Откройте инструменты мастера ниже и выберите игру.</span>';
    return;
  }
  box.className = 'active-box';
  const type = state.active.rule_type === 'cyberpunk' ? 'Cyberpunk' : 'Fantasy';
  const playerUrl = state.serverInfo?.player_url || '';
  box.innerHTML = `<span class="active-campaign-mark">${esc(state.active.emoji || '🎲')}</span><span class="active-campaign-copy"><b>${esc(state.active.name)}</b><small>${type} · ${state.characters.length} перс.</small></span>${playerUrl ? `<div class="player-address"><span><small>Ссылка игрокам</small><code>${esc(playerUrl)}</code></span><button class="copy-link-btn" type="button" onclick="copyPlayerUrl()">Копировать</button></div>` : ''}`;
}

function rememberedMasterTgId() {
  return localStorage.getItem('local_master_tg_id') || localStorage.getItem('dev_tg_id') || String(state.active?.master_tg_id || state.campaigns[0]?.master_tg_id || state.users[0]?.telegram_user_id || '');
}

function userLabel(user) {
  const roles = (user.roles || []).includes('master') ? 'мастер' : 'игрок';
  const masterCampaigns = (user.master_campaign_names || []).join(', ');
  const chars = (user.character_names || []).join(', ');
  const tail = masterCampaigns || chars || `TG ${user.telegram_user_id}`;
  return `${user.display_name || ('TG ' + user.telegram_user_id)} · ${roles}${tail ? ' · ' + tail : ''}`;
}

function masterLoginFormHtml() {
  const selected = rememberedMasterTgId();
  const options = state.users.length
    ? state.users.map(user => `<option value="${esc(user.telegram_user_id)}" ${String(user.telegram_user_id) === String(selected) ? 'selected' : ''}>${esc(userLabel(user))}</option>`).join('')
    : `<option value="${esc(selected)}">${selected ? esc('TG ' + selected) : 'Пользователей в базе пока нет'}</option>`;
  return `
    <details class="local-master-panel">
      <summary>
        <span>Вход мастера по Telegram ID</span>
        <small>открыть Mini App или создать новую игру</small>
      </summary>
      <div class="local-master-body">
        <div class="local-master-login">
          <label>Войти как<select id="masterTgId">${options}</select></label>
          <label>Ник TG, если хочешь<input id="masterTgUsername" placeholder="@username" value="${esc(localStorage.getItem('dev_tg_username') || '')}"></label>
          <button type="button" onclick="enterAsChosenMaster()">Открыть панель мастера</button>
        </div>
        <div class="muted local-master-note">Так можно зайти в Mini App из браузера и создать новую игру на главном экране. Ник Telegram браузер сам узнать не может, поэтому его можно только вписать вручную.</div>
      </div>
    </details>
  `;
}

function createCampaignFormHtml() {
  const selected = rememberedMasterTgId();
  const options = state.users.length
    ? state.users.map(user => `<option value="${esc(user.telegram_user_id)}" ${String(user.telegram_user_id) === String(selected) ? 'selected' : ''}>${esc(userLabel(user))}</option>`).join('')
    : `<option value="${esc(selected)}">${selected ? esc('TG ' + selected) : 'Сначала нужен пользователь в базе'}</option>`;
  return `<details class="local-create-panel">
    <summary><span><b>Создать новую игру</b><small>кампания сразу станет активной</small></span></summary>
    <form class="local-create-body" onsubmit="createLocalCampaign(event)">
      <div class="local-create-grid">
        <label>Название<input id="localCampaignName" maxlength="80" placeholder="Например: Новая история" required></label>
        <label>Система<select id="localCampaignRule"><option value="fantasy">Фэнтези</option><option value="cyberpunk">Киберпанк</option></select></label>
        <label class="local-create-master">Главный мастер<select id="localCampaignMaster" ${selected ? '' : 'disabled'}>${options}</select></label>
      </div>
      <div class="local-create-options">
        <label><input id="localCampaignInjuries" type="checkbox" checked> Травмы</label>
        <label><input id="localCampaignArmor" type="checkbox"> Броня</label>
        <label><input id="localCampaignWeapons" type="checkbox"> Оружие и магазины</label>
      </div>
      <button id="createLocalCampaignBtn" class="create-campaign-btn" type="submit" ${selected ? '' : 'disabled'}>Создать и открыть</button>
      <div id="createLocalCampaignStatus" class="muted" role="status"></div>
    </form>
  </details>`;
}

function renderLogin() {
  const characterBox = $('characterBox');
  const createBox = $('hostCreateBox');
  const hostBox = $('hostLoginBox');
  createBox.innerHTML = createCampaignFormHtml();
  if (!state.active) {
    characterBox.innerHTML = '<div class="empty-state">После выбора кампании здесь появятся персонажи.</div>';
    hostBox.innerHTML = `${masterLoginFormHtml()}<button class="secondary reset-login" type="button" onclick="clearLocalLogin()">Сбросить сохраненный вход</button>`;
    return;
  }

  const characters = state.characters.length
    ? `<div class="character-grid">${state.characters.map((character) => `
        <button class="character secondary" type="button" onclick="enterAsPlayer(${Number(character.id)})">
          ${avatarHtml(character)}
          <span class="char-meta">
            <b>${esc(character.name)}</b>
            <small>HP ${esc(character.current_hp)}/${esc(character.current_max_hp)} · AC ${esc(character.ac)}</small>
          </span>
          <span class="badge">Игрок</span>
        </button>
      `).join('')}</div>`
    : '<div class="empty-state">В активной кампании пока нет персонажей.</div>';

  characterBox.innerHTML = characters;
  hostBox.innerHTML = `<div class="host-actions">${masterLoginFormHtml()}<button class="secondary reset-login" type="button" onclick="clearLocalLogin()">Сбросить сохраненный вход</button></div>`;
}

function render() {
  renderCampaignPicker();
  renderActive();
  renderLogin();
}

async function load() {
  try {
    const [campaignsData, usersData, activeData, infoData] = await Promise.all([
      api('/local-api/campaigns'),
      api('/local-api/users'),
      api('/local-api/active-campaign'),
      api('/local-api/info'),
    ]);
    state.campaigns = campaignsData.campaigns || [];
    state.users = usersData.users || [];
    state.active = activeData.campaign || null;
    state.characters = activeData.characters || [];
    state.serverInfo = infoData || null;
    render();
  } catch (error) {
    $('characterBox').innerHTML = `<div class="active-box error">${esc(error.message)}</div>`;
  }
}

async function copyPlayerUrl() {
  const url = state.serverInfo?.player_url || location.href;
  try {
    await navigator.clipboard.writeText(url);
    alert(`Ссылка скопирована:\n${url}`);
  } catch (_) {
    prompt('Ссылка для игроков:', url);
  }
}

async function activateCampaign() {
  const campaignId = Number($('campaignSelect').value || 0);
  if (!campaignId) return;
  const data = await api('/local-api/active-campaign', {method: 'POST', body: {campaign_id: campaignId}});
  state.active = data.campaign || null;
  state.characters = data.characters || [];
  render();
}

async function createLocalCampaign(event) {
  event.preventDefault();
  const name = String($('localCampaignName')?.value || '').trim();
  const masterTgId = Number($('localCampaignMaster')?.value || 0);
  const button = $('createLocalCampaignBtn');
  const status = $('createLocalCampaignStatus');
  if (!name) return $('localCampaignName')?.focus();
  if (!masterTgId) {
    status.textContent = 'Выбери главного мастера.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Создаю кампанию...';
  try {
    const data = await api('/local-api/campaigns', {method: 'POST', body: {
      name,
      master_tg_id: masterTgId,
      rule_type: $('localCampaignRule')?.value || 'fantasy',
      injuries_enabled: !!$('localCampaignInjuries')?.checked,
      armor_enabled: !!$('localCampaignArmor')?.checked,
      weapons_enabled: !!$('localCampaignWeapons')?.checked,
    }});
    const campaign = data.campaign;
    if (!campaign?.id) throw new Error('Сервер не вернул созданную кампанию');
    localStorage.setItem('local_master_tg_id', String(masterTgId));
    localStorage.setItem('dev_tg_id', String(masterTgId));
    localStorage.setItem('local_host_mode', 'host');
    localStorage.setItem('campaign_id', String(campaign.id));
    localStorage.removeItem('dev_view_character_id');
    const params = new URLSearchParams({local_tg_id: String(masterTgId), campaign_id: String(campaign.id)});
    window.location.href = `/local/launch.html?${params.toString()}`;
  } catch (error) {
    button.disabled = false;
    status.textContent = error.message;
  }
}

function enterAsChosenMaster() {
  const tgId = String($('masterTgId')?.value || '').trim();
  const username = String($('masterTgUsername')?.value || '').trim().replace(/^@+/, '');
  if (!/^\d+$/.test(tgId)) {
    alert('Введи Telegram ID мастера цифрами.');
    return;
  }
  localStorage.setItem('local_master_tg_id', tgId);
  localStorage.setItem('dev_tg_id', tgId);
  if (username) localStorage.setItem('dev_tg_username', username);
  else localStorage.removeItem('dev_tg_username');
  if (username) localStorage.setItem('dev_tg_first_name', username);
  else localStorage.removeItem('dev_tg_first_name');
  localStorage.setItem('local_host_mode', 'host');
  localStorage.removeItem('dev_view_character_id');
  if (state.active?.id) localStorage.setItem('campaign_id', String(state.active.id));
  else localStorage.removeItem('campaign_id');
  const params = new URLSearchParams({local_tg_id: tgId});
  if (state.active?.id) params.set('campaign_id', String(state.active.id));
  if (username) {
    params.set('local_tg_username', username);
    params.set('local_tg_first_name', username);
  }
  window.location.href = `/local/launch.html?${params.toString()}`;
}

function enterAsHost() {
  if (!state.active?.master_tg_id) {
    alert('У кампании нет master_tg_id. Создай/открой кампанию мастером в обычном боте хотя бы один раз.');
    return;
  }
  localStorage.setItem('local_host_mode', 'host');
  localStorage.setItem('dev_tg_id', String(state.active.master_tg_id));
  localStorage.removeItem('dev_view_character_id');
  localStorage.setItem('campaign_id', String(state.active.id));
  const params = new URLSearchParams({
    local_tg_id: String(state.active.master_tg_id),
    campaign_id: String(state.active.id),
  });
  window.location.href = `/local/launch.html?${params.toString()}`;
}

function enterAsPlayer(characterId) {
  if (!state.active?.master_tg_id) {
    alert('У кампании нет master_tg_id. Сначала войди мастером.');
    return;
  }
  localStorage.setItem('local_host_mode', 'player');
  localStorage.setItem('dev_tg_id', String(state.active.master_tg_id));
  localStorage.setItem('dev_view_character_id', String(characterId));
  localStorage.setItem('campaign_id', String(state.active.id));
  const params = new URLSearchParams({
    local_tg_id: String(state.active.master_tg_id),
    local_character_id: String(characterId),
    campaign_id: String(state.active.id),
  });
  window.location.href = `/local/launch.html?${params.toString()}`;
}

function clearLocalLogin() {
  localStorage.removeItem('local_host_mode');
  localStorage.removeItem('dev_tg_id');
  localStorage.removeItem('dev_tg_username');
  localStorage.removeItem('dev_tg_first_name');
  localStorage.removeItem('dev_view_character_id');
  localStorage.removeItem('campaign_id');
  localStorage.removeItem('last_join_code');
  alert('Локальный вход сброшен.');
}

function openCreateCampaignPanel() {
  const hostTools = document.querySelector('.host-tools');
  const createPanel = document.querySelector('.local-create-panel');
  if (hostTools) hostTools.open = true;
  if (createPanel) createPanel.open = true;
  createPanel?.scrollIntoView({behavior: 'smooth', block: 'center'});
  setTimeout(() => $('localCampaignName')?.focus(), 350);
}

$('refreshBtn').addEventListener('click', load);
$('createGameShortcut').addEventListener('click', openCreateCampaignPanel);
$('activateBtn').addEventListener('click', activateCampaign);
load();
