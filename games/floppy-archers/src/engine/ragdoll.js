import { Point, Stick, integrate, collide } from './physics.js';

// Joint indices.
export const HEAD = 0;
export const NECK = 1;
export const PELVIS = 2;
export const ELBOW_F = 3;
export const HAND_F = 4;
export const ELBOW_B = 5;
export const HAND_B = 6;
export const KNEE_F = 7;
export const FOOT_F = 8;
export const KNEE_B = 9;
export const FOOT_B = 10;

// Standing pose, facing +x, relative to the pelvis (metres).
const STAND = [
  [0.03, 0.72],
  [0.01, 0.5],
  [0, 0],
  [0.16, 0.28],
  [0.3, 0.1],
  [-0.1, 0.28],
  [-0.05, 0.06],
  [0.13, -0.42],
  [0.2, -0.86],
  [-0.1, -0.42],
  [-0.18, -0.86],
];

const RADII = [0.17, 0.06, 0.09, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.06, 0.06];
const MASS = [1.2, 1.5, 3, 0.6, 0.4, 0.6, 0.4, 1, 0.6, 1, 0.6];

/** The capsules an arrow can hit, with how much a hit there hurts. */
export const BONES = [
  { a: NECK, b: PELVIS, r: 0.13, zone: 'torso', mult: 1 },
  { a: NECK, b: ELBOW_F, r: 0.065, zone: 'arm', mult: 0.6 },
  { a: ELBOW_F, b: HAND_F, r: 0.06, zone: 'arm', mult: 0.5 },
  { a: NECK, b: ELBOW_B, r: 0.065, zone: 'arm', mult: 0.6 },
  { a: ELBOW_B, b: HAND_B, r: 0.06, zone: 'arm', mult: 0.5 },
  { a: PELVIS, b: KNEE_F, r: 0.08, zone: 'leg', mult: 0.7 },
  { a: KNEE_F, b: FOOT_F, r: 0.07, zone: 'leg', mult: 0.6 },
  { a: PELVIS, b: KNEE_B, r: 0.08, zone: 'leg', mult: 0.7 },
  { a: KNEE_B, b: FOOT_B, r: 0.07, zone: 'leg', mult: 0.6 },
  { a: HEAD, b: HEAD, r: 0.17, zone: 'head', mult: 1 },
];

const LINKS = [
  [HEAD, NECK],
  [NECK, PELVIS],
  [NECK, ELBOW_F],
  [ELBOW_F, HAND_F],
  [NECK, ELBOW_B],
  [ELBOW_B, HAND_B],
  [PELVIS, KNEE_F],
  [KNEE_F, FOOT_F],
  [PELVIS, KNEE_B],
  [KNEE_B, FOOT_B],
];

/**
 * A stick-figure ragdoll. While it has muscle it's a puppet pulled towards a
 * pose around an anchor, so hits rock it and it springs back; with none it's
 * just points and sticks, and flops wherever physics takes it.
 */
export class Ragdoll {
  constructor(x, y, { side = 1, size = 1 } = {}) {
    this.side = side;
    this.size = size;
    this.points = STAND.map(([px, py], i) => new Point(x + px * side * size, y + py * size, RADII[i] * size, MASS[i]));
    this.sticks = LINKS.map(([a, b]) => this.link(a, b));
    // Bracing: keeps the head over the shoulders and the legs apart.
    this.sticks.push(this.link(HEAD, PELVIS, { stiff: 0.35 }));
    this.sticks.push(this.link(KNEE_F, KNEE_B, { stiff: 0.6, min: true, len: 0.1 * size }));
    this.sticks.push(this.link(FOOT_F, FOOT_B, { stiff: 0.6, min: true, len: 0.14 * size }));
    this.sticks.push(this.link(HEAD, KNEE_F, { stiff: 0.4, min: true, len: 0.55 * size }));
    this.sticks.push(this.link(HEAD, KNEE_B, { stiff: 0.4, min: true, len: 0.55 * size }));
    this.targets = STAND.map(() => ({ x: 0, y: 0 }));
    this.muscle = 1;
    this.eyes = [
      { x: 0, y: 0, vx: 0, vy: 0 },
      { x: 0, y: 0, vx: 0, vy: 0 },
    ];
  }

  link(a, b, { stiff = 1, min = false, len } = {}) {
    const pa = this.points[a];
    const pb = this.points[b];
    return new Stick(pa, pb, len ?? Math.hypot(pb.x - pa.x, pb.y - pa.y), { stiff, min });
  }

  get head() {
    return this.points[HEAD];
  }

  get pelvis() {
    return this.points[PELVIS];
  }

  /** Sets the pose targets from `pose` (local offsets, facing +x) placed at `ax, ay`. */
  setTargets(ax, ay, pose) {
    const s = this.side;
    const k = this.size;
    for (let i = 0; i < pose.length; i++) {
      this.targets[i].x = ax + pose[i][0] * s * k;
      this.targets[i].y = ay + pose[i][1] * k;
    }
  }

  /** Pulls each joint towards its target. `inject` is how much of the pull turns into speed. */
  drive(strength, inject = 0.35) {
    const k = strength * this.muscle;
    if (k <= 0) return;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const t = this.targets[i];
      const dx = (t.x - p.x) * k;
      const dy = (t.y - p.y) * k;
      p.x += dx;
      p.y += dy;
      p.px += dx * (1 - inject);
      p.py += dy * (1 - inject);
    }
  }

  step(dt, solids, iterations = 6) {
    integrate(this.points, dt, this.muscle > 0.5 ? 0.985 : 0.995);
    for (const p of this.points) p.ground = null;
    for (let n = 0; n < iterations; n++) {
      for (const st of this.sticks) st.solve();
      for (const p of this.points) for (const s of solids) collide(p, s, 0.7);
    }
  }

  push(vx, vy, only) {
    for (let i = 0; i < this.points.length; i++) if (!only || only.includes(i)) this.points[i].push(vx, vy);
  }

  teleport(dx, dy) {
    for (const p of this.points) p.teleport(p.x + dx, p.y + dy);
  }

  /** Average speed of the body, for impact sounds. */
  speed() {
    let s = 0;
    for (const p of this.points) s += Math.hypot(p.vx, p.vy);
    return s / this.points.length;
  }

  centre(out = {}) {
    out.x = (this.points[NECK].x + this.points[PELVIS].x) / 2;
    out.y = (this.points[NECK].y + this.points[PELVIS].y) / 2;
    return out;
  }

  /** Googly pupils: they sag to the bottom, lag behind the head and wobble back. */
  updateEyes(dt) {
    const h = this.head;
    const tx = Math.max(-1, Math.min(1, -h.vx * 0.08));
    const ty = Math.max(-1, Math.min(1, -0.55 - h.vy * 0.08));
    const damp = Math.exp(-7 * dt);
    for (const [i, e] of this.eyes.entries()) {
      const k = i ? 170 : 230; // slightly different springs so they don't move in lockstep
      e.vx = (e.vx + (tx - e.x) * k * dt) * damp;
      e.vy = (e.vy + (ty - e.y) * k * dt) * damp;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const d = Math.hypot(e.x, e.y);
      if (d > 1) {
        e.x /= d;
        e.y /= d;
      }
    }
  }
}
