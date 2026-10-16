// Rocket Rider courses: gates (walls with a gap at height y), floating blocks
// and rings, along x. `amp` makes a gap or block ride up and down.
const wave = (x0, n, step, y, amp) => Array.from({ length: n }, (_, i) => ({ t: 'ring', x: x0 + i * step, y: y + Math.sin(i * 0.9) * amp }));

export const ROCKET = [
  {
    name: 'Lift Off',
    length: 62,
    course: [...wave(8, 3, 3, 5, 0.6), { t: 'gate', x: 20, y: 5, gap: 5.2 }, ...wave(25, 3, 3, 6, 1), { t: 'gate', x: 37, y: 6.5, gap: 5 }, ...wave(42, 3, 3, 5, 1.2), { t: 'gate', x: 53, y: 4.5, gap: 5 }],
    hint: 'Hold to fly up · let go to drop · fly through the rings',
  },
  {
    name: 'Ring Road',
    length: 72,
    course: [...wave(8, 6, 2.6, 6, 2), { t: 'gate', x: 26, y: 7, gap: 5.2 }, ...wave(31, 6, 2.6, 5, 2.4), { t: 'gate', x: 49, y: 4.5, gap: 5.2 }, ...wave(54, 5, 2.6, 6, 2)],
  },
  {
    name: 'Bobbing Gates',
    length: 80,
    course: [{ t: 'gate', x: 14, y: 6, gap: 5.4, amp: 1.6, sp: 1.2 }, ...wave(19, 3, 3, 6, 1), { t: 'gate', x: 32, y: 5.5, gap: 5.4, amp: 2, sp: 1, ph: 1 }, ...wave(37, 3, 3, 5, 1.5), { t: 'gate', x: 50, y: 6.5, gap: 5.4, amp: 2, sp: 1.4, ph: 2 }, ...wave(55, 4, 3, 6, 1.5), { t: 'gate', x: 70, y: 5, gap: 5.2, amp: 1.5, sp: 1.6 }],
  },
  {
    name: 'Toy Box',
    length: 80,
    course: [{ t: 'block', x: 14, y: 4, w: 2.4, h: 2.4 }, { t: 'ring', x: 14, y: 8 }, { t: 'block', x: 24, y: 9, w: 2.4, h: 3 }, { t: 'ring', x: 24, y: 4.5 }, { t: 'block', x: 34, y: 5.5, w: 2, h: 2, amp: 2.5, sp: 1.3 }, ...wave(40, 3, 3, 7, 1), { t: 'gate', x: 52, y: 6, gap: 5.2 }, { t: 'block', x: 62, y: 3, w: 3, h: 3 }, { t: 'ring', x: 62, y: 8 }, { t: 'block', x: 70, y: 9.5, w: 2.4, h: 3 }],
  },
  {
    name: 'The Squeeze',
    length: 90,
    speed: 6.6,
    course: [{ t: 'gate', x: 12, y: 6, gap: 4.6 }, { t: 'ring', x: 17, y: 6 }, { t: 'gate', x: 22, y: 8, gap: 4.4 }, { t: 'ring', x: 27, y: 6.5 }, { t: 'gate', x: 32, y: 4.5, gap: 4.4 }, ...wave(37, 4, 2.6, 6, 2), { t: 'gate', x: 50, y: 7, gap: 4.4, amp: 1.5, sp: 1.2 }, ...wave(55, 4, 2.6, 6, 2), { t: 'gate', x: 68, y: 5, gap: 4.2 }, { t: 'gate', x: 76, y: 7.5, gap: 4.2 }, { t: 'ring', x: 82, y: 6 }],
  },
  {
    name: 'Rocket Rush',
    length: 112,
    speed: 7.2,
    course: [...wave(8, 4, 2.8, 6, 2), { t: 'gate', x: 22, y: 7, gap: 5.0, amp: 1.5, sp: 1.4 }, { t: 'block', x: 32, y: 4, w: 2.4, h: 3 }, { t: 'ring', x: 32, y: 8.5 }, { t: 'gate', x: 42, y: 5, gap: 4.8 }, ...wave(47, 5, 2.6, 6, 2.5), { t: 'block', x: 64, y: 9, w: 2.6, h: 3, amp: 1.5, sp: 1.5 }, { t: 'gate', x: 74, y: 6, gap: 4.6, amp: 2, sp: 1.2, ph: 1 }, ...wave(79, 4, 2.8, 6, 2), { t: 'gate', x: 94, y: 5, gap: 4.4 }, { t: 'gate', x: 102, y: 7.5, gap: 4.4 }],
  },
];
