// Tube Rush courses, in slide space: x across (±3.5), z down the slide.
// Blocks bonk, sliders sweep across, ramps launch, boosts speed him up, stars score.
// The long courses run their first half again, mirrored.
const twice = (l) => ({
  ...l,
  length: l.length * 2,
  course: [...l.course, ...l.course.map((p) => ({ ...p, x: p.x === undefined ? undefined : -p.x, z: p.z + l.length, ph: (p.ph ?? 0) + 1 }))],
});
const stars = (z0, n, step, x0, dx) => Array.from({ length: n }, (_, i) => ({ t: 'star', x: x0 + i * dx, z: z0 + i * step }));

export const SLIDE = [
  { name: 'Splash Start', length: 60, course: [{ t: 'boost', x: 0, z: 12 }, { t: 'boost', x: 1.5, z: 40 }, ...stars(8, 3, 3, -1.5, 1.5), { t: 'block', x: 1.5, z: 20 }, { t: 'block', x: -1.8, z: 30 }, ...stars(34, 3, 3, 2, -1.5), { t: 'block', x: 0, z: 46 }, ...stars(50, 2, 3, -2, 0)],  },
  { name: 'Big Air', length: 70, course: [{ t: 'boost', x: 0, z: 13 }, { t: 'boost', x: 0, z: 49 }, ...stars(8, 2, 3, 0, 0), { t: 'ramp', z: 18 }, { t: 'star', x: 0, y: 2.6, z: 23 }, { t: 'block', x: -2, z: 32 }, { t: 'block', x: 2, z: 38 }, ...stars(42, 3, 3, -2, 2), { t: 'ramp', z: 54, w: 4 }, { t: 'star', x: 0, y: 2.6, z: 59 }], hint: 'Hit the yellow ramps for big air' },
  twice({ name: 'Slalom', length: 80, course: [{ t: 'boost', x: 0, z: 8 }, { t: 'boost', x: 0, z: 29 }, { t: 'block', x: -1.6, z: 14 }, { t: 'star', x: 1.8, z: 14 }, { t: 'block', x: 1.6, z: 24 }, { t: 'star', x: -1.8, z: 24 }, { t: 'block', x: -1.6, z: 34 }, { t: 'star', x: 1.8, z: 34 }, { t: 'block', x: 1.6, z: 44 }, { t: 'star', x: -1.8, z: 44 }, { t: 'block', x: 0, z: 56, w: 3 }, { t: 'star', x: -2.6, z: 56 }, { t: 'star', x: 2.6, z: 56 }, { t: 'block', x: -1.6, z: 68 }, { t: 'star', x: 1.8, z: 68 }] }),
  twice({ name: 'Sweepers', length: 80, course: [{ t: 'boost', x: -2, z: 14 }, { t: 'boost', x: 0, z: 41 }, ...stars(8, 2, 3, 0, 0), { t: 'slider', z: 20, amp: 2.4, sp: 1.4 }, { t: 'star', x: 0, z: 26 }, { t: 'slider', z: 34, amp: 2.4, sp: 1.8, ph: 1 }, { t: 'ramp', z: 46 }, { t: 'star', x: 0, y: 2.6, z: 51 }, { t: 'slider', z: 62, amp: 2.4, sp: 2, ph: 2 }, ...stars(66, 3, 3, -2, 2)] }),
  twice({ name: 'Block Party', length: 90, maxSpeed: 14, course: [{ t: 'boost', x: 0, z: 9 }, { t: 'boost', x: 0, z: 35 }, { t: 'boost', x: 0, z: 70 }, { t: 'block', x: -2, z: 14 }, { t: 'block', x: 1, z: 18 }, { t: 'star', x: -0.5, z: 22 }, { t: 'block', x: 2, z: 26 }, { t: 'block', x: -1.5, z: 30 }, { t: 'ramp', z: 40 }, { t: 'star', x: 0, y: 2.6, z: 45 }, { t: 'block', x: 0, z: 56, w: 2.4 }, { t: 'star', x: -2.6, z: 58 }, { t: 'slider', z: 66, amp: 2.4, sp: 1.6 }, { t: 'block', x: 2, z: 76 }, { t: 'block', x: -2, z: 80 }, ...stars(83, 2, 3, 0, 0)] }),
  twice({ name: 'Mega Slide', length: 110, maxSpeed: 15, bonks: 5, course: [{ t: 'boost', x: 0, z: 15 }, { t: 'boost', x: 2, z: 52 }, { t: 'boost', x: 0, z: 62 }, { t: 'boost', x: 0, z: 88 }, ...stars(8, 3, 3, -2, 2), { t: 'ramp', z: 20 }, { t: 'star', x: 0, y: 2.6, z: 25 }, { t: 'slider', z: 34, amp: 2.4, sp: 1.6 }, { t: 'block', x: -2, z: 42 }, { t: 'block', x: 2, z: 46 }, { t: 'star', x: 0, z: 46 }, { t: 'slider', z: 56, amp: 2.4, sp: 2, ph: 1 }, { t: 'ramp', z: 66, w: 4 }, { t: 'star', x: 0, y: 2.6, z: 71 }, { t: 'block', x: 0, z: 82, w: 2.6 }, { t: 'star', x: -2.7, z: 82 }, { t: 'star', x: 2.7, z: 82 }, { t: 'slider', z: 92, amp: 2.4, sp: 2.2 }, ...stars(98, 3, 3, -2, 2)] }),
];
