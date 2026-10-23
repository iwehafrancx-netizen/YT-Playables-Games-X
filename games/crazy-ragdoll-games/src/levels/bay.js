// Ballistics Bay. Cannon sits at the origin facing +Z unless a level says otherwise.

function crateStack(w, x, z, rows, { size = 0.8, kind = 'crate', yaw = 0 } = {}) {
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * size * 1.02;
      w.crate({ pos: [x + off, size / 2 + r * size + 0.01, z], size, kind, rot: [0, yaw + (Math.random() - 0.5) * 4, 0] });
    }
  }
}

function tower(w, x, z, h, { size = 0.8, kind = 'crate' } = {}) {
  for (let i = 0; i < h; i++) w.crate({ pos: [x, size / 2 + i * size + 0.01, z], size, kind, rot: [0, (Math.random() - 0.5) * 6, 0] });
}

export const BAY = [
  {
    name: 'First Flight',
    theme: 'morning',
    speed: 16,
    shots: 3,
    par: 1,
    pitch: 30,
    reveal: 0.6,
    hint: 'Drag to aim · release to fire',
    build(w) {
      w.bullseye({ pos: [0, 2.2, 21], radius: 1.1 });
      w.paint({ pos: [0, 0, 21], size: [6, 6], color: 0xf2b705, opacity: 0.25 });
      for (const x of [-3.5, 3.5]) w.cone({ pos: [x, 0.27, 17] });
      crateStack(w, -6, 24, 2);
      crateStack(w, 6, 25, 2, { kind: 'cardboard', size: 0.6 });
    },
  },
  {
    name: 'Crate Stack',
    theme: 'morning',
    speed: 16,
    shots: 4,
    par: 2,
    pitch: 34,
    hint: 'Crates can hit targets too — trick shots score extra',
    build(w) {
      w.block({ pos: [-3, 1.5, 20], size: [1.2, 3, 1.2], mat: 'concreteDark', tile: 1.5 });
      w.bullseye({ pos: [-3, 3.75, 20], radius: 0.75, post: false });
      for (let i = 0; i < 6; i++) w.crate({ pos: [-3.8 + (i % 3) * 0.82, 0.41 + Math.floor(i / 3) * 0.8, 17] });
      w.bullseye({ pos: [3, 1.5, 23.5], radius: 0.9 });
      for (let i = 0; i < 8; i++) w.crate({ pos: [1.8 + (i % 4) * 0.62, 0.31 + Math.floor(i / 4) * 0.6, 21], size: 0.6, kind: 'cardboard' });
      crateStack(w, 0, 27, 3, { kind: 'cardboard', size: 0.6 });
    },
  },
  {
    name: 'High Shelf',
    theme: 'noon',
    speed: 17,
    shots: 4,
    par: 2,
    pitch: 40,
    hint: 'Bounce off the trampoline to reach the top shelf',
    build(w) {
      w.block({ pos: [-4, 1.5, 20], size: [3, 3, 3], mat: 'steelBlue', tile: 1 });
      w.bullseye({ pos: [-4, 4, 20], radius: 0.85 });
      w.block({ pos: [4.5, 2.5, 24], size: [3, 5, 3], mat: 'steelGreen', tile: 1 });
      w.bullseye({ pos: [4.5, 6, 24], radius: 0.85 });
      w.trampoline({ pos: [2.5, 0.5, 13], size: [2.6, 2.6], power: 12 });
      w.paint({ pos: [2.5, 0, 13], size: [3.6, 3.6], color: 0xf2b705, opacity: 0.3 });
      tower(w, -4, 23, 2, { kind: 'cardboard', size: 0.6 });
      crateStack(w, 0, 24, 2);
    },
  },
  {
    name: 'Moving Day',
    theme: 'noon',
    speed: 17,
    shots: 5,
    par: 3,
    pitch: 34,
    hint: 'Lead your shot — targets are on the move',
    build(w) {
      w.block({ pos: [0, 0.1, 18], size: [12, 0.2, 0.4], mat: 'hazard', tile: 1 });
      w.bullseye({ pos: [0, 2.0, 18], radius: 0.8, move: (t) => [Math.sin(t * 0.9) * 5, 0, 0] });
      w.bullseye({ pos: [-4, 3.0, 25], radius: 0.8, move: (t) => [0, Math.sin(t * 1.3) * 1.5, 0] });
      w.bullseye({ pos: [5, 2.0, 27], radius: 0.9, move: (t) => [Math.sin(t * 0.6 + 1) * 2.5, 0, Math.cos(t * 0.6 + 1) * 2.5] });
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 3 - r; i++) w.barrel({ pos: [-7 + i * 0.64 + r * 0.32, 0.45 + r * 0.9, 21] });
      }
      crateStack(w, 7, 21, 2);
    },
  },
  {
    name: 'Through the Window',
    theme: 'sunset',
    speed: 18,
    shots: 5,
    par: 3,
    pitch: 26,
    reveal: 0.45,
    lookAhead: 16,
    hint: 'Thread the window or lob over the wall',
    build(w) {
      const z = 14;
      // Wall with a single window, left of centre
      w.block({ pos: [-4.75, 2.5, z], size: [6.5, 5, 0.6], mat: 'wall', tile: 2 });
      w.block({ pos: [4, 2.5, z], size: [8, 5, 0.6], mat: 'wall', tile: 2 });
      w.block({ pos: [-0.75, 1.0, z], size: [1.5, 2, 0.6], mat: 'wall', tile: 2 });
      w.block({ pos: [-0.75, 4.5, z], size: [1.5, 1, 0.6], mat: 'wall', tile: 2 });
      w.block({ pos: [-0.75, 2.02, z], size: [1.7, 0.08, 0.8], mat: 'hazard', tile: 1 });
      w.bullseye({ pos: [-1, 1.8, 20], radius: 0.85 });
      w.bullseye({ pos: [4, 2.2, 24], radius: 1 });
      w.bullseye({ pos: [-5, 1.6, 26], radius: 1 });
      crateStack(w, 2, 19, 3, { kind: 'cardboard', size: 0.6 });
      tower(w, -5, 22, 2);
      for (let i = 0; i < 4; i++) w.barrel({ pos: [6 + (i % 2) * 0.65, 0.45, 20 + Math.floor(i / 2) * 0.65] });
    },
  },
  {
    name: 'Skyline',
    theme: 'sunset',
    speed: 19,
    shots: 5,
    par: 3,
    pitch: 40,
    reveal: 0.4,
    lookAhead: 18,
    hint: 'One on the roof, one behind the wall, one riding the lift',
    build(w) {
      w.container({ pos: [-5, 0, 26], yaw: 90, color: 'steelBlue' });
      w.container({ pos: [-5, 2.6, 26], yaw: 93, color: 'steelRed' });
      w.bullseye({ pos: [-5, 6.05, 25.3], radius: 0.85, post: false });
      w.block({ pos: [4.5, 1.6, 17], size: [6, 3.2, 0.6], mat: 'wall', tile: 2 });
      w.bullseye({ pos: [4.5, 1.6, 22.5], radius: 0.9 });
      w.block({ pos: [1, 0.1, 30], size: [0.4, 0.2, 0.4], mat: 'hazard', tile: 1 });
      w.bullseye({ pos: [1, 3.6, 30], radius: 0.8, move: (t) => [0, Math.sin(t * 1.1) * 2.4, 0] });
      crateStack(w, 0, 23, 3, { kind: 'cardboard', size: 0.6 });
      for (let i = 0; i < 4; i++) w.barrel({ pos: [7 + (i % 2) * 0.65, 0.45, 24 + Math.floor(i / 2) * 0.65] });
    },
  },
  {
    name: 'Spin Cycle',
    theme: 'dusk',
    speed: 18,
    shots: 5,
    par: 3,
    pitch: 32,
    reveal: 0.4,
    hint: 'Fire between the blades',
    build(w) {
      w.rotor({ pos: [0, 2.6, 15], length: 5, speed: 1.3 });
      w.block({ pos: [0, 1.2, 15.4], size: [0.4, 2.4, 0.4], mat: 'steelGrey', tile: 1 });
      w.bullseye({ pos: [0, 2.6, 20], radius: 0.9 });
      w.spinner({ pos: [-5.5, 0, 19], length: 6, height: 1.6, speed: 1.6 });
      w.bullseye({ pos: [-5.5, 2.8, 23], radius: 0.85 });
      w.bullseye({ pos: [6, 1.8, 24], radius: 0.85, move: (t) => [Math.sin(t * 1.2) * 2.2, 0, 0] });
      w.block({ pos: [6, 0.1, 24], size: [5, 0.2, 0.4], mat: 'hazard', tile: 1 });
      tower(w, 3, 26, 3, { kind: 'cardboard', size: 0.6 });
      crateStack(w, -2, 27, 2);
    },
  },
  {
    name: 'Long Shot',
    theme: 'dusk',
    speed: 21,
    shots: 6,
    par: 4,
    pitch: 30,
    reveal: 0.32,
    lookAhead: 24,
    hint: 'Far, small and moving. Take your time.',
    build(w) {
      w.bullseye({ pos: [-7, 2, 32], radius: 0.75 });
      w.block({ pos: [0, 2, 36], size: [2, 4, 2], mat: 'steelOrange', tile: 1 });
      w.bullseye({ pos: [0, 4.85, 35.6], radius: 0.8, post: false });
      w.bullseye({ pos: [6, 2.5, 36], radius: 0.75, move: (t) => [0, 0, Math.sin(t * 0.8) * 3] });
      w.bullseye({ pos: [10, 1.6, 28], radius: 0.7 });
      for (let i = 0; i < 6; i++) w.barrel({ pos: [9 + (i % 3) * 0.66, 0.45, 25.5 + Math.floor(i / 3) * 0.7] });
      crateStack(w, -4, 36, 3);
      tower(w, 3, 33, 4, { kind: 'cardboard', size: 0.6 });
    },
  },
];
