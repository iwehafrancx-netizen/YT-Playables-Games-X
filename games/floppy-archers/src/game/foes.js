// Enemy archers and what each level throws at you.
//   rate   [min, max] seconds between volleys
//   err    how far off (radians) their aim wanders
//   burst  arrows per volley; spread fans them out (degrees)
//   dodge  chance they hop over an arrow coming their way
export const FOES = {
  rookie: { name: 'Rookie', suit: 'green', hp: 40, dmg: 12, rate: [2.4, 3.2], err: 0.08, speed: 19 },
  archer: { name: 'Archer', suit: 'blue', hat: 'hood', hp: 60, dmg: 14, rate: [2, 2.8], err: 0.07, speed: 20 },
  sniper: { name: 'Sniper', suit: 'purple', hat: 'hood', hp: 50, dmg: 24, rate: [3, 3.8], err: 0.04, speed: 24, draw: 1.3 },
  rapid: { name: 'Rapid', suit: 'yellow', hat: 'band', hp: 55, dmg: 9, rate: [2.4, 3], err: 0.08, speed: 20, burst: 3 },
  ninja: { name: 'Ninja', suit: 'black', hat: 'band', hp: 50, dmg: 14, rate: [2, 2.8], err: 0.06, speed: 21, dodge: 0.55 },
  heavy: { name: 'Heavy', suit: 'orange', hat: 'helmet', hp: 140, dmg: 18, rate: [2.8, 3.6], err: 0.06, speed: 19, headshot: 1.3, size: 1.12 },
};

/** Bosses take turns, one every fifth level. */
export const BOSSES = [
  { name: 'Big Bruno', suit: 'teal', hat: 'crown', hp: 300, dmg: 22, rate: [2.4, 3], err: 0.05, speed: 19, size: 1.5, headshot: 1.4, knock: 2, title: 'Huge arrows that knock you flat' },
  { name: 'Triple King', suit: 'purple', hat: 'crown', hp: 260, dmg: 12, rate: [2.2, 2.8], err: 0.05, speed: 20, size: 1.4, burst: 1, spread: 9, fan: 3, title: 'Fires three arrows at once' },
  { name: 'Fire Chief', suit: 'orange', hat: 'crown', hp: 280, dmg: 14, rate: [2, 2.6], err: 0.05, speed: 21, size: 1.4, arrow: 'fire', title: 'His arrows set you on fire' },
  { name: 'Shock Wizard', suit: 'blue', hat: 'wizard', hp: 260, dmg: 13, rate: [2.2, 2.8], err: 0.045, speed: 22, size: 1.4, arrow: 'shock', dodge: 0.35, title: 'Zaps you stiff, and dodges' },
  { name: 'Bomb Baron', suit: 'black', hat: 'crown', hp: 320, dmg: 12, rate: [2.6, 3.2], err: 0.06, speed: 19, size: 1.5, arrow: 'bomb', title: 'Explosive arrows' },
];

/** The bonus boss you can take on for an ad: tough, and pays a pile of skulls. */
export const GOLDEN = { name: 'Golden Archer', suit: 'gold', hat: 'crown', hp: 360, dmg: 15, rate: [1.8, 2.4], err: 0.045, speed: 22, size: 1.45, burst: 2, dodge: 0.4, title: 'Beat him for a pile of skulls', reward: 60 };

export const THEMES = ['meadow', 'desert', 'snow', 'dusk', 'night'];

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function pool(n) {
  if (n <= 2) return ['rookie'];
  if (n <= 4) return ['rookie', 'archer'];
  if (n <= 7) return ['rookie', 'archer', 'archer', 'sniper', 'ninja'];
  if (n <= 11) return ['archer', 'sniper', 'rapid', 'ninja'];
  return ['archer', 'sniper', 'rapid', 'ninja', 'heavy'];
}

const toughen = (def, n) => {
  const t = 1 + Math.max(0, n - 1) * 0.07;
  return { ...def, hp: Math.round(def.hp * t), dmg: Math.round(def.dmg * (1 + Math.max(0, n - 1) * 0.025)), err: def.err / Math.min(1.7, Math.sqrt(t)) };
};

/**
 * Level `n`: the queue of enemies and the scenery. Every fifth level is a
 * boss level: a couple of guards first, then the boss.
 */
export function level(n) {
  const rand = seeded(n * 31 + 7);
  const boss = n % 5 === 0;
  const types = pool(n);
  const count = boss ? 2 : Math.min(8, 2 + Math.ceil(n * 0.5));
  const foes = Array.from({ length: count }, () => {
    const type = types[Math.floor(rand() * types.length)];
    return { type, ...toughen(FOES[type], n) };
  });
  if (boss) {
    const b = BOSSES[(n / 5 - 1) % BOSSES.length];
    const lap = Math.floor((n / 5 - 1) / BOSSES.length);
    foes.push({ type: 'boss', boss: true, ...toughen(b, n), hp: Math.round(b.hp * (1 + lap * 0.5) * (1 + n * 0.02)) });
  }
  return { n, boss, foes, theme: THEMES[Math.floor((n - 1) / 5) % THEMES.length], obstacles: n >= 4, movers: n >= 6 };
}

/** The bonus fight: just the Golden Archer, scaled to how far the player has got. */
export function bonusLevel(n) {
  return { n, boss: true, bonus: true, foes: [{ type: 'boss', boss: true, ...toughen(GOLDEN, n) }], theme: 'gold', obstacles: false, movers: false };
}
