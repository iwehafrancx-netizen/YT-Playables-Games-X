import * as THREE from 'three';
import { Level } from './level.js';
import { Cannon } from '../world/cannon.js';

const SUITS = ['classic', 'orange', 'blue', 'mint', 'red'];

/** Title-screen backdrop: the lab cannon lobbing dummies into crates, forever. */
export class Showcase extends Level {
  setup() {
    this.yard();
    const w = this.world;
    this.cannon = new Cannon(w, { pos: [-9, 0, 5], yaw: 90, pitch: 38 });
    w.trampoline({ pos: [-1.5, 0.5, 5], size: [2.6, 2.6], power: 11 });
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 4 - r; i++) w.crate({ pos: [5, 0.41 + r * 0.8, 3.8 + i * 0.82 + r * 0.41] });
    }
    for (let i = 0; i < 6; i++) w.barrel({ pos: [2.5 + (i % 3) * 0.65, 0.45, 1 + Math.floor(i / 3) * 0.65] });
    w.bullseye({ pos: [9, 2.2, 8], radius: 1, yaw: -90 });
    w.container({ pos: [11, 0, -1], yaw: 10, color: 'steelBlue' });
    w.container({ pos: [-4, 0, -6], yaw: 90, color: 'steelRed' });
    this.next = 0.8;
    this.shot = 0;
    this.orbit = 0;
  }

  fire() {
    const c = this.cannon;
    c.yaw = 80 + Math.random() * 20;
    c.pitch = 28 + Math.random() * 18;
    c.fire();
    const dir = c.direction(new THREE.Vector3());
    const m = c.muzzle(new THREE.Vector3());
    const d = this.spawnDummy({ position: [m.x, m.y - 0.93, m.z], yaw: (c.yaw * Math.PI) / 180, pose: 'tuck', muscle: 0.5, suit: SUITS[this.shot++ % SUITS.length] });
    d.ragdoll.setVelocity(dir.multiplyScalar(12 + Math.random() * 3));
    d.ragdoll.addSpin(new THREE.Vector3(Math.random() * 6 - 3, 0, Math.random() * 6 - 3));
    d.born = this.time;
    this.audio.boom();
    this.fx.puff(m, { count: 10, color: 0xcfc8bb, size: 1, speed: 2.2, up: 1 });
    if (this.dummies.length > 5) this.removeDummy(this.dummies[0]);
  }

  onImpact(a, b, force, strength) {
    const info = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    const d = info && this.dummyFor(info);
    if (d && strength > 0.2 && this.time - d.born > 0.2) {
      d.setPose('starfish');
      d.knockOut(2.5, 1.5);
      d.setMuscle(0.3);
    }
  }

  onTargetHit(target) {
    target.hit = false;
  }

  tick(dt) {
    this.cannon.update(dt);
    this.next -= dt;
    if (this.next <= 0) {
      this.fire();
      this.next = 2.6;
    }
    this.orbit += dt;
    const centre = new THREE.Vector3(0, 1.2, 5);
    const portrait = this.stage.width < this.stage.height;
    const r = portrait ? 20 : 15;
    const a = Math.sin(this.orbit * 0.07) * 0.55;
    const pos = new THREE.Vector3(centre.x + Math.sin(a) * r, portrait ? 7 : 5.5, centre.z + Math.cos(a) * r);
    this.rig.aim(pos, centre, 1.5, 1.5);
    this.stage.focusShadows(centre, 20);
  }
}
