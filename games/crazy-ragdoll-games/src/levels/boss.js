// A boss turns up after every sixth level. Each one is the same machine in a
// new coat of paint, a little tougher and a little quicker than the last.
const ROSTER = [
  { name: 'Big Bouncer', paint: 'toyPurple', eye: 0xffd23a },
  { name: 'Mega Mixer', paint: 'toyOrange', eye: 0x8ff0ff },
  { name: 'Sir Smashalot', paint: 'toyGreen', eye: 0xff6b9a },
  { name: 'Turbo Toaster', paint: 'toyPink', eye: 0xfff3a0 },
];

export const BOSS_EVERY = 6;

export const BOSS_DEPT = { id: 'boss', name: 'Boss Fight', theme: 'studio' };

/** The boss met after level `n` (a multiple of BOSS_EVERY). */
export function bossFor(n) {
  const mk = Math.max(1, Math.floor(n / BOSS_EVERY));
  const look = ROSTER[(mk - 1) % ROSTER.length];
  const step = Math.min(mk - 1, 4);
  return {
    id: `boss-${mk}`,
    mk,
    name: look.name,
    paint: look.paint,
    eye: look.eye,
    theme: 'studio',
    hp: 3 + Math.min(3, mk - 1),
    speed: 12 + step * 1.4,
    stun: Math.max(2.2, 3.2 - step * 0.25),
    // From the third boss on it also stomps between charges, not only when hurt.
    stomps: mk >= 3,
  };
}
