'use strict';

// Flow field: BFS od gracza; wrogowie schodzą po gradiencie.
const Path = {
  flow: null,
  flowW: 0, flowH: 0,
  timer: 0,

  compute(map, px, py, maxDist = 30) {
    const w = map.w, h = map.h;
    if (!this.flow || this.flowW !== w || this.flowH !== h) {
      this.flow = new Int16Array(w * h);
      this.flowW = w; this.flowH = h;
    }
    this.flow.fill(-1);
    const sx = px | 0, sy = py | 0;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    const queue = [sx + sy * w];
    this.flow[sx + sy * w] = 0;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const d = this.flow[cur];
      if (d >= maxDist) continue;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = nx + ny * w;
        if (this.flow[ni] !== -1) continue;
        if (!WALKABLE.has(map.t[ni])) continue;
        this.flow[ni] = d + 1;
        queue.push(ni);
      }
    }
  },

  distAt(x, y) {
    x |= 0; y |= 0;
    if (!this.flow || x < 0 || y < 0 || x >= this.flowW || y >= this.flowH) return -1;
    return this.flow[x + y * this.flowW];
  },

  // kierunek w stronę gracza wg pola przepływu (null jeśli brak ścieżki)
  dirToPlayer(map, x, y) {
    const cx = x | 0, cy = y | 0;
    const here = this.distAt(cx, cy);
    if (here < 0) return null;
    let best = here, bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const d = this.distAt(cx + dx, cy + dy);
      if (d >= 0 && d < best) {
        // po skosie tylko gdy oba boki wolne
        if (dx && dy && (!Dungeon.walkable(map, cx + dx, cy) || !Dungeon.walkable(map, cx, cy + dy))) continue;
        best = d; bx = dx; by = dy;
      }
    }
    if (best === here) return null;
    const len = Math.hypot(bx, by) || 1;
    return { x: bx / len, y: by / len };
  },
};
