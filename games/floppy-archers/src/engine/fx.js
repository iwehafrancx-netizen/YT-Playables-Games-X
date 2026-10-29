const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

/**
 * Particles, rings, lightning and pop-up text, all in world space. Kept in
 * plain arrays and drawn straight to the canvas; nothing here touches physics.
 */
export class Fx {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.bolts = [];
    this.flash = 0;
    this.flashColor = '#fff';
  }

  clear() {
    this.parts.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.bolts.length = 0;
    this.flash = 0;
  }

  /** Chips flying off a hit. */
  burst(x, y, { count = 10, colors = ['#fff'], speed = 5, size = 0.06, life = 0.7, gravity = 14, spread = TAU, dir = 0, shape = 'square', drag = 0.98 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const v = speed * rand(0.35, 1);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: size * rand(0.6, 1.3),
        rot: rand(0, TAU),
        spin: rand(-12, 12),
        life: life * rand(0.6, 1.1),
        max: life,
        color: colors[(Math.random() * colors.length) | 0],
        gravity,
        shape,
        drag,
      });
    }
  }

  /** Soft puffs that rise and fade: smoke, poison clouds, dust. */
  puff(x, y, { count = 6, color = 'rgba(255,255,255,0.8)', size = 0.25, speed = 1, life = 0.8, rise = 1.2 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const v = speed * rand(0.2, 1);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + rise, r: size * rand(0.6, 1.2), grow: size * 1.5, rot: 0, spin: 0, life: life * rand(0.7, 1.1), max: life, color, gravity: 0, shape: 'puff', drag: 0.94 });
    }
  }

  ring(x, y, { r = 1.2, color = '#fff', width = 0.08, life = 0.35 } = {}) {
    this.rings.push({ x, y, r, color, width, life, max: life });
  }

  /** A jagged bolt from one point to another. */
  bolt(x0, y0, x1, y1, { color = '#bfe9ff', life = 0.25 } = {}) {
    const pts = [];
    const n = 9;
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const len = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : rand(-0.18, 0.18) * Math.min(1, len / 2);
      pts.push(x0 + (x1 - x0) * t + (nx / len) * j, y0 + (y1 - y0) * t + (ny / len) * j);
    }
    this.bolts.push({ pts, color, life, max: life });
  }

  /** Pop-up text in world space; `size` is in screen pixels. */
  text(x, y, str, { color = '#fff', size = 26, life = 0.9, rise = 1.6, stroke = '#1b1d24' } = {}) {
    this.texts.push({ x, y, str, color, size, life, max: life, rise, stroke });
  }

  screenFlash(amount = 0.5, color = '#fff') {
    this.flash = Math.max(this.flash, amount);
    this.flashColor = color;
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.grow) p.r += p.grow * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.rise * dt * (t.life / t.max);
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  /** World-space layer: particles, rings and bolts. */
  draw(ctx) {
    for (const p of this.parts) {
      const a = Math.min(1, p.life / (p.max * 0.4));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'puff' || p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        star(ctx, p.r);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.25 + 0.75 * easeOut(k)), 0, TAU);
      ctx.stroke();
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = b.life / b.max;
      for (const [w, c] of [
        [0.14, b.color],
        [0.05, '#ffffff'],
      ]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(b.pts[0], b.pts[1]);
        for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Screen-space layer: pop-up text and the full-screen flash. */
  drawScreen(ctx, view) {
    const at = {};
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const age = 1 - t.life / t.max;
      // Pops in big, settles, then fades.
      const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.6 : 1.2 - Math.min(0.2, (age - 0.15) * 1.5);
      view.toScreen(t.x, t.y, at);
      ctx.globalAlpha = Math.min(1, t.life / (t.max * 0.3));
      ctx.font = `${Math.round(t.size * pop)}px "Lilita One", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size * 0.22);
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.str, at.x, at.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, at.x, at.y);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.6;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = 1;
    }
  }
}

export const easeOut = (t) => 1 - (1 - t) * (1 - t);

export function star(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
