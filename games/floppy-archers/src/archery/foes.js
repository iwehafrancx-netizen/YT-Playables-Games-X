// Enemy archers. `rate` is the [min, max] seconds between shots, `err` how
// far off (radians) their aim wanders, `burst` how many arrows each volley.
// `alt` is the suit they wear instead if the player is already in theirs.
export const FOES = {
  rookie: { name: 'Rookie', suit: 'green', alt: 'yellow', hp: 40, damage: 10, rate: [2.2, 3], err: 0.08, speed: 21 },
  archer: { name: 'Archer', suit: 'blue', alt: 'purple', hp: 60, damage: 13, rate: [1.9, 2.6], err: 0.07, speed: 22 },
  sniper: { name: 'Sniper', suit: 'purple', alt: 'blue', hp: 50, damage: 22, rate: [3, 3.8], err: 0.045, speed: 27, draw: 1.3 },
  rapid: { name: 'Rapid', suit: 'yellow', alt: 'green', hp: 55, damage: 8, rate: [2.6, 3.2], err: 0.08, speed: 22, burst: 3 },
  heavy: { name: 'Heavy', suit: 'pink', alt: 'blue', hp: 140, damage: 18, rate: [2.8, 3.6], err: 0.08, speed: 21, helmet: 0x8a93a3, headshot: 1.4 },
  boss: { name: 'Captain', suit: 'purple', alt: 'green', hp: 320, damage: 18, rate: [1.9, 2.5], err: 0.06, speed: 24, burst: 2, helmet: 0xf2c230, headshot: 1.6, boss: true },
};

/** Which enemies show up as the waves go on: new types join, old ones thin out. */
function pool(n) {
  if (n <= 2) return ['rookie'];
  if (n <= 4) return ['rookie', 'archer'];
  if (n <= 7) return ['rookie', 'archer', 'archer', 'sniper'];
  if (n <= 10) return ['archer', 'sniper', 'rapid'];
  return ['archer', 'sniper', 'rapid', 'heavy'];
}

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Wave `n`: how many enemies, in what order, and how much tougher they are
 * than the base types. Every fifth wave ends with the Captain.
 */
export function wave(n) {
  const rand = seeded(n * 31 + 7);
  const count = Math.min(14, 3 + Math.ceil(n * 0.8));
  const types = pool(n);
  const list = Array.from({ length: count }, () => types[Math.floor(rand() * types.length)]);
  if (n % 5 === 0) list[list.length - 1] = 'boss';
  const tough = 1 + Math.max(0, n - 1) * 0.06;
  return {
    n,
    foes: list.map((type) => ({ type, ...FOES[type], hp: Math.round(FOES[type].hp * tough), err: FOES[type].err / Math.min(1.8, tough) })),
    seed: n,
  };
}
