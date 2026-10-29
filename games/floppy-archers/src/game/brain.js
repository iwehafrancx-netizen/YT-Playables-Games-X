import { ARROW_G } from './arrows.js';

const D2R = Math.PI / 180;

/** Low-arc launch angle that lands at `dx` across and `dy` up at `speed`; null if out of reach. */
export function solve(dx, dy, speed) {
  const v2 = speed * speed;
  const disc = v2 * v2 - ARROW_G * (ARROW_G * dx * dx + 2 * dy * v2);
  if (disc < 0) return null;
  return Math.atan2(v2 - Math.sqrt(disc), ARROW_G * dx);
}

/**
 * A computer archer's mind: wait, draw towards a firing solution with some
 * wobble in it, let go, and now and then hop over an arrow heading its way.
 */
export class Brain {
  constructor(def, rand = Math.random) {
    this.def = def;
    this.rand = rand;
    this.state = 'wait';
    this.t = 1.2 + rand() * 1.2;
    this.volley = 0;
    this.seen = new WeakSet();
  }

  /** Called every frame; `shoot(archer)` fires the archer's arrow(s) at its current aim. */
  think(archer, target, dt, shoot) {
    const def = this.def;
    if (!archer.canShoot || !target?.alive) {
      archer.draw = 0;
      if (archer.stun > 0 && this.state !== 'wait') {
        this.state = 'wait';
        this.t = 0.6;
      }
      return;
    }
    this.t -= dt;
    if (this.state === 'wait') {
      if (this.t > 0) return;
      const from = archer.muzzle();
      const aimHead = this.rand() < 0.25;
      const to = aimHead ? target.headPos() : target.chest();
      const ideal = solve(Math.abs(to.x - from.x), to.y - from.y, def.speed) ?? 40 * D2R;
      this.goal = ideal + (this.rand() - 0.5) * 2 * def.err;
      this.from = archer.angle;
      this.state = 'draw';
      this.t = this.dur = def.draw ?? 0.9;
      this.volley = def.burst ?? 1;
    } else if (this.state === 'draw') {
      const k = 1 - Math.max(0, this.t) / this.dur;
      archer.aim(this.from + (this.goal - this.from) * Math.min(1, k * 1.5), k);
      if (this.t > 0) return;
      this.loose(archer, shoot);
    } else if (this.state === 'burst' && this.t <= 0) {
      archer.aim(this.goal + (this.rand() - 0.5) * def.err, 1);
      this.loose(archer, shoot);
    }
  }

  loose(archer, shoot) {
    shoot(archer);
    archer.draw = 0;
    this.volley--;
    if (this.volley > 0) {
      this.state = 'burst';
      this.t = 0.25;
    } else {
      this.state = 'wait';
      const [a, b] = this.def.rate;
      this.t = a + this.rand() * (b - a);
    }
  }

  /** Looks at incoming arrows and maybe jumps one. */
  dodge(archer, arrows) {
    const chance = this.def.dodge ?? 0;
    if (!chance || !archer.alive || archer.airborne) return false;
    const c = archer.chest();
    for (const a of arrows) {
      if (a.spent || a.owner === archer || a.owner?.team === archer.team || this.seen.has(a)) continue;
      const t = (c.x - a.x) / a.vx;
      if (!(t > 0.1 && t < 0.45)) continue;
      this.seen.add(a);
      const y = a.y + a.vy * t - 0.5 * ARROW_G * t * t;
      if (Math.abs(y - c.y) < 1.1 && this.rand() < chance) return archer.jump(7.5);
    }
    return false;
  }
}
