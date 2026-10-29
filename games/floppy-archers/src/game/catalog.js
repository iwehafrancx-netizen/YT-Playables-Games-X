// Everything the skull shop sells.

/**
 * Arrow types. `price[i]` is the cost to reach level i + 1 (the first entry
 * unlocks it); `lv[i]` is what the arrow does at that level.
 */
export const ARROWS = {
  basic: {
    name: 'Wooden Arrow',
    desc: 'Straight and true. Upgrades add damage.',
    color: '#c9935a',
    head: '#d9dde3',
    price: [0, 30, 80],
    lv: [{ dmg: 1 }, { dmg: 1.2 }, { dmg: 1.4 }],
  },
  triple: {
    name: 'Triple Shot',
    desc: 'Three arrows in a fan. Hard to dodge.',
    color: '#8fd0ff',
    head: '#ffffff',
    price: [60, 100, 170],
    lv: [
      { dmg: 0.6, count: 3, spread: 4 },
      { dmg: 0.7, count: 3, spread: 3.5 },
      { dmg: 0.75, count: 3, spread: 3 },
    ],
  },
  fire: {
    name: 'Fire Arrow',
    desc: 'Sets them alight. They keep burning.',
    color: '#ff7a1a',
    head: '#ffd23a',
    price: [80, 130, 210],
    lv: [
      { dmg: 1, burn: 5, time: 3 },
      { dmg: 1.05, burn: 7, time: 3.5 },
      { dmg: 1.1, burn: 10, time: 4 },
    ],
  },
  poison: {
    name: 'Poison Arrow',
    desc: 'Slow, nasty damage and they shoot weaker.',
    color: '#7ad13a',
    head: '#b7ff5a',
    price: [110, 170, 250],
    lv: [
      { dmg: 0.9, poison: 3.5, time: 6 },
      { dmg: 0.95, poison: 5, time: 6 },
      { dmg: 1, poison: 7, time: 7 },
    ],
  },
  shock: {
    name: 'Shock Arrow',
    desc: 'Zaps them stiff: no shooting for a moment.',
    color: '#5ad7ff',
    head: '#e6fbff',
    price: [150, 230, 330],
    lv: [
      { dmg: 0.9, stun: 1.2 },
      { dmg: 1, stun: 1.6 },
      { dmg: 1.1, stun: 2 },
    ],
  },
  bomb: {
    name: 'Bomb Arrow',
    desc: 'Explodes on impact. Sends them flying.',
    color: '#4a4f5c',
    head: '#ff4a3d',
    price: [200, 310, 440],
    lv: [
      { dmg: 0.8, blast: 1.5, blastDmg: 22 },
      { dmg: 0.85, blast: 1.75, blastDmg: 30 },
      { dmg: 0.9, blast: 2, blastDmg: 40 },
    ],
  },
};

export const ARROW_ORDER = ['basic', 'triple', 'fire', 'poison', 'shock', 'bomb'];

/** Body upgrades: each level adds `step` to the stat. */
export const STATS = {
  hp: { name: 'Health', desc: '+20 max health', icon: 'heart', step: 20, price: [40, 80, 140, 220, 320] },
  stamina: { name: 'Stamina', desc: '+25% stamina refill', icon: 'bolt', step: 0.25, price: [35, 70, 120, 190, 280] },
  power: { name: 'Power', desc: '+12% arrow damage', icon: 'target', step: 0.12, price: [50, 100, 170, 260, 380] },
};

/** Suit colours. The ones with a price can be bought; the rest are for enemies. */
export const SUITS = {
  red: { body: '#ef3b36', trim: '#a8221e', price: 0, label: 'Red' },
  yellow: { body: '#ffc61a', trim: '#c98f00', price: 50, label: 'Yellow' },
  green: { body: '#35c24a', trim: '#1c7f2d', price: 100, label: 'Green' },
  blue: { body: '#2f7de1', trim: '#1a4f99', price: 160, label: 'Blue' },
  purple: { body: '#9b5de5', trim: '#61309f', price: 240, label: 'Purple' },
  pink: { body: '#ff5ca8', trim: '#c92f77', price: 330, label: 'Pink' },
  white: { body: '#f2f2ee', trim: '#a9adb6', price: 450, label: 'White' },
  orange: { body: '#ff8a1f', trim: '#b85700' },
  teal: { body: '#1fc7b4', trim: '#0d7f73' },
  black: { body: '#3a3d48', trim: '#16171c' },
  gold: { body: '#ffcf33', trim: '#b8860b' },
};

export const SHOP_SUITS = Object.keys(SUITS).filter((k) => SUITS[k].price !== undefined);

/** The player's numbers once their upgrades are counted. */
export function playerStats(save) {
  const s = save.stats ?? {};
  return {
    hp: 100 + STATS.hp.step * (s.hp ?? 0),
    regen: 12 * (1 + STATS.stamina.step * (s.stamina ?? 0)),
    power: 1 + STATS.power.step * (s.power ?? 0),
  };
}
