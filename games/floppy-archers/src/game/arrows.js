import { STEP, segSeg, segRect } from '../engine/physics.js';
import { ARROW_LEN, drawArrowShape } from './draw.js';

export const ARROW_G = 10;
const CLASH_R = 0.3;
const MAX_STUCK = 70;

/**
 * Every arrow, flying or stuck. A flying arrow is a point (its tip) on a
 * ballistic arc; each step the swept segment is tested against bodies,
 * solids and fruit, and the first thing it meets decides what happens.
 */
export class Arrows {
  constructor(match) {
    this.match = match;
    this.flying = [];
    this.stuck = [];
  }

  fire({ x, y, vx, vy, owner, type = 'basic', damage, fx = {} }) {
    const a = { x, y, vx, vy, owner, type, damage, fx, age: 0, spent: false, trail: [] };
    this.flying.push(a);
    return a;
  }

  step() {
    const m = this.match;
    for (const a of this.flying) {
      a.age += STEP;
      const x0 = a.x;
      const y0 = a.y;
      a.vy -= ARROW_G * STEP;
      a.x += a.vx * STEP;
      a.y += a.vy * STEP;
      const hit = this.firstHit(a, x0, y0);
      if (hit) {
        a.x = x0 + (a.x - x0) * hit.s;
        a.y = y0 + (a.y - y0) * hit.s;
        a.done = true;
        if (hit.archer) m.onArrowHit(a, hit.archer, hit.bone, hit.t);
        else if (hit.fruit) {
          a.done = false;
          m.onFruit(a, hit.fruit);
          continue;
        } else m.onArrowSolid(a, hit.solid);
        continue;
      }
      if (a.age > 7 || a.y < -15) a.done = true;
    }
    this.clash();
    this.flying = this.flying.filter((a) => !a.done);
  }

  firstHit(a, x0, y0) {
    const m = this.match;
    let best = null;
    const consider = (h) => {
      if (!best || h.s < best.s) best = h;
    };
    // The shaft trails the tip, so test the swept tip segment only.
    for (const ar of m.archers) {
      if (ar === a.owner && a.age < 0.4) continue;
      const pts = ar.ragdoll.points;
      for (const bone of ar.bones) {
        const pa = pts[bone.a];
        const pb = pts[bone.b];
        const r = segSeg(x0, y0, a.x, a.y, pa.x, pa.y, pb.x, pb.y);
        if (r.d < bone.r) consider({ s: r.s, archer: ar, bone, t: r.t });
      }
    }
    for (const s of m.solids) {
      if (s.kind === 'ground' && a.y > 0.05) continue;
      const t = segRect(x0, y0, a.x, a.y, s);
      if (t !== null) consider({ s: t, solid: s });
    }
    if (!a.spent && a.owner?.human) {
      for (const f of m.fruit.items) {
        if (f.gone) continue;
        const r = segSeg(x0, y0, a.x, a.y, f.x, f.y, f.x, f.y);
        if (r.d < f.r + 0.06) consider({ s: r.s, fruit: f });
      }
    }
    return best;
  }

  /** Arrows from different archers that meet knock each other out of the air. */
  clash() {
    const live = this.flying.filter((a) => !a.spent && !a.done);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (a.owner?.team === b.owner?.team || a.spent || b.spent) continue;
        // Compare shaft midpoints so near-misses along the shaft count too.
        const ax = a.x - (a.vx / Math.hypot(a.vx, a.vy)) * ARROW_LEN * 0.4;
        const ay = a.y - (a.vy / Math.hypot(a.vx, a.vy)) * ARROW_LEN * 0.4;
        const bx = b.x - (b.vx / Math.hypot(b.vx, b.vy)) * ARROW_LEN * 0.4;
        const by = b.y - (b.vy / Math.hypot(b.vx, b.vy)) * ARROW_LEN * 0.4;
        if (Math.hypot(ax - bx, ay - by) > CLASH_R) continue;
        for (const x of [a, b]) {
          x.spent = true;
          x.vx = -x.vx * 0.15 + (Math.random() - 0.5) * 3;
          x.vy = 3 + Math.random() * 3;
        }
        this.match.onClash((ax + bx) / 2, (ay + by) / 2);
      }
    }
  }

  /** Leaves an arrow in a body: it rides along with the bone it went into. */
  stickBody(a, archer, bone, t) {
    const pts = archer.ragdoll.points;
    const pa = pts[bone.a];
    const pb = pts[bone.b];
    const ang = Math.atan2(a.vy, a.vx);
    const boneAng = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    // Bury the head a little way in.
    this.keep({ type: a.type, archer, bone, t, rel: ang - boneAng, depth: 0.14 * archer.size, ang });
  }

  stickSolid(a, solid) {
    const ang = Math.atan2(a.vy, a.vx);
    const d = 0.12;
    this.keep({ type: a.type, solid, ox: a.x + Math.cos(ang) * d - solid.x, oy: a.y + Math.sin(ang) * d - solid.y, ang });
  }

  keep(s) {
    this.stuck.push(s);
    if (this.stuck.length > MAX_STUCK) this.stuck.shift();
  }

  /** Drops whatever was stuck in an archer or solid that's leaving. */
  release(thing) {
    this.stuck = this.stuck.filter((s) => s.archer !== thing && s.solid !== thing);
  }

  draw(ctx) {
    for (const s of this.stuck) {
      let x;
      let y;
      let ang;
      if (s.archer) {
        const pts = s.archer.ragdoll.points;
        const pa = pts[s.bone.a];
        const pb = pts[s.bone.b];
        const boneAng = pa === pb ? 0 : Math.atan2(pb.y - pa.y, pb.x - pa.x);
        ang = pa === pb ? s.ang : boneAng + s.rel;
        x = pa.x + (pb.x - pa.x) * s.t + Math.cos(ang) * s.depth;
        y = pa.y + (pb.y - pa.y) * s.t + Math.sin(ang) * s.depth;
        if (pa === pb) {
          // Stuck in the head: keep the angle relative to how the head turns.
          const n = pts[1];
          const up = Math.atan2(pa.y - n.y, pa.x - n.x);
          s.headUp ??= up;
          ang = s.ang + (up - s.headUp);
          x = pa.x + Math.cos(ang) * (s.depth * 0.3);
          y = pa.y + Math.sin(ang) * (s.depth * 0.3);
        }
      } else {
        x = s.solid.x + s.ox;
        y = s.solid.y + s.oy;
        ang = s.ang;
      }
      drawArrowShape(ctx, x, y, ang, s.type);
    }
    for (const a of this.flying) {
      const ang = Math.atan2(a.vy, a.vx);
      drawArrowShape(ctx, a.x, a.y, ang, a.type, a.spent ? 0.85 : 1);
    }
  }
}
