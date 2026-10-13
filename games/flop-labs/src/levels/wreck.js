// Wrecking Crew. The trolley runs along X between `span`; everything to wreck
// stands on the yard floor around z = 0. Stars are the share of props wrecked.

function tower(w, x, rows, { size = 0.8, kind = 'crate', base = 0 } = {}) {
  for (let i = 0; i < rows; i++) w.crate({ pos: [x, base + size / 2 + i * size + 0.01, 0], size, kind });
}

function pyramid(w, x, rows, { size = 0.8, kind = 'crate', base = 0 } = {}) {
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    for (let i = 0; i < n; i++) w.crate({ pos: [x + (i - (n - 1) / 2) * size * 1.02, base + size / 2 + r * size + 0.01, 0], size, kind });
  }
}

export const WRECK = [
  {
    name: 'Demo Day',
    theme: 'morning',
    hint: 'Drag left and right to swing him into the crates',
    time: 25,
    build(w) {
      for (const x of [-5, 0, 5]) tower(w, x, 4);
    },
  },
  {
    name: 'Barrel Bash',
    theme: 'morning',
    time: 25,
    build(w) {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) w.barrel({ pos: [-5 + i * 0.64 + r * 0.32, 0.45 + r * 0.9, 0], color: r % 2 ? 'steelBlue' : 'steelRed' });
      pyramid(w, 4, 4, { kind: 'cardboard', size: 0.7 });
    },
  },
  {
    name: 'Brick Wall',
    theme: 'noon',
    hint: 'A whole wall of crates. Swing low and through it.',
    time: 25,
    stars: [0.35, 0.6, 0.85],
    build(w) {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) w.crate({ pos: [-4.1 + x * 0.82 + (y % 2) * 0.2, 0.41 + y * 0.8, 0] });
    },
  },
  {
    name: 'High Rise',
    theme: 'noon',
    hint: 'Winch up to reach the top floors',
    time: 25,
    stars: [0.4, 0.65, 0.9],
    build(w) {
      w.block({ pos: [0, 1.1, 0], size: [3, 2.2, 2.4], mat: 'concreteDark', tile: 1.5 });
      tower(w, -0.6, 4, { kind: 'cardboard', size: 0.7, base: 2.2 });
      tower(w, 0.6, 4, { base: 2.2 });
      tower(w, -6, 3);
      tower(w, 6, 3);
    },
  },
  {
    name: 'Pin Palace',
    theme: 'sunset',
    time: 22,
    stars: [0.4, 0.65, 0.9],
    build(w) {
      for (let i = 0; i < 9; i++) w.pin({ pos: [-7 + i * 1.75, 0, 0], h: 1.8, mass: 12 });
      for (let i = 0; i < 4; i++) w.pin({ pos: [-5.25 + i * 3.5, 0, 1.2], h: 1.4, mass: 8 });
    },
  },
  {
    name: 'Spread Out',
    theme: 'sunset',
    hint: 'The yard is wide and the clock is short',
    time: 20,
    span: [-13, 13],
    stars: [0.4, 0.65, 0.9],
    build(w) {
      for (const x of [-11, -6, 0, 6, 11]) tower(w, x, 3);
      for (const x of [-8.5, 3]) for (let i = 0; i < 2; i++) w.barrel({ pos: [x + i * 0.65, 0.45, 0] });
    },
  },
  {
    name: 'The Big One',
    theme: 'dusk',
    hint: 'Everything must go',
    time: 30,
    span: [-12, 12],
    stars: [0.4, 0.65, 0.85],
    build(w) {
      pyramid(w, 0, 6);
      tower(w, -7, 5, { kind: 'cardboard', size: 0.7 });
      tower(w, 7, 5, { kind: 'cardboard', size: 0.7 });
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) w.barrel({ pos: [-11 + i * 0.64 + r * 0.32, 0.45 + r * 0.9, 0] });
      for (let i = 0; i < 3; i++) w.pin({ pos: [9.5 + i * 0.9, 0, 0], h: 1.6, mass: 10 });
    },
  },
];
