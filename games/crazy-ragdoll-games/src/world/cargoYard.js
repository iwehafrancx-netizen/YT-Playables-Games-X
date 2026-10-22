import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOX, containerGeometry } from './world.js';
import { Mat, containerMat } from '../render/materials.js';

const BOX_COLORS = ['steelBlue', 'steelRed', 'steelGreen', 'steelOrange', 'steelGrey', 'steelBlue', 'steelRed'];
const BARREL_COLORS = ['steelRed', 'steelBlue', 'steelOrange', 'steelGreen'];
const [BOX_W, BOX_H, BOX_L] = BOX;
const _m = new THREE.Matrix4();
const _o = new THREE.Object3D();

/**
 * Collects every copy of the same scenery piece and draws them all as one
 * instanced mesh: a yard is hundreds of boxes, which would otherwise be
 * hundreds of draw calls.
 */
class Batch {
  constructor(world) {
    this.world = world;
    this.sets = new Map();
  }

  add(key, geometry, material, matrix) {
    if (!this.sets.has(key)) this.sets.set(key, { geometry, material, matrices: [] });
    this.sets.get(key).matrices.push(matrix.clone());
  }

  build() {
    for (const { geometry, material, matrices } of this.sets.values()) {
      const m = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((x, i) => m.setMatrixAt(i, x));
      m.castShadow = m.receiveShadow = true;
      m.computeBoundingSphere();
      this.world.add(m);
      this.world.disposables.push({ dispose: () => m.dispose() });
    }
  }
}

/** Matrix for a piece at `pos` turned `yaw` radians, inside a group placed at `at`, turned `turn`. */
function place(pos, yaw = 0, at = null, turn = 0) {
  _o.position.set(...pos);
  _o.rotation.set(0, yaw, 0);
  _o.updateMatrix();
  if (!at) return _o.matrix;
  return _m.makeRotationY(turn).setPosition(...at).multiply(_o.matrix);
}

const shapes = new Map();
/** Scenery shapes shared across levels (never disposed). */
function shape(key, make) {
  if (!shapes.has(key)) shapes.set(key, make());
  return shapes.get(key);
}

/** Small seeded random, so a level's yard looks the same every time it loads. */
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * The shipping yard every game is played in: concrete, painted lines, walls of
 * stacked containers, a dock crane, and crates, barrels and pallets lying about.
 * Everything here is scenery; knockable props come from `clutter()`.
 *
 * `run` stretches the dressing along a course: { axis: 'x' | 'z', to } lines
 * the far side of a sideways course, or both sides of one heading away.
 * `flip` puts the back wall at +z, for games filmed looking that way.
 */
export function cargoYard(world, { y = 0, extent = 34, run = null, seed = 7, flip = false, mat = 'concrete' } = {}) {
  const rand = seeded(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const reach = run ? run.to + 60 : 0;
  const batch = new Batch(world);
  const stack = (at, yaw, high) => {
    for (let i = 0; i < high; i++) {
      const color = pick(BOX_COLORS);
      batch.add(`box:${color}`, containerGeometry(), containerMat(color), place([at[0], at[1] + i * BOX_H + BOX_H / 2, at[2]], THREE.MathUtils.degToRad(yaw + (i % 2 ? 2 : -1))));
    }
  };
  const pile = (at) => heap(batch, at, rand);
  world.ground({ y, mat, size: Math.max(240, reach * 2.2), tile: 6 });
  const Z = flip ? -1 : 1;
  lines(world, y, extent, Z);

  if (!run) {
    // A U of container stacks round the back and sides, with the crane behind.
    for (let x = -extent; x <= extent; x += BOX_L + 0.6) stack([x, y, -extent * Z], 90, 1 + Math.floor(rand() * 3));
    for (const s of [-1, 1]) for (let z = -extent + 8; z <= extent * 0.35; z += BOX_W + 0.5) stack([s * extent, y, z * Z], 0, 1 + Math.floor(rand() * 3));
    crane(world, [extent * 0.25, y, (-extent - 6) * Z], 0);
    for (const [x, z] of [[-0.55, -0.6], [0.6, -0.55], [-0.75, -0.1], [0.72, 0.05], [-0.35, -0.75], [0.3, -0.72]]) pile([x * extent, y, z * extent * Z]);
    for (const s of [-1, 1]) world.lamp({ pos: [s * extent * 0.8, y, -extent * 0.8 * Z], yaw: s * -40 + (flip ? 180 : 0) });
  } else if (run.axis === 'x') {
    // Side-on course: one long wall of containers behind it, with piles in front.
    const back = -16;
    for (let x = -30; x <= run.to + 40; x += BOX_L + 0.4) stack([x, y, back + rand() * 2], 90, 1 + Math.floor(rand() * 3));
    for (let x = -24; x <= run.to + 30; x += 34) crane(world, [x + 10, y, back - 7], 90);
    for (let x = -18; x <= run.to + 20; x += 9 + rand() * 6) pile([x, y, -8 - rand() * 3]);
    for (let x = -10; x <= run.to + 20; x += 30) world.lamp({ pos: [x, y, -10], yaw: 180 });
  } else {
    // Course heading away from the camera: containers down both sides.
    for (const s of [-1, 1]) {
      for (let z = -12; z <= run.to + 40; z += BOX_W + 0.5) stack([s * (run.side ?? 14) + s * rand(), y, z], 0, 1 + Math.floor(rand() * 3));
      for (let z = -4; z <= run.to + 20; z += 12 + rand() * 8) pile([s * ((run.side ?? 14) - 4), y, z]);
    }
    crane(world, [0, y, run.to + 45], 0);
  }
  batch.build();
}

/** Yellow bay markings and a hazard stripe, so the concrete isn't one flat grey. */
function lines(world, y, extent, Z) {
  const yellow = 0xf2c230;
  for (const x of [-extent * 0.5, extent * 0.5]) world.paint({ pos: [x, y, -extent * 0.2 * Z], size: [0.25, extent * 1.4], color: yellow, opacity: 0.8 });
  world.paint({ pos: [0, y, -extent * 0.55 * Z], size: [extent * 1.5, 0.25], color: yellow, opacity: 0.8 });
  for (let i = -6; i <= 6; i++) world.paint({ pos: [i * 1.6, y, -extent * 0.9 * Z], size: [0.7, 1.4], yaw: 35, color: yellow, opacity: 0.6 });
}

/** A ship-to-shore crane: two yellow legs, a long beam and a hanging hook. */
function crane(world, [x, y, z], yaw) {
  const g = new THREE.Group();
  const H = 18;
  const leg = new THREE.BoxGeometry(0.7, H, 0.7);
  for (const lx of [-7, 7]) for (const lz of [-3, 3]) {
    const m = world.mesh(leg, 'toyYellow');
    m.position.set(lx, H / 2, lz);
    g.add(m);
  }
  for (const lx of [-7, 7]) {
    const tie = world.mesh(new THREE.BoxGeometry(0.5, 0.5, 6.6), 'toyYellow');
    tie.position.set(lx, H * 0.55, 0);
    g.add(tie);
  }
  const beam = world.mesh(new THREE.BoxGeometry(30, 1.2, 1.4), 'toyYellow');
  beam.position.set(4, H + 0.6, 0);
  const cab = world.mesh(new THREE.BoxGeometry(2.2, 1.8, 2), 'white');
  cab.position.set(10, H - 0.9, 0);
  const cable = world.mesh(new THREE.CylinderGeometry(0.05, 0.05, 7, 6), 'darkSteel');
  cable.position.set(10, H - 4.5, 0);
  const hook = world.mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), 'darkSteel');
  hook.position.set(10, H - 8.2, 0);
  g.add(beam, cab, cable, hook);
  g.position.set(x, y, z);
  g.rotation.y = THREE.MathUtils.degToRad(yaw);
  world.add(g);
}

/** Scenery heap: a crate pyramid, a barrel group, or a pallet stack with a box. */
function heap(batch, [x, y, z], rand) {
  const kind = Math.floor(rand() * 3);
  const at = [x, y, z];
  const turn = rand() * Math.PI;
  if (kind === 0) {
    const geo = shape('crate', () => new RoundedBoxGeometry(1.1, 1.1, 1.1, 2, 0.04));
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 3 - r; i++) batch.add('crate', geo, Mat.crate(), place([i * 1.15 + r * 0.57 - 1.15, 0.55 + r * 1.1, 0], (rand() - 0.5) * 0.3, at, turn));
    }
  } else if (kind === 1) {
    const geo = shape('barrel', () => new THREE.CylinderGeometry(0.3, 0.3, 0.88, 18));
    for (let i = 0; i < 7; i++) {
      const color = BARREL_COLORS[i % BARREL_COLORS.length];
      const r = i ? 0.68 : 0;
      batch.add(`barrel:${color}`, geo, Mat[color](), place([Math.cos(i * 2.4) * r, 0.44 + (i > 4 ? 0.88 : 0), Math.sin(i * 2.4) * r], 0, at, turn));
    }
  } else {
    const pallet = shape('pallet', () => new THREE.BoxGeometry(1.2, 0.14, 1));
    for (let i = 0; i < 6; i++) batch.add('pallet', pallet, Mat.crate(), place([(rand() - 0.5) * 0.1, 0.07 + i * 0.15, (rand() - 0.5) * 0.1], 0, at, turn));
    const box = shape('box', () => new RoundedBoxGeometry(0.9, 0.7, 0.8, 2, 0.03));
    batch.add('cardboard', box, Mat.cardboard(), place([1.4, 0.35, 0.2], 0, at, turn));
  }
}

/**
 * Knockable props where ragdolls are going to land: little crate pyramids,
 * barrel clusters and cardboard boxes that scatter when he crashes into them.
 */
export function clutter(world, spots, y = 0) {
  spots.forEach(([x, z], i) => {
    const kind = i % 3;
    if (kind === 0) {
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2 - r; k++) world.crate({ pos: [x + k * 0.84 + r * 0.42 - 0.42, y + 0.41 + r * 0.82, z], size: 0.8 });
    } else if (kind === 1) {
      for (let k = 0; k < 3; k++) world.barrel({ pos: [x + (k - 1) * 0.64, y + 0.45, z + (k % 2) * 0.3], color: BARREL_COLORS[(i + k) % BARREL_COLORS.length] });
    } else {
      for (let k = 0; k < 3; k++) world.crate({ pos: [x + (k % 2) * 0.3, y + 0.31 + k * 0.62, z], size: 0.6, kind: 'cardboard', rot: [0, k * 25, 0] });
    }
  });
}
