import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const W = 10; // board width
const TOP = 13; // dropper height
const DEPTH = 0.65; // half the gap between back board and glass
const PEG_R = 0.18;
const PEG_TOP = 10.4; // first row, clear of the dangling ragdoll
const KICK = 6.5;
const CHEST = { x: 0, y: 0.17, z: 0 };
const BUCKET_H = 1.2;
const COLORS = { 1000: '#ef4b3c', 500: '#ff8a2a', 300: '#3c86e8', 100: '#3fcf7a', 0: '#9aa0ab', x2: '#9b5de5' };
const _a = new THREE.Vector3();

/** A number painted on a small card, for the bucket labels. */
function label(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 116, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Plinko Party: aim the dropper, let go, and the ragdoll — curled into a ball —
 * pinballs down through the pegs into a scoring bucket. Bumpers kick, stars
 * pay out on the way down, and the middle bucket is worth the most.
 */
export class PlinkoLevel extends Level {
  setup() {
    const def = this.def;
    this.drops = def.drops ?? 3;
    this.dropped = 0;
    this.total = 0;
    this.aimX = 0;
    this.phase = 'aim';
    this.bumpers = [];
    this.pickups = [];
    this.movers = [];

    this.scenery();
    this.clutter([[-8, 1.5], [8, 1], [-9.5, -3]]);
    this.board();
    this.pegs();
    for (const b of def.bumpers ?? []) this.bumper(b);
    for (const p of def.pickups ?? []) this.pickup(p);
    for (const m of def.movers ?? []) this.mover(m);
    this.buckets(def.buckets);
    this.dropper();
    this.load();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'drops', icon: 'dummy', value: this.drops },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.meter('Target', 0);
    this.hud.hint(def.hint ?? 'Drag to aim · let go to drop · the middle bucket pays most');
    this.cameraFor(true);
  }

  // ---------- board ----------

  slab(x, y, w, h, mat, z = 0, d = DEPTH * 2) {
    const m = this.world.mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.world.add(m);
    const body = this.world.fixedBody([x, y, z], new THREE.Quaternion());
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setRestitution(0.3).setCollisionGroups(groups(Group.WORLD)), body, { kind: 'static', material: 'rubber' });
    return m;
  }

  board() {
    const w = this.world;
    const back = w.mesh(new THREE.BoxGeometry(W + 0.6, TOP + 1, 0.2), 'white');
    back.position.set(0, (TOP + 1) / 2, -DEPTH - 0.1);
    w.add(back);
    const backBody = w.fixedBody([0, (TOP + 1) / 2, -DEPTH - 0.1], new THREE.Quaternion());
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(W / 2 + 0.3, (TOP + 1) / 2, 0.1).setFriction(0.1).setCollisionGroups(groups(Group.WORLD)), backBody);
    // Invisible glass in front keeps him on the board.
    const glass = w.fixedBody([0, (TOP + 1) / 2, DEPTH + 0.1], new THREE.Quaternion());
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(W / 2 + 0.3, (TOP + 1) / 2, 0.1).setFriction(0.1).setCollisionGroups(groups(Group.WORLD)), glass);
    for (const s of [-1, 1]) this.slab(s * (W / 2 + 0.15), (TOP + 1) / 2, 0.3, TOP + 1, 'toyBlue');
    const cap = w.mesh(new THREE.BoxGeometry(W + 0.9, 0.3, DEPTH * 2 + 0.3), 'toyBlue');
    cap.position.set(0, TOP + 1.1, 0);
    w.add(cap);
  }

  pegs() {
    const def = this.def;
    const rows = def.rows ?? 6;
    const gap = def.gap ?? 1.9;
    const geo = new THREE.CylinderGeometry(PEG_R, PEG_R, DEPTH * 2, 12).rotateX(Math.PI / 2);
    this.world.disposables.push(geo);
    // Leave room round the bumpers, stars and sliding bars.
    const clear = (x, y) =>
      (def.bumpers ?? []).some((b) => Math.hypot(x - b.x, y - b.y) < (b.r ?? 0.45) + 0.55) ||
      (def.pickups ?? []).some((p) => Math.hypot(x - p.x, y - p.y) < 0.6) ||
      (def.movers ?? []).some((m) => Math.abs(y - m.y) < 0.6);
    for (let r = 0; r < rows; r++) {
      const y = PEG_TOP - r * 1.35;
      const n = r % 2 ? Math.floor((W - 1.2) / gap) : Math.floor((W - 1.2) / gap) + 1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * gap;
        if (clear(x, y)) continue;
        const m = this.world.mesh(geo, 'toyDark');
        m.position.set(x, y, 0);
        this.world.add(m);
        const body = this.world.fixedBody([x, y, 0], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
        this.physics.createCollider(
          RAPIER.ColliderDesc.cylinder(DEPTH, PEG_R).setRestitution(0.5).setFriction(0.02).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
          body,
          { kind: 'peg', x, material: 'metal' },
        );
      }
    }
  }

  bumper({ x, y, r = 0.45, points = 50 }) {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffc928, emissive: 0xff8a2a, emissiveIntensity: 0.2, roughness: 0.3 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, DEPTH * 2, 24).rotateX(Math.PI / 2), capMat);
    m.position.set(x, y, 0);
    this.world.disposables.push(m.geometry, capMat);
    this.world.add(m);
    const body = this.world.fixedBody([x, y, 0], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    const bump = { x, y, r, points, m, capMat, flash: 0, last: -1 };
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(DEPTH, r).setRestitution(0.7).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'bumper', bump, material: 'rubber' },
    );
    this.bumpers.push(bump);
  }

  pickup({ x, y, points = 100 }) {
    const m = this.world.mesh(new THREE.OctahedronGeometry(0.32), 'gold', { cast: false });
    m.position.set(x, y, 0.2);
    this.world.add(m);
    this.pickups.push({ x, y, points, m, got: false });
  }

  mover({ y, w = 2.4, amp = 2.5, sp = 1, ph = 0 }) {
    const m = this.world.mesh(new THREE.BoxGeometry(w, 0.3, DEPTH * 2), 'toyPurple');
    this.world.add(m);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, 0.15, DEPTH).setRestitution(0.4).setCollisionGroups(groups(Group.WORLD)), body, { kind: 'static', material: 'rubber' });
    this.physics.link(body, m);
    this.movers.push({ body, y, amp, sp, ph });
  }

  buckets(values = [100, 300, 1000, 300, 100]) {
    const n = values.length;
    const bw = W / n;
    this.bucketList = values.map((v, i) => {
      const x0 = -W / 2 + i * bw;
      const color = COLORS[v] ?? '#3c86e8';
      const tex = label(v === 'x2' ? '×2' : String(v), color);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.8, bw * 0.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      card.position.set(x0 + bw / 2, BUCKET_H + 0.45, DEPTH + 0.25);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.1, DEPTH * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
      floor.position.set(x0 + bw / 2, 0.02, 0);
      this.world.disposables.push(card.geometry, card.material, tex, floor.geometry, floor.material);
      this.world.add(card, floor);
      return { x0, x1: x0 + bw, value: v, card };
    });
    for (let i = 1; i < n; i++) this.slab(-W / 2 + i * bw, BUCKET_H / 2, 0.16, BUCKET_H, 'toyDark');
  }

  dropper() {
    const g = new THREE.Group();
    const cab = this.world.mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), 'toyRed');
    const hook = this.world.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), 'toyDark');
    hook.position.y = -0.4;
    g.add(cab, hook);
    this.world.add(g);
    this.claw = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, TOP + 0.5, 0));
    this.physics.link(this.claw, g);
  }

  load() {
    const d = this.spawnDummy({ position: [this.claw.translation().x, TOP + 0.5 - 0.65 - 0.1 - 1.41, 0], yaw: 0, pose: 'hang', muscle: 0.6 });
    this.rope = this.physics.world.createImpulseJoint(RAPIER.JointData.rope(0.1, { x: 0, y: -0.65, z: 0 }, CHEST), this.claw, d.parts.chest.body, true);
    this.ball = d;
    this.phase = 'aim';
    this.physics.snapAll();
  }

  drop() {
    if (this.phase !== 'aim') return;
    this.physics.world.removeImpulseJoint(this.rope, true);
    const v = this.ball.velocity(_a);
    this.ball.ragdoll.addVelocity({ x: -v.x * 0.8, y: 0, z: -v.z });
    this.phase = 'falling';
    this.fallT = 0;
    this.stillT = 0;
    this.stillAt = this.ball.com();
    this.ball.setPose('tuck');
    this.ball.lively = 0.35;
    this.ball.setMuscle(1);
    this.dropped++;
    this.hud.set('drops', this.drops - this.dropped);
    this.hud.clearHint();
    this.audio.whoosh(0.8);
  }

  // ---------- input ----------

  aimAt(p) {
    this.aimX = THREE.MathUtils.clamp((p.x - 0.5) * W * 1.25, -W / 2 + 0.8, W / 2 - 0.8);
  }

  onPointerDown(p) {
    if (this.phase === 'aim') this.aimAt(p);
  }

  onPointerMove(p) {
    if (this.phase === 'aim') this.aimAt(p);
  }

  onPointerUp() {
    this.drop();
  }

  onKeyDown(code) {
    if (this.phase !== 'aim') return;
    if (code === 'ArrowLeft' || code === 'KeyA') this.aimX = Math.max(-W / 2 + 0.8, this.aimX - 0.8);
    if (code === 'ArrowRight' || code === 'KeyD') this.aimX = Math.min(W / 2 - 0.8, this.aimX + 0.8);
    if (code === 'Space' || code === 'Enter' || code === 'ArrowDown') this.drop();
  }

  // ---------- play ----------

  onContact(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      // Pegs deflect him like a chip, so he never comes to rest on top of one.
      if (x.kind === 'peg' && y.kind === 'dummy' && this.phase === 'falling' && this.time - (this.lastPeg ?? -1) > 0.12) {
        this.lastPeg = this.time;
        const dx = this.ball.com(_a).x - x.x;
        const side = Math.abs(dx) > 0.15 ? Math.sign(dx) : Math.random() < 0.5 ? -1 : 1;
        this.ball.ragdoll.addVelocity({ x: side * (0.6 + Math.random() * 0.6), y: 0, z: 0 });
        this.audio.tone(900 + Math.random() * 500, 700, 0.05, { type: 'triangle', gain: 0.06 });
      }
      if (x.kind !== 'bumper' || y.kind !== 'dummy' || this.phase !== 'falling') continue;
      const bump = x.bump;
      if (this.time - bump.last < 0.15) continue;
      bump.last = this.time;
      const c = this.ball.com(_a);
      const dx = c.x - bump.x;
      const dy = c.y - bump.y;
      const len = Math.hypot(dx, dy) || 1;
      this.ball.ragdoll.addVelocity({ x: (dx / len) * KICK, y: Math.max(1, (dy / len) * KICK), z: 0 }, 0.3);
      bump.flash = 1;
      this.addPoints(bump.points, _a.set(bump.x, bump.y + 0.8, 0.5));
      this.audio.spring();
    }
  }

  addPoints(pts, at) {
    this.total += pts;
    this.hud.set('score', this.total.toLocaleString());
    this.hud.meter('Target', this.total / this.def.goals[2], this.total >= this.def.goals[0]);
    this.fx.text(at.clone(), `+${pts}`, { color: '#ffd23a', size: 22, life: 0.8 });
  }

  fixedUpdate(dt) {
    const cx = this.claw.translation().x;
    const x = cx + THREE.MathUtils.clamp((this.aimX - cx) * dt * 8, -5 * dt, 5 * dt);
    this.claw.setNextKinematicTranslation({ x, y: TOP + 0.5, z: 0 });
    for (const m of this.movers) m.body.setNextKinematicTranslation({ x: Math.sin(this.time * m.sp + m.ph) * m.amp, y: m.y, z: 0 });
    if (this.phase !== 'falling') return;
    this.fallT += dt;
    const c = this.ball.com(_a);
    // Stay on the board's plane.
    this.ball.ragdoll.addVelocity({ x: 0, y: 0, z: -c.z * 3 * dt });
    for (const p of this.pickups) {
      if (p.got || Math.hypot(c.x - p.x, c.y - p.y) > 0.8) continue;
      p.got = true;
      p.m.visible = false;
      this.audio.coin(2);
      this.fx.chips(_a.set(p.x, p.y, 0.3), { count: 12, colors: [0xffd23a, 0xffffff], size: 0.06, speed: 3, life: 0.7 });
      this.addPoints(p.points, _a.set(p.x, p.y + 0.8, 0.5));
    }
    // Perched or wedged on the pegs: pop him off one side.
    this.stillT += dt;
    if (this.stillT > 0.5) {
      if (c.y > BUCKET_H + 0.6 && c.distanceTo(this.stillAt) < 0.2) this.ball.ragdoll.addVelocity({ x: (Math.random() < 0.5 ? -1 : 1) * 2.2, y: 2.5, z: 0 });
      this.stillT = 0;
      this.stillAt.copy(c);
    }
    if ((c.y < BUCKET_H && this.ball.speed() < 1.2) || c.y < 0.6 || this.fallT > 14) this.land(c);
  }

  land(c) {
    this.phase = 'landed';
    const bucket = this.bucketList.find((b) => c.x >= b.x0 && c.x < b.x1) ?? this.bucketList[0];
    const at = new THREE.Vector3((bucket.x0 + bucket.x1) / 2, BUCKET_H + 1.4, 0.6);
    if (bucket.value === 'x2') {
      this.fx.text(at, 'DOUBLE!', { color: '#9b5de5', size: 36, life: 1.4 });
      this.total *= 2;
      this.hud.set('score', this.total.toLocaleString());
      this.hud.meter('Target', this.total / this.def.goals[2], this.total >= this.def.goals[0]);
      this.audio.ding(4);
    } else {
      this.addPoints(bucket.value, at);
      if (bucket.value >= 1000) {
        this.fx.confetti(at, 80);
        this.audio.ding(5);
        this.game.ui.banner('JACKPOT!', `+${bucket.value}`);
      } else if (bucket.value > 0) this.audio.ding(1);
      else this.audio.lose();
    }
    bucket.card.scale.setScalar(1.3);
    this.nextT = 1.3;
  }

  tick(dt) {
    this.cameraFor();
    for (const b of this.bumpers) {
      b.flash = Math.max(0, b.flash - dt * 4);
      b.capMat.emissiveIntensity = 0.2 + b.flash * 1.4;
      b.m.scale.setScalar(1 + b.flash * 0.15);
    }
    for (const p of this.pickups) p.m.rotation.y += dt * 3;
    for (const b of this.bucketList) b.card.scale.lerp(_a.set(1, 1, 1), Math.min(1, dt * 4));
    if (this.phase === 'landed') {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (this.dropped >= this.drops) this.complete();
        else {
          this.removeDummy(this.ball);
          this.load();
        }
      }
    }
  }

  /** One more drop. */
  revive() {
    this.drops++;
    this.hud.set('drops', this.drops - this.dropped);
    if (this.ball) this.removeDummy(this.ball);
    this.load();
  }

  complete() {
    this.phase = 'done';
    const [a, b, c] = this.def.goals;
    const stars = this.total >= c ? 3 : this.total >= b ? 2 : this.total >= a ? 1 : 0;
    this.finish({
      passed: stars > 0,
      stars,
      score: this.total,
      reason: `Score ${a.toLocaleString()} points from your drops.`,
      stats: [
        ['Points', this.total.toLocaleString()],
        ['Drops', `${this.dropped}`],
      ],
    });
  }

  cameraFor(snap = false) {
    // The whole board, dropper to buckets, whatever the screen shape. The box
    // runs below the floor so the buckets sit clear of the HUD at the bottom.
    const portrait = this.stage.width < this.stage.height;
    const { pos, look } = this.frameBox(_a.set(-W / 2 - 0.3, portrait ? -1.5 : -2.8, -0.5), new THREE.Vector3(W / 2 + 0.3, TOP + 1, 0.5), { pitch: 4, margin: 0.92 });
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2, 2);
    this.stage.focusShadows(look, 12);
  }
}
