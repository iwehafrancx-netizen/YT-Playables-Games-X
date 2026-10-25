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
import { SlingSmashLevel } from '../modes/slingSmash.js';
import { SLING } from './sling.js';
import { BowlingLevel } from '../modes/bowling.js';
import { BOWL } from './bowling.js';
import { BallisticsLevel } from '../modes/ballistics.js';
import { BAY } from './bay.js';
import { CrashCourseLevel } from '../modes/crashCourse.js';
import { CRASH } from './crash.js';
import { CartHillLevel } from '../modes/cartHill.js';
import { CART } from './cart.js';
import { DropTestLevel } from '../modes/dropTest.js';
import { DROP } from './drop.js';
import { SmashYardLevel } from '../modes/smashYard.js';
import { SMASH } from './smash.js';
import { remixes } from './remix.js';

// `intro` is the how-to-play card shown the first time each game comes up.
export const DEPARTMENTS = [
  {
    id: 'hammer', name: 'Hammer Spin', theme: 'morning', Mode: HammerSpinLevel, levels: HAMMER,
    intro: { icon: 'retry', goal: 'Spin the ragdoll round like a hammer and fling him onto the targets.', how: [['play', 'Hold to spin him faster'], ['target', 'Let go when the red ring is on a target'], ['star', 'Bullseyes score the most']] },
  },
  {
    id: 'rocket', name: 'Rocket Rider', theme: 'noon', Mode: RocketRiderLevel, levels: ROCKET,
    intro: { icon: 'bolt', goal: 'Hang on to the rocket, fly through the gaps and land on the pad.', how: [['play', 'Hold to fly up, let go to drop'], ['skull', "Don't touch the blocks"], ['star', 'Collect the rings for stars']] },
  },
  {
    id: 'wipe', name: 'Wipeout', theme: 'sunset', Mode: WipeoutLevel, levels: WIPE,
    intro: { icon: 'clock', goal: 'Stay on the spinning stage until the clock runs out.', how: [['play', 'Tap to hop the low bars'], ['bolt', 'Hold for a big jump over the tall ones'], ['star', 'Grab stars on the way']] },
  },
  {
    id: 'pin', name: 'Ragdoll Pinball', theme: 'noon', Mode: PinballLevel, levels: PIN,
    intro: { icon: 'star', goal: 'He is the pinball. Hit the target score before your balls drain.', how: [['back', 'Tap the left side for the left flipper'], ['next', 'Tap the right side for the right flipper'], ['bolt', 'Bumpers and rollovers score big']] },
  },
  {
    id: 'plinko', name: 'Plinko Party', theme: 'morning', Mode: PlinkoLevel, levels: PLINKO,
    intro: { icon: 'target', goal: 'Drop the ragdoll through the pegs into the best buckets.', how: [['next', 'Drag left or right to aim'], ['play', 'Let go to drop him'], ['star', 'Middle buckets pay most, ×2 doubles your score']] },
  },
  {
    id: 'bounce', name: 'Bounce Up', theme: 'noon', Mode: BounceUpLevel, levels: BOUNCE,
    intro: { icon: 'heart', goal: 'Bounce from pad to pad all the way up to the flag.', how: [['back', 'Hold the left side to steer left'], ['next', 'Hold the right side to steer right'], ['clock', 'Beat the clock — purple pads move']] },
  },
  {
    id: 'sling', name: 'Sling Smash', theme: 'noon', Mode: SlingSmashLevel, levels: SLING,
    intro: { icon: 'bolt', goal: 'Fire him from a giant slingshot and blow up every TNT crate.', how: [['back', 'Drag down to pull back, sideways to aim'], ['play', 'Let go to fire — blow up every TNT crate'], ['target', 'Hit the bullseyes for bonus points']] },
  },
  {
    id: 'bowl', name: 'Ragdoll Bowling', theme: 'sunset', Mode: BowlingLevel, levels: BOWL,
    intro: { icon: 'target', goal: 'He is the bowling ball. Knock down as many pins as you can.', how: [['next', 'The arrow swings across the lane'], ['play', 'Hold to power up, let go to bowl'], ['star', 'Strike or spare for big bonuses']] },
  },
  {
    id: 'cannon', name: 'Cannon Blast', theme: 'morning', Mode: BallisticsLevel, levels: BAY,
    intro: { icon: 'target', goal: 'Fire him out of a cannon and knock down every target.', how: [['back', 'Drag to aim the cannon'], ['play', 'Let go to fire'], ['star', 'Fewer shots = more stars']] },
  },
  {
    id: 'crash', name: 'Crash Course', theme: 'noon', Mode: CrashCourseLevel, levels: CRASH,
    intro: { icon: 'bolt', goal: 'Drive at the wall and send him flying through the windscreen onto the target.', how: [['play', 'Hold for gas, let go to coast'], ['target', 'Hit the wall at the right speed'], ['star', 'Land on the bullseye for big points']] },
  },
  {
    id: 'cart', name: 'Cart Hill', theme: 'sunset', Mode: CartHillLevel, levels: CART,
    intro: { icon: 'next', goal: 'Ride a shopping cart down the hill and bail out onto the target.', how: [['play', 'Hold to wind up, let go to push off'], ['bolt', 'Tap again to bail out'], ['star', 'Air time and bullseyes pay extra']] },
  },
  {
    id: 'smash', name: 'Smash Yard', theme: 'noon', Mode: SmashYardLevel, levels: SMASH,
    intro: { icon: 'skull', goal: 'Smash the ragdoll to pieces before the clock runs out.', how: [['play', 'Drag anywhere to grab him'], ['next', 'Fling him into crates, spikes, saws and TNT'], ['skull', 'Empty his health bar and he breaks apart']] },
  },
  {
    id: 'drop', name: 'Drop Test', theme: 'overcast', Mode: DropTestLevel, levels: DROP,
    intro: { icon: 'skull', goal: 'Shove him down the course and score every painful bump on the way.', how: [['back', 'Drag to aim the shove'], ['play', 'Let go to push him'], ['star', 'Bigger crashes, bigger score']] },
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

// The run always opens with the cannon, the car crash, the cart and Smash Yard. After that each pass
// deals the next-hardest course from every department in a shuffled order,
// so the mix keeps changing while the difficulty still climbs.
const OPENERS = ['cannon', 'crash', 'cart', 'smash'];
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

/**
 * Later laps reshuffle which game comes when, never the same one twice in a
 * row; each game's levels still come round easiest first, so every lap
 * climbs from easy to hard.
 */
function lap(n) {
  if (n === 0) return FIRST_LAP;
  const rand = rng(n + 7);
  for (;;) {
    const order = shuffle(ALL.slice(), rand);
    if (!order.every((e, i) => i === 0 || e.dept !== order[i - 1].dept)) continue;
    const next = new Map(DEPARTMENTS.map((d) => [d, 0]));
    return order.map(({ dept }) => {
      const i = next.get(dept);
      next.set(dept, i + 1);
      return { dept, level: dept.levels[i] };
    });
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
