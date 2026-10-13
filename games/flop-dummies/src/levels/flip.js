// Flip Test. The springboard sits at `board` facing +Z and throws the dummy
// with `launch` = [forward, up] m/s. Mats are landing pads; `y` is the top.

export const FLIP = [
  {
    name: 'Backflip 101',
    theme: 'morning',
    hint: 'Tap to jump · hold to flip · let go to land on your feet',
    launch: [1.5, 12],
    mats: [{ z: 3.4, w: 4.5, d: 4.5 }],
    stars: [600, 1000, 1250],
  },
  {
    name: 'Double Up',
    theme: 'morning',
    hint: 'More spring, more spin. Go for two.',
    launch: [1.7, 15],
    mats: [{ z: 4.6, w: 4, d: 4 }],
    stars: [1000, 1600, 2000],
  },
  {
    name: 'Diving Board',
    theme: 'noon',
    hint: 'Off the high board and onto the mat',
    board: [0, 4, 0],
    launch: [2.5, 10],
    mats: [{ z: 5.4, w: 4, d: 4 }],
    stars: [1000, 1600, 2000],
  },
  {
    name: 'Moving Mat',
    theme: 'noon',
    hint: 'The mat slides. Flip, then time your landing.',
    launch: [2, 13],
    mats: [{ z: 4.6, w: 3.6, d: 3.6, move: { dz: 1.6, speed: 1 } }],
    stars: [1000, 1600, 2000],
  },
  {
    name: 'Stage Dive',
    theme: 'sunset',
    hint: 'Clear the container and stick it on the far side',
    launch: [3.4, 12.5],
    mats: [{ z: 7.4, w: 4, d: 4 }],
    stars: [1000, 1700, 2000],
    build(w) {
      w.container({ pos: [0, 0, 3.8], yaw: 90, color: 'steelRed' });
    },
  },
  {
    name: 'Pinpoint',
    theme: 'sunset',
    hint: 'A tiny mat. Feet first, dead centre.',
    launch: [1.8, 14],
    mats: [{ z: 4.4, y: 1.2, w: 2.2, d: 2.2 }],
    stars: [1000, 2000, 2200],
  },
  {
    name: 'Sky High',
    theme: 'dusk',
    hint: 'The tallest board in the yard. Three flips if you dare.',
    board: [0, 6, 0],
    launch: [2.4, 15],
    mats: [{ z: 8, w: 3.4, d: 3.4 }],
    stars: [1000, 2000, 2750],
  },
];
