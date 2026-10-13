import * as THREE from 'three';
import { Level } from './level.js';

const LANE_TOP = 0.25;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Pin Alley: the dummy is the bowling ball. Swipe to aim and set the power,
 * knock the pins down in as few throws as possible.
 */
export class PinAlleyLevel extends Level {
  setup() {
    const def = this.def;
    this.yard({ fences: true, extent: 45 });
    this.length = def.length ?? 18;
    this.width = def.width ?? 3;
    this.buildLane();
    def.build?.(this.world, this);

    this.pins = def.pins.map(([x, z, y = LANE_TOP]) => this.world.pin({ pos: [x, y, z], h: def.pinHeight ?? 1.1 }));
    this.total = this.pins.length;
    this.down = 0;
    this.throws = def.throws ?? 2;
    this.thrown = 0;
    this.score = 0;
    this.aimYaw = 0;
    this.power = 0;
    this.makeArrow();
    this.newBowler();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'pins', icon: 'target', value: `0/${this.total}` },
        { id: 'throws', icon: 'dummy', value: this.throws },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Swipe up to bowl · steer left or right with your swipe');
  }

  buildLane() {
    const w = this.world;
    const L = this.length;
    const W = this.width;
    const deckEnd = L + 3.4;
    // Approach + lane + pin deck as one polished surface.
    w.block({ pos: [0, LANE_TOP / 2, (deckEnd - 4) / 2], size: [W, LANE_TOP, deckEnd + 4], mat: 'lane', tile: 0, friction: 0.04, slick: true });
    // Gutters and kickback walls
    for (const s of [-1, 1]) {
      w.block({ pos: [s * (W / 2 + 0.25), 0.03, (deckEnd - 4) / 2], size: [0.5, 0.06, deckEnd + 4], mat: 'darkSteel', tile: 1, friction: 0.2 });
      w.block({ pos: [s * (W / 2 + 0.6), 0.45, (deckEnd + 2) / 2], size: [0.2, 0.9, deckEnd - 2], mat: 'steelGrey', tile: 1 });
    }
    // Pit: dark back wall and a soft floor, plus the masking header over the pins.
    w.block({ pos: [0, 0.02, deckEnd + 1.2], size: [W + 1.4, 0.04, 2.4], mat: 'rubber', tile: 1 });
    w.block({ pos: [0, 1.5, deckEnd + 2.5], size: [W + 1.4, 3, 0.3], mat: 'rubber', tile: 1 });
    w.block({ pos: [0, 3.1, L + 0.4], size: [W + 1.6, 0.6, 0.3], mat: 'hazard', tile: 1, cast: false });
    for (const s of [-1, 1]) w.block({ pos: [s * (W / 2 + 0.75), 1.7, L + 0.4], size: [0.15, 3.4, 0.15], mat: 'steelGrey', tile: 1 });
    w.paint({ pos: [0, LANE_TOP, -0.2], size: [W, 0.08], color: 0x20232a, opacity: 0.9 });
  }

  makeArrow() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1), mat);
    shaft.position.z = 0.5;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 3), mat);
    head.rotation.x = Math.PI / 2;
    this.world.disposables.push(shaft.geometry, head.geometry);
    g.add(shaft, head);
    g.visible = false;
    this.arrow = { g, shaft, head, mat };
    this.world.add(g);
  }

  newBowler() {
    if (this.bowler) this.removeDummy(this.bowler);
    this.bowler = this.spawnDummy({ position: [0, LANE_TOP, -2], yaw: 0, pose: 'ready', muscle: 1 });
    this.bowler.balance = 1;
    this.phase = 'aim';
    this.settle = 0;
    this.rollTime = 0;
    this.aimCamera(true);
  }

  aimCamera(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const pos = new THREE.Vector3(0, portrait ? 4.2 : 3.2, portrait ? -9 : -7.5);
    const look = new THREE.Vector3(0, 0.6, this.length * 0.55);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 3);
    this.stage.focusShadows(new THREE.Vector3(0, 0, this.length * 0.5), 16);
  }

  onPointerDown() {
    if (this.phase === 'aim') this.dragging = true;
  }

  onPointerMove(p, start) {
    if (!this.dragging || this.phase !== 'aim') return;
    const s = Math.min(p.w, p.h);
    const dx = (p.px - start.px) / s;
    const dy = -(p.py - start.py) / s;
    this.aimYaw = THREE.MathUtils.clamp(-dx * 0.5, -0.16, 0.16);
    this.power = THREE.MathUtils.clamp(dy / 0.4, 0, 1);
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.power < 0.08) {
      this.power = 0;
      return;
    }
    this.bowl();
  }

  onKeyDown(code) {
    if (this.phase !== 'aim') return;
    if (code === 'ArrowLeft') this.aimYaw = Math.min(0.16, this.aimYaw + 0.02);
    if (code === 'ArrowRight') this.aimYaw = Math.max(-0.16, this.aimYaw - 0.02);
    if (code === 'Space' || code === 'Enter') {
      this.power = Math.max(this.power, 0.7);
      this.bowl();
    }
  }

  bowl() {
    this.phase = 'roll';
    this.thrown++;
    this.hud.set('throws', this.throws - this.thrown);
    this.hud.clearHint();
    this.arrow.g.visible = false;
    const d = this.bowler;
    d.balance = 0;
    d.setPose('tuck');
    d.setMuscle(0.8);
    const speed = 7 + this.power * 9;
    const dir = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));
    d.ragdoll.addVelocity({ x: dir.x * speed, y: 1.2, z: dir.z * speed }, 0);
    const right = new THREE.Vector3(dir.z, 0, -dir.x);
    d.ragdoll.addSpin(right.multiplyScalar(-speed * 1.2));
    this.audio.whoosh(0.6 + this.power);
    this.audio.impact(0.5, 'body');
    this.line = dir;
    this.onLine = true;
  }

  /** A tumbling body curls off its line; a bowling ball doesn't. Bleed off sideways drift until he reaches the pins. */
  fixedUpdate() {
    if (this.phase !== 'roll' || !this.onLine) return;
    const v = this.bowler.velocity();
    const side = new THREE.Vector3(this.line.z, 0, -this.line.x);
    const drift = v.dot(side);
    const fix = side.multiplyScalar(-drift * 0.12);
    this.bowler.ragdoll.addVelocity(fix, 1);
  }

  onImpact(a, b, force, strength) {
    if (this.phase !== 'roll') return;
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    const other = dummy === a ? b : a;
    if (dummy && (other.prop || other.kind === 'static')) this.onLine = false;
    if (dummy && other.prop?.kind === 'pin' && this.bowler.knockout <= 0) {
      this.bowler.setPose('starfish');
      this.bowler.knockOut(4, 2);
      this.bowler.setMuscle(0.3);
      this.rig.shake(0.25);
    }
    if (other.prop?.kind === 'pin' || (a.prop?.kind === 'pin' && b.prop?.kind === 'pin')) {
      // Pin-on-pin clatter has its own bright wooden knock.
      this.audio.impact(Math.min(1, strength * 1.5), 'wood');
    }
  }

  isDown(pin) {
    const r = pin.body.rotation();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    const t = pin.body.translation();
    const moved = Math.hypot(t.x - pin.start.x, t.z - pin.start.z);
    return up.dot(UP) < 0.8 || t.y < pin.start.y - 0.3 || moved > 0.7;
  }

  pinsMoving() {
    return this.pins.some((p) => {
      const v = p.body.linvel();
      const w = p.body.angvel();
      return Math.hypot(v.x, v.y, v.z) > 0.25 || Math.hypot(w.x, w.y, w.z) > 0.6;
    });
  }

  tick(dt) {
    if (this.phase === 'aim') {
      const show = Boolean(this.dragging) && this.power > 0.02;
      this.arrow.g.visible = show;
      if (show) {
        const len = 1 + this.power * 4;
        const a = this.arrow;
        a.g.position.set(0, LANE_TOP + 0.03, -1.2);
        a.g.rotation.y = this.aimYaw;
        a.shaft.scale.z = len;
        a.shaft.position.z = len / 2;
        a.head.position.z = len + 0.2;
        a.mat.color.setHSL(0.15 - this.power * 0.15, 0.95, 0.55);
      }
      this.aimCamera();
      return;
    }

    if (this.phase === 'roll') {
      this.rollTime += dt;
      const com = this.bowler.com();
      const z = Math.min(com.z, this.length - 1);
      const portrait = this.stage.width < this.stage.height;
      this.rig.aim(new THREE.Vector3(com.x * 0.5, portrait ? 3.6 : 2.8, z - (portrait ? 7 : 5.5)), new THREE.Vector3(com.x * 0.5, 0.6, z + 3), 4, 6);
      this.stage.focusShadows(new THREE.Vector3(0, 0, z + 2), 14);
      this.audio.loop('rumble', Math.min(1, this.bowler.speed() / 10), 'rumble');

      const quiet = this.bowler.speed() < 0.5 && !this.pinsMoving();
      this.settle = quiet ? this.settle + dt : 0;
      if (this.settle > 0.8 || this.rollTime > 9) this.scoreThrow();
    }

    if (this.phase === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) this.afterThrow();
    }
  }

  scoreThrow() {
    this.phase = 'wait';
    this.audio.loop('rumble', 0, 'rumble');
    const fallen = this.pins.filter((p) => !p.down && this.isDown(p));
    for (const p of fallen) p.down = true;
    this.down += fallen.length;
    this.score += fallen.length * 100;
    const all = this.down === this.total;
    let label = `${fallen.length} ${fallen.length === 1 ? 'pin' : 'pins'}`;
    if (all && this.thrown === 1) {
      label = 'STRIKE!';
      this.score += 1500;
      this.fx.confetti(new THREE.Vector3(0, 1.5, this.length + 1), 140);
      this.audio.win();
    } else if (all) {
      label = 'SPARE!';
      this.score += 700;
      this.fx.confetti(new THREE.Vector3(0, 1.5, this.length + 1), 80);
      this.audio.ding(4);
    } else if (fallen.length === 0) {
      label = 'GUTTER!';
    }
    this.game.ui.banner(label, all ? `${this.total} down` : `${this.down}/${this.total} down`);
    this.hud.set('pins', `${this.down}/${this.total}`);
    this.hud.set('score', this.score.toLocaleString());
    this.hud.bump('pins');
    this.waitT = 1.6;
  }

  afterThrow() {
    const all = this.down === this.total;
    if (all || this.thrown >= this.throws) {
      const target = this.def.target ?? Math.ceil(this.total * 0.6);
      const stars = all ? (this.thrown === 1 ? 3 : 2) : this.down >= target ? 1 : 0;
      this.phase = 'done';
      this.finish({
        passed: stars > 0,
        stars,
        score: this.score,
        reason: `Knock down at least ${target} pins.`,
        stats: [
          ['Pins down', `${this.down}/${this.total}`],
          ['Throws', `${this.thrown}/${this.throws}`],
        ],
      });
      return;
    }
    this.nextBall();
  }

  /** Clears the fallen pins and sets up the next ball. */
  nextBall() {
    for (const p of this.pins.filter((q) => q.down)) {
      this.physics.removeBody(p.body);
      this.world.group.remove(p.mesh);
    }
    this.pins = this.pins.filter((p) => !p.down);
    this.newBowler();
    this.hud.hint('Pick off the rest!');
  }

  /** One extra ball at whatever is still standing. */
  revive() {
    this.throws++;
    this.hud.set('throws', this.throws - this.thrown);
    this.nextBall();
  }
}
