// Hammer Spin: targets sit out in the field (x across, z away from the circle).
export const HAMMER = [
  { name: 'Warm-Up Whirl', targets: [{ pos: [0, 10], radius: 3.2 }], stars: [250, 700, 1100], hint: 'Hold to spin faster · let go when the red ring sits on the target' },
  { name: 'Long Shot', targets: [{ pos: [-5, 9], radius: 2.6 }, { pos: [0, 16], radius: 3, points: [200, 400, 800] }], stars: [300, 900, 1500], view: 12 },
  { name: 'Left, Right', targets: [{ pos: [-6.5, 11], radius: 2.6 }, { pos: [6.5, 11], radius: 2.6 }], stars: [300, 800, 1300] },
  {
    name: 'Crate Smash',
    maxSpin: 7.6,
    targets: [{ pos: [0, 16], radius: 2.8 }],
    build(w) {
      // A crate pile beside the target: clip it on the way in for bonus points.
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) w.crate({ pos: [3.2 + i * 0.82 + r * 0.41, 0.41 + r * 0.8, 15] });
    },
    stars: [300, 800, 1400],
    view: 12,
  },
  { name: 'Bullseye', targets: [{ pos: [0, 12], radius: 1.8, points: [200, 400, 900] }], stars: [200, 900, 1700] },
  {
    name: 'Far Field',
    maxSpin: 8.6,
    targets: [{ pos: [-7, 13], radius: 2.4 }, { pos: [0, 18], radius: 3.2, points: [300, 600, 1200] }, { pos: [7, 13], radius: 2.4 }],
    stars: [400, 1200, 2200],
    view: 15,
  },
];
