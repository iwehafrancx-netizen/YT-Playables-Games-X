import { BossCannonLevel } from '../modes/bossCannon.js';
import { BossBowlLevel } from '../modes/bossBowl.js';
import { BossSwingLevel } from '../modes/bossSwing.js';
import { BossStompLevel } from '../modes/bossStomp.js';

// A boss turns up after every sixth level. The four fights take turns, so
// two bosses in a row never play the same way, and each lap round they get
// a little tougher.
export const BOSS_EVERY = 6;

export const BOSS_DEPT = { id: 'boss', name: 'Boss Battle', theme: 'dusk' };

const INK = '#1d2440';
const frame = (body) =>
  `<svg viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="150" fill="#9fd0ff"/><rect y="112" width="300" height="38" fill="#c9ccd4"/>${body}</svg>`;
const robot = (x, y, s, paint, extra = '') => `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="3">
  <rect x="-10" y="-30" width="9" height="30" rx="3" fill="#2a2f45"/><rect x="1" y="-30" width="9" height="30" rx="3" fill="#2a2f45"/>
  <rect x="-24" y="-72" width="48" height="44" rx="10" fill="${paint}"/><circle cx="0" cy="-50" r="8" fill="#57f2ff"/>
  <rect x="-18" y="-100" width="36" height="28" rx="8" fill="${paint}"/><circle cx="-8" cy="-87" r="6" fill="#fff"/><circle cx="8" cy="-87" r="6" fill="#fff"/>
  <circle cx="-7" cy="-86" r="2.5" fill="${INK}"/><circle cx="9" cy="-86" r="2.5" fill="${INK}"/>${extra}</g>`;
const ragdoll = (x, y, s = 1, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" stroke="${INK}" stroke-width="2.5" fill="#ef3b36">
  <circle cy="-22" r="7"/><rect x="-6" y="-15" width="12" height="15" rx="5"/><path d="M-6 -12 L-15 -20 M6 -12 L15 -20 M-3 0 L-8 12 M3 0 L8 12" stroke-width="5" stroke-linecap="round" stroke="#ef3b36"/></g>`;

const PREVIEWS = {
  cannon: frame(`<g stroke="${INK}" stroke-width="3"><rect x="22" y="100" width="40" height="14" rx="5" fill="#2a2f45"/><rect x="30" y="78" width="46" height="18" rx="9" fill="#ef3b36" transform="rotate(-30 40 92)"/></g>
    <path d="M80 70 Q150 -5 222 62" fill="none" stroke="#ffc93c" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>${ragdoll(150, 34, 0.8, 40)}${robot(232, 114, 1, '#8f5de5')}`),
  bowl: frame(`<path d="M120 150 L140 60 L160 60 L180 150 Z" fill="#e8c48f" stroke="${INK}" stroke-width="3"/>
    <g stroke="${INK}" stroke-width="3"><ellipse cx="150" cy="62" rx="40" ry="18" fill="#ff6a3d"/><circle cx="150" cy="64" r="7" fill="#57f2ff"/>
    <path d="M112 50 l-14 -24 l14 4 Z M188 50 l14 -24 l-14 4 Z" fill="#ffc93c"/><circle cx="140" cy="38" r="7" fill="#fff"/><circle cx="160" cy="38" r="7" fill="#fff"/>
    <circle cx="141" cy="39" r="3" fill="${INK}"/><circle cx="161" cy="39" r="3" fill="${INK}"/></g>${ragdoll(152, 132, 0.9, 200)}`),
  swing: frame(`<g stroke="${INK}" stroke-width="3"><rect x="18" y="10" width="10" height="104" fill="#ffc93c"/><rect x="18" y="10" width="60" height="9" fill="#ffc93c"/></g>
    <line x1="74" y1="18" x2="104" y2="72" stroke="${INK}" stroke-width="3"/>${ragdoll(108, 96, 0.9, -30)}
    <path d="M118 80 Q170 30 214 42" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>
    ${robot(232, 114, 1, '#3ddc84', `<path d="M-20 -98 A20 20 0 0 1 20 -98 Z" fill="#bfe6ff" fill-opacity="0.8"/>`)}`),
  stomp: frame(`<rect x="20" y="104" width="260" height="10" rx="4" fill="#2a2f45" stroke="${INK}" stroke-width="3"/>
    ${robot(150, 104, 0.9, '#ff5ca8')}${ragdoll(150, 6 + 18, 0.9, 180)}
    <path d="M150 34 L150 46" stroke="#ffc93c" stroke-width="5" stroke-linecap="round"/><path d="M143 40 L150 48 L157 40" fill="none" stroke="#ffc93c" stroke-width="5" stroke-linecap="round"/>`),
};

// Each fight: who it is, how you win, and how it scales with each lap (`k` = 0, 1, 2…).
const FIGHTS = [
  {
    kind: 'cannon',
    Mode: BossCannonLevel,
    name: 'Goliath',
    label: 'Cannon fight',
    how: 'Fire the ragdoll from the cannon at the glowing core on its chest before it stomps up to you.',
    hint: 'Drag to aim · let go to fire at the glowing core',
    paint: 0x8f5de5,
    stats: (k) => ({ hp: 3 + k, shots: 8, pace: 0.55 + k * 0.12, weave: 0.5 + k * 0.1 }),
  },
  {
    kind: 'bowl',
    Mode: BossBowlLevel,
    name: 'Crab King',
    label: 'Bowling fight',
    how: 'Bowl the ragdoll into its glowing belly while the claws are up. Claws down? You bounce off!',
    hint: 'Hold to power up · let go to bowl when its claws are up',
    paint: 0xff6a3d,
    stats: (k) => ({ hp: 3 + k, rolls: 7, scuttle: 0.6 + k * 0.12, cycle: 2.6 - Math.min(0.8, k * 0.2), openShare: 0.5 - Math.min(0.15, k * 0.04) }),
  },
  {
    kind: 'swing',
    Mode: BossSwingLevel,
    name: 'Wrecker',
    label: 'Crane fight',
    how: 'Swing from the crane and let go to fly head first into its glass dome.',
    hint: 'Hold to swing higher · let go to smash into the glass dome',
    paint: 0x3ddc84,
    stats: (k) => ({ hp: 3 + k, tries: 7, pace: 0.4 + k * 0.1, roam: 2 + Math.min(2, k * 0.5) }),
  },
  {
    kind: 'stomp',
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
    preview: PREVIEWS[fight.kind],
    paint: fight.paint,
    theme: ['dusk', 'sunset', 'noon', 'morning'][(mk - 1) % 4],
    ...fight.stats(lap),
  };
}
