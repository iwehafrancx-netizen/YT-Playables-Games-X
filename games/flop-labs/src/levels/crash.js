// Crash Course. The car starts at z = 0 and drives toward the barrier at `barrier`.

const SPACING = 0.88;
function rack(rows, z0) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i <= r; i++) out.push([(i - r / 2) * SPACING, z0 + r * SPACING * 0.866]);
  return out;
}

export const CRASH = [
  {
    name: 'Seatbelt Optional',
    theme: 'noon',
    barrier: 40,
    stars: [600, 1100, 1500],
    hint: 'Hold for gas, let go to coast · hit the wall at about 55 km/h',
    build(w, L) {
      L.landing({ pos: [0, 0, 56], radius: 5 });
      w.cone({ pos: [-3, 0.27, 48] });
      w.cone({ pos: [3, 0.27, 63] });
    },
  },
  {
    name: 'Bowling Through',
    theme: 'noon',
    barrier: 40,
    stars: [800, 1300, 1800],
    hint: 'Plough through the pins and land on the target',
    build(w, L) {
      for (const [x, z] of rack(4, 50)) w.pin({ pos: [x, 0, z], h: 1.1 });
      L.landing({ pos: [0, 0, 60], radius: 5 });
    },
  },
  {
    name: 'Short Runway',
    theme: 'morning',
    barrier: 24,
    stars: [500, 900, 1300],
    hint: 'Barely any runway — judge your speed',
    build(w, L) {
      L.landing({ pos: [0, 0, 41], radius: 4.5 });
      for (let i = 0; i < 6; i++) w.crate({ pos: [-4 + (i % 2) * 0.82, 0.41 + Math.floor(i / 2) * 0.8, 36] });
    },
  },
  {
    name: 'Over the Wall',
    theme: 'sunset',
    barrier: 40,
    stars: [600, 1000, 1500],
    hint: 'Fast enough to clear the wall, slow enough to stick the landing',
    build(w, L) {
      w.block({ pos: [0, 1.3, 49], size: [9, 2.6, 0.6], mat: 'wall', tile: 2 });
      L.landing({ pos: [0, 0, 60], radius: 4.5 });
    },
  },
  {
    name: 'Crate Smash',
    theme: 'sunset',
    barrier: 40,
    stars: [500, 900, 1300],
    hint: 'Every crate you smash scores',
    build(w, L) {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) w.crate({ pos: [-2.05 + x * 0.82, 0.41 + y * 0.8, 51] });
      L.landing({ pos: [0, 0, 60], radius: 4.5 });
    },
  },
  {
    name: 'Window Seat',
    theme: 'dusk',
    barrier: 40,
    stars: [600, 1100, 1500],
    hint: 'Fly him through the window',
    build(w, L) {
      const z = 49;
      w.block({ pos: [-3.25, 2.25, z], size: [3.5, 4.5, 0.5], mat: 'wall', tile: 2 });
      w.block({ pos: [3.25, 2.25, z], size: [3.5, 4.5, 0.5], mat: 'wall', tile: 2 });
      w.block({ pos: [0, 0.8, z], size: [3, 1.6, 0.5], mat: 'wall', tile: 2 });
      w.block({ pos: [0, 4.05, z], size: [3, 0.9, 0.5], mat: 'wall', tile: 2 });
      w.block({ pos: [0, 1.62, z], size: [3.2, 0.06, 0.7], mat: 'hazard', tile: 1 });
      L.landing({ pos: [0, 0, 57], radius: 4 });
    },
  },
];
