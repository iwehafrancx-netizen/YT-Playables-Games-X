// All sound is synthesised with WebAudio, so the bundle carries no audio files.

const MATERIAL_TONE = {
  body: { freq: 140, q: 1.2, noise: 0.55, pitch: 90, decay: 0.14 },
  wood: { freq: 420, q: 3, noise: 0.5, pitch: 210, decay: 0.12 },
  cardboard: { freq: 300, q: 1, noise: 0.8, pitch: 0, decay: 0.09 },
  metal: { freq: 1600, q: 9, noise: 0.25, pitch: 520, decay: 0.35 },
  concrete: { freq: 220, q: 0.9, noise: 0.85, pitch: 70, decay: 0.1 },
  rubber: { freq: 180, q: 2, noise: 0.3, pitch: 140, decay: 0.12 },
  glass: { freq: 3000, q: 12, noise: 0.4, pitch: 1800, decay: 0.3 },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true; // platform audio setting
    this.sfxOn = true;
    this.musicOn = true;
    this.lastImpact = 0;
    this.voices = 0;
    this.loops = new Map();
    this.music = null;
  }

  /** Must run inside a user gesture the first time. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      this.noiseBuf = this.makeNoise();
      this.applyMute();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  makeNoise() {
    const len = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  setEnabled(on) {
    this.enabled = on;
    this.applyMute();
  }

  setSfx(on) {
    this.sfxOn = on;
    this.applyMute();
  }

  setMusic(on) {
    this.musicOn = on;
    this.applyMute();
  }

  applyMute() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.sfxOn ? 1 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, t, 0.1);
  }

  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    if (this.ctx && this.enabled) this.ctx.resume();
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  noise(dur, { freq = 800, q = 1, type = 'bandpass', gain = 0.5, attack = 0.002, sweep = 0, at = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  tone(f1, f2, dur, { type = 'sine', gain = 0.3, attack = 0.004, at = 0, dest } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Physical hit; `strength` 0..1, `material` picks the timbre. */
  impact(strength, material = 'body') {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this.lastImpact < 0.025) return;
    this.lastImpact = now;
    const m = MATERIAL_TONE[material] ?? MATERIAL_TONE.body;
    const s = Math.min(1, strength);
    const dur = m.decay * (0.6 + s);
    this.noise(dur, { freq: m.freq * (0.85 + Math.random() * 0.3), q: m.q, gain: 0.08 + s * 0.5 * m.noise, sweep: 0.5 });
    if (m.pitch) this.tone(m.pitch * (1 + s * 0.3), m.pitch * 0.55, dur * 1.2, { type: 'sine', gain: 0.05 + s * 0.35 });
    if (material === 'body' && s > 0.55) {
      // Plastic "bonk" layered on big body hits
      this.tone(260 + Math.random() * 60, 120, 0.12, { type: 'triangle', gain: 0.18 * s });
    }
  }

  boom() {
    this.noise(0.6, { freq: 900, q: 0.7, type: 'lowpass', gain: 0.9, sweep: 0.08 });
    this.tone(120, 38, 0.45, { type: 'sine', gain: 0.7 });
    this.noise(0.25, { freq: 3000, q: 0.5, type: 'highpass', gain: 0.25, sweep: 0.3 });
  }

  whoosh(strength = 1) {
    this.noise(0.45, { freq: 500, q: 2.5, gain: 0.18 * strength, attack: 0.12, sweep: 3 });
  }

  pop() {
    this.tone(680, 1500, 0.09, { type: 'square', gain: 0.12 });
    this.tone(1200, 2400, 0.12, { type: 'sine', gain: 0.18, at: 0.03 });
    this.noise(0.08, { freq: 4000, q: 1, gain: 0.2 });
  }

  ding(step = 0) {
    const f = 880 * Math.pow(2, (step * 2) / 12);
    this.tone(f, f, 0.5, { type: 'sine', gain: 0.22 });
    this.tone(f * 2, f * 2, 0.35, { type: 'sine', gain: 0.08 });
  }

  coin(step = 0) {
    const f = 988 * Math.pow(2, step / 12);
    this.tone(f, f, 0.08, { type: 'square', gain: 0.08 });
    this.tone(f * 1.335, f * 1.335, 0.3, { type: 'square', gain: 0.08, at: 0.07 });
  }

  jump(big = false) {
    this.tone(big ? 260 : 320, big ? 640 : 560, 0.16, { type: 'triangle', gain: 0.18 });
    this.noise(0.1, { freq: 1800, q: 1, gain: 0.06 });
  }

  click() {
    this.tone(900, 700, 0.05, { type: 'triangle', gain: 0.12 });
  }

  saw() {
    this.noise(0.35, { freq: 3200, q: 6, gain: 0.35, sweep: 0.6 });
    this.tone(180, 70, 0.3, { type: 'sawtooth', gain: 0.2 });
  }

  spring() {
    this.tone(180, 700, 0.25, { type: 'triangle', gain: 0.25 });
    this.tone(360, 1100, 0.2, { type: 'sine', gain: 0.12, at: 0.02 });
  }

  crack() {
    this.noise(0.18, { freq: 2200, q: 3, gain: 0.4, sweep: 0.4 });
    this.tone(500, 160, 0.12, { type: 'square', gain: 0.1 });
  }

  win() {
    [0, 4, 7, 12].forEach((n, i) => {
      const f = 523.25 * Math.pow(2, n / 12);
      this.tone(f, f, 0.35, { type: 'triangle', gain: 0.2, at: i * 0.09 });
    });
    this.tone(1046.5, 1046.5, 0.8, { type: 'sine', gain: 0.12, at: 0.36 });
  }

  lose() {
    [0, -3, -7].forEach((n, i) => {
      const f = 392 * Math.pow(2, n / 12);
      this.tone(f, f * 0.98, 0.3, { type: 'triangle', gain: 0.18, at: i * 0.14 });
    });
  }

  star(i) {
    const f = [784, 988, 1175][i] ?? 1175;
    this.tone(f, f, 0.4, { type: 'sine', gain: 0.25 });
    this.tone(f * 2, f * 2, 0.25, { type: 'triangle', gain: 0.08 });
  }

  /** Continuous sound whose level follows `amount` 0..1 (cart wheels, wind). */
  loop(name, amount, kind = 'rumble') {
    if (!this.ready) return;
    let l = this.loops.get(name);
    if (!l) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = kind === 'wind' ? 'bandpass' : 'lowpass';
      f.frequency.value = kind === 'wind' ? 700 : 260;
      f.Q.value = kind === 'wind' ? 0.8 : 1.5;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.sfx);
      src.start();
      l = { src, f, g, kind };
      this.loops.set(name, l);
    }
    const t = this.ctx.currentTime;
    const a = Math.max(0, Math.min(1, amount));
    l.g.gain.setTargetAtTime(a * (l.kind === 'wind' ? 0.25 : 0.35), t, 0.05);
    l.f.frequency.setTargetAtTime((l.kind === 'wind' ? 400 : 120) + a * (l.kind === 'wind' ? 1400 : 500), t, 0.05);
  }

  stopLoops() {
    for (const l of this.loops.values()) {
      try {
        l.src.stop();
      } catch {
        // already stopped
      }
    }
    this.loops.clear();
  }

  /** Light, looping lab-funk groove built from a step sequencer. */
  startMusic() {
    if (!this.ready || this.music) return;
    const bpm = 104;
    const step = 60 / bpm / 4;
    const bass = [36, 0, 36, 0, 43, 0, 0, 41, 36, 0, 36, 0, 39, 0, 41, 0];
    const chords = [[60, 63, 67], [58, 62, 65], [56, 60, 63], [58, 62, 67]];
    let i = 0;
    let next = this.ctx.currentTime + 0.1;
    const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const tick = () => {
      if (!this.music) return;
      while (next < this.ctx.currentTime + 0.25) {
        const s = i % 16;
        const bar = Math.floor(i / 16) % 4;
        const at = next - this.ctx.currentTime;
        const b = bass[s];
        if (b) this.tone(mtof(b + (bar === 2 ? -4 : bar === 3 ? -2 : 0)), mtof(b) * 0.99, step * 1.8, { type: 'triangle', gain: 0.32, at, dest: this.musicBus });
        if (s % 4 === 0) this.musicHat(at, 0.05, 2000);
        if (s % 4 === 2) this.musicHat(at, 0.12, 6000);
        if (s === 4 || s === 12) this.musicSnare(at);
        if (s === 0 || s === 10) {
          for (const n of chords[bar]) this.tone(mtof(n), mtof(n), step * 3, { type: 'sine', gain: 0.05, at, attack: 0.02, dest: this.musicBus });
        }
        next += step;
        i++;
      }
      this.music = setTimeout(tick, 60);
    };
    this.music = setTimeout(tick, 0);
  }

  musicHat(at, gain, freq) {
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }

  musicSnare(at) {
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.15);
  }

  stopMusic() {
    clearTimeout(this.music);
    this.music = null;
  }
}
