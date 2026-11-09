const hubRoot = document.getElementById('hub');
const params = new URLSearchParams(location.search);
const userId = params.get('user') || localStorage.getItem('local_hub_user');
const viewerId = localStorage.getItem('local_hub_user');
const publicView = params.get('view') === 'public' || String(userId) !== String(viewerId);
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shelfNames = {achievements:'Витрина достижений', stats:'Статистика', characters:'Мои персонажи', avatars:'Коллекция аватаров'};
let hubData, hubTab = 'profile', selectedGame = 0, profileDraft = null;

async function hubApi(path, options = {}) {
  const response = await fetch(path, {...options, headers:{'X-Local-User':viewerId || '0', ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers}});
  const data = await response.json();
  if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Не удалось сохранить изменения');
  return data;
}
function portrait(ch) {
  const src = ch.avatar_thumb_path || ch.avatar_path;
  return src ? `<img class="hub-portrait" src="${e(src)}" alt="">` : `<span class="hub-portrait hub-initial">${e((ch.name || '?').slice(0,1))}</span>`;
}
function enterHubCharacter(id, shop = false) {
  if (publicView) return;
  const ch = hubData.characters.find(c => c.id === id);
  if (!ch) return;
  const query = new URLSearchParams({local_tg_id:userId, campaign_id:ch.campaign_id, local_character_id:ch.id});
  if (shop) query.set('hub_shop','1');
  location.href = '/local-app/?' + query;
}
function openHubGame(id) { selectedGame = id; hubTab = 'games'; renderHub(); }
function characterList(characters, shop = false) {
  return `<div class="hub-character-grid">${characters.map(c => {
    const inner = `${portrait(c)}<span><b>${e(c.name)}</b><small>${e(hubData.games.find(g => g.id === c.campaign_id)?.name)}${publicView ? '' : ` · HP ${e(c.current_hp)}/${e(c.current_max_hp)}`}</small></span>`;
    return publicView ? `<article class="hub-character">${inner}</article>` : `<button class="hub-character secondary" onclick="enterHubCharacter(${c.id},${shop})">${inner}<span aria-hidden="true">→</span></button>`;
  }).join('') || '<p class="muted">Персонажей пока нет.</p>'}</div>`;
}
function achievementList(grants) {
  return `<div class="hub-achievements">${grants.map(g => {
    const a = g.achievement || {}, icon = a.icon_thumb || a.icon || '';
    return `<article class="hub-achievement">${icon.startsWith('/') ? `<img src="${e(icon)}" alt="">` : '<span aria-hidden="true">✦</span>'}<div><b>${e(a.title || 'Достижение')}</b><p>${e(a.description || '')}</p></div></article>`;
  }).join('') || '<p class="muted">Пока пусто.</p>'}</div>`;
}
function renderShelf(shelf) {
  const d=hubData, collection=shelf.kind==='achievements'?d.achievements:shelf.kind==='characters'?d.characters:shelf.kind==='avatars'?d.avatars:d.stats;
  const items=shelf.items.map(id=>collection.find(item=>String(shelf.kind==='avatars'?item.path:item.id)===String(id))).filter(Boolean);
  let body='';
  if(shelf.kind==='achievements')body=achievementList(items);
  if(shelf.kind==='characters')body=items.length?characterList(items):'<p class="muted">Витрина пока не заполнена.</p>';
  if(shelf.kind==='avatars')body=`<div class="hub-avatar-grid">${items.map(a=>`<figure><img src="${e(a.path)}" alt="${e(a.name)}"><figcaption>${e(a.name)}</figcaption></figure>`).join('')||'<p class="muted">Пока пусто.</p>'}</div>`;
  if(shelf.kind==='stats')body=`<div class="hub-stats">${items.map(s=>`<div><b>${Number(s.value).toLocaleString('ru-RU')}</b><span>${e(s.label)}</span></div>`).join('')||'<p class="muted">Пока пусто.</p>'}</div>`;
  return `<section class="hub-showcase"><h2>${shelfNames[shelf.kind]}</h2>${body}</section>`;
}
function renderProfile() {
  const p=hubData.profile,name=p.name||hubData.user.display_name;
  return `<section class="profile-banner" aria-label="Баннер профиля"><span>DND</span></section><header class="profile-identity">${portrait({name,avatar_path:p.avatar_path})}<div><h1>${e(name)}</h1><p>${e(p.bio)}</p></div>${publicView?'':'<button class="secondary" onclick="editProfile()">Настроить профиль</button>'}</header>${publicView?'':`<div class="profile-actions"><a href="/local/hub.html?user=${userId}&view=public">Посмотреть глазами гостя</a></div>`}${p.showcases.map(renderShelf).join('')||'<p class="muted">Витрины пока не добавлены.</p>'}`;
}
function renderGames() {
  return `<div class="hub-section-head"><h2>Игры</h2><a class="hub-game-link" href="/local-app/?local_tg_id=${userId}&hub_create=1">Новая игра</a></div>${[...hubData.games].sort((a,b)=>Number(b.active)-Number(a.active)).map(g=>`<section class="hub-game"><div><b>${e(g.name)}</b><small>${g.rule_type==='cyberpunk'?'Киберпанк':'Фэнтези'}${g.master?' · Мастер':''}</small></div>${g.active?'<span class="hub-live">Активная игра</span>':''}<button onclick="openHubGame(${g.id})">Персонажи</button>${g.master?`<a class="hub-game-link" href="/local-app/?local_tg_id=${userId}&campaign_id=${g.id}">Панель мастера</a>`:''}</section>`).join('')||'<p>Игр пока нет.</p>'}${selectedGame?`<h2>${e(hubData.games.find(g=>g.id===selectedGame)?.name)}</h2>${characterList(hubData.characters.filter(c=>c.campaign_id===selectedGame))}`:''}`;
}
function renderHub() {
  const d=hubData;
  let content=renderProfile();
  if(hubTab==='characters')content=`<div class="hub-section-head"><h2>Мои персонажи</h2><button class="secondary" onclick="hubTab='avatars';renderHub()">Аватары</button></div>${characterList(d.characters)}`;
  if(hubTab==='games')content=renderGames();
  if(hubTab==='achievements')content=`<h2>Все достижения · ${d.achievements.length}</h2>${achievementList(d.achievements)}`;
  if(hubTab==='avatars')content=`<h2>Мои аватары</h2><label class="hub-upload">Загрузить аватарку<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="uploadProfileAvatar(this)"></label><div class="hub-avatar-grid">${d.avatars.map((a,i)=>`<figure><img src="${e(a.path)}" alt="${e(a.name)}"><figcaption>${e(a.name)}</figcaption><button class="secondary" onclick="useHubAvatar(${i})">${d.profile.avatar_path===a.path?'Выбрана':'В профиль'}</button></figure>`).join('')}</div>`;
  if(hubTab==='shop')content=`<h2>Магазин</h2><p class="hub-shop-label">Персонаж для примерки</p>${characterList(d.characters,true)}`;
  if(hubTab==='players')content='<h2>Игроки</h2><div id="hubPlayers" role="status">Загрузка...</div>';
  const nav=[['profile','Профиль'],['characters','Персонажи'],['games','Игры'],['achievements','Достижения'],['shop','Магазин'],['players','Игроки']];
  hubRoot.innerHTML=`<header class="hub-header"><a class="hub-brand" href="/local/">DND</a><div>${publicView?`<a href="/local/hub.html?user=${e(viewerId||'')}">Мой профиль</a>`:`<b>${d.balance} ✦</b><a href="/local/">Сменить пользователя</a>`}</div></header>${publicView?'':`<nav class="hub-nav" aria-label="Разделы хаба">${nav.map(([id,label])=>`<button class="${hubTab===id?'selected':'secondary'}" aria-current="${hubTab===id?'page':'false'}" onclick="hubTab='${id}';selectedGame=0;renderHub()">${label}</button>`).join('')}</nav>`}<div id="hubStatus" role="status"></div><div class="hub-content">${content}</div>`;
  if(hubTab==='players'&&!publicView)loadPlayerDirectory();
}
function hubError(error){const status=document.getElementById('hubStatus');if(status){status.textContent=error.message;status.className='hub-error';}}
async function loadPlayerDirectory(){try{const data=await hubApi('/local-api/users'),target=document.getElementById('hubPlayers');if(target)target.innerHTML=data.users.map(u=>`<a class="hub-directory-user" href="/local/hub.html?user=${u.telegram_user_id}&view=public">${portrait({name:u.display_name,avatar_path:u.avatar_path})}<b>${e(u.display_name)}</b></a>`).join('');}catch(error){hubError(error);}}
function editProfile(){profileDraft=structuredClone(hubData.profile);renderProfileEditor();}
function renderProfileEditor(){
  const scrollY=window.scrollY;
  const p=profileDraft;
  hubRoot.querySelector('.hub-content').innerHTML=`<form id="profileEditor" onsubmit="saveProfile(event)"><div class="hub-section-head"><h2>Настройка профиля</h2><button type="button" class="secondary" onclick="profileDraft=null;renderHub()">Отмена</button></div><label>Имя<input maxlength="60" value="${e(p.name)}" placeholder="${e(hubData.user.display_name)}" oninput="profileDraft.name=this.value"></label><label>О себе<textarea maxlength="400" rows="3" oninput="profileDraft.bio=this.value">${e(p.bio)}</textarea></label><label>Аватарка<select onchange="profileDraft.avatar_path=this.value"><option value="">Инициалы</option>${hubData.avatars.map(a=>`<option value="${e(a.path)}" ${p.avatar_path===a.path?'selected':''}>${e(a.name)}</option>`).join('')}</select></label><label class="hub-upload">Загрузить свою аватарку<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="uploadProfileAvatar(this,true)"></label><h2>Витрины</h2><div class="hub-editor-shelves">${p.showcases.map(renderShelfEditor).join('')}</div><div class="hub-add-shelf"><select id="newShelfKind" aria-label="Тип витрины">${Object.entries(shelfNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select><button type="button" onclick="addShelf()" ${p.showcases.length>=8?'disabled':''}>Добавить витрину</button></div><p class="muted">Статистика урона и искр учитывает сохранённые записи журнала.</p><footer class="hub-editor-footer"><button type="submit">Сохранить профиль</button></footer></form>`;
  window.scrollTo(0,scrollY);
}
function renderShelfEditor(shelf,index){
  const collection=shelf.kind==='achievements'?hubData.achievements.map(g=>({id:String(g.id),name:g.achievement?.title})):shelf.kind==='characters'?hubData.characters.map(c=>({id:String(c.id),name:c.name})):shelf.kind==='avatars'?hubData.avatars.map(a=>({id:a.path,name:a.name})):hubData.stats.map(s=>({id:s.id,name:s.label}));
  return `<section class="hub-shelf-editor"><header><b>${shelfNames[shelf.kind]}</b><div><button type="button" class="secondary" aria-label="Поднять витрину ${index+1}" onclick="moveShelf(${index},-1)" ${index===0?'disabled':''}>↑</button><button type="button" class="secondary" aria-label="Опустить витрину ${index+1}" onclick="moveShelf(${index},1)" ${index===profileDraft.showcases.length-1?'disabled':''}>↓</button><button type="button" class="secondary" aria-label="Удалить витрину ${index+1}" onclick="profileDraft.showcases.splice(${index},1);renderProfileEditor()">×</button></div></header><div class="hub-shelf-choices">${collection.map(item=>`<label><input type="checkbox" ${shelf.items.includes(item.id)?'checked':''} onchange="toggleShelfItem(${index},this.value,this.checked)" value="${e(item.id)}">${e(item.name)}</label>`).join('')||'<p class="muted">Пока нет доступных элементов.</p>'}</div><small>${shelf.items.length}/12</small></section>`;
}
function addShelf(){if(profileDraft.showcases.length<8){profileDraft.showcases.push({kind:document.getElementById('newShelfKind').value,items:[]});renderProfileEditor();}}
function moveShelf(index,direction){const next=index+direction;if(next<0||next>=profileDraft.showcases.length)return;[profileDraft.showcases[index],profileDraft.showcases[next]]=[profileDraft.showcases[next],profileDraft.showcases[index]];renderProfileEditor();}
function toggleShelfItem(index,id,checked){
  const shelf=profileDraft.showcases[index];
  const section=document.querySelectorAll('.hub-shelf-editor')[index];
  if(checked&&shelf.items.length>=12){
    const input=[...section.querySelectorAll('input')].find(input=>input.value===id);
    if(input)input.checked=false;
    hubError(Error('В одной витрине можно выбрать до 12 элементов'));return;
  }
  shelf.items=checked?[...new Set([...shelf.items,id])]:shelf.items.filter(value=>value!==id);
  section.querySelector(':scope > small').textContent=`${shelf.items.length}/12`;
}
async function saveProfile(event){event.preventDefault();const button=event.submitter;if(button)button.disabled=true;try{const out=await hubApi(`/local-api/hub/${userId}/profile`,{method:'PATCH',body:JSON.stringify(profileDraft)});hubData.profile=out.profile;profileDraft=null;renderHub();document.getElementById('hubStatus').textContent='Профиль сохранён';}catch(error){hubError(error);if(button)button.disabled=false;}}
async function useHubAvatar(index){try{const out=await hubApi(`/local-api/hub/${userId}/profile`,{method:'PATCH',body:JSON.stringify({...hubData.profile,avatar_path:hubData.avatars[index].path})});hubData.profile=out.profile;renderHub();}catch(error){hubError(error);}}
async function uploadProfileAvatar(input,editing=false){const file=input.files[0];if(!file)return;if(file.size>5*1024*1024){hubError(Error('Размер изображения не должен превышать 5 МБ'));return;}input.disabled=true;try{const form=new FormData();form.append('file',file);const out=await hubApi(`/local-api/hub/${userId}/avatar`,{method:'POST',body:form});hubData=await hubApi('/local-api/hub/'+userId);if(editing){profileDraft.avatar_path=out.avatar_path;renderProfileEditor();}else renderHub();}catch(error){hubError(error);input.disabled=false;}}
async function loadHub(){try{if(!/^\d+$/.test(userId||'')){location.replace('/local/');return;}hubData=await hubApi('/local-api/hub/'+userId+(publicView?'/public':''));renderHub();}catch(error){hubRoot.innerHTML=`<p role="alert">${e(error.message)}</p><button onclick="loadHub()">Повторить</button><a href="/local/">Выбрать пользователя</a>`;}}
loadHub();
