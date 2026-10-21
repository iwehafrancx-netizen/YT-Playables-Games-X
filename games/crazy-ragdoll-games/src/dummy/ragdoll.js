import { Vector3, Quaternion, Euler } from 'three';
import { RAPIER, Group, groups } from '../physics/physics.js';

const D2R = Math.PI / 180;

// Rest layout in metres: standing, facing +z, soles at y = 0.
export const PARTS = {
  pelvis: { shape: 'box', half: [0.15, 0.09, 0.1], pos: [0, 0.93, 0], mass: 9 },
  chest: { shape: 'box', half: [0.17, 0.19, 0.11], pos: [0, 1.24, 0], mass: 13 },
  head: { shape: 'ball', r: 0.12, pos: [0, 1.61, 0], mass: 4.5 },
  upperArmL: { shape: 'capsule', hh: 0.12, r: 0.05, pos: [0.24, 1.25, 0], mass: 2.2 },
  upperArmR: { shape: 'capsule', hh: 0.12, r: 0.05, pos: [-0.24, 1.25, 0], mass: 2.2 },
  lowerArmL: { shape: 'capsule', hh: 0.11, r: 0.045, pos: [0.24, 0.97, 0], mass: 1.6 },
  lowerArmR: { shape: 'capsule', hh: 0.11, r: 0.045, pos: [-0.24, 0.97, 0], mass: 1.6 },
  thighL: { shape: 'capsule', hh: 0.16, r: 0.07, pos: [0.09, 0.63, 0], mass: 7 },
  thighR: { shape: 'capsule', hh: 0.16, r: 0.07, pos: [-0.09, 0.63, 0], mass: 7 },
  shinL: { shape: 'capsule', hh: 0.16, r: 0.06, pos: [0.09, 0.25, 0], mass: 4, foot: true },
  shinR: { shape: 'capsule', hh: 0.16, r: 0.06, pos: [-0.09, 0.25, 0], mass: 4, foot: true },
};

// Foot box relative to the shin centre.
export const FOOT = { half: [0.05, 0.035, 0.1], offset: [0, -0.215, 0.04] };

// parent, child, world anchor at rest, joint type, bend and twist limits in degrees (spherical only)
export const JOINTS = [
  { name: 'waist', parent: 'pelvis', child: 'chest', at: [0, 1.035, 0], type: 'ball', limit: 45, twist: 40 },
  { name: 'neck', parent: 'chest', child: 'head', at: [0, 1.46, 0], type: 'ball', limit: 50, twist: 70 },
  { name: 'shoulderL', parent: 'chest', child: 'upperArmL', at: [0.24, 1.37, 0], type: 'ball', limit: 170, twist: 80 },
  { name: 'shoulderR', parent: 'chest', child: 'upperArmR', at: [-0.24, 1.37, 0], type: 'ball', limit: 170, twist: 80 },
  { name: 'elbowL', parent: 'upperArmL', child: 'lowerArmL', at: [0.24, 1.105, 0], type: 'hinge', min: -2.5, max: 0 },
  { name: 'elbowR', parent: 'upperArmR', child: 'lowerArmR', at: [-0.24, 1.105, 0], type: 'hinge', min: -2.5, max: 0 },
  { name: 'hipL', parent: 'pelvis', child: 'thighL', at: [0.09, 0.83, 0], type: 'ball', limit: 135, twist: 45 },
  { name: 'hipR', parent: 'pelvis', child: 'thighR', at: [-0.09, 0.83, 0], type: 'ball', limit: 135, twist: 45 },
  { name: 'kneeL', parent: 'thighL', child: 'shinL', at: [0.09, 0.445, 0], type: 'hinge', min: 0, max: 2.5 },
  { name: 'kneeR', parent: 'thighR', child: 'shinR', at: [-0.09, 0.445, 0], type: 'hinge', min: 0, max: 2.5 },
];

const ORDER = ['pelvis', 'chest', 'head', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 'thighL', 'thighR', 'shinL', 'shinR'];

// Joint targets as XYZ euler degrees, relative to the parent.
// Hip/shoulder flex forward is -X, knee bend is +X, elbow bend is -X, arm out to the side is ±Z.
export const POSES = {
  stand: {},
  ready: {
    shoulderL: [-10, 0, 18], shoulderR: [-10, 0, -18], elbowL: [-25, 0, 0], elbowR: [-25, 0, 0],
    hipL: [-12, 0, 2], hipR: [-12, 0, -2], kneeL: [22, 0, 0], kneeR: [22, 0, 0], waist: [6, 0, 0],
  },
  hop: {
    shoulderL: [-20, 0, 55], shoulderR: [-20, 0, -55], elbowL: [-45, 0, 0], elbowR: [-45, 0, 0],
    hipL: [-25, 0, 4], hipR: [-25, 0, -4], kneeL: [40, 0, 0], kneeR: [40, 0, 0],
  },
  sit: {
    hipL: [-88, 0, 6], hipR: [-88, 0, -6], kneeL: [85, 0, 0], kneeR: [85, 0, 0],
    shoulderL: [-40, 0, 12], shoulderR: [-40, 0, -12], elbowL: [-50, 0, 0], elbowR: [-50, 0, 0],
  },
  tuck: {
    hipL: [-95, 0, 8], hipR: [-95, 0, -8], kneeL: [120, 0, 0], kneeR: [120, 0, 0],
    shoulderL: [-70, 0, 20], shoulderR: [-70, 0, -20], elbowL: [-110, 0, 0], elbowR: [-110, 0, 0],
    waist: [20, 0, 0], neck: [15, 0, 0],
  },
  starfish: {
    shoulderL: [0, 0, 100], shoulderR: [0, 0, -100], elbowL: [-10, 0, 0], elbowR: [-10, 0, 0],
    hipL: [0, 0, 28], hipR: [0, 0, -28], kneeL: [10, 0, 0], kneeR: [10, 0, 0],
  },
  cart: {
    hipL: [-118, 0, 12], hipR: [-118, 0, -12], kneeL: [140, 0, 0], kneeR: [140, 0, 0],
    shoulderL: [-55, 0, 18], shoulderR: [-55, 0, -18], elbowL: [-55, 0, 0], elbowR: [-55, 0, 0],
    waist: [8, 0, 0],
  },
  hang: {
    shoulderL: [-165, 0, 12], shoulderR: [-165, 0, -12], elbowL: [-12, 0, 0], elbowR: [-12, 0, 0],
    hipL: [-25, 0, 6], hipR: [-10, 0, -6], kneeL: [45, 0, 0], kneeR: [20, 0, 0],
  },
  cheer: {
    shoulderL: [0, 0, 150], shoulderR: [0, 0, -150], elbowL: [-20, 0, 0], elbowR: [-20, 0, 0],
  },
};

function poseQuats(pose) {
  const out = {};
  const e = new Euler();
  for (const j of JOINTS) {
    const deg = pose[j.name];
    const q = new Quaternion();
    if (deg) q.setFromEuler(e.set(deg[0] * D2R, deg[1] * D2R, deg[2] * D2R, 'XYZ'));
    out[j.name] = q;
  }
  return out;
}
const POSE_CACHE = {};

// Joint motor gains (force based: N·m/rad and N·m·s/rad).
// Arms and neck are underdamped on purpose: they overshoot and wobble.
const MOTOR_STIFFNESS = {
  waist: 1800, neck: 130, shoulderL: 100, shoulderR: 100, elbowL: 45, elbowR: 45,
  hipL: 2600, hipR: 2600, kneeL: 2600, kneeR: 2600,
};
const MOTOR_DAMPING = {
  waist: 55, neck: 4, shoulderL: 3.5, shoulderR: 3.5, elbowL: 1.6, elbowR: 1.6,
  hipL: 80, hipR: 80, kneeL: 80, kneeR: 80,
};
// Legs only need full strength to stand on; otherwise they go this loose.
const LOOSE_LEGS = 0.3;
const LEGS = new Set(['hipL', 'hipR', 'kneeL', 'kneeR']);
function getPose(name) {
  return (POSE_CACHE[name] ??= poseQuats(POSES[name]));
}

const _q = new Quaternion();
const _euler = new Euler();
const ZERO3 = [0, 0, 0];
const _q2 = new Quaternion();
const _v = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const UP = new Vector3(0, 1, 0);

function rot(body, out) {
  const r = body.rotation();
  return out.set(r.x, r.y, r.z, r.w);
}
function vec(v, out) {
  return out.set(v.x, v.y, v.z);
}

/** Rotation vector (axis * angle) taking orientation `from` to `to`, both world-space. */
function rotationError(to, from, out) {
  _q2.copy(from).invert().premultiply(to);
  if (_q2.w < 0) _q2.set(-_q2.x, -_q2.y, -_q2.z, -_q2.w);
  const s = Math.sqrt(1 - Math.min(1, _q2.w * _q2.w));
  if (s < 1e-5) return out.set(0, 0, 0);
  const angle = 2 * Math.acos(Math.min(1, _q2.w));
  return out.set(_q2.x / s, _q2.y / s, _q2.z / s).multiplyScalar(angle);
}

const _mq1 = new Quaternion();
const _mq2 = new Quaternion();
const _mq3 = new Quaternion();
const _mv1 = new Vector3();
const _mv2 = new Vector3();
const _mv3 = new Vector3();
const _imp = new Vector3();
const _a1 = new Vector3();
const _a2 = new Vector3();
const _err = new Vector3();
const _pv = new Vector3();
const _cv = new Vector3();
const _com = new Vector3();

// A limb spinning faster than this is never what the player meant to see,
// and it's what lets a hard hit pull the joints apart.
const MAX_SPIN = 30;
// m/s: the whole body, and any one part relative to the body.
const MAX_SPEED = 45;
const MAX_LIMB_SPEED = 30;
// Joint gap (m) beyond which the child is pulled straight back onto its socket.
const MAX_GAP = 0.02;

function mulSdp(m, v, out) {
  const e = m.elements;
  // Packed symmetric 3x3: m11 m12 m13 m22 m23 m33
  return out.set(
    e[0] * v.x + e[1] * v.y + e[2] * v.z,
    e[1] * v.x + e[3] * v.y + e[4] * v.z,
    e[2] * v.x + e[4] * v.y + e[5] * v.z,
  );
}

/** Angular impulse that changes the relative spin of two bodies by `dw`. */
function solveAngular(invA, invB, dw, out) {
  const a = invA.elements;
  const b = invB.elements;
  const k11 = a[0] + b[0], k12 = a[1] + b[1], k13 = a[2] + b[2];
  const k22 = a[3] + b[3], k23 = a[4] + b[4], k33 = a[5] + b[5];
  const c11 = k22 * k33 - k23 * k23;
  const c12 = k13 * k23 - k12 * k33;
  const c13 = k12 * k23 - k13 * k22;
  const det = k11 * c11 + k12 * c12 + k13 * c13;
  if (Math.abs(det) < 1e-12) return out.set(0, 0, 0);
  const c22 = k11 * k33 - k13 * k13;
  const c23 = k12 * k13 - k11 * k23;
  const c33 = k11 * k22 - k12 * k12;
  const inv = 1 / det;
  return out.set(
    (c11 * dw.x + c12 * dw.y + c13 * dw.z) * inv,
    (c12 * dw.x + c22 * dw.y + c23 * dw.z) * inv,
    (c13 * dw.x + c23 * dw.y + c33 * dw.z) * inv,
  );
}

let nextId = 1;

/**
 * Physical crash-test dummy: 11 rigid bodies, ball and hinge joints, and PD
 * "muscles" that pull every joint toward a pose. `muscle` scales the joint
 * strength (0 = rag, 1 = stiff); `balance` adds a torque that keeps the torso
 * upright and facing `facing`.
 */
export class Ragdoll {
  constructor(physics, { position = [0, 0, 0], yaw = 0, pose = 'stand', muscle = 1, tag = {} } = {}) {
    this.physics = physics;
    this.id = nextId++;
    this.parts = {};
    this.joints = [];
    this.handles = new Set();
    this.muscle = muscle;
    this.balance = 0;
    this.balanceRate = 8;
    this.balanceGain = 0.12;
    this.stiffness = 1;
    // How much he moves on his own: 0 holds the pose dead still, 1 is fully alive.
    this.lively = 1;
    // Same for the legs alone; off while something holds him by the feet.
    this.legLife = 1;
    this.air = 0;
    this.phase = Math.random() * 10;
    this.offsets = Object.fromEntries(JOINTS.map((j) => [j.name, [0, 0, 0]]));
    this.facing = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.poseName = pose;
    this.targets = getPose(pose);
    this.totalMass = 0;

    const root = new Vector3(...position);
    const yawQ = new Quaternion().setFromAxisAngle(UP, yaw);
    const placed = this.solvePose(getPose(pose), root, yawQ);

    const W = physics.world;
    for (const name of ORDER) {
      const def = PARTS[name];
      const { p, q } = placed[name];
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.05)
        .setAngularDamping(0.6)
        .setCcdEnabled(true)
        // A sleeping body ignores its motors, and a dummy at rest would freeze like a statue.
        .setCanSleep(false);
      const body = W.createRigidBody(desc);
      const info = { kind: 'dummy', part: name, ragdoll: this, material: 'body', ...tag };

      let cd;
      if (def.shape === 'box') cd = RAPIER.ColliderDesc.roundCuboid(def.half[0] - 0.02, def.half[1] - 0.02, def.half[2] - 0.02, 0.02);
      else if (def.shape === 'ball') cd = RAPIER.ColliderDesc.ball(def.r);
      else cd = RAPIER.ColliderDesc.capsule(def.hh, def.r);
      const footMass = def.foot ? 1 : 0;
      this.setupCollider(cd, def.mass - footMass);
      const c = physics.createCollider(cd, body, info);
      this.handles.add(c.handle);

      if (def.foot) {
        const fd = RAPIER.ColliderDesc.cuboid(...FOOT.half).setTranslation(...FOOT.offset);
        this.setupCollider(fd, footMass);
        fd.setFriction(1.1);
        const fc = physics.createCollider(fd, body, { ...info, foot: true });
        this.handles.add(fc.handle);
      }

      this.totalMass += def.mass;
      this.parts[name] = { name, body, def, collider: c };
    }

    for (const j of JOINTS) {
      const pa = PARTS[j.parent].pos;
      const ch = PARTS[j.child].pos;
      const a1 = { x: j.at[0] - pa[0], y: j.at[1] - pa[1], z: j.at[2] - pa[2] };
      const a2 = { x: j.at[0] - ch[0], y: j.at[1] - ch[1], z: j.at[2] - ch[2] };
      const data = j.type === 'hinge'
        ? RAPIER.JointData.revolute(a1, a2, { x: 1, y: 0, z: 0 })
        : RAPIER.JointData.spherical(a1, a2);
      const joint = W.createImpulseJoint(data, this.parts[j.parent].body, this.parts[j.child].body, true);
      joint.setContactsEnabled(false);
      if (j.type === 'hinge') joint.setLimits(j.min, j.max);
      for (let axis = 3; axis <= 5; axis++) joint.rawSet.jointConfigureMotorModel(joint.handle, axis, RAPIER.MotorModel.ForceBased);
      this.joints.push({ ...j, joint, parentPart: this.parts[j.parent], childPart: this.parts[j.child], local1: new Vector3(a1.x, a1.y, a1.z), local2: new Vector3(a2.x, a2.y, a2.z) });
    }

    this.updateMotors();
    this._pre = (dt) => this.applyMuscles(dt);
    this._post = () => this.holdTogether();
    physics.preStep.push(this._pre);
    physics.postStep.push(this._post);
  }

  /**
   * Pushes the child back along `axis` (world space, unit) when a joint is
   * `over` radians past its limit: stop it opening further, then ease it back.
   */
  limit(pb, cb, axis, over) {
    const wrel = vec(cb.angvel(), _mv2).sub(vec(pb.angvel(), _v3));
    const closing = wrel.dot(axis);
    const target = Math.min(over * 40, 14);
    if (closing >= target) return;
    solveAngular(cb.effectiveWorldInvInertia(), pb.effectiveWorldInvInertia(), _mv3.copy(axis).multiplyScalar(target - closing), _imp);
    cb.applyTorqueImpulse(_imp, true);
    pb.applyTorqueImpulse(_imp.negate(), true);
  }

  /**
   * After each step: cap runaway spin and project any stretched joint back
   * together, parent first, so a big impact can't visibly tear him apart.
   */
  holdTogether() {
    // Nothing in the games moves a body this fast: if the solver ever spits
    // out such a speed, rein the part back in before it can tear him apart.
    const v0 = this.velocity(_com);
    const s0 = v0.length();
    if (s0 > MAX_SPEED) v0.multiplyScalar(MAX_SPEED / s0);
    for (const name of ORDER) {
      const b = this.parts[name].body;
      const lv = b.linvel();
      _v.set(lv.x - v0.x, lv.y - v0.y, lv.z - v0.z);
      const rel = _v.length();
      if (rel <= MAX_LIMB_SPEED && s0 <= MAX_SPEED) continue;
      if (rel > MAX_LIMB_SPEED) _v.multiplyScalar(MAX_LIMB_SPEED / rel);
      b.setLinvel({ x: v0.x + _v.x, y: v0.y + _v.y, z: v0.z + _v.z }, true);
    }
    for (const name of ORDER) {
      const b = this.parts[name].body;
      const w = b.angvel();
      const spin = Math.hypot(w.x, w.y, w.z);
      const v = b.linvel();
      // Nearly still: bleed off the last twitches so he settles instead of buzzing.
      const settling = Math.hypot(v.x, v.y, v.z) < 0.35 && spin < 4 ? 0.8 : 1;
      const k = Math.min(settling, MAX_SPIN / Math.max(spin, 1e-6));
      if (k < 1) b.setAngvel({ x: w.x * k, y: w.y * k, z: w.z * k }, true);
    }
    for (const j of this.joints) {
      const pb = j.parentPart.body;
      const cb = j.childPart.body;
      const pt = pb.translation();
      const ct = cb.translation();
      rot(pb, _mq1);
      rot(cb, _mq2);
      _a1.copy(j.local1).applyQuaternion(_mq1);
      _a2.copy(j.local2).applyQuaternion(_mq2);
      _err.set(pt.x + _a1.x - ct.x - _a2.x, pt.y + _a1.y - ct.y - _a2.y, pt.z + _a1.z - ct.z - _a2.z);
      const gap = _err.length();
      if (gap < MAX_GAP) continue;
      cb.setTranslation({ x: ct.x + _err.x, y: ct.y + _err.y, z: ct.z + _err.z }, true);
      // Match the socket's velocity along the gap so it doesn't open again next step.
      vec(pb.linvel(), _pv).add(_v.crossVectors(vec(pb.angvel(), _v2), _a1));
      vec(cb.linvel(), _cv).add(_v.crossVectors(vec(cb.angvel(), _v2), _a2));
      _err.divideScalar(gap);
      const sep = _pv.sub(_cv).dot(_err);
      const lv = cb.linvel();
      cb.setLinvel({ x: lv.x + _err.x * sep, y: lv.y + _err.y * sep, z: lv.z + _err.z * sep }, true);
    }
  }

  setupCollider(desc, mass) {
    desc.setMass(mass)
      .setFriction(0.8)
      .setRestitution(0.1)
      .setCollisionGroups(groups(Group.DUMMY))
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS | RAPIER.ActiveEvents.COLLISION_EVENTS)
      .setContactForceEventThreshold(160);
  }

  /** Forward kinematics: world transform of every part for a pose. */
  solvePose(targets, root, rootRot) {
    const out = { pelvis: { p: root.clone().add(new Vector3(...PARTS.pelvis.pos).applyQuaternion(rootRot)), q: rootRot.clone() } };
    for (const j of JOINTS) {
      const parent = out[j.parent];
      const pPos = new Vector3(...PARTS[j.parent].pos);
      const cPos = new Vector3(...PARTS[j.child].pos);
      const at = new Vector3(...j.at);
      const q = parent.q.clone().multiply(targets[j.name]);
      const jointWorld = at.clone().sub(pPos).applyQuaternion(parent.q).add(parent.p);
      const p = cPos.sub(at).applyQuaternion(q).add(jointWorld);
      out[j.child] = { p, q };
    }
    return out;
  }

  isPart(handle) {
    return this.handles.has(handle);
  }

  /** 0 = rag doll, 1 = fully tensed. Joint motors are re-tuned on change. */
  setMuscle(m) {
    m = Math.max(0, Math.min(1.5, m));
    if (Math.abs(m - this.muscle) < 0.01 && this._motorsSet) return;
    this.muscle = m;
    this.updateMotors();
  }

  setPose(name) {
    this.poseName = name;
    this.targets = getPose(name);
    this.updateMotors();
  }

  updateMotors(offsets = null) {
    this._motorsSet = true;
    const m = this.muscle * this.stiffness;
    const pose = POSES[this.poseName] ?? {};
    const loose = this.balance < 0.05 ? 1 + (LOOSE_LEGS - 1) * this.lively * this.legLife : 1;
    for (const j of this.joints) {
      let q = this.targets[j.name];
      if (offsets) {
        const base = pose[j.name] ?? ZERO3;
        const o = offsets[j.name];
        let x = base[0] + o[0];
        // Keep hinge targets inside their limits so the motor never fights the stop.
        if (j.type === 'hinge') x = Math.min(Math.max(x, j.min / D2R + 2), j.max / D2R - 2);
        q = _q.setFromEuler(_euler.set(x * D2R, (base[1] + o[1]) * D2R, (base[2] + o[2]) * D2R, 'XYZ'));
      }
      const sgn = q.w < 0 ? -1 : 1;
      const leg = LEGS.has(j.name) ? loose : 1;
      const k = MOTOR_STIFFNESS[j.name] * m * leg;
      // Even knocked out, a crash dummy's joints have friction: limbs swing, they don't flail.
      const d = MOTOR_DAMPING[j.name] * Math.max(0.35, Math.sqrt(m) + 0.08) * leg;
      const raw = j.joint.rawSet;
      if (j.type === 'hinge') {
        raw.jointConfigureMotorPosition(j.joint.handle, 3, 2 * Math.asin(sgn * q.x), k, d);
      } else {
        raw.jointConfigureMotorPosition(j.joint.handle, 3, 2 * Math.asin(sgn * q.x), k, d);
        raw.jointConfigureMotorPosition(j.joint.handle, 4, 2 * Math.asin(sgn * q.y), k, d);
        raw.jointConfigureMotorPosition(j.joint.handle, 5, 2 * Math.asin(sgn * q.z), k, d);
      }
    }
  }

  /**
   * Bend and twist limits on the ball joints, solved as velocity constraints
   * each step; the rest of the muscle work is done by joint motors.
   */
  applyMuscles(dt = 1 / 60) {
    this.animate(dt);
    const qp = _mq1;
    const qc = _mq2;
    for (const j of this.joints) {
      if (j.type !== 'ball') continue;
      const pb = j.parentPart.body;
      const cb = j.childPart.body;
      rot(pb, qp);
      rot(cb, qc);
      _q.copy(qp).invert().multiply(qc);
      if (_q.w < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
      const bend = 2 * Math.acos(Math.min(1, _q.w)) - j.limit * D2R;
      if (bend > 0) {
        rotationError(qp, qc, _mv1);
        if (_mv1.lengthSq() > 1e-10) this.limit(pb, cb, _mv1.normalize(), bend);
      }
      // Twist about the child's own bone: past this, an arm corkscrews. Near a
      // full swing the twist is ill-defined, so it's left alone there.
      if (Math.hypot(_q.y, _q.w) < 0.35) continue;
      const twist = 2 * Math.atan2(_q.y, _q.w);
      const over = Math.abs(twist) - j.twist * D2R;
      if (over > 0) this.limit(pb, cb, _mv1.set(0, -Math.sign(twist), 0).applyQuaternion(qc), over);
    }

    if (this.balance > 0.001) this.applyBalance();
  }

  /**
   * Life on top of the pose: a little sway and fidget at rest, and the faster
   * he's going the harder he flails — arms windmilling, legs kicking.
   */
  animate(dt) {
    const life = this.lively;
    if (life <= 0) {
      if (this._animated) {
        this._animated = false;
        this.updateMotors();
      }
      return;
    }
    this._animated = true;
    const want = Math.min(1, Math.max(0, (this.speed() - 1.2) / 3.5));
    this.air += (want - this.air) * Math.min(1, dt * (want > this.air ? 6 : 1.5));
    const a = this.air * life;
    const i = life;
    this.phase += (2.4 + a * 4.5) * dt;
    const p = this.phase;
    const o = this.offsets;
    const S = Math.sin;
    const swing = 14 * i + 40 * a;
    const spread = 9 * i + 22 * a;
    const bend = 18 * i + 42 * a;
    o.shoulderL[0] = S(p) * swing;
    o.shoulderL[2] = S(p * 0.7 + 1) * spread;
    o.shoulderR[0] = S(p + Math.PI) * swing;
    o.shoulderR[2] = -S(p * 0.7 + 2.5) * spread;
    o.elbowL[0] = -(0.5 + 0.5 * S(p * 1.3 + 0.5)) * bend;
    o.elbowR[0] = -(0.5 + 0.5 * S(p * 1.3 + 2.5)) * bend;
    o.neck[0] = S(p * 0.9) * (6 * i + 12 * a);
    o.neck[1] = S(p * 0.6 + 1) * (10 * i + 6 * a);
    o.waist[0] = S(p * 0.5) * (3 * i + 6 * a);
    o.waist[2] = S(p * 0.4 + 2) * (3 * i + 3 * a);
    // Standing legs belong to the balance controller.
    const legs = this.balance < 0.05 ? this.legLife : 0;
    const kick = (8 * i + 34 * a) * legs;
    const knee = (12 * i + 45 * a) * legs;
    o.hipL[0] = S(p + Math.PI / 2) * kick;
    o.hipR[0] = S(p - Math.PI / 2) * kick;
    o.kneeL[0] = (0.5 + 0.5 * S(p + Math.PI)) * knee;
    o.kneeR[0] = (0.5 + 0.5 * S(p)) * knee;
    this.updateMotors(o);
  }

  /**
   * Keeps the torso upright and turned toward `facing` by nudging the whole
   * body's spin as if it were one rigid piece, so no single light part gets
   * yanked hard enough to destabilise the joints.
   */
  applyBalance() {
    const b = Math.min(1, this.balance);
    const pel = this.parts.pelvis.body;
    const ch = this.parts.chest.body;
    rot(pel, _mq1);
    rot(ch, _mq2);
    const up = _v.set(0, 1, 0).applyQuaternion(_mq1).add(_v2.set(0, 1, 0).applyQuaternion(_mq2)).normalize();
    const fwd = _v2.set(0, 0, 1).applyQuaternion(_mq1);

    const err = _mv1.crossVectors(up, UP);
    const s = err.length();
    if (s > 1e-6) {
      const angle = up.y < 0 ? Math.PI - Math.asin(Math.min(1, s)) : Math.asin(Math.min(1, s));
      err.multiplyScalar(angle / s);
    }
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-4) {
      fwd.normalize();
      err.y = Math.atan2(fwd.z * this.facing.x - fwd.x * this.facing.z, fwd.dot(this.facing)) * 0.8;
    }

    const w = vec(pel.angvel(), _mv2).add(vec(ch.angvel(), _v3)).multiplyScalar(0.5);
    const dw = err.multiplyScalar(this.balanceRate).sub(w).multiplyScalar(this.balanceGain * b);
    const com = this.centerOfMass(_mv3);
    for (const name of ORDER) {
      const body = this.parts[name].body;
      const t = body.translation();
      const r = _v.set(t.x - com.x, t.y - com.y, t.z - com.z);
      const dv = _v3.crossVectors(dw, r);
      const lv = body.linvel();
      const av = body.angvel();
      body.setLinvel({ x: lv.x + dv.x, y: lv.y + dv.y, z: lv.z + dv.z }, true);
      body.setAngvel({ x: av.x + dw.x, y: av.y + dw.y, z: av.z + dw.z }, true);
    }
  }

  /**
   * Restricts what the dummy collides with (a mask of Group bits). Used while
   * he's strapped into a vehicle: a welded limb dragging on the ground would
   * otherwise feed the solver until the joints explode.
   */
  setCollisionFilter(filter = Group.ALL) {
    for (const name of ORDER) {
      const b = this.parts[name].body;
      for (let i = 0; i < b.numColliders(); i++) b.collider(i).setCollisionGroups(groups(Group.DUMMY, filter));
    }
  }

  forEachBody(fn) {
    for (const name of ORDER) fn(this.parts[name].body, name);
  }

  centerOfMass(out = new Vector3()) {
    out.set(0, 0, 0);
    for (const name of ORDER) {
      const p = this.parts[name];
      const t = p.body.translation();
      out.x += t.x * p.def.mass;
      out.y += t.y * p.def.mass;
      out.z += t.z * p.def.mass;
    }
    return out.multiplyScalar(1 / this.totalMass);
  }

  velocity(out = new Vector3()) {
    out.set(0, 0, 0);
    for (const name of ORDER) {
      const p = this.parts[name];
      const v = p.body.linvel();
      out.x += v.x * p.def.mass;
      out.y += v.y * p.def.mass;
      out.z += v.z * p.def.mass;
    }
    return out.multiplyScalar(1 / this.totalMass);
  }

  speed() {
    let s = 0;
    for (const name of ORDER) {
      const v = this.parts[name].body.linvel();
      s += Math.hypot(v.x, v.y, v.z);
    }
    return s / ORDER.length;
  }

  setVelocity(v) {
    for (const name of ORDER) this.parts[name].body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
  }

  addVelocity(v, keep = 1) {
    for (const name of ORDER) {
      const b = this.parts[name].body;
      const cur = b.linvel();
      b.setLinvel({ x: cur.x * keep + v.x, y: cur.y * keep + v.y, z: cur.z * keep + v.z }, true);
    }
  }

  setAngularVelocity(w) {
    for (const name of ORDER) this.parts[name].body.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
  }

  /** Spin the whole body as one piece: linear velocity matching rotation about the COM. */
  addSpin(w) {
    const com = this.centerOfMass(new Vector3());
    for (const name of ORDER) {
      const b = this.parts[name].body;
      const t = b.translation();
      const r = _v.set(t.x - com.x, t.y - com.y, t.z - com.z);
      const lv = _v2.crossVectors(w, r);
      const cur = b.linvel();
      const av = b.angvel();
      b.setLinvel({ x: cur.x + lv.x, y: cur.y + lv.y, z: cur.z + lv.z }, true);
      b.setAngvel({ x: av.x + w.x, y: av.y + w.y, z: av.z + w.z }, true);
    }
  }

  setGravityScale(s) {
    for (const name of ORDER) this.parts[name].body.setGravityScale(s, true);
  }

  /**
   * Turns him into a statue where he lies: every part becomes fixed (or
   * kinematic, to be carried by something that moves) and the muscles stop.
   */
  freeze(kinematic = false) {
    const type = kinematic ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Fixed;
    for (const name of ORDER) this.parts[name].body.setBodyType(type, true);
    for (const [list, fn] of [[this.physics.preStep, this._pre], [this.physics.postStep, this._post]]) {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
    this.frozen = true;
  }

  /** Puts every part back into `pose` at a new root position, at rest; `tilt` lays him over. */
  teleport(position, yaw = 0, pose = this.poseName, tilt = null) {
    this.facing.set(Math.sin(yaw), 0, Math.cos(yaw));
    const rootRot = new Quaternion().setFromAxisAngle(UP, yaw);
    if (tilt) rootRot.premultiply(tilt);
    const placed = this.solvePose(getPose(pose), new Vector3(...position), rootRot);
    this.setPose(pose);
    for (const name of ORDER) {
      const b = this.parts[name].body;
      const { p, q } = placed[name];
      b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.physics.snapBody(b);
    }
  }

  dispose() {
    const i = this.physics.preStep.indexOf(this._pre);
    if (i >= 0) this.physics.preStep.splice(i, 1);
    const k = this.physics.postStep.indexOf(this._post);
    if (k >= 0) this.physics.postStep.splice(k, 1);
    for (const name of ORDER) this.physics.removeBody(this.parts[name].body);
    this.parts = {};
    this.joints = [];
  }
}

export const PART_ORDER = ORDER;
