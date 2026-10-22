import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const LANE = 6.5; // half-width of the climb
const AIR_SPEED = 5.5; // m/s of steering in the air
const PAD_D = 2.2;
const PAD_COLORS = ['toyBlue', 'toyGreen', 'toyOrange', 'toyPink'];
const _a = new THREE.Vector3();

/**
 * Bounce Up: a tower of trampolines. The ragdoll bounces on its own; you steer
 * him left and right in the air to land on the next pad up. Miss and you fall
 * back down to a lower one, so the clock is the real enemy.
 */
export class BounceUpLevel extends Level {
  setup() {
    const def = this.def;
    this.goalY = def.height;
    // The flag sits off to the side of the last pad so he can't bump his head on it.
    this.goalX = def.goalX ?? (def.pads.at(-1).x <= 0 ? 3 : -3);
    this.left = def.time ?? 40;
    this.steer = 0;
    this.keys = { left: false, right: false };
    this.phase = 'play';
    this.got = 0;
    this.best = 0;
    this.pickups = [];
    this.movers = [];

    this.scenery({ extent: 30 });
    this.clutter([[-9, 1.5], [9, 1], [10.5, -3]]);
    this.pad({ x: 0, y: 0.6, w: LANE * 2, power: 8.8, mat: 'toyRed' });
    for (const [i, p] of def.pads.entries()) this.pad({ ...p, mat: p.amp ? 'toyPurple' : PAD_COLORS[i % PAD_COLORS.length] });
    for (const p of def.pickups ?? []) this.pickup(p);
    this.goal();
    for (const s of [-1, 1]) {
      const wall = this.world.mesh(new THREE.BoxGeometry(0.3, this.goalY + 8, PAD_D), 'white');
      wall.position.set(s * (LANE + 0.15), (this.goalY + 8) / 2, 0);
      this.world.add(wall);
      const body = this.world.fixedBody([s * (LANE + 0.15), (this.goalY + 8) / 2, 0], new THREE.Quaternion());
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(0.15, (this.goalY + 8) / 2, PAD_D).setRestitution(0.5).setCollisionGroups(groups(Group.WORLD)), body);
    }

    this.dummy = this.spawnDummy({ position: [0, 1.4, 0], yaw: 0, pose: 'starfish', muscle: 0.55 });
    this.physics.snapAll();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'time', icon: 'clock', value: Math.ceil(this.left) },
        { id: 'stars', icon: 'star', value: `0/${this.pickups.length}` },
      ],
    });
    this.hud.meter('Height', 0);
    this.hud.hint(def.hint ?? 'Hold left or right to steer · land on the pads and bounce to the top');
    this.cameraFor(true);
  }

  pad({ x, y, w = 2.4, power = 8.2, mat, amp = 0, sp = 1, ph = 0 }) {
    const g = new THREE.Group();
    const frame = this.world.mesh(new THREE.BoxGeometry(w + 0.2, 0.2, PAD_D), mat);
    const top = this.world.mesh(new THREE.BoxGeometry(w, 0.06, PAD_D - 0.2), 'toyDark');
    top.position.y = 0.12;
    g.add(frame, top);
    g.position.set(x, y, 0);
    this.world.add(g);
    const desc = amp ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    const body = this.physics.createBody(desc.setTranslation(x, y, 0));
    const spring = { kind: 'spring', pad: top, power, squash: 0, group: g, half: w / 2 };
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2 + 0.1, 0.14, PAD_D / 2).setFriction(0.9).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'spring', spring, material: 'rubber' },
    );
    this.world.springs.push(spring);
    if (amp) {
      this.physics.link(body, g);
      this.movers.push({ body, x, y, amp, sp, ph });
    }
  }

  pickup({ x, y }) {
    const m = this.world.mesh(new THREE.OctahedronGeometry(0.34), 'gold', { cast: false });
    m.position.set(x, y, 0);
    this.world.add(m);
    this.pickups.push({ x, y, m, got: false });
  }

  goal() {
    const w = this.world;
    const y = this.goalY;
    const x = this.goalX;
    const s = Math.sign(x);
    const plat = w.mesh(new THREE.BoxGeometry(3.6, 0.4, PAD_D), 'toyGreen');
    plat.position.set(x, y - 0.2, 0);
    const pole = w.mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), 'toyDark');
    pole.position.set(x + s * 1.4, y + 1.2, -0.6);
    const flag = w.mesh(new THREE.BoxGeometry(1, 0.6, 0.04), 'toyRed', { cast: false });
    flag.position.set(x + s * 1.9, y + 2.1, -0.6);
    w.add(plat, pole, flag);
    const body = w.fixedBody([x, y - 0.2, 0], new THREE.Quaternion());
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(1.8, 0.2, PAD_D / 2).setFriction(1).setCollisionGroups(groups(Group.WORLD)), body, { kind: 'static', material: 'rubber' });
  }

  // ---------- input ----------

  onPointerDown(p) {
    this.steer = p.x < 0.5 ? -1 : 1;
    this.hud.clearHint();
  }

  onPointerMove(p) {
    this.steer = p.x < 0.5 ? -1 : 1;
  }

  onPointerUp() {
    this.steer = 0;
  }

  onKeyDown(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = true;
    this.hud.clearHint();
  }

  onKeyUp(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = false;
  }

  // ---------- play ----------

  fixedUpdate(dt) {
    for (const m of this.movers) m.body.setNextKinematicTranslation({ x: m.x + Math.sin(this.time * m.sp + m.ph) * m.amp, y: m.y, z: 0 });
    const d = this.dummy;
    const R = d.ragdoll;
    const c = d.com(_a);
    const v = d.velocity();
    // Air control, and a soft pull keeping him in the plane of the tower.
    const dir = this.phase === 'play' ? this.steer + (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0) : 0;
    const want = THREE.MathUtils.clamp(dir, -1, 1) * AIR_SPEED;
    const k = dir ? 0.12 : 0.03;
    R.addVelocity({ x: (want - v.x) * k, y: 0, z: (-c.z * 3 - v.z) * 0.2 });

    if (this.phase !== 'play') return;
    // Came to rest on a pad without a fresh contact: throw him up anyway.
    if (Math.abs(v.y) < 0.6 && this.time - (d.lastBounce ?? 0) > 0.6) {
      const pad = this.world.springs.find((s) => Math.abs(c.x - s.group.position.x) < s.half + 0.2 && c.y - s.group.position.y > 0 && c.y - s.group.position.y < 1.5);
      if (pad) this.launch(d, pad);
    }
    this.best = Math.max(this.best, c.y);
    for (const p of this.pickups) {
      if (p.got || Math.hypot(c.x - p.x, c.y - p.y) > 0.9) continue;
      p.got = true;
      p.m.visible = false;
      this.got++;
      this.hud.set('stars', `${this.got}/${this.pickups.length}`);
      this.hud.bump('stars');
      this.audio.coin(this.got % 6);
      this.fx.chips(_a.set(p.x, p.y, 0.3), { count: 12, colors: [0xffd23a, 0xffffff], size: 0.06, speed: 3, life: 0.7 });
    }
    // Made it: standing (or sprawled) on the goal platform.
    if (c.y > this.goalY - 0.1 && Math.abs(c.x - this.goalX) < 2 && c.y < this.goalY + 2) this.win();
  }

  /** Every pad throws him to the same height however he lands, so the climb is about aim. */
  bounce(spring, info) {
    const d = this.dummyFor(info);
    if (d) this.launch(d, spring);
  }

  launch(d, spring) {
    if (d.lastBounce && this.time - d.lastBounce < 0.3) return;
    const v = d.velocity(_a);
    if (v.y > 1) return;
    d.lastBounce = this.time;
    d.ragdoll.addVelocity({ x: v.x * 0.2, y: spring.power - v.y * 0.3, z: -v.z * 0.3 }, 0.3);
    spring.squash = 1;
    this.audio.spring();
    this.fx.puff(d.com(_a), { count: 4, color: 0xffffff, size: 0.45 });
  }

  onImpact(a, b, force, strength) {
    const me = this.dummyFor(a.kind === 'dummy' ? a : b);
    const other = a.kind === 'dummy' ? b : a;
    if (me === this.dummy && other.kind === 'spring' && strength > 0.1) this.fx.puff(this.dummy.com(_a), { count: 3, size: 0.4, color: 0xffffff });
  }

  win() {
    this.phase = 'end';
    this.passed = true;
    this.endT = 1.6;
    this.audio.win();
    this.fx.confetti(new THREE.Vector3(this.goalX, this.goalY + 1, 0), 140);
    this.dummy.setPose('cheer');
    this.dummy.setMuscle(1);
    this.game.ui.banner('TOP OF THE TOWER!', `${Math.ceil(this.left)}s to spare`);
  }

  tick(dt) {
    this.cameraFor();
    for (const p of this.pickups) p.m.rotation.y += dt * 3;
    if (this.phase === 'play') {
      this.left -= dt;
      this.hud.set('time', Math.max(0, Math.ceil(this.left)));
      this.hud.meter('Height', this.dummy.com(_a).y / this.goalY);
      if (this.left <= 0) {
        this.phase = 'end';
        this.passed = false;
        this.endT = 0.8;
        this.game.ui.banner("TIME'S UP!", `Best ${this.best.toFixed(1)} m`);
      }
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  /** Fifteen more seconds on the clock. */
  revive() {
    this.left = 15;
    this.phase = 'play';
  }

  complete() {
    this.phase = 'done';
    const total = this.def.time ?? 40;
    const spare = Math.max(0, this.left) / total;
    const stars = !this.passed ? 0 : spare >= 0.45 || (spare >= 0.25 && this.got === this.pickups.length) ? 3 : spare >= 0.2 ? 2 : 1;
    this.finish({
      passed: this.passed,
      stars,
      score: Math.round((this.passed ? 1500 + Math.max(0, this.left) * 40 : this.best * 60) + this.got * 150),
      reason: `Bounce all the way to the flag at ${this.goalY} m before time runs out.`,
      stats: [
        ['Height', `${this.passed ? this.goalY : this.best.toFixed(1)} m`],
        ['Stars', `${this.got}/${this.pickups.length}`],
        ['Time left', `${Math.max(0, Math.ceil(this.left))}s`],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const c = this.dummy.com(_a);
    const y = Math.max(4, c.y + 1);
    const { pos, look } = this.frameBox(_a.set(-LANE, y - 4, -1), new THREE.Vector3(LANE, y + (portrait ? 5 : 8), 1), { pitch: 14 });
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 4);
    this.stage.focusShadows(look, 12);
  }
}
