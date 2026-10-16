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
          h.position.y = -def.hh - 0.02;
          h.scale.set(1, 1.15, 0.8);
          g.add(shadowed(h));
        }
        if (def.foot) {
          const foot = geo('foot', () => new RoundedBoxGeometry(FOOT.half[0] * 2 + 0.01, FOOT.half[1] * 2, FOOT.half[2] * 2 + 0.01, 2, 0.025));
          const f = new THREE.Mesh(foot, trim);
          f.position.set(...FOOT.offset);
          g.add(shadowed(f));
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

  /** Swaps to X-eyes while the dummy is tumbling or knocked out. */
  update(dt, forceDizzy = false) {
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
