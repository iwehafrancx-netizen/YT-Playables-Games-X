import * as THREE from 'three';
import { PARTS } from '../dummy/ragdoll.js';

const D2R = Math.PI / 180;
const BOW_R = 0.46; // radius of the bow's curve
const BOW_ARC = 2.1; // radians of curve between the tips
const HAND = PARTS.lowerArmL.hh + 0.07; // wrist-to-grip along the forearm
const MIN_AIM = -55 * D2R;
const MAX_AIM = 80 * D2R;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** The bow: a curved stave held at its middle, its tips pointing up and down the forearm's sides. */
function bowGeometry() {
  return new THREE.TorusGeometry(BOW_R, 0.024, 6, 28, BOW_ARC)
    .rotateZ(-Math.PI / 2 - BOW_ARC / 2)
    .translate(0, BOW_R, 0)
    .rotateY(Math.PI / 2);
}

/**
 * A ragdoll with a bow. Stands balanced on its spot facing `side` (+1 looks
 * along +x), aims by bending its arms toward the shot, and goes floppy for
 * good when its health runs out. The scene drives it: `aim` while the shot is
 * being lined up, `release` to let go, `jump` to dodge.
 */
export class Archer {
  constructor(scene, { position, side = 1, suit, hp = 100, stamina = 100, team = 'player', look = {} }) {
    this.scene = scene;
    this.side = side;
    this.team = team;
    this.suit = suit ?? scene.game.save.data.suit;
    this.maxHp = hp;
    this.hp = hp;
    this.maxStamina = stamina;
    this.stamina = stamina;
    this.alive = true;
    this.angle = 12 * D2R;
    this.draw = 0;
    this.home = new THREE.Vector3(...position);
    const d = scene.spawnDummy({ position, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, pose: 'stand', muscle: 1, suit: this.suit });
    d.balance = 1;
    d.lively = 0.2;
    d.archer = this;
    this.dummy = d;
    this.bowHand = 'lowerArmR';
    this.drawHand = 'lowerArmL';
    this.buildBow(scene);
    if (look.helmet) this.helmet(scene, look.helmet);
    this.aim(this.angle, 0);
  }

  get handles() {
    return this.dummy.ragdoll.handles;
  }

  buildBow(scene) {
    const geo = (scene.bowGeo ??= bowGeometry());
    const mat = (scene.bowMat ??= new THREE.MeshStandardMaterial({ color: 0xf2a91a, roughness: 0.4, metalness: 0.15 }));
    if (!scene.bowShared) {
      scene.bowShared = true;
      scene.world.disposables.push(geo, mat);
    }
    this.bow = new THREE.Mesh(geo, mat);
    this.bow.castShadow = true;
    this.bow.position.y = -HAND;
    this.dummy.view.meshes[this.bowHand].add(this.bow);
    const line = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    this.string = new THREE.Line(line, (scene.stringMat ??= new THREE.LineBasicMaterial({ color: 0xfff6e0 })));
    this.string.frustumCulled = false;
    scene.world.add(this.string);
    scene.world.disposables.push(line);
    // The arrow sitting on the string while he draws.
    this.nocked = new THREE.Mesh(scene.arrows.geo, scene.arrows.mat);
    scene.world.add(this.nocked);
  }

  helmet(scene, color) {
    const geo = (scene.helmetGeo ??= new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55));
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
    scene.world.disposables.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 0.035;
    m.castShadow = true;
    this.dummy.view.meshes.head.add(m);
  }

  /** Points the bow `angle` radians above level (toward its side) with the string `draw` (0–1) pulled back. */
  aim(angle, draw) {
    if (!this.alive) return;
    this.angle = THREE.MathUtils.clamp(angle, MIN_AIM, MAX_AIM);
    this.draw = draw;
    const up = this.angle / D2R;
    const lift = -(90 + up);
    this.dummy.ragdoll.setCustomPose({
      shoulderR: [lift, 0, -8],
      elbowR: [-4, 0, 0],
      shoulderL: [lift + 6, 0, 22 + draw * 18],
      elbowL: [-(70 + draw * 75), 0, 0],
      neck: [-up * 0.45, 0, 0],
      waist: [4, 0, 0],
      hipL: [-14, 0, 8],
      hipR: [10, 0, -8],
      kneeL: [16, 0, 0],
      kneeR: [6, 0, 0],
    });
  }

  /** World direction of the shot as aimed. */
  aimDir(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.angle) * this.side, Math.sin(this.angle), 0);
  }

  /** Where arrows leave from: just ahead of the bow hand, at shoulder height. */
  muzzle(out = new THREE.Vector3()) {
    const chest = this.dummy.partPosition('chest', out);
    return chest.add(_a.set(0, 0.15, 0)).addScaledVector(this.aimDir(_b), 0.75);
  }

  canAfford(cost) {
    return this.stamina >= cost;
  }

  spend(cost) {
    this.stamina = Math.max(0, this.stamina - cost);
  }

  grounded() {
    const pel = this.dummy.parts.pelvis.body.translation();
    const handles = this.handles;
    const hit = this.scene.physics.castRay({ x: pel.x, y: pel.y, z: pel.z }, { x: 0, y: -1, z: 0 }, 1.4, (c) => !handles.has(c.handle));
    return hit && hit.distance < 1.15;
  }

  jump(power = 6.5) {
    if (!this.alive || !this.grounded()) return false;
    this.dummy.ragdoll.addVelocity({ x: 0, y: power, z: 0 });
    return true;
  }

  /** Takes `amount` damage; returns true if that was the end of him. */
  hurt(amount) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp > 0) {
      if (amount >= 18) this.dummy.knockOut(0.25, 0.4);
      return false;
    }
    this.die();
    return true;
  }

  die() {
    this.alive = false;
    this.draw = 0;
    const d = this.dummy;
    d.balance = 0;
    d.lively = 0;
    d.setPose('starfish');
    d.setMuscle(0.06);
    this.nocked.visible = false;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt, regen) {
    if (this.alive) {
      this.stamina = Math.min(this.maxStamina, this.stamina + regen * dt);
      // Keep him on his spot: a gentle pull home so hits rock him but don't walk him off.
      const c = this.dummy.com(_a);
      const dx = this.home.x - c.x;
      if (Math.abs(dx) > 0.12 && this.grounded()) this.dummy.ragdoll.addVelocity({ x: dx * 2 * dt, y: 0, z: 0 });
      // Arrows fly in the z = 0 plane; a damped spring holds him in it.
      const vz = this.dummy.ragdoll.velocity(_b).z;
      this.dummy.ragdoll.addVelocity({ x: 0, y: 0, z: (-c.z * 8 - vz) * Math.min(1, dt * 10) });
    }
    this.drawString();
  }

  /** The string runs tip to tip, or back to the drawing hand while he pulls. */
  drawString() {
    const bow = this.bow;
    bow.updateWorldMatrix(true, false);
    const t = Math.sin(BOW_ARC / 2) * BOW_R;
    const back = BOW_R - Math.cos(BOW_ARC / 2) * BOW_R;
    const top = _a.set(0, back, t).applyMatrix4(bow.matrixWorld);
    const bottom = _b.set(0, back, -t).applyMatrix4(bow.matrixWorld);
    const pos = this.string.geometry.attributes.position;
    const pulling = this.alive && this.draw > 0.05;
    const nock = pulling ? this.dummy.partPosition(this.drawHand, _c) : _c.copy(top).add(bottom).multiplyScalar(0.5);
    pos.setXYZ(0, top.x, top.y, top.z);
    pos.setXYZ(1, nock.x, nock.y, nock.z);
    pos.setXYZ(2, bottom.x, bottom.y, bottom.z);
    pos.needsUpdate = true;
    this.nocked.visible = pulling;
    if (pulling) {
      const dir = this.aimDir(_a);
      this.nocked.position.copy(nock).addScaledVector(dir, 0.42);
      this.nocked.quaternion.setFromUnitVectors(_b.set(0, 0, 1), dir);
    }
  }
}
