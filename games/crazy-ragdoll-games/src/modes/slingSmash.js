import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';

// The fork opens across the line of fire, so from behind it's a proper Y
// with the ragdoll sat in the pouch between the prongs.
const REST = new THREE.Vector3(-0.15, 2.55, 0); // pouch at rest, just behind the fork tips
const FORK = new THREE.Vector3(0, 1.75, 0);
const TIPS = [new THREE.Vector3(0, 2.75, -0.6), new THREE.Vector3(0, 2.75, 0.6)];
const CHEST = { x: 0, y: 0.17, z: 0 };
const MAX_PULL = 2.3; // m
const POWER = 9.5; // launch speed per metre of pull
const MIN_PULL = 0.45;
const LIFT = 0.5; // the pouch dips this much per metre pulled back, which sets the launch angle
const MAX_YAW = 0.45; // rad either side
const BLAST_R = 3.4;
const DOTS = 16;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Sling Smash: seen from behind a giant slingshot, pull the ragdoll back,
 * aim left or right, let go, and send him into crate forts across the yard.
 * Every TNT crate has to go up before the ragdolls run out; bullseyes
 * standing round the fort and knocking crates over score on top.
 */
export class SlingSmashLevel extends Level {
  setup() {
    const def = this.def;
    this.shots = def.shots ?? 3;
    this.shot = 0;
    this.pull = new THREE.Vector3();
    this.aiming = false;
    this.phase = 'load';
    this.tnts = [];
    this.blown = 0;
    this.points = 0;
    this.yaw = 0;
    this.back = 0;
    this.dir = new THREE.Vector3(1, 0, 0);

    this.scenery({ run: { axis: 'x', to: 40, both: true } });
    this.slingshot();
    for (const p of def.fort) this.piece(p);
    for (const [x, z, y = 2, points = 300] of def.targets ?? []) this.world.bullseye({ pos: [x, y, z], yaw: -90, radius: 0.8, points });
    this.dots = this.trail();
    this.load();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'shots', icon: 'dummy', value: this.shots },
        { id: 'tnt', icon: 'bolt', value: `0/${this.tnts.length}` },
        { id: 'points', icon: 'target', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Drag down to pull back · left or right to aim · let go to fire');
    this.cameraFor(true);
  }

  // ---------- set ----------

  slingshot() {
    const w = this.world;
    const g = new THREE.Group();
    const base = w.mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.25, 16), 'darkSteel');
    base.position.y = 0.12;
    const trunk = w.mesh(new THREE.CylinderGeometry(0.17, 0.24, FORK.y, 14), 'crate');
    trunk.position.y = FORK.y / 2;
    const knot = w.mesh(new THREE.SphereGeometry(0.2, 14, 10), 'crate');
    knot.position.copy(FORK);
    g.add(base, trunk, knot);
    for (const tip of TIPS) {
      const len = FORK.distanceTo(tip);
      const arm = w.mesh(new THREE.CylinderGeometry(0.09, 0.14, len, 12), 'crate');
      arm.position.copy(FORK).add(tip).multiplyScalar(0.5);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _a.copy(tip).sub(FORK).normalize());
      const cap = w.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 12), 'toyDark');
      cap.position.copy(tip);
      cap.quaternion.copy(arm.quaternion);
      g.add(arm, cap);
    }
    w.add(g);
    this.pouch = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(REST.x, REST.y, REST.z));
    this.pouchMesh = w.mesh(new THREE.BoxGeometry(0.14, 0.34, 0.5), 'toyDark');
    w.add(this.pouchMesh);
    this.physics.link(this.pouch, this.pouchMesh);
    const band = new THREE.CylinderGeometry(0.045, 0.045, 1, 8).translate(0, 0.5, 0);
    this.world.disposables.push(band);
    this.bands = TIPS.map(() => {
      const m = new THREE.Mesh(band, new THREE.MeshStandardMaterial({ color: 0x7a2a1c, roughness: 0.6 }));
      this.world.disposables.push(m.material);
      w.add(m);
      return m;
    });
  }

  piece(p) {
    const w = this.world;
    const y = p.y ?? 0;
    if (p.t === 'crate') w.crate({ pos: [p.x, y + (p.s ?? 1) / 2, 0], size: p.s ?? 1 });
    else if (p.t === 'box') w.crate({ pos: [p.x, y + 0.3, 0], size: 0.6, kind: 'cardboard' });
    else if (p.t === 'plank') w.plank({ pos: [p.x, y + 0.05, 0], size: [p.len ?? 3, 0.1, 0.9], mass: 12 });
    else if (p.t === 'barrel') w.barrel({ pos: [p.x, y + 0.45, 0] });
    else if (p.t === 'container') w.container({ pos: [p.x, y, 0], yaw: 90, color: p.color ?? 'steelBlue' });
    else if (p.t === 'tnt') {
      this.tnts.push({ prop: w.tnt({ pos: [p.x, y + 0.4, 0] }), alive: true, v: 0 });
    }
  }

  trail() {
    const geo = new THREE.SphereGeometry(0.07, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.world.disposables.push(geo, mat);
    return Array.from({ length: DOTS }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.world.add(m);
      return m;
    });
  }

  load() {
    this.pouch.setTranslation({ x: REST.x, y: REST.y, z: REST.z }, true);
    this.pouch.setNextKinematicTranslation({ x: REST.x, y: REST.y, z: REST.z });
    const d = this.spawnDummy({ position: [REST.x, REST.y - 0.08 - 1.41, 0], yaw: Math.PI / 2, pose: 'tuck', muscle: 0.8 });
    d.hits = 0;
    d.lively = 0.5;
    this.rope = this.physics.world.createImpulseJoint(RAPIER.JointData.rope(0.08, { x: 0, y: 0, z: 0 }, CHEST), this.pouch, d.parts.chest.body, true);
    this.ball = d;
    this.pull.set(0, 0, 0);
    this.back = 0;
    this.phase = 'aim';
    this.physics.snapAll();
  }

  // ---------- input ----------

  onPointerDown(p) {
    if (this.phase !== 'aim') return;
    this.aiming = true;
    this.hud.clearHint();
    this.audio.click?.();
    this.onPointerMove(p, p);
  }

  onPointerMove(p, start) {
    if (!this.aiming) return;
    // Dragging down a third of the shorter screen side is a full pull; like a
    // real slingshot, pulling to one side sends him the other way.
    const k = MAX_PULL / (Math.min(p.w, p.h) * 0.33);
    this.back = THREE.MathUtils.clamp((p.py - start.py) * k, 0, MAX_PULL);
    this.yaw = THREE.MathUtils.clamp(-(p.px - start.px) * k * 0.3, -MAX_YAW, MAX_YAW);
    this.setPull();
  }

  /** The pouch position for the current pull and aim: back, down, and off to the side. */
  setPull() {
    const b = this.back;
    this.pull.set(-b * Math.cos(this.yaw), -b * LIFT, -b * Math.sin(this.yaw));
  }

  onPointerUp() {
    if (!this.aiming) return;
    this.aiming = false;
    this.fire();
  }

  onKeyDown(code) {
    if (this.phase !== 'aim') return;
    // Keyboard aiming: arrows nudge the pull, Space fires.
    if (code === 'ArrowLeft') this.yaw = Math.max(-MAX_YAW, this.yaw - 0.04);
    if (code === 'ArrowRight') this.yaw = Math.min(MAX_YAW, this.yaw + 0.04);
    if (code === 'ArrowDown') this.back = Math.min(MAX_PULL, this.back + 0.12);
    if (code === 'ArrowUp') this.back = Math.max(0, this.back - 0.12);
    this.setPull();
    if (code === 'Space' || code === 'Enter') this.fire();
    this.hud.clearHint();
  }

  launch(out) {
    return out.copy(this.pull).multiplyScalar(-POWER);
  }

  fire() {
    if (this.phase !== 'aim') return;
    if (this.pull.length() < MIN_PULL) {
      this.pull.set(0, 0, 0);
      return;
    }
    this.physics.world.removeImpulseJoint(this.rope, true);
    const v = this.launch(_a);
    const d = this.ball;
    d.ragdoll.setVelocity({ x: v.x, y: v.y, z: v.z });
    this.dir.set(v.x, 0, v.z).normalize();
    d.ragdoll.addSpin(_b.copy(this.dir).cross(UP).multiplyScalar(-v.length() * 0.25));
    d.setPose('starfish');
    d.setMuscle(0.5);
    d.lively = 1;
    this.shot++;
    this.hud.set('shots', this.shots - this.shot);
    this.phase = 'flying';
    this.flyT = 0;
    this.restT = 0;
    this.pull.set(0, 0, 0);
    this.back = 0;
    this.audio.whoosh(1.5);
    this.audio.spring();
    this.rig.kick(4);
    for (const dot of this.dots) dot.visible = false;
  }

  // ---------- play ----------

  fixedUpdate(dt) {
    // The pouch chases the finger, and snaps back once he's away.
    const target = _a.copy(REST).add(this.phase === 'aim' ? this.pull : _b.set(0, 0, 0));
    const t = this.pouch.translation();
    const k = Math.min(1, dt * (this.phase === 'aim' ? 18 : 10));
    this.pouch.setNextKinematicTranslation({ x: t.x + (target.x - t.x) * k, y: t.y + (target.y - t.y) * k, z: t.z + (target.z - t.z) * k });

    for (const n of this.tnts) {
      if (!n.alive) continue;
      if (n.hit) {
        this.explode(n);
        continue;
      }
      const lv = n.prop.body.linvel();
      const v = Math.hypot(lv.x, lv.y, lv.z);
      // A sharp knock, or a fall that stops dead, sets it off.
      if (Math.abs(v - n.v) > 3.2) this.explode(n);
      else n.v = v;
    }
  }

  onTargetHit(target, by) {
    if (!this.world.hitTarget(target)) return;
    const d = this.dummyFor(by);
    const pts = target.points + (d && d.hits++ ? 200 : 0);
    this.points += pts;
    this.hud.set('points', this.points);
    this.hud.bump('points');
    const p = target.group.position;
    this.fx.text(_b.set(p.x, p.y + 1.2, p.z), `+${pts}`, { color: '#ffd23a', size: 34 });
    this.fx.chips(p, { count: 20, colors: [0xffd23a, 0xffffff, 0xd23a2c], size: 0.07, speed: 5, life: 0.9 });
    this.audio.ding?.(2);
    this.rig.shake(0.2);
  }

  /** He landed on it hard: that sets it off even if the crate couldn't move. */
  onImpact(a, b, force, strength) {
    const tnt = a.kind === 'dummy' ? b.prop : b.kind === 'dummy' ? a.prop : null;
    if (!tnt || strength < 0.08) return;
    const n = this.tnts.find((t) => t.prop === tnt && t.alive);
    if (n) n.hit = true;
  }

  explode(n) {
    n.alive = false;
    const p = n.prop.body.translation();
    const at = new THREE.Vector3(p.x, p.y, p.z);
    this.physics.removeBody(n.prop.body);
    n.prop.mesh.visible = false;
    this.world.props = this.world.props.filter((x) => x !== n.prop);
    this.blast(at, BLAST_R);
    this.blown++;
    this.hud.set('tnt', `${this.blown}/${this.tnts.length}`);
    this.hud.bump('tnt');
  }

  tick(dt) {
    this.cameraFor();
    this.drawBands();
    this.drawTrail();
    if (this.phase === 'flying') {
      this.flyT += dt;
      this.restT = this.ball.speed() < 0.5 ? this.restT + dt : 0;
      if (this.blown === this.tnts.length) this.win();
      else if (this.restT > 0.8 || this.flyT > 7 || this.ball.com(_a).x > 60) {
        this.phase = 'between';
        this.nextT = 0.8;
      }
    } else if (this.phase === 'between') {
      this.nextT -= dt;
      if (this.blown === this.tnts.length) this.win();
      else if (this.nextT <= 0) {
        if (this.shot >= this.shots) this.lose();
        else {
          this.removeDummy(this.ball);
          this.load();
        }
      }
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  drawBands() {
    const p = this.pouchMesh.position;
    TIPS.forEach((tip, i) => {
      const b = this.bands[i];
      b.position.copy(tip);
      _a.copy(p).sub(tip);
      b.scale.set(1, Math.max(0.01, _a.length()), 1);
      b.quaternion.setFromUnitVectors(_b.set(0, 1, 0), _a.normalize());
    });
  }

  drawTrail() {
    const show = this.phase === 'aim' && this.pull.length() >= MIN_PULL;
    if (!show) {
      for (const dot of this.dots) dot.visible = false;
      return;
    }
    const v = this.launch(_b);
    const c = this.ball.com(_a);
    this.dots.forEach((dot, i) => {
      const t = (i + 1) * 0.09;
      dot.position.set(c.x + v.x * t, c.y + v.y * t + 0.5 * this.gravity * t * t, c.z + v.z * t);
      dot.visible = dot.position.y > 0;
      dot.scale.setScalar(1 - i / (DOTS * 1.4));
    });
  }

  win() {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.passed = true;
    this.endT = 1.8;
    this.audio.win();
    this.fx.confetti(this.ball.com(_a).add(_b.set(0, 2, 0)), 140);
    this.game.ui.banner('KABOOM!', 'Every TNT crate is gone');
  }

  lose() {
    this.phase = 'end';
    this.passed = false;
    this.endT = 0.6;
  }

  /** One more ragdoll in the sling. */
  revive() {
    this.shots++;
    this.hud.set('shots', this.shots - this.shot);
    this.removeDummy(this.ball);
    this.load();
    this.cameraFor(true);
  }

  knocked() {
    let n = 0;
    for (const p of this.world.props) {
      const t = p.body.translation();
      const r = p.body.rotation();
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y) > 0.5 || 1 - Math.abs(r.w) > 0.1) n++;
    }
    return n;
  }

  complete() {
    this.phase = 'done';
    const left = this.shots - this.shot;
    const stars = !this.passed ? 0 : left >= 2 ? 3 : left === 1 ? 2 : 1;
    const smashed = this.knocked();
    this.finish({
      passed: this.passed,
      stars,
      score: this.blown * 500 + smashed * 50 + this.points + (this.passed ? left * 400 : 0),
      reason: 'Blow up every TNT crate before you run out of ragdolls.',
      stats: [
        ['TNT', `${this.blown}/${this.tnts.length}`],
        ['Crates smashed', `${smashed}`],
        ['Bullseyes', `${this.points}`],
        ['Ragdolls left', `${left}`],
      ],
    });
  }

  cameraFor(snap = false) {
    // From behind the slingshot like the cannon, looking out over the fort and
    // the bullseyes; once he's let go, chase him from behind.
    const portrait = this.stage.width < this.stage.height;
    const far = this.def.view ?? 18;
    let look;
    let pos;
    let rate = 3;
    if (this.phase === 'load' || this.phase === 'aim') {
      look = _a.set(far * 0.62, 1.4, 0);
      pos = _b.set(portrait ? -6.5 : -5, portrait ? 5.2 : 4.3, 0);
    } else {
      const c = this.ball.com(_a);
      look = c.set(c.x, Math.max(c.y, 0.8), c.z).addScaledVector(this.dir, 3);
      pos = _b.copy(look).addScaledVector(this.dir, portrait ? -9 : -8).add(new THREE.Vector3(0, portrait ? 3.8 : 3, 0));
      rate = 5;
    }
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, rate, rate + 2);
    this.stage.focusShadows(look, 22);
  }
}
