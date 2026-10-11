import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { Mat } from '../render/materials.js';

// Basket dimensions (metres), body origin at the bottom of the wheels.
const W = 0.66;
const L = 1.0;
const FLOOR = 0.5;
const WALL = 0.5;
const WHEEL_R = 0.1;
const SEAT_H = 0.25;

function bar(a, b, r = 0.012) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** Steel-wire shopping cart: one dynamic body, a frictionless "rolling" undercarriage. */
export class Cart {
  constructor(world, { pos, yaw = 0 }) {
    this.world = world;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const bars = [];
    const top = FLOOR + WALL;
    const hw = W / 2;
    const hl = L / 2;
    // Basket rim and floor frame
    const corners = (y, s = 1) => [v(-hw * s, y, -hl), v(hw * s, y, -hl), v(hw * s, y, hl), v(-hw * s, y, hl)];
    for (const [y, s] of [[top, 1], [FLOOR, 0.92]]) {
      const c = corners(y, s);
      for (let i = 0; i < 4; i++) bars.push(bar(c[i], c[(i + 1) % 4], 0.016));
    }
    // Verticals and wire grid on the sides
    for (let z = -hl; z <= hl + 1e-6; z += L / 8) {
      for (const sx of [-1, 1]) bars.push(bar(v(sx * hw * 0.92, FLOOR, z), v(sx * hw, top, z)));
    }
    for (let x = -hw; x <= hw + 1e-6; x += W / 6) {
      for (const sz of [-1, 1]) bars.push(bar(v(x * 0.92, FLOOR, sz * hl), v(x, top, sz * hl)));
      bars.push(bar(v(x * 0.92, FLOOR, -hl), v(x * 0.92, FLOOR, hl), 0.01));
    }
    for (const y of [FLOOR + WALL * 0.5]) {
      const c = corners(y, 0.96);
      for (let i = 0; i < 4; i++) bars.push(bar(c[i], c[(i + 1) % 4], 0.01));
    }
    // Chassis legs down to the casters, and the push handle
    for (const [x, z] of [[-hw * 0.8, -hl * 0.9], [hw * 0.8, -hl * 0.9], [-hw * 0.8, hl * 0.9], [hw * 0.8, hl * 0.9]]) {
      bars.push(bar(v(x, WHEEL_R * 2, z), v(x * 1.05, FLOOR, z), 0.018));
    }
    bars.push(bar(v(-hw * 0.8, WHEEL_R * 2, -hl * 0.9), v(-hw * 0.8, WHEEL_R * 2, hl * 0.9), 0.018));
    bars.push(bar(v(hw * 0.8, WHEEL_R * 2, -hl * 0.9), v(hw * 0.8, WHEEL_R * 2, hl * 0.9), 0.018));
    bars.push(bar(v(-hw, top, -hl), v(-hw, top + 0.18, -hl - 0.22), 0.016));
    bars.push(bar(v(hw, top, -hl), v(hw, top + 0.18, -hl - 0.22), 0.016));
    const frameGeo = mergeGeometries(bars);
    bars.forEach((g) => g.dispose());
    world.disposables.push(frameGeo);

    const g = new THREE.Group();
    const frame = new THREE.Mesh(frameGeo, Mat.steel());
    frame.castShadow = true;
    g.add(frame);
    const handle = world.mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.08, 12), 'steelRed');
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, top + 0.18, -hl - 0.22);
    g.add(handle);
    const seat = world.mesh(new RoundedBoxGeometry(W - 0.1, SEAT_H, 0.4, 2, 0.04), 'steelOrange');
    seat.position.set(0, FLOOR + 0.03 + SEAT_H / 2, -hl + 0.24);
    g.add(seat);
    const tray = world.mesh(new THREE.BoxGeometry(W * 0.7, 0.02, L * 0.85), 'darkSteel');
    tray.position.y = WHEEL_R * 2 + 0.02;
    g.add(tray);
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.05, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    world.disposables.push(wheelGeo);
    for (const [x, z] of [[-hw * 0.8, -hl * 0.9], [hw * 0.8, -hl * 0.9], [-hw * 0.8, hl * 0.9], [hw * 0.8, hl * 0.9]]) {
      const wh = new THREE.Mesh(wheelGeo, Mat.rubber());
      wh.position.set(x, WHEEL_R, z);
      wh.castShadow = true;
      g.add(wh);
      this.wheels.push(wh);
    }
    world.add(g);
    this.group = g;

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    // Rides its track kinematically; becomes a free rigid body once it leaves it.
    this.body = world.physics.createBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(...pos)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.02)
        .setAngularDamping(0.4),
    );
    const info = { kind: 'cart', material: 'metal', cart: this };
    const col = (desc) =>
      world.physics.createCollider(
        desc
          .setCollisionGroups(groups(Group.PROP))
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS | RAPIER.ActiveEvents.COLLISION_EVENTS)
          .setContactForceEventThreshold(400),
        this.body,
        info,
      );
    const t = 0.03;
    col(RAPIER.ColliderDesc.cuboid(hw, t, hl).setTranslation(0, FLOOR, 0).setMass(10).setFriction(0.9));
    col(RAPIER.ColliderDesc.cuboid(t, WALL / 2, hl).setTranslation(-hw, FLOOR + WALL / 2, 0).setMass(2).setFriction(0.4));
    col(RAPIER.ColliderDesc.cuboid(t, WALL / 2, hl).setTranslation(hw, FLOOR + WALL / 2, 0).setMass(2).setFriction(0.4));
    col(RAPIER.ColliderDesc.cuboid(hw, WALL / 2, t).setTranslation(0, FLOOR + WALL / 2, -hl).setMass(2).setFriction(0.4));
    // Low front lip so legs can hang over it.
    col(RAPIER.ColliderDesc.cuboid(hw, 0.12, t).setTranslation(0, FLOOR + 0.12, hl).setMass(1.5).setFriction(0.4));
    col(RAPIER.ColliderDesc.cuboid(hw * 0.8, 0.03, hl * 0.9).setTranslation(0, WHEEL_R * 2, 0).setMass(38));
    col(RAPIER.ColliderDesc.cuboid(hw - 0.05, SEAT_H / 2, 0.2).setTranslation(0, FLOOR + 0.03 + SEAT_H / 2, -hl + 0.24).setMass(2).setFriction(0.9));
    for (const [x, z] of [[-hw * 0.8, -hl * 0.9], [hw * 0.8, -hl * 0.9], [-hw * 0.8, hl * 0.9], [hw * 0.8, hl * 0.9]]) {
      col(
        RAPIER.ColliderDesc.ball(WHEEL_R)
          .setTranslation(x, WHEEL_R, z)
          .setFriction(0)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(0.05)
          .setMass(1.5),
      );
    }
    world.physics.link(this.body, g);
    this.spin = 0;
  }

  /** Seat position for the dummy root (feet origin) in world space. */
  seat() {
    const hl = L / 2;
    const t = this.body.translation();
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    // Root height that puts the pelvis on the seat (pelvis centre sits 0.93 above the root).
    return new THREE.Vector3(0, FLOOR + 0.03 + SEAT_H + 0.1 - 0.93, -hl + 0.22).applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z));
  }

  /** Straps the dummy's pelvis to the seat until `unbuckle()`. */
  buckle(ragdoll) {
    const hl = L / 2;
    const data = RAPIER.JointData.fixed(
      { x: 0, y: FLOOR + 0.03 + SEAT_H + 0.1, z: -hl + 0.22 },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    this.belt = this.world.physics.world.createImpulseJoint(data, this.body, ragdoll.parts.pelvis.body, true);
    this.belt.setContactsEnabled(false);
  }

  unbuckle() {
    if (!this.belt) return;
    this.world.physics.world.removeImpulseJoint(this.belt, true);
    this.belt = null;
  }

  /**
   * While the passenger is strapped in, cart and dummy ignore each other:
   * a limb wedged against a welded, kinematic cart would otherwise feed the
   * solver energy until the whole rig explodes.
   */
  setGhost(on) {
    const g = on ? groups(Group.PROP, Group.ALL & ~Group.DUMMY) : groups(Group.PROP);
    for (let i = 0; i < this.body.numColliders(); i++) this.body.collider(i).setCollisionGroups(g);
  }

  /** Moves the (kinematic) cart to a pose on its track for the next step. */
  place(pos, rot) {
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
    this.body.setNextKinematicRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
  }

  /** Hands the cart over to the physics engine with the given velocity. */
  release(vel, spin = { x: 0, y: 0, z: 0 }) {
    if (this.free) return;
    this.free = true;
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    // CCD only once it's free: on a kinematic body it snags on the track's seams.
    this.body.enableCcd(true);
    this.body.setLinvel(vel, true);
    this.body.setAngvel(spin, true);
  }

  forward(out = new THREE.Vector3()) {
    const r = this.body.rotation();
    return out.set(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  }

  speed() {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  update(dt) {
    const v = this.body.linvel();
    const f = this.forward(new THREE.Vector3());
    const along = v.x * f.x + v.y * f.y + v.z * f.z;
    this.spin += (along / WHEEL_R) * dt;
    for (const w of this.wheels) w.rotation.x = this.spin;
  }
}
