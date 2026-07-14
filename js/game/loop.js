'use strict';

// Cykl życia wyprawy + główna pętla gry.
Object.assign(Game, {

  start(clsId) {
    Sfx.init();
    Meta.data.stats.runs++;
    Meta.data.classesPlayed[clsId] = true;
    if (Object.keys(Meta.data.classesPlayed).length >= 6) Meta.unlock('all_classes');
    Meta.save();

    this.s = this.newRunState(clsId);
    U.el('title-screen').style.display = 'none';
    U.el('ui-overlay').style.display = 'block';
    this.clearLog();
    Hud.buildSpellBar();

    const biome = BiomeDB.forFloor(1);
    Hud.floorTransition('SERCE OTCHŁANI', biome.name + ' — ' + biome.sub, () => {
      this.loadFloor(1);
      this.msg('⚔️ ' + ClassDB[clsId].name + ' schodzi w Otchłań. Serce czeka na piętrze ' + FINAL_FLOOR + '.', 'sys');
      this.msg('Spacja — unik z nietykalnością. E — interakcje. I — ekwipunek.', 'sys');
    });
  },

  loadFloor(floor) {
    const s = this.s;
    s.floor = floor;
    s.map = Dungeon.generate(floor);
    s.enemies = []; s.minions = []; s.projectiles = [];
    s.drops = []; s.zones = []; s.telegraphs = []; s.traps = [];
    s.boss = null; s.bossDefeated = false;
    s.shopStock = null;
    const p = s.p;
    p.x = s.map.spawn.x; p.y = s.map.spawn.y;
    p.phoenixFloorUsed = false;
    p.statuses = {};
    Fx.reset();
    Renderer.weather = [];
    Enemies.spawnFloor();
    FOV.update(s.map, p.x, p.y, FOV_RADIUS);
    Path.compute(s.map, p.x, p.y);
    Hud.setFloorLabel();

    // osiągnięcia głębokości
    if (floor >= 5) Meta.unlock('floor5');
    if (floor >= 10) Meta.unlock('floor10');
    if (floor >= FINAL_FLOOR) Meta.unlock('floor16');
    if (floor >= FINAL_FLOOR + 5) Meta.unlock('endless5');
    if (floor > Meta.data.stats.deepest) { Meta.data.stats.deepest = floor; Meta.save(); }

    SaveSys.autoSave();
  },

  nextFloor() {
    const s = this.s;
    if (s.map.stairsLocked) { this.msg('🔒 Pokonaj bossa, by zejść niżej!', 'bad'); return; }
    Sfx.play('stairs');
    const next = s.floor + 1;
    const biome = BiomeDB.forFloor(next);
    const isNewBiome = BiomeDB.forFloor(s.floor).id !== biome.id;
    Hud.floorTransition(
      'PIĘTRO ' + next,
      biome.name + (isNewBiome ? ' — ' + biome.sub : ''),
      () => {
        this.loadFloor(next);
        if (isNewBiome) this.msg('🌍 Wkraczasz w: ' + biome.name, 'magic');
        if (EnemyDB.bossFor(next)) this.msg('⚠️ Czujesz potężną obecność na tym piętrze...', 'bad');
      });
  },

  playerDeath(cause) {
    const s = this.s;
    if (s.over) return;
    s.over = true; s.running = false;
    Sfx.play('death');
    Fx.shake(10);
    Fx.flash('#a01010', .4);
    if (s.floor === 1) Meta.unlock('tourist');
    setTimeout(() => {
      U.el('ui-overlay').style.display = 'none';
      Hud.showDeath(cause);
    }, 1200);
  },

  victory() {
    const s = this.s;
    if (s.victory) return;
    s.victory = true;
    Meta.unlock('winner');
    Fx.flash('#fff', .5);
    setTimeout(() => {
      s.paused = true;
      Hud.showWin();
    }, 1800);
  },

  enterEndless() {
    const s = this.s;
    U.el('win-screen').style.display = 'none';
    s.paused = false; s.victory = false; s.endless = true;
    s.over = false; s.running = true;
    const next = FINAL_FLOOR + 1;
    Hud.floorTransition('GŁĘBIA BEZ DNA', 'Nikt nie zszedł niżej. Jeszcze.', () => {
      this.loadFloor(next);
      this.msg('🕳️ Głębia Bez Dna: każde piętro silniejsze o ' + Math.round(BAL.endlessScale * 100) + '%. Boss co 5 pięter.', 'magic');
    });
  },

  loadFromTitle() {
    SettingsUI.toggle();
  },

  loadAndRun(slot) {
    // wyczyść ewentualny stary stan
    this.s = null;
    if (!SaveSys.load(slot)) {
      Hud.saveToast('❌ Nie udało się wczytać zapisu.');
      return;
    }
    U.el('title-screen').style.display = 'none';
    U.el('death-screen').style.display = 'none';
    U.el('ui-overlay').style.display = 'block';
    this.s.paused = false;
    SettingsUI.visible = false;
    U.el('settings-panel').style.display = 'none';
  },

  // ===== GŁÓWNA PĘTLA =====
  lastT: 0,
  fovT: 0,
  pathT: 0,

  loop(t) {
    requestAnimationFrame(tt => Game.loop(tt));
    const dt = Math.min(.05, (t - this.lastT) / 1000 || .016);
    this.lastT = t;

    const s = this.s;
    if (!s || !s.map) return;

    if (s.running && !s.over && !s.paused) {
      s.time += dt;
      Player.update(dt);
      Minions.update(dt);
      Enemies.update(dt);
      Combat.updateProjectiles(dt);
      Combat.updateTelegraphs(dt);
      Combat.updateZones(dt);
      Combat.updateTraps(dt);
      Inv.updateDrops(dt);

      // FOV i pathfinding z ograniczoną częstotliwością
      this.fovT -= dt;
      if (this.fovT <= 0) {
        this.fovT = .12;
        FOV.update(s.map, s.p.x, s.p.y, FOV_RADIUS);
      }
      this.pathT -= dt;
      if (this.pathT <= 0) {
        this.pathT = .35;
        Path.compute(s.map, s.p.x, s.p.y);
      }
      Input.updateWorldMouse();
    }

    Fx.update(dt);
    Renderer.draw(dt);
    Renderer.drawMinimap(dt);
    Hud.update(dt);
  },
});
