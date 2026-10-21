import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PARTS, FOOT } from './ragdoll.js';
import { headSkin } from '../render/textures.js';
import { Mat } from '../render/materials.js';

export const SUITS = {
  classic: { body: '#ef4b3c', trim: '#1f2229', label: 'Crazy Red' },
  orange: { body: '#ff9f1c', trim: '#24262b', label: 'Tangerine' },
  blue: { body: '#3c86e8', trim: '#1f2229', label: 'Sky Blue' },
  mint: { body: '#2ec4b6', trim: '#1f2a28', label: 'Teal' },
  red: { body: '#9b5de5', trim: '#22232a', label: 'Grape' },
  white: { body: '#ff5ca8', trim: '#2a2c31', label: 'Bubblegum' },
};

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

// Hands and feet: how far they flop (radians) and how springy the flop is.
const HAND_FLOP = 0.9;
const FOOT_FLOP = 0.35;
const FLOP_K = 160;
const FLOP_C = 11;
const _w = new THREE.Vector3();
const _iq = new THREE.Quaternion();

const skinCache = new Map();
function skins(color) {
  if (!skinCache.has(color)) {
    const make = (mood) => new THREE.MeshStandardMaterial({ map: headSkin(color, mood), roughness: 0.38, metalness: 0.05 });
    skinCache.set(color, {
      body: new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 }),
      calm: make('calm'),
      dizzy: make('dizzy'),
    });
  }
  return skinCache.get(color);
}

const trimCache = new Map();
function trimMat(color) {
  if (!trimCache.has(color)) trimCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.45 }));
  return trimCache.get(color);
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Visual crash-test dummy that follows a Ragdoll's bodies. */
export class DummyView {
  constructor(scene, physics, ragdoll, suit = 'classic') {
    this.scene = scene;
    this.ragdoll = ragdoll;
    this.root = new THREE.Group();
    this.meshes = {};
    this.flops = [];
    this.t = 0;
    const s = SUITS[suit] ?? SUITS.classic;
    const skin = skins(s.body);
    this.skin = skin;
    const trim = trimMat(s.trim);

    for (const [name, def] of Object.entries(PARTS)) {
      const g = new THREE.Group();
      if (def.shape === 'box') {
        const [hx, hy, hz] = def.half;
        const body = geo(`box:${name}`, () => new RoundedBoxGeometry(hx * 2, hy * 2, hz * 2, 3, 0.045));
        g.add(shadowed(new THREE.Mesh(body, skin.body)));
        if (name === 'chest') {
          const plate = geo('marker', () => new THREE.CircleGeometry(0.065, 24));
          for (const z of [hz + 0.002, -hz - 0.002]) {
            const m = new THREE.Mesh(plate, Mat.marker());
            m.position.set(0.06, 0.06, z);
            if (z < 0) m.rotation.y = Math.PI;
            g.add(m);
          }
          // Shoulder yoke and neck ring
          const yoke = geo('yoke', () => new THREE.CylinderGeometry(0.04, 0.04, hx * 2 + 0.06, 12));
          const y = new THREE.Mesh(yoke, trim);
          y.rotation.z = Math.PI / 2;
          y.position.y = hy - 0.05;
          g.add(shadowed(y));
          const neck = geo('neck', () => new THREE.CylinderGeometry(0.045, 0.055, 0.12, 14));
          const n = new THREE.Mesh(neck, trim);
          n.position.y = hy + 0.04;
          g.add(shadowed(n));
        } else {
          const belt = geo('belt', () => new RoundedBoxGeometry(hx * 2 + 0.012, 0.05, hz * 2 + 0.012, 2, 0.02));
          const b = new THREE.Mesh(belt, trim);
          b.position.y = hy - 0.03;
          g.add(shadowed(b));
          const hip = geo('hipball', () => new THREE.SphereGeometry(0.06, 16, 12));
          for (const x of [-0.09, 0.09]) {
            const h = new THREE.Mesh(hip, trim);
            h.position.set(x, -hy + 0.02, 0);
            g.add(shadowed(h));
          }
        }
      } else if (def.shape === 'ball') {
        const head = geo('head', () => new THREE.SphereGeometry(def.r, 32, 24));
        this.headMesh = shadowed(new THREE.Mesh(head, skin.calm));
        this.headMesh.rotation.y = 0;
        g.add(this.headMesh);
      } else {
        const limb = geo(`cap:${def.hh}:${def.r}`, () => new THREE.CapsuleGeometry(def.r, def.hh * 2, 6, 16));
        g.add(shadowed(new THREE.Mesh(limb, skin.body)));
        const jointBall = geo(`joint:${def.r}`, () => new THREE.SphereGeometry(def.r * 1.12, 14, 10));
        const top = new THREE.Mesh(jointBall, trim);
        top.position.y = def.hh;
        g.add(shadowed(top));
        if (name.startsWith('lowerArm')) {
          const hand = geo('hand', () => new THREE.SphereGeometry(0.052, 14, 10));
          const h = new THREE.Mesh(hand, trim);
          h.position.y = -0.03;
          h.scale.set(1, 1.15, 0.8);
          g.add(this.joint(name, -def.hh, shadowed(h), HAND_FLOP));
        }
        if (def.foot) {
          const foot = geo('foot', () => new RoundedBoxGeometry(FOOT.half[0] * 2 + 0.01, FOOT.half[1] * 2, FOOT.half[2] * 2 + 0.01, 2, 0.025));
          const f = new THREE.Mesh(foot, trim);
          f.position.set(FOOT.offset[0], FOOT.offset[1] + def.hh, FOOT.offset[2]);
          g.add(this.joint(name, -def.hh, shadowed(f), FOOT_FLOP));
        }
      }
      this.meshes[name] = g;
      this.root.add(g);
      physics.link(ragdoll.parts[name].body, g);
    }
    scene.add(this.root);
    this.dizzy = false;
    this.dizzyHold = 0;
  }

  /** A wrist or ankle: the hand or foot hangs off it and flops with the limb's motion. */
  joint(part, y, mesh, range) {
    const pivot = new THREE.Group();
    pivot.position.y = y;
    pivot.add(mesh);
    this.flops.push({ pivot, part, range, ax: 0, az: 0, vx: 0, vz: 0, ph: Math.random() * 6 });
    return pivot;
  }

  /** Springs each hand and foot against the spin of the bone it hangs from. */
  flop(dt) {
    this.t += dt;
    const step = Math.min(dt, 1 / 30);
    const life = this.ragdoll.lively;
    for (const f of this.flops) {
      const part = this.ragdoll.parts[f.part];
      if (!part) continue;
      const w = part.body.angvel();
      _w.set(w.x, w.y, w.z).applyQuaternion(_iq.copy(this.meshes[f.part].quaternion).invert());
      const wiggle = Math.sin(this.t * 5 + f.ph) * 0.12 * life * f.range;
      const tx = THREE.MathUtils.clamp(-_w.x * 0.07 + wiggle, -f.range, f.range);
      const tz = THREE.MathUtils.clamp(-_w.z * 0.07, -f.range, f.range);
      f.vx += ((tx - f.ax) * FLOP_K - f.vx * FLOP_C) * step;
      f.vz += ((tz - f.az) * FLOP_K - f.vz * FLOP_C) * step;
      f.ax += f.vx * step;
      f.az += f.vz * step;
      f.pivot.rotation.set(f.ax, 0, f.az);
    }
  }

  /** Swaps to X-eyes while the dummy is tumbling or knocked out. */
  update(dt, forceDizzy = false) {
    this.flop(dt);
    const head = this.ragdoll.parts.head;
    if (!head) return;
    const w = head.body.angvel();
    const spin = Math.hypot(w.x, w.y, w.z);
    if (forceDizzy || spin > 7 || this.ragdoll.muscle < 0.15) this.dizzyHold = 0.6;
    else this.dizzyHold -= dt;
    const dizzy = this.dizzyHold > 0;
    if (dizzy !== this.dizzy) {
      this.dizzy = dizzy;
      this.headMesh.material = dizzy ? this.skin.dizzy : this.skin.calm;
    }
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
