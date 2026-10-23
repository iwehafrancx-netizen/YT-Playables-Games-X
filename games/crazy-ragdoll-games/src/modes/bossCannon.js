import * as THREE from 'three';
import { BossLevel } from './bossLevel.js';
import { Cannon } from '../world/cannon.js';

const D2R = Math.PI / 180;
const SPEED = 19; // launch speed, m/s
const SCALE = 1.7;
const START_Z = 26;
const REACH_Z = 8; // it wins if it gets this close to the cannon
const HIT_R = 1.5; // how close to the core counts as a hit
const DOTS = 30;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Goliath: a giant robot stomps across the yard towards your cannon. Aim
 * and fire the ragdoll at the glowing core on its chest; every hit knocks it
 * back a few steps. Run out of ragdolls, or let it reach you, and it wins.
 */
export class BossCannonLevel extends BossLevel {
  setup() {
    const def = this.def;
    this.shots = def.shots;
    this.fired = 0;
    this.z = START_Z;
    this.x = 0;
    this.knock = 0;
    this.scenery({ flip: true, extent: 40 });
    this.clutter([[-6, 14], [6, 16], [-4, 22], [5, 26]]);
    this.cannon = new Cannon(this.world, { pos: [0, 0, 0], yaw: 0, pitch: 28 });
    this.bossSetup({ scale: SCALE }, [{ id: 'shots', icon: 'dummy', value: this.shots }]);
    this.place();
    this.dots = this.trail();
    this.phase = 'fight';
    this.aiming = true;
    this.cameraFor(true);
  }

  trail() {
    const geo = new THREE.SphereGeometry(0.1, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, depthWrite: false });
    const dots = new THREE.InstancedMesh(geo, mat, DOTS);
    dots.frustumCulled = false;
    this.world.add(dots);
    this.world.disposables.push(geo, mat);
    return dots;
  }

  place() {
    this.robot.root.position.set(this.x, 0, this.z);
    this.robot.root.rotation.y = Math.PI;
  }

  // ---------- input ----------

  onPointerDown() {
    if (!this.aiming) return;
    this.drag = { yaw: this.cannon.yaw, pitch: this.cannon.pitch };
    this.hud.clearHint();
  }

  onPointerMove(p, start) {
    if (!this.drag) return;
    const s = Math.min(p.w, p.h);
    this.cannon.yaw = THREE.MathUtils.clamp(this.drag.yaw - ((p.px - start.px) / s) * 70, -30, 30);
    this.cannon.pitch = THREE.MathUtils.clamp(this.drag.pitch - ((p.py - start.py) / s) * 60, 6, 60);
  }

  onPointerUp() {
    if (!this.drag) return;
    this.drag = null;
    this.fire();
  }

  onKeyDown(code) {
    if (!this.aiming) return;
    if (code === 'ArrowLeft') this.cannon.yaw = Math.min(30, this.cannon.yaw + 2);
    if (code === 'ArrowRight') this.cannon.yaw = Math.max(-30, this.cannon.yaw - 2);
    if (code === 'ArrowUp') this.cannon.pitch = Math.min(60, this.cannon.pitch + 2);
    if (code === 'ArrowDown') this.cannon.pitch = Math.max(6, this.cannon.pitch - 2);
    if (code === 'Space' || code === 'Enter') this.fire();
  }

  fire() {
    if (!this.aiming || this.phase !== 'fight' || this.fired >= this.shots) return;
    this.aiming = false;
    this.fired++;
    this.hud.set('shots', this.shots - this.fired);
    this.cannon.fire();
    const dir = this.cannon.direction(_a);
    const muzzle = this.cannon.muzzle(_b);
    if (this.ball) this.removeDummy(this.ball);
    const d = this.spawnDummy({ position: [muzzle.x, muzzle.y - 0.9, muzzle.z], yaw: this.cannon.yaw * D2R, pose: 'tuck', muscle: 0.7 });
    d.ragdoll.setVelocity(dir.clone().multiplyScalar(SPEED));
    this.ball = d;
    this.flyT = 0;
    this.landed = false;
    this.audio.boom();
    this.rig.shake(0.4);
    this.fx.puff(muzzle, { count: 14, color: 0xcfc8bb, size: 1.1, speed: 2.5, up: 1 });
  }

  // ---------- fight ----------

  fixedUpdate(dt) {
    this.cannon.update(dt);
    if (this.phase === 'fight') {
      // Stomps forward, weaving; a hit shoves it back a few steps.
      const pace = this.def.pace * (this.knock > 0 ? -4 : 1);
      this.knock = Math.max(0, this.knock - dt);
      this.z = Math.min(START_Z + 4, this.z - pace * dt);
      this.x = Math.sin(this.time * this.def.weave) * 3.5;
      this.place();
      if (this.z < REACH_Z) this.lose("Goliath reached your cannon. Hit its core faster!");
    }
    if (!this.ball || this.aiming) return;
    this.flyT += dt;
    if (!this.landed && this.phase === 'fight') {
      const core = this.robot.corePosition(_a);
      const c = this.ball.com(_b);
      if (c.distanceTo(core) < HIT_R * (this.def.big ? 1.25 : 1)) {
        this.landed = true;
        this.knock = 0.7;
        this.ball.ragdoll.setVelocity({ x: 0, y: 6, z: -8 });
        this.hit(core.clone(), 'CORE HIT!');
      }
    }
    // Back to the cannon once he's down, or has flown off.
    if ((this.flyT > 1 && this.ball.speed() < 0.6) || this.flyT > 5) this.reload();
  }

  reload() {
    this.aiming = true;
    if (this.phase === 'fight' && this.fired >= this.shots) this.lose('Out of ragdolls before Goliath went down.');
  }

  tick(dt) {
    this.bossTick(dt, this.phase === 'fight' ? 1 : 0);
    this.cameraFor();
    this.drawTrail();
    const core = this.robot.corePosition(_a).add(_b.set(0, 0.5, -1.6));
    this.coach(`Fire him at the glowing core on its chest · ${this.hitsLeft()}`, core);
  }

  drawTrail() {
    this.dots.visible = this.aiming && this.phase === 'fight';
    if (!this.dots.visible) return;
    const m = this.cannon.muzzle(_a);
    const v = this.cannon.direction(_b).multiplyScalar(SPEED);
    const mat = new THREE.Matrix4();
    for (let i = 0; i < DOTS; i++) {
      const t = i * 0.07;
      mat.makeTranslation(m.x + v.x * t, Math.max(-5, m.y + v.y * t + 0.5 * this.gravity * t * t), m.z + v.z * t);
      this.dots.setMatrixAt(i, mat);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }

  /** One more ragdoll for the cannon. */
  revive() {
    this.shots += 2;
    this.hud.set('shots', this.shots - this.fired);
    this.phase = 'fight';
    this.z = Math.max(this.z, REACH_Z + 8);
    this.aiming = true;
  }

  spare() {
    return (this.shots - this.fired) / this.shots;
  }

  bossStats() {
    return [['Ragdolls fired', `${this.fired}`]];
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const look = new THREE.Vector3(this.x * 0.3, 3, Math.min(this.z * 0.55, 14));
    const pos = new THREE.Vector3(0, portrait ? 6.5 : 6, portrait ? -9 : -7.5);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(look, 22);
  }
}
