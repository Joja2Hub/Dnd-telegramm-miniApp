const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:8000/local-app/?local_tg_id=464302752&campaign_id=8');
 await page.waitForFunction(()=>typeof state!=='undefined'&&state.campaignState);
 const out=await page.evaluate(()=>{
  const item=effectById('wildfire');
  state.campaignState.unlocked_effect_ids=[];state.campaignState.effect_style_unlocks={};state.campaignState.treasury_discount_percent=20;
  state.campaignState.treasury_benefits={colors:0,gradients:0,frames:1};
  effectStyleDrafts.set(item.id,{mode:'solid',colors:['#ff0000','#ff0000']});
  const paid=effectPurchaseQuote(item),paidButton=shopActionButton('effect',item);
  state.campaignState.treasury_benefits.colors=1;
  const free=effectPurchaseQuote(item),freeButton=shopActionButton('effect',item);
  const frameButton=shopActionButton('frame',{id:'achievement_fixture',rarity:'unique',purchasable:0});
  return {paid,free,paidButton,freeButton,frameButton,expected:Math.ceil((Number(priceOf(item))+item.style_prices.custom)*.8),baseOnly:Math.ceil(Number(priceOf(item))*.8)};
 });
 assert.equal(out.paid.total,out.expected);assert.equal(out.free.total,out.baseOnly);
 assert.ok(out.paidButton.includes('эффект + палитру'));assert.ok(out.paidButton.includes(String(out.expected)));
 assert.ok(out.freeButton.includes('палитра бесплатно'));assert.ok(out.frameButton.includes('Забрать бесплатно'));
 console.log('Passed: total effect + palette price, discount, free palette credit and achievement-frame claim button. No live purchases.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
