// Cart Hill. Tracks run along +Z: `path.start` is the back of the top deck,
// each point is [z, height, profile]. 'bumper' ends stop the cart dead,
// 'kicker' ends send cart and passenger flying.

const bumps = (from, n, gap) => {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const z = from + i * gap;
    pts.push([z, 0, 'line'], [z + 0.8, 0.25, 'line'], [z + 1.6, 0, 'line']);
  }
  return pts;
};

export const CART = [
  {
    name: 'Aisle Five',
    theme: 'sunset',
    stars: [500, 900, 1300],
    hint: 'Hold to wind up · release to push. The bumper does the rest!',
    path: { start: [-4.5, 4], points: [[0, 4], [12, 0, 'ease'], [19.45, 0]], end: 'bumper' },
    build(w, L) {
      L.landing({ pos: [0, 0, 29], radius: 4.5 });
      w.cone({ pos: [-3.5, 0.27, 24] });
      w.cone({ pos: [3.5, 0.27, 31] });
    },
  },
  {
    name: 'Big Air',
    theme: 'sunset',
    stars: [700, 1250, 1800],
    hint: 'Tap BAIL just as you leave the kicker for extra air time',
    path: { start: [-4.5, 5], points: [[0, 5], [14, 0, 'ease'], [18, 0], [22, 1.2, 'kick']], end: 'kicker' },
    build(w, L) {
      L.landing({ pos: [0, 0, 33], radius: 5 });
      for (let i = 0; i < 4; i++) w.crate({ pos: [-4 + (i % 2) * 0.82, 0.41 + Math.floor(i / 2) * 0.8, 37] });
    },
  },
  {
    name: 'Mind the Gap',
    theme: 'dusk',
    stars: [800, 1400, 2000],
    hint: 'Clear the gap and stick the landing on the far deck',
    cam: [-8.5, 3.6, -2],
    path: { start: [-4.5, 6], points: [[0, 6], [13, 1.5, 'ease'], [17, 1.5], [20, 2.3, 'kick']], end: 'kicker' },
    build(w, L) {
      w.block({ pos: [0, 0.2, 24], size: [5.2, 0.4, 7.6], mat: 'foam', tile: 1 });
      w.block({ pos: [0, 0.75, 35], size: [8, 1.5, 14], mat: 'concreteDark', tile: 1.5 });
      L.landing({ pos: [0, 1.5, 34], radius: 4 });
      for (let i = 0; i < 6; i++) w.crate({ pos: [-1.2 + (i % 3) * 0.82, 1.91 + Math.floor(i / 3) * 0.8, 40.5] });
    },
  },
  {
    name: 'Bumpy Ride',
    theme: 'noon',
    stars: [900, 1500, 2200],
    hint: 'Speed bumps ahead. Crates around the target pay out too.',
    path: { start: [-4.5, 5], points: [[0, 5], [12, 0, 'ease'], [14.2, 0], ...bumps(14.2, 3, 4), [25.65, 0]], end: 'bumper' },
    build(w, L) {
      L.landing({ pos: [0, 0, 34], radius: 4.5 });
      for (const [x, z] of [[-3, 31], [3, 31], [-3, 37], [3, 37]]) {
        for (let i = 0; i < 3; i++) w.crate({ pos: [x, 0.41 + i * 0.8, z], size: 0.8 });
      }
      for (let i = 0; i < 4; i++) w.cone({ pos: [(i % 2 ? 1 : -1) * 2.6, 0.27, 15 + i * 3] });
    },
  },
  {
    name: 'Mega Ramp',
    theme: 'morning',
    stars: [1000, 1700, 2500],
    hint: 'The big one. Commit to the push and fly.',
    cam: [-10, 4.2, -3],
    maxTime: 20,
    extent: 60,
    path: { start: [-4.5, 10], points: [[0, 10], [22, 0, 'ease'], [25, 0], [30, 1.6, 'kick']], end: 'kicker' },
    build(w, L) {
      L.landing({ pos: [0, 0, 49], radius: 6, points: [300, 700, 1500] });
      for (let i = 0; i < 12; i++) w.crate({ pos: [-2 + (i % 4) * 0.82 + 0.41, 0.41 + Math.floor(i / 4) * 0.8, 58] });
      for (let i = 0; i < 6; i++) w.barrel({ pos: [5 + (i % 2) * 0.66, 0.45, 44 + Math.floor(i / 2) * 0.7] });
    },
  },
];
