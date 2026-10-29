const TAU = Math.PI * 2;

// What each fruit gives when an arrow goes through it.
export const FRUIT = {
  red: { color: '#e23b35', label: '+30 HP', weight: 4 },
  green: { color: '#7ccf3a', label: '+50 STAMINA', weight: 4 },
  gold: { color: '#ffc81f', label: '+5 SKULLS', weight: 2, flies: true },
};

function pick(rand) {
  const total = Object.values(FRUIT).reduce((n, f) => n + f.weight, 0);
  let r = rand() * total;
  for (const [kind, f] of Object.entries(FRUIT)) if ((r -= f.weight) < 0) return kind;
  return 'red';
}

/**
 * Apples bobbing in the air between the archers. Red heals, green tops up
 * stamina; the golden one with wings is worth skulls but flies off.
 */
export class Orchard {
  constructor() {
    this.items = [];
    this.wait = 3;
    this.area = { x0: 0, x1: 1, y0: 0, y1: 1 };
  }

  spawn(rand = Math.random) {
    const kind = pick(rand);
    const { x0, x1, y0, y1 } = this.area;
    const flies = FRUIT[kind].flies;
    const x = flies ? x1 + 1 : x0 + (x1 - x0) * (0.25 + rand() * 0.5);
    const y = y0 + (y1 - y0) * rand();
    this.items.push({ kind, x, y, bx: x, by: y, r: 0.24, t: 0, phase: rand() * 6, life: flies ? 10 : 14, grow: 0 });
  }

  update(dt, active) {
    if (active) {
      this.wait -= dt;
      if (this.wait <= 0 && this.items.length < 2) {
        this.spawn();
        this.wait = 5 + Math.random() * 5;
      }
    }
    for (const it of this.items) {
      it.t += dt;
      it.life -= dt;
      it.grow = Math.min(1, it.grow + dt * 3);
      if (FRUIT[it.kind].flies) {
        it.x = it.bx - it.t * 1.6;
        it.y = it.by + Math.sin(it.t * 3 + it.phase) * 0.4;
        if (it.x < this.area.x0 - 1) it.gone = true;
      } else {
        it.y = it.by + Math.sin(it.t * 1.8 + it.phase) * 0.2;
      }
      if (it.life <= 0) it.gone = true;
    }
    this.items = this.items.filter((i) => !i.gone);
  }

  draw(ctx) {
    for (const it of this.items) {
      const f = FRUIT[it.kind];
      const s = it.grow * Math.min(1, it.life * 2);
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(s, s);
      ctx.rotate(Math.sin(it.t * 1.3 + it.phase) * 0.2);
      if (f.flies) {
        const flap = Math.sin(it.t * 20) * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1b1d24';
        ctx.lineWidth = 0.02;
        for (const sd of [1, -1]) {
          ctx.save();
          ctx.rotate(sd * (0.3 + flap));
          ctx.beginPath();
          ctx.ellipse(sd * 0.3, 0.12, 0.22, 0.09, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = 'rgba(255,240,150,0.9)';
        ctx.lineWidth = 0.035;
        ctx.beginPath();
        ctx.ellipse(0, 0.36, 0.14, 0.04, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = '#1b1d24';
      ctx.beginPath();
      ctx.arc(0, 0, it.r + 0.025, 0, TAU);
      ctx.fill();
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(-0.06, 0, it.r * 0.8, 0, TAU);
      ctx.arc(0.06, 0, it.r * 0.8, 0, TAU);
      ctx.arc(0, -0.02, it.r * 0.9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(-0.08, 0.08, 0.06, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#5a3a1e';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(0, it.r * 0.8);
      ctx.lineTo(0.03, it.r + 0.1);
      ctx.stroke();
      ctx.fillStyle = '#3e8f2e';
      ctx.beginPath();
      ctx.ellipse(0.11, it.r + 0.06, 0.09, 0.04, 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}
