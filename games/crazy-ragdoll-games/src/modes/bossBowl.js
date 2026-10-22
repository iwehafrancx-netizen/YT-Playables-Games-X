import * as THREE from 'three';
import { BossLevel } from './bossLevel.js';
import { RAPIER } from '../physics/physics.js';
import { buildCrab } from '../world/robot.js';

const LANE_W = 5;
const LEN = 22;
const TOP = 0.2;
const START_Z = 1.2;
const SWEEP = THREE.MathUtils.degToRad(13);
const CHARGE = 1.1;
const CHEST = { x: 0, y: 0.17, z: 0 };
const SCALE = 1.25;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Crab King: a giant mechanical crab scuttles across the end of a wide
 * bowling lane, snapping its claws shut over its belly and lifting them
 * again. Bowl the ragdoll into the glowing belly while the claws are up;
 * hit it while they're down and you just bounce off.
 */
export class BossBowlLevel extends BossLevel {
  setup() {
    const def = this.def;
    this.rolls = def.rolls;
    this.rolled = 0;
    this.charge = 0;
    this.charging = false;
    this.aimT = 0;
    this.crabX = 0;
    this.open = 0;
    this.scenery();
    this.clutter([[-6, -LEN - 2], [6, -LEN - 3], [-7, -8], [7, -10]]);
    this.lane();
    this.bossSetup({ scale: SCALE }, [{ id: 'rolls', icon: 'dummy', value: this.rolls }], buildCrab);
    this.robot.root.position.set(0, TOP, -LEN);
    this.arrow = this.makeArrow();
    this.holder = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, TOP + 1.5, START_Z));
    this.load();
    this.cameraFor(true);
  }

  lane() {
    const w = this.world;
    const L = LEN + 8;
    w.block({ pos: [0, TOP / 2, -L / 2 + 3], size: [LANE_W, TOP, L], mat: 'lane', tile: 2, friction: 0.15, slick: true });
    for (const s of [-1, 1]) w.block({ pos: [s * (LANE_W / 2 + 0.15), TOP + 0.3, -L / 2 + 3], size: [0.3, 1, L], mat: s < 0 ? 'toyBlue' : 'toyPink', restitution: 0.4 });
    w.block({ pos: [0, 1, -LEN - 5], size: [LANE_W + 2, 2, 0.5], mat: 'toyDark' });
  }

  makeArrow() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.14, 0);
    shape.lineTo(0.14, 0);
    shape.lineTo(0.14, 1.8);
    shape.lineTo(0.36, 1.8);
    shape.lineTo(0, 2.5);
    shape.lineTo(-0.36, 1.8);
    shape.lineTo(-0.14, 1.8);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, depthWrite: false });
    this.world.disposables.push(geo, mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, TOP + 0.02, START_Z - 1.2);
    this.world.add(m);
    return m;
  }

  load() {
    this.holder.setTranslation({ x: 0, y: TOP + 1.5, z: START_Z }, true);
    const d = this.spawnDummy({ position: [0, TOP + 1.5 - 0.1 - 1.41, START_Z], yaw: Math.PI, pose: 'tuck', muscle: 0.9 });
    d.lively = 0.3;
    this.rope = this.physics.world.createImpulseJoint(RAPIER.JointData.rope(0.1, { x: 0, y: 0, z: 0 }, CHEST), this.holder, d.parts.chest.body, true);
    this.ball = d;
    this.turn = 'aim';
    this.charge = 0;
    this.physics.snapAll();
  }

  // ---------- input ----------

  onPointerDown() {
    if (this.turn !== 'aim' || this.phase !== 'fight') return;
    this.charging = true;
    this.hud.clearHint();
  }

  onPointerUp() {
    this.bowl();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter') this.onPointerDown();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter') this.bowl();
  }

  aim() {
    return Math.sin(this.aimT * 1.6) * SWEEP;
  }

  bowl() {
    if (this.turn !== 'aim' || !this.charging) return;
    this.charging = false;
    this.physics.world.removeImpulseJoint(this.rope, true);
    const a = this.aim();
    const speed = 8 + this.charge * 8;
    this.dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    this.speed = speed;
    this.ball.ragdoll.setVelocity({ x: this.dir.x * speed, y: -1, z: this.dir.z * speed });
    this.ball.ragdoll.addSpin(_a.set(-speed * 1.2, 0, 0));
    this.ball.setMuscle(1);
    this.rolled++;
    this.hud.set('rolls', this.rolls - this.rolled);
    this.turn = 'rolling';
    this.rollT = 0;
    this.struck = false;
    this.arrow.visible = false;
    this.hud.hideMeter();
    this.hud.meter(this.def.name, this.hp / this.def.hp, this.hp <= 1);
    this.audio.whoosh(1.1);
  }

  // ---------- fight ----------

  fixedUpdate(dt) {
    const def = this.def;
    if (this.phase === 'fight') {
      this.crabX = Math.sin(this.time * def.scuttle) * (LANE_W / 2 - 0.9);
      // Claws up for a beat, then slammed down to guard the belly.
      const cycle = (this.time % def.cycle) / def.cycle;
      this.open = THREE.MathUtils.lerp(this.open, cycle < def.openShare ? 1 : 0, Math.min(1, dt * 10));
      this.robot.setOpen(this.open);
      this.robot.root.position.x = this.crabX;
    }
    if (this.turn === 'aim') {
      this.aimT += dt;
      if (this.charging) this.charge = Math.min(1, this.charge + dt / CHARGE);
      return;
    }
    if (this.turn !== 'rolling') return;
    this.rollT += dt;
    const c = this.ball.com(_a);
    // Keep him rolling true down the oiled lane.
    if (c.z > -LEN + 2 && c.y < TOP + 1) {
      const v = this.ball.velocity(_b);
      if (v.x * this.dir.x + v.z * this.dir.z < this.speed * 0.9) this.ball.ragdoll.addVelocity({ x: this.dir.x * 0.25, y: 0, z: this.dir.z * 0.25 });
    }
    if (!this.struck && this.phase === 'fight' && c.z < -LEN + 1.7 * SCALE && Math.abs(c.x - this.crabX) < 1.7 * SCALE) {
      this.struck = true;
      this.struckAt = this.rollT;
      this.ball.ragdoll.setVelocity({ x: (c.x - this.crabX) * 2, y: 5, z: 7 });
      if (this.open > 0.6) this.hit(this.robot.corePosition(_b).clone(), 'BELLY FLOP!');
      else {
        this.fx.text(_b.set(this.crabX, 3.5, -LEN + 1), 'BLOCKED!', { color: '#ff5a4e', size: 34 });
        this.audio.impact(1, 'metal');
        this.rig.shake(0.3);
      }
    }
    const bounced = this.struck && this.rollT - this.struckAt > 1.6;
    if (bounced || (this.rollT > 1 && this.ball.speed() < 0.6) || this.rollT > 6 || c.z < -LEN - 3) this.next();
  }

  next() {
    this.turn = 'between';
    this.nextT = 0.8;
  }

  tick(dt) {
    this.bossTick(dt, this.phase === 'fight' ? 1 : 0);
    this.cameraFor();
    if (this.turn === 'aim') {
      this.arrow.visible = this.phase === 'fight';
      this.arrow.rotation.y = -this.aim();
      this.arrow.scale.setScalar(1 + this.charge * 0.5);
    } else if (this.turn === 'between' && this.phase === 'fight') {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (this.rolled >= this.rolls) this.lose('Out of rolls before the Crab King went down.');
        else {
          this.removeDummy(this.ball);
          this.load();
          this.cameraFor(true);
        }
      }
    }
  }

  /** Two more rolls. */
  revive() {
    this.rolls += 2;
    this.hud.set('rolls', this.rolls - this.rolled);
    this.phase = 'fight';
    this.removeDummy(this.ball);
    this.load();
    this.cameraFor(true);
  }

  spare() {
    return (this.rolls - this.rolled) / this.rolls;
  }

  bossStats() {
    return [['Rolls used', `${this.rolled}`]];
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    let z = START_Z;
    if (this.turn === 'rolling' || this.turn === 'between') z = Math.max(-LEN + 6, Math.min(START_Z, this.ball.com(_a).z));
    const pos = new THREE.Vector3(0, portrait ? 5 : 3.8, z + (portrait ? 8 : 6));
    const look = new THREE.Vector3(0, 1.2, z - 10);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 3.5);
    this.stage.focusShadows(look, 18);
  }
}
