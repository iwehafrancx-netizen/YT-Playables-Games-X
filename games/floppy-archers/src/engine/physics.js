export const GRAVITY = 18; // ragdolls fall a bit faster than real life; it reads floppier
export const STEP = 1 / 120;

/**
 * Verlet points held together by sticks. Velocity is implied by where a point
 * is and where it was, so shoving a point is just moving it, and an impulse is
 * moving where it was.
 */
export class Point {
  constructor(x, y, r = 0.06, mass = 1) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.r = r;
    this.mass = mass;
    this.ground = null; // the solid it's resting on, if any
  }

  get vx() {
    return (this.x - this.px) / STEP;
  }

  get vy() {
    return (this.y - this.py) / STEP;
  }

  push(vx, vy) {
    this.px -= vx * STEP;
    this.py -= vy * STEP;
  }

  teleport(x, y) {
    this.x = this.px = x;
    this.y = this.py = y;
  }
}

/** Keeps two points `len` apart; `min`-only sticks just stop them getting closer. */
export class Stick {
  constructor(a, b, len, { stiff = 1, min = false } = {}) {
    this.a = a;
    this.b = b;
    this.len = len;
    this.stiff = stiff;
    this.min = min;
  }

  solve() {
    const { a, b } = this;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    if (this.min && d >= this.len) return;
    const diff = ((d - this.len) / d) * this.stiff;
    const wa = b.mass / (a.mass + b.mass);
    const wb = 1 - wa;
    a.x += dx * diff * wa;
    a.y += dy * diff * wa;
    b.x -= dx * diff * wb;
    b.y -= dy * diff * wb;
  }
}

/** Integrates points under gravity with a little air drag. */
export function integrate(points, dt, drag = 0.995) {
  const g = GRAVITY * dt * dt;
  for (const p of points) {
    const vx = (p.x - p.px) * drag;
    const vy = (p.y - p.py) * drag;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy - g;
  }
}

/**
 * Pushes a point out of an axis-aligned solid (x, y is the bottom-left
 * corner) and applies friction when it's sliding along the surface.
 */
export function collide(p, s, friction = 0.6) {
  const r = p.r;
  if (p.x < s.x - r || p.x > s.x + s.w + r || p.y < s.y - r || p.y > s.y + s.h + r) return false;
  const dl = p.x - (s.x - r);
  const dr = s.x + s.w + r - p.x;
  const db = p.y - (s.y - r);
  const dt = s.y + s.h + r - p.y;
  const m = Math.min(dl, dr, db, dt);
  if (m === dt) {
    p.y = s.y + s.h + r;
    // Stop the fall and ride along with a moving solid; friction drags the slide.
    const mdx = s.dx ?? 0;
    const mdy = s.dy ?? 0;
    if (p.y - p.py < mdy) p.py = p.y - mdy;
    const slide = p.x - p.px - mdx;
    p.px = p.x - mdx - slide * (1 - friction);
    p.ground = s;
  } else if (m === db) {
    p.y = s.y - r;
    if (p.py < p.y) p.py = p.y;
  } else if (m === dl) {
    p.x = s.x - r;
    if (p.px < p.x) p.px = p.x;
  } else {
    p.x = s.x + s.w + r;
    if (p.px > p.x) p.px = p.x;
  }
  return true;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Closest approach of segments p1→q1 and p2→q2. Returns the distance and
 * where along each segment (0–1) the closest points are.
 */
export function segSeg(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x;
  const d1y = q1y - p1y;
  const d2x = q2x - p2x;
  const d2y = q2y - p2y;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  let s;
  let t;
  if (a <= 1e-9 && e <= 1e-9) {
    s = t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const cx = p1x + d1x * s - (p2x + d2x * t);
  const cy = p1y + d1y * s - (p2y + d2y * t);
  return { d: Math.hypot(cx, cy), s, t };
}

/** Where segment p→q first enters an axis-aligned rect, as a fraction along it; null if it doesn't. */
export function segRect(px, py, qx, qy, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = qx - px;
  const dy = qy - py;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  if (clip(-dx, px - r.x) && clip(dx, r.x + r.w - px) && clip(-dy, py - r.y) && clip(dy, r.y + r.h - py)) return t0;
  return null;
}
