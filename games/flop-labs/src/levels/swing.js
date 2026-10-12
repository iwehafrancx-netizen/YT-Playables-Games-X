// Swing Shift. Side-on courses along +X; the start platform's top is at
// (0, start). Hooks are [x, y] points; platform `y` values are top surfaces.

export const SWING = [
  {
    name: 'First Swing',
    theme: 'morning',
    par: 8,
    hint: 'Hold to jump and grab the glowing hook · let go to fling forward',
    hooks: [
      { x: 4, y: 8 },
      { x: 10, y: 8.5 },
      { x: 16, y: 8.5 },
      { x: 22, y: 8 },
    ],
    finish: { x: 30, y: 3, w: 6 },
  },
  {
    name: 'Bounce House',
    theme: 'morning',
    par: 9,
    hint: 'Trampolines on the mat are safe. Bounce back up!',
    hooks: [
      { x: 4, y: 8 },
      { x: 10, y: 8.5 },
      { x: 25, y: 9 },
      { x: 31, y: 9 },
    ],
    springs: [{ x: 17.5, y: 0.6, w: 3.2, power: 14 }],
    finish: { x: 38, y: 3.5, w: 6 },
  },
  {
    name: 'Moving Parts',
    theme: 'noon',
    par: 10,
    hooks: [
      { x: 4, y: 8 },
      { x: 10.5, y: 8.5, move: { dy: 1.6, speed: 1.6 } },
      { x: 17, y: 8.5, move: { dx: 2, speed: 1.2 } },
      { x: 23.5, y: 9, move: { dy: 1.6, speed: 1.6, phase: 2 } },
      { x: 30, y: 8.5 },
    ],
    finish: { x: 37, y: 3, w: 5 },
  },
  {
    name: 'Over the Wall',
    theme: 'noon',
    par: 12,
    hint: 'Build up a big swing and let go high to clear the wall',
    hooks: [
      { x: 4, y: 8 },
      { x: 10, y: 9 },
      { x: 23, y: 10 },
      { x: 29, y: 9 },
    ],
    blocks: [{ x: 16.5, y: 8, w: 1.2 }],
    checks: [{ x: 21, y: 3, w: 2.5 }],
    finish: { x: 36, y: 3, w: 5 },
  },
  {
    name: 'Rotor Alley',
    theme: 'sunset',
    par: 11,
    hint: 'Time your swings past the rotors',
    hooks: [
      { x: 4, y: 8.5 },
      { x: 10, y: 9.5 },
      { x: 17, y: 9.5 },
      { x: 24, y: 9.5 },
      { x: 31, y: 9 },
    ],
    rotors: [
      { x: 13.5, y: 5.2, length: 5, speed: 1.4 },
      { x: 27.5, y: 5.2, length: 5, speed: -1.6, phase: 0.8 },
    ],
    finish: { x: 38, y: 3, w: 5 },
  },
  {
    name: 'The Long Haul',
    theme: 'dusk',
    par: 18,
    lives: 4,
    hooks: [
      { x: 4, y: 8 },
      { x: 10.5, y: 9, move: { dy: 1.4, speed: 1.5 } },
      { x: 17, y: 9.5 },
      { x: 29, y: 9.5 },
      { x: 35.5, y: 9, move: { dx: 2, speed: 1.3 } },
      { x: 42, y: 9.5 },
      { x: 48.5, y: 10 },
    ],
    springs: [{ x: 23, y: 0.6, w: 3.2, power: 14 }],
    blocks: [{ x: 45.5, y: 4.5, w: 1 }],
    rotors: [{ x: 39, y: 5, length: 4.6, speed: 1.5 }],
    checks: [{ x: 31, y: 3.5, w: 2.5 }],
    finish: { x: 55, y: 3, w: 5 },
  },
  {
    name: 'Saw Pit',
    theme: 'sunset',
    par: 12,
    hint: 'Saws patrol the low swing. Keep your ropes short and high.',
    hooks: [
      { x: 4, y: 8.5 },
      { x: 10.5, y: 9.5 },
      { x: 17, y: 9.5 },
      { x: 23.5, y: 9.5 },
      { x: 30, y: 9 },
    ],
    build(w) {
      w.saw({ pos: [7.2, 3.6, 0], r: 0.7, amp: 1.2, axis: 'y', speed: 1.4 });
      w.saw({ pos: [13.8, 4, 0], r: 0.7, amp: 1.2, axis: 'y', speed: 1.7, phase: 1.5 });
      w.saw({ pos: [20.3, 4, 0], r: 0.7, amp: 1.4, axis: 'x', speed: 1.2 });
      w.saw({ pos: [26.8, 3.6, 0], r: 0.7, amp: 1.2, axis: 'y', speed: 1.9, phase: 3 });
    },
    finish: { x: 37, y: 3, w: 5 },
  },
  {
    name: 'Sky High',
    theme: 'dusk',
    par: 14,
    lives: 4,
    hint: 'High hooks, long gaps. Swing big.',
    hooks: [
      { x: 4, y: 9 },
      { x: 11, y: 11 },
      { x: 18.5, y: 11.5, move: { dx: 1.8, speed: 1.3 } },
      { x: 33, y: 11.5 },
      { x: 40, y: 11, move: { dy: 1.2, speed: 1.7 } },
      { x: 47, y: 11.5 },
    ],
    springs: [{ x: 26, y: 0.6, w: 3.2, power: 15 }],
    rotors: [{ x: 43.5, y: 6, length: 4.4, speed: 1.6 }],
    checks: [{ x: 33, y: 4, w: 2.5 }],
    finish: { x: 54, y: 3, w: 5 },
  },
];
