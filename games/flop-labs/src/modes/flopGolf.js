import * as THREE from 'three';
import { Level } from './level.js';
import { Mat, tiled } from '../render/materials.js';

const TOP = 1.4; // default height of the course above the lake bed
const CUP = 0.9; // half-width of the cup; a regulation cup for a 1.8 m ball
const CUP_DEPTH = 0.8;
const TURF = 0.3;
const WATER_Y = 0.45;
const LOFT = 42 * (Math.PI / 180);
const FRICTION = { fairway: 0.9, green: 0.75, sand: 3 };
const MAX_AIM = 1.75;
const DOWN = { x: 0, y: -1, z: 0 };
const _v = new THREE.Vector3();

const LABELS = { '-3': 'ALBATROSS!', '-2': 'EAGLE!', '-1': 'BIRDIE!', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY' };

/**
 * Flop Golf: the dummy is the ball. Pull back to aim and set the power,
 * let go to send him, and sink him in the cup in as few strokes as you can.
 * The course sits on a lake; anything that ends up in the water costs a stroke.
 */
export class FlopGolfLevel extends Level {
  setup() {
    const def = this.def;
    this.par = def.par;
    this.limit = def.par + 2;
    this.strokes = 0;
    this.wind = new THREE.Vector3(def.wind?.[0] ?? 0, 0, def.wind?.[1] ?? 0);
    this.cup = new THREE.Vector3(def.cup[0], TOP, def.cup[1]);
    this.tee = new THREE.Vector3(def.tee?.[0] ?? 0, def.teeTop ?? TOP, def.tee?.[1] ?? 0);

    this.lake();
    for (const p of def.pads) this.pad(p);
    def.build?.(this.world, this);
    this.makeFlag();
    this.makeArc();

    this.lie = this.tee.clone();
    this.ball = this.spawnDummy({ position: this.lie.toArray(), yaw: this.yawTo(this.cup, this.lie), pose: 'ready', muscle: 1 });
    this.toLie(false);

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'strokes', icon: 'dummy', value: `0/${this.limit}` },
        { id: 'par', icon: 'flag', value: `Par ${this.par}` },
        { id: 'dist', icon: 'target', value: this.distanceLabel() },
      ],
    });
    this.hud.hint(def.hint ?? 'Pull back to aim, let go to swing');

    // Open on the flag, then glide back to the tee.
    this.phase = 'intro';
    this.introT = def.intro ?? 1.6;
    const back = _v.copy(this.cup).sub(this.tee).setY(0).normalize();
    this.rig.set(this.cup.clone().addScaledVector(back, 7).add(new THREE.Vector3(0, 5.5, 0)), this.cup.clone().add(new THREE.Vector3(0, 0.6, 0)));
    this.stage.focusShadows(this.cup, 16);
  }

  /** The course is a set of turf islands; everything around them is water. */
  lake() {
    const w = this.world;
    w.ground({ mat: 'sand', tile: 6 });
    const geo = new THREE.PlaneGeometry(400, 400);
    geo.rotateX(-Math.PI / 2);
    this.waterMat = tiled(Mat.water(), 60);
    const water = w.mesh(geo, this.waterMat, { cast: false });
    water.position.y = WATER_Y;
    w.add(water);
    w.disposables.push(geo);
  }

  pad({ at, top = TOP, surface = 'fairway' }) {
    const [x0, z0, x1, z1] = at;
    const w = this.world;
    const slab = (ax0, az0, ax1, az1) => {
      const sx = ax1 - ax0;
      const sz = az1 - az0;
      if (sx < 0.01 || sz < 0.01) return;
      const cx = (ax0 + ax1) / 2;
      const cz = (az0 + az1) / 2;
      w.block({ pos: [cx, (top - TURF) / 2, cz], size: [sx, top - TURF, sz], mat: 'soil', tile: 2 });
      w.block({ pos: [cx, top - TURF / 2, cz], size: [sx, TURF, sz], mat: surface, tile: 4, friction: FRICTION[surface], kind: 'turf' });
    };
    const c = this.cup;
    if (c.x - CUP > x0 && c.x + CUP < x1 && c.z - CUP > z0 && c.z + CUP < z1) {
      c.y = top;
      slab(x0, z0, x1, c.z - CUP);
      slab(x0, c.z + CUP, x1, z1);
      slab(x0, c.z - CUP, c.x - CUP, c.z + CUP);
      slab(c.x + CUP, c.z - CUP, x1, c.z + CUP);
      this.makeCup();
    } else {
      slab(x0, z0, x1, z1);
    }
  }

  makeCup() {
    const w = this.world;
    const c = this.cup;
    w.block({ pos: [c.x, c.y - CUP_DEPTH - 0.1, c.z], size: [CUP * 2, 0.2, CUP * 2], mat: 'darkSteel', tile: 1, kind: 'cup' });
    // White liner so the hole reads as a cup, not a pit.
    for (const [dx, dz, sx, sz] of [[0, -CUP, CUP * 2, 0.04], [0, CUP, CUP * 2, 0.04], [-CUP, 0, 0.04, CUP * 2], [CUP, 0, 0.04, CUP * 2]]) {
      const m = w.mesh(new THREE.BoxGeometry(sx, CUP_DEPTH, sz), 'white', { cast: false });
      m.position.set(c.x + dx * 0.98, c.y - CUP_DEPTH / 2 - 0.01, c.z + dz * 0.98);
      w.add(m);
      w.disposables.push(m.geometry);
    }
  }

  makeFlag() {
    const g = new THREE.Group();
    const pole = this.world.mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8), 'white');
    pole.position.y = 0.8;
    const geo = new THREE.PlaneGeometry(1.2, 0.75, 12, 3);
    geo.translate(0.6, 0, 0);
    this.clothRest = Float32Array.from(geo.attributes.position.array);
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe8432f, roughness: 0.7, side: THREE.DoubleSide }));
    cloth.position.y = 2.2;
    cloth.castShadow = true;
    this.world.disposables.push(pole.geometry, geo, cloth.material);
    g.add(pole, cloth);
    g.position.copy(this.cup);
    this.world.add(g);
    this.flag = { g, cloth, lift: 0 };
  }

  makeArc() {
    const n = 36;
    const geo = new THREE.SphereGeometry(0.12, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false });
    this.arcMax = n;
    this.dots = new THREE.InstancedMesh(geo, mat, n);
    this.dots.frustumCulled = false;
    const ringGeo = new THREE.RingGeometry(0.55, 0.75, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false }));
    this.world.add(this.dots, this.ring);
    this.world.disposables.push(geo, mat, ringGeo, this.ring.material);
    this.dots.visible = this.ring.visible = false;
  }

  yawTo(target, from) {
    return Math.atan2(target.x - from.x, target.z - from.z);
  }

  distanceLabel() {
    return `${Math.round(Math.hypot(this.cup.x - this.lie.x, this.cup.z - this.lie.z))} m`;
  }

  /** Stands the dummy up on his lie, facing the cup, ready for the next stroke. */
  toLie(puff = true) {
    this.camYaw = this.yawTo(this.cup, this.lie);
    this.aimYaw = this.camYaw;
    this.power = 0;
    const d = this.ball;
    d.knockout = 0;
    d.setMuscle(1);
    d.ragdoll.teleport(this.lie.toArray(), this.aimYaw, 'ready');
    d.balance = 1;
    this.splashed = false;
    this.flopped = false;
    if (puff) {
      this.fx.puff(this.lie.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 8, color: 0xffffff, size: 0.6 });
      this.audio.pop();
    }
    this.hud?.set('dist', this.distanceLabel());
  }

  aimCamera(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const fwd = _v.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const ahead = 5 + this.power * 12;
    // Low and behind, looking up the hole, so the whole arc stays in frame.
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const pos = this.lie.clone().addScaledVector(fwd, portrait ? -8.5 : -7).addScaledVector(side, portrait ? 0.6 : 1.4).add(new THREE.Vector3(0, portrait ? 4.4 : 3.5, 0));
    const look = this.lie.clone().addScaledVector(fwd, ahead).add(new THREE.Vector3(0, this.power * 1.2, 0));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(this.lie.clone().addScaledVector(fwd, ahead * 0.6), 20);
  }

  launchVelocity(out = new THREE.Vector3()) {
    const speed = 3.5 + this.power * 14.5;
    const loft = this.def.loft ? this.def.loft * (Math.PI / 180) : LOFT;
    const h = Math.cos(loft) * speed;
    return out.set(Math.sin(this.aimYaw) * h, Math.sin(loft) * speed, Math.cos(this.aimYaw) * h);
  }

  onPointerDown() {
    if (this.phase === 'intro') {
      this.introT = 0;
      return;
    }
    if (this.phase === 'aim') this.dragging = true;
  }

  onPointerMove(p, start) {
    if (!this.dragging || this.phase !== 'aim') return;
    const s = Math.min(p.w, p.h);
    const dx = (p.px - start.px) / s;
    const dy = (p.py - start.py) / s;
    const len = Math.hypot(dx, dy);
    this.power = THREE.MathUtils.clamp((len - 0.03) / 0.4, 0, 1);
    // Slingshot: the dummy flies opposite to the pull.
    if (len > 0.04) this.aimYaw = this.camYaw + THREE.MathUtils.clamp(Math.atan2(dx, dy), -MAX_AIM, MAX_AIM);
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.power < 0.03) {
      this.power = 0;
      this.aimYaw = this.camYaw;
      return;
    }
    this.swing();
  }

  onKeyDown(code) {
    if (this.phase === 'intro') {
      this.introT = 0;
      return;
    }
    if (this.phase !== 'aim') return;
    const step = 2.5 * (Math.PI / 180);
    if (code === 'ArrowLeft') this.aimYaw = Math.min(this.camYaw + MAX_AIM, this.aimYaw + step);
    if (code === 'ArrowRight') this.aimYaw = Math.max(this.camYaw - MAX_AIM, this.aimYaw - step);
    if (code === 'ArrowUp') this.power = Math.min(1, this.power + 0.05);
    if (code === 'ArrowDown') this.power = Math.max(0, this.power - 0.05);
    this.keyAim = true;
    if ((code === 'Space' || code === 'Enter') && this.power > 0) this.swing();
  }

  swing() {
    this.phase = 'fly';
    this.keyAim = false;
    this.strokes++;
    this.hud.set('strokes', `${this.strokes}/${this.limit}`);
    this.hud.bump('strokes');
    this.hud.clearHint();
    this.dots.visible = this.ring.visible = false;
    this.flyT = 0;
    this.settle = 0;
    this.shotDir = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));

    const d = this.ball;
    d.balance = 0;
    d.setPose('tuck');
    d.setMuscle(0.8);
    const v = this.launchVelocity();
    d.ragdoll.addVelocity(v, 0);
    const side = new THREE.Vector3(this.shotDir.z, 0, -this.shotDir.x);
    d.ragdoll.addSpin(side.multiplyScalar(-(2 + this.power * 5)));
    this.audio.whoosh(0.5 + this.power);
    this.audio.impact(0.4 + this.power * 0.4, 'body');
    this.fx.puff(this.lie.clone(), { count: 4 + Math.round(this.power * 6), color: 0x9bd36a, size: 0.4 });
    if (this.power > 0.85) this.rig.kick(4);
  }

  fixedUpdate(dt) {
    if (this.phase !== 'fly' || this.splashed) return;
    const d = this.ball.ragdoll;
    if (this.wind.lengthSq() > 0) d.addVelocity(_v.copy(this.wind).multiplyScalar(dt));
    // A little lip-in: a slow dummy at the edge of the cup gets drawn over it.
    const p = this.ball.partPosition('pelvis');
    const dx = this.cup.x - p.x;
    const dz = this.cup.z - p.z;
    const r = Math.hypot(dx, dz);
    if (r < CUP * 1.3 && r > 0.05 && p.y > this.cup.y - 0.4 && p.y < this.cup.y + 0.8 && this.ball.speed() < 2.5) {
      d.addVelocity({ x: (dx / r) * 2.5 * dt, y: -1.5 * dt, z: (dz / r) * 2.5 * dt });
    }
  }

  onImpact(a, b, force, strength) {
    if (this.phase !== 'fly' || this.flopped || this.flyT < 0.15) return;
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!dummy || strength < 0.12) return;
    // First real touchdown: he stops being a ball and goes floppy.
    this.flopped = true;
    this.ball.setPose('starfish');
    this.ball.setMuscle(0.35);
    this.ball.knockOut(1.5, 1);
  }

  inCup(p) {
    return Math.abs(p.x - this.cup.x) < CUP && Math.abs(p.z - this.cup.z) < CUP && p.y < this.cup.y - 0.25 && p.y > this.cup.y - CUP_DEPTH - 0.5;
  }

  tick(dt) {
    this.waterMat.map.offset.x += dt * 0.012;
    this.waterMat.map.offset.y += dt * 0.006;
    this.waveFlag(dt);

    if (this.phase === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) {
        this.phase = 'aim';
        this.aimCamera();
      }
      return;
    }

    if (this.phase === 'aim') {
      this.aimCamera();
      this.updateArc();
      if (!this.dragging && !this.keyAim) this.ball.ragdoll.facing.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      else this.ball.ragdoll.facing.set(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));
      return;
    }

    if (this.phase === 'fly') {
      this.flyT += dt;
      const com = this.ball.com();
      const portrait = this.stage.width < this.stage.height;
      const pos = com.clone().addScaledVector(this.shotDir, portrait ? -9 : -7).add(new THREE.Vector3(0, portrait ? 6 : 4, 0));
      pos.y = Math.max(pos.y, this.lie.y + 2.5);
      this.rig.aim(pos, com.clone().addScaledVector(this.shotDir, 2), 3, 5);
      this.stage.focusShadows(com, 16);
      this.audio.loop('wind', Math.min(1, this.ball.speed() / 16), 'wind');

      const pelvis = this.ball.partPosition('pelvis');
      if (this.inCup(pelvis)) {
        this.holed();
        return;
      }
      if (!this.splashed && com.y < WATER_Y + 0.15) this.splash(com);
      if (this.splashed) {
        this.splashT += dt;
        if (this.splashT > 1.2) this.penalty('SPLASH!');
        return;
      }
      const quiet = this.ball.speed() < 0.35;
      this.settle = quiet && this.flyT > 0.8 ? this.settle + dt : 0;
      if (this.settle > 0.7 || this.flyT > 12) this.rest(com);
      return;
    }

    if (this.phase === 'reset') {
      this.resetT -= dt;
      if (this.resetT <= 0) this.nextStroke();
      return;
    }

    if (this.phase === 'holed') {
      const c = this.cup.clone();
      const portrait = this.stage.width < this.stage.height;
      this.rig.aim(c.clone().add(new THREE.Vector3(Math.sin(this.time * 0.5) * 5, portrait ? 6 : 4, Math.cos(this.time * 0.5) * 5)), c, 1.5, 3);
      this.doneT -= dt;
      if (this.doneT <= 0) this.complete();
    }
  }

  waveFlag(dt) {
    const f = this.flag;
    const near = this.phase === 'fly' && this.ball.com().distanceTo(this.cup) < 5;
    // The pin comes out as he arrives, so he never tangles with the pole.
    f.lift = THREE.MathUtils.damp(f.lift, near || this.phase === 'holed' ? 1 : 0, 8, dt);
    f.g.scale.setScalar(Math.max(0.001, 1 - f.lift));
    f.g.visible = f.lift < 0.98;
    const windYaw = this.wind.lengthSq() > 0 ? Math.atan2(-this.wind.z, this.wind.x) : 0.6;
    f.cloth.rotation.y = windYaw + Math.sin(this.time * 0.8) * 0.15;
    const pos = f.cloth.geometry.attributes.position;
    const rest = this.clothRest;
    const amp = 0.06 + Math.min(0.12, this.wind.length() * 0.03);
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3];
      pos.setZ(i, Math.sin(x * 5 - this.time * 7) * amp * x);
    }
    pos.needsUpdate = true;
  }

  /**
   * Dotted flight path. Early holes show all of it plus the landing ring;
   * later ones only reveal the start (`def.arc` < 1), so judging the power is on you.
   */
  updateArc() {
    const show = this.power > 0.02;
    this.dots.visible = show;
    this.ring.visible = false;
    if (!show) return;
    const reveal = this.def.arc ?? 1;
    const handles = this.ball.ragdoll.handles;
    const filter = (c) => !handles.has(c.handle);
    const v = this.launchVelocity();
    const prev = this.ball.com();
    const next = new THREE.Vector3();
    const path = [];
    let landed = null;
    const dt = 0.06;
    for (let i = 0; i < 120 && !landed; i++) {
      v.x += this.wind.x * dt;
      v.z += this.wind.z * dt;
      v.y += this.gravity * dt;
      next.copy(prev).addScaledVector(v, dt);
      const seg = _v.copy(next).sub(prev);
      const len = seg.length();
      const hit = this.physics.castRay(prev, seg.divideScalar(len), len, filter);
      if (hit) landed = prev.clone().addScaledVector(seg, hit.distance);
      else if (next.y < WATER_Y) landed = next.clone().setY(WATER_Y);
      prev.copy(next);
      path.push(prev.clone());
    }
    const shown = Math.max(2, Math.floor(path.length * reveal));
    const stride = Math.max(1, Math.ceil(shown / this.arcMax));
    const m = new THREE.Matrix4();
    let count = 0;
    for (let i = 1; i < shown && count < this.arcMax; i += stride) {
      const s = 1 - (i / path.length) * 0.5;
      m.makeScale(s, s, s).setPosition(path[i]);
      this.dots.setMatrixAt(count++, m);
    }
    this.dots.count = count;
    this.dots.instanceMatrix.needsUpdate = true;
    if (landed && reveal >= 1) {
      this.ring.visible = true;
      this.ring.position.copy(landed).add(new THREE.Vector3(0, 0.04, 0));
      this.ring.material.color.set(landed.y <= WATER_Y + 0.01 ? 0x5ab4ff : 0xffd23f);
    }
  }

  splash(com) {
    this.splashed = true;
    this.splashT = 0;
    const at = new THREE.Vector3(com.x, WATER_Y, com.z);
    this.audio.splash(1);
    this.fx.chips(at, { count: 30, colors: [0xcfeeff, 0x9fd0e0, 0xffffff], size: 0.07, speed: 5, life: 1.1, floor: WATER_Y });
    this.fx.puff(at, { count: 10, color: 0xffffff, size: 0.9, speed: 1.8, up: 1.4 });
    this.audio.loop('wind', 0, 'wind');
  }

  /** Where did he stop? Play on from there, or take a penalty if it's not on the course. */
  rest(com) {
    this.audio.loop('wind', 0, 'wind');
    const handles = this.ball.ragdoll.handles;
    const hit = this.physics.castRay({ x: com.x, y: com.y + 0.5, z: com.z }, DOWN, 6, (c) => !handles.has(c.handle));
    const info = hit && this.physics.info(hit.collider.handle);
    if (!hit || info?.kind === 'ground') {
      this.penalty('OUT OF BOUNDS');
      return;
    }
    this.lie.set(com.x, com.y + 0.5 - hit.distance, com.z);
    // Resting on the lip counts: he'd topple in the moment he stood up.
    if (Math.hypot(this.lie.x - this.cup.x, this.lie.z - this.cup.z) < CUP + 0.1) {
      this.holed();
      return;
    }
    this.afterStroke();
  }

  penalty(label) {
    this.strokes++;
    this.hud.set('strokes', `${this.strokes}/${this.limit}`);
    this.hud.bump('strokes');
    this.game.ui.banner(label, '+1 stroke');
    this.audio.ding(-5);
    this.afterStroke(0.9);
  }

  afterStroke(delay = 0.35) {
    this.phase = 'reset';
    this.resetT = delay;
    this.audio.loop('wind', 0, 'wind');
  }

  nextStroke() {
    if (this.strokes >= this.limit) {
      this.complete();
      return;
    }
    this.toLie();
    this.phase = 'aim';
    if (this.strokes === 1) this.hud.hint('Keep going — sink him!');
  }

  holed() {
    this.phase = 'holed';
    this.sunk = true;
    this.doneT = 2.6;
    this.audio.loop('wind', 0, 'wind');
    const diff = this.strokes - this.par;
    const label = this.strokes === 1 ? 'HOLE IN ONE!' : LABELS[Math.max(-3, diff)] ?? `+${diff}`;
    this.game.ui.banner(label, `${this.strokes} ${this.strokes === 1 ? 'stroke' : 'strokes'}`);
    this.audio.cup();
    if (diff <= 0) this.audio.win();
    else this.audio.ding(2);
    const top = this.cup.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.fx.confetti(top, diff < 0 || this.strokes === 1 ? 160 : 90);
    this.rig.shake(0.2);
    this.slowmo = 1;
  }

  complete() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    const sunk = Boolean(this.sunk);
    const s = this.strokes;
    const stars = !sunk ? 0 : s < this.par ? 3 : s === this.par ? 2 : 1;
    const score = sunk ? 1000 + Math.max(0, this.limit - s) * 500 + (s === 1 ? 2000 : 0) : 0;
    this.finish({
      passed: sunk,
      stars,
      score,
      reason: `Sink him in ${this.limit} strokes or fewer.`,
      stats: [
        ['Strokes', sunk ? `${s}` : '—'],
        ['Par', `${this.par}`],
      ],
    });
  }
}
