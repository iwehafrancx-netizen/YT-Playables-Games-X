import * as THREE from 'three';
import { Level } from './level.js';
import { Cannon } from '../world/cannon.js';

const D2R = Math.PI / 180;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * Ballistics Bay: aim the cannon, fire dummies, knock every target down
 * before running out of shots.
 */
export class BallisticsLevel extends Level {
  setup() {
    const def = this.def;
    this.scenery({ flip: true, mat: def.ground ?? 'concrete' });
    this.cannon = new Cannon(this.world, { pos: def.cannon ?? [0, 0, 0], yaw: def.yaw ?? 0, pitch: def.pitch ?? 35 });
    this.yawRange = def.yawRange ?? 35;
    this.speed = def.speed ?? 16;
    this.shotsLeft = def.shots;
    this.shotsFired = 0;
    this.active = null;
    this.phase = 'aim';
    this.settle = 0;
    this.flightTime = 0;
    this.reloadT = 0;
    def.build(this.world, this);

    this.totalTargets = this.world.targets.length;
    this.makeTrajectory();
    this.aimCamera(true);
    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'targets', icon: 'target', value: `0/${this.totalTargets}` },
        { id: 'shots', icon: 'dummy', value: this.shotsLeft },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Drag to aim · release to fire');
  }

  makeTrajectory() {
    const n = 34;
    const geo = new THREE.SphereGeometry(0.11, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false });
    this.dots = new THREE.InstancedMesh(geo, mat, n);
    this.dots.frustumCulled = false;
    this.world.add(this.dots);
    this.world.disposables.push(geo);
  }

  updateTrajectory() {
    const show = this.phase === 'aim';
    this.dots.visible = show;
    if (!show) return;
    const p0 = this.cannon.muzzle(_v.clone());
    const v0 = this.cannon.direction(_w.clone()).multiplyScalar(this.speed);
    const g = -this.gravity;
    // Time to land back at muzzle height; only reveal the first part of the arc.
    const flight = (2 * v0.y) / g + 0.6;
    const reveal = flight * (this.def.reveal ?? 0.55);
    const m = new THREE.Matrix4();
    const n = this.dots.count;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * reveal;
      const p = new THREE.Vector3(p0.x + v0.x * t, p0.y + v0.y * t - 0.5 * g * t * t, p0.z + v0.z * t);
      const s = 1 - (i / n) * 0.7;
      m.makeScale(s, s, s).setPosition(p);
      this.dots.setMatrixAt(i, m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }

  aimCamera(snap = false) {
    const yaw = this.cannon.yaw * D2R;
    const fwd = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    const base = this.cannon.base;
    const portrait = this.stage.width < this.stage.height;
    const back = portrait ? 9 : 7;
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    // Over-the-shoulder so the barrel never hides the range.
    const pos = base.clone().addScaledVector(fwd, -back).addScaledVector(side, portrait ? 1.6 : 2.4).add(new THREE.Vector3(0, portrait ? 6.5 : 5.4, 0));
    const look = base.clone().addScaledVector(fwd, this.def.lookAhead ?? 14).add(new THREE.Vector3(0, 1.2, 0));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 4);
    this.stage.focusShadows(base.clone().addScaledVector(fwd, 10), 22);
  }

  fire() {
    if (this.phase !== 'aim' || this.shotsLeft <= 0) return;
    this.phase = 'flight';
    this.shotsLeft--;
    this.shotsFired++;
    this.hud.set('shots', this.shotsLeft);
    this.hud.clearHint();
    this.cannon.fire();

    const dir = this.cannon.direction(new THREE.Vector3());
    const muzzle = this.cannon.muzzle(new THREE.Vector3());
    const d = this.spawnDummy({ position: [muzzle.x, muzzle.y - 0.9, muzzle.z], yaw: this.cannon.yaw * D2R, pose: 'tuck', muscle: 0.7 });
    d.ragdoll.setVelocity(dir.clone().multiplyScalar(this.speed));
    const side = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    d.ragdoll.addSpin(side.multiplyScalar(-3 - Math.random() * 3));
    d.hits = 0;
    d.firedAt = this.time;
    this.active = d;
    this.settle = 0;
    this.flightTime = 0;

    this.audio.boom();
    this.audio.whoosh(1);
    this.rig.shake(0.45);
    this.rig.kick(6);
    this.fx.puff(muzzle, { count: 14, color: 0xcfc8bb, size: 1.1, speed: 2.5, up: 1, life: 1.4 });
    this.fx.chips(muzzle, { count: 18, colors: [0xffd23f, 0xff7a3c, 0xffffff], size: 0.05, speed: 6, life: 0.6 });
  }

  onPointerDown(p) {
    if (this.phase !== 'aim') return;
    this.drag = { yaw: this.cannon.yaw, pitch: this.cannon.pitch, moved: false };
    this.game.audio.click();
  }

  onPointerMove(p, start) {
    if (!this.drag || this.phase !== 'aim') return;
    const dx = (p.px - start.px) / Math.min(p.w, p.h);
    const dy = (p.py - start.py) / Math.min(p.w, p.h);
    if (Math.abs(dx) + Math.abs(dy) > 0.02) this.drag.moved = true;
    this.cannon.yaw = THREE.MathUtils.clamp(this.drag.yaw - dx * 70, (this.def.yaw ?? 0) - this.yawRange, (this.def.yaw ?? 0) + this.yawRange);
    this.cannon.pitch = THREE.MathUtils.clamp(this.drag.pitch - dy * 60, 8, 72);
  }

  onPointerUp() {
    if (!this.drag) return;
    this.drag = null;
    this.fire();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter') this.fire();
  }

  onTargetHit(target, by) {
    if (!this.world.hitTarget(target)) return;
    const hitIndex = this.world.targets.filter((t) => t.hit).length;
    let pts = target.points;
    const d = this.dummyFor(by);
    if (d) {
      d.hits++;
      if (d.hits > 1) pts += 250 * (d.hits - 1);
    } else {
      pts += 200;
    }
    this.score += pts;
    this.hud.set('score', this.score);
    this.hud.set('targets', `${hitIndex}/${this.totalTargets}`);
    this.hud.bump('targets');
    const p = target.group.position.clone().add(new THREE.Vector3(0, 0.6, 0));
    this.fx.text(p, d && d.hits > 1 ? `+${pts} COMBO!` : by.kind === 'prop' ? `+${pts} TRICK SHOT` : `+${pts}`, { color: '#ffe066', size: 30 });
    this.fx.confetti(p, 50);
    this.audio.ding(hitIndex);
    this.audio.pop();
    this.rig.shake(0.2);
  }

  onImpact(a, b, force, strength) {
    const info = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!info) return;
    const d = this.dummyFor(info);
    if (d && d === this.active && strength > 0.2 && d.knockout <= 0 && this.time - d.firedAt > 0.15) {
      d.setPose('starfish');
      d.knockOut(3, 2);
      d.setMuscle(0.25);
    }
  }

  checkProps() {
    for (const p of this.world.props) {
      if (p.knocked) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      const tilt = 1 - Math.abs(r.w);
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y, t.z - p.start.z) > 0.6 || tilt > 0.08) {
        p.knocked = true;
        this.score += 50;
        this.hud.set('score', this.score);
        this.fx.text(new THREE.Vector3(t.x, t.y + 0.6, t.z), '+50', { color: '#ffffff', size: 18, life: 0.8 });
        if (p.kind === 'crate') this.fx.chips(new THREE.Vector3(t.x, t.y, t.z), { count: 6, colors: [0xb98552, 0x8a5a33], size: 0.07, speed: 3, floor: 0.03 });
      }
    }
  }

  tick(dt) {
    this.cannon.update(dt);
    this.updateTrajectory();
    if (this.time % 0.25 < dt) this.checkProps();

    if (this.phase === 'flight' && this.active) {
      const d = this.active;
      this.flightTime += dt;
      const com = d.com(new THREE.Vector3());
      const vel = d.velocity(new THREE.Vector3());
      const flat = new THREE.Vector3(vel.x, 0, vel.z);
      const yaw = this.cannon.yaw * D2R;
      const dir = flat.lengthSq() > 1 ? flat.normalize() : new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      const camPos = com.clone().addScaledVector(dir, -6.5).addScaledVector(side, 2.5).add(new THREE.Vector3(0, 2.6, 0));
      camPos.y = Math.max(camPos.y, 1.2);
      this.rig.aim(camPos, com, 3.2, 8);
      this.stage.focusShadows(com, 18);
      this.audio.loop('wind', Math.min(1, vel.length() / 18), 'wind');

      const still = d.speed() < 0.7;
      this.settle = still ? this.settle + dt : Math.max(0, this.settle - dt * 2);
      const allHit = this.world.targets.every((t) => t.hit);
      const done = this.settle > 0.9 || this.flightTime > 8 || com.y < -8 || (allHit && this.flightTime > 1.6);
      if (done) {
        this.audio.loop('wind', 0, 'wind');
        this.endShot(allHit);
      }
    }

    if (this.phase === 'reload') {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.phase = 'aim';
        this.aimCamera();
        if (this.shotsFired === 1 && this.world.targets.some((t) => !t.hit)) this.hud.hint('Tip: aim higher to lob over obstacles');
      }
    }
  }

  /** Two more dummies in the cannon; every target already down stays down. */
  revive() {
    this.shotsLeft += 2;
    this.hud.set('shots', this.shotsLeft);
    this.phase = 'reload';
    this.reloadT = 0.3;
  }

  endShot(allHit) {
    this.active = null;
    if (allHit) {
      this.phase = 'won';
      const par = this.def.par;
      const stars = this.shotsFired <= par ? 3 : this.shotsFired <= par + 1 ? 2 : 1;
      const bonus = this.shotsLeft * 300;
      this.score += bonus;
      this.finish({
        passed: true,
        stars,
        score: this.score,
        stats: [
          ['Targets', `${this.totalTargets}/${this.totalTargets}`],
          ['Shots used', `${this.shotsFired} (par ${par})`],
          ['Unused shot bonus', `+${bonus}`],
        ],
      });
      return;
    }
    if (this.shotsLeft <= 0) {
      this.phase = 'lost';
      const hit = this.world.targets.filter((t) => t.hit).length;
      this.finish({
        passed: false,
        stars: 0,
        score: this.score,
        reason: 'Out of dummies!',
        stats: [['Targets', `${hit}/${this.totalTargets}`]],
      });
      return;
    }
    this.phase = 'reload';
    this.reloadT = 0.6;
  }
}
