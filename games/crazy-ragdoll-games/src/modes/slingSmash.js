import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';
import { tntCrate } from '../render/textures.js';

const REST = new THREE.Vector3(0, 2.3, 0); // pouch at rest, between the fork tips
const TIPS = [new THREE.Vector3(-0.32, 2.55, 0.12), new THREE.Vector3(0.32, 2.55, -0.12)];
const CHEST = { x: 0, y: 0.17, z: 0 };
const MAX_PULL = 2.3; // m
const POWER = 9.5; // launch speed per metre of pull
const MIN_PULL = 0.45;
const BLAST_R = 3.4;
const DOTS = 16;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Sling Smash: pull the ragdoll back in a giant slingshot, let go, and send
 * him into crate forts across the yard. Every TNT crate has to go up before
 * the ragdolls run out; knocking the rest of the fort over is a bonus.
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
    this.bonus = 0;

    this.scenery({ run: { axis: 'x', to: 40 } });
    this.slingshot();
    for (const p of def.fort) this.piece(p);
    this.fortCount = this.world.props.length - this.tnts.length;
    this.dots = this.trail();
    this.load();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'shots', icon: 'dummy', value: this.shots },
        { id: 'tnt', icon: 'bolt', value: `0/${this.tnts.length}` },
      ],
    });
    this.hud.hint(def.hint ?? 'Drag back to aim · let go to fire · blow up every TNT crate');
    this.cameraFor(true);
  }

  // ---------- set ----------

  slingshot() {
    const w = this.world;
    const g = new THREE.Group();
    const trunk = w.mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.7, 12), 'crate');
    trunk.position.y = 0.85;
    g.add(trunk);
    for (const tip of TIPS) {
      const from = new THREE.Vector3(0, 1.6, 0);
      const len = from.distanceTo(tip);
      const arm = w.mesh(new THREE.CylinderGeometry(0.1, 0.13, len, 10), 'crate');
      arm.position.copy(from).add(tip).multiplyScalar(0.5);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _a.copy(tip).sub(from).normalize());
      g.add(arm);
    }
    w.add(g);
    this.pouch = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(REST.x, REST.y, REST.z));
    this.pouchMesh = w.mesh(new THREE.BoxGeometry(0.34, 0.12, 0.42), 'toyDark');
    w.add(this.pouchMesh);
    this.physics.link(this.pouch, this.pouchMesh);
    const band = new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0);
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
      const prop = w.crate({ pos: [p.x, y + 0.4, 0], size: 0.8, mass: 25 });
      prop.mesh.material = tntMaterial();
      this.tnts.push({ prop, alive: true, v: 0 });
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
    d.lively = 0.5;
    this.rope = this.physics.world.createImpulseJoint(RAPIER.JointData.rope(0.08, { x: 0, y: 0, z: 0 }, CHEST), this.pouch, d.parts.chest.body, true);
    this.ball = d;
    this.pull.set(0, 0, 0);
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
    // A drag across a third of the shorter screen side is a full pull.
    const k = MAX_PULL / (Math.min(p.w, p.h) * 0.33);
    this.pull.set((p.px - start.px) * k, -(p.py - start.py) * k, 0);
    if (this.pull.length() > MAX_PULL) this.pull.setLength(MAX_PULL);
  }

  onPointerUp() {
    if (!this.aiming) return;
    this.aiming = false;
    this.fire();
  }

  onKeyDown(code) {
    if (this.phase !== 'aim') return;
    // Keyboard aiming: arrows nudge the pull, Space fires.
    const step = 0.15;
    if (code === 'ArrowLeft') this.pull.x -= step;
    if (code === 'ArrowRight') this.pull.x += step;
    if (code === 'ArrowUp') this.pull.y += step;
    if (code === 'ArrowDown') this.pull.y -= step;
    if (this.pull.length() > MAX_PULL) this.pull.setLength(MAX_PULL);
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
    d.ragdoll.setVelocity({ x: v.x, y: v.y, z: 0 });
    d.ragdoll.addSpin(_b.set(0, 0, -v.length() * 0.25));
    d.setPose('starfish');
    d.setMuscle(0.5);
    d.lively = 1;
    this.shot++;
    this.hud.set('shots', this.shots - this.shot);
    this.phase = 'flying';
    this.flyT = 0;
    this.restT = 0;
    this.pull.set(0, 0, 0);
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
    this.pouch.setNextKinematicTranslation({ x: t.x + (target.x - t.x) * k, y: t.y + (target.y - t.y) * k, z: 0 });

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
    if (this.phase === 'flying') {
      const c = this.ball.com(_a);
      this.ball.ragdoll.addVelocity({ x: 0, y: 0, z: -c.z * 2 * dt });
    }
  }

  /** He landed on it hard: that sets it off even if the crate couldn't move. */
  onImpact(a, b, force, strength) {
    const tnt = a.kind === 'dummy' ? b.prop : b.kind === 'dummy' ? a.prop : null;
    if (!tnt || strength < 0.2) return;
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
    for (const prop of this.world.props) {
      const t = prop.body.translation();
      _b.set(t.x - at.x, t.y - at.y, t.z - at.z);
      const d = _b.length();
      if (d > BLAST_R) continue;
      const m = prop.body.mass();
      const f = (1 - d / BLAST_R) * 9 * m;
      _b.normalize();
      prop.body.applyImpulse({ x: _b.x * f, y: (_b.y + 0.6) * f, z: _b.z * f * 0.3 }, true);
    }
    for (const dmy of this.dummies) {
      const c = dmy.com(_b);
      const d = c.distanceTo(at);
      if (d > BLAST_R) continue;
      const s = (1 - d / BLAST_R) * 11;
      _b.sub(at).normalize();
      dmy.ragdoll.addVelocity({ x: _b.x * s, y: (_b.y + 0.7) * s, z: 0 });
    }
    this.fx.puff(at, { count: 22, size: 1.6, speed: 4, color: 0xffb347, up: 1.4, life: 0.8 });
    this.fx.puff(at, { count: 14, size: 2, speed: 2, color: 0x6b6b6b, up: 2, life: 1.6 });
    this.fx.chips(at, { count: 30, colors: [0xd23a2c, 0xffd23a, 0x8a5a33], size: 0.09, speed: 8, life: 1.2 });
    this.fx.text(at.clone().add(_b.set(0, 1.2, 0)), 'BOOM!', { color: '#ffb347', size: 40, life: 1.2 });
    this.audio.boom();
    this.rig.shake(0.8);
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
      dot.position.set(c.x + v.x * t, c.y + v.y * t + 0.5 * this.gravity * t * t, 0);
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
      score: this.blown * 500 + smashed * 50 + (this.passed ? left * 400 : 0),
      reason: 'Blow up every TNT crate before you run out of ragdolls.',
      stats: [
        ['TNT', `${this.blown}/${this.tnts.length}`],
        ['Crates smashed', `${smashed}`],
        ['Ragdolls left', `${left}`],
      ],
    });
  }

  cameraFor(snap = false) {
    // Over the slingshot's shoulder while aiming, looking out at the fort;
    // then chase him through the air and stay on whatever he hit.
    const portrait = this.stage.width < this.stage.height;
    const far = this.def.view ?? 18;
    let look;
    let pos;
    let rate = 3;
    if (this.phase === 'load' || this.phase === 'aim') {
      if (portrait) ({ pos, look } = this.frameBox(_a.set(-1, 0.4, -0.3), _b.set(far + 0.5, 3.2, 0.3), { yaw: -34, pitch: 13, margin: 1 }));
      else {
        look = _a.set(far * 0.5, 1.8, 0);
        pos = _b.set(far * 0.25, 5.5, 13);
      }
    } else {
      const c = this.ball.com(_a);
      look = c.set(Math.max(c.x, 1), Math.max(c.y, 0.8), 0);
      pos = _b.copy(look).add(portrait ? new THREE.Vector3(-4, 3, 9) : new THREE.Vector3(-3, 2.5, 9));
      rate = 6;
    }
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, rate, rate + 2);
    this.stage.focusShadows(look, 20);
  }
}

let tntMat = null;
function tntMaterial() {
  tntMat ??= new THREE.MeshStandardMaterial({ map: tntCrate(), roughness: 0.6 });
  return tntMat;
}
