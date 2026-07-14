'use strict';

// Pole widzenia: rzucanie promieni do obwodu koła.
const FOV = {
  update(map, px, py, radius) {
    map.visible.fill(0);
    const cx = px | 0, cy = py | 0;
    const setVis = (x, y) => {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
      const i = y * map.w + x;
      map.visible[i] = 1;
      map.explored[i] = 1;
    };
    setVis(cx, cy);
    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      let x = px, y = py;
      for (let d = 0; d < radius; d += .33) {
        x += dx * .33; y += dy * .33;
        const tx = x | 0, ty = y | 0;
        setVis(tx, ty);
        if (Dungeon.tile(map, tx, ty) === TILE.WALL) break;
      }
    }
  },

  isVisible(map, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    return !!map.visible[y * map.w + x];
  },

  // prosta linia widzenia między dwoma punktami
  lineOfSight(map, x1, y1, x2, y2) {
    const d = U.dist(x1, y1, x2, y2);
    if (d < .5) return true;
    const steps = Math.ceil(d * 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = U.lerp(x1, x2, t), y = U.lerp(y1, y2, t);
      if (Dungeon.tile(map, x | 0, y | 0) === TILE.WALL) return false;
    }
    return true;
  },
};
