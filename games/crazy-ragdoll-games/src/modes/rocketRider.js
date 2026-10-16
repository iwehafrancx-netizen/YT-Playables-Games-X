import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';
import { landingTarget } from '../render/textures.js';

const THRUST = 15; // m/s² while holding
const GRAVITY = 9;
const MAX_UP = 6;
const MAX_DOWN = -7.5;
const CEILING = 13;
const HAND = { x: 0, y: -0.13, z: 0 };
const RING_R = 1.25;
// Head and torso crash into walls; legs only count if they hit the floor.
const PROBES = ['head', 'chest', 'pelvis'];
const FEET = ['shinL', 'shinR'];
const MATS = ['toyBlue', 'toyPurple', 'toyGreen', 'toyOrange', 'toyPink'];
const Z = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Rocket Rider: a ragdoll hanging on to a rocket for dear life. Hold to burn
 * and climb, let go to drop. Thread the gaps, collect the rings, and he lets
 * go over the landing pad at the end.
 */
export class RocketRiderLevel extends Level {
  setup() {
    const def = this.def;
    this.speed = def.speed ?? 6.5;
    this.x = 0;
    this.y = def.startY ?? 5;
    this.vy = 0;
    this.holding = false;
    this.phase = 'fly';
    this.walls = [];
    this.rings = [];
    this.got = 0;
    this.safeT = 0;
    this.finishX = def.length;

    this.studio({ extent: 30 });
    for (const piece of def.course) this.addPiece(piece);
    this.pad();
    this.makeRocket();
    this.attach();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [{ id: 'rings', icon: 'target', value: `0/${this.rings.length}` }],
    });
    this.hud.meter('Distance', 0);
    this.hud.hint(def.hint ?? 'Hold to fly up · let go to drop · fly through the rings');
    this.cameraFor(true);
  }

  // ---------- course ----------

  box(x0, x1, y0, y1, mat, mover = null) {
    const w = x1 - x0;
    const h = y1 - y0;
    const m = this.world.mesh(new THREE.BoxGeometry(w, h, 2.2), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    this.world.add(m);
    const wall = { x0, x1, y0, y1, m, mover, base: (y0 + y1) / 2 };
    this.walls.push(wall);
    return wall;
  }

  addPiece(p) {
    const mat = MATS[this.walls.length % MATS.length];
    if (p.t === 'gate') {
      // A wall with a gap to fly through; `amp` makes the gap ride up and down.
      const half = (p.gap ?? 4) / 2;
      const w = p.w ?? 1.2;
      const mover = p.amp ? { amp: p.amp, sp: p.sp ?? 1, ph: p.ph ?? 0, y: p.y } : null;
      const lo = this.box(p.x - w / 2, p.x + w / 2, -6, p.y - half, mat, mover && { ...mover, part: 'lo', half });
      const hi = this.box(p.x - w / 2, p.x + w / 2, p.y + half, CEILING + 6, mat, mover && { ...mover, part: 'hi', half });
      lo.pair = hi;
    } else if (p.t === 'block') {
      this.box(p.x - p.w / 2, p.x + p.w / 2, p.y - p.h / 2, p.y + p.h / 2, mat, p.amp ? { amp: p.amp, sp: p.sp ?? 1, ph: p.ph ?? 0, y: p.y, part: 'block', half: p.h / 2 } : null);
    } else if (p.t === 'ring') {
      const m = this.world.mesh(new THREE.TorusGeometry(RING_R, 0.12, 12, 36), 'gold', { cast: false });
      m.position.set(p.x, p.y, 0);
      m.rotation.y = Math.PI / 2;
      this.world.add(m);
      this.rings.push({ x: p.x, y: p.y, m, got: false });
    }
  }

  pad() {
    const x = this.finishX + 6;
    const mat = new THREE.MeshStandardMaterial({ map: landingTarget([150, 300, 600]), roughness: 0.8, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(3, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, 0);
    m.receiveShadow = true;
    this.world.add(m);
    this.world.disposables.push(m.geometry, mat, mat.map);
    this.padAt = { x, r: 3, points: [150, 300, 600] };
    const flag = this.world.mesh(new THREE.BoxGeometry(0.12, 4, 0.12), 'toyDark');
    flag.position.set(this.finishX, 2, -1.4);
    const cloth = this.world.mesh(new THREE.BoxGeometry(1, 0.6, 0.04), 'toyRed', { cast: false });
    cloth.position.set(this.finishX + 0.5, 3.6, -1.4);
    this.world.add(flag, cloth);
  }

  makeRocket() {
    const w = this.world;
    const g = new THREE.Group();
    const body = w.mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 20).rotateZ(Math.PI / 2), 'toyRed');
    const nose = w.mesh(new THREE.ConeGeometry(0.32, 0.6, 20).rotateZ(-Math.PI / 2), 'toyYellow');
    nose.position.x = 1.15;
    const band = w.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 20).rotateZ(Math.PI / 2), 'white');
    band.position.x = 0.45;
    g.add(body, nose, band);
    const top = w.mesh(new THREE.BoxGeometry(0.45, 0.32, 0.05), 'toyBlue');
    top.position.set(-0.65, 0.42, 0);
    g.add(top);
    for (const z of [-0.36, 0.36]) {
      const fin = w.mesh(new THREE.BoxGeometry(0.45, 0.05, 0.3), 'toyBlue');
      fin.position.set(-0.65, -0.05, z);
      g.add(fin);
    }
    const bar = w.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8).rotateX(Math.PI / 2), 'toyDark');
    bar.position.set(0, -0.38, 0);
    g.add(bar);
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffa13a, transparent: true, opacity: 0.9 });
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1, 16).rotateZ(Math.PI / 2).translate(-0.5, 0, 0), this.flameMat);
    this.flame.position.x = -0.85;
    g.add(this.flame);
    w.disposables.push(this.flameMat, this.flame.geometry);
    w.add(g);
    this.rocketMesh = g;
    this.rocket = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.x, this.y, 0));
    this.physics.link(this.rocket, g);
  }

  attach() {
    const d = this.spawnDummy({ position: [this.x - 0.05, this.y - 2.55, 0], yaw: Math.PI / 2, pose: 'hang', muscle: 0.75 });
    this.joints = ['lowerArmL', 'lowerArmR'].map((part, i) =>
      this.physics.world.createImpulseJoint(RAPIER.JointData.spherical({ x: 0, y: -0.4, z: i ? -0.15 : 0.15 }, HAND), this.rocket, d.parts[part].body, true),
    );
    this.rider = d;
    this.rocketMesh.visible = true;
    this.physics.snapAll();
  }

  detach() {
    for (const j of this.joints) this.physics.world.removeImpulseJoint(j, true);
    this.joints = [];
  }

  // ---------- input ----------

  onPointerDown() {
    this.holding = true;
    this.hud.clearHint();
  }

  onPointerUp() {
    this.holding = false;
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') {
      this.holding = true;
      this.hud.clearHint();
    }
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') this.holding = false;
  }

  // ---------- flight ----------

  wallY(w, time) {
    const m = w.mover;
    if (!m) return null;
    const c = m.y + Math.sin(time * m.sp + m.ph) * m.amp;
    if (m.part === 'lo') return [w.y0, c - m.half];
    if (m.part === 'hi') return [c + m.half, w.y1];
    return [c - m.half, c + m.half];
  }

  hits(px, py, r = 0) {
    for (const w of this.walls) {
      if (px + r > w.x0 && px - r < w.x1 && py + r > w.y0 && py - r < w.y1) return true;
    }
    return false;
  }

  fixedUpdate(dt) {
    const t = this.time;
    for (const w of this.walls) {
      const span = this.wallY(w, t);
      if (!span) continue;
      [w.y0, w.y1] = span;
      w.m.position.y = (w.y0 + w.y1) / 2;
      w.m.scale.y = (w.y1 - w.y0) / (w.m.geometry.parameters.height || 1);
    }
    if (this.phase !== 'fly') return;

    this.vy += (this.holding ? THRUST : -GRAVITY) * dt;
    this.vy = THREE.MathUtils.clamp(this.vy, MAX_DOWN, MAX_UP);
    this.x += this.speed * dt;
    this.y += this.vy * dt;
    if (this.y > CEILING) {
      this.y = CEILING;
      this.vy = Math.min(0, this.vy);
    }
    const pitch = Math.atan2(this.vy, this.speed) * 0.8;
    _q.setFromAxisAngle(Z, pitch);
    this.rocket.setNextKinematicTranslation({ x: this.x, y: this.y, z: 0 });
    this.rocket.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    // Keep him in the plane of the course and trailing a little in the wind.
    const R = this.rider.ragdoll;
    const com = R.centerOfMass(_a);
    R.addVelocity({ x: 0, y: 0, z: -com.z * 2 * dt });

    this.safeT -= dt;
    if (this.safeT <= 0) this.checkCrash();
    this.checkRings();
    if (this.x >= this.finishX) this.letGo();
  }

  checkCrash() {
    if (this.hits(this.x, this.y, 0.3) || this.hits(this.x + 1.1, this.y, 0.15)) return this.crash();
    for (const name of PROBES) {
      const p = this.rider.parts[name].body.translation();
      if (p.y < 0.12 || this.hits(p.x, p.y, 0.08)) return this.crash();
    }
    for (const name of FEET) if (this.rider.parts[name].body.translation().y < 0.1) return this.crash();
  }

  checkRings() {
    for (const r of this.rings) {
      if (r.got) continue;
      const near = (px, py) => Math.abs(px - r.x) < 0.5 && Math.hypot(px - r.x, py - r.y) < RING_R;
      const chest = this.rider.parts.chest.body.translation();
      if (near(this.x, this.y) || near(chest.x, chest.y)) {
        r.got = true;
        this.got++;
        r.m.visible = false;
        this.fx.chips(_a.set(r.x, r.y, 0), { count: 16, colors: [0xffd23a, 0xffffff], size: 0.06, speed: 4, life: 0.8 });
        this.fx.text(_a.set(r.x, r.y + 1, 0), '+150', { color: '#ffd23a', size: 26 });
        this.audio.coin(this.got % 6);
        this.hud.set('rings', `${this.got}/${this.rings.length}`);
        this.hud.bump('rings');
      }
    }
  }

  crash() {
    this.phase = 'crashed';
    this.crashX = this.x;
    this.detach();
    this.rocketMesh.visible = false;
    const at = _a.set(this.x, this.y, 0);
    this.fx.puff(at, { count: 14, size: 1.1, speed: 3, color: 0xcfd3db });
    this.fx.chips(at, { count: 30, colors: [0xef4b3c, 0xffc928, 0x3c86e8], size: 0.09, speed: 7 });
    this.rider.ragdoll.addVelocity({ x: this.speed * 0.3, y: 3, z: 0 }, 0.6);
    this.rider.knockOut(3, 1);
    this.rider.setPose('starfish');
    this.audio.boom();
    this.rig.shake(0.7);
    this.audio.loop('wind', 0, 'wind');
    this.endT = 1.6;
  }

  letGo() {
    this.phase = 'landing';
    this.detach();
    this.rider.setPose('starfish');
    this.rider.setMuscle(0.4);
    this.audio.whoosh(1);
    this.fx.text(_a.set(this.x, this.y + 1, 0), 'LET GO!', { color: '#ffffff', size: 28 });
    this.landT = 0;
    this.restT = 0;
  }

  /** Back on a fresh rocket a little before where it went wrong. */
  revive() {
    if (this.rider) this.removeDummy(this.rider);
    this.x = Math.max(0, this.crashX - 4);
    const gate = this.walls.find((w) => w.pair && w.x0 > this.x);
    this.y = gate ? (gate.y1 + gate.pair.y0) / 2 : 5;
    this.vy = 0;
    this.rocket.setTranslation({ x: this.x, y: this.y, z: 0 }, true);
    this.rocket.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.physics.snapBody(this.rocket);
    this.attach();
    this.safeT = 1.2;
    this.phase = 'fly';
  }

  tick(dt) {
    this.cameraFor();
    const burn = this.phase === 'fly' && this.holding;
    this.flame.scale.set(burn ? 1 + Math.random() * 0.5 : 0.35, burn ? 1 : 0.6, burn ? 1 : 0.6);
    this.flameMat.color.set(burn ? 0xffa13a : 0xffd27a);
    this.audio.loop('wind', this.phase === 'fly' ? (burn ? 0.8 : 0.35) : 0, 'wind');
    for (const r of this.rings) if (!r.got) r.m.rotation.x += dt * 2;
    this.hud.meter('Distance', Math.min(1, this.x / this.finishX));

    if (this.phase === 'crashed') {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.phase = 'over';
        this.finish({
          passed: false,
          stars: 0,
          score: this.got * 150,
          reason: 'Keep clear of the walls and the floor.',
          stats: [['Rings', `${this.got}/${this.rings.length}`], ['Distance', `${Math.round((this.crashX / this.finishX) * 100)}%`]],
        });
      }
    } else if (this.phase === 'landing') {
      // The empty rocket carries on up and away.
      this.x += this.speed * dt;
      this.y += 6 * dt;
      this.rocket.setNextKinematicTranslation({ x: this.x, y: this.y, z: 0 });
      this.landT += dt;
      this.restT = this.rider.speed() < 0.5 ? this.restT + dt : 0;
      if (this.restT > 0.6 || this.landT > 6) this.complete();
    }
  }

  complete() {
    this.phase = 'done';
    const p = this.rider.partPosition('pelvis', _a);
    const d = Math.hypot(p.x - this.padAt.x, p.z);
    let bonus = 0;
    if (d < this.padAt.r) {
      const ring = d < this.padAt.r / 3 ? 2 : d < (this.padAt.r * 2) / 3 ? 1 : 0;
      bonus = this.padAt.points[ring];
      this.fx.text(p.clone().add(new THREE.Vector3(0, 1, 0)), ring === 2 ? 'BULLSEYE!' : `+${bonus}`, { color: '#ffd23a', size: 32 });
    }
    const all = this.rings.length;
    const stars = this.got >= all ? 3 : this.got >= Math.ceil(all / 2) ? 2 : 1;
    this.finish({
      passed: true,
      stars,
      score: this.got * 150 + bonus + Math.round(this.finishX * 10),
      stats: [
        ['Rings', `${this.got}/${all}`],
        ['Landing', bonus ? `+${bonus}` : 'missed the pad'],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const x = this.phase === 'landing' || this.phase === 'done' ? this.rider.com(_a).x : this.x;
    const look = new THREE.Vector3(x + (portrait ? 2 : 4), portrait ? 6 : 5.5, 0);
    const pos = new THREE.Vector3(x + (portrait ? 2 : 4), portrait ? 7 : 6.2, portrait ? 26 : 17);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 5, 6);
    this.stage.focusShadows(look, 18);
  }
}
