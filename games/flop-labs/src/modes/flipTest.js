import * as THREE from 'three';
import { AttemptLevel } from './attemptLevel.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const AXIS = new THREE.Vector3(-1, 0, 0); // a backflip for a dummy facing +Z
const SPIN = 11; // rad/s while tucked
const TAU = Math.PI * 2;
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * Flip Test: the springboard throws him up, holding tucks him into a
 * backflip, letting go opens him up. Land on his feet to keep the points.
 */
export class FlipTestLevel extends AttemptLevel {
  setupRun() {
    const def = this.def;
    this.phase = 'ready';
    this.holding = false;
    this.turned = 0;
    this.prevAngle = 0;
    this.airT = 0;
    this.landT = 0;
    this.landed = null;
    this.lastFlip = 0;

    this.yard({ fences: true, extent: 40 });
    const [x, y, z] = def.board ?? [0, 0, 0];
    this.boardPos = new THREE.Vector3(x, y, z);
    this.buildBoard();
    this.mats = (def.mats ?? [{ z: z, w: 4, d: 4 }]).map((m) => this.mat(m));
    def.build?.(this.world, this);

    this.dummy = this.spawnDummy({ position: [x, y + 0.36, z], yaw: 0, pose: 'ready', muscle: 1 });
    this.dummy.balance = 1;

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'try', icon: 'dummy', value: `${this.attempt}/${this.attempts}` },
        { id: 'run', icon: 'retry', value: '0' },
        { id: 'best', icon: 'star', value: this.bestLabel() },
      ],
    });
    this.hud.hint(this.attempt === 1 ? def.hint ?? 'Tap to jump · hold to flip · let go to land on your feet' : `Attempt ${this.attempt} — beat ${this.bestRun.toLocaleString()}`);
    this.cameraFor(this.dummy.com(), true);
  }

  /** Springboard: a sprung plate on a tower when the level starts up high. */
  buildBoard() {
    const w = this.world;
    const p = this.boardPos;
    if (p.y > 0.3) w.block({ pos: [p.x, (p.y - 0.18) / 2, p.z], size: [2.2, p.y - 0.18, 2.2], mat: 'concreteDark', tile: 1.5 });
    w.block({ pos: [p.x, p.y - 0.09, p.z], size: [2, 0.18, 2], mat: 'steelBlue', tile: 1, kind: 'board' });
    this.plate = w.mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), 'hazard');
    this.plate.position.set(p.x, p.y + 0.05, p.z);
    w.add(this.plate);
    this.boing = 0;
  }

  /** Landing mat; `y` is its top, `move` slides it along Z. */
  mat({ x = 0, z, y = 0.4, w = 4, d = 4, move }) {
    const h = Math.max(0.35, y);
    const desc = move ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    const body = this.physics.createBody(desc.setTranslation(x, y - h / 2, z));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(1.2).setCollisionGroups(groups(Group.WORLD)), body, { kind: 'mat', material: 'rubber' });
    const g = new THREE.Group();
    const base = this.world.mesh(new THREE.BoxGeometry(w, h, d), 'foam');
    const stripe = this.world.mesh(new THREE.BoxGeometry(w * 0.5, 0.02, d * 0.5), 'hazard', { cast: false });
    stripe.position.y = h / 2 + 0.01;
    g.add(base, stripe);
    this.world.add(g);
    const m = { body, x, y, z, w, d };
    if (move) {
      const { dz = 0, dx = 0, speed = 1, phase = 0 } = move;
      this.world.mover({ body, object: g, fn: (t) => { const k = Math.sin(phase + t * speed); return { pos: [x + dx * k, y - h / 2, z + dz * k] }; } });
    } else {
      g.position.set(x, y - h / 2, z);
    }
    return m;
  }

  onMat(p) {
    return this.mats.some((m) => {
      const t = m.body.translation();
      return Math.abs(p.x - t.x) < m.w / 2 + 0.2 && Math.abs(p.z - t.z) < m.d / 2 + 0.2 && p.y > m.y - 0.5;
    });
  }

  cameraFor(c, snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const mid = (this.def.mats?.at(-1)?.z ?? this.boardPos.z) * 0.5 + this.boardPos.z * 0.5;
    const look = new THREE.Vector3(c.x, Math.max(1.6, c.y * 0.7 + 0.8), THREE.MathUtils.lerp(mid, c.z, 0.5));
    const pos = look.clone().add(new THREE.Vector3(portrait ? 13 : 9.5, portrait ? 2.5 : 1.6, 0));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 4);
    this.stage.focusShadows(look, 16);
  }

  onPointerDown() {
    this.holding = true;
    if (this.phase === 'ready') this.launch();
  }

  onPointerUp() {
    this.holding = false;
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.onPointerDown();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.onPointerUp();
  }

  launch() {
    const [fwd, up] = this.def.launch ?? [0, 12];
    this.phase = 'air';
    this.hud.clearHint();
    const d = this.dummy;
    d.balance = 0;
    d.setMuscle(0.9);
    d.ragdoll.addVelocity({ x: 0, y: up, z: fwd }, 0);
    this.prevAngle = this.chestAngle();
    this.boing = 1;
    this.audio.spring();
    this.audio.whoosh(1);
    this.fx.puff(this.boardPos.clone(), { count: 6, color: 0xffffff, size: 0.5 });
  }

  /** Chest tilt about the flip axis, from upright. */
  chestAngle() {
    const r = this.dummy.parts.chest.body.rotation();
    _up.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
    return Math.atan2(-_up.z, _up.y);
  }

  fixedUpdate(dt) {
    if (this.phase !== 'air' || this.landed) return;
    const R = this.dummy.ragdoll;
    const spin = R.parts.chest.body.angvel();
    const now = _w.set(spin.x, spin.y, spin.z).dot(AXIS);
    if (this.holding) {
      if (R.poseName !== 'tuck') this.dummy.setPose('tuck');
      R.addSpin(AXIS.clone().multiplyScalar((SPIN - now) * 0.2));
    } else {
      if (R.poseName !== 'stand') this.dummy.setPose('stand');
      // Opening up kills the rotation, like a diver coming out of a tuck.
      R.addSpin(AXIS.clone().multiplyScalar(-now * 0.12));
    }
    const a = this.chestAngle();
    let da = a - this.prevAngle;
    if (da > Math.PI) da -= TAU;
    if (da < -Math.PI) da += TAU;
    this.turned += da;
    this.prevAngle = a;
  }

  flips() {
    return Math.floor((Math.abs(this.turned) + 0.6) / TAU);
  }

  onContact(a, b) {
    if (this.phase !== 'air' || this.landed || this.airT < 0.3) return;
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!dummy) return;
    const other = dummy === a ? b : a;
    if (other.ragdoll) return;
    this.touchdown(Boolean(dummy.foot) || dummy.part === 'shinL' || dummy.part === 'shinR');
  }

  touchdown(feet) {
    const r = this.dummy.parts.chest.body.rotation();
    _up.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
    const upright = feet && _up.y > 0.55;
    const pelvis = this.dummy.partPosition('pelvis');
    this.landed = { upright, onMat: this.onMat(pelvis), flips: this.flips(), clean: _up.y > 0.85 };
    this.landT = 0;
    const d = this.dummy;
    if (upright) {
      d.setPose('ready');
      d.setMuscle(1);
      d.balance = 1;
      d.ragdoll.facing.set(0, 0, 1);
    } else {
      d.setPose('starfish');
      d.knockOut(2.5, 1.5);
      this.audio.impact(1, 'body');
      this.rig.shake(0.3);
    }
  }

  tick(dt) {
    this.boing = Math.max(0, this.boing - dt * 4);
    this.plate.position.y = this.boardPos.y + 0.05 + Math.sin(this.boing * 9) * this.boing * 0.12;

    if (this.phase === 'ready') {
      this.cameraFor(this.dummy.com());
      return;
    }

    if (this.phase === 'air') {
      this.airT += dt;
      const com = this.dummy.com();
      this.cameraFor(com);
      this.hud.set('run', this.landed ? this.landed.flips : this.flips());
      this.audio.loop('wind', Math.min(1, this.dummy.speed() / 14), 'wind');
      if (this.flips() > this.lastFlip) {
        this.lastFlip = this.flips();
        this.fx.text(com.clone().add(new THREE.Vector3(0, 1.2, 0)), this.lastFlip === 1 ? 'FLIP!' : `${this.lastFlip}× FLIP!`, { color: '#9fe8ff', size: 26, life: 0.8 });
        this.audio.coin(this.lastFlip);
      }
      if (this.landed) {
        this.landT += dt;
        if (this.landT > 1) this.scoreRun();
      } else if (this.airT > 8 || com.y < -4) {
        this.touchdown(false);
      }
    }

    if (this.phase === 'between') this.tickBetween(dt);
  }

  /** Flips only really pay when he lands on his feet; a wipeout keeps a little for style. */
  scoreRun() {
    this.audio.loop('wind', 0, 'wind');
    const l = this.landed;
    const head = this.dummy.partPosition('head');
    const pelvis = this.dummy.partPosition('pelvis');
    const stuck = l.upright && head.y > pelvis.y + 0.35;
    const at = head.clone().add(new THREE.Vector3(0, 0.8, 0));
    let pts = l.flips * 150;
    let label = 'WIPEOUT!';
    if (stuck) {
      pts = l.flips ? Math.round((l.flips * 600 + (l.onMat ? 400 : 0)) * (l.clean ? 1.25 : 1)) : l.onMat ? 200 : 100;
      label = l.flips === 0 ? 'NO FLIP' : l.clean ? 'PERFECT LANDING!' : 'STUCK IT!';
      this.fx.confetti(at, 40 + l.flips * 40);
      this.audio.ding(2 + l.flips);
      this.dummy.setPose('cheer');
    }
    this.fx.text(at, `${label} +${pts}`, { color: stuck ? '#7dffb7' : '#ff9a8a', size: 30, life: 1.6 });
    this.runScore = pts;
    this.endRun();
  }
}
