// Dummy Dunk. The shooter stands at `spot` (or each of `spots` in turn) and
// shoots at hoops along +Z. Hoop `y` is rim height; `move` slides it about.

export const DUNK = [
  {
    name: 'Free Throw',
    theme: 'noon',
    hint: 'Flick up to shoot the dummy · flick at an angle to steer',
    arc: 1,
    shots: 4,
    need: 2,
    hoops: [{ x: 0, z: 7, y: 4.2 }],
  },
  {
    name: 'Downtown',
    theme: 'noon',
    hint: 'Long range. More flick, same aim.',
    arc: 0.7,
    shots: 4,
    need: 2,
    spot: [0, -2],
    hoops: [{ x: 0, z: 10, y: 4.2 }],
  },
  {
    name: 'Defence!',
    theme: 'sunset',
    hint: 'A seven-foot defender. Shoot over him.',
    arc: 0.6,
    shots: 4,
    need: 2,
    hoops: [{ x: 1.5, z: 9, y: 4.2 }],
    build(w) {
      w.block({ pos: [0.6, 1.4, 3.6], size: [1.4, 2.8, 0.7], mat: 'steelRed', tile: 1, rounded: 0.2 });
      w.cone({ pos: [-1.4, 0.27, 3.6] });
      w.cone({ pos: [2.6, 0.27, 3.6] });
    },
  },
  {
    name: 'On the Move',
    theme: 'sunset',
    hint: 'The hoop slides. Lead it.',
    arc: 0.6,
    shots: 5,
    need: 2,
    hoops: [{ x: 0, z: 9, y: 4.2, move: { dx: 2.6, speed: 0.9 } }],
  },
  {
    name: 'Sky Hook',
    theme: 'dusk',
    hint: 'Way up there, and it bobs',
    arc: 0.5,
    shots: 5,
    need: 2,
    hoops: [{ x: 0, z: 9, y: 6.2, move: { dy: 0.9, speed: 1.1 } }],
  },
  {
    name: 'Around the World',
    theme: 'dusk',
    hint: 'A new spot every shot',
    arc: 0.5,
    shots: 6,
    need: 3,
    spots: [[-4, 1], [0, -1], [4, 1], [-2.5, -3], [2.5, -3], [0, -4.5]],
    hoops: [{ x: 0, z: 9, y: 4.2, move: { dx: 1.2, speed: 0.7 } }],
  },
];
