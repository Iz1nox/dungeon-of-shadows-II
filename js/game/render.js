'use strict';

// Renderowanie: kafelki biomów, byty, pociski, efekty, oświetlenie, pogoda, minimapy.
const Renderer = {
  canvas: null, ctx: null,
  light: null, lctx: null,
  tilesets: {}, // cache per biom
  weather: [],
  time: 0,

  init() {
    this.canvas = U.el('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    const resize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.light.width = window.innerWidth;
      this.light.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  },

  // ===== TILESET =====
  tileset(biome) {
    if (this.tilesets[biome.id]) return this.tilesets[biome.id];
    const T = TILE_SIZE;
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = T; c.height = T;
      return [c, c.getContext('2d')];
    };
    const noise = (ctx, color, n, a) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      for (let i = 0; i < n; i++) {
        ctx.fillRect(Math.random() * T, Math.random() * T, U.rand(1, 3), U.rand(1, 3));
      }
      ctx.globalAlpha = 1;
    };
    const set = {};

    // podłoga ×2 warianty
    for (let v = 0; v < 2; v++) {
      const [c, x] = mk();
      x.fillStyle = v ? biome.pal.floorAlt : biome.pal.floor;
      x.fillRect(0, 0, T, T);
      noise(x, '#000', 14, .18);
      noise(x, biome.pal.accent, 5, .07);
      x.strokeStyle = 'rgba(0,0,0,.25)';
      x.strokeRect(.5, .5, T - 1, T - 1);
      set['floor' + v] = c;
    }
    // ściana
    {
      const [c, x] = mk();
      x.fillStyle = biome.pal.wall;
      x.fillRect(0, 0, T, T);
      x.fillStyle = biome.pal.wallTop;
      x.fillRect(0, 0, T, 7);
      noise(x, '#000', 12, .22);
      noise(x, biome.pal.wallTop, 6, .25);
      x.fillStyle = 'rgba(0,0,0,.35)';
      x.fillRect(0, T - 5, T, 5);
      set.wall = c;
    }
    this.tilesets[biome.id] = set;
    return set;
  },

  // ===== GŁÓWNY RYSUNEK =====
  draw(dt) {
    const s = Game.s;
    if (!s || !s.map) return;
    if (!this.canvas.width || !this.canvas.height) return; // okno zminimalizowane/ukryte
    this.time += dt;
    const ctx = this.ctx, T = TILE_SIZE;
    const cw = this.canvas.width, ch = this.canvas.height;
    const p = s.p, map = s.map;

    // kamera
    const sh = Meta.data.screenShake ? Fx.shakeOffset() : { x: 0, y: 0 };
    Game.cam.x = p.x; Game.cam.y = p.y;
    const camX = Game.cam.x, camY = Game.cam.y;
    const wx2sx = wx => (wx - camX) * T + cw / 2 + sh.x;
    const wy2sy = wy => (wy - camY) * T + ch / 2 + sh.y;
    this.wx2sx = wx2sx; this.wy2sy = wy2sy;

    ctx.fillStyle = '#020108';
    ctx.fillRect(0, 0, cw, ch);

    const ts = this.tileset(map.biome);
    const x0 = Math.max(0, Math.floor(camX - cw / 2 / T) - 1);
    const x1 = Math.min(map.w - 1, Math.ceil(camX + cw / 2 / T) + 1);
    const y0 = Math.max(0, Math.floor(camY - ch / 2 / T) - 1);
    const y1 = Math.min(map.h - 1, Math.ceil(camY + ch / 2 / T) + 1);

    // kafelki
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * map.w + x;
        if (!map.explored[i]) continue;
        const t = map.t[i];
        const sx = Math.round(wx2sx(x)), sy = Math.round(wy2sy(y));
        if (t === TILE.WALL) {
          ctx.drawImage(ts.wall, sx, sy);
        } else {
          ctx.drawImage(ts['floor' + ((x * 7 + y * 13) % 2)], sx, sy);
          this.drawSpecialTile(ctx, t, x, y, sx, sy, map);
        }
        if (!map.visible[i]) {
          ctx.fillStyle = 'rgba(2,1,8,.62)';
          ctx.fillRect(sx, sy, T, T);
        }
      }
    }

    // dekoracje — celowo małe i przygaszone, żeby nie mylić z wrogami/łupami
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of map.deco) {
      if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
      const i = (d.y | 0) * map.w + (d.x | 0);
      if (!map.explored[i]) continue;
      ctx.globalAlpha = map.visible[i] ? .5 : .2;
      ctx.font = Math.round(T * d.s * .55) + 'px serif';
      ctx.fillText(d.icon, wx2sx(d.x), wy2sy(d.y));
    }
    ctx.globalAlpha = 1;

    // pochodnie
    for (const tc of map.torches) {
      if (tc.x < x0 || tc.x > x1 || tc.y < y0 || tc.y > y1) continue;
      const i = (tc.y | 0) * map.w + (tc.x | 0);
      if (!map.explored[i]) continue;
      const flick = .8 + Math.sin(this.time * 7 + tc.phase) * .2;
      ctx.font = Math.round(T * .45) + 'px serif';
      ctx.globalAlpha = flick;
      ctx.fillText('🔥', wx2sx(tc.x), wy2sy(tc.y) - T * .35);
      ctx.globalAlpha = 1;
    }

    // strefy naziemne
    for (const z of s.zones) {
      const sx = wx2sx(z.x), sy = wy2sy(z.y);
      ctx.globalAlpha = .22 + Math.sin(this.time * 5) * .05;
      ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.arc(sx, sy, z.r * T, 0, 6.29); ctx.fill();
      ctx.globalAlpha = .5;
      ctx.strokeStyle = z.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, z.r * T, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
      if (z.rain && U.chance(.4)) {
        Fx.burst(z.x + U.rand(-z.r, z.r), z.y + U.rand(-z.r, z.r), z.color, 1, { spd: 1, life: .4 });
      }
    }

    // pułapki łowcy
    for (const tr of s.traps) {
      ctx.font = Math.round(T * .5) + 'px serif';
      ctx.globalAlpha = .9;
      ctx.fillText('🪤', wx2sx(tr.x), wy2sy(tr.y));
      ctx.globalAlpha = 1;
    }

    // telegrafy (ostrzeżenia)
    for (const tg of s.telegraphs) {
      const sx = wx2sx(tg.x), sy = wy2sy(tg.y);
      const prog = 1 - tg.t / tg.maxT;
      const col = tg.friendly ? '255,170,80' : '255,60,60';
      ctx.fillStyle = `rgba(${col},.16)`;
      ctx.beginPath(); ctx.arc(sx, sy, tg.r * T, 0, 6.29); ctx.fill();
      ctx.fillStyle = `rgba(${col},.3)`;
      ctx.beginPath(); ctx.arc(sx, sy, tg.r * T * prog, 0, 6.29); ctx.fill();
      ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, tg.r * T, 0, 6.29); ctx.stroke();
    }

    // łupy — mniejsze niż wrogowie, z podstawką i promieniem rzadkości
    for (const d of s.drops) {
      const i = (d.y | 0) * map.w + (d.x | 0);
      if (!map.explored[i]) continue;
      const sx = wx2sx(d.x), sy = wy2sy(d.y) + Math.sin(d.bob) * 2.5;
      const rar = ItemDB.rarities[d.item.rarity];
      // podstawka: każdy przedmiot na ziemi ma cień + jasny pierścień
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.ellipse(sx, wy2sy(d.y) + T * .18, T * .2, T * .08, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = rar.color;
      ctx.globalAlpha = .55 + Math.sin(this.time * 4 + d.bob) * .2;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(sx, wy2sy(d.y) + T * .18, T * .24, T * .1, 0, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
      if (d.item.rarity !== 'common') {
        ctx.globalAlpha = .4 + Math.sin(this.time * 4 + d.bob) * .15;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, T * .4);
        g.addColorStop(0, rar.color); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, T * .4, 0, 6.29); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.font = Math.round(T * .4) + 'px serif';
      ctx.fillText(d.item.icon, sx, sy);
    }

    // słudzy
    for (const mn of s.minions) {
      const sx = wx2sx(mn.x), sy = wy2sy(mn.y) + Math.sin(this.time * 6 + mn.x) * 2;
      ctx.font = Math.round(T * (mn.big ? .8 : .55)) + 'px serif';
      ctx.globalAlpha = .95;
      ctx.fillText(mn.icon, sx, sy);
      ctx.globalAlpha = 1;
      // pasek hp sługi
      if (mn.hp < mn.maxHp) this.hpBar(ctx, sx, sy - T * .5, T * .7, mn.hp / mn.maxHp, '#8ae08a');
    }

    // wrogowie
    for (const e of s.enemies) {
      const i = (e.y | 0) * map.w + (e.x | 0);
      if (!map.visible[i]) continue;
      this.drawEnemy(ctx, e, wx2sx(e.x), wy2sy(e.y), T);
    }

    // wskaźnik auto-celu (sterowanie dotykowe)
    if (Touch.enabled && Touch.target && !Touch.target.dead) {
      const tg = Touch.target;
      ctx.strokeStyle = 'rgba(255,220,120,.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(wx2sx(tg.x), wy2sy(tg.y), tg.radius * T + 7 + Math.sin(this.time * 5) * 2, 0, 6.29);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // gracz
    this.drawPlayer(ctx, p, wx2sx(p.x), wy2sy(p.y), T);

    // pociski
    for (const pr of s.projectiles) {
      const sx = wx2sx(pr.x), sy = wy2sy(pr.y);
      const r = pr.size * T * 1.4;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
      g.addColorStop(0, pr.color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r * 2, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, r * .5, 0, 6.29); ctx.fill();
    }

    // efekty
    this.drawFx(ctx, T);

    // oświetlenie
    this.drawLighting(map, p, x0, x1, y0, y1);

    // pogoda
    this.drawWeather(dt, map.biome, camX, camY, cw, ch, T);

    // błysk ekranu
    if (Fx.flashA > 0 && Fx.flashCol) {
      ctx.globalAlpha = Fx.flashA;
      ctx.fillStyle = Fx.flashCol;
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalAlpha = 1;
    }

    // winieta
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * .35, cw / 2, ch / 2, ch * .85);
    vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,5,.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
  },

  drawSpecialTile(ctx, t, x, y, sx, sy, map) {
    const T = TILE_SIZE;
    const cx = sx + T / 2, cy = sy + T / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    switch (t) {
      case TILE.STAIRS: {
        ctx.fillStyle = 'rgba(140,90,255,.3)';
        ctx.beginPath(); ctx.arc(cx, cy, T * .42, 0, 6.29); ctx.fill();
        ctx.font = Math.round(T * .62) + 'px serif';
        const spin = this.time * 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin);
        ctx.fillText('🌀', 0, 0);
        ctx.restore();
        break;
      }
      case TILE.CHEST: ctx.font = Math.round(T * .6) + 'px serif'; ctx.fillText('📦', cx, cy); break;
      case TILE.SHRINE: ctx.font = Math.round(T * .6) + 'px serif'; ctx.fillText('⛩️', cx, cy); break;
      case TILE.ALTAR: ctx.font = Math.round(T * .58) + 'px serif'; ctx.fillText('🩸', cx, cy); break;
      case TILE.WELL: ctx.font = Math.round(T * .6) + 'px serif'; ctx.fillText('⛲', cx, cy); break;
      case TILE.SHOP: {
        ctx.font = Math.round(T * .65) + 'px serif';
        ctx.fillText('🧙', cx, cy + Math.sin(this.time * 3) * 2);
        break;
      }
      case TILE.SPIKES: {
        ctx.fillStyle = 'rgba(200,200,210,.7)';
        for (let k = 0; k < 3; k++) {
          const ox = sx + 7 + k * 12;
          ctx.beginPath();
          ctx.moveTo(ox, sy + T - 8); ctx.lineTo(ox + 4, sy + T - 20); ctx.lineTo(ox + 8, sy + T - 8);
          ctx.fill();
        }
        break;
      }
      case TILE.LAVA: {
        const pulse = .75 + Math.sin(this.time * 3 + x + y) * .25;
        ctx.fillStyle = `rgba(230,90,20,${pulse})`;
        ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4);
        ctx.fillStyle = `rgba(255,200,80,${pulse * .5})`;
        ctx.fillRect(sx + 8, sy + 8, T - 16, T - 16);
        break;
      }
      case TILE.POISON: {
        ctx.fillStyle = 'rgba(110,200,60,.45)';
        ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4);
        const b = (this.time * 2 + x * 3 + y * 5) % 1;
        ctx.fillStyle = 'rgba(180,255,120,.5)';
        ctx.beginPath(); ctx.arc(cx + Math.sin(x * 9) * 8, sy + T - b * T, 2.5 * (1 - b), 0, 6.29); ctx.fill();
        break;
      }
      case TILE.ICE: {
        ctx.fillStyle = 'rgba(150,220,255,.3)';
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        ctx.strokeStyle = 'rgba(220,245,255,.4)';
        ctx.beginPath(); ctx.moveTo(sx + 5, sy + T - 8); ctx.lineTo(sx + T - 10, sy + 6); ctx.stroke();
        break;
      }
      case TILE.VOID: {
        ctx.fillStyle = 'rgba(20,5,40,.85)';
        ctx.fillRect(sx, sy, T, T);
        const tw = Math.sin(this.time * 4 + x * 7 + y * 3);
        if (tw > .6) {
          ctx.fillStyle = 'rgba(180,120,255,.8)';
          ctx.fillRect(cx + Math.sin(x * 13) * 10, cy + Math.cos(y * 11) * 10, 2, 2);
        }
        break;
      }
    }
  },

  drawEnemy(ctx, e, sx, sy, T) {
    const bob = Math.sin(this.time * 5 + e.bobPhase) * 2;
    sy += bob;
    let alpha = 1;
    if (e.invisT > 0) alpha = .12;
    ctx.globalAlpha = alpha;

    // podświetlenie elity
    if (e.elite) {
      const col = EnemyDB.eliteAffixes[e.elite].color;
      ctx.strokeStyle = col;
      ctx.globalAlpha = alpha * (.6 + Math.sin(this.time * 5) * .3);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy + 3, e.radius * T + 4, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    // cień
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(sx, sy + e.radius * T * .9, e.radius * T * .8, e.radius * T * .3, 0, 0, 6.29); ctx.fill();

    // bomber tuż przed wybuchem miga
    if (e.state === 'fuse') {
      ctx.globalAlpha = (Math.sin(this.time * 30) > 0) ? 1 : .4;
    }

    const size = e.isBoss ? 1.5 : (e.def_ && e.def_.big ? 1.1 : .78);
    ctx.font = Math.round(T * size * (e.radius / .34) * .8) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.icon, sx, sy);

    // flash trafienia
    if (e.hitFlashT > 0) {
      ctx.globalAlpha = e.hitFlashT * 5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillText(e.icon, sx, sy);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    // pasek HP
    if (e.hp < e.maxHp && !e.isBoss) {
      this.hpBar(ctx, sx, sy - e.radius * T - 8, T * .9, e.hp / e.maxHp, '#e04545', e.hpGhost);
    }
    // nazwa elity
    if (e.elite) {
      ctx.font = '9px sans-serif';
      ctx.fillStyle = EnemyDB.eliteAffixes[e.elite].color;
      ctx.fillText(EnemyDB.eliteAffixes[e.elite].name, sx, sy - e.radius * T - 15);
    }
    // ikony statusów
    let ic = '';
    if (e.statuses.burn) ic += '🔥';
    if (e.statuses.poison) ic += '☠️';
    if (e.statuses.freeze) ic += '🧊';
    else if (e.statuses.chill) ic += '❄️';
    if (e.statuses.stun) ic += '💫';
    if (e.statuses.curse) ic += '🌑';
    if (e.statuses.bleed) ic += '🩸';
    if (e.statuses.root) ic += '🪤';
    if (ic) {
      ctx.font = '11px serif';
      ctx.fillText(ic, sx, sy + e.radius * T + 9);
    }
  },

  drawPlayer(ctx, p, sx, sy, T) {
    if (p.hp <= 0) return;
    const bob = Math.sin(this.time * 6) * 1.5;

    // cień
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(sx, sy + p.radius * T * .95, p.radius * T * .85, p.radius * T * .32, 0, 0, 6.29); ctx.fill();

    // tarcza
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(160,200,255,.7)';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = .5 + Math.sin(this.time * 6) * .2;
      ctx.beginPath(); ctx.arc(sx, sy, p.radius * T + 8, 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // linia celowania (subtelna)
    ctx.globalAlpha = .18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(p.dir) * T * .5, sy + Math.sin(p.dir) * T * .5);
    ctx.lineTo(sx + Math.cos(p.dir) * T * 1.3, sy + Math.sin(p.dir) * T * 1.3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    let alpha = 1;
    if (p.stealthT > 0) alpha = .35;
    else if (p.iframesT > 0) alpha = .55 + Math.sin(this.time * 25) * .3;
    ctx.globalAlpha = alpha;
    ctx.font = Math.round(T * .82) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, sx, sy + bob);
    if (p.hitFlashT > 0) {
      ctx.globalAlpha = p.hitFlashT * 3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillText(p.icon, sx, sy + bob);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    // status na graczu
    let ic = '';
    if (p.statuses.burn) ic += '🔥';
    if (p.statuses.poison) ic += '☠️';
    if (p.statuses.freeze) ic += '🧊'; else if (p.statuses.chill) ic += '❄️';
    if (p.statuses.stun) ic += '💫';
    if (p.statuses.curse) ic += '🌑';
    if (ic) { ctx.font = '12px serif'; ctx.fillText(ic, sx, sy - p.radius * T - 12); }
  },

  hpBar(ctx, x, y, w, pct, color, ghost) {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x - w / 2, y, w, 4);
    if (ghost !== undefined && ghost > pct) {
      ctx.fillStyle = 'rgba(255,140,120,.6)';
      ctx.fillRect(x - w / 2, y, w * ghost, 4);
    }
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, pct), 4);
  },

  drawFx(ctx, T) {
    const wx2sx = this.wx2sx, wy2sy = this.wy2sy;
    // cząsteczki
    for (const p of Fx.parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      const sx = wx2sx(p.x), sy = wy2sy(p.y);
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 2);
        g.addColorStop(0, p.color); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, p.size * 2, 0, 6.29); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    // cięcia
    for (const s of Fx.slashes) {
      const a = s.life / s.maxLife;
      ctx.globalAlpha = a * .8;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4 * a + 1;
      ctx.beginPath();
      ctx.arc(wx2sx(s.x), wy2sy(s.y), s.range * T * .8, s.ang - s.arc / 2, s.ang + s.arc / 2);
      ctx.stroke();
    }
    // promienie
    for (const b of Fx.beams) {
      const a = b.life / b.maxLife;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * a + 1;
      ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(wx2sx(b.x1), wy2sy(b.y1));
      ctx.lineTo(wx2sx(b.x2), wy2sy(b.y2));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // pierścienie
    for (const r of Fx.rings) {
      const a = r.life / r.maxLifeR;
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath(); ctx.arc(wx2sx(r.x), wy2sy(r.y), Math.max(1, r.r * T), 0, 6.29); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // teksty
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of Fx.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `bold ${t.size}px sans-serif`;
      ctx.fillStyle = '#000';
      ctx.fillText(t.str, wx2sx(t.x) + 1.5, wy2sy(t.y) + 1.5);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, wx2sx(t.x), wy2sy(t.y));
    }
    ctx.globalAlpha = 1;
  },

  drawLighting(map, p, x0, x1, y0, y1) {
    const lctx = this.lctx, T = TILE_SIZE;
    const cw = this.light.width, ch = this.light.height;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, cw, ch);
    lctx.fillStyle = 'rgba(2,1,10,.66)';
    lctx.fillRect(0, 0, cw, ch);
    lctx.globalCompositeOperation = 'destination-out';

    const hole = (sx, sy, r, a) => {
      const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(.6, `rgba(0,0,0,${a * .7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(sx, sy, r, 0, 6.29); lctx.fill();
    };

    // światło gracza
    hole(this.wx2sx(p.x), this.wy2sy(p.y), T * 7.5, .96);
    // pochodnie
    for (const tc of map.torches) {
      if (tc.x < x0 || tc.x > x1 || tc.y < y0 || tc.y > y1) continue;
      if (!map.explored[(tc.y | 0) * map.w + (tc.x | 0)]) continue;
      const flick = .5 + Math.sin(this.time * 7 + tc.phase) * .12;
      hole(this.wx2sx(tc.x), this.wy2sy(tc.y) - T * .3, T * 2.2, flick);
    }
    // lawa świeci
    if (map.biome.hazard === TILE.LAVA) {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (map.t[y * map.w + x] === TILE.LAVA && map.explored[y * map.w + x]) {
            hole(this.wx2sx(x + .5), this.wy2sy(y + .5), T * 1.6, .5);
          }
        }
    }
    // pociski świecą
    for (const pr of Game.s.projectiles) {
      hole(this.wx2sx(pr.x), this.wy2sy(pr.y), T * 1.6, .55);
    }

    this.ctx.drawImage(this.light, 0, 0);
  },

  drawWeather(dt, biome, camX, camY, cw, ch, T) {
    const ctx = this.ctx;
    const type = biome.weather;
    const target = type === 'void' ? 40 : 60;
    // dosypuj cząsteczki w obrębie widoku
    while (this.weather.length < target) {
      this.weather.push({
        x: camX + U.rand(-cw / T / 2, cw / T / 2),
        y: camY + U.rand(-ch / T / 2, ch / T / 2),
        vx: 0, vy: 0, phase: Math.random() * 6.28,
        size: U.rand(1.5, 3.5), a: U.rand(.2, .6),
      });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const w of this.weather) {
      switch (type) {
        case 'dust': w.x += Math.sin(this.time + w.phase) * .12 * dt * 8; w.y += dt * .12; ctx.fillStyle = `rgba(180,170,210,${w.a * .5})`; break;
        case 'spores': w.y -= dt * .35; w.x += Math.sin(this.time * 2 + w.phase) * dt * .4; ctx.fillStyle = `rgba(140,224,90,${w.a * .7})`; break;
        case 'snow': w.y += dt * 1.1; w.x += Math.sin(this.time + w.phase) * dt * .7; ctx.fillStyle = `rgba(230,240,255,${w.a})`; break;
        case 'embers': w.y -= dt * .9; w.x += Math.sin(this.time * 3 + w.phase) * dt * .5; ctx.fillStyle = `rgba(255,140,60,${w.a})`; break;
        case 'sparks': ctx.fillStyle = `rgba(200,215,255,${w.a * (0.5 + Math.sin(this.time * 4 + w.phase) * .5)})`; break;
        case 'void': w.y += dt * .25; ctx.fillStyle = `rgba(160,90,255,${w.a * .8})`; break;
      }
      const sx = this.wx2sx(w.x), sy = this.wy2sy(w.y);
      if (sx < -20 || sx > cw + 20 || sy < -20 || sy > ch + 20) {
        w.x = camX + U.rand(-cw / T / 2, cw / T / 2);
        w.y = camY + U.rand(-ch / T / 2, ch / T / 2);
        continue;
      }
      ctx.beginPath(); ctx.arc(sx, sy, w.size, 0, 6.29); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  // ===== MINIMAPA =====
  minimapT: 0,
  drawMinimap(dt) {
    this.minimapT -= dt;
    if (this.minimapT > 0) return;
    this.minimapT = .25;
    const s = Game.s;
    if (!s || !s.map) return;
    const c = U.el('minimap'), ctx = c.getContext('2d');
    const map = s.map;
    const sc = Math.min(c.width / map.w, c.height / map.h);
    ctx.fillStyle = '#0a0714';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        if (!map.explored[i]) continue;
        const t = map.t[i];
        if (t === TILE.WALL) continue;
        ctx.fillStyle = map.visible[i] ? '#4a3f68' : '#2a2340';
        if (t === TILE.STAIRS) ctx.fillStyle = '#a06aff';
        else if (t === TILE.SHOP) ctx.fillStyle = '#e8c368';
        else if (t === TILE.CHEST) ctx.fillStyle = '#c9a85a';
        else if (t === TILE.LAVA) ctx.fillStyle = '#8a3a10';
        ctx.fillRect(x * sc, y * sc, sc + .5, sc + .5);
      }
    // wrogowie w zasięgu wzroku
    ctx.fillStyle = '#e04545';
    for (const e of s.enemies) {
      if (!map.visible[(e.y | 0) * map.w + (e.x | 0)]) continue;
      ctx.fillRect(e.x * sc - 1, e.y * sc - 1, e.isBoss ? 4 : 2, e.isBoss ? 4 : 2);
    }
    // gracz
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.p.x * sc, s.p.y * sc, 2.4, 0, 6.29); ctx.fill();
  },

  drawBigMap() {
    const s = Game.s;
    if (!s || !s.map) return;
    const c = U.el('bigmap');
    const map = s.map;
    const sc = Math.min((window.innerWidth * .8) / map.w, (window.innerHeight * .75) / map.h);
    c.width = map.w * sc; c.height = map.h * sc;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0714';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        if (!map.explored[i]) continue;
        const t = map.t[i];
        if (t === TILE.WALL) { ctx.fillStyle = '#241d38'; }
        else if (t === TILE.STAIRS) ctx.fillStyle = '#a06aff';
        else if (t === TILE.SHOP) ctx.fillStyle = '#e8c368';
        else if (t === TILE.CHEST) ctx.fillStyle = '#c9a85a';
        else if (t === TILE.SHRINE || t === TILE.ALTAR || t === TILE.WELL) ctx.fillStyle = '#7ad8ff';
        else ctx.fillStyle = map.visible[i] ? '#4a3f68' : '#332a50';
        ctx.fillRect(x * sc, y * sc, sc + .5, sc + .5);
      }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.p.x * sc, s.p.y * sc, 4, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  },
};
