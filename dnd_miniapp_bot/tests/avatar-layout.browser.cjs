const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let playwright;try{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{playwright=require('../tmp/browser-check/node_modules/playwright');}
const {chromium}=playwright;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/local-app/?local_tg_id=464302752&campaign_id=3&local_character_id=10');
 await page.waitForFunction(()=>typeof state!=='undefined'&&state.campaignState?.player_character);
 await page.evaluate(()=>{
  state.campaignState.team_characters[0].party_banner_path='/assets/profile-banners/snake-scales-thumb.webp';
  state.campaignState.team_characters[1].party_banner_path='/assets/profile-banners/pitvin-lights-thumb.webp';
 });
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>setTab('party'));await page.waitForSelector('.party-main');
  const x=await page.locator('.party-main').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().x));
  await page.locator('.party-banner img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  assert.ok(await page.locator('.party-card-with-banner .party-avatar-slot .avatar').count()>=2);
  assert.ok(Math.max(...x)-Math.min(...x)<=1,'Party names must align');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.screenshot({path:'tmp/party-alignment-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setTab('settings'));
 await page.getByText('Баннеры',{exact:true}).click();await page.waitForSelector('.banner-shop-choice');
 assert.equal(await page.locator('.banner-shop-choice').count(),66);
 await page.evaluate(()=>showCosmeticPreviewModal('effect',effectById('ref-rainbow'),false,10));await page.waitForSelector('.cosmetic-preview-modal');
 const sizes=await page.locator('.cosmetic-preview-modal .fx-preview-shell').evaluate(el=>({shell:el.querySelector('.avatar-shell').getBoundingClientRect().width,avatar:el.querySelector('.avatar').getBoundingClientRect().width}));
 assert.ok(sizes.avatar>=70);assert.ok(Math.abs(sizes.avatar-sizes.shell)<=1,JSON.stringify(sizes));
 await page.screenshot({path:'tmp/effect-avatar-fixed-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Passed: party column alignment at 320/390px, banner shop in normal settings, full-size avatar inside effect preview. No writes.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
