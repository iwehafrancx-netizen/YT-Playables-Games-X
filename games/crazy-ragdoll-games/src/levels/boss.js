import { BossFightLevel } from '../modes/bossFight.js';
import { BossCannonLevel } from '../modes/bossCannon.js';
import { BossBowlLevel } from '../modes/bossBowl.js';
import { BossSwingLevel } from '../modes/bossSwing.js';
import { BossStompLevel } from '../modes/bossStomp.js';

// A boss turns up after every sixth level. The first is the sumo-ring robot;
// after that come four more, each fought a different way. They take turns,
// so two bosses in a row never play the same, and get tougher every lap.
export const BOSS_EVERY = 6;

export const BOSS_DEPT = { id: 'boss', name: 'Boss Fight', theme: 'dusk' };

const RING_ROSTER = [
  { name: 'Big Bouncer', paint: 'toyPurple', eye: 0xffd23a },
  { name: 'Mega Mixer', paint: 'toyOrange', eye: 0x8ff0ff },
  { name: 'Sir Smashalot', paint: 'toyGreen', eye: 0xff6b9a },
  { name: 'Turbo Toaster', paint: 'toyPink', eye: 0xfff3a0 },
];

// Each fight: who it is, how you win, and how it scales with each lap (`k` = 0, 1, 2…).
const FIGHTS = [
  {
    Mode: BossFightLevel,
    label: 'Sumo ring',
    how: 'Lure it into a pylon to stun it, then dive into it before it shakes it off.',
    look: (k) => RING_ROSTER[k % RING_ROSTER.length],
    stats: (k) => ({ hp: 3 + Math.min(3, k), speed: 12 + Math.min(k, 4) * 1.4, stun: Math.max(2.2, 3.2 - Math.min(k, 4) * 0.25), stomps: k >= 1 }),
  },
  {
    Mode: BossCannonLevel,
    name: 'Goliath',
    label: 'Cannon fight',
    how: 'Fire the ragdoll from the cannon at the glowing core on its chest before it stomps up to you.',
    hint: 'Drag to aim · let go to fire at the glowing core',
    paint: 0x8f5de5,
    stats: (k) => ({ hp: 3 + k, shots: 8, pace: 0.55 + k * 0.12, weave: 0.5 + k * 0.1 }),
  },
  {
    Mode: BossBowlLevel,
    name: 'Crab King',
    label: 'Bowling fight',
    how: 'Bowl the ragdoll into its glowing belly while the claws are up. Claws down? You bounce off!',
    hint: 'Hold to power up · let go to bowl when its claws are up',
    paint: 0xff6a3d,
    stats: (k) => ({ hp: 3 + k, rolls: 7, scuttle: 0.6 + k * 0.12, cycle: 2.6 - Math.min(0.8, k * 0.2), openShare: 0.5 - Math.min(0.15, k * 0.04) }),
  },
  {
    Mode: BossSwingLevel,
    name: 'Wrecker',
    label: 'Crane fight',
    how: 'Swing from the crane and let go to fly head first into its glass dome.',
    hint: 'Hold to swing higher · let go to smash into the glass dome',
    paint: 0x3ddc84,
    stats: (k) => ({ hp: 3 + k, tries: 7, pace: 0.4 + k * 0.1, roam: 2 + Math.min(2, k * 0.5) }),
  },
  {
    Mode: BossStompLevel,
    name: 'Stomper',
    label: 'Bounce fight',
    how: 'Bounce on the giant trampoline and land on its head. Bump into its body and it swats you!',
    hint: 'Hold left or right to steer · land on its head',
    paint: 0xff5ca8,
    stats: (k) => ({ hp: 4 + k, time: 60, pace: 1.6 + k * 0.4 }),
  },
];

/** The boss met after level `n` (a multiple of BOSS_EVERY). */
export function bossFor(n) {
  const mk = Math.max(1, Math.floor(n / BOSS_EVERY));
  const fight = FIGHTS[(mk - 1) % FIGHTS.length];
  const lap = Math.floor((mk - 1) / FIGHTS.length);
  return {
    id: `boss-${mk}`,
    mk,
    kind: fight.label,
    Mode: fight.Mode,
    name: fight.name,
    how: fight.how,
    hint: fight.hint,
    paint: fight.paint,
    theme: 'dusk',
    ...fight.look?.(lap),
    ...fight.stats(lap),
  };
}
