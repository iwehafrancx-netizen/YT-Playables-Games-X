import { BallisticsLevel } from '../modes/ballistics.js';
import { BAY } from './bay.js';
import { DropTestLevel } from '../modes/dropTest.js';
import { DROP } from './drop.js';
import { CartHillLevel } from '../modes/cartHill.js';
import { CART } from './cart.js';
import { HopYardLevel } from '../modes/hopYard.js';
import { HOP } from './hop.js';
import { PinAlleyLevel } from '../modes/pinAlley.js';
import { ALLEY } from './alley.js';

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
  {
    id: 'alley',
    name: 'Pin Alley',
    theme: 'dusk',
    Mode: PinAlleyLevel,
    levels: ALLEY,
  },
];

for (const dept of DEPARTMENTS) {
  dept.levels.forEach((lvl, i) => {
    lvl.id = `${dept.id}-${i + 1}`;
    lvl.index = i;
  });
}

const ALL = DEPARTMENTS.flatMap((dept) => dept.levels.map((level) => ({ dept, level })));

// Departments take turns in this order; each pass through them deals the
// next-hardest course from each, so difficulty climbs steadily.
const ROTATION = ['bay', 'hop', 'alley', 'drop', 'crash', 'cart', 'golf', 'crane', 'pins'];
const FIRST_LAP = [];
const deepest = Math.max(...DEPARTMENTS.map((d) => d.levels.length));
for (let i = 0; i < deepest; i++) {
  for (const id of ROTATION) {
    const entry = ALL.find((e) => e.dept.id === id && e.level.index === i);
    if (entry) FIRST_LAP.push(entry);
  }
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
