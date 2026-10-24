(() => {
'use strict';
  function rgba(hex, opacity) {
    const value = String(hex).replace('#', '');
    if (value.length !== 6) return hex;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }

  function hash(text) {
    let result = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      result ^= text.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  class EffectRenderer {
    constructor(effect, back, front, cssSize) {
      this.effect = effect;
      this.backCanvas = back;
      this.frontCanvas = front;
      this.cssSize = cssSize;
      this.logicalSize = 240;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.seed = hash(effect.id) % 100000;
      for (const canvas of [back, front]) {
        canvas.width = Math.round(cssSize * this.dpr);
        canvas.height = Math.round(cssSize * this.dpr);
        canvas.style.width = `${cssSize}px`;
        canvas.style.height = `${cssSize}px`;
      }
      // Chromium can promote only a small number of desynchronized canvases.
      // Later alpha canvases may then be composited as opaque black surfaces.
      this.back = back.getContext('2d', { alpha:true });
      this.front = front.getContext('2d', { alpha:true });
      if (!this.back || !this.front) throw new Error('Canvas 2D is unavailable');
    }

    noise(index, salt = 0) {
      const value = Math.sin(this.seed * .0017 + index * 12.9898 + salt * 78.233) * 43758.5453;
      return value - Math.floor(value);
    }

    prepare(ctx, canvas) {
      const scale = (this.sceneSize ?? this.cssSize) / this.logicalSize;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, canvas.width / 2, canvas.height / 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
    }

    draw(time) {
      this.prepare(this.back, this.backCanvas);
      this.prepare(this.front, this.frontCanvas);
      const p = this.effect.palette;
      switch (this.effect.kind) {
        case 'arcane':
          window.FXArcane.draw(this, time);
          break;
        case 'bard': this.drawBard(time, p); break;
        case 'wildfire': this.drawWildfire(time, p); this.tintFire(); break;
        case 'fire-ring': this.drawFireRing(time, p); this.tintFire(); break;
        case 'forest-lights': this.drawForestLights(time, p); break;
        case 'willow-whisper': this.drawWillowWhisper(time, p); break;
        case 'smoke':
          this.avatar = this.avatar || 'fantasy';
          this.smokeOptions = this.smokeOptions || {};
          window.FXSmoke.draw(this, time);
          break;
        default: break;
      }
      if(!['arcane','wildfire','fire-ring'].includes(this.effect.kind))this.tintFire();
    }

    tintFire() {
      const settings=this.colorOptions;
      if(!settings || settings.mode==='original')return;
      this.tintLayers ||= new Map();
      const key=JSON.stringify([settings.mode,settings.colors,settings.angle]);
      const layers=this.back===this.front?[[this.front,this.frontCanvas]]:[[this.back,this.backCanvas],[this.front,this.frontCanvas]];
      for(const [ctx,canvas] of layers) {
        const {width:w,height:h}=canvas;
        let layer=this.tintLayers.get(canvas);
        if(!layer || layer.canvas.width!==w || layer.canvas.height!==h) {
          const buffer=document.createElement('canvas');buffer.width=w;buffer.height=h;
          layer={canvas:buffer,ctx:buffer.getContext('2d'),key:null};this.tintLayers.set(canvas,layer);
        }
        const target=layer.ctx;
        if(layer.key!==key) {
          layer.key=key;
          const a=(settings.angle??45)*Math.PI/180,dx=Math.cos(a)*w*.4,dy=Math.sin(a)*h*.4;
          const gradient=target.createLinearGradient(w/2-dx,h/2-dy,w/2+dx,h/2+dy);
          settings.colors.forEach((color,i)=>gradient.addColorStop(i/2,color));
          layer.paint=settings.mode==='solid'?settings.colors[0]:gradient;
        }
        // Color blending preserves luminance; the original image restores exact alpha.
        target.globalCompositeOperation='copy';target.drawImage(canvas,0,0);
        target.globalCompositeOperation='color';target.fillStyle=layer.paint;target.fillRect(0,0,w,h);
        target.globalCompositeOperation='destination-in';target.drawImage(canvas,0,0);
        ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';
        ctx.shadowBlur=0;ctx.globalCompositeOperation='copy';ctx.drawImage(layer.canvas,0,0);ctx.restore();
      }
    }

    dot(ctx, x, y, radius, color, glow = 0) {
      ctx.save();
      ctx.fillStyle = color;
      if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = color; }
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    staffPoint(progress, radius) {
      const angle = Math.PI * (.08 + progress * .84);
      return { x:Math.cos(angle)*radius, y:Math.sin(angle)*radius + 4, angle };
    }

    drawNote(ctx, x, y, size, rotation, color, doubleNote = false) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.beginPath(); ctx.ellipse(-1, 2, size*.58, size*.4, -.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size*.45, 1); ctx.lineTo(size*.45, -size*2.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size*.45, -size*2.4); ctx.bezierCurveTo(size*1.8,-size*2.05,size*1.75,-size*.75,size*.45,-size*.65); ctx.stroke();
      if (doubleNote) {
        ctx.beginPath(); ctx.ellipse(size*1.5, 3, size*.52, size*.37, -.28, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(size*1.9,2);ctx.lineTo(size*1.9,-size*2.05);ctx.lineTo(size*.45,-size*2.4);ctx.stroke();
      }
      ctx.restore();
    }

    drawBard(time, p) {
      const back = this.back;
      const front = this.front;
      const staffGradient = back.createLinearGradient(-80, 20, 80, 80);
      staffGradient.addColorStop(0, rgba(p[1], .12));
      staffGradient.addColorStop(.48, rgba(p[0], .5));
      staffGradient.addColorStop(1, rgba(p[2], .14));

      for (let line = 0; line < 5; line += 1) {
        const radius = 42 + line * 3.35;
        back.strokeStyle = staffGradient;
        back.lineWidth = line === 2 ? 1.15 : .78;
        back.beginPath();
        for (let i = 0; i <= 64; i += 1) {
          const point = this.staffPoint(i/64, radius);
          const y = point.y + Math.sin(i*.15 + time*.6) * .5;
          if (!i) back.moveTo(point.x, y); else back.lineTo(point.x, y);
        }
        back.stroke();
      }

      const barPositions = [.16, .42, .69, .88];
      barPositions.forEach((progress, index) => {
        const outer = this.staffPoint(progress, 57);
        const inner = this.staffPoint(progress, 41);
        back.strokeStyle = rgba(index % 2 ? p[1] : p[0], .3);
        back.lineWidth = .8;
        back.beginPath(); back.moveTo(inner.x, inner.y); back.lineTo(outer.x, outer.y); back.stroke();
      });

      const phrase = [0, .14, .31, .48, .68, .84];
      phrase.forEach((offset, index) => {
        const progress = (time*.045 + offset) % 1;
        const line = index % 5;
        const point = this.staffPoint(progress, 42 + line*3.35);
        const alpha = Math.sin(Math.PI * progress) * .72 + .18;
        this.drawNote(front, point.x, point.y, 3.4 + (index%2)*.7, point.angle - Math.PI/2, rgba(index%3 ? p[0] : p[2], alpha), index === 2 || index === 5);
      });

      const chord = Math.pow(Math.max(0, Math.sin(time * .74)), 7);
      front.save();
      front.strokeStyle = rgba(p[1], .12 + chord*.32);
      front.lineWidth = 2 + chord*2;
      front.shadowBlur = 11;
      front.shadowColor = p[1];
      front.beginPath(); front.arc(0, 4, 61 + chord*2, .13*Math.PI, .87*Math.PI); front.stroke();
      front.restore();
    }

    flameTongue(ctx, x, y, width, height, lean, phase, p, opacity = 1) {
      const pulse = .92 + Math.sin(phase) * .08 + Math.sin(phase * 2.7) * .045;
      const base = { x, y };
      const tip = {
        x:x + lean + Math.sin(phase * .73) * 2,
        y:y - height * pulse,
      };
      const left = { x:x - width, y };
      const right = { x:x + width, y };
      const gradient = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
      gradient.addColorStop(0, rgba(p[2], opacity * .96));
      gradient.addColorStop(.22, rgba(p[0], opacity * .96));
      gradient.addColorStop(.67, rgba(p[1], opacity * .78));
      gradient.addColorStop(1, rgba(p[1], 0));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 11;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.bezierCurveTo(
        left.x - width * .2,
        left.y - height * .3,
        tip.x - width * .3,
        tip.y + height * .25,
        tip.x, tip.y
      );
      ctx.bezierCurveTo(
        tip.x + width * .34,
        tip.y + height * .2,
        right.x + width * .16,
        right.y - height * .25,
        right.x, right.y
      );
      ctx.quadraticCurveTo(base.x, base.y + 3, left.x, left.y);
      ctx.fill();

      const coreTip = {
        x:base.x + lean * .32,
        y:base.y - height * .55,
      };
      const coreColor = this.effect.core || '#fff7c5';
      const coreGradient = ctx.createLinearGradient(base.x, base.y, coreTip.x, coreTip.y);
      coreGradient.addColorStop(0, rgba(coreColor, opacity * .9));
      coreGradient.addColorStop(.7, rgba(p[2], opacity * .56));
      coreGradient.addColorStop(1, rgba(p[2], 0));
      ctx.fillStyle = coreGradient;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(base.x - width * .3, base.y);
      ctx.quadraticCurveTo(
        coreTip.x - width * .2,
        coreTip.y + height * .18,
        coreTip.x, coreTip.y
      );
      ctx.quadraticCurveTo(
        coreTip.x + width * .23,
        coreTip.y + height * .18,
        base.x + width * .32,
        base.y
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    flameMantle(ctx, time, p, baseOffset, phase, opacity = 1) {
      const upper = [];
      const lower = [];
      const count = 88;
      const halfWidth = 44;
      for (let i = 0; i <= count; i += 1) {
        const progress = i / count;
        const x = -halfWidth + progress * halfWidth * 2;
        const center = Math.pow(Math.sin(progress * Math.PI), .76);
        const base = 34 + center * 15 + baseOffset;
        const primary = (Math.sin(progress * Math.PI * 10.2 - time * 2.28 + phase) + 1) * .5;
        const secondary = Math.max(0, Math.sin(progress * Math.PI * 21.4 + time * 1.52 + phase * 1.8));
        const leftEdge = 1 - .18 * Math.pow(Math.max(0, 1 - progress / .1), 2);
        const height = (7.5 + center * 3 + primary * 7 + secondary * 4.5) * leftEdge;
        upper.push({ x, y:base - height });
        lower.push({ x, y:base + 3.2 + Math.sin(progress * Math.PI * 3.2 + time * .45) * .65 });
      }
      const gradient = ctx.createLinearGradient(0, 58, 0, 12);
      gradient.addColorStop(0, rgba(p[2], opacity * .96));
      gradient.addColorStop(.3, rgba(p[0], opacity * .95));
      gradient.addColorStop(.74, rgba(p[1], opacity * .74));
      gradient.addColorStop(1, rgba(p[1], 0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p[0];
      ctx.beginPath();
      ctx.moveTo(upper[0].x, upper[0].y);
      upper.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      lower.reverse().forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    radialFlame(ctx, angle, radius, width, height, lean, phase, p, opacity) {
      ctx.save();
      ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      this.flameTongue(ctx, 0, 0, width, height, lean, phase, p, opacity);
      ctx.restore();
    }

    flameCorona(ctx, time, p, startAngle, endAngle, radius, count, phase, opacity, scale = 1) {
      ctx.save();
      ctx.filter = `blur(${Math.max(1.2, 3 * scale)}px)`;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(p[0], opacity * .28);
      ctx.lineWidth = 7 * scale;
      ctx.shadowBlur = 10 + 4 * scale;
      ctx.shadowColor = p[0];
      ctx.beginPath(); ctx.arc(0, 0, radius, startAngle, endAngle); ctx.stroke();
      ctx.restore();

      const softCount = count * 2;
      ctx.save();
      ctx.filter = `blur(${Math.max(1, 2.3 * scale)}px)`;
      for (let i = 0; i < softCount; i += 1) {
        const progress = (i + this.noise(i, 171) * .68) / softCount;
        const angle = startAngle + (endAngle - startAngle) * progress + Math.sin(time * .28 + i) * .012;
        const baseRadius = radius + (this.noise(i, 172) - .5) * 5 * scale;
        this.radialFlame(
          ctx,
          angle,
          baseRadius,
          (6.5 + this.noise(i, 173) * 4.8) * scale,
          (14 + this.noise(i, 174) * 22) * scale,
          (this.noise(i, 175) - .5) * 9 * scale,
          time * (1.4 + this.noise(i, 176) * .45) + i * .73 + phase,
          p,
          opacity * (.18 + this.noise(i, 177) * .16)
        );
      }
      ctx.restore();

      for (let i = 0; i < count; i += 1) {
        const progress = (i + this.noise(i, 181) * .58) / count;
        const angle = startAngle + (endAngle - startAngle) * progress + Math.sin(time * .34 + i * 1.3) * .014;
        const accent = i % 5 === 2 ? 7 : 0;
        this.radialFlame(
          ctx,
          angle,
          radius + (this.noise(i, 182) - .5) * 4 * scale,
          (5.8 + this.noise(i, 183) * 3.6) * scale,
          (14 + this.noise(i, 184) * 18 + accent) * scale,
          (this.noise(i, 185) - .5) * 8 * scale,
          time * (1.55 + this.noise(i, 186) * .4) + i * .91 + phase,
          p,
          opacity * (.48 + this.noise(i, 187) * .24)
        );
      }
    }

    drawWildfire(time, p) {
      const back = this.back;
      const front = this.front;

      back.save();
      back.filter = 'blur(4px)';
      this.flameMantle(back, time * .9, p, -1.5, 1.4, .2);
      back.restore();

      front.save();
      front.filter = 'blur(3px)';
      this.flameMantle(front, time * .94, p, 1.5, .8, .3);
      front.restore();

      this.flameMantle(front, time, p, 0, 0, .88);

      const tongues = Array.from({ length:13 }, (_, index) => {
        const progress = index / 12;
        const profile = Math.pow(Math.sin(progress * Math.PI), .76);
        return {
          x:-42 + progress * 84 + (index === 0 ? 1.8 : 0),
          y:34.5 + profile * 15 + (this.noise(index, 205) - .5) * 1.1 + (index === 0 ? 2 : 0),
          width:3.8 + profile * 1.05 + this.noise(index, 201) * .7,
          height:(13.5 + profile * 4.5 + this.noise(index, 202) * 6) * (index === 0 ? .8 : 1),
          lean:(this.noise(index, 203) - .5) * 3.4 + (progress - .5) * 1.6,
          phase:time * (1.46 + this.noise(index, 204) * .22) + index * .79,
        };
      });

      front.save();
      front.filter = 'blur(2.2px)';
      tongues.forEach(flame => {
        this.flameTongue(
          front,
          flame.x,
          flame.y + 1,
          flame.width + 1.4,
          flame.height + 2.5,
          flame.lean,
          flame.phase,
          p,
          .2
        );
      });
      front.restore();

      tongues.forEach((flame, index) => {
        this.flameTongue(
          front,
          flame.x,
          flame.y,
          flame.width,
          flame.height,
          flame.lean,
          flame.phase,
          p,
          .72 + this.noise(index, 206) * .16
        );
      });

      const baseGlow = front.createLinearGradient(-44, 0, 44, 0);
      baseGlow.addColorStop(0, rgba(p[0], 0));
      baseGlow.addColorStop(.14, rgba(p[0], .58));
      baseGlow.addColorStop(.5, rgba(p[2], .92));
      baseGlow.addColorStop(.86, rgba(p[0], .58));
      baseGlow.addColorStop(1, rgba(p[0], 0));
      front.save();
      front.globalCompositeOperation = 'lighter';
      front.strokeStyle = baseGlow;
      front.lineWidth = 1.8;
      front.shadowBlur = 6;
      front.shadowColor = p[0];
      front.beginPath();
      front.moveTo(-44, 36.5);
      front.quadraticCurveTo(0, 61.5, 44, 36.5);
      front.stroke();
      front.restore();
    }

    drawFireRing(time, p) {
      const back = this.back;
      const front = this.front;
      const radius = this.effect.ringRadius || 42;
      const scale = this.effect.ringScale || .40;
      const glow = back.createRadialGradient(0, 0, radius - 7, 0, 0, radius + 24);
      glow.addColorStop(0, rgba(p[1], 0));
      glow.addColorStop(.34, rgba(p[1], .08));
      glow.addColorStop(.64, rgba(p[0], .14));
      glow.addColorStop(1, rgba(p[0], 0));
      back.fillStyle = glow;
      back.beginPath(); back.arc(0, 0, radius + 24, 0, Math.PI * 2); back.fill();

      this.flameCorona(back, time, p, Math.PI, Math.PI * 2, radius, 11, .85, .94, scale);
      this.flameCorona(front, time * 1.03, p, 0, Math.PI, radius, 11, .15, .98, scale);

      for (let i = 0; i < 4; i += 1) {
        const life = (time * (.045 + this.noise(i, 11) * .02) + this.noise(i, 12)) % 1;
        const angle = -Math.PI * .86 + this.noise(i, 13) * Math.PI * 1.72;
        const emberRadius = radius + 8 + life * 14;
        this.dot(
          front,
          Math.cos(angle) * emberRadius,
          Math.sin(angle) * emberRadius - life * 5,
          .55 + (1 - life) * .72,
          rgba(i % 2 ? p[0] : p[2], (1 - life) * .44),
          4
        );
      }
    }

    drawFirefly(ctx, x, y, scale, p, pulse, wingPhase = 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 13 * scale);
      halo.addColorStop(0, rgba(p[2], .56 * pulse));
      halo.addColorStop(.34, rgba(p[0], .3 * pulse));
      halo.addColorStop(1, rgba(p[0], 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, 13 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      const wingBeat = (Math.sin(wingPhase) + 1) * .5;
      const wingOffset = (1.55 + wingBeat * 1.28) * scale;
      const wingWidth = (2.45 + wingBeat * 1.2) * scale;
      const wingHeight = (.66 + wingBeat * .46) * scale;
      const wingAngle = .22 + wingBeat * .38;
      ctx.fillStyle = rgba('#edf7d5', .48 + pulse * .38);
      ctx.beginPath();
      ctx.ellipse(-wingOffset, -.62 * scale, wingWidth, wingHeight, -wingAngle, 0, Math.PI * 2);
      ctx.ellipse(wingOffset, -.62 * scale, wingWidth, wingHeight, wingAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba('#263529', .82);
      ctx.beginPath();
      ctx.ellipse(0, .15 * scale, .78 * scale, 2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.dot(ctx, x, y, 1.28 * scale, rgba(p[2], .5 + pulse * .48), 8 * scale);
    }

    drawForestLights(time, p) {
      const lights = [
        { cx:-39, cy:-19, ax:7, ay:10, sx:.43, sy:.31, px:.2, py:1.4, sz:.27, pz:.5, scale:1.08 },
        { cx:-11, cy:-40, ax:11, ay:5, sx:-.29, sy:.47, px:1.8, py:.3, sz:.34, pz:2.1, scale:.88 },
        { cx:30, cy:-29, ax:8, ay:9, sx:.37, sy:-.26, px:2.7, py:1.9, sz:.22, pz:4.3, scale:1 },
        { cx:41, cy:4, ax:5, ay:12, sx:-.48, sy:.35, px:.9, py:3.1, sz:.31, pz:1.2, scale:.84 },
        { cx:29, cy:31, ax:10, ay:6, sx:.25, sy:.44, px:4.2, py:.7, sz:.25, pz:5.4, scale:1.12 },
        { cx:2, cy:40, ax:12, ay:5, sx:-.34, sy:-.39, px:5.3, py:2.4, sz:.37, pz:3.7, scale:.86 },
        { cx:-31, cy:30, ax:8, ay:8, sx:.46, sy:-.23, px:3.5, py:5.1, sz:.29, pz:.1, scale:.96 },
        { cx:-42, cy:7, ax:5, ay:11, sx:-.27, sy:.5, px:1.1, py:4.4, sz:.2, pz:2.8, scale:.82 },
        { cx:10, cy:-39, ax:7, ay:7, sx:.52, sy:.28, px:5.9, py:3.6, sz:.33, pz:4.9, scale:1.04 },
      ];
      lights.forEach((light, index) => {
        const x = light.cx
          + Math.sin(time * light.sx + light.px) * light.ax
          + Math.sin(time * light.sy * .43 + light.py) * 2.2;
        const y = light.cy
          + Math.cos(time * light.sy + light.py) * light.ay
          + Math.sin(time * light.sx * .37 + light.px) * 1.8;
        const depth = Math.sin(time * light.sz + light.pz);
        const glow = (Math.sin(time * (.36 + index * .017) + light.py * 1.73) + 1) * .5;
        const pulse = .11 + Math.pow(glow, 2.65) * .89;
        const layer = depth > .08 ? this.front : this.back;
        const scale = light.scale * (.95 + depth * .05);
        this.drawFirefly(layer, x, y, scale, p, pulse, time * (6.4 + index * .23) + light.px * 1.7);
      });
    }

    drawSakuraPetal(ctx, x, y, size, rotation, p, opacity = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      const fill = ctx.createLinearGradient(0, -size, 0, size * .55);
      fill.addColorStop(0, rgba(p[2], opacity * .96));
      fill.addColorStop(.48, rgba(p[0], opacity * .9));
      fill.addColorStop(1, rgba('#b97080', opacity * .76));
      ctx.fillStyle = fill;
      ctx.strokeStyle = rgba(p[2], opacity * .28);
      ctx.lineWidth = .52;
      ctx.beginPath();
      ctx.moveTo(0, size * .54);
      ctx.bezierCurveTo(-size * .28, size * .38, -size * .58, size * .1, -size * .47, -size * .27);
      ctx.bezierCurveTo(-size * .38, -size * .58, -size * .12, -size * .84, 0, -size);
      ctx.bezierCurveTo(size * .17, -size * .8, size * .43, -size * .56, size * .48, -size * .24);
      ctx.bezierCurveTo(size * .53, size * .08, size * .25, size * .4, 0, size * .54);
      ctx.closePath();
      ctx.shadowBlur = 5;
      ctx.shadowColor = rgba(p[0], opacity * .32);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba('#955867', opacity * .42);
      ctx.lineWidth = .45;
      ctx.beginPath();
      ctx.moveTo(0, size * .42);
      ctx.bezierCurveTo(size * .04, size * .05, -size * .04, -size * .42, 0, -size * .78);
      ctx.stroke();
      ctx.restore();
    }

    drawWillowWhisper(time, p) {
      const falling = [
        { x:-49, drift:12, speed:.082, phase:.04, size:9.2, spin:.42, front:true },
        { x:-34, drift:9, speed:.069, phase:.31, size:7.2, spin:-.36, front:false },
        { x:-19, drift:14, speed:.091, phase:.67, size:10.4, spin:.29, front:true },
        { x:-4, drift:10, speed:.074, phase:.16, size:8.1, spin:-.44, front:true },
        { x:12, drift:15, speed:.086, phase:.81, size:11, spin:.34, front:false },
        { x:27, drift:11, speed:.065, phase:.45, size:7.8, spin:-.31, front:true },
        { x:42, drift:13, speed:.094, phase:.73, size:9.7, spin:.39, front:true },
        { x:55, drift:8, speed:.077, phase:.22, size:6.8, spin:-.46, front:false },
        { x:2, drift:18, speed:.089, phase:.54, size:8.8, spin:.26, front:true },
      ];
      falling.forEach((petal, index) => {
        const progress = (time * petal.speed + petal.phase) % 1;
        const x = petal.x + Math.sin(progress * Math.PI * 2 + index * 1.27) * petal.drift;
        const y = -80 + progress * 164;
        const fade = Math.min(1, progress * 7, (1 - progress) * 7);
        const opacity = fade * (petal.front ? .9 : .5);
        const rotation = progress * Math.PI * 2 * petal.spin + Math.sin(time * .55 + index) * .28;
        this.drawSakuraPetal(petal.front ? this.front : this.back, x, y, petal.size, rotation, p, opacity);
      });
    }

  }

window.FXPreviewRenderer=EffectRenderer;
})();
