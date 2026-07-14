'use strict';

// Klawiatura + mysz.
const Input = {
  mapOpen: false,

  init() {
    window.addEventListener('keydown', e => this.keyDown(e));
    window.addEventListener('keyup', e => { Game.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { Game.keys = {}; Game.mouse.down = false; });

    const cv = Renderer.canvas;
    window.addEventListener('mousemove', e => {
      const m = Game.mouse;
      m.x = e.clientX; m.y = e.clientY;
      this.updateWorldMouse();
    });
    cv.addEventListener('mousedown', e => {
      Sfx.init();
      if (e.button === 0) Game.mouse.down = true;
      if (e.button === 2) Game.mouse.rdown = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) Game.mouse.down = false;
      if (e.button === 2) Game.mouse.rdown = false;
    });
    window.addEventListener('contextmenu', e => {
      if (e.target === cv) e.preventDefault();
    });
  },

  updateWorldMouse() {
    const m = Game.mouse;
    m.wx = (m.x - Renderer.canvas.width / 2) / TILE_SIZE + Game.cam.x;
    m.wy = (m.y - Renderer.canvas.height / 2) / TILE_SIZE + Game.cam.y;
  },

  keyDown(e) {
    const k = e.key.toLowerCase();
    Game.keys[k] = true;
    Sfx.init();

    // Esc — zamykanie paneli / pauza
    if (k === 'escape') {
      e.preventDefault();
      if (Shop.visible) { Shop.close(); return; }
      if (InvUI.visible) { InvUI.toggle(); return; }
      if (this.mapOpen) { this.toggleMap(); return; }
      if (U.el('meta-panel').style.display === 'block' && Game.alive()) { MetaUI.close(); return; }
      if (Game.alive() || SettingsUI.visible) SettingsUI.toggle();
      return;
    }

    if (!Game.alive()) return;

    // Tab — mapa
    if (k === 'tab') {
      e.preventDefault();
      this.toggleMap();
      return;
    }

    // panele otwarte → ignoruj resztę
    if (Game.s.paused && !this.mapOpen) {
      if (k === 'i' && InvUI.visible) InvUI.toggle();
      return;
    }

    switch (k) {
      case ' ': e.preventDefault(); Player.dash(); break;
      case '1': case '2': case '3': case '4': case '5':
        Skills.cast(+k - 1); break;
      case 'e': Events.interact(); break;
      case 'q': Inv.quickUse('hp'); break;
      case 'r': Inv.quickUse('mp'); break;
      case 'i': InvUI.toggle(); break;
    }
  },

  toggleMap() {
    this.mapOpen = !this.mapOpen;
    U.el('map-overlay').style.display = this.mapOpen ? 'flex' : 'none';
    if (Game.s) Game.s.paused = this.mapOpen;
    if (this.mapOpen) Renderer.drawBigMap();
  },
};
