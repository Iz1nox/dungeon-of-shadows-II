'use strict';

// Proceduralny generator pięter: pokoje + korytarze, zagrożenia biomu,
// eventy mapowe, areny bossów.
const Dungeon = {
  idx(map, x, y) { return y * map.w + x; },

  tile(map, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return TILE.WALL;
    return map.t[y * map.w + x];
  },

  set(map, x, y, v) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
    map.t[y * map.w + x] = v;
  },

  walkable(map, x, y) {
    return WALKABLE.has(this.tile(map, x, y));
  },

  // kolizja koła z siatką ścian
  circleFree(map, x, y, r) {
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (WALKABLE.has(this.tile(map, tx, ty))) continue;
        const cx = U.clamp(x, tx, tx + 1), cy = U.clamp(y, ty, ty + 1);
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return false;
      }
    return true;
  },

  generate(floor) {
    const biome = BiomeDB.forFloor(floor);
    const isBossFloor = !!EnemyDB.bossFor(floor);
    const isFinal = floor === FINAL_FLOOR;
    const map = {
      w: MAP_W, h: MAP_H, floor, biome,
      t: new Uint8Array(MAP_W * MAP_H),
      explored: new Uint8Array(MAP_W * MAP_H),
      visible: new Uint8Array(MAP_W * MAP_H),
      deco: [], rooms: [], torches: [],
      spawn: null, stairs: null, bossRoom: null,
      stairsLocked: isBossFloor && !isFinal,
      usedEvents: {},
    };
    map.t.fill(TILE.WALL);

    if (isFinal) { this.generateFinalArena(map); }
    else { this.generateRooms(map, isBossFloor); }

    this.decorate(map, biome);
    return map;
  },

  carveRoom(map, r) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) this.set(map, x, y, TILE.FLOOR);
  },

  carveCorridor(map, x1, y1, x2, y2) {
    const wide = U.chance(.4) ? 1 : 0;
    let x = x1, y = y1;
    const hFirst = U.chance(.5);
    const carve = (cx, cy) => {
      for (let dy = 0; dy <= wide; dy++)
        for (let dx = 0; dx <= wide; dx++) this.set(map, cx + dx, cy + dy, TILE.FLOOR);
    };
    if (hFirst) {
      while (x !== x2) { carve(x, y); x += Math.sign(x2 - x); }
      while (y !== y2) { carve(x, y); y += Math.sign(y2 - y); }
    } else {
      while (y !== y2) { carve(x, y); y += Math.sign(y2 - y); }
      while (x !== x2) { carve(x, y); x += Math.sign(x2 - x); }
    }
    carve(x, y);
  },

  generateRooms(map, isBossFloor) {
    const nRooms = U.randi(10, 14);
    let tries = 0;
    while (map.rooms.length < nRooms && tries++ < 300) {
      const w = U.randi(6, 12), h = U.randi(5, 10);
      const x = U.randi(2, map.w - w - 3), y = U.randi(2, map.h - h - 3);
      const r = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
      if (map.rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
      map.rooms.push(r);
      this.carveRoom(map, r);
    }
    // połącz kolejne pokoje + kilka dodatkowych pętli
    for (let i = 1; i < map.rooms.length; i++) {
      const a = map.rooms[i - 1], b = map.rooms[i];
      this.carveCorridor(map, a.cx, a.cy, b.cx, b.cy);
    }
    for (let i = 0; i < 2 && map.rooms.length > 4; i++) {
      const a = U.choice(map.rooms), b = U.choice(map.rooms);
      if (a !== b) this.carveCorridor(map, a.cx, a.cy, b.cx, b.cy);
    }

    // spawn w pierwszym pokoju, schody / boss w najdalszym
    const start = map.rooms[0];
    map.spawn = { x: start.cx + .5, y: start.cy + .5 };
    let far = null, fd = -1;
    for (const r of map.rooms) {
      const d = U.dist2(start.cx, start.cy, r.cx, r.cy);
      if (d > fd) { fd = d; far = r; }
    }
    map.bossRoom = far;
    map.stairs = { x: far.cx, y: far.cy };
    if (!isBossFloor) this.set(map, far.cx, far.cy, TILE.STAIRS);

    this.placeHazards(map);
    this.placeEvents(map, isBossFloor);
  },

  generateFinalArena(map) {
    // wielka okrągła arena Serca
    const cx = Math.floor(map.w / 2), cy = Math.floor(map.h / 2), R = 17;
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < R) this.set(map, x, y, TILE.FLOOR);
      }
    // pierścień pustki przy krawędzi
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < R && d > R - 1.6) this.set(map, x, y, TILE.VOID);
      }
    // korytarz wejściowy od dołu
    for (let y = cy + R - 1; y < Math.min(map.h - 2, cy + R + 8); y++) {
      this.set(map, cx, y, TILE.FLOOR); this.set(map, cx - 1, y, TILE.FLOOR); this.set(map, cx + 1, y, TILE.FLOOR);
    }
    map.rooms.push({ x: cx - R, y: cy - R, w: R * 2, h: R * 2, cx, cy });
    map.spawn = { x: cx + .5, y: cy + R + 5.5 };
    map.bossRoom = map.rooms[0];
    map.stairs = { x: cx, y: cy };
  },

  placeHazards(map) {
    const biome = map.biome;
    if (!biome.hazardChance) return;
    // plamy zagrożeń w losowych pokojach (nie w startowym)
    for (let i = 1; i < map.rooms.length; i++) {
      if (!U.chance(biome.hazardChance * 6)) continue;
      const r = map.rooms[i];
      if (r === map.bossRoom) continue;
      const px = U.randi(r.x + 1, r.x + r.w - 2), py = U.randi(r.y + 1, r.y + r.h - 2);
      const size = U.randi(1, 2);
      for (let y = py - size; y <= py + size; y++)
        for (let x = px - size; x <= px + size; x++) {
          if (this.tile(map, x, y) === TILE.FLOOR && U.chance(.7) &&
              U.dist2(x, y, map.spawn.x, map.spawn.y) > 16) {
            this.set(map, x, y, biome.hazard);
          }
        }
    }
  },

  placeEvents(map, isBossFloor) {
    const floor = map.floor;
    const spots = [];
    // kandydaci: środki pokoi (bez startowego i bossa)
    for (let i = 1; i < map.rooms.length; i++) {
      const r = map.rooms[i];
      if (r === map.bossRoom) continue;
      spots.push(r);
    }
    const shuffled = U.shuffle(spots);
    let si = 0;
    const take = () => shuffled[si++];

    const put = (tile, dx = 0, dy = 0) => {
      const r = take();
      if (!r) return null;
      const x = U.clamp(r.cx + dx, r.x + 1, r.x + r.w - 2);
      const y = U.clamp(r.cy + dy, r.y + 1, r.y + r.h - 2);
      this.set(map, x, y, tile);
      return { x, y };
    };

    // skrzynie 1-2
    const nChests = U.randi(1, 2);
    for (let i = 0; i < nChests; i++) put(TILE.CHEST, U.randi(-2, 2), U.randi(-1, 1));
    // kapliczka / ołtarz / studnia
    if (U.chance(.55)) put(TILE.SHRINE);
    if (U.chance(.4)) put(TILE.ALTAR);
    if (U.chance(.45)) put(TILE.WELL);
    // sklep
    if (SHOP_FLOORS.includes(floor)) {
      const s = put(TILE.SHOP);
      if (s) map.shopPos = s;
    }
  },

  decorate(map, biome) {
    // dekoracje wizualne + pochodnie na ścianach
    for (let y = 1; y < map.h - 1; y++)
      for (let x = 1; x < map.w - 1; x++) {
        const t = this.tile(map, x, y);
        if (t === TILE.FLOOR && U.chance(.025)) {
          map.deco.push({ x: x + U.rand(.2, .8), y: y + U.rand(.2, .8), icon: U.choice(biome.deco), s: U.rand(.5, .85) });
        }
        // pochodnia: ściana ze wschodnią/południową podłogą
        if (t === TILE.WALL && this.tile(map, x, y + 1) === TILE.FLOOR && U.chance(.05)) {
          map.torches.push({ x: x + .5, y: y + .92, phase: Math.random() * 6.28 });
        }
      }
  },

  // wolne pole do spawnu (z dala od gracza)
  freeSpot(map, minDistFromSpawn = 8) {
    for (let i = 0; i < 200; i++) {
      const r = U.choice(map.rooms);
      const x = U.randi(r.x + 1, r.x + r.w - 2) + .5;
      const y = U.randi(r.y + 1, r.y + r.h - 2) + .5;
      if (this.tile(map, x | 0, y | 0) !== TILE.FLOOR) continue;
      if (U.dist(x, y, map.spawn.x, map.spawn.y) < minDistFromSpawn) continue;
      return { x, y };
    }
    return { x: map.spawn.x, y: map.spawn.y };
  },

  freeSpotNear(map, cx, cy, radius = 3) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = U.rand(.5, radius);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (this.circleFree(map, x, y, .3)) return { x, y };
    }
    return { x: cx, y: cy };
  },
};
