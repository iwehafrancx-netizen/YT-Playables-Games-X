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

const HEAD_R = 0.128;
// A satin finish, like a stunt suit, so the muscle shapes read.
const BODY_ROUGH = 0.45;
const HAIR = '#3a281d';

// Hands and feet: how far they flop (radians) and how springy the flop is.
const HAND_FLOP = 0.9;
const FOOT_FLOP = 0.35;
const FLOP_K = 160;
const FLOP_C = 11;
// Pupils: how far they roll and how loosely they're held.
const PUPIL_RANGE = 0.4;
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

/**
 * A limb with some muscle to it: round ends of radius `top` and `bottom`,
 * `len` apart, swelling to `mid` at `at` (0 = bottom end, 1 = top end).
 */
function limb(top, bottom, len, mid = (top + bottom) / 2, at = 0.5) {
  return geo(`limb:${top}:${bottom}:${len}:${mid}:${at}`, () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(1e-4, bottom * Math.cos(a)), -len / 2 + bottom * Math.sin(a)));
    }
    // Smooth swell along the shaft: bottom → mid → top.
    for (let i = 1; i < 12; i++) {
      const k = i / 12;
      const r = k < at ? bottom + (mid - bottom) * Math.sin((k / at) * (Math.PI / 2)) : top + (mid - top) * Math.sin(((1 - k) / (1 - at)) * (Math.PI / 2));
      pts.push(new THREE.Vector2(r, -len / 2 + k * len));
    }
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(1e-4, top * Math.cos(a)), len / 2 + top * Math.sin(a)));
    }
    return new THREE.LatheGeometry(pts, 22);
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

/** A person in a one-colour stunt suit that follows a Ragdoll's bodies. */
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
        // Shoulder to elbow, with a bicep.
        g.add(part(limb(0.058, 0.046, 0.23, 0.064, 0.55), body));
        g.add(part(ball(0.06), body, 0, hh));
      } else if (name.startsWith('lowerArm')) {
        // Forearm thick below the elbow, narrow at the wrist.
        g.add(part(limb(0.05, 0.036, 0.21, 0.054, 0.75), body));
        g.add(part(ball(0.05), body, 0, hh));
        const left = name.endsWith('L');
        const hand = new THREE.Group();
        const palm = part(geo('palm', () => new RoundedBoxGeometry(0.04, 0.085, 0.08, 3, 0.017)), body, 0, -0.06);
        const fingers = part(geo('fingers', () => new RoundedBoxGeometry(0.034, 0.065, 0.074, 3, 0.015)), body, 0.006 * (left ? 1 : -1), -0.125, 0.004);
        fingers.rotation.z = (left ? -1 : 1) * 0.35;
        const thumb = part(geo('thumb', () => new THREE.CapsuleGeometry(0.014, 0.035, 4, 8)), body, left ? -0.012 : 0.012, -0.065, 0.048);
        thumb.rotation.x = 0.7;
        hand.add(palm, fingers, thumb);
        g.add(this.joint(name, -hh, hand, HAND_FLOP));
      } else if (name.startsWith('thigh')) {
        // Thick at the hip, tapering to the knee.
        g.add(part(limb(0.088, 0.062, 0.33, 0.094, 0.72), body));
        g.add(part(ball(0.066), body, 0, -hh));
      } else if (name.startsWith('shin')) {
        // Calf swelling just below the knee, slim ankle.
        g.add(part(limb(0.058, 0.04, 0.31, 0.068, 0.72), body, 0, 0.01));
        g.add(part(ball(0.062), body, 0, hh));
        const foot = new THREE.Group();
        const y = FOOT.offset[1] + hh;
        foot.add(part(geo('shoe', () => new RoundedBoxGeometry(0.11, 0.08, 0.26, 4, 0.038)), mat(s.trim, 0.55), 0, y + 0.005, FOOT.offset[2] + 0.025));
        foot.add(part(geo('sole', () => new RoundedBoxGeometry(0.114, 0.025, 0.265, 2, 0.01)), mat('#2a2a2e', 0.8), 0, y - 0.035, FOOT.offset[2] + 0.025));
        foot.add(part(ball(0.045), body, 0, y + 0.04, -0.01));
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
    // Narrow waist widening to a broad chest and shoulders.
    g.add(part(trunk('chest', [[0, -0.21], [0.122, -0.2], [0.132, -0.12], [0.155, -0.03], [0.178, 0.06], [0.19, 0.12], [0.165, 0.18], [0.09, 0.212], [0, 0.22]], 0.64), body));
    const delt = geo('delt', () => new THREE.SphereGeometry(0.072, 18, 14).scale(1.05, 0.9, 1));
    g.add(part(delt, body, 0.195, 0.12), part(delt, body, -0.195, 0.12));
    const pec = geo('pec', () => new THREE.SphereGeometry(0.075, 16, 12).scale(1.2, 0.75, 0.5));
    g.add(part(pec, body, 0.07, 0.07, 0.085), part(pec, body, -0.07, 0.07, 0.085));
    g.add(part(geo('neck', () => new THREE.CylinderGeometry(0.048, 0.06, 0.14, 16)), body, 0, 0.245));
  }

  buildPelvis(g, body) {
    g.add(part(trunk('pelvis', [[0, -0.11], [0.11, -0.11], [0.15, -0.04], [0.152, 0.04], [0.13, 0.1], [0.06, 0.12], [0, 0.12]], 0.74), body));
    // Belly that bridges the gap to the chest when he folds in half.
    g.add(part(geo('belly', () => new THREE.SphereGeometry(0.13, 22, 16).scale(1, 0.85, 0.72)), body, 0, 0.1));
    const hip = ball(0.088);
    g.add(part(hip, body, 0.088, -0.07), part(hip, body, -0.088, -0.07));
    const seat = geo('seat', () => new THREE.SphereGeometry(0.08, 16, 12).scale(1, 1, 0.8));
    g.add(part(seat, body, 0.065, -0.05, -0.06), part(seat, body, -0.065, -0.05, -0.06));
  }

  buildHead(g, body) {
    // An egg-shaped head with a jaw, short hair, ears, a nose and real eyes.
    this.headMesh = part(geo('head', () => new THREE.SphereGeometry(HEAD_R, 36, 28).scale(0.9, 1.08, 1)), this.faces.smile);
    g.add(this.headMesh);
    g.add(part(geo('jaw', () => new THREE.SphereGeometry(0.085, 20, 14).scale(1, 0.8, 0.95)), body, 0, -0.07, 0.03));
    // Short hair hugging the scalp: back from the forehead, down to the nape.
    const hair = geo('hair', () => new THREE.SphereGeometry(HEAD_R + 0.004, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56).rotateX(-0.62).scale(0.91, 1.09, 1.01));
    g.add(part(hair, mat(HAIR, 0.85), 0, 0.004, -0.004));
    const ear = geo('ear', () => new THREE.SphereGeometry(0.03, 12, 10).scale(0.4, 1, 0.7));
    g.add(part(ear, body, HEAD_R * 0.9, -0.005, -0.01), part(ear, body, -HEAD_R * 0.9, -0.005, -0.01));
    const nose = part(geo('nose', () => new THREE.ConeGeometry(0.02, 0.05, 12)), body, 0, -0.005, HEAD_R + 0.008);
    nose.rotation.x = Math.PI / 2 - 0.2;
    g.add(nose);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const iris = mat('#5a3a22', 0.3);
    const black = mat('#141414', 0.3);
    for (const s of [-1, 1]) {
      const r = 0.026;
      const dir = new THREE.Vector3(s * 0.34, 0.2, 0.92).normalize();
      const eye = part(geo(`eye:${r}`, () => new THREE.SphereGeometry(r, 18, 14)), white);
      eye.position.copy(dir).multiplyScalar(HEAD_R - 0.012);
      const pivot = new THREE.Group();
      pivot.position.copy(eye.position);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      const ring = part(geo('iris', () => new THREE.SphereGeometry(r * 0.55, 14, 10).scale(1, 1, 0.4)), iris, 0, 0, r * 0.82);
      const pupil = part(geo('pupil', () => new THREE.SphereGeometry(r * 0.28, 10, 8).scale(1, 1, 0.4)), black, 0, 0, r * 0.9);
      pivot.add(ring, pupil);
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
