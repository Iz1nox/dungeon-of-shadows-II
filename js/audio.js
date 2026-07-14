'use strict';

// Syntezowany dźwięk przez WebAudio — bez żadnych plików
const Sfx = {
  ctx: null,
  master: null,
  volume: .5,
  enabled: true,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  },

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  },

  // pojedynczy ton
  tone(freq, dur, type = 'square', vol = .18, slide = 0, delay = 0) {
    if (!this.ctx || !this.enabled || this.volume <= 0) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + .02);
  },

  // szum (eksplozje, trafienia)
  noise(dur, vol = .2, freq = 800, delay = 0) {
    if (!this.ctx || !this.enabled || this.volume <= 0) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  play(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'hit':      this.noise(.08, .16, 1400); this.tone(160, .07, 'square', .1, -60); break;
      case 'crit':     this.noise(.1, .2, 2200); this.tone(320, .1, 'square', .14, -140); this.tone(480, .08, 'square', .1, -200, .03); break;
      case 'hurt':     this.tone(140, .18, 'sawtooth', .16, -70); this.noise(.12, .14, 700); break;
      case 'shoot':    this.tone(620, .09, 'square', .08, -320); break;
      case 'magic':    this.tone(520, .14, 'sine', .12, 260); this.tone(780, .12, 'sine', .08, 180, .04); break;
      case 'explode':  this.noise(.4, .3, 400); this.tone(90, .3, 'sawtooth', .16, -40); break;
      case 'dash':     this.tone(300, .1, 'sine', .1, 420); break;
      case 'pickup':   this.tone(660, .07, 'sine', .1); this.tone(880, .09, 'sine', .1, 0, .06); break;
      case 'gold':     this.tone(1050, .06, 'triangle', .09); this.tone(1400, .07, 'triangle', .07, 0, .05); break;
      case 'potion':   this.tone(440, .1, 'sine', .1, 120); this.tone(660, .12, 'sine', .09, 120, .08); break;
      case 'levelup':  [440, 554, 659, 880].forEach((f, i) => this.tone(f, .22, 'triangle', .13, 0, i * .09)); break;
      case 'stairs':   this.tone(300, .3, 'sine', .12, -160); this.tone(200, .35, 'sine', .1, -100, .12); break;
      case 'death':    this.tone(220, .7, 'sawtooth', .2, -170); this.noise(.6, .18, 300, .1); break;
      case 'bossroar': this.tone(90, .7, 'sawtooth', .25, -35); this.noise(.55, .22, 260, .06); break;
      case 'bossdie':  this.noise(.9, .3, 500); [180, 140, 100].forEach((f, i) => this.tone(f, .5, 'sawtooth', .18, -50, i * .18)); break;
      case 'freeze':   this.tone(1500, .16, 'sine', .1, -700); break;
      case 'burn':     this.noise(.2, .12, 900); break;
      case 'heal':     this.tone(520, .18, 'sine', .1, 200); this.tone(780, .2, 'sine', .08, 160, .1); break;
      case 'buff':     this.tone(400, .14, 'triangle', .11, 250); this.tone(600, .16, 'triangle', .09, 250, .08); break;
      case 'curse':    this.tone(260, .3, 'sawtooth', .12, -120); break;
      case 'click':    this.tone(700, .04, 'square', .06); break;
      case 'error':    this.tone(180, .12, 'square', .1, -40); break;
      case 'chest':    this.tone(500, .1, 'triangle', .1); this.tone(750, .12, 'triangle', .1, 0, .09); this.tone(1000, .14, 'triangle', .09, 0, .18); break;
      case 'mimic':    this.tone(200, .25, 'sawtooth', .16, -80); this.noise(.2, .14, 800, .05); break;
      case 'trap':     this.noise(.14, .18, 2000); this.tone(240, .1, 'square', .12, -100); break;
      case 'summon':   this.tone(330, .22, 'sine', .11, -140); this.tone(220, .26, 'sine', .1, -90, .08); break;
      case 'achieve':  [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .2, 'sine', .11, 0, i * .1)); break;
      case 'forge':    this.tone(880, .08, 'square', .1, -200); this.noise(.1, .12, 3000, .04); this.tone(1200, .1, 'triangle', .08, -300, .08); break;
      case 'ult':      this.tone(160, .5, 'sawtooth', .18, 200); [440, 660, 880].forEach((f, i) => this.tone(f, .3, 'triangle', .1, 0, .1 + i * .08)); break;
      case 'telegraph':this.tone(320, .2, 'sine', .07, -80); break;
    }
  },
};
