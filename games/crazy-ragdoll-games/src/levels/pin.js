// Ragdoll Pinball tables, in table space: x across (±4), z down the table
// (top at -7.5, flippers at +5.6).
const tri = (x, z, s) => [{ x, z: z - s }, { x: x - s, z: z + s * 0.6 }, { x: x + s, z: z + s * 0.6 }];

export const PIN = [
  { name: 'Rookie Table', bumpers: tri(0, -3.5, 1.3), rollovers: [{ x: -2.5, z: -6 }, { x: 0, z: -6.4 }, { x: 2.5, z: -6 }], stars: [800, 2000, 3500], hint: 'Tap left or right to flip · bumpers and stars score' },
  { name: 'Bumper Crop', bumpers: [...tri(0, -4, 1.3), { x: -2.4, z: -0.5 }, { x: 2.4, z: -0.5 }], rollovers: [{ x: -2.5, z: -6.2 }, { x: 2.5, z: -6.2 }], stars: [1200, 2800, 4500] },
  { name: 'Star Lanes', bumpers: [{ x: -1.6, z: -3 }, { x: 1.6, z: -3 }], rollovers: [{ x: -3, z: -6 }, { x: -1.5, z: -6.4 }, { x: 0, z: -6.6 }, { x: 1.5, z: -6.4 }, { x: 3, z: -6 }, { x: 0, z: -1 }], stars: [1000, 2400, 4000] },
  { name: 'Post Office', bumpers: tri(0, -4.5, 1.2), posts: [{ x: -2.3, z: 0.5, rot: 0.6 }, { x: 2.3, z: 0.5, rot: -0.6 }], rollovers: [{ x: -2.8, z: -6 }, { x: 2.8, z: -6 }, { x: 0, z: -1.6 }], stars: [1200, 2800, 4600] },
  { name: 'Jackpot', bumpers: [...tri(-1.6, -4.2, 1), ...tri(1.6, -4.2, 1)], rollovers: [{ x: -3, z: -6.6 }, { x: 0, z: -6.6 }, { x: 3, z: -6.6 }, { x: 0, z: -1 }], stars: [1500, 3500, 6000] },
  { name: 'Chaos Table', bumpers: [...tri(0, -4.5, 1.4), { x: -2.6, z: -1.2 }, { x: 2.6, z: -1.2 }, { x: 0, z: -0.6, r: 0.45 }], posts: [{ x: -2.5, z: 1.8, rot: 0.5, len: 1.2 }, { x: 2.5, z: 1.8, rot: -0.5, len: 1.2 }], rollovers: [{ x: -2.8, z: -6.4 }, { x: 0, z: -6.8 }, { x: 2.8, z: -6.4 }], stars: [2500, 5000, 8000] },
];
