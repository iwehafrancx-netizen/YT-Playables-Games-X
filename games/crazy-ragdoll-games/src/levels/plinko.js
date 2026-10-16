// Plinko Party boards: bucket values left to right (×2 doubles the total so
// far), bumpers, stars and sliding bars. Three drops a board.
export const PLINKO = [
  { name: 'Peg Party', buckets: [100, 300, 1000, 300, 100], pickups: [{ x: -2.4, y: 8 }, { x: 2.4, y: 6.5 }], goals: [600, 1400, 2400], hint: 'Drag to aim · let go to drop · the middle bucket pays most' },
  { name: 'Bumper Cars', buckets: [300, 100, 1000, 100, 300], bumpers: [{ x: -2.5, y: 9.2 }, { x: 2.5, y: 9.2 }, { x: 0, y: 6.3 }], pickups: [{ x: 0, y: 10 }], goals: [700, 1600, 2600] },
  { name: 'Double Trouble', buckets: [100, 'x2', 500, 0, 500, 'x2', 100], pickups: [{ x: -3, y: 7 }, { x: 3, y: 7 }, { x: 0, y: 9.5 }], goals: [800, 1800, 3200], hint: 'The ×2 buckets double everything you have so far' },
  { name: 'Slide Rule', buckets: [100, 300, 1000, 300, 100], movers: [{ y: 7.7, w: 2.6, amp: 3, sp: 1.2 }], pickups: [{ x: -2, y: 5 }, { x: 2, y: 5 }], goals: [600, 1400, 2400], hint: 'Mind the sliding bar' },
  { name: 'Narrow Gate', buckets: [0, 300, 0, 1000, 0, 300, 0], bumpers: [{ x: -3, y: 6.3 }, { x: 3, y: 6.3 }], pickups: [{ x: -1.6, y: 9.5 }, { x: 1.6, y: 9.5 }], goals: [500, 1300, 2300] },
  { name: 'Jackpot Junction', buckets: [100, 'x2', 300, 1000, 300, 'x2', 100], rows: 7, bumpers: [{ x: 0, y: 10.3 }, { x: -3.2, y: 5 }, { x: 3.2, y: 5 }], movers: [{ y: 7.7, w: 2.2, amp: 3.2, sp: 1.6 }], pickups: [{ x: -3, y: 9 }, { x: 3, y: 9 }, { x: 0, y: 6.4 }], goals: [900, 2200, 4000] },
];
