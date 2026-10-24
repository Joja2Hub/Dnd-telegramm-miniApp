(() => {
  'use strict';
  const styleCache=new WeakMap();
  const readStyle=host=>{
    const source=host.dataset.effectStyle||'{}',cached=styleCache.get(host);
    if(cached?.source===source)return cached.value;
    let value;try{value=options(JSON.parse(source));}catch{value={mode:'original'};}
    styleCache.set(host,{source,value});return value;
  };
  function options(style) {
    return {...style,mode:style.mode==='preset'?'gradient':style.mode||'original'};
  }
  function applyLayer(host,style) {
    const layer=['front','between','back'].includes(style.layer)?style.layer:'auto';
    if(host.dataset.effectLayer!==layer)host.dataset.effectLayer=layer;
    const target=layer==='between'?(host.querySelector(':scope > .avatar-shell')||host):host;
    for(const canvas of host.querySelectorAll('canvas.effect-engine-canvas')) {
      if(canvas.parentElement===target)continue;
      if(target===host&&canvas.classList.contains('effect-lab-back'))target.prepend(canvas);
      else target.append(canvas);
    }
  }
  class ShopEffectEngine {
    constructor(canvas,definition) {
      this.canvas=canvas;this.host=canvas.parentElement;this.definition=definition;
      this.back=document.createElement('canvas');this.back.className='effect-engine-canvas effect-lab-back';
      this.host.prepend(this.back);this.active=false;this.time=2.95;this.last=0;this.resize();
    }
    resize() {
      const size=parseFloat(this.canvas.style.width)||160;
      const anchor=Number(this.canvas.dataset.effectAnchorBase)||size/3.18;
      const diameter=this.definition.kind==='bard'?108:this.definition.kind==='smoke'?96:this.definition.referenceScale?90:84;
      this.baseSceneSize=anchor*240/diameter;
      if(this.renderer && this.size===size){this.renderer.sceneSize=anchor*240/diameter;this.back.style.cssText=this.canvas.style.cssText;this.draw();return;}
      this.size=size;this.renderer=new window.FXPreviewRenderer(this.definition,this.back,this.canvas,size);
      this.renderer.sceneSize=anchor*240/diameter;
      this.back.style.cssText=this.canvas.style.cssText;
      this.draw();
    }
    draw() {
      const style=readStyle(this.host);
      applyLayer(this.host,style);
      this.renderer.sceneSize=this.baseSceneSize*Math.max(.8,Math.min(1.2,Number(style.radius_scale)||1));
      this.renderer.colorOptions=style;
      this.renderer.smokeOptions=style.mode==='original'?{}:{palette:'custom',customColors:style.colors};
      this.renderer.draw(this.time);
    }
    setActive(active){this.active=active;this.last=0;if(!active)this.draw();}
    update(now){if(this.last)this.time+=Math.min(.05,(now-this.last)/1000);this.last=now;this.draw();}
    destroy(){this.back.remove();}
  }
  window.ShopEffectEngine=ShopEffectEngine;
  window.effectRadiusForHost=host=>Math.max(.8,Math.min(1.2,Number(readStyle(host).radius_scale)||1));
  window.tintLegacyShopEffect=(engine,host)=>{
    const style=readStyle(host);applyLayer(host,style);if(!style.mode||style.mode==='original')return;
    engine.tintRenderer ||= {back:engine.ctx,front:engine.ctx,backCanvas:engine.canvas,frontCanvas:engine.canvas};
    engine.tintRenderer.colorOptions=style;
    window.FXPreviewRenderer.prototype.tintFire.call(engine.tintRenderer);
  };
  function drawGiftSpirit(ctx,time) {
    const t=time,p=['#ffb23e','#ef6232','#fff0a6'];
    const flame=window.FXPreviewRenderer.prototype.flameTongue;
    ctx.save();ctx.clearRect(0,0,72,84);
    const glow=ctx.createRadialGradient(36,49,5,36,46,32);
    glow.addColorStop(0,`rgba(255,222,128,${.28+.04*Math.sin(t*.65)})`);glow.addColorStop(1,'#ffb73c00');ctx.fillStyle=glow;ctx.fillRect(0,0,72,84);
    const plumes=[[25,43,3.5,11,-3],[30,39,4,18,-3],[36,38,4.8,24,1],[42,40,4,18,3],[47,44,3,11,3]];
    plumes.forEach(([x,y,w,h,lean],i)=>flame.call({effect:{core:'#ffe7a0'}},ctx,x,y,w,h,lean,t*.9+i*1.7,p,.65));
    const body=ctx.createRadialGradient(31,45,2,36,53,18);
    body.addColorStop(0,'#fff5bc');body.addColorStop(.5,'#ffdd78');body.addColorStop(1,'#f4b64c');
    ctx.beginPath();ctx.arc(36,53,17,0,Math.PI*2);ctx.fillStyle=body;ctx.shadowColor='#ffd568';ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
    const blink=1-.93*Math.pow(.5+.5*Math.cos(t*.7+2.1),50);
    for(const [x,y,tilt] of [[30,52,.05],[43,52,-.05]]) {
      ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(1,blink);
      ctx.fillStyle='#ffffff';ctx.shadowColor='#fffce7';ctx.shadowBlur=4;
      ctx.beginPath();ctx.ellipse(0,0,4.1,5.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.restore();
  }
  function mountGiftSpirit(canvas) {
    const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=72*dpr;canvas.height=84*dpr;
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0,last=0,disposed=false;
    function tick(now) {
      raf=0;if(disposed||!canvas.isConnected||document.hidden||document.querySelector('.modal-backdrop'))return;
      if(now-last>50||!last){drawGiftSpirit(ctx,reduced.matches?2.95:now/1000);last=now;}
      if(!reduced.matches)raf=requestAnimationFrame(tick);
    }
    function wake(){if(!disposed&&!raf){last=0;raf=requestAnimationFrame(tick);}}
    const observer=new MutationObserver(wake);observer.observe(document.body,{childList:true});
    document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',wake);wake();
    return ()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',wake);reduced.removeEventListener('change',wake);};
  }
  window.ShopGiftSpirit={draw:drawGiftSpirit,mount:mountGiftSpirit};
})();
