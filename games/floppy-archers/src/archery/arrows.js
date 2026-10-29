import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GRAVITY = 9.5; // arrows drop a little gentler than ragdolls fall, so shots read
const MAX_STUCK = 60;
const CLASH_R = 0.28; // two arrows passing this close knock each other away
const _dir = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const FWD = new THREE.Vector3(0, 0, 1);

/** One arrow model, pointing down +z: shaft, steel head, and three fletchings. */
function arrowGeometry() {
  const shaft = new THREE.CylinderGeometry(0.016, 0.016, 0.82, 6).rotateX(Math.PI / 2);
  const head = new THREE.ConeGeometry(0.045, 0.14, 8).rotateX(Math.PI / 2).translate(0, 0, 0.47);
  const vanes = [0, 1, 2].map((i) =>
    new THREE.PlaneGeometry(0.06, 0.16)
      .translate(0.035, 0, 0)
      .rotateZ((i * Math.PI * 2) / 3)
      .translate(0, 0, -0.33),
  );
  const parts = [shaft, head, ...vanes];
  // Paint by vertex colour so one mesh carries wood, steel and feathers.
  const tint = [0xc9935a, 0xd9dde3, 0xf4f1e8, 0xf4f1e8, 0xf4f1e8];
  parts.forEach((g, i) => {
    const c = new THREE.Color(tint[i]);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, k) => [c.r, c.g, c.b][k % 3]), 3));
  });
  const geo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  parts.forEach((g) => g.dispose());
  return geo;
}

/**
 * Every arrow in flight. Arrows aren't physics bodies: each step one is moved
 * along its arc and a ray traced from where it was to where it is, so even the
 * fastest shot can't skip through a thin arm. What the ray finds decides what
 * happens: a body part takes the hit, anything else just gets an arrow stuck
 * in it. Two arrows that pass close enough knock each other out of the air.
 */
export class Arrows {
  constructor(scene) {
    this.scene = scene;
    this.flying = [];
    this.stuck = [];
    this.geo = arrowGeometry();
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    this.fireMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0xff5a1a, emissiveIntensity: 0.9 });
    scene.world.disposables.push(this.geo, this.mat, this.fireMat);
  }

  /** Lets an arrow go from `origin` along `dir` (unit) at `speed`. */
  fire({ origin, dir, speed, owner, damage, burn = 0 }) {
    const mesh = new THREE.Mesh(this.geo, burn ? this.fireMat : this.mat);
    mesh.castShadow = true;
    this.scene.world.add(mesh);
    const a = {
      pos: origin.clone(),
      prev: origin.clone(),
      vel: dir.clone().multiplyScalar(speed),
      owner,
      damage,
      burn,
      mesh,
      age: 0,
      spent: false,
    };
    this.pose(a);
    this.flying.push(a);
    return a;
  }

  pose(a) {
    a.mesh.position.copy(a.pos);
    if (a.vel.lengthSq() > 1e-6) a.mesh.quaternion.setFromUnitVectors(FWD, _dir.copy(a.vel).normalize());
  }

  step(dt) {
    const { physics } = this.scene;
    for (const a of this.flying) {
      a.age += dt;
      a.prev.copy(a.pos);
      a.vel.y -= GRAVITY * dt;
      a.pos.addScaledVector(a.vel, dt);
      _seg.subVectors(a.pos, a.prev);
      const len = _seg.length();
      if (len < 1e-5) continue;
      _seg.divideScalar(len);
      // A spent arrow (knocked aside) tumbles to the ground and stops there.
      const skip = a.owner?.dummy.ragdoll.handles;
      const hit = physics.castRay(a.prev, _seg, len + 0.38, skip ? (c) => !skip.has(c.handle) : undefined);
      if (hit && hit.distance <= len + 0.38) {
        const point = a.prev.clone().addScaledVector(_seg, hit.distance);
        const info = physics.info(hit.collider.handle);
        if (!a.spent && info?.kind === 'dummy') this.scene.onArrowHit(a, info, point, hit.collider);
        else this.lodge(a, point, hit.collider, info);
        a.done = true;
        continue;
      }
      if (!a.spent) this.scene.onArrowPath?.(a, a.prev, a.pos);
      if (a.pos.y < -20 || a.age > 8) {
        a.done = true;
        a.mesh.removeFromParent();
        continue;
      }
      this.pose(a);
    }
    this.clash();
    this.flying = this.flying.filter((a) => !a.done);
  }

  /** Opposing arrows that meet in the air bounce off each other in a shower of sparks. */
  clash() {
    const live = this.flying.filter((a) => !a.spent && !a.done);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (a.owner === b.owner || a.spent || b.spent) continue;
        if (a.pos.distanceTo(b.pos) > CLASH_R && a.prev.distanceTo(b.prev) > CLASH_R) continue;
        const at = a.pos.clone().add(b.pos).multiplyScalar(0.5);
        for (const x of [a, b]) {
          x.spent = true;
          x.vel.set(-x.vel.x * 0.25 + (Math.random() - 0.5) * 3, 3 + Math.random() * 3, 0);
        }
        this.scene.onClash?.(at);
      }
    }
  }

  /** Leaves the arrow buried a little way in whatever it hit, moving with it if it moves. */
  lodge(a, point, collider, info) {
    const body = collider.parent();
    let host = null;
    if (body && body.isDynamic()) {
      const m = Math.min(1, body.mass());
      body.applyImpulseAtPoint({ x: a.vel.x * 0.06 * m, y: a.vel.y * 0.06 * m, z: 0 }, point, true);
      host = info?.prop?.mesh ?? null;
    }
    this.stick(a, point, host);
    this.scene.onArrowLodge?.(a, point, info, collider);
  }

  /** Buries the arrow at `point` along its flight, carried by `host` from then on if given. */
  stick(a, point, host = null) {
    _dir.copy(a.vel).normalize();
    a.mesh.position.copy(point).addScaledVector(_dir, 0.16);
    a.mesh.quaternion.setFromUnitVectors(FWD, _dir);
    if (host) this.attach(a.mesh, host);
    this.keep(a.mesh);
  }

  /** Re-parents an arrow mesh onto `host`, keeping where it sits in the world. */
  attach(mesh, host) {
    host.updateWorldMatrix(true, false);
    _m.copy(host.matrixWorld).invert().multiply(mesh.matrixWorld.compose(mesh.position, mesh.quaternion, mesh.scale));
    _m.decompose(mesh.position, _q, mesh.scale);
    mesh.quaternion.copy(_q);
    host.add(mesh);
  }

  keep(mesh) {
    this.stuck.push(mesh);
    if (this.stuck.length > MAX_STUCK) this.stuck.shift().removeFromParent();
  }
}
