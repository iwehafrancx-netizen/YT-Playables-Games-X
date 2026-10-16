import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';
import { landingTarget } from '../render/textures.js';

const HUB_Y = 3.1;
const ARM = 1.1;
const ANKLE = { x: 0, y: -0.2, z: 0 };
const IDLE_SPIN = 2.2; // rad/s
const SPIN_UP = 2.2; // rad/s²
const REACH = 2; // effective throwing radius, m
const SETTLE = 0.45;
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Hammer Spin: the ragdoll is the hammer. Hold to whirl him round by the
 * ankles, faster and faster; let go at the right moment and he sails off
 * towards the targets. Timing is aim, spin is distance.
 */
export class HammerSpinLevel extends Level {
  setup() {
    const def = this.def;
    this.throws = def.throws ?? 3;
    this.thrown = 0;
    this.total = 0;
    // Flat out, he lands on the farthest target; anything nearer means letting go early.
    const far = Math.max(...def.targets.map((t) => Math.hypot(t.pos[0], t.pos[1])));
    this.maxSpin = this.spinFor(far + 0.5);
    this.angle = 0;
    this.spin = IDLE_SPIN;
    this.holding = false;
    this.phase = 'ready';
    this.targets = [];

    this.studio();
    this.circle();
    for (const t of def.targets) this.target(t);
    def.build?.(this.world, this);
    this.propCount = this.world.props.length;
    this.loadHammer();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'throws', icon: 'dummy', value: `${this.throws}` },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Hold to spin faster · let go when the red ring is on a target');
    this.cameraFor(true);
  }

  circle() {
    const w = this.world;
    const ring = w.mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 48), 'toyDark', { cast: false });
    ring.position.y = 0.03;
    const inner = w.mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.07, 48), 'white', { cast: false });
    inner.position.y = 0.035;
    const post = w.mesh(new THREE.CylinderGeometry(0.18, 0.24, HUB_Y, 16), 'toyDark');
    post.position.y = HUB_Y / 2;
    w.add(ring, inner, post);

    const g = new THREE.Group();
    const cap = w.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 20), 'toyRed');
    const boom = w.mesh(new THREE.BoxGeometry(ARM + 0.3, 0.14, 0.14), 'toyRed');
    boom.position.x = ARM / 2;
    const tip = w.mesh(new THREE.SphereGeometry(0.12, 12, 10), 'toyYellow');
    tip.position.x = ARM;
    g.add(cap, boom, tip);
    w.add(g);
    this.hub = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, HUB_Y, 0));
    this.physics.link(this.hub, g);

    // Where he'd come down if you let go right now.
    const reticleGeo = new THREE.RingGeometry(0.45, 0.7, 32).rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: 0xef4b3c, transparent: true, opacity: 0, depthWrite: false }));
    this.reticle.renderOrder = 2;
    w.disposables.push(reticleGeo, this.reticle.material);
    w.add(this.reticle);
  }

  target({ pos, radius = 2.4, points = [100, 250, 500] }) {
    const mat = new THREE.MeshStandardMaterial({ map: landingTarget(points), roughness: 0.8, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos[0], 0.015, pos[1]);
    m.receiveShadow = true;
    this.world.add(m);
    this.world.disposables.push(m.geometry, mat, mat.map);
    this.targets.push({ x: pos[0], z: pos[1], radius, points });
  }

  loadHammer() {
    const tip = this.tipPosition(_a);
    // Hung upside down from the boom tip by both ankles.
    this.hammer = this.spawnDummy({ position: [tip.x, tip.y - 0.1, tip.z], yaw: this.angle, pose: 'starfish', muscle: 0.75 });
    const R = this.hammer.ragdoll;
    // Spawned standing with his soles at the tip, then turned over about it.
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    const pivot = _b.copy(tip);
    R.forEachBody((body) => {
      const t = body.translation();
      const p = new THREE.Vector3(t.x, t.y, t.z).sub(pivot).applyQuaternion(flip).add(pivot);
      body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      const r = body.rotation();
      const q = flip.clone().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w));
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    });
    this.ropes = ['shinL', 'shinR'].map((part) =>
      this.physics.world.createImpulseJoint(RAPIER.JointData.rope(0.25, { x: ARM, y: 0, z: 0 }, ANKLE), this.hub, this.hammer.parts[part].body, true),
    );
    this.phase = 'ready';
    this.spin = IDLE_SPIN;
    this.physics.snapAll();
  }

  tipPosition(out) {
    return out.set(Math.cos(this.angle) * ARM, HUB_Y, -Math.sin(this.angle) * ARM);
  }

  onPointerDown() {
    if (this.phase === 'ready') {
      this.holding = true;
      this.hud.clearHint();
    }
  }

  onPointerUp() {
    if (this.holding) this.release();
    this.holding = false;
  }

  onKeyDown(code) {
    if ((code === 'Space' || code === 'Enter') && this.phase === 'ready') {
      this.holding = true;
      this.hud.clearHint();
    }
  }

  onKeyUp(code) {
    if ((code === 'Space' || code === 'Enter') && this.holding) {
      this.holding = false;
      this.release();
    }
  }

  /** The steady spin whose throw comes down `dist` metres from the post. */
  spinFor(dist) {
    let lo = IDLE_SPIN;
    let hi = 14;
    for (let i = 0; i < 30; i++) {
      const w = (lo + hi) / 2;
      if (this.rangeAt(w) < dist) lo = w;
      else hi = w;
    }
    return lo;
  }

  rangeAt(w) {
    const g = -this.gravity;
    const vy = 2.6 + w * 0.25;
    const t = (vy + Math.sqrt(vy * vy + 2 * g * 1.9)) / g;
    const throwR = ARM + 1.1;
    return Math.hypot(throwR, w * REACH * t);
  }

  /** Release kick: a little lift so every throw arcs. */
  lift() {
    return 2.6 + this.spin * 0.25;
  }

  /**
   * Launch velocity for a release right now: along the boom's direction of
   * travel at the speed of its swing. Taking it from the boom rather than the
   * flailing body keeps throws (and the reticle) honest.
   */
  launch(out) {
    const speed = this.spin * REACH;
    return out.set(-Math.sin(this.angle) * speed, this.lift(), -Math.cos(this.angle) * speed);
  }

  /** Ballistic landing point for a release right now (ignores the slide after). */
  predict(out) {
    const c = this.hammer.com(_a);
    const v = this.launch(_b);
    const vy = v.y;
    const g = -this.gravity;
    const t = (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0.1, c.y - 0.3))) / g;
    return out.set(c.x + v.x * t, 0.06, c.z + v.z * t);
  }

  release() {
    if (this.phase !== 'ready') return;
    // Too slow to be worth throwing: just keep spinning.
    if (this.spin < IDLE_SPIN + 0.8) return;
    for (const j of this.ropes) this.physics.world.removeImpulseJoint(j, true);
    this.ropes = [];
    const d = this.hammer;
    const v = this.launch(_b);
    d.ragdoll.setVelocity({ x: v.x, y: v.y, z: v.z });
    d.ragdoll.addSpin(new THREE.Vector3(0, this.spin * 0.4, 0));
    d.setMuscle(0.4);
    this.phase = 'flying';
    this.landed = false;
    this.flyT = 0;
    this.restT = 0;
    this.thrown++;
    this.hud.set('throws', `${this.throws - this.thrown}`);
    this.audio.whoosh(1.4);
    this.rig.kick(4);
  }

  fixedUpdate(dt) {
    if (this.phase === 'ready') {
      if (this.holding) this.spin = Math.min(this.maxSpin, this.spin + SPIN_UP * dt);
      else this.spin = Math.max(IDLE_SPIN, this.spin - SPIN_UP * 0.5 * dt);
    } else {
      this.spin = Math.max(0.6, this.spin - 2 * dt);
    }
    this.angle += this.spin * dt;
    _q.setFromAxisAngle(UP, this.angle);
    this.hub.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
  }

  onImpact(a, b) {
    if (this.phase !== 'flying' || this.landed) return;
    const ground = a.kind === 'ground' || b.kind === 'ground';
    const me = this.dummyFor(a.kind === 'dummy' ? a : b);
    if (!ground || me !== this.hammer) return;
    // He sticks the landing (more or less) instead of skating off the target.
    this.landed = true;
    this.hammer.ragdoll.forEachBody((body) => {
      body.setLinearDamping(1.6);
      body.setAngularDamping(2);
    });
    this.rig.shake(0.25);
  }

  scoreLanding() {
    const p = this.hammer.partPosition('pelvis', _a);
    let pts = 0;
    let label = 'MISS';
    for (const t of this.targets) {
      const d = Math.hypot(p.x - t.x, p.z - t.z);
      if (d > t.radius) continue;
      const ring = d < t.radius / 3 ? 2 : d < (t.radius * 2) / 3 ? 1 : 0;
      if (t.points[ring] > pts) {
        pts = t.points[ring];
        label = ring === 2 ? 'BULLSEYE!' : `+${pts}`;
      }
    }
    const knocked = this.countKnocked();
    pts += knocked * 50;
    this.total += pts;
    this.hud.set('score', this.total.toLocaleString());
    this.hud.bump('score');
    this.fx.text(p.clone().add(UP), pts ? label : 'MISS', { color: pts ? '#ffd23a' : '#ff7a6b', size: 34, life: 1.4 });
    if (pts >= 250) {
      this.audio.ding(3);
      this.fx.confetti(p.clone(), 60);
    }
  }

  countKnocked() {
    let n = 0;
    for (const p of this.world.props) {
      if (p.knocked) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y, t.z - p.start.z) > 0.5 || 1 - Math.abs(r.w) > 0.1) {
        p.knocked = true;
        n++;
      }
    }
    return n;
  }

  tick(dt) {
    this.cameraFor();
    this.audio.loop('wind', this.phase === 'ready' ? Math.min(1, (this.spin - IDLE_SPIN) / (this.maxSpin - IDLE_SPIN)) : 0, 'wind');
    if (this.phase === 'ready') {
      const k = (this.spin - IDLE_SPIN) / (this.maxSpin - IDLE_SPIN);
      this.hud.meter('Spin', k, k > 0.92);
      this.predict(this.reticle.position);
      this.reticle.scale.setScalar(1 + Math.sin(this.time * 10) * 0.08);
      this.reticle.material.opacity = this.holding ? 0.85 : 0.35;
    } else {
      this.reticle.material.opacity = 0;
      this.hud.hideMeter();
    }

    if (this.phase === 'flying') {
      this.flyT += dt;
      this.restT = this.hammer.speed() < SETTLE ? this.restT + dt : 0;
      if (this.restT > 0.6 || this.flyT > 7) {
        this.scoreLanding();
        this.phase = 'between';
        this.nextT = 1.3;
      }
    } else if (this.phase === 'between') {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (this.thrown >= this.throws) this.complete();
        else {
          this.removeDummy(this.hammer);
          this.loadHammer();
          this.cameraFor(true);
        }
      }
    }
  }

  /** One more throw. */
  revive() {
    this.throws++;
    this.hud.set('throws', `${this.throws - this.thrown}`);
    this.removeDummy(this.hammer);
    this.loadHammer();
    this.cameraFor(true);
  }

  complete() {
    this.phase = 'done';
    const [a, b, c] = this.def.stars;
    const stars = this.total >= c ? 3 : this.total >= b ? 2 : this.total >= a ? 1 : 0;
    this.finish({
      passed: stars > 0,
      stars,
      score: this.total,
      reason: `Score at least ${a} points across your throws.`,
      stats: [
        ['Throws', `${this.thrown}`],
        ['Points', this.total.toLocaleString()],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    let look;
    let pos;
    if (this.phase === 'flying' || this.phase === 'between') {
      const c = this.hammer.com(_a);
      look = new THREE.Vector3(c.x * 0.8, 1, c.z * 0.8 + 2);
      pos = look.clone().add(new THREE.Vector3(0, portrait ? 12 : 8, portrait ? -13 : -10));
    } else {
      const far = this.def.view ?? 9;
      look = new THREE.Vector3(0, 1.2, far * 0.55);
      pos = new THREE.Vector3(0, portrait ? 10 : 6.5, portrait ? -11 : -8);
    }
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(look, 18);
  }
}
