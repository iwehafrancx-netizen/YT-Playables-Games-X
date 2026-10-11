import * as THREE from 'three';

const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Smoothed camera with trauma-based shake. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 4, 10);
    this.look = new THREE.Vector3();
    this.goalPos = this.pos.clone();
    this.goalLook = this.look.clone();
    this.posRate = 4;
    this.lookRate = 6;
    this.trauma = 0;
    this.time = 0;
    this.fovKick = 0;
  }

  set(pos, look) {
    this.pos.copy(pos);
    this.goalPos.copy(pos);
    this.look.copy(look);
    this.goalLook.copy(look);
    this.apply(0);
  }

  aim(pos, look, posRate = 4, lookRate = 6) {
    this.goalPos.copy(pos);
    this.goalLook.copy(look);
    this.posRate = posRate;
    this.lookRate = lookRate;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  kick(amount) {
    this.fovKick = Math.max(this.fovKick, amount);
  }

  update(dt) {
    this.time += dt;
    this.pos.lerp(this.goalPos, damp(this.posRate, dt));
    this.look.lerp(this.goalLook, damp(this.lookRate, dt));
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.fovKick = Math.max(0, this.fovKick - dt * 12);
    this.apply(dt);
  }

  apply() {
    const c = this.camera;
    c.position.copy(this.pos);
    const s = this.trauma * this.trauma;
    if (s > 0) {
      const t = this.time * 40;
      c.position.x += (Math.sin(t * 1.3) + Math.sin(t * 2.7) * 0.5) * 0.12 * s;
      c.position.y += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * 0.5) * 0.12 * s;
    }
    c.lookAt(this.look);
    if (s > 0) c.rotateZ(Math.sin(this.time * 33) * 0.03 * s);
    c.userData.fovKick = this.fovKick;
  }
}
