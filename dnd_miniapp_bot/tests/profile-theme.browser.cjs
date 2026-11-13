const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let playwright;try{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{playwright=require('../tmp/browser-check/node_modules/playwright');}
const {chromium}=playwright;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('local_hub_user','464302752'));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:960});
  await page.goto('http://127.0.0.1:8000/local/hub.html?user=464302752');
  await page.waitForSelector('body.profile-theme-serpent');
  await page.locator('.profile-banner img').evaluate(img=>img.decode());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>0);i.onerror=()=>resolve(false);i.src='/assets/profile-backgrounds/serpent-sanctuary.webp';})),true);
  await page.screenshot({path:`tmp/serpent-profile-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Персонажи',exact:true}).click();
  assert.equal(await page.locator('body.profile-theme-serpent').count(),0);
 }
 await page.goto('http://127.0.0.1:8000/local/hub.html?user=464302752&view=public');
 await page.waitForSelector('body.profile-theme-serpent');
 assert.equal(await page.getByRole('button',{name:'Настроить профиль',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('Passed: private/public theme, 390/1440px, background decoded, no horizontal overflow, other tabs unthemed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
