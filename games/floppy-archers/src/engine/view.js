const lerp = (a, b, k) => a + (b - a) * k;

/**
 * The canvas and the camera. World units are metres with y pointing up; the
 * camera eases towards whatever box `frame` asks for, so the shot always sits
 * close on the archers whichever way the screen is turned.
 */
export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.cam = { x: 0, y: 0, s: 40 };
    this.goal = { x: 0, y: 0, s: 40 };
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.kick = 0; // brief zoom punch, as a fraction of scale
    this.ox = 0;
    this.oy = 0;
    this.resize();
  }

  get portrait() {
    return this.h > this.w;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    return true;
  }

  /**
   * Aims the camera at a world box. `pad` is screen space kept clear for the
   * HUD ([top, right, bottom, left] in px); `maxS` caps how close it gets.
   */
  frame(x0, y0, x1, y1, { pad = [70, 20, 20, 20], maxS = Infinity, snap = false } = {}) {
    const [pt, pr, pb, pl] = pad;
    const aw = Math.max(40, this.w - pl - pr);
    const ah = Math.max(40, this.h - pt - pb);
    const s = Math.min(aw / (x1 - x0), ah / (y1 - y0), maxS);
    // Centre the box inside the padded area.
    const g = this.goal;
    g.s = s;
    g.x = (x0 + x1) / 2 - (pl - pr) / 2 / s;
    g.y = (y0 + y1) / 2 - (pb - pt) / 2 / s;
    if (snap) Object.assign(this.cam, g);
  }

  shake(amount, time = 0.3) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = Math.max(this.shakeT, time);
  }

  punch(amount) {
    this.kick = Math.max(this.kick, amount);
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 3.2);
    const c = this.cam;
    c.x = lerp(c.x, this.goal.x, k);
    c.y = lerp(c.y, this.goal.y, k);
    c.s = lerp(c.s, this.goal.s, k);
    this.kick *= Math.exp(-dt * 7);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.min(1, this.shakeT * 4);
      this.ox = (Math.random() - 0.5) * 2 * a;
      this.oy = (Math.random() - 0.5) * 2 * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    } else {
      this.ox = this.oy = 0;
    }
  }

  get scale() {
    return this.cam.s * (1 + this.kick);
  }

  /** Switches the context to world space (metres, y up). */
  world() {
    const s = this.scale * this.dpr;
    const c = this.cam;
    this.ctx.setTransform(s, 0, 0, -s, (this.w / 2 + this.ox) * this.dpr - c.x * s, (this.h / 2 + this.oy) * this.dpr + c.y * s);
  }

  /** Switches the context to screen space (CSS pixels, y down). */
  screen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  toScreen(x, y, out = {}) {
    const s = this.scale;
    out.x = (x - this.cam.x) * s + this.w / 2 + this.ox;
    out.y = (this.cam.y - y) * s + this.h / 2 + this.oy;
    return out;
  }

  toWorld(px, py, out = {}) {
    const s = this.scale;
    out.x = (px - this.w / 2 - this.ox) / s + this.cam.x;
    out.y = this.cam.y - (py - this.h / 2 - this.oy) / s;
    return out;
  }

  /** The world rectangle currently on screen. */
  bounds() {
    const s = this.scale;
    const hw = this.w / 2 / s;
    const hh = this.h / 2 / s;
    return { x0: this.cam.x - hw, x1: this.cam.x + hw, y0: this.cam.y - hh, y1: this.cam.y + hh };
  }
}
