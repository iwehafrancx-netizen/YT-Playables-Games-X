// Pull Rig. Side-on puzzles in the XY plane. Walls are [x1, y1, x2, y2]
// segments; a pin slides out towards its `from` end, where the handle is.
// `best` is the fewest pulls that solve it.

const shaft = (top, gaps = {}) => {
  const out = [];
  for (const [x, side] of [[-1.15, 'left'], [1.15, 'right']]) {
    let y = 0;
    for (const [a, b] of gaps[side] ?? []) {
      out.push([x, y, x, a]);
      y = b;
    }
    out.push([x, y, x, top]);
  }
  return out;
};

export const RIG = [
  {
    name: 'Trapdoor',
    theme: 'noon',
    best: 1,
    hint: 'Tap the pin to pull it · drop him into the green zone',
    view: [-3, -0.3, 3, 7.2],
    walls: shaft(6.5),
    pins: [{ from: [-1.9, 3.6], to: [1.15, 3.6] }],
    dummy: [0, 3.71],
    goal: { x: 0, y: 0, w: 2 },
  },
  {
    name: 'Wrong Turn',
    theme: 'noon',
    best: 2,
    hint: 'That slope leads somewhere nasty. Order matters!',
    view: [-3, -0.3, 4.6, 9.4],
    walls: [...shaft(9, { right: [[2.2, 4.2]] }), [3.8, 0, 3.8, 5.5], [1.15, 4.2, 3.8, 4.2]],
    pins: [
      { from: [-1.9, 6.6], to: [1.15, 6.6] },
      { from: [-1.9, 5.6], to: [1.15, 3.0] },
    ],
    saws: [{ x: 2.5, y: 1, r: 0.8 }],
    dummy: [0, 6.71],
    goal: { x: 0, y: 0, w: 2 },
  },
  {
    name: 'Bed of Nails',
    theme: 'morning',
    best: 2,
    hint: 'Something has to cover those spikes first',
    view: [-4.8, -0.3, 2.6, 10.3],
    walls: [...shaft(10, { left: [[2.9, 5.3]] }), [-3.9, 2.6, -3.9, 8], [-3.9, 5.0, -1.15, 2.9]],
    pins: [
      { from: [1.9, 7.2], to: [-1.15, 7.2] },
      { from: [-4.6, 5.2], to: [-1.15, 5.2] },
    ],
    crates: [{ x: -2.5, y: 5.31 }],
    spikes: [{ x: 0, y: 0, w: 2 }],
    dummy: [0, 7.31],
    goal: { x: 0, y: 0.6, w: 2, h: 2.6, pad: false },
  },
  {
    name: 'Smash Hit',
    theme: 'morning',
    best: 2,
    hint: 'Glass holds a dummy. It does not hold a wrecking ball.',
    view: [-4.8, -0.3, 2.6, 10.3],
    walls: [...shaft(10, { left: [[3.3, 5.6]] }), [-3.9, 3.3, -3.9, 8.5], [-3.9, 5.4, -1.15, 3.4]],
    pins: [
      { from: [1.9, 7.2], to: [-1.15, 7.2] },
      { from: [-4.6, 5.9], to: [-1.15, 5.9] },
    ],
    balls: [{ x: -2.6, y: 6.01 }],
    glass: [{ x: 0, y: 2.2, w: 2 }],
    dummy: [0, 7.31],
    goal: { x: 0, y: 0, w: 2, h: 2 },
  },
  {
    name: 'Saw Mill',
    theme: 'sunset',
    best: 3,
    hint: 'Three pins to pull. One of them you really should not.',
    view: [-4.8, -0.3, 4.6, 14],
    walls: [
      ...shaft(13.6, { left: [[2.9, 5.3]], right: [[5.4, 7.6]] }),
      [3.8, 0, 3.8, 8.2], [1.15, 7.6, 3.8, 7.6],
      [-3.9, 2.6, -3.9, 8], [-3.9, 5.0, -1.15, 2.9],
    ],
    pins: [
      { from: [-1.9, 10.2], to: [1.15, 10.2] },
      { from: [-1.9, 8.0], to: [1.15, 5.5] },
      { from: [-4.6, 5.2], to: [-1.15, 5.2] },
      { from: [1.9, 12.4], to: [-1.15, 12.4] },
    ],
    crates: [{ x: -2.5, y: 5.31 }],
    balls: [{ x: 0, y: 12.51 }],
    saws: [{ x: 2.5, y: 1.2, r: 0.8 }],
    spikes: [{ x: 0, y: 0, w: 2 }],
    dummy: [0, 10.31],
    goal: { x: 0, y: 0.6, w: 2, h: 2.6, pad: false },
  },
  {
    name: 'Chain Reaction',
    theme: 'dusk',
    best: 3,
    hint: 'Clear the way for the ball, let it smash the glass, then send him down',
    view: [-4.8, -0.3, 4.8, 16],
    walls: [
      ...shaft(15.8, { left: [[4.0, 5.9]], right: [[7.5, 10.1]] }),
      [3.9, 7.4, 3.9, 12], [3.9, 9.4, 1.15, 7.6],
      [-3.8, 0, -3.8, 6.4], [-3.8, 5.9, -1.15, 5.9],
    ],
    pins: [
      { from: [-1.9, 12.0], to: [1.15, 12.0] },
      { from: [4.6, 9.9], to: [1.15, 9.9] },
      { from: [1.9, 7.0], to: [-1.15, 4.8] },
      { from: [1.9, 14.3], to: [-1.15, 14.3] },
    ],
    balls: [{ x: 2.6, y: 10.01 }, { x: 0, y: 14.41 }],
    glass: [{ x: 0, y: 3.4, w: 2 }],
    saws: [{ x: -2.5, y: 1.2, r: 0.8 }],
    dummy: [0, 12.11],
    goal: { x: 0, y: 0, w: 2, h: 2.2 },
  },
  {
    name: 'Saw Timing',
    theme: 'dusk',
    best: 2,
    hint: 'The saw never stops. Pick your moment.',
    view: [-3.6, -0.3, 5.8, 11.4],
    walls: [
      [-1.65, 0, -1.65, 11],
      [1.65, 0, 1.65, 3.4], [1.65, 5.6, 1.65, 11],
      [4.4, 3.4, 4.4, 8.5], [4.4, 5.4, 1.65, 3.4],
    ],
    pins: [
      { from: [-2.4, 8.6], to: [1.65, 8.6] },
      { from: [5.1, 5.9], to: [1.65, 5.9] },
    ],
    balls: [{ x: 3.1, y: 6.01 }],
    glass: [{ x: 0, y: 2.4, w: 3 }],
    saws: [{ x: 0, y: 6.8, r: 0.55, amp: 1.1, axis: 'x' }],
    dummy: [0, 8.71],
    goal: { x: 0, y: 0, w: 3, h: 2 },
  },
  {
    name: 'Grand Finale',
    theme: 'dusk',
    best: 3,
    hint: 'Everything you have learned, plus a saw in the way',
    view: [-5.2, -0.3, 5.2, 16],
    walls: [
      [-1.65, 0, -1.65, 4], [-1.65, 5.9, -1.65, 15.8],
      [1.65, 0, 1.65, 7.5], [1.65, 10.1, 1.65, 15.8],
      [4.4, 7.4, 4.4, 12], [4.4, 8.4, 1.65, 7.6],
      [-4.3, 0, -4.3, 6.4], [-4.3, 5.9, -1.65, 5.9],
    ],
    pins: [
      { from: [-2.4, 12.0], to: [1.65, 12.0] },
      { from: [5.1, 9.2], to: [1.65, 9.2] },
      { from: [2.4, 7.2], to: [-1.65, 4.8] },
      { from: [2.4, 14.3], to: [-1.65, 14.3] },
    ],
    balls: [{ x: 3.1, y: 9.31 }, { x: 0, y: 14.41 }],
    glass: [{ x: 0, y: 3.4, w: 3 }],
    saws: [{ x: -3, y: 1.2, r: 0.8 }, { x: 0, y: 10.9, r: 0.5, amp: 1.05, axis: 'x' }],
    dummy: [0, 12.11],
    goal: { x: 0, y: 0, w: 3, h: 2.2 },
  },
];
