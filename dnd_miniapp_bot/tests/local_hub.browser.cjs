const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/local/');await page.waitForSelector('#localLoginMenu');
 const users=await (await page.request.get('http://127.0.0.1:8000/local-api/users')).json();
 const user=users.users.find(u=>u.character_names.length&&!u.roles.includes('master'))||users.users.find(u=>u.character_names.length);
 assert.ok(user);await page.getByText('Войти',{exact:true}).click();await page.getByRole('button',{name:'Войти: '+user.display_name,exact:true}).click();
 await page.waitForSelector('.hub-nav');
 await page.getByRole('button',{name:'Настроить профиль'}).click();await page.waitForSelector('#profileEditor');
 await page.getByRole('button',{name:'Отмена',exact:true}).click();
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Достижения',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.getByRole('button',{name:'Персонажи',exact:true}).click();assert.ok(await page.locator('.hub-character').count());
 }
 await page.locator('.hub-character').first().click();await page.waitForSelector('.campaign-context-bar');
 await page.evaluate(()=>setTab('settings'));await page.locator('.settings-exit-action').click();await page.waitForSelector('.hub-nav');
 await page.getByRole('button',{name:'Магазин',exact:true}).click();await page.locator('.hub-character').first().click();await page.waitForSelector('.shop-standalone-card');
 assert.equal(await page.locator('.bottom-nav').count(),0);await page.getByRole('button',{name:'В хаб',exact:true}).click();await page.waitForSelector('.hub-nav');
 assert.deepEqual(errors,[]);console.log('Passed: local user selection, cross-campaign hub, desktop/mobile, character/settings return, shared shop and hub return.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
