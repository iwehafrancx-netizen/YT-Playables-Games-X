import { StackAttackLevel } from '../modes/stackAttack.js';
import { STACK } from './stack.js';
import { HammerSpinLevel } from '../modes/hammerSpin.js';
import { HAMMER } from './hammer.js';
import { RocketRiderLevel } from '../modes/rocketRider.js';
import { ROCKET } from './rocket.js';
import { WipeoutLevel } from '../modes/wipeout.js';
import { WIPE } from './wipe.js';
import { PinballLevel } from '../modes/pinball.js';
import { PIN } from './pin.js';
import { PlinkoLevel } from '../modes/plinko.js';
import { PLINKO } from './plinko.js';
import { BounceUpLevel } from '../modes/bounceUp.js';
import { BOUNCE } from './bounce.js';
import { SlideLevel } from '../modes/slide.js';
import { SLIDE } from './slide.js';
import { remixes } from './remix.js';

// `intro` is the how-to-play card shown the first time each game comes up.
export const DEPARTMENTS = [
  {
    id: 'stack', name: 'Stack Attack', theme: 'studio', Mode: StackAttackLevel, levels: STACK,
    intro: { icon: 'dummy', goal: 'Pile ragdolls on the podium until the tower passes the red line.', how: [['play', 'Tap to drop the ragdoll off the crane'], ['target', 'Wait till he swings over the podium'], ['star', 'Fewer drops = more stars']] },
  },
  {
    id: 'hammer', name: 'Hammer Spin', theme: 'studio', Mode: HammerSpinLevel, levels: HAMMER,
    intro: { icon: 'retry', goal: 'Spin the ragdoll round like a hammer and fling him onto the targets.', how: [['play', 'Hold to spin him faster'], ['target', 'Let go when the red ring is on a target'], ['star', 'Bullseyes score the most']] },
  },
  {
    id: 'rocket', name: 'Rocket Rider', theme: 'studio', Mode: RocketRiderLevel, levels: ROCKET,
    intro: { icon: 'bolt', goal: 'Hang on to the rocket, fly through the gaps and land on the pad.', how: [['play', 'Hold to fly up, let go to drop'], ['skull', "Don't touch the blocks"], ['star', 'Collect the rings for stars']] },
  },
  {
    id: 'wipe', name: 'Wipeout', theme: 'studio', Mode: WipeoutLevel, levels: WIPE,
    intro: { icon: 'clock', goal: 'Stay on the spinning stage until the clock runs out.', how: [['play', 'Tap to hop the low bars'], ['bolt', 'Hold for a big jump over the tall ones'], ['star', 'Grab stars on the way']] },
  },
  {
    id: 'pin', name: 'Ragdoll Pinball', theme: 'studio', Mode: PinballLevel, levels: PIN,
    intro: { icon: 'star', goal: 'He is the pinball. Hit the target score before your balls drain.', how: [['back', 'Tap the left side for the left flipper'], ['next', 'Tap the right side for the right flipper'], ['bolt', 'Bumpers and rollovers score big']] },
  },
  {
    id: 'plinko', name: 'Plinko Party', theme: 'studio', Mode: PlinkoLevel, levels: PLINKO,
    intro: { icon: 'target', goal: 'Drop the ragdoll through the pegs into the best buckets.', how: [['next', 'Drag left or right to aim'], ['play', 'Let go to drop him'], ['star', 'Middle buckets pay most, ×2 doubles your score']] },
  },
  {
    id: 'bounce', name: 'Bounce Up', theme: 'studio', Mode: BounceUpLevel, levels: BOUNCE,
    intro: { icon: 'heart', goal: 'Bounce from pad to pad all the way up to the flag.', how: [['back', 'Hold the left side to steer left'], ['next', 'Hold the right side to steer right'], ['clock', 'Beat the clock — purple pads move']] },
  },
  {
    id: 'slide', name: "Slip 'n' Slide", theme: 'studio', Mode: SlideLevel, levels: SLIDE,
    intro: { icon: 'next', goal: 'Slide all the way down and splash into the pool.', how: [['back', 'Hold left or right to steer'], ['skull', 'Dodge the blocks — too many bonks ends the ride'], ['bolt', 'Hit the yellow ramps for big air']] },
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

// The run always opens with the crane, then the hammer. After that each pass
// deals the next-hardest course from every department in a shuffled order,
// so the mix keeps changing while the difficulty still climbs.
const OPENERS = ['stack', 'hammer'];
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
