import * as THREE from 'three';
import { Level } from './level.js';
import { SUITS } from '../dummy/dummyView.js';

const SUIT_IDS = Object.keys(SUITS);

/** Title-screen backdrop: ragdolls raining onto a trampoline and a crate pile. */
export class Showcase extends Level {
  setup() {
    this.scenery();
    const w = this.world;
    w.trampoline({ pos: [-2.2, 0.5, 2], size: [3, 3], power: 9 });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) w.crate({ pos: [3 + i * 0.92 + r * 0.46, 0.45 + r * 0.9, 1.5], size: 0.9 });
    this.clutter([[6.5, -1], [-6, -2]]);
    this.next = 0.5;
    this.n = 0;
    this.orbit = 0;
  }

  drop() {
    const x = -2.2 + (Math.random() - 0.5) * 1.6;
    const d = this.spawnDummy({ position: [x, 7 + Math.random() * 2, 2 + (Math.random() - 0.5) * 1.5], yaw: Math.random() * 6, pose: 'starfish', muscle: 0.5, suit: SUIT_IDS[this.n++ % SUIT_IDS.length] });
    d.ragdoll.addSpin(new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 2 - 1, Math.random() * 4 - 2));
    d.born = this.time;
    if (this.dummies.length > 6) this.removeDummy(this.dummies[0]);
  }

  tick(dt) {
    this.next -= dt;
    if (this.next <= 0) {
      this.drop();
      this.next = 1.5;
    }
    this.orbit += dt;
    const centre = new THREE.Vector3(0.4, 1.6, 2);
    const portrait = this.stage.width < this.stage.height;
    const r = portrait ? 17 : 13;
    const a = Math.sin(this.orbit * 0.08) * 0.5;
    const pos = new THREE.Vector3(centre.x + Math.sin(a) * r, portrait ? 6.5 : 5, centre.z + Math.cos(a) * r);
    this.rig.aim(pos, centre, 1.5, 1.5);
    this.stage.focusShadows(centre, 16);
  }
}
