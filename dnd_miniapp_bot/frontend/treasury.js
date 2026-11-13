window.TreasuryView=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rarity={common:'Обычное',uncommon:'Необычное',rare:'Редкое',epic:'Эпическое',legendary:'Легендарное'};
 const lootColors={common:'#c5d6e8',uncommon:'#67e1a4',rare:'#64b5ff',epic:'#c28aff',legendary:'#ffce71'};
 const openingDurations={common:650,uncommon:850,rare:1050,epic:1300,legendary:1600};
 const status={pending:'Ожидает мастера',used:'Использовано',active:'Активная скидка',frame_credit:'Право на рамку активировано',color_credit:'Бесплатный цвет активирован',gradient_credit:'Бесплатный градиент активирован'};
 const source=r=>r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Описание на dnd.su ↗</a>`:'';
 const openingId=()=>{
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  if(typeof globalThis.crypto?.getRandomValues==='function'){
   const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
   return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
 };
 const chest=`<svg class="treasury-chest" viewBox="0 0 400 260" role="img" aria-label="Сундук сокровищ"><defs><linearGradient id="chestWood" x2="0" y2="1"><stop stop-color="#75463b"/><stop offset="1" stop-color="#302631"/></linearGradient><linearGradient id="chestMetal" x2=".3" y2="1"><stop stop-color="#fff1bc"/><stop offset=".45" stop-color="#cda351"/><stop offset="1" stop-color="#75542d"/></linearGradient></defs><ellipse cx="200" cy="234" rx="135" ry="12" fill="#0006"/><path d="M91 132L200 148L309 132V218L200 241L91 218Z" fill="url(#chestWood)" stroke="#c7a66a" stroke-width="4"/><path d="M200 149V239M95 174L199 190L305 174M95 200L199 218L305 200" stroke="#120f1e" stroke-width="3" opacity=".6"/><path d="M119 139V223L133 226V140M267 140V226L281 223V138" stroke="url(#chestMetal)" stroke-width="10"/><g class="chest-lid"><path d="M89 131Q85 66 125 55L200 39L275 55Q315 66 311 131L200 151Z" fill="url(#chestWood)" stroke="#dfbd79" stroke-width="5"/><path d="M118 138Q112 79 140 52M260 52Q288 79 282 138" fill="none" stroke="url(#chestMetal)" stroke-width="14"/><path d="M91 112L200 131L309 112" fill="none" stroke="#dfbd79" stroke-width="5"/><path d="M185 132L200 124L215 132V158L200 166L185 158Z" fill="url(#chestMetal)"/><circle cx="200" cy="144" r="5" fill="#25202e"/></g></svg>`;
 const codeRain=()=>Array.from({length:18},(_,i)=>`<span style="--delay:${-(i%7)*71}ms">${['010011','101100','001010','110101'][i%4]}</span>`).join('');
 const laptop=`<svg class="treasury-laptop" viewBox="0 0 400 260" role="img" aria-label="Ноутбук с щепкой"><ellipse cx="200" cy="226" rx="171" ry="13" fill="#0008"/><path d="M70 42Q70 30 82 30H318Q330 30 330 42V175H70Z" fill="#25332f" stroke="#56665d" stroke-width="3"/><rect class="chip-screen" x="82" y="43" width="236" height="120" rx="3" fill="#081711" stroke="#335f4b"/><circle cx="200" cy="36" r="2" fill="#84a28f"/><g class="chip-terminal" fill="#a1f0bd" font-family="monospace" font-size="11"><text x="96" y="65">CHIP READER</text><text class="chip-code" style="--line:0" x="96" y="84">&gt; READ   0x7F  9A  01</text><text class="chip-code" style="--line:1" x="96" y="102">&gt; DECODE 01 10 11 00</text><text class="chip-code" style="--line:2" x="96" y="120">&gt; PAYLOAD  VERIFIED</text><path d="M96 136H303" stroke="#24563d" stroke-width="5"/><path class="chip-progress" d="M96 136H303" stroke="#a1f0bd" stroke-width="5"/><path d="M96 148H138" stroke="#68b18a" stroke-width="2"/></g><path d="M70 175H330L367 211Q368 219 355 221H45Q32 219 33 211Z" fill="#2b3733" stroke="#56665d" stroke-width="3"/><path d="M91 182H309L326 199H74Z" fill="#101b17" stroke="#4a5952"/><path d="M87 190H313M112 183L105 197M135 183L130 197M157 183L153 197M179 183L178 197M201 183V197M223 183L225 197M245 183L249 197M267 183L272 197M289 183L296 197" stroke="#596961"/><path d="M174 203H226L231 213H169Z" fill="#17231f" stroke="#56665d"/><g class="treasury-chip"><path d="M302 196L335 184L355 198L321 211Z" fill="#102e24" stroke="#73c79b" stroke-width="2"/><path d="M327 190L342 200M322 192L337 202M317 194L332 204" stroke="#d9b573" stroke-width="2"/></g></svg>`;
 async function mount(root,options){
  if(!root||root.dataset.mounted)return;root.dataset.mounted='1';
  let data,tab=options.tab||'chest',busy=false,result=null;
  const request=options.request;
  let caseType=options.caseType==='cyberpunk'?'cyberpunk':'fantasy';
  const pendingKey=()=> 'treasury-opening-'+options.user+(caseType==='cyberpunk'?'-cyberpunk':'');
  let pendingId=null;
  function pendingOpeningId(){
   if(pendingId)return pendingId;
   try{pendingId=localStorage.getItem(pendingKey());}catch{}
   pendingId=pendingId||openingId();
   try{localStorage.setItem(pendingKey(),pendingId);}catch{}
   return pendingId;
  }
  function clearPendingOpening(){pendingId=null;try{localStorage.removeItem(pendingKey());}catch{}}
  async function load(){data=await request('/api/treasury');options.onState?.(data);render();}
  function showReward(value,flash=null){
   const dialog=document.createElement('dialog');
   dialog.className='treasury-dialog treasury-reward-modal';
   const cyber=value.case_type==='cyberpunk';
   dialog.style.setProperty('--loot-color',lootColors[value.rarity]||lootColors.common);
   dialog.setAttribute('aria-label','Полученная награда');
   const detail=value.note||(value.kind==='sparks'?'Искры зачислены на твой баланс.':value.kind==='keys'?'Награда добавлена к запасу открытий.':'Сокровище сохранено в инвентаре профиля.');
   dialog.innerHTML=`<div class="treasury-result rarity-${esc(value.rarity)}"><small>${cyber?'Данные извлечены':'Сокровище найдено'} · ${rarity[value.rarity]||''}</small><span aria-hidden="true">${esc(value.icon)}</span><h2>${esc(value.name)}</h2><p>${esc(detail)}</p>${source(value)}<button type="button" data-close-reward>Закрыть</button></div>`;
   if(flash){dialog.classList.add('treasury-under-flash');flash.style.animationDelay='-120ms';dialog.append(flash);}
   document.body.append(dialog);dialog.showModal();
   if(flash)setTimeout(()=>flash.remove(),260);
   dialog.querySelector('[data-close-reward]').onclick=()=>dialog.close();
   dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
   dialog.onclose=()=>{dialog.remove();root.querySelector('[data-open]')?.focus({preventScroll:true});};
  }
  async function reveal(value){
   const stage=root.querySelector('.treasury-opening');
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   const refreshed=request('/api/treasury').then(value=>({value}),error=>({error}));
   if(stage){
    stage.classList.remove('opening','revealed','treasury-settled');
    stage.dataset.phase='closed';
    stage.style.setProperty('--loot-color',lootColors[value.rarity]||lootColors.common);
    // Commit the closed lid before starting another opening transition.
    stage.getBoundingClientRect();
    await new Promise(resolve=>setTimeout(resolve,reduced?0:80));
    stage.dataset.phase='glowing';
    stage.classList.add('opening');
    stage.style.setProperty('--opening-duration',(openingDurations[value.rarity]||650)+'ms');
    await new Promise(resolve=>setTimeout(resolve,reduced?0:(openingDurations[value.rarity]||650)));
   }
   const updated=await refreshed;
   const flash=document.createElement('div');
   const cyber=value.case_type==='cyberpunk';
   flash.className='treasury-flash'+(cyber?' treasury-matrix-flash':'');
   flash.style.setProperty('--loot-color',lootColors[value.rarity]||lootColors.common);
   flash.setAttribute('aria-hidden','true');
   if(cyber&&!reduced){
    const screen=stage?.querySelector('.chip-screen')?.getBoundingClientRect();
    if(screen){
     flash.style.setProperty('--flash-x',Math.max(0,Math.min(innerWidth,screen.left+screen.width/2))+'px');
     flash.style.setProperty('--flash-y',Math.max(0,Math.min(innerHeight,screen.top+screen.height/2))+'px');
    }
    flash.innerHTML=codeRain();
   }
   if(!reduced)document.body.append(flash);
   await new Promise(resolve=>setTimeout(resolve,reduced?0:120));
   result=value;
   busy=false;
   if(updated.value){data=updated.value;options.onState?.(data);}
   render();
   if(updated.error)error(updated.error);
   if(root.isConnected)showReward(value,reduced?null:flash);else flash.remove();
  }
  function render(){
   if(!root.isConnected)return;
   const cyber=caseType==='cyberpunk', wallet=cyber?(data.cyberpunk||{keys:0,boosts:0,until_guarantee:10}):data;
   const history=data.history.filter(h=>(h.case_type||'fantasy')===caseType);
   const rerolls=history.filter(h=>h.can_reroll).map(h=>`<div class="treasury-item"><div><b>Повтор: ${esc(h.reward.name)}</b><small>Уже выпадал за последние 5 открытий. Можно один раз заменить награду бесплатно.</small></div><button data-reroll="${h.id}">Переоткрыть</button></div>`).join('');
   const frames=data.frame_credits?`<section><h3>Уникальная рамка</h3><p>Активированных прав: ${data.frame_credits}. Можно забрать рамку за достижение без выдачи самого достижения.</p><label>Рамка<select data-frame-choice>${data.frames.filter(f=>!data.unlocked_cosmetic_ids.includes(f.id)).map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label><button data-claim-selected>Забрать рамку бесплатно</button></section>`:'';
   const boosted=Number(wallet.boosts||0)>0, guaranteed=wallet.guarantee_ready||wallet.until_guarantee===1;
   const openLabel=cyber?(busy?'Взлом…':guaranteed?'Взломать · гарант редкое+':boosted?'Взломать с бустом':'Взломать · 1 щепка'):(busy?'Открывается…':guaranteed?'Открыть · гарант редкое+':boosted?'Открыть с бустом':'Открыть · 1 ключ');
   const opening=`<div class="treasury-opening ${cyber?'treasury-cyber':''} ${result?'treasury-settled':''}" style="--loot-color:${lootColors[result?.rarity]||lootColors.common}"><div class="treasury-radiance" aria-hidden="true"></div>${cyber?laptop:chest}<div class="treasury-actions"><button data-open class="${guaranteed?'treasury-guaranteed':boosted?'treasury-boosted':''}" ${busy||(!boosted&&wallet.keys<1)?'disabled':''}>${openLabel}${guaranteed&&boosted?' · буст':''}</button></div></div><p>${guaranteed?'Следующее открытие: гарантированно редкая награда или выше.':`До гарантированной редкой или лучшей награды: ${wallet.until_guarantee??10} открытий.`}${boosted?` Бустов: ${wallet.boosts}. Сначала расходуются бусты.`:''}</p>${rerolls}`;
   const inventory=`<div class="treasury-inventory">${(data.stacks||data.items).filter(i=>['available','pending','active','frame_credit','color_credit','gradient_credit'].includes(i.status)).map(i=>`<article class="treasury-item rarity-${i.reward.rarity}"><span>${i.reward.icon}</span><div><b>${esc(i.reward.name)}${i.count>1?' ×'+i.count:''}</b><small>${rarity[i.reward.rarity]}${i.status!=='available'?' · '+status[i.status]:''}</small>${source(i.reward)}${i.master_note?`<p>${esc(i.master_note)}</p>`:''}</div>${i.status==='available'?`<div class="treasury-actions"><button class="secondary" data-use="${i.id}">Использовать</button><button class="secondary" data-sell="${i.id}">Продать · ${i.sale_price} ✦</button></div>`:''}</article>`).join('')||'<p class="muted">Сокровищ пока нет.</p>'}</div>`;
   root.innerHTML=`<section class="treasury-view"><header class="treasury-head"><div><h2>Сокровищница</h2><small>${cyber?'Щепок':'Ключей'}: <b>${wallet.keys}</b> · Бустов: ${wallet.boosts||0} · Искр: ${data.balance}</small></div></header><div class="treasury-case-switch" role="group" aria-label="Тип кейса">${[['fantasy','Фэнтези'],['cyberpunk','Киберпанк']].map(([id,label])=>`<button type="button" data-case="${id}" class="${id===caseType?'':'secondary'}" aria-pressed="${id===caseType}">${label}</button>`).join('')}</div><nav class="treasury-tabs">${[['chest',cyber?'Терминал':'Сундук'],['inventory','Инвентарь'],['history','История']].map(([id,name])=>`<button data-tab="${id}" class="${tab===id?'':'secondary'}" aria-pressed="${tab===id}">${name}</button>`).join('')}</nav><div class="treasury-status" role="status"></div>${frames}${tab==='chest'?opening:tab==='inventory'?inventory:`<div>${history.map(h=>`<article class="treasury-item"><span>${h.reward.icon}</span><div><b>${esc(h.reward.name)}</b><small>${rarity[h.reward.rarity]} · ${new Date(h.created_at).toLocaleString('ru-RU')}</small>${source(h.reward)}</div></article>`).join('')||'<p>Открытий пока нет.</p>'}</div>`}</section>`;
  }
  function error(err){const el=root.querySelector('.treasury-status');if(el)el.textContent=err.message;}
  root.addEventListener('click',async event=>{
   const button=event.target.closest('button');if(!button)return;
   if(busy)return;
   if(button.hasAttribute('data-claim-selected')){const id=root.querySelector('[data-frame-choice]')?.value;if(!id)return;button.dataset.frame=id;}
   if(button.dataset.case&&button.dataset.case!==caseType){caseType=button.dataset.case;pendingId=null;result=null;render();root.querySelector('[data-case="'+caseType+'"]')?.focus();return;}
   if(button.dataset.tab){tab=button.dataset.tab;result=null;await load().catch(error);}
   if(button.hasAttribute('data-open')&&!busy){
    busy=true;button.disabled=true;
    try{const requestId=pendingOpeningId();result=null;render();await new Promise(resolve=>setTimeout(resolve,80));const out=await request('/api/treasury/open',{method:'POST',body:JSON.stringify({request_id:requestId,case_type:caseType})});clearPendingOpening();await reveal(out.reward);}
    catch(err){busy=false;if(/Нет ключей|Нет щепок/.test(err.message))clearPendingOpening();render();error(err);}
   }
   if(button.dataset.use)showUse(Number(button.dataset.use));
   if(button.dataset.sell||button.dataset.reroll||button.dataset.frame){
    if(button.dataset.sell&&!confirm('Продать одну штуку за искры? Это действие нельзя отменить.'))return;
    if(button.dataset.reroll&&!confirm('Заменить эту награду новым случайным сокровищем? Старая награда исчезнет.'))return;
    busy=true;button.disabled=true;
    try{const path=button.dataset.sell?`items/${button.dataset.sell}/sell`:button.dataset.reroll?`openings/${button.dataset.reroll}/reroll`:`frames/${button.dataset.frame}/claim`;if(button.dataset.reroll){result=null;render();}const out=await request('/api/treasury/'+path,{method:'POST'});if(out.reward)await reveal(out.reward);else{busy=false;await load();}}catch(err){busy=false;render();error(err);}
   }
  });
  function showUse(id){
   const item=data.items.find(i=>i.id===id),r=item.reward;
   const dialog=document.createElement('dialog');dialog.className='treasury-dialog';
   let fields='';
   if(r.kind==='game')fields=`<label>Персонаж<select name="character_id" required>${data.characters.filter(c=>c.rule_type===(r.case_type||'fantasy')).map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.campaign)}</option>`).join('')}</select></label><p>Предмет уйдёт в заявку. Мастер сам внесёт его персонажу и подтвердит выдачу. При отказе он вернётся сюда.</p>`;
   if(r.choice_type){
    const selected=r.selection||{};
    fields+=`<label>${r.choice_type==='familiar'?'Существо из бестиария':r.choice_type==='implant'?'Установленный имплант':'Базовый '+(r.choice_type==='armor'?'доспех':'вид оружия')}<input name="choice_name" minlength="2" maxlength="120" value="${esc(selected.name||'')}" required placeholder="${r.choice_type==='familiar'?'Название выбранного существа':r.choice_type==='armor'?'Например: кольчуга':r.choice_type==='implant'?'Например: оптический имплант':'Например: рапира'}"></label>`;
    if(r.choice_type==='familiar'){
     const fraction=v=>v.includes('/')?Number(v.split('/')[0])/Number(v.split('/')[1]):Number(v);
     fields+=`<label>Уровень угрозы<select name="choice_cr">${['0','1/8','1/4','1/2','1'].filter(v=>fraction(v)<=fraction(r.max_cr)).map(v=>`<option ${selected.cr===v?'selected':''}>${v}</option>`).join('')}</select></label>`;
    }
    fields+=`<label>Источник или ссылка на запись<input name="choice_source" maxlength="300" value="${esc(selected.source||'')}" placeholder="Бестиарий или книга вашей кампании"></label><p>Мастер проверит выбранный вариант и допустимость по правилам игры.</p>`;
   }
   if(['color','gradient'].includes(r.kind))fields='<p>Активируй купон и выбери свой цвет или градиент в магазине. На подходящей покупке появится отметка «Бесплатно».</p>';
   if(r.kind==='discount')fields='<p>Скидка применится к следующей успешной покупке. Если активировано несколько скидок, сначала используется самая большая. Остальные сохраняются.</p>';
   if(r.kind==='unique')fields='<p>Активируй право, затем бесплатно забери любую уникальную рамку в магазине, в том числе рамку за достижение. Само достижение при этом не выдаётся.</p>';
   dialog.innerHTML=`<form><h3>${esc(r.name)}</h3>${source(r)}${r.note?`<p>${esc(r.note)}</p>`:''}${fields}<p role="alert"></p><div class="treasury-actions"><button type="submit">Подтвердить</button><button type="button" class="secondary" data-cancel>Отмена</button></div></form>`;
   document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
   dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;const body=Object.fromEntries(new FormData(event.target));if(body.character_id)body.character_id=Number(body.character_id);if(r.choice_type){body.selection={name:body.choice_name,cr:body.choice_cr||'',source:body.choice_source||''};delete body.choice_name;delete body.choice_cr;delete body.choice_source;}try{data=await request(`/api/treasury/items/${id}/use`,{method:'POST',body:JSON.stringify(body)});options.onState?.(data);dialog.close();render();}catch(err){dialog.querySelector('[role=alert]').textContent=err.message;submit.disabled=false;}};
  }
  try{await load();}catch(err){root.innerHTML='<p role="alert">'+esc(err.message)+'</p>';delete root.dataset.mounted;}
 }
 async function master(root,{request,campaign,players,caseType='fantasy'}){
  if(root.dataset.mounted)return;root.dataset.mounted='1';
  async function render(){const out=await request(`/api/campaigns/${campaign}/treasury/requests`);root.innerHTML=`<form class="treasury-grant"><label>Игрок<select name="user_id">${players.filter(p=>p.telegram_user_id).map(p=>`<option value="${p.telegram_user_id}">${esc(p.name)}</option>`).join('')}</select></label><label>Награда<select name="key_type"><option value="normal">${caseType==='cyberpunk'?'Щепки':'Ключи'}</option><option value="boost">Буст открытия · необычная награда и выше</option></select></label><label>Количество<input name="amount" type="number" min="1" max="100" value="1" required></label><label>Комментарий<input name="comment" maxlength="300"></label><button>Выдать</button></form><div role="status"></div><h3>Передача сокровищ</h3><p class="muted">Внеси согласованный предмет в инвентарь персонажа вручную, затем отметь выдачу.</p>${out.requests.map(r=>`<form class="treasury-claim" data-id="${r.id}"><b>${esc(r.character_name)} · ${esc(r.reward.name)}</b>${source(r.reward)}<p>${esc(r.reward.note||'')}</p><label>Что выдано<input name="note" maxlength="500" placeholder="Название, количество и согласованные свойства"></label><div class="treasury-actions"><button name="decision" value="yes">Внёс предмет — подтвердить</button><button class="secondary" name="decision" value="no">Вернуть игроку</button></div></form>`).join('')||'<p>Ожидающих заявок нет.</p>'}`;}
  root.addEventListener('submit',async event=>{event.preventDefault();const form=event.target,button=event.submitter;button.disabled=true;const body=Object.fromEntries(new FormData(form));try{if(form.dataset.id){await request('/api/treasury/requests/'+form.dataset.id,{method:'POST',body:JSON.stringify({approve:button.value==='yes',note:body.note})});}else{body.user_id=Number(body.user_id);body.amount=Number(body.amount);await request(`/api/campaigns/${campaign}/treasury/keys`,{method:'POST',body:JSON.stringify(body)});}await render();root.querySelector('[role=status]').textContent='Сохранено';}catch(err){root.querySelector('[role=status]').textContent=err.message;button.disabled=false;}});
  const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary';refresh.textContent='Обновить заявки';refresh.onclick=()=>render().catch(error=>root.querySelector('[role=status]').textContent=error.message);
  root.before(refresh);
  try{await render();}catch(err){root.textContent=err.message;delete root.dataset.mounted;}
 }
 return {mount,master};
})();
