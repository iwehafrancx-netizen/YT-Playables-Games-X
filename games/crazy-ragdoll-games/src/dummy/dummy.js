import { Vector3 } from 'three';
import { Ragdoll } from './ragdoll.js';
import { DummyView } from './dummyView.js';

/**
 * A crash-test dummy: physical ragdoll plus its visuals, with a knockout
 * model — hard hits drop muscle tone, which then recovers over time.
 */
export class Dummy {
  constructor(ctx, { position = [0, 0, 0], yaw = 0, pose = 'stand', muscle = 1, suit = 'classic', tag } = {}) {
    this.ctx = ctx;
    this.ragdoll = new Ragdoll(ctx.physics, { position, yaw, pose, muscle, tag });
    this.view = new DummyView(ctx.scene, ctx.physics, this.ragdoll, suit);
    this.baseMuscle = muscle;
    this.recover = 0;
    this.knockout = 0;
    this.alive = true;
  }

  get parts() {
    return this.ragdoll.parts;
  }

  set balance(b) {
    this.ragdoll.balance = b;
  }

  get balance() {
    return this.ragdoll.balance;
  }

  set lively(v) {
    this.ragdoll.lively = v;
  }

  setMuscle(m) {
    this.baseMuscle = m;
    this.ragdoll.setMuscle(this.knockout > 0 ? Math.min(m, 0.05) : m);
  }

  setPose(p) {
    this.ragdoll.setPose(p);
  }

  /** Goes floppy for `seconds`, then tone eases back (`recover` = seconds to full). */
  knockOut(seconds = 1.2, recover = 0.8) {
    this.knockout = Math.max(this.knockout, seconds);
    this.recover = recover;
    this.ragdoll.setMuscle(0.03);
  }

  update(dt) {
    if (this.knockout > 0) {
      this.knockout -= dt;
      if (this.knockout <= 0) this.recoverT = 0;
    } else if (this.recoverT !== undefined) {
      this.recoverT += dt;
      const k = Math.min(1, this.recoverT / Math.max(0.01, this.recover));
      this.ragdoll.setMuscle(0.03 + (this.baseMuscle - 0.03) * k * k);
      if (k >= 1) this.recoverT = undefined;
    }
    this.view.update(dt, this.knockout > 0);
  }

  isPart(handle) {
    return this.ragdoll.isPart(handle);
  }

  com(out = new Vector3()) {
    return this.ragdoll.centerOfMass(out);
  }

  velocity(out = new Vector3()) {
    return this.ragdoll.velocity(out);
  }

  speed() {
    return this.ragdoll.speed();
  }

  headPosition(out = new Vector3()) {
    const t = this.parts.head.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  partPosition(name, out = new Vector3()) {
    const t = this.parts[name].body.translation();
    return out.set(t.x, t.y, t.z);
  }

  dispose() {
    this.view.dispose();
    this.ragdoll.dispose();
    this.alive = false;
  }
}
