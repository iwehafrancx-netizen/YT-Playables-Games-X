import { BallisticsLevel } from '../modes/ballistics.js';
import { BAY } from './bay.js';
import { DropTestLevel } from '../modes/dropTest.js';
import { DROP } from './drop.js';
import { CartHillLevel } from '../modes/cartHill.js';
import { CART } from './cart.js';
import { HopYardLevel } from '../modes/hopYard.js';
import { HOP } from './hop.js';

export const DEPARTMENTS = [
  {
    id: 'bay',
    name: 'Ballistics Bay',
    theme: 'morning',
    Mode: BallisticsLevel,
    levels: BAY,
  },
  {
    id: 'drop',
    name: 'Drop Test',
    theme: 'overcast',
    Mode: DropTestLevel,
    levels: DROP,
  },
  {
    id: 'cart',
    name: 'Cart Hill',
    theme: 'sunset',
    Mode: CartHillLevel,
    levels: CART,
  },
  {
    id: 'hop',
    name: 'Hop Yard',
    theme: 'noon',
    Mode: HopYardLevel,
    levels: HOP,
  },
];

for (const dept of DEPARTMENTS) {
  dept.levels.forEach((lvl, i) => {
    lvl.id = `${dept.id}-${i + 1}`;
    lvl.index = i;
  });
}

const ALL = DEPARTMENTS.flatMap((dept) => dept.levels.map((level) => ({ dept, level })));

// First lap: departments take turns and each gets harder as the lap goes on.
const FIRST_LAP = [];
for (let i = 0; i < 5; i++) {
  for (const id of ['bay', 'hop', 'drop', 'cart']) FIRST_LAP.push(ALL.find((e) => e.dept.id === id && e.level.index === i));
}

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Later laps reshuffle the whole set, never putting one department twice in a row. */
function lap(n) {
  if (n === 0) return FIRST_LAP;
  const rand = rng(n + 7);
  for (;;) {
    const order = ALL.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.every((e, i) => i === 0 || e.dept !== order[i - 1].dept)) return order;
  }
}

const lapCache = new Map();

/** The endless run: level `n` (1-based) maps onto the course list, lap after lap. */
export function levelAt(n) {
  const i = Math.max(0, n - 1);
  const k = Math.floor(i / ALL.length);
  if (!lapCache.has(k)) lapCache.set(k, lap(k));
  return lapCache.get(k)[i % ALL.length];
}
