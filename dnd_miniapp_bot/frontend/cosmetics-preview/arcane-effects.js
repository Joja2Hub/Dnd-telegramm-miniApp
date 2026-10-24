(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const entries = [
    ['plasma-pulse', 'Плазменный импульс', 'electro', 'plasma', ['#58f6da','#227eab','#d8fff4'], 'Плазма перетекает по краю; внутри пробегают короткие белые искры.'],
    ['ref-summoning', 'Круг призыва', 'reference', 'summoning', ['#8fffe0','#439b9d','#eafff3'], 'Световая звезда постепенно рисуется, сияет и растворяется внутри вращающейся печати.'],
    ['ref-rainbow', 'Радужная дымка', 'reference', 'rainbow', ['#df97f4','#f3d48d','#92dfd6'], 'Короткие перламутровые лучи расходятся от края и растворяются.'],
    ['ref-gold-ripple', 'Мягкая рябь', 'reference', 'ripple', ['#e4c58c','#8f7856','#fff4d7'], 'Тонкий золотой контур мягко деформируется, сохраняя спокойное свечение.'],
    ['ref-dusk', 'Сумерки', 'reference', 'cosmic', ['#d0dce0','#6e8494','#f1f3dd'], 'Серебристые облачка и маленькие искры вспыхивают у края портрета.'],
    ['ref-wisps', 'Блуждающие огни', 'reference', 'wisps', ['#73f2ce','#339eae','#d5fff1'], 'Мягкие огни уходят за верх портрета и выплывают вперёд по нижней дуге.'],
    ['ref-ice-field', 'Электрическое поле', 'reference', 'field', ['#b9d4ff','#6d89c8','#eef7ff'], 'Мелкие электрические разветвления мерцают вплотную к холодному контуру.'],
    ['ref-mirage', 'Мираж', 'reference', 'mirage', ['#b9a5ec','#706296','#e6ddff'], 'Полупрозрачная лента плавно меняет форму, оставляя тонкие световые складки.'],
    ['ref-black-hole', 'Чёрная дыра', 'reference', 'accretion', ['#e2d8c8','#8b8581','#fff4df'], 'Широкие световые ленты образуют наклонённый диск с движущимися искрами.'],
    ['ref-digital-sunrise', 'Цифровой восход', 'reference', 'sunrise', ['#f77bee','#6d4ec7','#52e0ff'], 'Полосатое неоновое солнце поднимается над перспективной сеткой.'],
    ['ref-blue-portal', 'Волшебный портал', 'reference', 'portal', ['#38aaff','#3543cf','#b7ffff'], 'Плотный голубой поток искр обегает неровную кромку портала.'],
    ['ref-future-interface', 'Футуристический интерфейс', 'reference', 'interface', ['#f654cf','#8d378f','#ffc0ee'], 'Розовые панели, индикаторы и сканирующие сегменты включаются вокруг портрета.'],
  ];
  entries.push(
    ['orbital-radar','Орбитальный радар','scifi','radar',['#72efba','#297f87','#e4ffe7'],'Сканирующий сектор скользит по внешней шкале, оставляя затухающие сигналы.'],
    ['data-stream','Нейронный канал','scifi','dataflow',['#ee86da','#6659c5','#bffff7'],'Световые пакеты проходят по боковым каналам и собираются в нижнем узле.'],
    ['pulse-reactor','Импульсный реактор','scifi','reactor',['#ffb36a','#b95067','#fff1c4'],'Три энергетических затвора раскрываются и выпускают мягкий световой импульс.'],
    ['tactical-visor','Тактический визор','scifi','visor',['#66e7dd','#327e9a','#e2fff6'],'Подвижные захваты наводятся на портрет; боковые шкалы отвечают на проходящий импульс.'],
    ['holo-terminal','Голографический терминал','scifi','terminal',['#f8bb68','#a15463','#fff2c7'],'Стеклянные панели раскрываются у краёв, строки данных перелистываются без перекрытия лица.'],
    ['woven-spell','Сотканное заклинание','fantasy','weave',['#e8b5ff','#9166ca','#fff0d6'],'Световые нити плетут изменчивый узор вокруг всего портрета, распускаясь на мягкие искры.'],
    ['lunar-eclipse','Лунное затмение','fantasy','eclipse',['#e1d4af','#8978aa','#fff7e1'],'Свет перемещается по лунной кромке, открывая серебряную корону и редкие звёздные вспышки.'],
  );
  const layouts = {
    radar:'сканирующий сектор',
    dataflow:'световые пакеты',
    reactor:'энергетические затворы',
    visor:'адаптивные захваты',
    terminal:'живые стеклянные панели',
    weave:'световое плетение',
    eclipse:'движущийся лунный свет',
    plasma:'текучая плазма',
    summoning:'вращающаяся печать',
    rainbow:'перламутровые лучи',
    ripple:'мягкая световая рябь',
    wisps:'независимые огни',
    field:'мелкие разветвления',
    mirage:'плавающая лента',
    accretion:'аккреционный диск',
    cosmic:'звёздные скопления',
    sunrise:'солнце и перспективная сетка',
    portal:'вихрь световых искр',
    interface:'цифровые панели',
  };
  const categoryByMode = {
    plasma:'energy',
    field:'energy',
    summoning:'magic',
    wisps:'magic',
    mirage:'magic',
    weave:'magic',
    rainbow:'light',
    ripple:'light',
    cosmic:'cosmos',
    accretion:'cosmos',
    eclipse:'cosmos',
    sunrise:'scifi',
    portal:'magic',
    interface:'scifi',
  };
  const effects = entries.map(([id,name,category,mode,palette,short], i) => ({
    id,name,category:categoryByMode[mode] || category,referenceScale:category==='reference',mode,palette,short,kind:'arcane',
    code:`AR${String(i+1).padStart(2,'0')}`,layout:layouts[mode],
    description:short,loop:'непрерывная композиция',tags:[name],
  }));
  const presets = [
    {id:'ice',name:'Лёд',colors:['#b9d4ff','#6d89c8','#eef7ff']},
    {id:'thistle',name:'Чертополох',colors:['#c6b0ff','#8570bc','#eee2ff']},
    {id:'plum',name:'Слива',colors:['#b9a5ec','#706296','#e6ddff']},
    {id:'pink',name:'Розовый',colors:['#e19acb','#a45b98','#ffe0f4']},
    {id:'abyss',name:'Бездна',colors:['#9960ff','#54209c','#dcc0ff']},
    {id:'blue',name:'Синий',colors:['#667cff','#4b3196','#79d9ff']},
    {id:'silver',name:'Серебро',colors:['#d0dce0','#6e8494','#f1f3dd']},
    {id:'jade',name:'Нефрит',colors:['#73f2ce','#339eae','#d5fff1']},
    {id:'gold',name:'Золото',colors:['#e4c58c','#8f7856','#fff4d7']},
    {id:'purple',name:'Пурпур',colors:['#ee7bbc','#84336f','#ffd1e9']},
  ];
  const validColor=c=>typeof c==='string' && /^#[0-9a-f]{6}$/i.test(c);
  function normalizeColors(value,effect) {
    const colors=Array.isArray(value?.colors) && value.colors.length===3 && value.colors.every(validColor) ? [...value.colors] : [...effect.palette];
    return {mode:['original','solid','gradient'].includes(value?.mode)?value.mode:'original',colors,
      angle:Number.isFinite(value?.angle)?Math.max(0,Math.min(360,value.angle)):45,
      starColor:validColor(value?.starColor)?value.starColor:null};
  }
  function createPreferences(storage, catalog=effects) {
    const key='fx-lab-effect-colors-v1';
    try { if(storage===undefined)storage=window.localStorage; } catch { storage=null; }
    let saved={};try { saved=JSON.parse(storage?.getItem(key)||'{}')||{}; } catch { /* Keep defaults if storage is unavailable. */ }
    const values=Object.fromEntries(catalog.map(e=>[e.id,normalizeColors(saved[e.id],e)]));
    return {
      get(id){const value=values[id];return value?{...value,colors:[...value.colors]}:null;},
      set(id,patch){const e=catalog.find(item=>item.id===id);if(!e)return;
        values[id]=normalizeColors({...values[id],...patch},e);
        try { storage?.setItem(key,JSON.stringify(values)); } catch { /* Changes still apply for this visit. */ }
      },
    };
  }
  function paletteFor(effect,settings) {
    if(!settings || settings.mode==='original')return effect.palette;
    return settings.mode==='solid'?[settings.colors[0],settings.colors[0],settings.colors[0]]:settings.colors;
  }
  const themes=new WeakMap();
  function gradientFor(ctx,alpha) {
    const settings=themes.get(ctx);if(settings?.mode!=='gradient')return null;
    const a=settings.angle*Math.PI/180,x=Math.cos(a)*48,y=Math.sin(a)*48;
    const gradient=ctx.createLinearGradient(-x,-y,x,y);
    settings.colors.forEach((color,i)=>gradient.addColorStop(i/2,rgb(color,alpha)));
    return gradient;
  }
  function colorAt(ctx,x,y,fallback) {
    const settings=themes.get(ctx);if(settings?.mode!=='gradient')return fallback;
    const a=settings.angle*Math.PI/180;
    const u=Math.max(0,Math.min(1,(x*Math.cos(a)+y*Math.sin(a)+48)/96))*2;
    const i=Math.min(1,Math.floor(u)),f=u-i;
    const channels=color=>[1,3,5].map(n=>parseInt(color.slice(n,n+2),16));
    const c=channels(settings.colors[i]),d=channels(settings.colors[i+1]);
    return '#'+c.map((v,k)=>Math.round(v+(d[k]-v)*f).toString(16).padStart(2,'0')).join('');
  }
  const rgb = (hex,a) => {
    const n=parseInt(hex.slice(1),16);
    return `rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a))})`;
  };
  const point = (a,r=40) => [Math.cos(a)*r,Math.sin(a)*r];
  const rand = (i,s=0) => { const n=Math.sin(i*127.1+s*311.7)*43758.5453; return n-Math.floor(n); };
  function path(ctx, pts, color, width, alpha=1, glow=0) {
    ctx.save();ctx.strokeStyle=gradientFor(ctx,alpha)||rgb(color,alpha);ctx.lineWidth=width;
    ctx.shadowColor=color;ctx.shadowBlur=glow;ctx.beginPath();
    pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();
  }
  function light(ctx,x,y,r,color,a=1) {
    color=colorAt(ctx,x,y,color);
    ctx.save();const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,rgb(color,a));g.addColorStop(.18,rgb(color,a*.65));
    g.addColorStop(.5,rgb(color,a*.16));g.addColorStop(1,rgb(color,0));
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  function partialPath(points,progress) {
    const lengths=points.slice(1).map((q,i)=>Math.hypot(q[0]-points[i][0],q[1]-points[i][1]));
    let remaining=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,progress));
    const result=[points[0]];
    for(let i=0;i<lengths.length;i++) {
      const q=points[i],next=points[i+1],fraction=Math.min(1,remaining/lengths[i]);
      result.push([q[0]+(next[0]-q[0])*fraction,q[1]+(next[1]-q[1])*fraction]);
      remaining-=lengths[i];if(remaining<=0)break;
    }
    return result;
  }
  function star(ctx,x,y,s,color,a=1) {
    color=colorAt(ctx,x,y,color);
    ctx.save();ctx.translate(x,y);ctx.fillStyle=rgb(color,a);ctx.beginPath();
    ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*.16,-s*.16,s,0);
    ctx.quadraticCurveTo(s*.16,s*.16,0,s);ctx.quadraticCurveTo(-s*.16,s*.16,-s,0);
    ctx.quadraticCurveTo(-s*.16,-s*.16,0,-s);ctx.fill();ctx.restore();
  }
  function arc(ctx,t,p,r=40,amp=.5,alpha=.8,start=0,end=TAU,thickness=1) {
    const pts=Array.from({length:161},(_,i)=>{
      const a=start+(end-start)*i/160;
      return point(a,r+Math.sin(a*5-t*.8)*amp+Math.sin(a*9+t*.4)*amp*.3);
    });
    path(ctx,pts,p[0],4.8*thickness,alpha*.12,8);
    path(ctx,pts,p[0],2.4*thickness,alpha*.38,4);
    path(ctx,pts,p[2],.65*thickness,alpha,2);
  }
  function bolt(ctx,t,p,start,length,seed,alpha=1,thickness=1) {
    const step=Math.floor(t*9);
    const pts=Array.from({length:23},(_,i)=>{
      const a=start+length*i/22;
      return point(a,40+(rand(i+step*23,seed)-.5)*3.3);
    });
    path(ctx,pts,p[0],3.6*thickness,alpha*.2,7);
    path(ctx,pts,p[0],1.7*thickness,alpha*.45,3);
    path(ctx,pts,p[2],.65*thickness,alpha,2);
    [6,15].forEach(k=>{
      const a=start+length*k/22;const q=point(a,43.5+rand(k,step)*2);
      path(ctx,[pts[k],q,point(a+.07,45)],p[0],.4,alpha*.6,2);
    });
  }
  function electricity(ctx,t,p,mode) {
    const field=mode==='field';
    if(mode==='plasma') {
      for(let j=0;j<3;j++)arc(ctx,t+j,p,40+j*.7,1.3,.26);
    } else arc(ctx,t,p,39.6,.2,field?.48:.12,0,TAU,field?2.1:1);
    const count=field?10:mode==='tension'?2:4;
    for(let i=0;i<count;i++) {
      const pulse=Math.pow(Math.max(0,Math.sin(t*(1.6+i*.071)+i*2.31)),5);
      const a=i*TAU/count+t*(mode==='tension'?.19:.055)+rand(i)*.5;
      bolt(ctx,t+i,p,a,field?.27:mode==='tension'?1.5:.65,i+7,.12+pulse*.82,field?2:1.3);
      if(pulse>.65){const q=point(a+.3,40);light(ctx,...q,3.5,p[2],pulse*.7);}
    }
  }

  function dust(ctx,t,p,cosmic=false) {
    for(let j=0;j<95;j++) {
      const a=rand(j,1)*TAU+t*(rand(j,2)-.5)*.045;
      const r=37+rand(j,3)*9;const q=point(a,r);
      const pulse=Math.pow(.5+.5*Math.sin(t*(.4+rand(j,4))+j*2.1),3);
      light(ctx,...q,1+rand(j,5)*2,p[j%3],pulse*.55);
    }
    for(let j=0;j<9;j++) {
      const a=j*2.4+Math.sin(t*.15+j)*.12;const q=point(a,40);
      light(ctx,...q,7,p[j%2],(.5+.5*Math.sin(t*.35+j*1.9))*.17);
    }
    if(cosmic)for(let j=0;j<4;j++){const q=point(j*1.7+1,41);star(ctx,...q,1.5,p[2],Math.pow(.5+.5*Math.sin(t*.7+j*2),6));}
  }
  function ribbon(ctx,t,p,mode) {
    const inferno=mode==='hellfire';
    for(let j=0;j<(inferno?2:3);j++) {
      const pts=[],inner=[];const start=t*(inferno?.32:.13)+j*TAU/(inferno?2:3);
      const length=inferno?2.35:TAU;
      for(let k=0;k<=100;k++) {
        const u=k/100,a=start+u*length;
        const r=40+Math.sin(a*3-t*.42+j)* (mode==='mirage'?3.2:1.5);
        const width=inferno?Math.pow(Math.sin(u*Math.PI),.7)*(6+Math.sin(u*12-t)*1.6):.35+Math.pow(.5+.5*Math.sin(a*3+t*.7+j),3)*1.8;
        pts.push(point(a,r+width));inner.push(point(a,r-width*.3));
      }
      ctx.save();const g=ctx.createLinearGradient(-40,-30,40,30);
      g.addColorStop(0,rgb(p[j%2],inferno?.95:.32));g.addColorStop(.5,rgb(p[2],inferno?.95:.7));g.addColorStop(1,rgb(p[0],.65));
      ctx.fillStyle=gradientFor(ctx,1)||g;ctx.shadowColor=p[0];ctx.shadowBlur=inferno?3:4;ctx.beginPath();
      pts.concat(inner.reverse()).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.restore();
      if(inferno) {
        const core=Array.from({length:70},(_,k)=>{
          const u=k/69,a=start+u*length;
          return point(a,41+Math.sin(a*3-t*.42+j)*1.5+Math.sin(u*9-t)*.8);
        });
        path(ctx,core.slice(12,58),p[2],1.2,.85,2);
        for(let k=0;k<3;k++) {
          const a=start+length*(.3+k*.24),rr=47+Math.sin(t*1.3+k)*2;
          const q=point(a,rr);path(ctx,[q,point(a+.07,rr+1.5),point(a+.13,rr+.4)],p[0],.7,.6);
        }
      }
    }
  }
  
  function summoning(ctx,t,p,starColor) {
    arc(ctx,t,p,42,.1,.7,0,TAU,1.4);arc(ctx,t,p,44,.1,.4);
    ctx.save();ctx.rotate(t*.08);
    for(let j=0;j<12;j++) {
      const a=j*TAU/12;const q=point(a,43);
      ctx.save();ctx.translate(...q);ctx.rotate(a+Math.PI/4);
      path(ctx,[[-1.4,-1.4],[1.4,-1.4],[1.4,1.4],[-1.4,1.4],[-1.4,-1.4]],p[0],.45,.8,2);ctx.restore();
    }
    for(let j=0;j<4;j++){const q=point(j*TAU/4,42);star(ctx,...q,3.5,p[2],.55+.3*Math.sin(t+j));}ctx.restore();
    const a=-Math.PI/2;
    const vertices=Array.from({length:6},(_,j)=>point(a+j*TAU*2/5,40));
    const phase=t%9;
    if(phase<5.8) {
      const progress=Math.min(1,phase/2.8),fade=phase<4.3?1:Math.max(0,1-(phase-4.3)/1.5);
      const traced=partialPath(vertices,progress);
      const theme=themes.get(ctx);
      if(starColor)themes.delete(ctx);
      const color=starColor||p[0],core=starColor||p[2];
      const flare=Math.exp(-Math.pow((phase-2.95)/.28,2));
      path(ctx,traced,color,3.4+flare*3,(.15+flare*.45)*fade,7+flare*9);
      path(ctx,traced,core,.8+flare*1.4,(.7+flare*.3)*fade,3+flare*5);
      if(progress<1)light(ctx,...traced[traced.length-1],3.2,core,.85);
      if(progress===1)vertices.slice(0,5).forEach(q=>light(ctx,...q,4.5,core,flare*.65));
      if(theme)themes.set(ctx,theme);
    }
  }

  function wisps(renderer,t,p) {
    const position=(j,clock)=>{
      const a=j*TAU/5+clock*.23+Math.sin(clock*.31)*.08;
      return {x:Math.cos(a)*(38+Math.sin(clock*.43)*1.2),
        y:Math.sin(a)*31+Math.sin(clock*.37)*1.2,
        depth:Math.sin(a)};
    };
    for(let j=0;j<5;j++) {
      const q=position(j,t),ctx=q.depth<0?renderer.back:renderer.front;
      const depth=(q.depth+1)/2,size=6.3+depth*4.5;
      const brightness=.53+.12*Math.sin(t*.8);
      for(let k=10;k>0;k--) {
        const z=position(j,t-k*.055),layer=z.depth<0?renderer.back:renderer.front;
        light(layer,z.x,z.y,size*(1-k/18),p[0],brightness*(1-k/11)*.055);
      }
      light(ctx,q.x,q.y,size*1.5,p[0],brightness*.2);
      light(ctx,q.x,q.y,size,p[0],brightness);
      const radius=size*.44,color=colorAt(ctx,q.x,q.y,p[0]);
      const sphere=ctx.createRadialGradient(q.x-radius*.3,q.y-radius*.35,radius*.05,q.x,q.y,radius);
      sphere.addColorStop(0,rgb(p[2],.98));sphere.addColorStop(.35,rgb(color,.94));
      sphere.addColorStop(.8,rgb(color,.83));sphere.addColorStop(1,rgb(color,.38));
      ctx.save();ctx.fillStyle=sphere;ctx.beginPath();ctx.arc(q.x,q.y,radius,0,TAU);ctx.fill();ctx.restore();
      light(ctx,q.x-radius*.25,q.y-radius*.3,radius*.42,p[2],.86);
    }
  }
  function accretion(ctx,t,p) {
    ctx.save();ctx.rotate(-.28);
    for(let j=0;j<12;j++) {
      const pts=Array.from({length:151},(_,k)=>{
        const a=k/150*TAU;const rr=38.5+j*.7+Math.sin(a*4-t*.22+j)*.45;
        return [Math.cos(a)*rr,Math.sin(a)*rr*.89];
      });
      path(ctx,pts,p[j%3],1.45+rand(j,5)*.65,.12+rand(j)*.2,1.4);
    }
    for(let j=0;j<65;j++) {
      const a=rand(j)*TAU+t*(.08+rand(j,2)*.08);const rr=39+rand(j,3)*7.5;
      const q=[Math.cos(a)*rr,Math.sin(a)*rr*.89];light(ctx,...q,.65,p[2],.25+rand(j,4)*.4);
    }ctx.restore();
  }
  function rainbow(ctx,t,p) {
    const colors=[p[0],p[1],p[2],p[1]];
    for(let j=0;j<24;j++) {
      const a=j*TAU/24;const pulse=Math.pow(.5+.5*Math.sin(t*.65+j*.73),3);
      const q=point(a,38),end=point(a,42+pulse*7);
      const color=colorAt(ctx,q[0],q[1],colors[j%4]);
      ctx.save();const g=ctx.createLinearGradient(...q,...end);g.addColorStop(0,rgb(color,0));g.addColorStop(.4,rgb(color,pulse*.5));g.addColorStop(1,rgb(color,0));
      ctx.strokeStyle=g;ctx.lineWidth=2;ctx.shadowColor=color;ctx.shadowBlur=3;ctx.beginPath();ctx.moveTo(...q);ctx.lineTo(...end);ctx.stroke();ctx.restore();
    }
  }

  function sunrise(renderer,t,p) {
    const ctx=renderer.back;
    ctx.save();ctx.beginPath();ctx.arc(0,0,46,Math.PI,TAU);ctx.closePath();ctx.clip();
    const drift=Math.sin(t*.45)*7;
    const g=ctx.createLinearGradient(0,-46+drift,0,1+drift);g.addColorStop(0,p[1]);g.addColorStop(.45,p[0]);g.addColorStop(1,p[2]);ctx.fillStyle=gradientFor(ctx,1)||g;
    const rise=(t*2.4)%6.5;
    ctx.shadowColor=p[0];ctx.shadowBlur=2+.7*Math.sin(t*.9);
    for(let j=0;j<10;j++) {
      const y=5-j*6.5-rise;
      ctx.globalAlpha=.8+.15*Math.sin(t*.8+j*.45);
      ctx.fillRect(-48,y,96,3.4+Math.sin(t*.6+j)*.35);
    }
    ctx.restore();
    for(let j=0;j<5;j++) {
      const progress=(j/5+t*.11)%1,rr=37+progress*9;
      const pts=Array.from({length:65},(_,k)=>point(k/64*Math.PI,rr));
      const alpha=Math.sin(progress*Math.PI)*.55;
      path(renderer.front,pts,j<2?p[0]:p[2],.55,alpha,1);
    }
    for(let j=0;j<11;j++) {
      const a=j/10*Math.PI;path(renderer.front,[point(a,37),point(a,46)],j%2?p[0]:p[2],.45,.45);
    }
    for(let j=0;j<3;j++) {
      const a=Math.PI*((t*.13+j/3)%1),q=point(a,40+j*2);
      star(renderer.front,...q,1.7,p[2],Math.sin(a)*.8);
    }
  }
  function portal(ctx,t,p) {
    arc(ctx,t,p,40,1,.7,0,TAU,2);
    for(let j=0;j<160;j++) {
      const a=rand(j,1)*TAU+t*(.2+rand(j,2)*.13);
      const r=39+(rand(j,3)-.5)*5+Math.sin(t*1.2+j)*.7;
      const q=point(a,r),alpha=.2+.65*Math.pow(.5+.5*Math.sin(t*(1+rand(j,5))+j),2);
      light(ctx,...q,.65+rand(j,4)*.9,j%4?p[0]:p[2],alpha);
      if(j%9===0)path(ctx,[point(a-.035,r),q],p[2],.45,alpha*.7,1);
    }
  }
  function futuristic(ctx,t,p) {
    const outlines=[
      [[-43,-12],[-43,-38],[-39,-42],[-27,-42]],
      [[-18,-43],[-6,-43],[0,-39],[18,-39],[25,-45],[40,-45]],
      [[43,-21],[43,-9],[35,-2]],
      [[-43,12],[-43,28],[-38,31],[-29,31]],
      [[12,29],[38,29],[30,38],[7,38]],
      [[-35,43],[28,43]],
    ];
    outlines.forEach((pts,j)=>{
      const flicker=.78+.15*Math.sin(t*(2+j*.11)+j*2)+.07*Math.sin(t*4.2+j);
      const pulse=Math.pow(.5+.5*Math.sin(t*1.2-j*.9),6);
      path(ctx,pts,p[0],.85,flicker*(.4+pulse*.55),2+pulse*3);
      const progress=(t*.24+j*.17)%1;
      const envelope=Math.pow(Math.sin(progress*Math.PI),2);
      const trail=Array.from({length:13},(_,k)=>{
        const portion=Math.max(0,progress-.16+k/12*.16);
        const segment=partialPath(pts,portion);
        return segment[segment.length-1];
      });
      for(let k=1;k<trail.length;k++)path(ctx,[trail[k-1],trail[k]],p[2],1.1,envelope*k/12*.8,3);
      light(ctx,...trail[trail.length-1],2.3,p[2],envelope*.55);
    });
    for(let j=0;j<4;j++) {
      ctx.save();ctx.strokeStyle=rgb(p[0],.35);ctx.lineWidth=.4;
      ctx.beginPath();ctx.arc(36,-29+j*7,1.9,0,TAU);ctx.stroke();ctx.restore();
      const indicator=Math.pow(.5+.5*Math.cos(t*2-j*Math.PI/2),7);
      light(ctx,36,-29+j*7,2.8,p[0],indicator*.9);
      path(ctx,[[-39,-36+j*5],[-39,-33+j*5]],p[0],1.8,.2+.75*indicator,indicator*3);
      path(ctx,[[-34+j*7,46],[-32+j*7,46]],p[0],1.6,.2+.7*Math.pow(.5+.5*Math.sin(t*2-j),3),2);
    }
    const scanPhase=.5-.5*Math.cos(t*1.1),scan=27+scanPhase*12;
    path(ctx,[[-22,scan],[24,scan]],p[2],.8,.2+Math.sin(scanPhase*Math.PI)*.45,3);
    const glitch=Math.pow(.5+.5*Math.sin(t*1.3),8);
    for(let j=0;j<3;j++)path(ctx,[[14+j*3,29+j*3],[32-j*2,29+j*3]],p[2],1,glitch*.8,2);
    const pulse=Math.pow(.5+.5*Math.sin(t*.8),5);star(ctx,25,-42,2,p[2],pulse);
  }

  function craftedComposition(renderer,t,p,mode) {
    const {front:f,back:b}=renderer;
    const line=(ctx,pts,w=1,a=.7,c=p[0])=>path(ctx,pts,c,w,a,2);
    if(mode==='radar') {
      const sweep=t*.55;
      for(let j=0;j<72;j++) {
        const a=j/72*TAU,d=(sweep-a+TAU*100)%TAU;
        const alpha=.12+.7*Math.exp(-d*3.2);
        line(f,[point(a,41),point(a,j%6===0?45:43)],j%6===0?.9:.55,alpha,j%6?p[0]:p[2]);
      }
      for(let j=0;j<24;j++) {
        const a=sweep-j*.018,alpha=(1-j/24)*.3;
        line(b,[point(a,39),point(a,46)],1.5,alpha);
      }
      for(let j=0;j<6;j++) {
        const a=rand(j,4)*TAU,d=(sweep-a+TAU*100)%TAU,alpha=Math.exp(-d*1.5);
        const q=point(a,44);light(f,...q,2.7,p[2],alpha*.8);
        const r=1+(1-alpha)*3;
        const pts=Array.from({length:25},(_,i)=>{const v=i/24*TAU;return [q[0]+Math.cos(v)*r,q[1]+Math.sin(v)*r];});line(f,pts,.5,alpha*.5);
      }
    } else if(mode==='dataflow') {
      for(let side of [-1,1])for(let lane=0;lane<3;lane++) {
        const pts=[ [side*(12+lane*5),-43], [side*(31+lane*4),-43], [side*(43+lane*2),-23], [side*(43+lane*2),22], [side*(26+lane*3),41], [side*8,41] ];
        line(b,pts,.55,.16);
        const u=(t*(.15+lane*.018)+lane*.29+(side===1?.17:0))%1;
        const trace=Array.from({length:16},(_,k)=>{const v=Math.max(0,u-.13+k/15*.13),segment=partialPath(pts,v);return segment[segment.length-1];});
        const alpha=Math.sin(u*Math.PI);
        for(let k=1;k<trace.length;k++)line(f,[trace[k-1],trace[k]],1.5,alpha*k/15*.8,lane===1?p[2]:p[0]);
        light(f,...trace[15],2.2,p[2],alpha*.7);
      }
      const pulse=.5+.5*Math.sin(t*2);line(f,[[-6,42],[0,45],[6,42],[0,39],[-6,42]],1,.5+pulse*.3);light(f,0,42,4,p[0],pulse*.35);
    } else if(mode==='reactor') {
      const breath=Math.pow(.5+.5*Math.sin(t*.9),3);
      for(let j=0;j<3;j++) {
        const a=j*TAU/3-Math.PI/2,span=.63,r=41+breath*1.8;
        const pts=Array.from({length:44},(_,i)=>point(a-span+i/43*span*2,r));
        line(f,pts,4,.08+breath*.12);line(f,pts,1.4,.55+breath*.35);
        for(let end of [-1,1])line(f,[point(a+end*span,r-2),point(a+end*span,r+2)],1.2,.7,p[2]);
        const q=point(a+Math.sin(t*.8+j)*span*.75,r);light(f,...q,3,p[2],.6);
      }
      const u=(t*.14)%1,alpha=Math.sin(u*Math.PI)*.3;
      const pts=Array.from({length:121},(_,i)=>point(i/120*TAU,43+u*7));line(b,pts,1.5*(1-u)+.2,alpha);
    } else if(mode==='visor') {
      const lock=.5+.5*Math.sin(t*.7),r=40+lock*2;
      for(let sx of [-1,1])for(let sy of [-1,1]) {
        const x=sx*r*.76,y=sy*r*.76;
        line(f,[[x-sx*9,y],[x,y],[x,y-sy*9]],1.6,.8);
        line(f,[[x-sx*7,y+sy*2],[x+sx*2,y+sy*2],[x+sx*2,y-sy*7]],.5,.3);
      }
      for(let side of [-1,1])for(let j=0;j<13;j++) {
        const y=-24+j*4,a=.22+.65*Math.exp(-Math.pow((y-24*Math.sin(t*1.1+side))/9,2));
        line(f,[[side*43,y],[side*(j%3===0?48:46),y]],j%3===0?1.2:.65,a);
      }
      for(let j=0;j<3;j++){const x=-7+j*7;line(f,[[x,-43],[x+3,-43]],1.7,.3+.6*Math.pow(.5+.5*Math.sin(t*2-j),4),p[2]);}
      const pts=Array.from({length:55},(_,i)=>point(.25+i/54*(Math.PI-.5),42));line(f,pts,.6,.35);
      const a=.4+(Math.PI-.8)*(.5+.5*Math.sin(t*.55));light(f,...point(a,42),3,p[2],.8);
    } else if(mode==='terminal') {
      for(let side of [-1,1]) {
        const x=side*40,y=side===1?8:-19,sway=Math.sin(t*.65+side)*1.1;
        const shape=[[x,y-11+sway],[x+side*13,y-7+sway],[x+side*13,y+13+sway],[x,y+9+sway],[x,y-11+sway]];
        f.save();f.fillStyle=rgb(p[1],.16);f.beginPath();shape.forEach((q,i)=>i?f.lineTo(...q):f.moveTo(...q));f.fill();f.restore();
        line(f,shape,.6,.6);
        for(let j=0;j<6;j++) {
          const u=(j/6+t*.09)%1,yy=y-7+u*16+sway,alpha=Math.sin(u*Math.PI)*.65;
          const width=4+rand(j,side)*6;line(f,[[x+side*2,yy],[x+side*(2+width),yy+width*.27]],.8,alpha,j%3?p[0]:p[2]);
        }
        light(f,x+side*11,y-5+sway,2,p[2],.25+.2*Math.sin(t*2+side));
      }
      for(let j=0;j<16;j++){const x=-24+j*3.1;line(f,[[x,42],[x,42-(2+7*Math.pow(.5+.5*Math.sin(t*1.4+j*.6),2))]],1.4,.6);}
      line(b,[[-26,-36],[-18,-42],[15,-42],[23,-38]],.7,.6);
    } else if(mode==='weave') {
      for(let lane=0;lane<3;lane++) {
        const pts=Array.from({length:141},(_,i)=>{const u=i/140,a=u*TAU;const r=42+Math.sin(u*TAU*4+t*.8+lane*TAU/3)*2.5;return point(a,r);});
        line(f,pts,3,.07,p[lane]);line(f,pts,.8,.65,p[lane]);
        const u=(t*.12+lane/3)%1,q=pts[Math.floor(u*140)];light(f,...q,3,p[2],.65);
      }
      for(let j=0;j<12;j++){const u=(t*.1+rand(j))%1,a=rand(j,2)*TAU,q=point(a,42+u*8);star(f,...q,.7+rand(j,3)*.5,p[2],Math.sin(u*Math.PI)*.4);}
    } else if(mode==='eclipse') {
      const center=t*.3;
      for(let j=0;j<150;j++) {
        const a=j/150*TAU,d=Math.atan2(Math.sin(a-center),Math.cos(a-center));
        const power=Math.exp(-d*d*1.8),q=point(a,42),outer=point(a,44+power*(3+Math.sin(a*5+t*.4)*1.3));
        line(b,[q,outer],1.4,.12+power*.55,j%4?p[0]:p[2]);
        if(j%3===0)light(b,...q,3.2+power*2.8,p[0],power*.18);
      }
      const pts=Array.from({length:160},(_,i)=>point(i/159*TAU,41.5));line(f,pts,.85,.32);
      for(let j=0;j<5;j++){const a=j*2.39+.2,q=point(a,47+rand(j)*3);star(f,...q,1+rand(j)*1.3,p[2],Math.pow(.5+.5*Math.sin(t*.8+j*1.8),12)*.8);}
    } else {}
  }
  const referenceScales = {
    summoning:1.13,
    rainbow:1.17,
    ripple:1.13,
    wisps:1.18,
    field:1.13,
    mirage:1.16,
    accretion:1.16,
    cosmic:1.2,
    sunrise:1.1,
    portal:1.14,
    interface:1.08,
  };
  function draw(renderer,t) {
    const {front,back,effect:e}=renderer,m=e.mode;
    const settings=renderer.colorOptions,p=paletteFor(e,settings);
    themes.set(front,settings);themes.set(back,settings);
    front.save();back.save();
    if(e.referenceScale) {
      const scale=referenceScales[m] || 1.12;
      front.scale(scale,scale);back.scale(scale,scale);
    }
    if(['radar','dataflow','reactor','visor','terminal','weave','eclipse'].includes(m))craftedComposition(renderer,t,p,m);
    else if(['plasma','field'].includes(m))electricity(front,t,p,m);
    else if(m==='mirage')ribbon(front,t,p,m);
    else if(m==='summoning')summoning(front,t,p,settings?.starColor);
    else if(m==='rainbow')rainbow(back,t,p);
    else if(m==='ripple')arc(front,t,p,40,1.6,.8,0,TAU,2.6);
    else if(m==='cosmic')dust(front,t,p,true);
    else if(m==='wisps')wisps(renderer,t,p);
    else if(m==='accretion')accretion(front,t,p);
    else if(m==='sunrise')sunrise(renderer,t,p);
    else if(m==='portal')portal(front,t,p);
    else if(m==='interface')futuristic(front,t,p);
    if(m==='mirage') {
      for(let j=0;j<16;j++){const q=point(rand(j)*TAU,42+rand(j,2)*5);light(front,...q,1,p[2],Math.pow(.5+.5*Math.sin(t*.8+j),4)*.6);}
    }
    front.restore();back.restore();themes.delete(front);themes.delete(back);
  }
  window.FXArcane=Object.freeze({effects,draw,presets,createPreferences,paletteFor});
})();
