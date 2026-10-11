// Drop Test. Stars are run scores; calibrated against simulated shoves.

function landing(w, { x = 0, z = -1.5, h, width = 3.2, depth = 3 }) {
  w.block({ pos: [x, h / 2, z], size: [width, h, depth], mat: 'concreteDark', tile: 1.5 });
  w.block({ pos: [x, h + 0.02, z + depth / 2 - 0.15], size: [width, 0.04, 0.3], mat: 'hazard', tile: 1 });
}

function sideWalls(w, { from, to, h, x = 1.75, thick = 0.2 }) {
  for (const sx of [-x, x]) w.block({ pos: [sx, h / 2, (from + to) / 2], size: [thick, h, to - from], mat: 'wall', tile: 2 });
}

export const DROP = [
  {
    name: 'Stair Master',
    theme: 'overcast',
    start: [0, 4.2, -0.6],
    stars: [750, 1250, 1750],
    hint: 'Drag to aim your shove · release to push him down the stairs',
    camAim: [7.5, -0.6, 3.2],
    lookAim: [0, -2, 3.4],
    camFall: [6.5, 2.2, -1],
    build(w) {
      landing(w, { h: 4.2 });
      w.stairs({ pos: [0, 4.2, 0], count: 14, rise: 0.3, run: 0.55, width: 3.2 });
      sideWalls(w, { from: -3, to: 7.7, h: 1.1, x: 1.7 });
      w.cone({ pos: [0.6, 0.27, 9.5] });
      w.cone({ pos: [-0.6, 0.27, 10.2] });
      w.crate({ pos: [0, 0.41, 11.5] });
    },
  },
  {
    name: 'Barrel Roll',
    theme: 'overcast',
    start: [0, 5.4, -0.6],
    stars: [1000, 1800, 2800],
    hint: 'Barrels on the stairs add bonus damage. Land in the skip for a big bonus!',
    camAim: [8.5, -0.8, 4.2],
    lookAim: [0, -2.6, 4.6],
    camFall: [6.5, 2.4, -1],
    build(w, L) {
      landing(w, { h: 5.4 });
      w.stairs({ pos: [0, 5.4, 0], count: 18, rise: 0.3, run: 0.55, width: 3.4 });
      for (let i = 0; i < 5; i++) {
        const step = 3 + i * 3;
        w.barrel({ pos: [(i % 2 ? 0.8 : -0.8), 5.4 - step * 0.3 + 0.46, (step + 0.5) * 0.55], color: i % 2 ? 'steelBlue' : 'steelRed' });
      }
      w.dumpster({ pos: [0, 0, 12.6] });
      L.zone({ pos: [0, 0.7, 12.6], size: [2.4, 1.4, 1.6], points: 1500, label: 'IN THE SKIP!' });
      for (let i = 0; i < 4; i++) w.crate({ pos: [-2.2 + (i % 2) * 0.82, 0.41 + Math.floor(i / 2) * 0.8, 11] });
    },
  },
  {
    name: 'Scaffold',
    theme: 'overcast',
    start: [0, 9.1, -0.6],
    stars: [1100, 2200, 3500],
    hint: 'Three tiers of loose planks. Make it rain.',
    camAim: [6, 1, -5],
    lookAim: [0, -3.5, 4],
    camFall: [6.5, 3, -4],
    build(w) {
      const tiers = [
        { y: 9, z: 0 },
        { y: 6, z: 3.4 },
        { y: 3, z: 6.8 },
      ];
      for (const t of tiers) {
        for (const sx of [-1.3, 1.3]) {
          for (const sz of [-1.3, 1.3]) {
            w.block({ pos: [sx, t.y / 2, t.z + sz], size: [0.12, t.y, 0.12], mat: 'steelGrey', tile: 1 });
          }
          w.block({ pos: [sx, t.y - 0.1, t.z], size: [0.16, 0.16, 2.8], mat: 'steelOrange', tile: 1 });
        }
        for (let i = 0; i < 6; i++) {
          w.plank({ pos: [-1.0 + i * 0.4, t.y + 0.05, t.z], size: [0.36, 0.06, 3.0], mass: 6 });
        }
      }
      for (let i = 0; i < 6; i++) w.barrel({ pos: [-1 + (i % 3) * 0.66, 0.45, 10 + Math.floor(i / 3) * 0.7] });
      w.crate({ pos: [1.8, 0.41, 9.5] });
      w.crate({ pos: [1.8, 1.21, 9.5] });
    },
  },
  {
    name: 'Plinko',
    theme: 'dusk',
    start: [-4.3, 12.47, 0],
    facing: 90,
    stars: [1200, 2600, 4200],
    hint: 'Shove him off the ledge and aim for the centre bin',
    camAim: [3.4, -3.6, 15],
    lookAim: [3.4, -4.2, 0],
    camFall: [0, 1, 13],
    fences: false,
    build(w, L) {
      // Back board and a glass front keep the fall in one plane.
      w.block({ pos: [0, 7, -0.95], size: [11.4, 14, 0.2], mat: 'steelBlue', tile: 2 });
      w.block({ pos: [0, 7, 0.95], size: [11.4, 14, 0.12], mat: 'glass', cast: false });
      for (const sx of [-5.6, 5.6]) w.block({ pos: [sx, 7, 0], size: [0.2, 14, 2], mat: 'steelGrey', tile: 1 });
      w.block({ pos: [-4.4, 12.3, 0], size: [2.2, 0.3, 1.8], mat: 'hazard', tile: 1 });
      for (let row = 0; row < 7; row++) {
        const y = 10.6 - row * 1.3;
        const offset = row % 2 ? 0.65 : 0;
        for (let x = -4.55 + offset; x <= 4.6; x += 1.3) {
          if (row === 0 && x < -3) continue;
          w.rod({ pos: [x, y, 0], radius: 0.13, length: 1.8, axis: 'z', mat: 'steel', restitution: 0.5 });
        }
      }
      const bins = [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5];
      for (let i = 1; i < bins.length - 1; i++) w.block({ pos: [bins[i], 0.8, 0], size: [0.14, 1.6, 1.8], mat: 'hazard', tile: 1 });
      const pts = [400, 1200, 2500, 1200, 400];
      const labels = ['BIN', 'GOOD BIN', 'JACKPOT!', 'GOOD BIN', 'BIN'];
      for (let i = 0; i < 5; i++) {
        L.zone({ pos: [(bins[i] + bins[i + 1]) / 2, 0.8, 0], size: [2.1, 1.6, 1.8], points: pts[i], label: labels[i] });
      }
    },
  },
  {
    name: 'The Gauntlet',
    theme: 'dusk',
    start: [0, 6.2, -0.8],
    stars: [1000, 2000, 3200],
    hint: 'Ramp, sweeper, trampoline, crates. Finish in the skip.',
    camAim: [6, 1.4, -5],
    lookAim: [0, -2.5, 5],
    camFall: [7, 3.5, -3],
    maxPush: 7,
    build(w, L) {
      landing(w, { h: 6.2, depth: 3.2 });
      w.ramp({ from: [0, 6.2, 0], to: [0, 0.6, 9], width: 3.2, mat: 'steelGrey', tile: 1.5, friction: 0.25 });
      w.block({ pos: [0, 0.3, 10.5], size: [3.2, 0.6, 3], mat: 'concreteDark', tile: 1.5 });
      sideWalls(w, { from: -3, to: 12, h: 0.9, x: 1.75 });
      w.spinner({ pos: [0, 0.6, 10.6], length: 3.2, height: 0.75, speed: 2.4 });
      w.trampoline({ pos: [0, 0.5, 14], size: [2.6, 2.6], power: 12 });
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 3 - r; i++) w.crate({ pos: [-0.82 + i * 0.82 + r * 0.41, 0.41 + r * 0.8, 18.5] });
      }
      w.dumpster({ pos: [0, 0, 22] });
      L.zone({ pos: [0, 0.7, 22], size: [2.4, 1.4, 1.6], points: 2000, label: 'IN THE SKIP!' });
      w.cone({ pos: [2, 0.27, 16] });
      w.cone({ pos: [-2, 0.27, 16] });
    },
  },
];
