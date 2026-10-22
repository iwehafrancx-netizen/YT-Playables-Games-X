import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { Mat, containerMat } from '../render/materials.js';

const D2R = Math.PI / 180;
export const BOX = [2.44, 2.6, 6.06]; // shipping container width, height, length

let boxGeo = null;
/** One container shape shared by every level (it's never disposed). */
export function containerGeometry() {
  boxGeo ??= new THREE.BoxGeometry(...BOX);
  return boxGeo;
}

/** Box geometry whose UVs are scaled to world size, so textures tile at a constant density. */
function tiledBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!tile) return g;
  const uv = g.attributes.uv;
  const scale = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * scale[f][0]) / tile, (uv.getY(k) * scale[f][1]) / tile);
    }
  }
  return g;
}

function quatFrom(rot) {
  if (!rot) return new THREE.Quaternion();
  if (rot.isQuaternion) return rot.clone();
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * D2R, (rot[1] ?? 0) * D2R, (rot[2] ?? 0) * D2R, 'YXZ'));
}

function material(name) {
  if (typeof name !== 'string') return name;
  return Mat[name]();
}

const SOUND_FOR = {
  concrete: 'concrete', concreteDark: 'concrete', asphalt: 'concrete', wall: 'concrete',
  crate: 'wood', cardboard: 'cardboard', hazard: 'metal', steel: 'metal', darkSteel: 'metal',
  steelBlue: 'metal', steelRed: 'metal', steelGreen: 'metal', steelOrange: 'metal', steelGrey: 'metal',
  toyRed: 'rubber', toyBlue: 'rubber', toyYellow: 'rubber', toyGreen: 'rubber', toyPurple: 'rubber', toyOrange: 'rubber', toyPink: 'rubber', toyDark: 'rubber',
  rubber: 'rubber', foam: 'rubber', trampoline: 'rubber', glass: 'glass', white: 'wood', bullseye: 'wood',
};

/**
 * Level geometry and props. Owns every mesh and body it creates; the
 * physics world is torn down with the level, meshes via `dispose()`.
 */
export class World {
  constructor(ctx) {
    this.ctx = ctx;
    this.physics = ctx.physics;
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this.props = [];
    this.targets = [];
    this.movers = [];
    this.triggers = [];
    this.springs = [];
    this.disposables = [];
    this.physics.preStep.push((dt) => this.stepMovers(dt));
  }

  add(...objs) {
    this.group.add(...objs);
    return objs[0];
  }

  mesh(geometry, mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material(mat));
    m.castShadow = cast;
    m.receiveShadow = receive;
    this.disposables.push(geometry);
    return m;
  }

  fixedBody(pos, quat) {
    return this.physics.createBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
  }

  ground({ size = 240, mat = 'concrete', tile = 6, y = 0, friction = 0.9 } = {}) {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * size) / tile, (uv.getY(i) * size) / tile);
    const m = this.mesh(g, mat, { cast: false });
    m.position.y = y;
    this.add(m);
    const body = this.fixedBody([0, y - 1, 0], new THREE.Quaternion());
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(size / 2, 1, size / 2).setFriction(friction).setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'ground', material: SOUND_FOR[mat] ?? 'concrete' },
    );
    return m;
  }

  /** Static box. `pos` is the centre. */
  block({ pos, size, rot, mat = 'concrete', tile = 2, friction = 0.8, restitution = 0.05, kind = 'static', cast = true, rounded = 0, visible = true, slick = false }) {
    const q = quatFrom(rot);
    const [w, h, d] = size;
    let mesh = null;
    if (visible) {
      const geom = rounded ? new RoundedBoxGeometry(w, h, d, 2, rounded) : tiledBox(w, h, d, tile);
      mesh = this.mesh(geom, mat, { cast });
      mesh.position.set(...pos);
      mesh.quaternion.copy(q);
      this.add(mesh);
    }
    const body = this.fixedBody(pos, q);
    const desc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(friction).setRestitution(restitution).setCollisionGroups(groups(Group.WORLD));
    // Slick surfaces (an oiled lane) stay slippery whatever touches them.
    if (slick) desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    const collider = this.physics.createCollider(
      desc,
      body,
      { kind, material: SOUND_FOR[mat] ?? 'concrete' },
    );
    return { mesh, body, collider };
  }

  /** Slab whose top surface runs from `from` to `to` (centre line). */
  ramp({ from, to, width = 3, thick = 0.4, mat = 'concrete', tile = 2, friction = 0.6, kind = 'static' }) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = -Math.asin(dir.y);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const down = new THREE.Vector3(0, -thick / 2, 0).applyQuaternion(q);
    const centre = a.clone().add(b).multiplyScalar(0.5).add(down);
    return this.block({ pos: centre.toArray(), size: [width, thick, len], rot: q, mat, tile, friction, kind });
  }

  /** Flight of steps descending along `yaw` from the top landing at `pos` (top front edge). */
  stairs({ pos, count = 10, rise = 0.3, run = 0.5, width = 3, yaw = 0, mat = 'concrete', landing = 0 }) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * D2R);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const origin = new THREE.Vector3(...pos);
    for (let i = 0; i < count; i++) {
      const topY = origin.y - i * rise;
      const h = Math.max(0.2, topY);
      const centre = origin.clone().addScaledVector(fwd, run * (i + 0.5)).setY(topY - h / 2);
      this.block({ pos: centre.toArray(), size: [width, h, run], rot: [0, yaw, 0], mat, tile: 1.5 });
      // Steel nosing on each tread edge reads well at a distance.
      const nose = this.mesh(new THREE.BoxGeometry(width, 0.04, 0.06), 'hazard', { cast: false });
      nose.position.copy(origin).addScaledVector(fwd, run * (i + 1) - 0.03).setY(topY - 0.015);
      nose.quaternion.copy(q);
      this.add(nose);
    }
    if (landing > 0) {
      const end = origin.clone().addScaledVector(fwd, run * count + landing / 2);
      const topY = origin.y - count * rise;
      if (topY > 0.05) this.block({ pos: end.setY(topY / 2).toArray(), size: [width, topY, landing], rot: [0, yaw, 0], mat });
    }
  }

  dynamicBody(pos, quat, { linDamp = 0.05, angDamp = 0.1, ccd = false } = {}) {
    return this.physics.createBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos[0], pos[1], pos[2])
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
        .setLinearDamping(linDamp)
        .setAngularDamping(angDamp)
        .setCcdEnabled(ccd),
    );
  }

  registerProp(body, mesh, info) {
    this.physics.link(body, mesh);
    const t = body.translation();
    const prop = { body, mesh, ...info, start: new THREE.Vector3(t.x, t.y, t.z), knocked: false };
    this.props.push(prop);
    return prop;
  }

  crate({ pos, size = 0.8, rot, kind = 'crate', mass, friction = 0.7 }) {
    const s = Array.isArray(size) ? size : [size, size, size];
    const q = quatFrom(rot);
    const matName = kind === 'cardboard' ? 'cardboard' : kind === 'metal' ? 'steelGrey' : 'crate';
    const geom = new RoundedBoxGeometry(s[0], s[1], s[2], 2, Math.min(0.03, s[0] * 0.05));
    this.disposables.push(geom);
    const mesh = new THREE.Mesh(geom, Mat[matName]());
    mesh.castShadow = mesh.receiveShadow = true;
    this.add(mesh);
    const vol = s[0] * s[1] * s[2];
    const density = kind === 'cardboard' ? 18 : kind === 'metal' ? 220 : 55;
    const body = this.dynamicBody(pos, q);
    const prop = this.registerProp(body, mesh, { kind, material: SOUND_FOR[matName] });
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(s[0] / 2, s[1] / 2, s[2] / 2)
        .setMass(mass ?? vol * density)
        .setFriction(friction)
        .setRestitution(0.1)
        .setCollisionGroups(groups(Group.PROP))
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(60),
      body,
      { kind: 'prop', prop, material: SOUND_FOR[matName] },
    );
    return prop;
  }

  barrel({ pos, rot, color = 'steelRed', mass = 22 }) {
    const q = quatFrom(rot);
    const r = 0.3;
    const h = 0.88;
    const g = new THREE.Group();
    const shell = this.mesh(new THREE.CylinderGeometry(r, r, h, 24, 1), color);
    g.add(shell);
    const ringGeo = new THREE.TorusGeometry(r + 0.004, 0.018, 6, 24);
    this.disposables.push(ringGeo);
    for (const y of [-h * 0.28, h * 0.28]) {
      const ring = new THREE.Mesh(ringGeo, Mat.darkSteel());
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    }
    this.add(g);
    const body = this.dynamicBody(pos, q, { angDamp: 0.3 });
    const prop = this.registerProp(body, g, { kind: 'barrel', material: 'metal' });
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(h / 2, r)
        .setMass(mass)
        .setFriction(0.6)
        .setRestitution(0.15)
        .setCollisionGroups(groups(Group.PROP))
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(60),
      body,
      { kind: 'prop', prop, material: 'metal' },
    );
    return prop;
  }

  plank({ pos, size = [0.3, 0.08, 3], rot, mass = 9, mat = 'crate' }) {
    const q = quatFrom(rot);
    const mesh = this.mesh(tiledBox(size[0], size[1], size[2], 1), mat);
    this.add(mesh);
    const body = this.dynamicBody(pos, q);
    const prop = this.registerProp(body, mesh, { kind: 'plank', material: 'wood' });
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
        .setMass(mass)
        .setFriction(0.7)
        .setCollisionGroups(groups(Group.PROP))
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(60),
      body,
      { kind: 'prop', prop, material: 'wood' },
    );
    return prop;
  }

  /** Oversized bowling pin (the dummy is the ball). `h` is the pin height. */
  pin({ pos, h = 1.1, mass = 4 }) {
    const prof = [
      [0, 0], [0.067, 0], [0.1, 0.04], [0.145, 0.15], [0.159, 0.26], [0.15, 0.36], [0.12, 0.47],
      [0.075, 0.58], [0.06, 0.65], [0.068, 0.74], [0.084, 0.84], [0.075, 0.93], [0.045, 0.985], [0, 1],
    ].map(([r, y]) => new THREE.Vector2(r * h, y * h - h / 2));
    this.lathes ??= new Map();
    let geo = this.lathes.get(h);
    if (!geo) {
      geo = new THREE.LatheGeometry(prof, 20);
      this.lathes.set(h, geo);
      this.disposables.push(geo);
    }
    const mesh = new THREE.Mesh(geo, Mat.pin());
    mesh.castShadow = mesh.receiveShadow = true;
    this.add(mesh);
    const body = this.dynamicBody([pos[0], pos[1] + h / 2, pos[2]], new THREE.Quaternion(), { angDamp: 0.2 });
    const prop = this.registerProp(body, mesh, { kind: 'pin', material: 'wood', down: false });
    const opts = (d) => d.setFriction(0.45).setRestitution(0.3).setCollisionGroups(groups(Group.PROP)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(40);
    const info = { kind: 'prop', prop, material: 'wood' };
    // Belly, neck and crown; the heavy belly keeps the centre of mass low like a real pin.
    this.physics.createCollider(opts(RAPIER.ColliderDesc.cylinder(0.25 * h, 0.14 * h).setTranslation(0, -0.23 * h, 0)).setMass(mass * 0.75), body, info);
    this.physics.createCollider(opts(RAPIER.ColliderDesc.capsule(0.08 * h, 0.065 * h).setTranslation(0, 0.18 * h, 0)).setMass(mass * 0.15), body, info);
    this.physics.createCollider(opts(RAPIER.ColliderDesc.ball(0.085 * h).setTranslation(0, 0.34 * h, 0)).setMass(mass * 0.1), body, info);
    return prop;
  }

  cone({ pos, mass = 1.2 }) {
    const g = new THREE.Group();
    const c = this.mesh(new THREE.ConeGeometry(0.16, 0.5, 16), 'steelOrange');
    c.position.y = 0.03;
    const base = this.mesh(new THREE.BoxGeometry(0.36, 0.04, 0.36), 'rubber');
    base.position.y = -0.23;
    const band = this.mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.1, 16), 'white');
    band.position.y = 0.02;
    g.add(c, base, band);
    this.add(g);
    const body = this.dynamicBody(pos, new THREE.Quaternion());
    const prop = this.registerProp(body, g, { kind: 'cone', material: 'rubber' });
    this.physics.createCollider(
      RAPIER.ColliderDesc.cone(0.25, 0.17).setMass(mass).setFriction(0.8).setCollisionGroups(groups(Group.PROP)),
      body,
      { kind: 'prop', prop, material: 'rubber' },
    );
    return prop;
  }

  /**
   * Bullseye board on a post. `move` is an optional function t -> [dx, dy, dz]
   * offset from `pos` for moving targets.
   */
  bullseye({ pos, yaw = 0, radius = 0.75, post = true, move = null, points = 500 }) {
    const g = new THREE.Group();
    const board = new THREE.Group();
    const face = this.mesh(new THREE.CylinderGeometry(radius, radius, 0.08, 40), 'bullseye');
    face.rotation.x = Math.PI / 2;
    // Map the bullseye texture onto the cap facing +Z.
    const rim = this.mesh(new THREE.TorusGeometry(radius, 0.035, 8, 40), 'darkSteel');
    board.add(face, rim);
    g.add(board);
    let postMesh = null;
    if (post) {
      const ph = pos[1] - radius * 0.2;
      postMesh = this.mesh(new THREE.CylinderGeometry(0.05, 0.06, ph, 10), 'darkSteel');
      postMesh.position.set(0, -ph / 2 - radius * 0.2, -0.08);
      g.add(postMesh);
    }
    g.position.set(...pos);
    g.rotation.y = yaw * D2R;
    this.add(g);

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * D2R);
    const desc = move ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    const body = this.physics.createBody(desc.setTranslation(...pos).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    const target = { kind: 'target', group: g, board, face, body, hit: false, points, flip: 0, base: new THREE.Vector3(...pos), move };
    const cd = RAPIER.ColliderDesc.cylinder(0.06, radius)
      .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
      .setCollisionGroups(groups(Group.WORLD))
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    target.collider = this.physics.createCollider(cd, body, { kind: 'target', target, material: 'wood' });
    // Moving targets get no solid post: a kinematic pole sweeping the floor
    // would bulldoze every dummy lying there.
    if (post && !move) {
      const ph = pos[1] - radius * 0.2;
      this.physics.createCollider(
        RAPIER.ColliderDesc.cylinder(ph / 2, 0.06).setTranslation(0, -ph / 2 - radius * 0.2, -0.08).setCollisionGroups(groups(Group.WORLD)),
        body,
        { kind: 'static', material: 'metal' },
      );
    }
    if (move) {
      this.movers.push({
        body,
        fn: (t) => {
          const o = move(t);
          return { pos: [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]] };
        },
        object: g,
      });
    }
    this.targets.push(target);
    return target;
  }

  /** Marks a target as hit and plays its fold-down animation. */
  hitTarget(target) {
    if (target.hit) return false;
    target.hit = true;
    target.face.material = Mat.glowGreen();
    return true;
  }

  trampoline({ pos, size = [2, 2], yaw = 0, power = 11 }) {
    const [w, d] = size;
    const g = new THREE.Group();
    const frame = this.mesh(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), 'steelBlue');
    const pad = this.mesh(new THREE.BoxGeometry(w, 0.06, d), 'trampoline');
    pad.position.y = 0.08;
    g.add(frame, pad);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, pos[1], 8), 'darkSteel');
        leg.position.set((sx * w) / 2, -pos[1] / 2, (sz * d) / 2);
        g.add(leg);
      }
    }
    g.position.set(...pos);
    g.rotation.y = yaw * D2R;
    this.add(g);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * D2R);
    const body = this.fixedBody(pos, q);
    const spring = { kind: 'spring', pad, power, squash: 0, group: g };
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2 + 0.1, 0.12, d / 2 + 0.1)
        .setFriction(0.9)
        .setCollisionGroups(groups(Group.WORLD))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'spring', spring, material: 'rubber' },
    );
    this.springs.push(spring);
    return spring;
  }

  /** Static cylinder lying along `axis`. */
  rod({ pos, radius = 0.12, length = 2, axis = 'z', mat = 'steel', restitution = 0.2 }) {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 14);
    const mesh = this.mesh(geo, mat);
    const q = new THREE.Quaternion();
    if (axis === 'x') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    if (axis === 'z') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    mesh.position.set(...pos);
    mesh.quaternion.copy(q);
    this.add(mesh);
    const body = this.fixedBody(pos, q);
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(length / 2, radius).setRestitution(restitution).setFriction(0.5).setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'static', material: 'metal' },
    );
    return mesh;
  }

  /** Kinematic arm sweeping round a vertical post. */
  spinner({ pos, length = 6, thick = 0.3, height = 1, speed = 1.4, mat = 'hazard', phase = 0 }) {
    const g = new THREE.Group();
    const arm = this.mesh(new THREE.BoxGeometry(length, thick, thick), mat);
    arm.position.y = height;
    const hub = this.mesh(new THREE.CylinderGeometry(0.28, 0.28, thick + 0.1, 18), 'darkSteel');
    hub.position.y = height;
    g.add(arm, hub);
    this.add(g);
    const post = this.mesh(new THREE.CylinderGeometry(0.16, 0.2, height, 12), 'steelGrey');
    post.position.set(pos[0], pos[1] + height / 2, pos[2]);
    this.add(post);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...pos));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(length / 2, thick / 2, thick / 2).setTranslation(0, height, 0).setFriction(0.4).setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'static', material: 'metal' },
    );
    const axis = new THREE.Vector3(0, 1, 0);
    return this.mover({
      body,
      object: g,
      fn: (t) => {
        const q = new THREE.Quaternion().setFromAxisAngle(axis, phase + t * speed);
        return { pos, rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      },
    });
  }

  /** Hazard-striped cross turning in the XY plane about its centre. */
  rotor({ pos, length = 5, thick = 0.35, speed = 1.2, phase = 0, arms = 2 }) {
    const g = new THREE.Group();
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...pos));
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI;
      const bar = this.mesh(new THREE.BoxGeometry(length, thick, thick), 'hazard');
      bar.rotation.z = a;
      g.add(bar);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      this.physics.createCollider(
        RAPIER.ColliderDesc.cuboid(length / 2, thick / 2, thick / 2).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.4).setCollisionGroups(groups(Group.WORLD)),
        body,
        { kind: 'static', material: 'metal' },
      );
    }
    const hub = this.mesh(new THREE.CylinderGeometry(0.3, 0.3, thick + 0.2, 16), 'darkSteel');
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    this.add(g);
    const axis = new THREE.Vector3(0, 0, 1);
    return this.mover({
      body,
      object: g,
      fn: (t) => {
        const q = new THREE.Quaternion().setFromAxisAngle(axis, phase + t * speed);
        return { pos, rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      },
    });
  }

  /** Spinning circular saw, optionally sliding along `axis` by ±`amp`. Touching it is a 'hazard' contact. */
  saw({ pos, r = 0.55, amp = 0, axis = 'y', speed = 1.6, phase = 0 }) {
    const [x, y, z] = pos;
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    const n = 18;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * 0.82 : r;
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    geo.center();
    const blade = this.mesh(geo, 'saw');
    const hub = this.mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.12, 16), 'steelRed');
    hub.rotation.x = Math.PI / 2;
    g.add(blade, hub);
    this.add(g);
    if (amp) {
      // Guide rail showing the saw's travel
      const len = amp * 2 + r * 2;
      const rail = this.mesh(new THREE.BoxGeometry(axis === 'x' ? len : 0.08, axis === 'x' ? 0.08 : len, 0.05), 'darkSteel', { cast: false });
      rail.position.set(x, y, z - 0.1);
      this.add(rail);
    }
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(0.1, r * 0.9)
        .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
        .setCollisionGroups(groups(Group.WORLD))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'hazard', material: 'metal', label: 'SAWED!' },
    );
    const spin = new THREE.Vector3(0, 0, 1);
    const mover = this.mover({
      body,
      object: g,
      fn: (t) => {
        const o = Math.sin(t * speed + phase) * amp;
        const q = new THREE.Quaternion().setFromAxisAngle(spin, -t * 9);
        return { pos: [x + (axis === 'x' ? o : 0), y + (axis === 'x' ? 0 : o), z], rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      },
    });
    return { body, mover };
  }

  /** Heavy steel wrecking ball. */
  ball({ pos, r = 0.45, mass = 90 }) {
    const mesh = this.mesh(new THREE.SphereGeometry(r, 28, 18), 'steel');
    this.add(mesh);
    const body = this.dynamicBody(pos, new THREE.Quaternion(), { angDamp: 0.2, ccd: true });
    const prop = this.registerProp(body, mesh, { kind: 'ball', material: 'metal' });
    this.physics.createCollider(
      RAPIER.ColliderDesc.ball(r)
        .setMass(mass)
        .setFriction(0.5)
        .setRestitution(0.2)
        .setCollisionGroups(groups(Group.PROP))
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(60),
      body,
      { kind: 'prop', prop, material: 'metal' },
    );
    return prop;
  }

  /** Open-top skip: the classic place for a ragdoll to end up. */
  dumpster({ pos, yaw = 0, size = [2.6, 1.3, 1.8], color = 'steelGreen' }) {
    const [w, h, d] = size;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * D2R);
    const c = new THREE.Vector3(...pos);
    const t = 0.08;
    const parts = [
      [[0, t / 2, 0], [w, t, d]],
      [[0, h / 2, d / 2 - t / 2], [w, h, t]],
      [[0, h / 2, -d / 2 + t / 2], [w, h, t]],
      [[w / 2 - t / 2, h / 2, 0], [t, h, d]],
      [[-w / 2 + t / 2, h / 2, 0], [t, h, d]],
    ];
    for (const [o, s] of parts) {
      const p = new THREE.Vector3(...o).applyQuaternion(q).add(c);
      this.block({ pos: p.toArray(), size: s, rot: q, mat: color, tile: 1 });
    }
    return { center: c, size };
  }

  /** A shipping container: scenery, or something solid to land on with `collide`. */
  container({ pos, yaw = 0, color = 'steelBlue', collide = true }) {
    const m = new THREE.Mesh(containerGeometry(), containerMat(color));
    m.castShadow = m.receiveShadow = true;
    m.position.set(pos[0], pos[1] + BOX[1] / 2, pos[2]);
    m.rotation.y = yaw * D2R;
    this.add(m);
    if (collide) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * D2R);
      const b = this.fixedBody([pos[0], pos[1] + BOX[1] / 2, pos[2]], q);
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(BOX[0] / 2, BOX[1] / 2, BOX[2] / 2).setCollisionGroups(groups(Group.WORLD)), b, {
        kind: 'static',
        material: 'metal',
      });
    }
    return m;
  }

  lamp({ pos, yaw = 0, height = 7 }) {
    const g = new THREE.Group();
    const pole = this.mesh(new THREE.CylinderGeometry(0.07, 0.1, height, 10), 'steelGrey');
    pole.position.y = height / 2;
    const arm = this.mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), 'steelGrey');
    arm.position.set(0, height - 0.1, 0.55);
    const head = this.mesh(new THREE.BoxGeometry(0.4, 0.12, 0.6), 'darkSteel');
    head.position.set(0, height - 0.18, 1.1);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff3d6 }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, height - 0.25, 1.1);
    g.add(pole, arm, head, glow);
    g.position.set(...pos);
    g.rotation.y = yaw * D2R;
    this.add(g);
  }

  fence({ from, to, height = 2.2 }) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const len = a.distanceTo(b);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const g = new THREE.Group();
    const posts = Math.max(2, Math.round(len / 3) + 1);
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, height, 8);
    this.disposables.push(postGeo);
    for (let i = 0; i < posts; i++) {
      const p = new THREE.Mesh(postGeo, Mat.steelGrey());
      p.position.set(0, height / 2, (i / (posts - 1)) * len);
      p.castShadow = true;
      g.add(p);
    }
    const meshMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.7, roughness: 0.5, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const panel = this.mesh(new THREE.PlaneGeometry(len, height * 0.9), meshMat, { cast: false });
    panel.rotation.y = Math.PI / 2;
    panel.position.set(0, height * 0.5, len / 2);
    g.add(panel);
    for (const y of [height - 0.03, 0.15]) {
      const rail = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), 'steelGrey');
      rail.rotation.x = Math.PI / 2;
      rail.position.set(0, y, len / 2);
      g.add(rail);
    }
    g.position.copy(a);
    g.rotation.y = yaw;
    this.add(g);
  }

  /** Painted marking on the ground (plain coloured quad). */
  paint({ pos, size, yaw = 0, color = 0xf2f2ee, opacity = 0.85 }) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = yaw * D2R;
    m.position.set(pos[0], (pos[1] ?? 0) + 0.005, pos[2]);
    m.receiveShadow = true;
    this.add(m);
    return m;
  }

  /** Kinematic body moved by `fn(t) -> { pos: [x,y,z], rot?: Quaternion }` every physics step. */
  mover({ body, object, fn }) {
    const m = { body, object, fn };
    this.movers.push(m);
    const p = fn(0);
    body.setTranslation({ x: p.pos[0], y: p.pos[1], z: p.pos[2] }, true);
    if (p.rot) body.setRotation(p.rot, true);
    if (object) this.physics.link(body, object);
    return m;
  }

  stepMovers() {
    const t = this.physics.time + 1 / 60;
    for (const m of this.movers) {
      const p = m.fn(t);
      m.body.setNextKinematicTranslation({ x: p.pos[0], y: p.pos[1], z: p.pos[2] });
      if (p.rot) m.body.setNextKinematicRotation(p.rot);
      if (m.object && !m.linked) {
        this.physics.link(m.body, m.object);
        m.linked = true;
      }
    }
  }

  update(dt) {
    for (const t of this.targets) {
      if (t.hit && t.flip < 1) {
        t.flip = Math.min(1, t.flip + dt * 3);
        const k = t.flip;
        t.board.rotation.x = -(Math.PI / 2) * (1 - Math.pow(1 - k, 3)) * 0.92;
      }
    }
    for (const s of this.springs) {
      s.squash = Math.max(0, s.squash - dt * 4);
      s.pad.scale.y = 1 - s.squash * 0.8;
    }
  }

  dispose() {
    this.ctx.scene.remove(this.group);
    for (const g of this.disposables) g.dispose();
  }
}
