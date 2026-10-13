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
import { CrashCourseLevel } from '../modes/crashCourse.js';
import { CRASH } from './crash.js';
import { SwingShiftLevel } from '../modes/swingShift.js';
import { SWING } from './swing.js';
import { PullRigLevel } from '../modes/pullRig.js';
import { RIG } from './rig.js';
import { FlipTestLevel } from '../modes/flipTest.js';
import { FLIP } from './flip.js';
import { WreckingCrewLevel } from '../modes/wreckingCrew.js';
import { WRECK } from './wreck.js';
import { remixes } from './remix.js';

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
  {
    id: 'flip',
    name: 'Flip Test',
    theme: 'morning',
    Mode: FlipTestLevel,
    levels: FLIP,
  },
  {
    id: 'wreck',
    name: 'Wrecking Crew',
    theme: 'noon',
    Mode: WreckingCrewLevel,
    levels: WRECK,
  },
  {
    id: 'crash',
    name: 'Crash Course',
    theme: 'noon',
    Mode: CrashCourseLevel,
    levels: CRASH,
  },
  {
    id: 'swing',
    name: 'Swing Shift',
    theme: 'noon',
    Mode: SwingShiftLevel,
    levels: SWING,
  },
  {
    id: 'pins',
    name: 'Pull Rig',
    theme: 'noon',
    Mode: PullRigLevel,
    levels: RIG,
  },
];

for (const dept of DEPARTMENTS) {
  dept.levels = [...dept.levels, ...remixes(dept.id, dept.levels)];
  dept.levels.forEach((lvl, i) => {
    lvl.id = `${dept.id}-${i + 1}`;
    lvl.index = i;
  });
}

const ALL = DEPARTMENTS.flatMap((dept) => dept.levels.map((level) => ({ dept, level })));

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// The run always opens with the cart, then the cannon. After that each pass
// deals the next-hardest course from every department in a shuffled order,
// so the mix keeps changing while the difficulty still climbs.
const OPENERS = ['cart', 'bay'];
const FIRST_LAP = [];
const deepest = Math.max(...DEPARTMENTS.map((d) => d.levels.length));
const dealRand = rng(3);
for (let i = 0; i < deepest; i++) {
  const tier = shuffle(ALL.filter((e) => e.level.index === i), dealRand);
  if (i === 0) {
    const rank = (e) => (OPENERS.includes(e.dept.id) ? OPENERS.indexOf(e.dept.id) : OPENERS.length);
    tier.sort((a, b) => rank(a) - rank(b));
  }
  if (tier.length > 1 && tier[0].dept === FIRST_LAP.at(-1)?.dept) [tier[0], tier[1]] = [tier[1], tier[0]];
  FIRST_LAP.push(...tier);
}

/** Later laps reshuffle the whole set, never putting one department twice in a row. */
function lap(n) {
  if (n === 0) return FIRST_LAP;
  const rand = rng(n + 7);
  for (;;) {
    const order = shuffle(ALL.slice(), rand);
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

/** The run number a course first appears at, for replaying it from the menu. */
export function numberOf(id) {
  const i = lap(0).findIndex((e) => e.level.id === id);
  return i < 0 ? 0 : i + 1;
}
