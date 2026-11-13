const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const headers={'X-Dev-Telegram-Id':'464302752'};
 let data=await (await context.request.get('http://127.0.0.1:8000/api/shop/banners',{headers})).json(),buys=0,equips=0;
 const profile=await (await context.request.get('http://127.0.0.1:8000/api/users/464302752/profile',{headers})).json();
 await page.route('**/api/shop/banners',route=>route.fulfill({json:data}));
 await page.route('**/api/shop/purchase',route=>{const body=route.request().postDataJSON();assert.equal(body.item_type,'banner');assert.equal(body.item_id,'ember');buys++;data.banners.find(b=>b.id==='ember').owned=true;return route.fulfill({json:{message:'Opened',currency_balance:500,treasury_discount_percent:0,treasury_benefits:{}}});});
 await page.route('**/api/shop/banners/ember/equip',route=>{equips++;const body=route.request().postDataJSON();assert.equal(body.character_id,10);data.characters.find(c=>c.id===10).custom_banner_id='ember';data.banner_path=data.banners.find(b=>b.id==='ember').path;profile.characters.find(c=>c.id===10).banner_path=data.banner_path;return route.fulfill({json:{banner_path:data.banner_path}});});
 await page.route('**/api/users/464302752/profile',route=>route.fulfill({json:profile}));
 await page.goto('http://127.0.0.1:8000/local-app/?local_tg_id=464302752&campaign_id=3&local_character_id=10&hub_shop=1');
 await page.waitForSelector('.shop-standalone-card');
 await page.getByText('Баннеры профиля',{exact:true}).click();await page.waitForSelector('.banner-shop-choice');
 assert.equal(await page.locator('.banner-shop-choice').count(),66);
 await page.locator('[data-banner-shop] select').selectOption('Биомы');assert.equal(await page.locator('.banner-shop-choice').count(),10);
 await page.locator('[data-banner-shop] select').selectOption('Города');assert.equal(await page.locator('.banner-shop-choice').count(),5);
 await page.locator('.banner-shop-choice img').evaluateAll(nodes=>Promise.all(nodes.map(img=>img.decode())));
 await page.screenshot({path:'tmp/banner-cities-shop-mobile.png',fullPage:true});
 await page.locator('[data-banner-shop] select').selectOption('Магия');assert.equal(await page.locator('.banner-shop-choice').count(),6);
 await page.locator('[data-banner-shop] select').selectOption('Киберпанк · Узоры');assert.equal(await page.locator('.banner-shop-choice').count(),5);
 await page.locator('.banner-shop-choice img').evaluateAll(nodes=>Promise.all(nodes.map(img=>img.decode())));
 await page.locator('[data-banner-shop] select').selectOption('Киберпанк · Локации');assert.equal(await page.locator('.banner-shop-choice').count(),9);
 await page.locator('.banner-shop-choice img').evaluateAll(nodes=>Promise.all(nodes.map(img=>{img.loading='eager';return img.decode();})));
 await page.screenshot({path:'tmp/banner-cyberpunk-shop-mobile.png',fullPage:true});
 await page.evaluate(()=>showBannerPreview('cp-office'));await page.waitForSelector('.banner-preview-modal');
 await page.locator('.banner-preview-modal .character-profile-cover img').evaluate(img=>img.decode());
 await page.locator('.banner-preview-modal').screenshot({path:'tmp/banner-cyberpunk-office-mobile.png'});
 await page.evaluate(()=>closeModal());
 for(const [category,count] of [['Киберпанк · Сеть',2],['Тёмное фэнтези',6],['Бездна и демоны',2],['Драконы и чудовища',4]]){
  await page.locator('[data-banner-shop] select').selectOption(category);assert.equal(await page.locator('.banner-shop-choice').count(),count);
  await page.locator('.banner-shop-choice img').evaluateAll(nodes=>Promise.all(nodes.map(img=>{img.loading='eager';return img.decode();})));
 }
 for(const id of ['calimshan-palace','atm-getaway','pitvin-lights','moonwood-goblins','moon-wormwood','cave-king-crown','dark-dreams-castle']){
  await page.evaluate(id=>showBannerPreview(id),id);await page.waitForSelector('.banner-preview-modal');
  await page.locator('.banner-preview-modal .character-profile-cover img').evaluate(img=>img.decode());
  await page.locator('.banner-preview-modal').screenshot({path:'tmp/banner-'+id+'-mobile.png'});await page.evaluate(()=>closeModal());
 }
 await page.locator('[data-banner-shop] select').selectOption('Все');
 await page.evaluate(()=>showBannerPreview('ember'));await page.waitForSelector('.banner-preview-modal');
 await page.locator('.banner-preview-modal .character-profile-cover img').evaluate(img=>img.decode());
 await page.locator('.banner-preview-modal .ok').click();await page.waitForFunction(()=>document.querySelector('.banner-preview-modal .ok')?.textContent==='Применить персонажу');assert.equal(buys,1);
 await page.locator('.banner-preview-modal .ok').click();await page.waitForFunction(()=>document.querySelector('.banner-preview-modal .ok')?.textContent==='Применён персонажу');assert.equal(equips,1);
 await page.evaluate(()=>closeModal());
 await page.evaluate(()=>document.getElementById('toastHost')?.replaceChildren());
 for(const size of [{width:390,height:844},{width:320,height:740},{width:1440,height:1000}]){
  await page.setViewportSize(size);await page.evaluate(()=>openUserProfile(464302752,10));await page.waitForSelector('.character-profile-modal');
  const panel=page.locator('.character-profile-modal');
  await panel.locator('.character-profile-cover img').evaluate(img=>img.decode());
  const geometry=await panel.evaluate(el=>{el.scrollLeft=80;return {width:el.clientWidth,scroll:el.scrollWidth,left:el.scrollLeft,x:getComputedStyle(el).overflowX,touch:getComputedStyle(el).touchAction};});
  assert.ok(geometry.scroll<=geometry.width+1);assert.equal(geometry.left,0);assert.equal(geometry.x,'hidden');assert.ok(geometry.touch.includes('pan-y'));
  assert.equal(await panel.locator('.character-profile-cover img').getAttribute('src'),data.banner_path);
  assert.ok(await panel.locator('.profile-preview-avatar').evaluate(el=>el.getBoundingClientRect().width<=110));
  await panel.screenshot({path:'tmp/character-profile-'+size.width+'.png'});
  await page.getByRole('button',{name:'Закрыть профиль',exact:true}).click();
 }
 await page.addInitScript(()=>localStorage.setItem('local_hub_user','464302752'));
 await page.goto('http://127.0.0.1:8000/local/hub.html?user=464302752');await page.waitForSelector('.hub-nav');
 await page.getByRole('button',{name:'Настроить профиль',exact:true}).click();
 assert.equal(await page.locator('.hub-banner-settings').count(),0);
 assert.equal(await page.getByRole('combobox',{name:'Баннер профиля',exact:true}).count(),1);
 assert.deepEqual(errors,[]);
 console.log('Passed: banner shop categories, mocked purchase/equip, framed character preview with banner at 320/390/1440px, no horizontal scrolling, banner editor removed. No live purchases.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
