const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let playwright;try{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{playwright=require('../tmp/browser-check/node_modules/playwright');}

(async()=>{
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8000/local/hub.html?user=464302752&view=public');
  await page.waitForFunction(()=>window.TreasuryView);
  await page.evaluate(async()=>{
   document.body.innerHTML='<main id="case-fixture" class="shell"></main>';
   const reward={case_type:'cyberpunk',kind:'game',name:'Улучшение импланта +2',rarity:'epic',icon:'🦾',choice_type:'implant'};
   const data={keys:3,balance:0,cyberpunk:{keys:1,boosts:0,until_guarantee:10},history:[],items:[],characters:[
    {id:1,name:'Маг',campaign:'Fantasy',rule_type:'fantasy'},
    {id:2,name:'Нетраннер',campaign:'Cyberpunk',rule_type:'cyberpunk'}
   ]};
   window.caseRequests=[];
   await TreasuryView.mount(document.querySelector('#case-fixture'),{user:'case-browser-fixture',request:async(url,opts)=>{
    if(url.endsWith('/open')){
     caseRequests.push(JSON.parse(opts.body));
     data.cyberpunk.keys--;
     data.items=[{id:4,status:'available',sale_price:100,reward}];
     return {reward,opening_id:1};
    }
    return structuredClone(data);
   }});
  });
  const root=page.locator('#case-fixture');
  await root.locator('.treasury-chest').waitFor();
  await root.getByRole('button',{name:'Киберпанк',exact:true}).click();
  await root.locator('.treasury-laptop').waitFor();
  await root.locator('[data-open]').click();
  await root.locator('.treasury-cyber.opening').waitFor();
  assert.equal(await root.locator('.chip-progress').evaluate(el=>getComputedStyle(el).animationName),'chipRead');
  assert.equal(await root.locator('.chip-code').first().evaluate(el=>getComputedStyle(el).animationName),'chipType');
  const screen=await root.locator('.chip-screen').boundingBox();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.chip-screen')).stroke==='rgb(194, 138, 255)');
  assert.equal(await root.locator('.chip-progress').evaluate(el=>getComputedStyle(el).stroke),'rgb(194, 138, 255)');
  await root.locator('.treasury-opening').screenshot({path:'tmp/treasury-cyberpunk-terminal.png'});
  await page.locator('.treasury-matrix-flash').waitFor();
  const flash=await page.locator('.treasury-matrix-flash').first().evaluate(el=>({
   x:parseFloat(el.style.getPropertyValue('--flash-x')),
   y:parseFloat(el.style.getPropertyValue('--flash-y')),
   color:el.style.getPropertyValue('--loot-color')
  }));
  assert.ok(Math.abs(flash.x-(screen.x+screen.width/2))<1);
  assert.ok(Math.abs(flash.y-(screen.y+screen.height/2))<1);
  assert.equal(flash.color,'#c28aff');
  await page.getByRole('heading',{name:'Улучшение импланта +2'}).waitFor();
  assert.equal((await page.evaluate(()=>caseRequests))[0].case_type,'cyberpunk');
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  assert.equal(await root.locator('[data-open]').isDisabled(),true);
  await root.getByRole('button',{name:'Инвентарь',exact:true}).click();
  await root.getByRole('button',{name:'Использовать',exact:true}).click();
  assert.deepEqual(await page.locator('dialog select option').allTextContents(),['Нетраннер · Cyberpunk']);
  await page.getByRole('button',{name:'Отмена',exact:true}).click();
  await root.getByRole('button',{name:'Фэнтези',exact:true}).click();
  assert.match(await root.locator('.treasury-head small').innerText(),/Ключей: 3/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('Passed: mobile terminal, code flash, reward dialog, eligible characters, separate wallets.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
