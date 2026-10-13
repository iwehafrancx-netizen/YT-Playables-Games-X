import * as THREE from 'three';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { Mat } from '../render/materials.js';

const D2R = Math.PI / 180;

/** Dummy cannon: turntable base, yoke and a pitching barrel. Only the base collides. */
export class Cannon {
  constructor(world, { pos = [0, 0, 0], yaw = 0, pitch = 35 } = {}) {
    this.world = world;
    this.base = new THREE.Vector3(...pos);
    this.yaw = yaw;
    this.pitch = pitch;
    this.recoil = 0;

    const root = new THREE.Group();
    root.position.copy(this.base);
    const pad = world.mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 32), 'concreteDark');
    pad.position.y = 0.15;
    const stripe = world.mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 48), 'hazard', { cast: false });
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.3;
    root.add(pad, stripe);

    this.turret = new THREE.Group();
    this.turret.position.y = 0.3;
    const ring = world.mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 28), 'darkSteel');
    ring.position.y = 0.17;
    this.turret.add(ring);
    for (const s of [-1, 1]) {
      const cheek = world.mesh(new THREE.BoxGeometry(0.16, 1.1, 0.9), 'steelGrey');
      cheek.position.set(s * 0.62, 0.85, 0);
      const bolt = world.mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 16), 'steel');
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(s * 0.72, 1.15, 0);
      this.turret.add(cheek, bolt);
    }

    this.pivot = new THREE.Group();
    this.pivot.position.y = 1.15;
    this.barrel = new THREE.Group();
    const tube = world.mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.6, 32, 1, true), 'steelRed');
    tube.rotation.x = Math.PI / 2;
    tube.position.z = 0.75;
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 2.5, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, side: THREE.BackSide }),
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.z = 0.78;
    const breech = world.mesh(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), 'steelRed');
    breech.rotation.x = -Math.PI / 2;
    breech.position.z = -0.55;
    const muzzle = world.mesh(new THREE.TorusGeometry(0.43, 0.08, 10, 32), 'hazard');
    muzzle.position.z = 2.05;
    const band = world.mesh(new THREE.TorusGeometry(0.49, 0.05, 8, 32), 'darkSteel');
    band.position.z = -0.1;
    this.barrel.add(tube, inner, breech, muzzle, band);
    this.pivot.add(this.barrel);
    this.turret.add(this.pivot);
    root.add(this.turret);
    world.add(root);
    this.root = root;

    const body = world.fixedBody([pos[0], pos[1] + 0.25, pos[2]], new THREE.Quaternion());
    world.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(0.25, 1.6).setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'static', material: 'metal' },
    );
    this.apply();
  }

  apply() {
    this.turret.rotation.y = this.yaw * D2R;
    this.pivot.rotation.x = -this.pitch * D2R;
    this.barrel.position.z = -this.recoil;
  }

  direction(out = new THREE.Vector3()) {
    const p = this.pitch * D2R;
    const y = this.yaw * D2R;
    return out.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
  }

  muzzle(out = new THREE.Vector3()) {
    const d = this.direction(new THREE.Vector3());
    return out.copy(this.base).add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(d, 2.3);
  }

  update(dt) {
    this.recoil *= Math.exp(-dt * 6);
    this.apply();
  }

  fire() {
    this.recoil = 0.55;
  }
}
