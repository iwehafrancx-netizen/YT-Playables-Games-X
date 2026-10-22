import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const W = 8; // table width
const L = 15; // table length
const TILT = THREE.MathUtils.degToRad(15);
// Centre of the playfield; high enough that the low end clears the studio floor.
const ORIGIN = new THREE.Vector3(0, 3, 0);
const FLIP_LEN = 1.65;
const FLIP_REST = 0.5; // radians below horizontal
const FLIP_UP = 0.45;
const FLIP_SPEED = 20; // rad/s up
const FLIP_DROP = 10;
const KICK = 7.5; // m/s off a bumper
const Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Ragdoll Pinball: the ragdoll curls into a ball and the table does the rest.
 * Tap the left or right side to flip; bumpers, slingshots and star rollovers
 * score. Three balls, and the ball is a person.
 */
export class PinballLevel extends Level {
  setup() {
    const def = this.def;
    this.balls = def.balls ?? 3;
    this.score = 0;
    this.phase = 'play';
    this.tableQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), TILT);
    this.bumpers = [];
    this.rollovers = [];
    this.flippers = [];
    this.lastKick = new Map();

    this.scenery();
    this.clutter([[-7.5, 2], [7.5, 1], [-6.5, -6]]);
    this.table();
    for (const b of def.bumpers ?? []) this.bumper(b);
    for (const r of def.rollovers ?? []) this.rollover(r);
    for (const p of def.posts ?? []) this.post(p);
    this.flippers.push(this.flipper(-1), this.flipper(1));
    this.serve();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'balls', icon: 'dummy', value: this.balls },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.meter('Target', 0);
    this.hud.hint(def.hint ?? 'Tap left or right to flip · keep him off the drain');
    this.cameraFor(true);
  }

  /** Table space (x across, y up off the glass, z down-table) to world. */
  toWorld(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(this.tableQ).add(ORIGIN);
  }

  toTable(p, out = new THREE.Vector3()) {
    return out.copy(p).sub(ORIGIN).applyQuaternion(_q.copy(this.tableQ).invert());
  }

  fixed(x, y, z, rotY = 0) {
    const q = this.tableQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, rotY));
    const p = this.toWorld(x, y, z);
    return this.physics.createBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  }

  place(mesh, x, y, z, rotY = 0) {
    this.toWorld(x, y, z, mesh.position);
    mesh.quaternion.copy(this.tableQ).multiply(new THREE.Quaternion().setFromAxisAngle(Y, rotY));
    this.world.add(mesh);
    return mesh;
  }

  slick(desc, bounce = 0.3) {
    return desc
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(bounce)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(groups(Group.WORLD));
  }

  wall(x, z, len, rotY, mat = 'toyBlue', h = 1.1, thick = 0.25) {
    this.place(this.world.mesh(new THREE.BoxGeometry(len, h, thick), mat), x, h / 2, z, rotY);
    const b = this.fixed(x, h / 2, z, rotY);
    this.physics.createCollider(this.slick(RAPIER.ColliderDesc.cuboid(len / 2, h / 2 + 1, thick / 2), 0.4), b, { kind: 'static', material: 'rubber' });
  }

  table() {
    const w = this.world;
    // Playfield and its frame.
    this.place(w.mesh(new THREE.BoxGeometry(W, 0.2, L), 'white'), 0, -0.1, 0);
    const deck = this.fixed(0, -0.1, 0);
    this.physics.createCollider(this.slick(RAPIER.ColliderDesc.cuboid(W / 2 + 1, 0.1, L / 2 + 2), 0), deck, { kind: 'ground', material: 'rubber' });
    // An invisible lid keeps him on the table.
    const lid = this.fixed(0, 2.1, 0);
    this.physics.createCollider(this.slick(RAPIER.ColliderDesc.cuboid(W / 2 + 1, 0.1, L / 2 + 2), 0.2), lid);
    for (const s of [-1, 1]) {
      this.wall(s * (W / 2 + 0.12), 0, L, Math.PI / 2, 'toyBlue');
      // Inlane guides funnel the sides down onto the flippers.
      this.wall(s * 3.125, 4.175, 2.87, s * 0.958, 'toyPurple', 0.9, 0.22);
      // Top corners are cut so he rolls back into play.
      this.wall(s * (W / 2 - 0.9), -L / 2 + 0.9, 2.6, -s * Math.PI / 4, 'toyBlue');
    }
    this.wall(0, -L / 2 - 0.12, W + 0.5, 0, 'toyBlue');
    // Painted decals: drain and the lanes.
    const deco = (geo, color, x, z, opacity = 0.9) => {
      const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      w.disposables.push(m.geometry, m.material);
      this.place(m, x, 0.012, z);
    };
    deco(new THREE.PlaneGeometry(2.4, 1.2), 0xef4b3c, 0, L / 2 - 0.6, 0.25);
    deco(new THREE.RingGeometry(1.6, 1.75, 48), 0x3c86e8, 0, -1.5, 0.5);
    deco(new THREE.CircleGeometry(0.5, 32), 0xffc928, 0, -1.5, 0.6);
    // Legs down to the studio floor.
    for (const [x, z] of [[-W / 2 + 0.3, L / 2 - 0.3], [W / 2 - 0.3, L / 2 - 0.3], [-W / 2 + 0.3, -L / 2 + 0.3], [W / 2 - 0.3, -L / 2 + 0.3]]) {
      const foot = this.toWorld(x, -0.2, z);
      const leg = w.mesh(new THREE.BoxGeometry(0.3, foot.y, 0.3), 'toyDark');
      leg.position.set(foot.x, foot.y / 2, foot.z);
      w.add(leg);
    }
  }

  bumper({ x, z, r = 0.55, points = 100 }) {
    const g = new THREE.Group();
    const base = this.world.mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.7, 28), 'toyRed');
    base.position.y = 0.35;
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc928, emissiveIntensity: 0.2, roughness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.16, 28), capMat);
    cap.position.y = 0.76;
    this.world.disposables.push(capMat, cap.geometry);
    g.add(base, cap);
    this.place(g, x, 0, z);
    const body = this.fixed(x, 0.6, z);
    const bumper = { x, z, r, points, capMat, flash: 0, g };
    this.physics.createCollider(
      this.slick(RAPIER.ColliderDesc.cylinder(1.2, r), 0.6).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'bumper', bumper, material: 'rubber' },
    );
    this.bumpers.push(bumper);
  }

  post({ x, z, len = 1.6, rot = 0 }) {
    this.wall(x, z, len, rot, 'toyPink', 0.8, 0.3);
  }

  rollover({ x, z, points = 250 }) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 5).rotateX(-Math.PI / 2), mat);
    this.world.disposables.push(m.geometry, mat);
    this.place(m, x, 0.02, z, Math.PI / 2);
    this.rollovers.push({ x, z, points, mat, m, lit: false });
  }

  flipper(side) {
    const w = this.world;
    const px = side * 2.25;
    const pz = L / 2 - 1.9;
    const g = new THREE.Group();
    const arm = w.mesh(new THREE.BoxGeometry(FLIP_LEN, 0.45, 0.34), 'toyYellow');
    arm.position.x = -side * (FLIP_LEN / 2);
    const hub = w.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), 'toyDark');
    g.add(arm, hub);
    w.add(g);
    const p = this.toWorld(px, 0.25, pz);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
    this.physics.createCollider(
      this.slick(RAPIER.ColliderDesc.cuboid(FLIP_LEN / 2, 0.4, 0.17).setTranslation(-side * (FLIP_LEN / 2), 0, 0), 0.2),
      body,
      { kind: 'flipper', material: 'rubber' },
    );
    this.physics.link(body, g);
    // Rest pointing down-table towards the drain, flipped up across it.
    const rest = side * FLIP_REST;
    const flip = { side, body, angle: rest, rest, up: -side * FLIP_UP, pressed: false };
    this.setFlipper(flip);
    return flip;
  }

  setFlipper(f) {
    const q = this.tableQ.clone().multiply(_q.setFromAxisAngle(Y, f.angle));
    f.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }

  serve() {
    if (this.ball) this.removeDummy(this.ball);
    const at = this.toWorld((Math.random() - 0.5) * 2, 0.6, -L / 2 + 2.2);
    this.ball = this.spawnDummy({ position: [at.x, at.y, at.z], yaw: Math.PI, pose: 'tuck', muscle: 0.8 });
    // Mostly a ball: just enough wriggle to read as a body.
    this.ball.lively = 0.2;
    this.ball.ragdoll.addVelocity({ x: (Math.random() - 0.5) * 3, y: 0, z: 1.5 });
    this.physics.snapAll();
    this.audio.pop();
  }

  // ---------- input ----------

  press(side, on) {
    for (const f of this.flippers) {
      if (side !== 0 && f.side !== side) continue;
      if (on && !f.pressed) this.audio.click();
      f.pressed = on;
    }
    if (on) this.hud.clearHint();
  }

  onPointerDown(p) {
    this.press(p.x < 0.5 ? -1 : 1, true);
  }

  onPointerUp() {
    this.press(0, false);
  }

  onKeyDown(code) {
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ShiftLeft') this.press(-1, true);
    if (code === 'ArrowRight' || code === 'KeyD' || code === 'ShiftRight') this.press(1, true);
    if (code === 'Space') this.press(0, true);
  }

  onKeyUp(code) {
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ShiftLeft') this.press(-1, false);
    if (code === 'ArrowRight' || code === 'KeyD' || code === 'ShiftRight') this.press(1, false);
    if (code === 'Space') this.press(0, false);
  }

  // ---------- play ----------

  onContact(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.kind !== 'bumper' || y.kind !== 'dummy') continue;
      const bump = x.bumper;
      if (this.time - (this.lastKick.get(bump) ?? -1) < 0.15) continue;
      this.lastKick.set(bump, this.time);
      const c = this.toTable(this.ball.com(_a), _b);
      const dir = _a.set(c.x - bump.x, 0, c.z - bump.z);
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
      dir.normalize().applyQuaternion(this.tableQ).multiplyScalar(KICK);
      this.ball.ragdoll.addVelocity({ x: dir.x, y: dir.y, z: dir.z }, 0.3);
      bump.flash = 1;
      this.addScore(bump.points, this.toWorld(bump.x, 1.2, bump.z));
      this.audio.spring();
      this.rig.shake(0.15);
    }
  }

  addScore(pts, at) {
    if (this.phase !== 'play') return;
    this.score += pts;
    this.hud.set('score', this.score.toLocaleString());
    this.hud.meter('Target', this.score / this.def.stars[2], this.score >= this.def.stars[0]);
    this.fx.text(at, `+${pts}`, { color: '#ffd23a', size: 22, life: 0.8 });
    if (this.score >= this.def.stars[2]) this.end(true);
  }

  fixedUpdate(dt) {
    for (const f of this.flippers) {
      const target = f.pressed && this.phase === 'play' ? f.up : f.rest;
      const step = (f.pressed ? FLIP_SPEED : FLIP_DROP) * dt;
      f.angle += THREE.MathUtils.clamp(target - f.angle, -step, step);
      this.setFlipper(f);
    }
    if (!this.ball || this.phase !== 'play') return;
    const c = this.toTable(this.ball.com(_a), _b);
    // Off the bottom of the table: that ball's gone.
    if (c.z > L / 2 + 0.4 || c.y < -2) return this.drain();
    // A ball that's stopped dead (wedged, or parked on a flipper) gets nudged.
    this.stillT = this.ball.speed() < 0.6 ? (this.stillT ?? 0) + dt : 0;
    if (this.stillT > 2.5) {
      this.stillT = 0;
      const kick = _a.set((Math.random() - 0.5) * 3, 2, -6).applyQuaternion(this.tableQ);
      this.ball.ragdoll.addVelocity({ x: kick.x, y: kick.y, z: kick.z }, 0.2);
      this.fx.text(this.ball.com(_b).add(Y), 'NUDGE!', { color: '#3c86e8', size: 22 });
      this.audio.spring();
    }
    for (const r of this.rollovers) {
      if (r.lit || Math.hypot(c.x - r.x, c.z - r.z) > 0.8) continue;
      r.lit = true;
      r.mat.opacity = 0.95;
      this.audio.ding(this.rollovers.filter((o) => o.lit).length);
      this.addScore(r.points, this.toWorld(r.x, 1, r.z));
      if (this.rollovers.every((o) => o.lit)) {
        this.addScore(1000, this.toWorld(0, 1.5, 0));
        this.game.ui.banner('ALL STARS!', '+1000');
        this.fx.confetti(this.toWorld(0, 1, 0), 80);
        for (const o of this.rollovers) {
          o.lit = false;
          o.mat.opacity = 0.35;
        }
      }
    }
  }

  drain() {
    this.balls--;
    this.hud.set('balls', Math.max(0, this.balls));
    this.hud.bump('balls');
    this.audio.lose();
    this.fx.text(this.toWorld(0, 1.5, L / 2 - 1), 'DRAIN!', { color: '#ff7a6b', size: 30 });
    if (this.balls <= 0) this.end(this.score >= this.def.stars[0]);
    else {
      this.removeDummy(this.ball);
      this.ball = null;
      this.serveT = 1;
    }
  }

  end(passed) {
    if (this.phase !== 'play') return;
    this.phase = 'end';
    this.passed = passed;
    this.endT = passed ? 1.6 : 0.8;
    if (passed) {
      this.audio.win();
      this.fx.confetti(this.toWorld(0, 1.5, 0), 140);
      this.game.ui.banner(this.balls > 0 && this.score >= this.def.stars[2] ? 'JACKPOT!' : 'GAME OVER', `${this.score.toLocaleString()} points`);
    }
  }

  tick(dt) {
    this.cameraFor();
    for (const b of this.bumpers) {
      b.flash = Math.max(0, b.flash - dt * 4);
      b.capMat.emissiveIntensity = 0.2 + b.flash * 1.6;
      b.g.scale.setScalar(1 + b.flash * 0.12);
    }
    for (const r of this.rollovers) r.m.rotation.y += dt * (r.lit ? 4 : 1);
    if (this.phase === 'play' && !this.ball) {
      this.serveT -= dt;
      if (this.serveT <= 0) this.serve();
    }
    // Curl back into a ball after each knock.
    if (this.ball && this.ball.ragdoll.poseName !== 'tuck' && this.ball.speed() < 6) this.ball.setPose('tuck');
    if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  /** One more ball. */
  revive() {
    this.balls = 1;
    this.hud.set('balls', 1);
    this.phase = 'play';
    if (this.ball) this.removeDummy(this.ball);
    this.ball = null;
    this.serveT = 0.4;
  }

  complete() {
    this.phase = 'done';
    const [a, b, c] = this.def.stars;
    const stars = this.score >= c ? 3 : this.score >= b ? 2 : this.score >= a ? 1 : 0;
    this.finish({
      passed: stars > 0,
      stars,
      score: this.score,
      reason: `Score ${a.toLocaleString()} before your balls run out.`,
      stats: [
        ['Points', this.score.toLocaleString()],
        ['Balls left', `${Math.max(0, this.balls)}`],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const look = this.toWorld(0, 0, portrait ? 0.3 : 0.8);
    const pos = this.toWorld(0, portrait ? 15 : 10.5, L / 2 + (portrait ? 6.5 : 6));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2, 2);
    this.stage.focusShadows(look, 12);
  }
}
