import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { Mat } from '../render/materials.js';
import { drawMarker } from '../render/textures.js';

const WHEEL_R = 0.34;
const SEAT_Y = 0.5; // top of the seat cushion, from the bottom of the tyres
const SEAT_Z = -0.35;

let doorTex = null;
/** Door decal: the crash-test calibration marker over a hazard band. */
function doorDecal() {
  if (doorTex) return doorTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  drawMarker(ctx, 128, 64, 50);
  ctx.fillStyle = '#16161a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TEST', 40, 72);
  ctx.fillText('CAR', 216, 72);
  doorTex = new THREE.CanvasTexture(c);
  doorTex.colorSpace = THREE.SRGBColorSpace;
  return doorTex;
}

/**
 * Crash-test hatchback. Drives kinematically down its runway; once it hits
 * something it becomes a free rigid body and the passenger keeps going.
 */
export class Car {
  constructor(world, { pos, color = 0xeeeeea }) {
    this.world = world;
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.15 });
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      world.disposables.push(geo);
      g.add(m);
      return m;
    };
    // Lower body, bonnet and the glasshouse
    add(new RoundedBoxGeometry(1.8, 0.62, 3.9, 3, 0.18), paint, 0, 0.62, 0);
    // Open glasshouse: roof on pillars, so the passenger is visible inside.
    add(new RoundedBoxGeometry(1.62, 0.07, 1.75, 2, 0.03), paint, 0, 1.6, -0.55);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.07, 0.68, 0.1), paint, s * 0.77, 1.25, -1.38);
      add(new THREE.BoxGeometry(0.07, 0.68, 0.08), paint, s * 0.77, 1.25, -0.45);
      add(new THREE.BoxGeometry(0.07, 0.07, 0.75), paint, s * 0.77, 1.25, 0.65).rotation.x = 0.85;
    }
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fc6d6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });
    add(new THREE.BoxGeometry(1.5, 0.78, 0.03), glass, 0, 1.24, 0.62).rotation.x = 0.72;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.6, 1.8), glass, s * 0.78, 1.25, -0.5);
    // Bumpers, lights and the plate
    add(new RoundedBoxGeometry(1.86, 0.2, 0.22, 2, 0.06), Mat.darkSteel(), 0, 0.42, 1.95);
    add(new RoundedBoxGeometry(1.86, 0.2, 0.22, 2, 0.06), Mat.darkSteel(), 0, 0.42, -1.95);
    const lamp = new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xfff1b8, emissiveIntensity: 0.6 });
    const tail = new THREE.MeshStandardMaterial({ color: 0xc8261c, emissive: 0x7a0f08, emissiveIntensity: 0.5 });
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.34, 0.12, 0.04), lamp, s * 0.62, 0.78, 1.96);
      add(new THREE.BoxGeometry(0.3, 0.12, 0.04), tail, s * 0.64, 0.8, -1.96);
    }
    // Crash-test decals on both doors
    const decalMat = new THREE.MeshBasicMaterial({ map: doorDecal(), transparent: true });
    for (const s of [-1, 1]) {
      const d = add(new THREE.PlaneGeometry(1.2, 0.6), decalMat, s * 0.905, 0.68, -0.2);
      d.rotation.y = (s * Math.PI) / 2;
      d.castShadow = false;
    }
    // Seat
    add(new RoundedBoxGeometry(0.6, 0.18, 0.55, 2, 0.06), Mat.rubber(), 0, SEAT_Y - 0.09, SEAT_Z);
    add(new RoundedBoxGeometry(0.6, 0.7, 0.14, 2, 0.06), Mat.rubber(), 0, SEAT_Y + 0.3, SEAT_Z - 0.32).rotation.x = -0.15;
    // Wheels
    this.wheels = [];
    const tyre = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.24, 24);
    tyre.rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(WHEEL_R * 0.6, WHEEL_R * 0.6, 0.26, 12);
    rim.rotateZ(Math.PI / 2);
    world.disposables.push(tyre, rim);
    for (const [x, z] of [[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.25], [0.82, -1.25]]) {
      const wg = new THREE.Group();
      const t = new THREE.Mesh(tyre, Mat.rubber());
      t.castShadow = true;
      const r = new THREE.Mesh(rim, Mat.steel());
      wg.add(t, r);
      wg.position.set(x, WHEEL_R, z);
      g.add(wg);
      this.wheels.push(wg);
    }
    world.add(g);
    this.group = g;

    this.body = world.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...pos).setAngularDamping(0.3));
    const info = { kind: 'cart', material: 'metal', car: this };
    const col = (desc) =>
      world.physics.createCollider(
        desc
          .setCollisionGroups(groups(Group.PROP, Group.ALL & ~Group.DUMMY))
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS | RAPIER.ActiveEvents.COLLISION_EVENTS)
          .setContactForceEventThreshold(800)
          .setFriction(0.6),
        this.body,
        info,
      );
    col(RAPIER.ColliderDesc.cuboid(0.9, 0.31, 1.95).setTranslation(0, 0.62, 0).setMass(700));
    col(RAPIER.ColliderDesc.cuboid(0.8, 0.32, 0.95).setTranslation(0, 1.25, -0.5).setMass(150));
    for (const [x, z] of [[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.25], [0.82, -1.25]]) {
      col(RAPIER.ColliderDesc.ball(WHEEL_R).setTranslation(x, WHEEL_R, z).setMass(20).setFriction(0.9));
    }
    world.physics.link(this.body, g);
    this.spin = 0;
    this.free = false;
  }

  /** Root position that sits the dummy's pelvis on the seat. */
  seat() {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y + SEAT_Y + 0.1 - 0.93, t.z + SEAT_Z);
  }

  buckle(ragdoll) {
    const data = RAPIER.JointData.fixed({ x: 0, y: SEAT_Y + 0.1, z: SEAT_Z }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    this.belt = this.world.physics.world.createImpulseJoint(data, this.body, ragdoll.parts.pelvis.body, true);
    this.rider = ragdoll;
    ragdoll.setCollisionFilter(Group.ALL & ~(Group.WORLD | Group.PROP));
  }

  unbuckle() {
    if (!this.belt) return;
    this.world.physics.world.removeImpulseJoint(this.belt, true);
    this.belt = null;
    this.rider?.setCollisionFilter(Group.ALL);
  }

  place(z) {
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x, y: t.y, z });
  }

  release(vel) {
    if (this.free) return;
    this.free = true;
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.body.enableCcd(true);
    this.body.setLinvel(vel, true);
  }

  front() {
    return this.body.translation().z + 2.05;
  }

  update(dt, speed) {
    this.spin += (speed / WHEEL_R) * dt;
    for (const w of this.wheels) w.rotation.x = this.spin;
  }
}
