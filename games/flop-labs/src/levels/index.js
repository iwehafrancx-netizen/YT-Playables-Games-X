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
    blurb: 'Fire the dummy. Flatten the targets.',
    theme: 'morning',
    color: '#e2463a',
    icon: 'cannon',
    Mode: BallisticsLevel,
    levels: BAY,
  },
  {
    id: 'drop',
    name: 'Drop Test',
    blurb: 'Shove the dummy. Score every bump, bonk and crunch.',
    theme: 'overcast',
    color: '#3c86e8',
    icon: 'stairs',
    Mode: DropTestLevel,
    levels: DROP,
  },
  {
    id: 'cart',
    name: 'Cart Hill',
    blurb: 'Ride the trolley downhill. Bail at the perfect moment.',
    theme: 'sunset',
    color: '#3fc79a',
    icon: 'cart',
    Mode: CartHillLevel,
    levels: CART,
  },
  {
    id: 'hop',
    name: 'Hop Yard',
    blurb: 'Hop a wobbly dummy across a moving obstacle course.',
    theme: 'noon',
    color: '#f0782a',
    icon: 'hop',
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

export function findLevel(id) {
  for (const dept of DEPARTMENTS) {
    const i = dept.levels.findIndex((l) => l.id === id);
    if (i >= 0) return { dept, level: dept.levels[i], next: dept.levels[i + 1] ?? null };
  }
  return null;
}
