import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion } from 'three';

export { RAPIER };

export const STEP = 1 / 60;

export const Group = {
  WORLD: 1 << 0,
  DUMMY: 1 << 1,
  PROP: 1 << 2,
  SENSOR: 1 << 3,
  ALL: 0xffff,
};

export function groups(member, filter = Group.ALL) {
  return (member << 16) | filter;
}

let ready = null;
export function loadPhysics() {
  ready ??= RAPIER.init();
  return ready;
}

/**
 * Thin wrapper around a Rapier world: fixed-step simulation, collider tagging
 * and interpolated syncing of render objects.
 */
export class Physics {
  constructor(gravity = -11) {
    this.world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
    this.world.timestep = STEP;
    this.world.numSolverIterations = 6;
    this.events = new RAPIER.EventQueue(true);
    this.tags = new Map();
    this.links = [];
    this.preStep = [];
    this.onImpact = null;
    this.onContact = null;
    this.time = 0;
  }

  tag(collider, info) {
    this.tags.set(collider.handle, info);
    return collider;
  }

  info(handle) {
    return this.tags.get(handle);
  }

  createBody(desc) {
    return this.world.createRigidBody(desc);
  }

  createCollider(desc, body, info) {
    const c = this.world.createCollider(desc, body);
    if (info) this.tag(c, info);
    return c;
  }

  removeBody(body) {
    for (let i = 0; i < body.numColliders(); i++) this.tags.delete(body.collider(i).handle);
    this.links = this.links.filter((l) => l.body !== body);
    this.world.removeRigidBody(body);
  }

  /** Keeps `object` following `body`, interpolated between physics steps. */
  link(body, object) {
    const l = { body, object, p0: new Vector3(), p1: new Vector3(), q0: new Quaternion(), q1: new Quaternion() };
    this.links.push(l);
    this.snap(l);
    return l;
  }

  snap(l) {
    const t = l.body.translation();
    const r = l.body.rotation();
    l.p1.set(t.x, t.y, t.z);
    l.q1.set(r.x, r.y, r.z, r.w);
    l.p0.copy(l.p1);
    l.q0.copy(l.q1);
    l.object.position.copy(l.p1);
    l.object.quaternion.copy(l.q1);
  }

  snapAll() {
    for (const l of this.links) this.snap(l);
  }

  step() {
    for (const l of this.links) {
      l.p0.copy(l.p1);
      l.q0.copy(l.q1);
    }
    for (const fn of this.preStep) fn(STEP);
    this.world.step(this.events);
    this.time += STEP;

    for (const l of this.links) {
      const t = l.body.translation();
      const r = l.body.rotation();
      l.p1.set(t.x, t.y, t.z);
      l.q1.set(r.x, r.y, r.z, r.w);
    }

    if (this.onImpact) {
      this.events.drainContactForceEvents((e) => {
        this.onImpact(e.collider1(), e.collider2(), e.maxForceMagnitude());
      });
    } else {
      this.events.drainContactForceEvents(() => {});
    }
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (this.onContact) this.onContact(h1, h2, started);
    });
  }

  sync(alpha) {
    for (const l of this.links) {
      l.object.position.lerpVectors(l.p0, l.p1, alpha);
      l.object.quaternion.slerpQuaternions(l.q0, l.q1, alpha);
    }
  }

  castRay(origin, dir, maxDist, exclude) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(ray, maxDist, true, undefined, undefined, undefined, undefined, exclude);
    return hit ? { distance: hit.timeOfImpact ?? hit.toi, collider: hit.collider } : null;
  }

  dispose() {
    this.events.free();
    this.world.free();
    this.tags.clear();
    this.links.length = 0;
  }
}
