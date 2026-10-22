import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const W = 7; // slide width
const TILT = THREE.MathUtils.degToRad(13);
const STEER = 6; // m/s across the slide
const BLOCKS = ['toyRed', 'toyBlue', 'toyPurple', 'toyOrange', 'toyGreen'];
const SEAT = 0.22; // height of his hips above the slide when sitting
const BOOST_KICK = 6; // m/s added by a boost pad
const BOOST_TOP = 6; // extra top speed while boosted
const BODY = new Set(['head', 'chest', 'pelvis', 'thighL', 'thighR']);
const X = new THREE.Vector3(1, 0, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Tube Rush: a long water slide down through the yard. He rides it sat in a
 * rubber ring, picking up speed all the way; you steer him round the toy
 * blocks, over the ramps, across the boost pads and through the stars, and
 * splash down in the pool at the bottom. Too many bonks and the ride's over.
 */
export class SlideLevel extends Level {
  setup() {
    const def = this.def;
    this.length = def.length;
    this.maxBonks = def.bonks ?? 4;
    this.bonks = 0;
    this.got = 0;
    this.steer = 0;
    this.keys = { left: false, right: false };
    this.phase = 'play';
    this.lastBonk = -9;
    this.pickups = [];
    this.sliders = [];
    this.boosts = [];
    this.q = new THREE.Quaternion().setFromAxisAngle(X, TILT);
    this.origin = new THREE.Vector3(0, this.length * Math.sin(TILT) + 1.4, 0);

    this.scenery({ run: { axis: 'z', to: this.length * Math.cos(TILT) + 20, side: 12 } });
    this.chute();
    for (const p of def.course) this.piece(p);
    this.pool();
    this.clutter([[-8.5, this.poolAt.z - 2], [8.5, this.poolAt.z + 1], [-8, this.poolAt.z + 6]]);

    // Sat upright on a rubber ring, feet first, facing down the slide.
    const start = [...this.toWorld(0, SEAT - 0.93, 0.5)];
    const d = this.spawnDummy({ position: start, pose: 'sled', muscle: 0.8 });
    d.ragdoll.teleport(start, 0, 'sled', this.q);
    d.balance = 0.6;
    d.ragdoll.legLife = 0;
    d.ragdoll.addVelocity(this.toWorldDir(0, 0, 3, _b));
    this.dummy = d;
    this.ring();
    this.boostT = 0;
    this.physics.snapAll();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'stars', icon: 'star', value: `0/${this.pickups.length}` },
        { id: 'bonks', icon: 'skull', value: `0/${this.maxBonks}` },
      ],
    });
    this.hud.meter('Distance', 0);
    this.hud.hint(def.hint ?? 'Hold left or right to steer · ride the blue arrows to boost');
    this.cameraFor(true);
  }

  // ---------- slide space: x across, y off the surface, z down the slide ----------

  toWorld(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(this.q).add(this.origin);
  }

  toWorldDir(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(this.q);
  }

  toSlide(p, out = new THREE.Vector3()) {
    return out.copy(p).sub(this.origin).applyQuaternion(_q.copy(this.q).invert());
  }

  toSlideDir(v, out = new THREE.Vector3()) {
    return out.copy(v).applyQuaternion(_q.copy(this.q).invert());
  }

  slick(desc, bounce = 0.2) {
    return desc
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(bounce)
      .setCollisionGroups(groups(Group.WORLD));
  }

  box({ x = 0, y, z, w, h, d, mat, rotX = 0, info, bounce = 0.2, body: kinematic = false, visible = true }) {
    const q = this.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, rotX));
    const p = this.toWorld(x, y, z);
    let mesh = null;
    if (visible) {
      mesh = this.world.mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.copy(p);
      mesh.quaternion.copy(q);
      this.world.add(mesh);
    }
    const desc = kinematic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    const rb = this.physics.createBody(desc.setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    let c = this.slick(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), bounce);
    if (info?.kind === 'block') c = c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.physics.createCollider(c, rb, info);
    return { rb, mesh, q };
  }

  chute() {
    const L = this.length;
    // The deck looks thin, but its collider runs deep so a big landing can't punch through it.
    this.box({ y: -1, z: L / 2, w: W, h: 2, d: L + 4, visible: false, info: { kind: 'ground', material: 'rubber' } });
    const deck = this.world.mesh(new THREE.BoxGeometry(W, 0.3, L + 4), 'white');
    this.toWorld(0, -0.15, L / 2, deck.position);
    deck.quaternion.copy(this.q);
    this.world.add(deck);
    for (const s of [-1, 1]) this.box({ x: s * (W / 2 + 0.15), y: 2.55, z: L / 2, w: 0.3, h: 3, d: L + 4, visible: false, bounce: 0.3, info: { kind: 'static', material: 'rubber' } });
    for (const s of [-1, 1]) this.box({ x: s * (W / 2 + 0.15), y: 0.45, z: L / 2, w: 0.3, h: 1.2, d: L + 4, mat: s < 0 ? 'toyBlue' : 'toyPink', bounce: 0.4, info: { kind: 'static', material: 'rubber' } });
    // Painted lane stripes, so speed reads.
    for (let z = 4; z < L; z += 8) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, 0.25).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3c86e8, transparent: true, opacity: 0.18, depthWrite: false }));
      this.world.disposables.push(m.geometry, m.material);
      this.toWorld(0, 0.01, z, m.position);
      m.quaternion.copy(this.q);
      this.world.add(m);
    }
    // Stilts down to the floor.
    for (let z = 2; z < L; z += 10) {
      for (const s of [-1, 1]) {
        const top = this.toWorld(s * (W / 2 - 0.3), -0.3, z);
        const leg = this.world.mesh(new THREE.BoxGeometry(0.3, top.y, 0.3), 'toyDark');
        leg.position.set(top.x, top.y / 2, top.z);
        this.world.add(leg);
      }
    }
  }

  piece(p) {
    if (p.t === 'block') {
      const w = p.w ?? 1.4;
      const h = p.h ?? 1.2;
      this.blocks = (this.blocks ?? 0) + 1;
      this.box({ x: p.x, y: h / 2, z: p.z, w, h, d: p.d ?? 1.2, mat: BLOCKS[this.blocks % BLOCKS.length], info: { kind: 'block', material: 'rubber' }, bounce: 0.3 });
    } else if (p.t === 'slider') {
      const w = p.w ?? 1.8;
      const b = this.box({ x: 0, y: 0.6, z: p.z, w, h: 1.2, d: 1, mat: 'toyOrange', info: { kind: 'block', material: 'rubber' }, body: true });
      this.sliders.push({ ...b, z: p.z, amp: p.amp ?? 2, sp: p.sp ?? 1.5, ph: p.ph ?? 0 });
    } else if (p.t === 'ramp') {
      // A wedge tipped up the slide: hit it and he takes off.
      const len = 3;
      const rise = p.rise ?? 1;
      const ang = Math.atan2(rise, len);
      this.box({ x: p.x ?? 0, y: rise / 2 - 0.1, z: p.z, w: p.w ?? 3, h: 0.25, d: Math.hypot(len, rise), rotX: -ang, mat: 'toyYellow', info: { kind: 'static', material: 'rubber' }, bounce: 0 });
    } else if (p.t === 'boost') {
      // Glowing chevrons painted on the slide: ride over them for a burst of speed.
      const g = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(-0.8, 0);
      shape.lineTo(0, 0.6);
      shape.lineTo(0.8, 0);
      shape.lineTo(0.8, -0.35);
      shape.lineTo(0, 0.25);
      shape.lineTo(-0.8, -0.35);
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).rotateY(Math.PI);
      const base = new THREE.PlaneGeometry(2.2, 3).rotateX(-Math.PI / 2);
      this.world.disposables.push(geo);
      const pad = this.world.mesh(base, 'toyBlue', { cast: false });
      pad.position.y = 0.015;
      g.add(pad);
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(geo, this.boostMaterial());
        m.position.set(0, 0.03, -0.8 + i * 0.8);
        g.add(m);
      }
      this.toWorld(p.x ?? 0, 0, p.z, g.position);
      g.quaternion.copy(this.q);
      this.world.add(g);
      this.boosts.push({ x: p.x ?? 0, z: p.z, used: false, g });
    } else if (p.t === 'star') {
      const m = this.world.mesh(new THREE.OctahedronGeometry(0.35), 'gold', { cast: false });
      this.toWorld(p.x, p.y ?? 0.7, p.z, m.position);
      this.world.add(m);
      this.pickups.push({ m, x: p.x, y: p.y ?? 0.7, z: p.z, got: false });
    }
  }

  boostMaterial() {
    if (!this.boostMat) {
      this.boostMat = new THREE.MeshBasicMaterial({ color: 0x9ff8ff, side: THREE.DoubleSide });
      this.world.disposables.push(this.boostMat);
    }
    return this.boostMat;
  }

  /** The rubber ring he rides on, carried along with his hips. */
  ring() {
    const g = new THREE.Group();
    const tube = this.world.mesh(new THREE.TorusGeometry(0.32, 0.13, 14, 28).rotateX(Math.PI / 2), 'toyOrange');
    tube.position.y = -0.1;
    g.add(tube);
    this.world.add(g);
    this.physics.link(this.dummy.parts.pelvis.body, g);
  }

  pool() {
    const end = this.toWorld(0, 0, this.length + 2);
    const at = new THREE.Vector3(0, 0, end.z + 6.5);
    const rim = this.world.mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.7, 48), 'toyBlue');
    rim.position.set(at.x, 0.35, at.z);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.4, transparent: true, opacity: 0.6, depthWrite: false });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.9, 0.1, 48), waterMat);
    water.position.set(at.x, 0.62, at.z);
    this.world.disposables.push(water.geometry, waterMat);
    this.world.add(rim, water);
    // He floats just under the surface instead of sinking out of sight.
    const bed = this.world.fixedBody([at.x, 0.25, at.z], new THREE.Quaternion());
    this.physics.createCollider(RAPIER.ColliderDesc.cylinder(0.25, 5.9).setFriction(1.5).setCollisionGroups(groups(Group.WORLD)), bed, { kind: 'static', material: 'rubber' });
    this.poolAt = at;
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

  onContact(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.kind !== 'block' || y.kind !== 'dummy' || this.phase !== 'play') continue;
      // A flailing hand brushing past doesn't count; his body hitting it does.
      if (!BODY.has(y.part)) continue;
      if (this.time - this.lastBonk < 0.8) continue;
      this.bonk('BONK!');
    }
  }

  bonk(label) {
    this.lastBonk = this.time;
    this.bonks++;
    this.hud.set('bonks', `${this.bonks}/${this.maxBonks}`);
    this.hud.bump('bonks');
    this.audio.impact(1, 'body');
    this.rig.shake(0.45);
    this.fx.text(this.dummy.com(_a).add(_b.set(0, 1.2, 0)), label, { color: '#ff7a6b', size: 30 });
    if (this.bonks >= this.maxBonks) {
      this.phase = 'end';
      this.passed = false;
      this.endT = 1.2;
      this.game.ui.banner('WIPED OUT!', 'Too many bonks');
    }
  }

  /** Flew clean off the slide: costs a bonk, and he's dropped back on a little way up. */
  backOn(z) {
    const at = [...this.toWorld(0, SEAT - 0.93 + 0.3, Math.max(0.5, z - 4))];
    this.dummy.ragdoll.teleport(at, 0, 'sled', this.q);
    this.dummy.ragdoll.addVelocity(this.toWorldDir(0, 0, 8, _a));
    this.physics.snapAll();
    this.bonk('WHOOPS!');
  }

  fixedUpdate(dt) {
    for (const s of this.sliders) {
      const p = this.toWorld(Math.sin(this.time * s.sp + s.ph) * s.amp, 0.6, s.z, _a);
      s.rb.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    }
    const d = this.dummy;
    const R = d.ragdoll;
    const c = this.toSlide(d.com(_a), _b);
    const v = this.toSlideDir(d.velocity(_a), new THREE.Vector3());
    // Steer across the slide. The camera looks down it, so screen-right is the slide's -x.
    const dir = this.phase === 'play' ? THREE.MathUtils.clamp(this.steer + (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0), -1, 1) : 0;
    const dvx = (-dir * STEER - v.x) * (dir ? 0.12 : 0.04);
    // Top speed builds all the way down, with a burst on every boost.
    this.boostT = Math.max(0, this.boostT - dt);
    const progress = THREE.MathUtils.clamp(c.z / this.length, 0, 1);
    const max = (this.def.maxSpeed ?? 13) * (0.75 + 0.45 * progress) + (this.boostT > 0 ? BOOST_TOP : 0);
    const dvz = v.z > max ? (max - v.z) * 0.1 : 0;
    const dv = this.toWorldDir(dvx, 0, dvz, _a);
    R.addVelocity({ x: dv.x, y: dv.y, z: dv.z });

    if (this.phase !== 'play') return;
    if (c.z < this.length && (c.y < -0.8 || Math.abs(c.x) > W / 2 + 0.5)) {
      this.backOn(c.z);
      return;
    }
    // Pinned against a block: slide him off whichever side has more room.
    this.stuckT = v.z < 1 ? (this.stuckT ?? 0) + dt : 0;
    if (this.stuckT > 1.2) {
      this.stuckT = 0;
      const out = this.toWorldDir((c.x > 0 ? -1 : 1) * 4, 1, 2, _a);
      R.addVelocity({ x: out.x, y: out.y, z: out.z });
    }
    for (const b of this.boosts) {
      if (b.used || Math.abs(c.z - b.z) > 1 || Math.abs(c.x - b.x) > 1.2 || c.y > 1.2) continue;
      b.used = true;
      this.boostT = 2.2;
      const kick = this.toWorldDir(0, 0, BOOST_KICK, _a);
      R.addVelocity({ x: kick.x, y: kick.y, z: kick.z });
      this.rig.kick(10);
      this.audio.whoosh(1.6);
      this.fx.text(this.dummy.com(_a).add(_b.set(0, 1.4, 0)), 'BOOST!', { color: '#57f2ff', size: 32 });
    }
    for (const p of this.pickups) {
      if (p.got || Math.hypot(c.x - p.x, c.z - p.z) > 1 || c.y > p.y + 1.5) continue;
      p.got = true;
      p.m.visible = false;
      this.got++;
      this.hud.set('stars', `${this.got}/${this.pickups.length}`);
      this.hud.bump('stars');
      this.audio.coin(this.got % 6);
      this.fx.chips(p.m.position, { count: 12, colors: [0xffd23a, 0xffffff], size: 0.06, speed: 3, life: 0.7 });
    }
    this.hud.meter('Distance', Math.min(1, c.z / this.length));
    if (c.z > this.length + 1) this.finishRun();
  }

  finishRun() {
    this.phase = 'splash';
    this.passed = true;
    this.splashT = 0;
    this.audio.whoosh(1.2);
  }

  tick(dt) {
    this.cameraFor();
    for (const p of this.pickups) p.m.rotation.y += dt * 3;
    this.boostMat?.color.setHSL(0.52, 1, 0.65 + 0.25 * Math.sin(this.time * 9));
    this.audio.loop('wind', this.phase === 'play' ? Math.min(1, this.dummy.speed() / 14) : 0, 'wind');
    if (this.phase === 'splash') {
      this.splashT += dt;
      const c = this.dummy.com(_a);
      if (!this.splashed && c.y < 1.4 && Math.hypot(c.x - this.poolAt.x, c.z - this.poolAt.z) < 6.5) {
        this.splashed = true;
        this.fx.puff(c, { count: 18, size: 1.1, speed: 3.5, color: 0xbfe6ff, up: 1.5 });
        this.fx.chips(c, { count: 40, colors: [0x4fc3f7, 0xbfe6ff, 0xffffff], size: 0.09, speed: 6, life: 1.1 });
        this.rig.shake(0.3);
        this.fx.confetti(c.clone().add(_b.set(0, 1, 0)), 100);
        this.audio.win();
        this.game.ui.banner('SPLASHDOWN!', `${this.got}/${this.pickups.length} stars`);
      }
      if (this.splashT > 2.4) this.complete();
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  /** Two more bonks allowed. */
  revive() {
    this.maxBonks = this.bonks + 2;
    this.hud.set('bonks', `${this.bonks}/${this.maxBonks}`);
    this.phase = 'play';
  }

  complete() {
    this.phase = 'done';
    const all = this.pickups.length;
    const share = all ? this.got / all : 1;
    const stars = !this.passed ? 0 : this.bonks === 0 && share >= 0.7 ? 3 : this.bonks <= 1 && share >= 0.4 ? 2 : 1;
    this.finish({
      passed: this.passed,
      stars,
      score: Math.round((this.passed ? 1200 : 0) + this.got * 150 - this.bonks * 100 + (this.splashed ? 400 : 0)),
      reason: `Reach the pool with fewer than ${this.maxBonks} bonks.`,
      stats: [
        ['Stars', `${this.got}/${all}`],
        ['Bonks', `${this.bonks}`],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    if (this.phase === 'splash' || this.splashed) {
      const c = this.dummy.com(_b);
      this.rig.aim(_a.set(c.x, c.y + (portrait ? 8 : 6), c.z - (portrait ? 11 : 9)), c, 2, 3);
      return;
    }
    const c = this.toSlide(this.dummy.com(_a), _b);
    const z = Math.min(c.z, this.length + 6);
    const pos = this.toWorld(c.x * 0.5, portrait ? 7 : 5, z - (portrait ? 9 : 8));
    const look = this.toWorld(c.x * 0.5, 0.6, z + (portrait ? 7 : 6));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 4, 5);
    this.stage.focusShadows(look, 16);
  }
}
