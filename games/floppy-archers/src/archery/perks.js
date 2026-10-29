// Upgrades picked between waves. They last for good (they're saved), each up
// to `max` times; `apply` turns the picked counts into the archer's stats.
export const PERKS = [
  { id: 'damage', name: 'Sharp Tips', icon: 'bolt', text: '+25% arrow damage', max: 5 },
  { id: 'health', name: 'Thick Skin', icon: 'heart', text: '+25 max health', max: 5 },
  { id: 'stamina', name: 'Second Wind', icon: 'clock', text: 'Stamina refills 40% faster', max: 4 },
  { id: 'double', name: 'Double Shot', icon: 'next', text: 'Fire one extra arrow each shot', max: 2 },
  { id: 'fire', name: 'Fire Arrows', icon: 'star', text: 'Hits keep burning for 3 seconds', max: 3 },
  { id: 'vampire', name: 'Leech', icon: 'heart', text: 'Heal 15% of the damage you deal', max: 3 },
  { id: 'eagle', name: 'Eagle Eye', icon: 'target', text: 'Headshots hit 50% harder', max: 3 },
  { id: 'power', name: 'Long Draw', icon: 'play', text: 'Arrows fly 12% faster and further', max: 3 },
];

/** Three different perks the player can still take more of. */
export function offer(have, rand = Math.random) {
  const open = PERKS.filter((p) => (have[p.id] ?? 0) < p.max);
  const out = [];
  while (out.length < 3 && open.length) out.push(open.splice(Math.floor(rand() * open.length), 1)[0]);
  return out;
}

/** The player's stats from the perks taken so far. */
export function stats(have) {
  const n = (id) => have[id] ?? 0;
  return {
    hp: 100 + n('health') * 25,
    damage: 20 * (1 + n('damage') * 0.25),
    regen: 9 * (1 + n('stamina') * 0.4),
    arrows: 1 + n('double'),
    burn: n('fire') * 4,
    leech: n('vampire') * 0.15,
    headshot: 2.2 * (1 + n('eagle') * 0.5),
    speed: 1 + n('power') * 0.12,
  };
}
