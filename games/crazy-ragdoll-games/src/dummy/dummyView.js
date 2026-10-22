import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PARTS, FOOT } from './ragdoll.js';
import { faceSkin } from '../render/textures.js';

// One solid colour head to toe; `trim` only tints the wardrobe swatch.
export const SUITS = {
  red: { body: '#ef3b36', trim: '#b8231f', label: 'Red' },
  yellow: { body: '#ffc61a', trim: '#d69a00', label: 'Yellow' },
  green: { body: '#35c24a', trim: '#1f8a31', label: 'Green' },
  blue: { body: '#2f7de1', trim: '#1c56a6', label: 'Blue' },
  purple: { body: '#9b5de5', trim: '#6c37b0', label: 'Purple' },
  pink: { body: '#ff5ca8', trim: '#d8337f', label: 'Pink' },
};

const HEAD_R = 0.145;
// Glossy like a rubber toy, so the curves read.
const BODY_ROUGH = 0.32;

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
function faces(color) {
  if (!faceCache.has(color)) {
    const make = (mood) => new THREE.MeshStandardMaterial({ map: faceSkin(color, mood), roughness: BODY_ROUGH });
    faceCache.set(color, { smile: make('smile'), yell: make('yell'), dizzy: make('dizzy') });
  }
  return faceCache.get(color);
}

function ball(r) {
  return geo(`ball:${r}`, () => new THREE.SphereGeometry(r, 18, 14));
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
  constructor(scene, physics, ragdoll, suit = 'red') {
    this.scene = scene;
    this.ragdoll = ragdoll;
    this.root = new THREE.Group();
    this.meshes = {};
    this.flops = [];
    this.eyes = [];
    this.t = 0;
    const s = SUITS[suit] ?? SUITS.red;
    const body = mat(s.body, BODY_ROUGH);
    this.faces = faces(s.body);

    // Every piece is the same colour and overlaps its neighbours at the
    // joints, so he reads as one smooth rubbery body rather than parts.
    for (const name of Object.keys(PARTS)) {
      const g = new THREE.Group();
      const hh = PARTS[name].hh;
      if (name === 'chest') this.buildChest(g, body);
      else if (name === 'pelvis') this.buildPelvis(g, body);
      else if (name === 'head') this.buildHead(g, body);
      else if (name.startsWith('upperArm')) {
        g.add(part(limb(0.064, 0.054, 0.23), body));
        g.add(part(ball(0.066), body, 0, hh));
      } else if (name.startsWith('lowerArm')) {
        g.add(part(limb(0.056, 0.048, 0.21), body));
        g.add(part(ball(0.057), body, 0, hh));
        const hand = new THREE.Group();
        hand.add(part(geo('mitt', () => new THREE.SphereGeometry(0.066, 18, 14).scale(0.95, 1.15, 0.72)), body, 0, -0.055));
        hand.add(part(geo('thumb', () => new THREE.SphereGeometry(0.024, 12, 10).scale(1, 1.4, 1)), body, 0, -0.03, 0.04));
        g.add(this.joint(name, -hh, hand, HAND_FLOP));
      } else if (name.startsWith('thigh')) {
        g.add(part(limb(0.092, 0.072, 0.33), body));
        g.add(part(ball(0.092), body, 0, hh));
      } else if (name.startsWith('shin')) {
        g.add(part(limb(0.072, 0.056, 0.3), body, 0, 0.02));
        g.add(part(ball(0.073), body, 0, hh));
        const foot = new THREE.Group();
        const y = FOOT.offset[1] + hh;
        foot.add(part(geo('foot', () => new RoundedBoxGeometry(0.13, 0.09, 0.27, 4, 0.045)), body, 0, y, FOOT.offset[2] + 0.02));
        foot.add(part(ball(0.05), body, 0, y + 0.03, 0));
        g.add(this.joint(name, -hh, foot, FOOT_FLOP));
      }
      this.meshes[name] = g;
      this.root.add(g);
      physics.link(ragdoll.parts[name].body, g);
    }
    scene.add(this.root);
    this.mood = 'smile';
    this.moodHold = 0;
  }

  buildChest(g, body) {
    g.add(part(trunk('chest', [[0, -0.21], [0.13, -0.2], [0.15, -0.12], [0.165, 0], [0.175, 0.09], [0.165, 0.15], [0.13, 0.195], [0.06, 0.215], [0, 0.22]], 0.7), body));
    const cap = ball(0.07);
    g.add(part(cap, body, 0.18, 0.13), part(cap, body, -0.18, 0.13));
    g.add(part(geo('neck', () => new THREE.CylinderGeometry(0.05, 0.058, 0.13, 16)), body, 0, 0.245));
  }

  buildPelvis(g, body) {
    g.add(part(trunk('pelvis', [[0, -0.11], [0.11, -0.11], [0.155, -0.04], [0.16, 0.04], [0.14, 0.1], [0.06, 0.12], [0, 0.12]], 0.74), body));
    // Belly that bridges the gap to the chest when he folds in half.
    g.add(part(geo('belly', () => new THREE.SphereGeometry(0.14, 22, 16).scale(1, 0.85, 0.75)), body, 0, 0.1));
    const hip = ball(0.09);
    g.add(part(hip, body, 0.09, -0.07), part(hip, body, -0.09, -0.07));
  }

  buildHead(g, body) {
    this.headMesh = part(geo('head', () => new THREE.SphereGeometry(HEAD_R, 36, 28)), this.faces.smile);
    g.add(this.headMesh);
    // A curl of hair on top, big ears that stick out, and a round clown nose.
    const curl = part(geo('curl', () => new THREE.TorusGeometry(0.028, 0.012, 8, 16, Math.PI * 1.5)), body, 0.01, HEAD_R + 0.02, 0.01);
    curl.rotation.set(0, Math.PI / 2, 0.6);
    g.add(curl);
    const ear = geo('ear', () => new THREE.SphereGeometry(0.045, 14, 12).scale(0.45, 1, 0.8));
    const earL = part(ear, body, HEAD_R + 0.005, 0, -0.01);
    const earR = part(ear, body, -HEAD_R - 0.005, 0, -0.01);
    earL.rotation.z = -0.35;
    earR.rotation.z = 0.35;
    g.add(earL, earR);
    g.add(part(geo('nose', () => new THREE.SphereGeometry(0.036, 16, 12)), mat('#ff7a7a', 0.25), 0, -0.01, HEAD_R + 0.012));
    // Big googly eyes, one a bit bigger than the other; the pupils roll loose.
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.08 });
    const black = mat('#141414', 0.3);
    for (const s of [-1, 1]) {
      const r = s < 0 ? 0.058 : 0.068;
      const dir = new THREE.Vector3(s * 0.33, 0.34, 0.88).normalize();
      const eye = part(geo(`eye:${r}`, () => new THREE.SphereGeometry(r, 22, 18)), white);
      eye.position.copy(dir).multiplyScalar(HEAD_R - 0.004);
      const pivot = new THREE.Group();
      pivot.position.copy(eye.position);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      const pupil = part(geo(`pupil:${r}`, () => new THREE.SphereGeometry(r * 0.42, 14, 10).scale(1, 1, 0.45)), black, 0, 0, r * 0.9);
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
