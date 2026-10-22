import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';
import { landingTarget } from '../render/textures.js';

const CHEST = { x: 0, y: 0.17, z: 0 };
const PUMP = 5; // m/s² of push along the swing while held
const MAX_SPEED = 13;
const IDLE = 0.6; // the swing never quite dies out on its own
const DOTS = 18;
const ROOF = 2.6;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Crane Swing: he dangles from a dock crane's rope. Hold to pump the swing
 * higher; let go and he flies. Land him on the pad on top of the containers,
 * grabbing stars on the way, before the tries run out.
 */
export class CraneSwingLevel extends Level {
  setup() {
    const def = this.def;
    this.pivot = new THREE.Vector3(0, def.height ?? 9, 0);
    this.ropeLen = def.rope ?? 5;
    this.tries = def.tries ?? 3;
    this.tried = 0;
    this.got = 0;
    this.best = 0;
    this.holding = false;
    this.pickups = [];

    this.scenery({ run: { axis: 'x', to: 30 } });
    this.crane();
    for (const s of def.stacks ?? []) this.stack(s);
    this.padAt = this.pad(def.pad);
    for (const p of def.stars ?? []) this.pickup(p);
    this.clutter((def.crates ?? []).map((x) => [x, 0]));
    this.dots = this.trail();
    this.hook();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'tries', icon: 'dummy', value: this.tries },
        { id: 'stars', icon: 'star', value: `0/${this.pickups.length}` },
      ],
    });
    this.hud.hint(def.hint ?? 'Hold to swing higher · let go to fly · land on the pad');
    this.cameraFor(true);
  }

  // ---------- set ----------

  crane() {
    const w = this.world;
    const p = this.pivot;
    const H = p.y + 1;
    const mast = w.mesh(new THREE.BoxGeometry(0.6, H, 0.6), 'toyYellow');
    mast.position.set(-3, H / 2, -1.2);
    const boom = w.mesh(new THREE.BoxGeometry(5, 0.45, 0.5), 'toyYellow');
    boom.position.set(-0.8, p.y + 0.4, -1.2);
    const arm = w.mesh(new THREE.BoxGeometry(0.3, 0.3, 1.4), 'toyYellow');
    arm.position.set(p.x, p.y + 0.4, -0.5);
    const block = w.mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), 'darkSteel');
    block.position.copy(p);
    w.add(mast, boom, arm, block);
    this.anchor = this.physics.createBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z));
    const cable = new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, -0.5, 0);
    this.world.disposables.push(cable);
    this.cable = w.mesh(cable, 'darkSteel', { cast: false });
    this.cable.position.copy(p);
    w.add(this.cable);
  }

  /** A stack of containers, `high` boxes tall, centred on x. */
  stack({ x, high = 1, color }) {
    const colors = ['steelBlue', 'steelRed', 'steelGreen', 'steelOrange'];
    for (let i = 0; i < high; i++) this.world.container({ pos: [x, i * ROOF, 0], yaw: 90, color: color ?? colors[(i + Math.round(x)) % colors.length] });
  }

  pad({ x, high = 0, r = 2 }) {
    const y = high * ROOF;
    const points = [150, 300, 600];
    const mat = new THREE.MeshStandardMaterial({ map: landingTarget(points), roughness: 0.8, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.02, 0);
    m.receiveShadow = true;
    this.world.add(m);
    this.world.disposables.push(m.geometry, mat, mat.map);
    if (high) this.stack({ x, high, color: 'steelGreen' });
    return { x, y, r, points };
  }

  pickup({ x, y }) {
    const m = this.world.mesh(new THREE.OctahedronGeometry(0.4), 'gold', { cast: false });
    m.position.set(x, y, 0);
    this.world.add(m);
    this.pickups.push({ x, y, m, got: false });
  }

  trail() {
    const geo = new THREE.SphereGeometry(0.07, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.world.disposables.push(geo, mat);
    return Array.from({ length: DOTS }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.world.add(m);
      return m;
    });
  }

  /** Hangs a fresh ragdoll on the hook, pulled back so he's already swinging. */
  hook() {
    const p = this.pivot;
    const a = -0.9;
    const chest = _a.set(p.x + Math.sin(a) * (this.ropeLen + 0.2), p.y - Math.cos(a) * (this.ropeLen + 0.2), 0);
    const d = this.spawnDummy({ position: [chest.x, chest.y - 1.41, 0], yaw: Math.PI / 2, pose: 'hang', muscle: 0.6 });
    this.rope = this.physics.world.createImpulseJoint(RAPIER.JointData.rope(this.ropeLen, { x: 0, y: 0, z: 0 }, CHEST), this.anchor, d.parts.chest.body, true);
    this.dummy = d;
    this.phase = 'swing';
    for (const q of this.pickups) {
      q.got = false;
      q.m.visible = true;
    }
    this.gotNow = 0;
    this.physics.snapAll();
  }

  // ---------- input ----------

  onPointerDown() {
    this.press();
  }

  onPointerUp() {
    this.letGo();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter') this.press();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter') this.letGo();
  }

  press() {
    if (this.phase !== 'swing') return;
    this.holding = true;
    this.hud.clearHint();
  }

  letGo() {
    if (!this.holding) return;
    this.holding = false;
    if (this.phase !== 'swing') return;
    this.physics.world.removeImpulseJoint(this.rope, true);
    this.cable.scale.y = 0.6;
    this.dummy.setPose('starfish');
    this.dummy.setMuscle(0.5);
    this.phase = 'flying';
    this.flyT = 0;
    this.restT = 0;
    this.tried++;
    this.hud.set('tries', this.tries - this.tried);
    this.audio.whoosh(1.2);
    for (const dot of this.dots) dot.visible = false;
  }

  // ---------- play ----------

  /** Unit vector along the swing, in the direction he's moving. */
  tangent(out) {
    const c = this.dummy.parts.chest.body.translation();
    const dx = c.x - this.pivot.x;
    const dy = c.y - this.pivot.y;
    const len = Math.hypot(dx, dy) || 1;
    out.set(-dy / len, dx / len, 0);
    const v = this.dummy.velocity(_b);
    if (v.x * out.x + v.y * out.y < 0) out.negate();
    return out;
  }

  fixedUpdate(dt) {
    const d = this.dummy;
    const c = d.com(_a);
    d.ragdoll.addVelocity({ x: 0, y: 0, z: -c.z * 2 * dt });
    if (this.phase === 'swing') {
      const v = d.velocity(_b);
      const speed = Math.hypot(v.x, v.y);
      const push = this.holding ? PUMP : speed < 3 ? IDLE : 0;
      if (push && speed < MAX_SPEED) {
        const t = this.tangent(_a);
        d.ragdoll.addVelocity({ x: t.x * push * dt, y: t.y * push * dt, z: 0 });
      }
    }
    if (this.phase === 'flying') {
      for (const p of this.pickups) {
        if (p.got || Math.hypot(c.x - p.x, c.y - p.y) > 1) continue;
        p.got = true;
        p.m.visible = false;
        this.gotNow++;
        this.audio.coin(this.gotNow);
        this.fx.chips(p.m.position, { count: 12, colors: [0xffd23a, 0xffffff], size: 0.06, speed: 3, life: 0.7 });
      }
    }
  }

  tick(dt) {
    this.cameraFor();
    for (const p of this.pickups) p.m.rotation.y += dt * 3;
    if (this.phase === 'swing') {
      const c = this.dummy.parts.chest.body.translation();
      _a.set(c.x - this.pivot.x, c.y - this.pivot.y, c.z - this.pivot.z);
      this.cable.scale.y = _a.length();
      this.cable.quaternion.setFromUnitVectors(_b.set(0, -1, 0), _a.normalize());
      this.drawTrail();
      this.audio.loop('wind', this.holding ? 0.5 : 0, 'wind');
    } else {
      this.cable.quaternion.identity();
      this.audio.loop('wind', 0, 'wind');
    }
    if (this.phase === 'flying') {
      this.flyT += dt;
      this.restT = this.dummy.speed() < 0.5 ? this.restT + dt : 0;
      if (this.restT > 0.7 || this.flyT > 7) this.land();
    } else if (this.phase === 'between') {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (this.tried >= this.tries) this.complete();
        else {
          this.removeDummy(this.dummy);
          this.hook();
          this.cameraFor(true);
        }
      }
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  drawTrail() {
    const c = this.dummy.com(_a);
    const v = this.dummy.velocity(_b);
    this.dots.forEach((dot, i) => {
      const t = (i + 1) * 0.1;
      dot.position.set(c.x + v.x * t, c.y + v.y * t + 0.5 * this.gravity * t * t, 0);
      dot.visible = this.holding && dot.position.y > 0;
      dot.scale.setScalar(1 - i / (DOTS * 1.4));
    });
  }

  land() {
    const p = this.dummy.partPosition('pelvis', _a);
    const pad = this.padAt;
    const d = Math.abs(p.x - pad.x);
    const onPad = d < pad.r && p.y > pad.y - 0.2 && p.y < pad.y + 1.5;
    this.got = Math.max(this.got, this.gotNow);
    this.hud.set('stars', `${this.got}/${this.pickups.length}`);
    if (onPad) {
      const ring = d < pad.r / 3 ? 2 : d < (pad.r * 2) / 3 ? 1 : 0;
      this.best = pad.points[ring];
      this.phase = 'end';
      this.passed = true;
      this.endT = 1.8;
      this.audio.win();
      this.fx.confetti(new THREE.Vector3(pad.x, pad.y + 1.5, 0), 140);
      this.game.ui.banner(ring === 2 ? 'BULLSEYE!' : 'TOUCHDOWN!', `+${this.best}`);
    } else {
      this.fx.text(p.clone().add(_b.set(0, 1.4, 0)), 'MISSED!', { color: '#ff7a6b', size: 30 });
      this.audio.lose();
      this.phase = 'between';
      this.nextT = 1.1;
    }
  }

  /** One more go on the rope. */
  revive() {
    this.tries++;
    this.hud.set('tries', this.tries - this.tried);
    this.removeDummy(this.dummy);
    this.hook();
    this.cameraFor(true);
  }

  complete() {
    this.phase = 'done';
    const all = this.pickups.length;
    const left = this.tries - this.tried;
    const stars = !this.passed ? 0 : this.best >= 600 || (left >= 1 && this.got === all) ? 3 : this.best >= 300 || left >= 1 ? 2 : 1;
    this.finish({
      passed: this.passed,
      stars,
      score: (this.passed ? 800 + this.best + left * 300 : 0) + this.got * 150,
      reason: 'Let go at the right moment and land on the pad.',
      stats: [
        ['Landing', this.passed ? `+${this.best}` : 'missed'],
        ['Stars', `${this.got}/${all}`],
        ['Tries used', `${this.tried}`],
      ],
    });
  }

  cameraFor(snap = false) {
    // Crane and pad both in shot, seen from in front and a little behind the
    // crane, so the swing plays out across the screen and away from you.
    const portrait = this.stage.width < this.stage.height;
    const pad = this.padAt;
    const x0 = this.pivot.x - this.ropeLen - 1.5;
    const x1 = pad.x + pad.r + 1.5;
    const { pos, look } = this.frameBox(_a.set(x0, 0, -1.5), _b.set(x1, this.pivot.y + 1.5, 1.5), { yaw: portrait ? -60 : -12, pitch: portrait ? 24 : 10, margin: portrait ? 0.95 : 0.88 });
    if (this.phase !== 'swing') {
      const mid = (x0 + x1) / 2;
      const shift = THREE.MathUtils.clamp(this.dummy.com(_a).x, mid - 3, mid + 6) - mid;
      pos.x += shift;
      look.x += shift;
    }
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(look, 20);
  }
}
