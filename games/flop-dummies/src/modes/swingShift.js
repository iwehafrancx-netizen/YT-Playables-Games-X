import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';
import { Mat } from '../render/materials.js';

const REACH = 11;
const ROPE = 4.6; // grabbed ropes reel in to this length
const REEL = 7; // m/s
const HAND = { x: 0, y: -0.155, z: 0 }; // tip of the lower arm, in its local frame
const CEILING = 14;
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Swing Shift: a side-on rope course. Hold to grab the nearest hook ahead,
 * let go to fling the dummy; the floor is a crash mat and costs a life.
 */
export class SwingShiftLevel extends Level {
  constructor(game, def, dept) {
    super(game, def, dept);
    this.gravity = -9.5;
  }

  setup() {
    const def = this.def;
    this.lives = def.lives ?? 3;
    this.clock = 0;
    this.started = false;
    this.rope = null;
    this.hooks = [];
    this.checks = [];
    this.length = def.finish.x + def.finish.w;

    this.backdrop();
    this.platform({ x: 0, y: def.start ?? 4, w: 4 }, 'check');
    for (const h of def.hooks) this.addHook(h);
    for (const s of def.springs ?? []) this.world.trampoline({ pos: [s.x, s.y, 0], size: [s.w ?? 2.6, 3], power: s.power ?? 13 });
    for (const b of def.blocks ?? []) this.platform(b, 'static');
    for (const c of def.checks ?? []) this.platform(c, 'check');
    for (const r of def.rotors ?? []) this.world.rotor({ pos: [r.x, r.y, 0], length: r.length ?? 5, speed: r.speed ?? 1.2, phase: r.phase ?? 0 });
    this.platform(def.finish, 'finish');
    def.build?.(this.world, this);
    this.makeRope();

    this.spawn = new THREE.Vector3(0, def.start ?? 4, 0);
    this.dummy = this.spawnDummy({ position: this.spawn.toArray(), yaw: Math.PI / 2, pose: 'ready', muscle: 1 });
    this.dummy.balance = 1;
    this.phase = 'ready';

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'lives', icon: 'dummy', value: this.lives },
        { id: 'time', icon: 'clock', value: '0.0' },
        { id: 'par', icon: 'star', value: `${def.par}s` },
      ],
    });
    this.hud.hint(def.hint ?? 'Hold to grab a hook · let go to fling him forward');
    this.cameraFor(this.dummy.com(), true);
  }

  backdrop() {
    const w = this.world;
    const L = this.length;
    w.ground({ mat: 'concrete', tile: 6 });
    // The crash mat under the whole course: touching it means a fall.
    w.block({ pos: [L / 2, 0.15, 0], size: [L + 30, 0.3, 7], mat: 'crashMat', tile: 2, kind: 'pit', friction: 1.2 });
    w.block({ pos: [L / 2, 4, -9], size: [L + 60, 8, 0.6], mat: 'wall', tile: 3 });
    w.block({ pos: [L / 2, CEILING + 0.3, 0], size: [L + 30, 0.6, 0.5], mat: 'steelOrange', tile: 2, cast: false });
    for (let x = -10; x < L + 20; x += 12) {
      w.block({ pos: [x, CEILING / 2, -3.8], size: [0.5, CEILING, 0.5], mat: 'steelOrange', tile: 2 });
      w.block({ pos: [x, CEILING + 0.3, -1.9], size: [0.5, 0.5, 4.2], mat: 'steelOrange', tile: 2, cast: false });
    }
    for (let x = 6; x < L + 10; x += 24) w.lamp({ pos: [x, 0, -7.5], yaw: 0, height: 9 });
  }

  /** `y` is the top surface. */
  platform({ x, y, w = 3, h }, kind) {
    const height = h ?? y;
    const mat = kind === 'finish' ? 'steelGreen' : kind === 'check' ? 'concreteDark' : 'steelGrey';
    const b = this.world.block({ pos: [x, y - height / 2, 0], size: [w, height, 3], mat, tile: 1.5, kind, friction: 1.2 });
    if (kind === 'check') this.checks.push({ x, y, w, reached: x === 0 });
    if (kind === 'finish') {
      this.finishGate(x + w / 2 - 0.5, y);
      // Padded backstop so a big fling still ends on the pad.
      this.world.block({ pos: [x + w / 2 + 0.4, (y + 5) / 2, 0], size: [0.8, y + 5, 3], mat: 'foam', tile: 1.5, kind: 'finish', friction: 1.2 });
    }
    if (kind !== 'static') this.world.block({ pos: [x, y + 0.01, 1.35], size: [w, 0.02, 0.3], mat: 'hazard', tile: 1, cast: false });
    return b;
  }

  finishGate(x, y) {
    const w = this.world;
    const g = new THREE.Group();
    for (const z of [-1.4, 1.4]) {
      const post = w.mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 10), 'steelGrey');
      post.position.set(0, 1.7, z);
      g.add(post);
    }
    const banner = w.mesh(new THREE.BoxGeometry(0.08, 0.7, 3), 'hazard');
    banner.position.y = 3.2;
    g.add(banner);
    g.position.set(x, y, 0);
    w.add(g);
  }

  addHook(h) {
    const w = this.world;
    const g = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.34, 0.08, 10, 28);
    const ring = new THREE.Mesh(ringGeo, Mat.gold());
    ring.castShadow = true;
    const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
    cableGeo.translate(0, 0.5, 0);
    const cable = new THREE.Mesh(cableGeo, Mat.darkSteel());
    cable.position.y = 0.34;
    cable.scale.y = CEILING - h.y - 0.34;
    w.disposables.push(ringGeo, cableGeo);
    g.add(ring, cable);
    w.add(g);
    const base = new THREE.Vector3(h.x, h.y, 0);
    const desc = h.move ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    const body = this.physics.createBody(desc.setTranslation(h.x, h.y, 0));
    const hook = { base, body, ring, g };
    if (h.move) {
      const { dx = 0, dy = 0, speed = 1, phase = 0 } = h.move;
      w.mover({ body, object: g, fn: (t) => { const k = Math.sin(phase + t * speed); return { pos: [h.x + dx * k, h.y + dy * k, 0] }; } });
    } else {
      g.position.copy(base);
    }
    this.hooks.push(hook);
  }

  makeRope() {
    const geo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    geo.translate(0, 0.5, 0);
    this.ropeMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.8 }));
    this.ropeMesh.visible = false;
    this.world.add(this.ropeMesh);
    this.world.disposables.push(geo, this.ropeMesh.material);
  }

  hookPos(h, out = new THREE.Vector3()) {
    const t = h.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  handPos(out = new THREE.Vector3()) {
    const b = this.dummy.parts.lowerArmR.body;
    const t = b.translation();
    const r = b.rotation();
    return out.set(HAND.x, HAND.y, HAND.z).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_t.set(t.x, t.y, t.z));
  }

  /** Nearest hook in reach that isn't behind him. */
  target() {
    const com = this.dummy.com();
    let best = null;
    let bestD = REACH;
    for (const h of this.hooks) {
      const p = this.hookPos(h, _v);
      if (p.x < com.x - 1.5 || p.y < com.y + 0.5) continue;
      const d = p.distanceTo(com);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  cameraFor(c, snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const ahead = portrait ? 3 : 5;
    const y = THREE.MathUtils.clamp(c.y, 3.5, 9);
    const pos = new THREE.Vector3(c.x + ahead, y + (portrait ? 2.4 : 1.2), portrait ? 17 : 12.5);
    const look = new THREE.Vector3(c.x + ahead, y + (portrait ? 1.6 : 0.4), 0);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3.5, 5);
    this.stage.focusShadows(look, 22);
  }

  onPointerDown() {
    this.holding = true;
    if (this.phase === 'ready') this.leap();
    if (this.phase === 'swing') this.grab();
  }

  onPointerUp() {
    this.holding = false;
    if (this.rope) this.release();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.onPointerDown();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.onPointerUp();
  }

  leap() {
    this.phase = 'swing';
    this.started = true;
    this.hud.clearHint();
    const d = this.dummy;
    d.balance = 0;
    d.setPose('hop');
    d.ragdoll.addVelocity({ x: 4.5, y: 6, z: 0 }, 0);
    this.audio.jump(true);
  }

  grab() {
    if (this.rope) return;
    const h = this.target();
    if (!h) return;
    const hand = this.handPos();
    const len = Math.max(2.2, hand.distanceTo(this.hookPos(h, _v)));
    this.rope = { hook: h, joint: this.tie(h, len), len };
    this.dummy.setPose('hang');
    this.dummy.setMuscle(0.7);
    this.audio.click();
    this.audio.whoosh(0.4);
    h.ring.scale.setScalar(1.35);
  }

  tie(hook, len) {
    const data = RAPIER.JointData.rope(len, { x: 0, y: 0, z: 0 }, HAND);
    return this.physics.world.createImpulseJoint(data, hook.body, this.dummy.parts.lowerArmR.body, true);
  }

  /** Rope joints can't change length, so reeling in re-ties a slightly shorter one. */
  reel(dt) {
    const r = this.rope;
    const goal = this.def.rope ?? ROPE;
    if (r.len <= goal) return;
    r.len = Math.max(goal, r.len - REEL * dt);
    this.physics.world.removeImpulseJoint(r.joint, true);
    r.joint = this.tie(r.hook, r.len);
  }

  release() {
    this.physics.world.removeImpulseJoint(this.rope.joint, true);
    this.rope = null;
    this.ropeMesh.visible = false;
    const d = this.dummy;
    d.setPose('starfish');
    const v = d.velocity(_v);
    // A small lift on a forward release keeps the flight floaty and readable.
    if (v.x > 2) d.ragdoll.addVelocity({ x: 0.6, y: 1.6, z: 0 });
    this.audio.whoosh(Math.min(1.2, v.length() / 12));
  }

  fixedUpdate(dt) {
    if (this.phase !== 'swing') return;
    const R = this.dummy.ragdoll;
    // Keep him in the plane of the course.
    const com = R.centerOfMass(_v);
    const vz = R.velocity(_w).z;
    R.addVelocity({ x: 0, y: 0, z: -vz * 0.15 - com.z * 2.5 * dt });
    if (this.rope) {
      this.reel(dt);
      // Pump: every swing adds a little energy, as a kid on a swing would.
      const v = R.velocity(_w);
      v.z = 0;
      const s = v.length();
      if (s > 0.5 && s < 14) R.addVelocity(v.multiplyScalar((3.4 * dt) / s));
    }
  }

  onContact(a, b) {
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!dummy) return;
    const other = dummy === a ? b : a;
    if (this.phase !== 'swing') return;
    if (other.kind === 'pit' || other.kind === 'ground') this.fall();
    else if (other.kind === 'hazard') this.fall(other.label);
    else if (other.kind === 'finish') this.win();
    else if (other.kind === 'check') this.checkpoint();
  }

  checkpoint() {
    const com = this.dummy.com();
    for (const c of this.checks) {
      if (c.reached || Math.abs(com.x - c.x) > c.w / 2 + 0.5) continue;
      c.reached = true;
      this.spawn.set(c.x, c.y, 0);
      this.game.ui.banner('CHECKPOINT');
      this.audio.ding(2);
      this.fx.confetti(new THREE.Vector3(c.x, c.y + 1, 0), 40);
    }
  }

  fall(label = 'OOF!') {
    this.phase = 'fallen';
    this.fallT = 1.1;
    if (this.rope) this.release();
    this.lives--;
    this.hud.set('lives', this.lives);
    this.hud.bump('lives');
    this.dummy.knockOut(2, 1);
    this.audio.impact(0.8, 'rubber');
    this.rig.shake(0.3);
    this.game.ui.banner(this.lives > 0 ? label : 'OUT OF DUMMIES', this.lives > 0 ? `${this.lives} left` : '');
  }

  respawn() {
    const d = this.dummy;
    d.knockout = 0;
    d.setMuscle(1);
    d.ragdoll.teleport([this.spawn.x, this.spawn.y, 0], Math.PI / 2, 'ready');
    d.balance = 1;
    this.phase = 'ready';
    this.fx.puff(this.spawn.clone().add(UP), { count: 8, color: 0xffffff, size: 0.6 });
    this.audio.pop();
    this.hud.hint('Hold to jump and grab');
  }

  win() {
    this.phase = 'won';
    this.wonT = 2;
    if (this.rope) this.release();
    const par = this.def.par;
    const fast = this.clock <= par;
    this.game.ui.banner(fast ? 'UNDER PAR!' : 'FINISHED!', `${this.clock.toFixed(1)}s`);
    this.audio.win();
    this.fx.confetti(this.dummy.com().add(UP), 140);
    this.dummy.setPose('cheer');
  }

  tick(dt) {
    const com = this.dummy.com();
    if (this.started && (this.phase === 'swing' || this.phase === 'ready' || this.phase === 'fallen')) {
      this.clock += dt;
      this.hud.set('time', this.clock.toFixed(1));
    }
    this.cameraFor(com);

    const aim = this.phase === 'swing' && !this.rope ? this.target() : null;
    for (const h of this.hooks) {
      const s = h === aim ? 1.15 + Math.sin(this.time * 10) * 0.1 : 1;
      h.ring.scale.setScalar(THREE.MathUtils.damp(h.ring.scale.x, h === this.rope?.hook ? 1 : s, 10, dt));
      h.ring.material = h === aim || h === this.rope?.hook ? Mat.glowGreen() : Mat.gold();
    }

    if (this.rope) {
      const a = this.hookPos(this.rope.hook);
      const b = this.handPos(_w);
      const dir = _v.copy(b).sub(a);
      const len = dir.length();
      this.ropeMesh.visible = true;
      this.ropeMesh.position.copy(a);
      this.ropeMesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      this.ropeMesh.scale.set(1, len, 1);
    }

    if (this.phase === 'swing') {
      this.audio.loop('wind', Math.min(1, this.dummy.speed() / 16), 'wind');
      if (com.y < -3 || com.x < -12) this.fall();
      if (this.holding && !this.rope) this.grab();
    } else {
      this.audio.loop('wind', 0, 'wind');
    }

    if (this.phase === 'fallen') {
      this.fallT -= dt;
      if (this.fallT <= 0) {
        if (this.lives > 0) this.respawn();
        else this.complete(false);
      }
    }

    if (this.phase === 'won') {
      this.wonT -= dt;
      if (this.wonT <= 0) this.complete(true);
    }
  }

  /** One more dummy, back at the last checkpoint. */
  revive() {
    this.lives = 1;
    this.hud.set('lives', this.lives);
    this.respawn();
  }

  complete(passed) {
    this.phase = 'done';
    const par = this.def.par;
    const t = this.clock;
    const stars = !passed ? 0 : t <= par ? 3 : t <= par * 1.5 ? 2 : 1;
    const score = passed ? 1000 + this.lives * 250 + Math.max(0, Math.round((par * 1.6 - t) * 60)) : 0;
    this.finish({
      passed,
      stars,
      score,
      reason: 'Reach the finish pad before you run out of dummies.',
      stats: [
        ['Time', passed ? `${t.toFixed(1)}s (par ${par}s)` : '—'],
        ['Dummies left', `${Math.max(0, this.lives)}`],
      ],
    });
  }
}
