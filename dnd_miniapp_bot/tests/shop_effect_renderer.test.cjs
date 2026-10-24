const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const modules=process.env.CODEX_NODE_MODULES||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {createCanvas}=require(path.join(modules,'@napi-rs/canvas'));
const canvas=()=>{const c=createCanvas(240,240);c.style={};return c;};
const window={devicePixelRatio:1};
const sandbox={window,document:{createElement:canvas},console};
for(const file of ['cosmetics-preview/arcane-effects.js','cosmetics-preview/smoke-effects.js','effect-renderer.js','shop-effect-engine.js'])vm.runInNewContext(fs.readFileSync('frontend/'+file,'utf8'),sandbox);
const catalog=JSON.parse(fs.readFileSync('frontend/effect-catalog.json','utf8'));
for(const effect of catalog) {
  const draw=(options)=>{const b=canvas(),f=canvas(),r=new window.FXPreviewRenderer(effect,b,f,240);r.colorOptions=options;r.smokeOptions={};r.back.getImageData=()=>{throw Error('CPU canvas readback');};r.front.getImageData=r.back.getImageData;r.draw(2.95);const out=canvas(),ctx=out.getContext('2d');ctx.drawImage(b,0,0);ctx.drawImage(f,0,0);return Uint8ClampedArray.from(ctx.getImageData(0,0,240,240).data);};
  const original=draw({mode:'original'});
  const solid=draw({mode:'solid',colors:['#ff3344','#ff3344','#ff3344'],angle:45});
  const gradient=draw({mode:'gradient',colors:['#55ffbb','#8955ff','#ffbb55'],angle:45});
  for(const data of [original,solid,gradient])assert.ok(data.some((v,i)=>i%4===3&&v>0),effect.id+' blank');
  for(const data of [solid,gradient]) {
    assert.equal(data[3],0,effect.id+' has an opaque background');
    if(effect.kind!=='arcane')for(let i=3;i<data.length;i+=4)assert.ok(Math.abs(data[i]-original[i])<=2,effect.id+' recolor changed opacity');
  }
  assert.notDeepEqual(original,solid,effect.id+' ignores color');
  assert.notDeepEqual(solid,gradient,effect.id+' ignores gradient');
}
console.log('All '+catalog.length+' shared shop renderers: visible, color and gradient verified.');
let saved='';
const storage={getItem:()=>saved,setItem:(_,value)=>{saved=value;}};
const prefs=window.FXArcane.createPreferences(storage);
prefs.set('ref-summoning',{mode:'gradient',colors:['#ff3355','#7788ff','#44ffbb'],angle:120,starColor:'#ff3355'});
assert.equal(window.FXArcane.createPreferences(storage).get('ref-summoning').starColor,'#ff3355');
assert.equal(prefs.get('ref-mirage').mode,'original');
assert.doesNotThrow(()=>window.FXArcane.createPreferences({getItem(){throw Error('Denied');}}));
function circle(time,starColor) {
  const b=canvas(),f=canvas(),r=new window.FXPreviewRenderer(catalog.find(e=>e.mode==='summoning'),b,f,240);
  r.colorOptions={mode:'original',starColor};r.draw(time);
  return f.getContext('2d').getImageData(0,0,240,240).data;
}
const energy=data=>data.reduce((sum,v,i)=>sum+(i%4===3?v:0),0);
assert.ok(energy(circle(2.95))>energy(circle(3.8)),'Star completion flash lost');
assert.notDeepEqual(circle(2.95,'#ff3355'),circle(2.95),'Separate star color lost');
console.log('Palette persistence, isolation and pentagram completion flash verified.');
function spirit(time){const c=createCanvas(72,84),ctx=c.getContext('2d');window.ShopGiftSpirit.draw(ctx,time);return Uint8ClampedArray.from(ctx.getImageData(0,0,72,84).data);}
const first=spirit(0),next=spirit(2.5);
assert.ok(first.some((v,i)=>i%4===3&&v>200),'Gift spirit is blank');assert.equal(first[3],0);
assert.notDeepEqual(first,next,'Spirit flames are static');
for(const x of [30,43]) {
  const i=(52*72+x)*4;
  assert.ok(first[i]>245&&first[i+1]>245&&first[i+2]>245,'Spirit eyes must be pure white');
}
