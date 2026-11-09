const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_LAN_ORIGIN||'http://192.168.0.108:8000')+'/local/hub.html?user=290280695');
  await page.waitForFunction(()=>!!window.TreasuryView);
  assert.equal(await page.evaluate(()=>isSecureContext),false);
  assert.equal(await page.evaluate(()=>typeof crypto.randomUUID),'undefined');
  await page.evaluate(async()=>{
   const root=document.createElement('main');document.body.append(root);
   document.getElementById('hub').hidden=true;
   const reward={kind:'sparks',name:'15 искр',icon:'✨',rarity:'common',amount:15};
   const state={keys:3,boosts:0,until_guarantee:10,items:[],stacks:[],history:[],frame_credits:0,frames:[],balance:0};
   window.httpChestCalls=[];window.failNextOpening=false;
   await TreasuryView.mount(root,{user:'http-regression',request:async(url,options)=>{
    if(options){
     const body=JSON.parse(options.body);httpChestCalls.push(body.request_id);
     if(window.failNextOpening){window.failNextOpening=false;throw new Error('Connection interrupted');}
     state.keys--;state.balance+=15;return {reward,opening_id:httpChestCalls.length};
    }
    return structuredClone(state);
   }});
  });
  await page.locator('[data-open]').tap();await page.waitForSelector('.treasury-result');
  assert.ok((await page.locator('.treasury-result').innerText()).includes('15 искр'));
  await page.getByRole('button',{name:'Закрыть',exact:true}).tap();
  await page.evaluate(()=>window.failNextOpening=true);
  await page.locator('[data-open]').tap();
  await page.waitForFunction(()=>document.querySelector('.treasury-status')?.textContent.includes('Connection interrupted'));
  assert.equal(await page.locator('[data-open]').isEnabled(),true);
  await page.locator('[data-open]').tap();await page.waitForSelector('.treasury-result');
  const calls=await page.evaluate(()=>httpChestCalls);
  assert.equal(calls.length,3);assert.notEqual(calls[0],calls[1]);assert.equal(calls[1],calls[2]);
  assert.deepEqual(errors,[]);
  console.log('Passed: mobile non-secure LAN HTTP opening, UUID fallback, visible failure, retry with same request ID. All chest writes mocked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
