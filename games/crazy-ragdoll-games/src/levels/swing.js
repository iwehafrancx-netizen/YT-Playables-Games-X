// Crane Swing: the hook hangs at `height` on a `rope`; the pad sits `high`
// containers up at `x`. `stacks` are walls to swing over, `stars` hang in the air.
export const SWING = [
  { name: 'First Swing', pad: { x: 9, r: 2.4 }, stars: [{ x: 5, y: 6 }], hint: 'Hold to swing higher · let go to fly · land on the pad' },
  { name: 'Rooftop', pad: { x: 11, high: 1, r: 2.2 }, stars: [{ x: 6, y: 7 }, { x: 9, y: 6 }] },
  { name: 'Over the Wall', stacks: [{ x: 7.5, high: 2 }], pad: { x: 14, r: 2.2 }, stars: [{ x: 7.5, y: 8 }], crates: [11] },
  { name: 'High Stack', height: 10, pad: { x: 12, high: 2, r: 2 }, stars: [{ x: 6, y: 9 }, { x: 9, y: 9 }] },
  { name: 'Long Haul', height: 10, rope: 6, stacks: [{ x: 8, high: 1 }], pad: { x: 17, high: 1, r: 2 }, stars: [{ x: 8, y: 7 }, { x: 13, y: 8 }], crates: [12] },
  { name: 'Pinpoint', height: 12, rope: 6, stacks: [{ x: 7, high: 2 }], pad: { x: 13, high: 3, r: 1.6 }, stars: [{ x: 7, y: 9 }, { x: 10, y: 11 }], tries: 4 },
];
