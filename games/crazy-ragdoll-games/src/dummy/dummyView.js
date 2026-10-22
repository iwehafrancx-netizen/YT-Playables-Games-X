import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PARTS, FOOT } from './ragdoll.js';
import { faceSkin } from '../render/textures.js';

// Outfits: shirt (`body`), shorts (`trim`) and the colour of the sneakers.
export const SUITS = {
  classic: { body: '#ef4b3c', trim: '#2f4f8f', shoes: '#ffd23a', label: 'Crazy Red' },
  orange: { body: '#ff9f1c', trim: '#3d3a6b', shoes: '#3c86e8', label: 'Tangerine' },
  blue: { body: '#3c86e8', trim: '#f2f2f2', shoes: '#ef4b3c', label: 'Sky Blue' },
  mint: { body: '#2ec4b6', trim: '#2e3a59', shoes: '#ff9f1c', label: 'Teal' },
  red: { body: '#9b5de5', trim: '#ffd23a', shoes: '#2ec4b6', label: 'Grape' },
  white: { body: '#ff5ca8', trim: '#5b3fa8', shoes: '#ffffff', label: 'Bubblegum' },
};

const SKIN = '#f2c29b';
const HAIR = 0x5a3825;
const HEAD_R = 0.14;

// Hands and feet: how far they flop (radians) and how springy the flop is.
const HAND_FLOP = 0.9;
const FOOT_FLOP = 0.35;
const FLOP_K = 160;
const FLOP_C = 11;
// Googly pupils: how far they roll and how loosely they're held.
const PUPIL_RANGE = 0.55;
const PUPIL_K = 70;
const PUPIL_C = 3.5;

const _w = new THREE.Vector3();
const _g = new THREE.Vector3();
const _iq = new THREE.Quaternion();

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

/** A tapered limb: round ends of radius `top` and `bottom`, `len` apart. */
function limb(top, bottom, len) {
  return geo(`limb:${top}:${bottom}:${len}`, () => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(1e-4, bottom * Math.cos(a)), -len / 2 + bottom * Math.sin(a)));
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(1e-4, top * Math.cos(a)), len / 2 + top * Math.sin(a)));
    }
    return new THREE.LatheGeometry(pts, 20);
  });
}

/** A rounded trunk piece from a (radius, height) profile, flattened front to back. */
function trunk(key, profile, depth) {
  return geo(key, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 28).scale(1, 1, depth));
}

const matCache = new Map();
function mat(color, rough = 0.6) {
  const key = `${color}:${rough}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
  return matCache.get(key);
}

const faceCache = new Map();
function faces() {
  if (!faceCache.has(SKIN)) {
    const make = (mood) => new THREE.MeshStandardMaterial({ map: faceSkin(SKIN, mood), roughness: 0.6 });
    faceCache.set(SKIN, { smile: make('smile'), yell: make('yell'), dizzy: make('dizzy') });
  }
  return faceCache.get(SKIN);
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = shadowed(new THREE.Mesh(geometry, material));
  m.position.set(x, y, z);
  return m;
}

/** Cartoon person that follows a Ragdoll's bodies: smooth limbs, big googly eyes. */
export class DummyView {
  constructor(scene, physics, ragdoll, suit = 'classic') {
    this.scene = scene;
    this.ragdoll = ragdoll;
    this.root = new THREE.Group();
    this.meshes = {};
    this.flops = [];
    this.eyes = [];
    this.t = 0;
    const s = SUITS[suit] ?? SUITS.classic;
    const skin = mat(SKIN, 0.55);
    const shirt = mat(s.body, 0.7);
    const shorts = mat(s.trim, 0.75);
    const shoe = mat(s.shoes, 0.5);
    const white = mat('#ffffff', 0.6);
    this.faces = faces();

    for (const name of Object.keys(PARTS)) {
      const g = new THREE.Group();
      if (name === 'chest') this.buildChest(g, shirt, skin);
      else if (name === 'pelvis') this.buildPelvis(g, shorts);
      else if (name === 'head') this.buildHead(g, skin);
      else if (name.startsWith('upperArm')) {
        g.add(part(limb(0.05, 0.043, 0.25), skin, 0, -0.01));
        g.add(part(limb(0.06, 0.056, 0.08), shirt, 0, 0.085));
      } else if (name.startsWith('lowerArm')) {
        g.add(part(limb(0.043, 0.036, 0.23), skin));
        const hand = new THREE.Group();
        hand.add(part(geo('palm', () => new THREE.SphereGeometry(0.048, 16, 12).scale(0.95, 1.25, 0.62)), skin, 0, -0.045));
        hand.add(part(geo('thumb', () => new THREE.SphereGeometry(0.02, 10, 8).scale(1, 1.5, 1)), skin, 0, -0.03, 0.035));
        g.add(this.joint(name, -PARTS[name].hh, hand, HAND_FLOP));
      } else if (name.startsWith('thigh')) {
        g.add(part(limb(0.075, 0.058, 0.35), skin));
        g.add(part(limb(0.09, 0.083, 0.15), shorts, 0, 0.1));
      } else if (name.startsWith('shin')) {
        g.add(part(limb(0.058, 0.043, 0.32), skin, 0, 0.02));
        g.add(part(geo('sock', () => new THREE.CylinderGeometry(0.047, 0.045, 0.07, 16)), white, 0, -0.13));
        const foot = new THREE.Group();
        const y = FOOT.offset[1] + PARTS[name].hh;
        foot.add(part(geo('shoe', () => new RoundedBoxGeometry(0.12, 0.085, 0.25, 3, 0.04)), shoe, 0, y + 0.01, FOOT.offset[2] + 0.01));
        foot.add(part(geo('sole', () => new RoundedBoxGeometry(0.126, 0.03, 0.256, 2, 0.012)), white, 0, y - 0.035, FOOT.offset[2] + 0.01));
        g.add(this.joint(name, -PARTS[name].hh, foot, FOOT_FLOP));
      }
      this.meshes[name] = g;
      this.root.add(g);
      physics.link(ragdoll.parts[name].body, g);
    }
    scene.add(this.root);
    this.mood = 'smile';
    this.moodHold = 0;
  }

  buildChest(g, shirt, skin) {
    g.add(part(trunk('chest', [[0, -0.2], [0.14, -0.2], [0.152, -0.12], [0.165, 0], [0.18, 0.1], [0.17, 0.16], [0.12, 0.2], [0.05, 0.21], [0, 0.21]], 0.68), shirt));
    const cap = geo('shoulder', () => new THREE.SphereGeometry(0.06, 16, 12));
    g.add(part(cap, shirt, 0.185, 0.125), part(cap, shirt, -0.185, 0.125));
    g.add(part(geo('neck', () => new THREE.CylinderGeometry(0.046, 0.05, 0.12, 14)), skin, 0, 0.24));
  }

  buildPelvis(g, shorts) {
    g.add(part(trunk('pelvis', [[0, -0.11], [0.12, -0.11], [0.16, -0.03], [0.165, 0.04], [0.15, 0.1], [0.05, 0.115], [0, 0.115]], 0.72), shorts));
  }

  buildHead(g, skin) {
    this.headMesh = part(geo('head', () => new THREE.SphereGeometry(HEAD_R, 32, 24)), this.faces.smile);
    g.add(this.headMesh);
    // Hair: a cap tipped back, plus a tuft that sticks up.
    const hair = mat(HAIR, 0.8);
    const cap = part(geo('hair', () => new THREE.SphereGeometry(HEAD_R * 1.04, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.36)), hair);
    cap.rotation.x = -0.45;
    g.add(cap);
    const tuft = part(geo('tuft', () => new THREE.ConeGeometry(0.035, 0.09, 10)), hair, 0.02, HEAD_R + 0.02, 0.03);
    tuft.rotation.z = -0.4;
    g.add(tuft);
    const ear = geo('ear', () => new THREE.SphereGeometry(0.032, 12, 10).scale(0.5, 1, 0.8));
    g.add(part(ear, skin, HEAD_R, 0, -0.01), part(ear, skin, -HEAD_R, 0, -0.01));
    g.add(part(geo('nose', () => new THREE.SphereGeometry(0.026, 12, 10)), skin, 0, -0.005, HEAD_R + 0.008));
    // Big googly eyes: the pupils roll loose inside the whites.
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.08 });
    const black = mat('#141414', 0.3);
    for (const s of [-1, 1]) {
      const dir = new THREE.Vector3(s * 0.36, 0.3, 0.88).normalize();
      const eye = part(geo('eye', () => new THREE.SphereGeometry(0.05, 20, 16)), white);
      eye.position.copy(dir).multiplyScalar(HEAD_R - 0.01);
      const pivot = new THREE.Group();
      pivot.position.copy(eye.position);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      const pupil = part(geo('pupil', () => new THREE.SphereGeometry(0.024, 14, 10).scale(1, 1, 0.45)), black, 0, 0, 0.044);
      pivot.add(pupil);
      g.add(eye, pivot);
      this.eyes.push({ pivot, base: pivot.quaternion.clone(), ax: 0, ay: 0, vx: 0, vy: 0, side: s });
    }
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
  flop(step) {
    const life = this.ragdoll.lively;
    for (const f of this.flops) {
      const p = this.ragdoll.parts[f.part];
      if (!p) continue;
      const w = p.body.angvel();
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

  /** Pupils sag toward gravity and slosh with the head's spin; dizzy, they whirl. */
  googly(step, dizzy) {
    const head = this.ragdoll.parts.head;
    if (!head) return;
    const q = _iq.copy(this.meshes.head.quaternion).invert();
    const w = head.body.angvel();
    _w.set(w.x, w.y, w.z).applyQuaternion(q);
    _g.set(0, -1, 0).applyQuaternion(q);
    for (const e of this.eyes) {
      let tx, ty;
      if (dizzy) {
        const a = this.t * 11 * e.side;
        tx = Math.sin(a) * PUPIL_RANGE;
        ty = Math.cos(a) * PUPIL_RANGE;
      } else {
        tx = THREE.MathUtils.clamp(-_g.y * 0.35 + _w.x * 0.05, -PUPIL_RANGE, PUPIL_RANGE);
        ty = THREE.MathUtils.clamp(_g.x * 0.35 - _w.y * 0.05, -PUPIL_RANGE, PUPIL_RANGE);
      }
      e.vx += ((tx - e.ax) * PUPIL_K - e.vx * PUPIL_C) * step;
      e.vy += ((ty - e.ay) * PUPIL_K - e.vy * PUPIL_C) * step;
      e.ax = THREE.MathUtils.clamp(e.ax + e.vx * step, -PUPIL_RANGE, PUPIL_RANGE);
      e.ay = THREE.MathUtils.clamp(e.ay + e.vy * step, -PUPIL_RANGE, PUPIL_RANGE);
      e.pivot.quaternion.copy(e.base).multiply(_iq.setFromEuler(new THREE.Euler(e.ax, e.ay, 0)));
    }
  }

  /** Face and eyes follow what's happening to him: grin, scream, or seeing stars. */
  update(dt, forceDizzy = false) {
    this.t += dt;
    const step = Math.min(dt, 1 / 30);
    this.flop(step);
    const head = this.ragdoll.parts.head;
    if (!head) return;
    const w = head.body.angvel();
    const spin = Math.hypot(w.x, w.y, w.z);
    const want = forceDizzy || spin > 7 || this.ragdoll.muscle < 0.15 ? 'dizzy' : this.ragdoll.air > 0.45 ? 'yell' : 'smile';
    this.moodHold -= dt;
    if (want !== this.mood && (this.moodHold <= 0 || want === 'dizzy')) {
      this.mood = want;
      this.moodHold = 0.5;
      this.headMesh.material = this.faces[want];
    }
    this.googly(step, this.mood === 'dizzy');
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
