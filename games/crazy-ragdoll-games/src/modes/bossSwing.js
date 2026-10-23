import * as THREE from 'three';
import { BossLevel } from './bossLevel.js';
import { RAPIER } from '../physics/physics.js';

const PIVOT = new THREE.Vector3(0, 11, 0);
const ROPE = 6;
const CHEST = { x: 0, y: 0.17, z: 0 };
const PUMP = 5.5;
const MAX_SPEED = 14;
const SCALE = 1.5;
const HIT_R = 1.7;
const DOTS = 18;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Wrecker: a robot with a glass dome for a head paces up and down beyond a
 * dock crane. Hang the ragdoll on the crane rope, hold to pump the swing,
 * and let go to fly head first into the dome. Each smash cracks it a bit more.
 */
export class BossSwingLevel extends BossLevel {
  setup() {
    this.tries = this.def.tries;
    this.tried = 0;
    this.holding = false;
    this.botX = 12;
    this.scenery({ run: { axis: 'x', to: 30 } });
    this.clutter([[8, -2], [16, -1.5], [19, 1]]);
    this.crane();
    this.bossSetup({ scale: SCALE, dome: true }, [{ id: 'tries', icon: 'dummy', value: this.tries }]);
    this.robot.root.rotation.y = -Math.PI / 2;
    this.dots = this.trail();
    this.hook();
    this.cameraFor(true);
  }

  crane() {
    const w = this.world;
    const mast = w.mesh(new THREE.BoxGeometry(0.7, PIVOT.y + 1.2, 0.7), 'toyYellow');
    mast.position.set(-3.5, (PIVOT.y + 1.2) / 2, -1.4);
    const boom = w.mesh(new THREE.BoxGeometry(5.6, 0.5, 0.55), 'toyYellow');
    boom.position.set(-1, PIVOT.y + 0.45, -1.4);
    const arm = w.mesh(new THREE.BoxGeometry(0.3, 0.3, 1.5), 'toyYellow');
    arm.position.set(PIVOT.x, PIVOT.y + 0.45, -0.6);
    w.add(mast, boom, arm);
    this.anchor = this.physics.createBody(RAPIER.RigidBodyDesc.fixed().setTranslation(PIVOT.x, PIVOT.y, PIVOT.z));
    const cable = new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, -0.5, 0);
    this.world.disposables.push(cable);
    this.cable = w.mesh(cable, 'darkSteel', { cast: false });
    this.cable.position.copy(PIVOT);
    w.add(this.cable);
  }

  trail() {
    const geo = new THREE.SphereGeometry(0.08, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.world.disposables.push(geo, mat);
    return Array.from({ length: DOTS }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.world.add(m);
      return m;
    });
  }

  hook() {
    const a = -0.9;
    const chest = _a.set(PIVOT.x + Math.sin(a) * (ROPE + 0.2), PIVOT.y - Math.cos(a) * (ROPE + 0.2), 0);
    const d = this.spawnDummy({ position: [chest.x, chest.y - 1.41, 0], yaw: Math.PI / 2, pose: 'hang', muscle: 0.6 });
    this.rope = this.physics.world.createImpulseJoint(RAPIER.JointData.rope(ROPE, { x: 0, y: 0, z: 0 }, CHEST), this.anchor, d.parts.chest.body, true);
    this.dummy = d;
    this.turn = 'swing';
    this.physics.snapAll();
  }

  // ---------- input ----------

  onPointerDown() {
    if (this.turn !== 'swing' || this.phase !== 'fight') return;
    this.holding = true;
    this.hud.clearHint();
  }

  onPointerUp() {
    if (!this.holding) return;
    this.holding = false;
    if (this.turn !== 'swing') return;
    this.physics.world.removeImpulseJoint(this.rope, true);
    this.dummy.setPose('starfish');
    this.dummy.setMuscle(0.5);
    this.turn = 'flying';
    this.flyT = 0;
    this.smashed = false;
    this.tried++;
    this.hud.set('tries', this.tries - this.tried);
    this.audio.whoosh(1.2);
    for (const dot of this.dots) dot.visible = false;
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter') this.onPointerDown();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter') this.onPointerUp();
  }

  // ---------- fight ----------

  fixedUpdate(dt) {
    if (this.phase === 'fight') {
      this.botX = 12 + Math.sin(this.time * this.def.pace) * this.def.roam;
      this.robot.root.position.set(this.botX, 0, 0);
    }
    const d = this.dummy;
    const c = d.com(_a);
    d.ragdoll.addVelocity({ x: 0, y: 0, z: -c.z * 2 * dt });
    if (this.turn === 'swing') {
      const v = d.velocity(_b);
      const speed = Math.hypot(v.x, v.y);
      const push = this.holding ? PUMP : speed < 3 ? 0.6 : 0;
      if (push && speed < MAX_SPEED) {
        const t = this.tangent(_b);
        d.ragdoll.addVelocity({ x: t.x * push * dt, y: t.y * push * dt, z: 0 });
      }
      return;
    }
    if (this.turn !== 'flying') return;
    this.flyT += dt;
    if (!this.smashed && this.phase === 'fight') {
      const head = this.robot.headPosition(_b).add(new THREE.Vector3(0, 0.4 * SCALE, 0));
      if (c.distanceTo(head) < HIT_R) {
        this.smashed = true;
        d.ragdoll.setVelocity({ x: -6, y: 4, z: 0 });
        this.hit(head.clone(), 'SMASH!');
        this.robot.glass.material.opacity = 0.45 * (this.hp / this.def.hp) + 0.1;
      }
    }
    if ((this.flyT > 1 && d.speed() < 0.5) || this.flyT > 5) this.again();
  }

  tangent(out) {
    const c = this.dummy.parts.chest.body.translation();
    const dx = c.x - PIVOT.x;
    const dy = c.y - PIVOT.y;
    const len = Math.hypot(dx, dy) || 1;
    out.set(-dy / len, dx / len, 0);
    const v = this.dummy.velocity(_a);
    if (v.x * out.x + v.y * out.y < 0) out.negate();
    return out;
  }

  again() {
    this.turn = 'between';
    this.nextT = 0.6;
  }

  tick(dt) {
    this.bossTick(dt, this.phase === 'fight' ? 0.6 : 0);
    this.cameraFor();
    const dome = this.robot.headPosition(_a).add(_b.set(0, 1.2 * SCALE, 0));
    this.coach(this.turn === 'swing' ? `Swing, then let go to fly into its glass dome · ${this.hitsLeft()}` : this.hitsLeft(), dome);
    if (this.turn === 'swing') {
      const c = this.dummy.parts.chest.body.translation();
      _a.set(c.x - PIVOT.x, c.y - PIVOT.y, c.z - PIVOT.z);
      this.cable.scale.y = _a.length();
      this.cable.quaternion.setFromUnitVectors(_b.set(0, -1, 0), _a.normalize());
      this.drawTrail();
    } else this.cable.quaternion.identity();
    if (this.turn === 'between' && this.phase === 'fight') {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (this.tried >= this.tries) this.lose('Out of tries before the Wrecker went down.');
        else {
          this.removeDummy(this.dummy);
          this.hook();
        }
      }
    }
  }

  drawTrail() {
    const c = this.dummy.com(_a);
    const v = this.dummy.velocity(_b);
    this.dots.forEach((dot, i) => {
      const t = (i + 1) * 0.1;
      dot.position.set(c.x + v.x * t, c.y + v.y * t + 0.5 * this.gravity * t * t, 0);
      dot.visible = this.holding && dot.position.y > 0;
    });
  }

  /** Two more goes on the rope. */
  revive() {
    this.tries += 2;
    this.hud.set('tries', this.tries - this.tried);
    this.phase = 'fight';
    this.removeDummy(this.dummy);
    this.hook();
  }

  spare() {
    return (this.tries - this.tried) / this.tries;
  }

  bossStats() {
    return [['Swings', `${this.tried}`]];
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const x0 = PIVOT.x - ROPE - 1;
    const x1 = 12 + this.def.roam + 3;
    const { pos, look } = this.frameBox(_a.set(x0, 0, -1.5), _b.set(x1, PIVOT.y + 1.5, 1.5), { yaw: portrait ? -60 : -12, pitch: portrait ? 24 : 10, margin: portrait ? 0.95 : 0.88 });
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(look, 22);
  }
}
