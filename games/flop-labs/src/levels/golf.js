// Flop Golf. Holes play along +Z from a tee at the origin. Pads are turf
// islands { at: [x0, z0, x1, z1], top, surface } on a lake; the cup is cut
// into whichever pad contains it.

const TOP = 1.4;

export const GOLF = [
  {
    name: 'Tee Off',
    theme: 'morning',
    par: 2,
    hint: 'Pull back to aim, let go to swing · sink the dummy in the cup',
    cup: [0, 18.5],
    pads: [
      { at: [-3, -3, 3, 13] },
      { at: [-4.5, 13, 4.5, 23], surface: 'green' },
    ],
  },
  {
    name: 'Island Green',
    theme: 'morning',
    par: 2,
    hint: 'Nothing but water in between. Commit to the shot!',
    cup: [0, 21.5],
    pads: [
      { at: [-2.5, -2.5, 2.5, 2.5] },
      { at: [-4.5, 17, 4.5, 26], surface: 'green' },
    ],
  },
  {
    name: 'Bunker Hill',
    arc: 0.75,
    theme: 'noon',
    par: 3,
    hint: 'Sand stops him dead. The green sits up on a shelf.',
    cup: [1.5, 25],
    pads: [
      { at: [-3.5, -3, 3.5, 16] },
      { at: [-5, 16, 5, 19.5], surface: 'sand' },
      { at: [-5, 19.5, 5, 29.5], top: 2.2, surface: 'green' },
      { at: [5, 19.5, 8, 27], surface: 'sand' },
    ],
  },
  {
    name: 'Windmill Way',
    arc: 0.6,
    theme: 'sunset',
    par: 3,
    hint: 'Through the windmill, around it or over it',
    cup: [0, 31],
    pads: [
      { at: [-4, -3, 4, 26] },
      { at: [-5, 26, 5, 36], surface: 'green' },
    ],
    build(w) {
      w.windmill({ pos: [0, TOP, 15], speed: 1.1 });
    },
  },
  {
    name: 'Dogleg Lake',
    arc: 0.6,
    theme: 'sunset',
    par: 3,
    hint: 'Play it round the bend, or cut the corner over the lake',
    cup: [19, 25],
    pads: [
      { at: [-3, -3, 3, 20] },
      { at: [3, 14, 14, 20] },
      { at: [14, 18, 24, 30], surface: 'green' },
    ],
  },
  {
    name: 'Windy Mesa',
    arc: 0.5,
    theme: 'dusk',
    par: 3,
    hint: 'Crosswind! Watch where the arc drifts.',
    wind: [-1.6, 0],
    cup: [0, 26],
    pads: [
      { at: [-3, -3, 3, 11] },
      { at: [-2.5, 14, 2.5, 18], top: 2.4 },
      { at: [-4.5, 21, 4.5, 31], top: 3.4, surface: 'green' },
    ],
  },
];
