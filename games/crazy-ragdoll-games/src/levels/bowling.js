// Ragdoll Bowling lanes: `rows` of pins in a triangle, or `barrels` at
// [x, z] from the head pin spot. Sweepers slide across at `z` m down the lane.
// `goals` are the pins needed for one and two stars; all of them is three.
const triangle = (rows, gap = 0.85) => {
  const out = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i <= r; i++) out.push([(i - r / 2) * gap, -r * gap * 0.87]);
  return out;
};

export const BOWL = [
  { name: 'Ten Pin', rows: 4, goals: [5, 8], hint: 'Hold to power up · let go to bowl when the arrow points at the pins' },
  { name: 'Barrel Roll', rows: 0, barrels: triangle(3), goals: [3, 5], hint: 'Barrels are heavy: bowl with full power' },
  { name: 'Crate Crossing', rows: 4, sweepers: [{ z: 10, amp: 1.1, sp: 1.3 }], goals: [5, 8], hint: 'Time it past the sliding crate' },
  { name: 'No Bumpers', rows: 4, open: true, goals: [5, 8], hint: 'No walls this time: miss the lane and he rolls off' },
  { name: 'Big Fifteen', rows: 5, length: 22, goals: [8, 12] },
  { name: 'Rush Hour', rows: 4, open: true, length: 22, sweepers: [{ z: 8, amp: 1.1, sp: 1.5 }, { z: 14, amp: 1.1, sp: 1.9, ph: 2 }], goals: [5, 8] },
];
