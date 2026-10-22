import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BOX_COLORS = ['steelBlue', 'steelRed', 'steelGreen', 'steelOrange', 'steelGrey', 'steelBlue', 'steelRed'];
const BARREL_COLORS = ['steelRed', 'steelBlue', 'steelOrange', 'steelGreen'];
const BOX_W = 2.44;
const BOX_H = 2.6;
const BOX_L = 6.06;

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
export function cargoYard(world, { y = 0, extent = 34, run = null, seed = 7, flip = false } = {}) {
  const rand = seeded(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const reach = run ? run.to + 60 : 0;
  world.ground({ y, size: Math.max(240, reach * 2.2), tile: 6 });
  const Z = flip ? -1 : 1;
  lines(world, y, extent, Z);

  if (!run) {
    // A U of container stacks round the back and sides, with the crane behind.
    for (let x = -extent; x <= extent; x += BOX_L + 0.6) stack(world, [x, y, -extent * Z], 90, 1 + Math.floor(rand() * 3), pick);
    for (const s of [-1, 1]) for (let z = -extent + 8; z <= extent * 0.35; z += BOX_W + 0.5) stack(world, [s * extent, y, z * Z], 0, 1 + Math.floor(rand() * 3), pick);
    crane(world, [extent * 0.25, y, (-extent - 6) * Z], 0);
    for (const [x, z] of [[-0.55, -0.6], [0.6, -0.55], [-0.75, -0.1], [0.72, 0.05], [-0.35, -0.75], [0.3, -0.72]]) pile(world, [x * extent, y, z * extent * Z], rand);
    for (const s of [-1, 1]) world.lamp({ pos: [s * extent * 0.8, y, -extent * 0.8 * Z], yaw: s * -40 + (flip ? 180 : 0) });
  } else if (run.axis === 'x') {
    // Side-on course: one long wall of containers behind it, with piles in front.
    const back = -16;
    for (let x = -30; x <= run.to + 40; x += BOX_L + 0.4) stack(world, [x, y, back + rand() * 2], 90, 1 + Math.floor(rand() * 3), pick);
    for (let x = -24; x <= run.to + 30; x += 34) crane(world, [x + 10, y, back - 7], 90);
    for (let x = -18; x <= run.to + 20; x += 9 + rand() * 6) pile(world, [x, y, -8 - rand() * 3], rand);
    for (let x = -10; x <= run.to + 20; x += 30) world.lamp({ pos: [x, y, -10], yaw: 180 });
  } else {
    // Course heading away from the camera: containers down both sides.
    for (const s of [-1, 1]) {
      for (let z = -12; z <= run.to + 40; z += BOX_W + 0.5) stack(world, [s * (run.side ?? 14) + s * rand(), y, z], 0, 1 + Math.floor(rand() * 3), pick);
      for (let z = -4; z <= run.to + 20; z += 12 + rand() * 8) pile(world, [s * ((run.side ?? 14) - 4), y, z], rand);
    }
    crane(world, [0, y, run.to + 45], 0);
  }
}

/** Yellow bay markings and a hazard stripe, so the concrete isn't one flat grey. */
function lines(world, y, extent, Z) {
  const yellow = 0xf2c230;
  for (const x of [-extent * 0.5, extent * 0.5]) world.paint({ pos: [x, y, -extent * 0.2 * Z], size: [0.25, extent * 1.4], color: yellow, opacity: 0.8 });
  world.paint({ pos: [0, y, -extent * 0.55 * Z], size: [extent * 1.5, 0.25], color: yellow, opacity: 0.8 });
  for (let i = -6; i <= 6; i++) world.paint({ pos: [i * 1.6, y, -extent * 0.9 * Z], size: [0.7, 1.4], yaw: 35, color: yellow, opacity: 0.6 });
}

function stack(world, [x, y, z], yaw, high, pick) {
  for (let i = 0; i < high; i++) world.container({ pos: [x, y + i * BOX_H, z], yaw: yaw + (i % 2 ? 2 : -1), color: pick(BOX_COLORS), collide: false });
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

/** Scenery heap: crates on a pallet, a barrel group, or a pallet stack. */
function pile(world, [x, y, z], rand) {
  const kind = Math.floor(rand() * 3);
  const g = new THREE.Group();
  if (kind === 0) {
    const crate = new RoundedBoxGeometry(1.1, 1.1, 1.1, 2, 0.04);
    world.disposables.push(crate);
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 3 - r; i++) {
        const m = world.mesh(crate, 'crate');
        m.position.set(i * 1.15 + r * 0.57 - 1.15, 0.55 + r * 1.1, 0);
        m.rotation.y = (rand() - 0.5) * 0.3;
        g.add(m);
      }
    }
  } else if (kind === 1) {
    const barrel = new THREE.CylinderGeometry(0.3, 0.3, 0.88, 18);
    world.disposables.push(barrel);
    for (let i = 0; i < 7; i++) {
      const m = world.mesh(barrel, BARREL_COLORS[i % BARREL_COLORS.length]);
      const a = i * 2.4;
      const r = i ? 0.68 : 0;
      m.position.set(Math.cos(a) * r, 0.44 + (i > 4 ? 0.88 : 0), Math.sin(a) * r);
      g.add(m);
    }
  } else {
    const pallet = new THREE.BoxGeometry(1.2, 0.14, 1);
    world.disposables.push(pallet);
    for (let i = 0; i < 6; i++) {
      const m = world.mesh(pallet, 'crate');
      m.position.set((rand() - 0.5) * 0.1, 0.07 + i * 0.15, (rand() - 0.5) * 0.1);
      g.add(m);
    }
    const box = world.mesh(new RoundedBoxGeometry(0.9, 0.7, 0.8, 2, 0.03), 'cardboard');
    box.position.set(1.4, 0.35, 0.2);
    g.add(box);
  }
  g.position.set(x, y, z);
  g.rotation.y = rand() * Math.PI;
  world.add(g);
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
