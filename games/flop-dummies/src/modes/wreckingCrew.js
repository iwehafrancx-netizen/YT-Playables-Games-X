import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER } from '../physics/physics.js';

const BEAM_Y = 8.5;
const ANKLE = { x: 0, y: -0.2, z: 0 }; // bottom of the shin, in its local frame
const SPEED = 9; // trolley top speed, m/s
const ACCEL = 16; // trolley acceleration, m/s²
const DRAG = 0.3; // air drag on the swinging dummy, 1/s
const PUNCH = 0.2; // share of his swing passed on to whatever he hits
const CEILING = BEAM_Y - 2; // he swings up to here, never over the crane
const MIN_CHAIN = 2.5;
const MAX_CHAIN = 7;
const POINTS = { crate: 100, cardboard: 60, metal: 150, barrel: 150, pin: 120, plank: 60 };
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Wrecking Crew: the dummy hangs by his ankles from a gantry crane and he is
 * the wrecking ball. Drag sideways to run the trolley, up and down to winch,
 * and flatten as much of the yard as possible before the shift ends.
 */
export class WreckingCrewLevel extends Level {
  setup() {
    const def = this.def;
    const [x0, x1] = def.span ?? [-10, 10];
    this.span = [x0, x1];
    this.time = 0;
    this.left = def.time ?? 25;
    this.score = 0;
    this.knocked = 0;
    this.phase = 'play';

    this.yard({ fences: true, extent: 40 });
    this.gantry();
    def.build(this.world, this);
    this.total = this.world.props.length;

    // He's hung at the empty end of the crane and lowered into reach.
    const tx = def.start ?? x0;
    this.trolleyX = tx;
    this.trolleyV = 0;
    this.targetX = tx;
    this.chain = MIN_CHAIN;
    this.targetChain = def.chain ?? 5.6;
    this.trolley = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(tx, BEAM_Y - 0.5, 0));
    this.physics.link(this.trolley, this.trolleyMesh);
    // Dropped from just under the trolley, he swings round to hang by his feet.
    this.dummy = this.spawnDummy({ position: [tx + 0.6, BEAM_Y - 2.2, 0], yaw: 0, pose: 'starfish', muscle: 0.45 });
    this.ropes = [this.tie('shinL'), this.tie('shinR')];
    this.makeChain();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'wrecked', icon: 'target', value: `0/${this.total}` },
        { id: 'time', icon: 'clock', value: Math.ceil(this.left) },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Drag left and right to swing him · drag up and down to winch');
    this.cameraFor(true);
  }

  gantry() {
    const w = this.world;
    const [x0, x1] = this.span;
    for (const x of [x0 - 1.4, x1 + 1.4]) {
      for (const z of [-1.2, 1.2]) w.block({ pos: [x, BEAM_Y / 2, z], size: [0.45, BEAM_Y, 0.45], mat: 'steelOrange', tile: 2 });
    }
    w.block({ pos: [(x0 + x1) / 2, BEAM_Y + 0.25, -1.2], size: [x1 - x0 + 3.4, 0.5, 0.4], mat: 'steelOrange', tile: 2, cast: false });
    w.block({ pos: [(x0 + x1) / 2, BEAM_Y + 0.25, 1.2], size: [x1 - x0 + 3.4, 0.5, 0.4], mat: 'steelOrange', tile: 2, cast: false });
    const g = new THREE.Group();
    const cab = w.mesh(new THREE.BoxGeometry(1.2, 0.6, 2.8), 'steelGrey');
    const hook = w.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14), 'darkSteel');
    hook.position.y = -0.4;
    g.add(cab, hook);
    w.add(g);
    this.trolleyMesh = g;
  }

  tie(part) {
    const data = RAPIER.JointData.rope(this.chain, { x: 0, y: -0.5, z: 0 }, ANKLE);
    return this.physics.world.createImpulseJoint(data, this.trolley, this.dummy.parts[part].body, true);
  }

  makeChain() {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    geo.translate(0, 0.5, 0);
    this.chainMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.4, metalness: 0.8 }));
    this.chainMesh.castShadow = true;
    this.world.add(this.chainMesh);
    this.world.disposables.push(geo, this.chainMesh.material);
  }

  ankles(out) {
    out.set(0, 0, 0);
    for (const part of ['shinL', 'shinR']) {
      const b = this.dummy.parts[part].body;
      const t = b.translation();
      const r = b.rotation();
      out.add(_c.set(ANKLE.x, ANKLE.y, ANKLE.z).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(t));
    }
    return out.multiplyScalar(0.5);
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const [x0, x1] = this.span;
    const mid = (x0 + x1) / 2;
    const x = THREE.MathUtils.lerp(mid, this.dummy.com().x, portrait ? 0.7 : 0.35);
    const look = new THREE.Vector3(x, portrait ? 4.4 : 4, 0);
    const pos = new THREE.Vector3(x, portrait ? 6.5 : 5.6, portrait ? 25 : 17);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(look, (x1 - x0) * 0.75);
  }

  onPointerDown(p) {
    if (this.phase !== 'play') return;
    this.drag = { x: this.targetX, chain: this.targetChain };
    this.hud.clearHint();
  }

  onPointerMove(p, start) {
    if (!this.drag || this.phase !== 'play') return;
    const [x0, x1] = this.span;
    const s = Math.min(p.w, p.h);
    this.targetX = THREE.MathUtils.clamp(this.drag.x + ((p.px - start.px) / s) * (x1 - x0) * 0.9, x0, x1);
    this.targetChain = THREE.MathUtils.clamp(this.drag.chain + ((p.py - start.py) / s) * 6, MIN_CHAIN, MAX_CHAIN);
  }

  onPointerUp() {
    this.drag = null;
  }

  onKeyDown(code) {
    if (this.phase !== 'play') return;
    const [x0, x1] = this.span;
    if (code === 'ArrowLeft') this.targetX = Math.max(x0, this.targetX - 2.5);
    if (code === 'ArrowRight') this.targetX = Math.min(x1, this.targetX + 2.5);
    if (code === 'ArrowUp') this.targetChain = Math.max(MIN_CHAIN, this.targetChain - 0.8);
    if (code === 'ArrowDown') this.targetChain = Math.min(MAX_CHAIN, this.targetChain + 0.8);
  }

  fixedUpdate(dt) {
    // Ease the trolley towards the target so the swing builds rather than snaps.
    const gap = this.targetX - this.trolleyX;
    const want = THREE.MathUtils.clamp(gap * 3, -SPEED, SPEED);
    this.trolleyV += THREE.MathUtils.clamp(want - this.trolleyV, -ACCEL * dt, ACCEL * dt);
    this.trolleyX = THREE.MathUtils.clamp(this.trolleyX + this.trolleyV * dt, this.span[0], this.span[1]);
    this.trolley.setNextKinematicTranslation({ x: this.trolleyX, y: BEAM_Y - 0.5, z: 0 });
    // Rope joints can't change length, so winching re-ties both ropes.
    const dc = this.targetChain - this.chain;
    if (Math.abs(dc) > 0.05) {
      this.chain += THREE.MathUtils.clamp(dc, -4 * dt, 4 * dt);
      for (const j of this.ropes) this.physics.world.removeImpulseJoint(j, true);
      this.ropes = [this.tie('shinL'), this.tie('shinR')];
    }
    // Keep the swing in the plane of the yard.
    const R = this.dummy.ragdoll;
    const com = R.centerOfMass(_a);
    const v = R.velocity(_b);
    const over = com.y > CEILING && v.y > 0 ? v.y * 0.25 : 0;
    R.addVelocity({ x: -v.x * DRAG * dt, y: -v.y * DRAG * dt - over, z: -v.z * 0.08 - com.z * 1.5 * dt });
  }

  onImpact(a, b, force, strength) {
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    const other = dummy === a ? b : a;
    if (!dummy || !other.prop) return;
    // A 70 kg body on a chain hits like a wrecking ball, not like a pillow:
    // pass on a share of his swing so stacks actually go over.
    const v = this.dummy.parts[dummy.part].body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed < 2) return;
    const body = other.prop.body;
    const k = Math.min(1, speed / 10) * PUNCH * body.mass();
    body.applyImpulse({ x: v.x * k, y: Math.max(0, v.y) * k + speed * k * 0.15, z: v.z * k * 0.3 }, true);
    if (strength > 0.25) {
      this.rig.shake(Math.min(0.35, strength * 0.4));
      this.audio.impact(strength, other.material ?? 'wood');
    }
  }

  checkProps() {
    for (const p of this.world.props) {
      if (p.knocked) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y, t.z - p.start.z) > 0.6 || 1 - Math.abs(r.w) > 0.12) {
        p.knocked = true;
        this.knocked++;
        const pts = POINTS[p.kind] ?? 80;
        this.score += pts;
        this.fx.text(new THREE.Vector3(t.x, t.y + 0.6, t.z), `+${pts}`, { size: 16, life: 0.7 });
      }
    }
    this.hud.set('wrecked', `${this.knocked}/${this.total}`);
    this.hud.set('score', this.score.toLocaleString());
  }

  tick(dt) {
    this.cameraFor();
    const top = _a.set(this.trolleyX, BEAM_Y - 1, 0);
    const end = this.ankles(_b);
    const len = end.distanceTo(top);
    this.chainMesh.position.copy(top);
    this.chainMesh.quaternion.setFromUnitVectors(UP, end.sub(top).divideScalar(len || 1));
    this.chainMesh.scale.set(1, len, 1);
    this.audio.loop('rumble', Math.min(1, Math.abs(this.trolleyV) / SPEED), 'rumble');
    this.audio.loop('wind', Math.min(1, this.dummy.speed() / 12), 'wind');
    if (this.time % 0.2 < dt) this.checkProps();

    if (this.phase === 'play') {
      this.left -= dt;
      this.hud.set('time', Math.max(0, Math.ceil(this.left)));
      if (this.left <= 0 || this.knocked >= this.total) this.wrapUp();
    } else if (this.phase === 'whistle') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  wrapUp() {
    this.phase = 'whistle';
    this.endT = 1.6;
    this.checkProps();
    this.audio.loop('rumble', 0, 'rumble');
    const all = this.knocked >= this.total;
    if (all) {
      this.score += Math.round(Math.max(0, this.left) * 100);
      this.fx.confetti(this.dummy.com().add(UP), 140);
      this.audio.win();
    }
    this.game.ui.banner(all ? 'FLATTENED IT ALL!' : 'TIME!', `${this.knocked}/${this.total} wrecked`);
  }

  /** Ten more seconds on the clock. */
  revive() {
    this.left = 10;
    this.phase = 'play';
    this.hud.set('time', 10);
  }

  complete() {
    this.phase = 'done';
    this.audio.loop('wind', 0, 'wind');
    const frac = this.knocked / Math.max(1, this.total);
    const [a, b, c] = this.def.stars ?? [0.5, 0.75, 0.95];
    const stars = frac >= c ? 3 : frac >= b ? 2 : frac >= a ? 1 : 0;
    this.finish({
      passed: stars > 0,
      stars,
      score: this.score,
      reason: `Wreck at least ${Math.round(a * 100)}% of the yard.`,
      stats: [
        ['Wrecked', `${this.knocked}/${this.total}`],
        ['Time left', `${Math.max(0, Math.ceil(this.left))}s`],
      ],
    });
  }
}
