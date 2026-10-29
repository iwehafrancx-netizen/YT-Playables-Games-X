import { Ragdoll, BONES, HEAD, NECK, PELVIS, HAND_F, HAND_B } from '../engine/ragdoll.js';
import { STEP } from '../engine/physics.js';

const D2R = Math.PI / 180;
export const MIN_AIM = -60 * D2R;
export const MAX_AIM = 80 * D2R;
const HIP = 0.86; // pelvis height over the feet
const JUMP_G = 22;

/**
 * Local pose for an archer facing +x, aiming `a` radians above level with
 * the string pulled back `draw` (0–1). Offsets are from the pelvis.
 */
function pose(a, draw, crouch, out) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy; // perpendicular, pointing "up" from the aim
  const py = dx;
  const nx = 0.01 - 0.05 * dy;
  const ny = 0.5 - crouch * 0.08;
  const set = (i, x, y) => {
    out[i][0] = x;
    out[i][1] = y;
  };
  set(0, nx + 0.03 - 0.05 * dy, ny + 0.22);
  set(1, nx, ny);
  set(2, 0, 0);
  set(3, nx + dx * 0.27 + px * 0.03, ny + dy * 0.27 + py * 0.03);
  set(4, nx + dx * 0.53, ny + dy * 0.53);
  const back = 0.48 * draw;
  set(5, nx + dx * (0.24 - 0.42 * draw) + px * (0.03 + 0.1 * draw), ny + dy * (0.24 - 0.42 * draw) + py * (0.03 + 0.1 * draw));
  set(6, nx + dx * (0.5 - back) + px * 0.015, ny + dy * (0.5 - back) + py * 0.015);
  set(7, 0.13 + crouch * 0.12, -0.42 + crouch * 0.12);
  set(8, 0.2, -0.86 + crouch * 0.1);
  set(9, -0.1 + crouch * 0.1, -0.42 + crouch * 0.14);
  set(10, -0.18, -0.86 + crouch * 0.1);
  return out;
}

/**
 * An archer: a ragdoll that stands on its spot holding a bow, plus health,
 * stamina and whatever is currently burning, poisoning or shocking it.
 */
export class Archer {
  constructor({ x, y, side = 1, team, look, hp = 100, stamina = 100, size = 1, platform = null }) {
    this.side = side;
    this.team = team;
    this.look = look;
    this.size = size;
    this.maxHp = hp;
    this.hp = hp;
    this.maxStamina = stamina;
    this.stamina = stamina;
    this.alive = true;
    this.angle = 10 * D2R;
    this.draw = 0;
    this.platform = platform;
    // Feet position, relative to the platform if it moves.
    this.footOff = platform ? x - platform.x : x;
    this.footY = y;
    this.jumpY = 0;
    this.jumpV = 0;
    this.stun = 0;
    this.burn = null;
    this.poison = null;
    this.flash = 0;
    this.ragdoll = new Ragdoll(x, y + HIP * size, { side, size });
    this.pose = Array.from({ length: 11 }, () => [0, 0]);
    this.bones = BONES.map((b) => ({ ...b, r: b.r * size }));
  }

  get home() {
    const p = this.platform;
    return { x: p ? p.x + this.footOff : this.footOff, y: p ? p.y + p.h : this.footY };
  }

  get airborne() {
    return this.jumpY > 0.001 || this.jumpV > 0;
  }

  aimDir(out = {}) {
    out.x = Math.cos(this.angle) * this.side;
    out.y = Math.sin(this.angle);
    return out;
  }

  aim(angle, draw) {
    this.angle = Math.max(MIN_AIM, Math.min(MAX_AIM, angle));
    this.draw = Math.max(0, Math.min(1, draw));
  }

  /** Where an arrow starts: just past the bow hand. */
  muzzle(out = {}) {
    const h = this.ragdoll.points[HAND_F];
    const d = this.aimDir();
    out.x = h.x + d.x * 0.3 * this.size;
    out.y = h.y + d.y * 0.3 * this.size;
    return out;
  }

  chest(out = {}) {
    const n = this.ragdoll.points[NECK];
    const p = this.ragdoll.points[PELVIS];
    out.x = n.x * 0.65 + p.x * 0.35;
    out.y = n.y * 0.65 + p.y * 0.35;
    return out;
  }

  headPos(out = {}) {
    const h = this.ragdoll.points[HEAD];
    out.x = h.x;
    out.y = h.y;
    return out;
  }

  get canShoot() {
    return this.alive && this.stun <= 0;
  }

  jump(power = 7) {
    if (!this.alive || this.airborne || this.stun > 0) return false;
    this.jumpV = power;
    return true;
  }

  /** Takes damage; returns true if that finished him off. */
  hurt(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 0.15;
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    // A heavy hit knocks the stiffness out of him for a moment.
    if (amount >= 15) this.ragdoll.muscle = Math.min(this.ragdoll.muscle, 0.35);
    return false;
  }

  die() {
    this.alive = false;
    this.draw = 0;
    this.ragdoll.muscle = 0;
    this.burn = null;
    this.poison = null;
    this.stun = 0;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** One physics step. */
  step(solids) {
    const dt = STEP;
    const r = this.ragdoll;
    if (this.alive) {
      if (this.jumpV !== 0 || this.jumpY > 0) {
        this.jumpV -= JUMP_G * dt;
        this.jumpY += this.jumpV * dt;
        if (this.jumpY <= 0) {
          this.landed = -this.jumpV;
          this.jumpY = 0;
          this.jumpV = 0;
        }
      }
      r.muscle = Math.min(1, r.muscle + dt * 1.6);
      const h = this.home;
      const crouch = this.airborne ? Math.min(1, this.jumpV > 0 ? 0.6 : 0.2) : 0;
      const stunned = this.stun > 0;
      pose(stunned ? -50 * D2R : this.angle, stunned ? 0 : this.draw, crouch, this.pose);
      r.setTargets(h.x, h.y + HIP * this.size + this.jumpY, this.pose);
      r.drive(stunned ? 0.05 : 0.22);
    }
    r.step(dt, solids);
  }

  /** Per-frame timers: stamina, status effects. Returns damage taken from effects this frame. */
  tick(dt, regen) {
    this.flash = Math.max(0, this.flash - dt);
    this.ragdoll.updateEyes(dt);
    if (!this.alive) return 0;
    this.stun = Math.max(0, this.stun - dt);
    this.stamina = Math.min(this.maxStamina, this.stamina + regen * dt);
    let dmg = 0;
    for (const key of ['burn', 'poison']) {
      const e = this[key];
      if (!e) continue;
      e.t -= dt;
      dmg += e.dps * dt;
      if (e.t <= 0) this[key] = null;
    }
    return dmg;
  }
}
