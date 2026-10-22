import * as THREE from 'three';
import { AttemptLevel } from './attemptLevel.js';

const PART_MULT = { head: 2, chest: 1.2, pelvis: 1 };
const HIT_WORDS = [
  [900, 'MEGA CRUNCH!'],
  [500, 'CRUNCH!'],
  [280, 'BONK!'],
  [150, 'OOF!'],
];

const MAX_HIT = 900; // no single bump is worth more than a good tumble
/**
 * Drop Test: shove a standing dummy down a course and score every painful
 * impact. Three attempts, best one counts.
 */
export class DropTestLevel extends AttemptLevel {
  setupRun() {
    const def = this.def;
    this.phase = 'aim';
    this.combo = 1;
    this.lastHit = -1;
    this.settle = 0;
    this.runTime = 0;
    this.partCooldown = {};

    this.scenery({ flip: true, mat: def.ground ?? 'concrete' });
    def.build(this.world, this);

    const [x, y, z] = def.start;
    this.dummy = this.spawnDummy({ position: [x, y, z], yaw: ((def.facing ?? 0) * Math.PI) / 180, pose: 'ready', muscle: 1 });
    this.dummy.balance = 1;
    this.pushDir = new THREE.Vector3(Math.sin(((def.facing ?? 0) * Math.PI) / 180), 0, Math.cos(((def.facing ?? 0) * Math.PI) / 180));
    this.power = 0;
    this.makeArrow();
    this.aimCamera(true);

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'try', icon: 'dummy', value: `${this.attempt}/${this.attempts}` },
        { id: 'run', icon: 'bolt', value: 0 },
        { id: 'best', icon: 'star', value: this.bestLabel() },
      ],
    });
    this.hud.hint(this.attempt === 1 ? def.hint ?? 'Drag to aim your shove · release to push' : `Attempt ${this.attempt} — beat ${this.bestRun.toLocaleString()}`);
  }

  makeArrow() {
    const g = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 10);
    shaftGeo.translate(0, 0.5, 0);
    const headGeo = new THREE.ConeGeometry(0.16, 0.34, 14);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0x3fc79a, transparent: true, opacity: 0.9, depthTest: false });
    this.shaft = new THREE.Mesh(shaftGeo, this.arrowMat);
    this.head = new THREE.Mesh(headGeo, this.arrowMat);
    this.shaft.renderOrder = this.head.renderOrder = 10;
    g.add(this.shaft, this.head);
    g.visible = false;
    this.arrow = g;
    this.world.add(g);
    this.world.disposables.push(shaftGeo, headGeo);
  }

  aimCamera(snap = false) {
    const def = this.def;
    const chest = this.dummy.partPosition('chest');
    const portrait = this.stage.width < this.stage.height;
    const off = new THREE.Vector3(...(def.camAim ?? [5, 2.5, -5]));
    const lookOff = new THREE.Vector3(...(def.lookAim ?? [0, -0.8, 2]));
    // Narrow screens: back off further and keep the dummy nearer the middle of the frame.
    if (portrait) {
      off.multiplyScalar(1.7);
      lookOff.multiplyScalar(0.45);
    }
    const look = chest.clone().add(lookOff);
    const pos = chest.clone().add(off);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 3);
    this.stage.focusShadows(look, 20);
  }

  onPointerDown() {
    if (this.phase !== 'aim') return;
    this.dragging = true;
  }

  onPointerMove(p, start) {
    if (!this.dragging || this.phase !== 'aim') return;
    // Map the screen drag onto the ground plane as seen from the camera.
    const cam = this.stage.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate().setY(0).normalize();
    const s = Math.min(p.w, p.h);
    const dx = (p.px - start.px) / s;
    const dy = -(p.py - start.py) / s;
    const v = right.multiplyScalar(dx).addScaledVector(fwd, dy);
    const len = v.length();
    if (len > 0.02) this.pushDir.copy(v).normalize();
    this.power = Math.min(1, len / 0.35);
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.power < 0.08) {
      this.power = 0;
      return;
    }
    this.shove();
  }

  onKeyDown(code) {
    if (this.phase !== 'aim') return;
    if (code === 'Space' || code === 'Enter') {
      this.power = Math.max(this.power, 0.75);
      this.shove();
    }
  }

  shove() {
    this.phase = 'fall';
    this.arrow.visible = false;
    this.hud.clearHint();
    const d = this.dummy;
    const speed = 2.5 + this.power * (this.def.maxPush ?? 8);
    const v = this.pushDir.clone().multiplyScalar(speed);
    d.balance = 0;
    d.setPose('starfish');
    d.knockOut(99, 1);
    const R = d.ragdoll;
    // Shove the upper body harder than the legs so he topples rather than slides.
    for (const [name, k] of Object.entries({ head: 1.3, chest: 1.2, upperArmL: 1.1, upperArmR: 1.1, lowerArmL: 1, lowerArmR: 1, pelvis: 0.8, thighL: 0.55, thighR: 0.55, shinL: 0.3, shinR: 0.3 })) {
      const b = R.parts[name].body;
      const lv = b.linvel();
      b.setLinvel({ x: lv.x + v.x * k, y: lv.y + 1.2 * this.power * k, z: lv.z + v.z * k }, true);
    }
    this.audio.whoosh(0.7 + this.power);
    this.audio.impact(0.6, 'body');
    this.rig.shake(0.15);
  }

  onImpact(a, b, force) {
    if (this.phase !== 'fall') return;
    const info = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!info || this.dummyFor(info) !== this.dummy) return;
    if (force < 1100) return;
    const other = info === a ? b : a;
    if (other.kind === 'dummy') return;
    const key = info.part;
    if (this.partCooldown[key] && this.time - this.partCooldown[key] < 0.25) return;
    // Pinned against something (a rotor grinding him) isn't a fresh hit.
    const lv = this.dummy.parts[key].body.linvel();
    if (Math.hypot(lv.x, lv.y, lv.z) < 2.5) return;
    this.partCooldown[key] = this.time;

    if (this.time - this.lastHit < 0.6) this.combo = Math.min(4, this.combo + 0.25);
    else this.combo = 1;
    this.lastHit = this.time;
    const mult = (PART_MULT[key] ?? 0.8) * (other.kind === 'prop' ? 1.3 : 1);
    const pts = Math.min(MAX_HIT, Math.round(((force - 900) / 45) * mult * this.combo));
    if (pts <= 0) return;
    this.runScore += pts;
    this.hud.set('run', this.runScore.toLocaleString());

    const pos = this.dummy.partPosition(key).add(new THREE.Vector3(0, 0.35, 0));
    const word = HIT_WORDS.find(([min]) => pts >= min);
    if (word) {
      this.fx.text(pos, `${word[1]} +${pts}`, { color: key === 'head' ? '#ff7a6b' : '#ffe066', size: 22 + Math.min(18, pts / 40) });
      this.audio.crack();
      this.rig.shake(Math.min(0.5, pts / 1500));
      if (pts >= 500) this.slowmoT = 0.25;
    } else if (pts >= 40) {
      this.fx.text(pos, `+${pts}`, { color: '#ffffff', size: 18, life: 0.7 });
    }
    if (this.combo >= 2) this.hud.bump('run');
  }

  checkProps() {
    for (const p of this.world.props) {
      if (p.knocked) continue;
      const t = p.body.translation();
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y, t.z - p.start.z) > 0.6) {
        p.knocked = true;
        if (this.phase === 'fall') {
          this.runScore += 75;
          this.hud.set('run', this.runScore.toLocaleString());
          this.fx.text(new THREE.Vector3(t.x, t.y + 0.5, t.z), '+75', { size: 16, life: 0.7 });
        }
      }
    }
  }

  tick(dt) {
    if (this.time % 0.2 < dt) this.checkProps();
    if (this.slowmoT > 0) this.slowmoT -= dt / this.slowmo;
    this.slowmo = this.slowmoT > 0 ? 0.35 : 1;

    if (this.phase === 'aim') {
      const chest = this.dummy.partPosition('chest');
      const show = Boolean(this.dragging) && this.power > 0.02;
      this.arrow.visible = show;
      if (show) {
        const len = 0.6 + this.power * 1.8;
        this.arrow.position.copy(chest);
        this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.pushDir.clone().add(new THREE.Vector3(0, 0.15, 0)).normalize());
        this.shaft.scale.set(1, len, 1);
        this.head.position.set(0, len + 0.15, 0);
        this.arrowMat.color.setHSL(0.38 - this.power * 0.38, 0.75, 0.5);
      }
      this.aimCamera();
      return;
    }

    if (this.phase === 'fall') {
      this.runTime += dt;
      const com = this.dummy.com();
      const off = new THREE.Vector3(...(this.def.camFall ?? [5, 3, -5]));
      if (this.stage.width < this.stage.height) off.multiplyScalar(1.25);
      this.rig.aim(com.clone().add(off), com, 3, 7);
      this.stage.focusShadows(com, 16);

      const still = this.dummy.speed() < 0.35;
      this.settle = still ? this.settle + dt : 0;
      if (this.settle > 1.1 || this.runTime > (this.def.maxTime ?? 14) || com.y < -6) this.finishRun(com);
    }

    if (this.phase === 'between') this.tickBetween(dt);
  }

  finishRun(com) {
    this.runScore += this.zoneBonus(com);
    this.endRun();
  }
}
