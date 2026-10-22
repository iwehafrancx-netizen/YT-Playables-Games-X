import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';

const LANE_W = 3.2;
const TOP = 0.2; // lane surface
const START_Z = 1.2;
const PIN_GAP = 0.78;
const SWEEP = THREE.MathUtils.degToRad(11); // aim swings this far each side
const CHARGE = 1.1; // seconds to full power
const CHEST = { x: 0, y: 0.17, z: 0 };
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Ragdoll Bowling: he curls up into the ball. The aim arrow swings across the
 * lane; hold to wind up power and let go to send him rolling at the pins.
 * Fallen pins are cleared between rolls, like the real thing.
 */
export class BowlingLevel extends Level {
  setup() {
    const def = this.def;
    this.len = def.length ?? 20;
    this.rolls = def.rolls ?? 2;
    this.rolled = 0;
    this.down = 0;
    this.total = 0;
    this.points = 0;
    this.charge = 0;
    this.charging = false;
    this.aimT = 0;
    this.sweepers = [];

    this.scenery();
    this.clutter([[-5, -this.len - 3], [4.5, -this.len - 4], [-6.5, -this.len + 4]]);
    this.lane();
    this.pins = this.rack();
    this.total = this.pins.length;
    for (const s of def.sweepers ?? []) this.sweeper(s);
    this.arrow = this.makeArrow();
    this.holder = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, TOP + 1.5, START_Z));
    this.load();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'rolls', icon: 'dummy', value: this.rolls },
        { id: 'pins', icon: 'target', value: `0/${this.total}` },
      ],
    });
    this.hud.hint(def.hint ?? 'Hold to power up · let go to bowl when the arrow points at the pins');
    this.cameraFor(true);
  }

  // ---------- lane ----------

  lane() {
    const w = this.world;
    const L = this.len + 6;
    w.block({ pos: [0, TOP / 2, -L / 2 + 3], size: [LANE_W, TOP, L], mat: 'lane', tile: 2, friction: 0.15, slick: true });
    if (!this.def.open) {
      for (const s of [-1, 1]) w.block({ pos: [s * (LANE_W / 2 + 0.15), TOP + 0.2, -L / 2 + 3], size: [0.3, 0.8, L], mat: s < 0 ? 'toyBlue' : 'toyRed', restitution: 0.4 });
    }
    // Backstop behind the pins, so a strike piles up instead of rolling away.
    w.block({ pos: [0, 0.8, -this.len - 3.2], size: [LANE_W + 2, 1.6, 0.5], mat: 'toyDark' });
    for (let z = -2; z > -this.len + 1; z -= 4) w.paint({ pos: [0, TOP, z], size: [0.18, 0.5], color: 0x3c86e8, opacity: 0.6 });
  }

  rack() {
    const def = this.def;
    const pins = [];
    const head = -this.len;
    if (def.barrels) {
      for (const [x, z] of def.barrels) pins.push(this.world.barrel({ pos: [x, TOP + 0.45, head + z], color: ['steelRed', 'steelBlue', 'steelOrange'][pins.length % 3] }));
    }
    const rows = def.rows ?? (def.barrels ? 0 : 4);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i <= r; i++) pins.push(this.world.pin({ pos: [(i - r / 2) * PIN_GAP, TOP, head - r * PIN_GAP * 0.87], h: 1.1 }));
    }
    for (const p of pins) p.down = false;
    return pins;
  }

  sweeper({ z, amp = 1.1, sp = 1.4, ph = 0 }) {
    const m = this.world.mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), 'crate');
    this.world.add(m);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, TOP + 0.45, -z));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(0.45, 0.45, 0.45).setRestitution(0.3), body, { kind: 'static', material: 'wood' });
    this.physics.link(body, m);
    this.sweepers.push({ body, z: -z, amp, sp, ph });
  }

  makeArrow() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.12, 0);
    shape.lineTo(0.12, 0);
    shape.lineTo(0.12, 1.6);
    shape.lineTo(0.32, 1.6);
    shape.lineTo(0, 2.2);
    shape.lineTo(-0.32, 1.6);
    shape.lineTo(-0.12, 1.6);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, depthWrite: false });
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
    this.phase = 'aim';
    this.charge = 0;
    this.physics.snapAll();
  }

  // ---------- input ----------

  onPointerDown() {
    this.startCharge();
  }

  onPointerUp() {
    this.bowl();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.startCharge();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.bowl();
  }

  startCharge() {
    if (this.phase !== 'aim') return;
    this.charging = true;
    this.hud.clearHint();
  }

  aim() {
    return Math.sin(this.aimT * 1.7) * SWEEP;
  }

  bowl() {
    if (this.phase !== 'aim' || !this.charging) return;
    this.charging = false;
    this.physics.world.removeImpulseJoint(this.rope, true);
    const a = this.aim();
    const speed = 6 + this.charge * 8;
    this.dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    this.speed = speed;
    const d = this.ball;
    d.ragdoll.setVelocity({ x: this.dir.x * speed, y: -1, z: this.dir.z * speed });
    d.ragdoll.addSpin(_a.set(-speed * 1.2, 0, 0));
    d.setMuscle(1);
    d.lively = 0.2;
    this.rolled++;
    this.hud.set('rolls', this.rolls - this.rolled);
    this.phase = 'rolling';
    this.rollT = 0;
    this.quietT = 0;
    this.arrow.visible = false;
    this.hud.hideMeter();
    this.audio.whoosh(1.1);
  }

  // ---------- play ----------

  fixedUpdate(dt) {
    for (const s of this.sweepers) s.body.setNextKinematicTranslation({ x: Math.sin(this.time * s.sp + s.ph) * s.amp, y: TOP + 0.45, z: s.z });
    if (this.phase === 'aim') {
      this.aimT += dt;
      if (this.charging) this.charge = Math.min(1, this.charge + dt / CHARGE);
    }
    if (this.phase === 'rolling') {
      const c = this.ball.com(_a);
      // A lane is oiled for a reason: keep him rolling true until he reaches the pins.
      if (c.z > -this.len + 1 && c.y < TOP + 1) {
        const v = this.ball.velocity(_b);
        const along = v.x * this.dir.x + v.z * this.dir.z;
        if (along < this.speed * 0.9) this.ball.ragdoll.addVelocity({ x: this.dir.x * 0.25, y: 0, z: this.dir.z * 0.25 });
      }
    }
  }

  tick(dt) {
    this.cameraFor();
    if (this.phase === 'aim') {
      this.arrow.visible = true;
      this.arrow.rotation.y = -this.aim();
      this.arrow.scale.setScalar(1 + this.charge * 0.5);
      if (this.charging) this.hud.meter('Power', this.charge, this.charge > 0.9);
      return;
    }
    if (this.phase === 'rolling') {
      this.rollT += dt;
      const rolling = this.ball.speed() > 0.6 && this.ball.com(_a).z > -this.len + 0.5;
      const moving = rolling || this.pins.some((p) => !p.down && speedOf(p.body) > 0.25);
      this.quietT = moving ? 0 : this.quietT + dt;
      if (this.quietT > 0.8 || this.rollT > 8) this.tally();
    } else if (this.phase === 'between') {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (this.down === this.total || this.rolled >= this.rolls) this.complete();
        else {
          this.removeDummy(this.ball);
          this.load();
          this.cameraFor(true);
        }
      }
    }
  }

  tally() {
    let fresh = 0;
    for (const p of this.pins) {
      if (p.down) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
      if (upY < 0.75 || t.y < TOP - 0.1 || Math.hypot(t.x - p.start.x, t.z - p.start.z) > 0.6) {
        p.down = true;
        fresh++;
        // Clear the deadwood for the next roll.
        this.physics.removeBody(p.body);
        p.mesh.visible = false;
      }
    }
    this.world.props = this.world.props.filter((p) => !p.down);
    const first = this.rolled === 1;
    this.down += fresh;
    this.points += fresh * 100;
    const all = this.down === this.total;
    const at = new THREE.Vector3(0, TOP + 2.2, -this.len);
    if (all && first) {
      this.points += 500;
      this.game.ui.banner('STRIKE!', `+${fresh * 100 + 500}`);
      this.fx.confetti(at, 140);
      this.audio.win();
    } else if (all) {
      this.points += 250;
      this.game.ui.banner('SPARE!', `+${fresh * 100 + 250}`);
      this.fx.confetti(at, 80);
      this.audio.ding(5);
    } else if (fresh) {
      this.fx.text(at, `${fresh} PIN${fresh > 1 ? 'S' : ''}!`, { color: '#ffd23a', size: 34 });
      this.audio.ding(2);
    } else {
      this.fx.text(at, 'GUTTER!', { color: '#ff7a6b', size: 34 });
      this.audio.lose();
    }
    this.hud.set('pins', `${this.down}/${this.total}`);
    this.hud.bump('pins');
    this.phase = 'between';
    this.nextT = 1.4;
  }

  /** One more roll at whatever's standing. */
  revive() {
    this.rolls++;
    this.hud.set('rolls', this.rolls - this.rolled);
    this.removeDummy(this.ball);
    this.load();
    this.cameraFor(true);
  }

  complete() {
    this.phase = 'done';
    const [a, b] = this.def.goals ?? [Math.ceil(this.total * 0.5), Math.ceil(this.total * 0.8)];
    const stars = this.down === this.total ? 3 : this.down >= b ? 2 : this.down >= a ? 1 : 0;
    this.finish({
      passed: stars > 0,
      stars,
      score: this.points,
      reason: `Knock down at least ${a} of the ${this.total}.`,
      stats: [
        ['Down', `${this.down}/${this.total}`],
        ['Rolls', `${this.rolled}`],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    let z = START_Z;
    let x = 0;
    if (this.phase === 'rolling' || this.phase === 'between') {
      const c = this.ball.com(_a);
      z = Math.max(-this.len + 4, Math.min(START_Z, c.z));
      x = THREE.MathUtils.clamp(c.x, -1, 1) * 0.5;
    }
    const pos = new THREE.Vector3(x, portrait ? 4.2 : 3.2, z + (portrait ? 7 : 5.5));
    const look = new THREE.Vector3(x, 0.8, z - (portrait ? 9 : 8));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 3.5);
    this.stage.focusShadows(look, 16);
  }
}

function speedOf(body) {
  const v = body.linvel();
  return Math.hypot(v.x, v.y, v.z);
}
