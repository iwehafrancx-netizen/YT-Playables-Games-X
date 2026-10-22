import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const TOP = 1.2; // platform surface height
const DOWN = { x: 0, y: -1, z: 0 };
const UP = new THREE.Vector3(0, 1, 0);
const LIVES = 3;
const HOP = 4.1;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Low bars are hopped with a tap; tall ones need the full held jump.
const BARS = {
  low: { y: 0.32, h: 0.28, mat: 'toyRed' },
  tall: { y: 0.55, h: 0.75, mat: 'toyOrange' },
};

/**
 * Wipeout: the ragdoll stands on a round stage while sweeper arms come round.
 * Tap to hop the low bars, hold for a big jump over the tall ones, grab the
 * stars in mid-air, and stay on for the whole clock.
 */
export class WipeoutLevel extends Level {
  setup() {
    const def = this.def;
    this.radius = def.radius ?? 6;
    this.spotR = def.spot ?? this.radius - 1.8;
    this.spotA = Math.PI / 2; // facing the camera
    this.lives = LIVES;
    this.left = def.time ?? 20;
    this.starsGot = 0;
    this.phase = 'play';
    this.pstate = 'ok';
    this.holding = false;
    this.lastJump = -9;
    this.lastGround = 0;
    this.starT = 2.5;
    this.star = null;

    this.scenery();
    const out = this.radius + 2.6;
    this.clutter([0.4, 1.5, 2.4, 3.3, 4.3, 5.4].map((a) => [Math.cos(a) * out, -Math.abs(Math.sin(a)) * out]));
    this.stage3d();
    this.arms = (def.arms ?? [{ kind: 'low', speed: 1.4 }]).map((a) => this.makeArm(a));
    this.spawn();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'lives', icon: 'heart', value: this.lives },
        { id: 'time', icon: 'clock', value: Math.ceil(this.left) },
        { id: 'stars', icon: 'star', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Tap to hop the bars · hold for a big jump · stay on till the clock runs out');
    this.cameraFor(true);
  }

  stage3d() {
    const w = this.world;
    const R = this.radius;
    const base = w.mesh(new THREE.CylinderGeometry(R, R + 0.15, TOP, 64), 'toyBlue');
    base.position.y = TOP / 2;
    const top = w.mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.04, 64), 'white', { cast: false });
    top.position.y = TOP + 0.02;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R - 0.35, R - 0.12, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xef4b3c, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.position.y = TOP + 0.05;
    const hub = w.mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.6, 24), 'toyDark');
    hub.position.y = TOP + 0.8;
    w.disposables.push(ring.geometry, ring.material);
    w.add(base, top, ring, hub);
    const body = w.fixedBody([0, TOP / 2, 0], new THREE.Quaternion());
    this.physics.createCollider(RAPIER.ColliderDesc.cylinder(TOP / 2, R).setFriction(1).setCollisionGroups(groups(Group.WORLD)), body, { kind: 'ground', material: 'rubber' });
    this.physics.createCollider(RAPIER.ColliderDesc.cylinder(0.8, 0.6).setTranslation(0, TOP / 2 + 0.8, 0).setCollisionGroups(groups(Group.WORLD)), body, { kind: 'static', material: 'rubber' });
    // Soft landing for anyone thrown off.
    const mat = w.mesh(new THREE.CylinderGeometry(R + 4, R + 4, 0.25, 64), 'toyYellow', { cast: false });
    mat.position.y = 0.125;
    w.add(mat);
  }

  makeArm({ kind = 'low', speed = 1.4, phase = 0, dir = 1, reach }) {
    const spec = BARS[kind];
    const len = (reach ?? this.radius + 0.6) - 0.6;
    const g = new THREE.Group();
    const bar = this.world.mesh(new THREE.BoxGeometry(len, spec.h, 0.32), spec.mat);
    bar.position.set(0.6 + len / 2, spec.y, 0);
    const cap = this.world.mesh(new THREE.SphereGeometry(spec.h * 0.7, 16, 12), 'toyDark');
    cap.position.set(0.6 + len, spec.y, 0);
    g.add(bar, cap);
    this.world.add(g);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, TOP, 0));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(len / 2, spec.h / 2, 0.16).setTranslation(0.6 + len / 2, spec.y, 0).setFriction(0.4).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'arm', material: 'rubber' },
    );
    this.physics.link(body, g);
    return { body, angle: phase, speed, dir, kind };
  }

  spawnPoint() {
    return [Math.cos(this.spotA) * this.spotR, TOP + 0.02, Math.sin(this.spotA) * this.spotR];
  }

  spawn() {
    if (this.dummy) this.removeDummy(this.dummy);
    this.dummy = this.spawnDummy({ position: this.spawnPoint(), yaw: 0, pose: 'ready', muscle: 1 });
    this.dummy.balance = 1;
    this.pstate = 'ok';
    this.physics.snapAll();
  }

  grounded() {
    const pel = this.dummy.parts.pelvis.body.translation();
    const handles = this.dummy.ragdoll.handles;
    const hit = this.physics.castRay({ x: pel.x, y: pel.y, z: pel.z }, DOWN, 1.3, (c) => !handles.has(c.handle));
    return hit && hit.distance < 1.1;
  }

  jump() {
    if (this.phase !== 'play' || this.pstate !== 'ok') return;
    if (this.time - this.lastGround > 0.12 || this.time - this.lastJump < 0.25) return;
    this.lastJump = this.time;
    this.dummy.ragdoll.addVelocity({ x: 0, y: HOP, z: 0 }, 0.4);
    this.dummy.setPose('hop');
    this.audio.jump(false);
    this.fx.puff(this.dummy.partPosition('shinL', _a), { count: 3, size: 0.3, color: 0xe8e8e8, up: 0.2 });
    this.hud.clearHint();
  }

  onPointerDown() {
    this.holding = true;
    this.jump();
  }

  onPointerUp() {
    this.holding = false;
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') {
      this.holding = true;
      this.jump();
    }
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') this.holding = false;
  }

  onContact(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.kind !== 'arm' || y.kind !== 'dummy' || this.dummyFor(y) !== this.dummy) continue;
      if (this.pstate === 'ok') this.knocked();
    }
  }

  knocked() {
    this.pstate = 'down';
    this.downT = 1.1;
    this.dummy.balance = 0;
    this.dummy.knockOut(0.9, 0.5);
    this.dummy.setPose('starfish');
    this.audio.impact(0.9, 'body');
    this.rig.shake(0.4);
    this.fx.text(this.dummy.com(_a).add(UP), 'WHACK!', { color: '#ff7a6b', size: 28 });
  }

  getUp() {
    this.pstate = 'rise';
    this.riseT = 0.6;
    this.dummy.knockout = 0;
    this.dummy.setMuscle(1);
    this.dummy.setPose('ready');
    this.dummy.balance = 1;
    this.dummy.ragdoll.addVelocity({ x: 0, y: 4, z: 0 }, 0.4);
  }

  fall() {
    this.pstate = 'out';
    this.lives--;
    this.hud.set('lives', Math.max(0, this.lives));
    this.hud.bump('lives');
    this.fx.text(this.dummy.com(_a).add(UP), 'WIPEOUT!', { color: '#ff7a6b', size: 32 });
    this.audio.lose();
    this.outT = 1.2;
    if (this.lives <= 0) {
      this.phase = 'end';
      this.passed = false;
      this.endT = 1.4;
    }
  }

  fixedUpdate(dt) {
    const ramp = 1 + (this.def.ramp ?? 0.5) * Math.min(1, this.time / Math.max(1, this.def.time ?? 20));
    for (const arm of this.arms) {
      if (this.phase === 'play' || this.phase === 'end') arm.angle += arm.speed * arm.dir * ramp * dt;
      _q.setFromAxisAngle(UP, arm.angle);
      arm.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    if (!this.dummy) return;
    const d = this.dummy;
    const com = d.com(_a);
    if (this.pstate !== 'out' && (com.y < TOP - 0.5 || Math.hypot(com.x, com.z) > this.radius + 0.4) && this.phase === 'play') this.fall();

    if (this.pstate === 'ok') {
      const onGround = this.grounded();
      if (onGround) this.lastGround = this.time;
      // Holding after a hop stretches it into the big jump.
      if (this.holding && this.time - this.lastJump < 0.32) d.ragdoll.addVelocity({ x: 0, y: -this.gravity * 0.8 * dt, z: 0 }, 1);
      // A gentle pull back to his spot, so a near miss doesn't walk him off.
      const [sx, , sz] = this.spawnPoint();
      const v = d.velocity(_b);
      if (onGround) d.ragdoll.addVelocity({ x: ((sx - com.x) * 2 - v.x) * 0.08, y: 0, z: ((sz - com.z) * 2 - v.z) * 0.08 });
      d.ragdoll.facing.set(0, 0, 1);
      if (onGround && this.time - this.lastJump > 0.25 && d.ragdoll.poseName !== 'ready') d.setPose('ready');
    } else if (this.pstate === 'down') {
      this.downT -= dt;
      if (this.downT <= 0 && this.phase === 'play') this.getUp();
    } else if (this.pstate === 'rise') {
      this.riseT -= dt;
      if (this.riseT <= 0) this.pstate = 'ok';
    } else if (this.pstate === 'out') {
      this.outT -= dt;
      if (this.outT <= 0 && this.phase === 'play' && this.spotClear()) this.spawn();
    }
  }

  /** No arm about to sweep the spot he'd come back on. */
  spotClear() {
    for (const arm of this.arms) {
      const lead = arm.dir > 0 ? -1 : 1;
      const gap = Math.atan2(Math.sin(this.spotA - -arm.angle + lead * 0.3), Math.cos(this.spotA - -arm.angle + lead * 0.3));
      if (Math.abs(gap) < 0.9) return false;
    }
    return true;
  }

  tick(dt) {
    this.cameraFor();
    if (this.phase === 'play') {
      this.left -= dt;
      this.hud.set('time', Math.max(0, Math.ceil(this.left)));
      if (this.left <= 0) {
        this.phase = 'end';
        this.passed = true;
        this.endT = 1.6;
        this.audio.win();
        this.fx.confetti(this.dummy.com(_a).add(UP), 120);
        this.game.ui.banner('SURVIVED!', `${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left`);
        if (this.pstate === 'ok') this.dummy.setPose('cheer');
      }
      this.stars(dt);
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  /** Every few seconds a star hangs over his head for a jump to grab. */
  stars(dt) {
    if (!this.star) {
      this.starT -= dt;
      if (this.starT > 0) return;
      const [x, , z] = this.spawnPoint();
      const m = this.world.mesh(new THREE.OctahedronGeometry(0.3), 'gold', { cast: false });
      m.position.set(x, TOP + 2.25, z);
      this.world.add(m);
      this.star = { m, life: 3.5 };
      return;
    }
    const s = this.star;
    s.life -= dt;
    s.m.rotation.y += dt * 4;
    s.m.scale.setScalar(Math.min(1, s.life * 2));
    const head = this.dummy?.partPosition('head', _a);
    if (head && this.pstate === 'ok' && head.distanceTo(s.m.position) < 0.65) {
      this.starsGot++;
      this.hud.set('stars', this.starsGot);
      this.hud.bump('stars');
      this.audio.coin(this.starsGot % 6);
      this.fx.chips(s.m.position, { count: 14, colors: [0xffd23a, 0xffffff], size: 0.06, speed: 3.5, life: 0.8 });
      s.life = 0;
    }
    if (s.life <= 0) {
      this.world.group.remove(s.m);
      this.star = null;
      this.starT = 2.5 + Math.random() * 2;
    }
  }

  /** One more life, back on the spot. */
  revive() {
    this.lives = 1;
    this.left = Math.max(this.left, 5);
    this.hud.set('lives', 1);
    this.phase = 'play';
    this.pstate = 'out';
    this.outT = 0.2;
  }

  complete() {
    this.phase = 'done';
    const stars = this.passed ? Math.max(1, this.lives) : 0;
    const survived = (this.def.time ?? 20) - Math.max(0, this.left);
    this.finish({
      passed: this.passed,
      stars,
      score: Math.round(survived * 40 + this.starsGot * 150 + (this.passed ? this.lives * 300 : 0)),
      reason: 'Hop the bars and stay on the stage till time runs out.',
      stats: [
        ['Survived', `${Math.round(survived)}s`],
        ['Stars grabbed', `${this.starsGot}`],
        ['Lives left', `${Math.max(0, this.lives)}/${LIVES}`],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const [sx, , sz] = this.spawnPoint();
    const look = new THREE.Vector3(sx * 0.35, TOP + 0.6, sz * 0.35);
    const pos = new THREE.Vector3(look.x, TOP + (portrait ? 11 : 6.2), look.z + (portrait ? 17 : 11));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2, 2);
    this.stage.focusShadows(look, 12);
  }
}
