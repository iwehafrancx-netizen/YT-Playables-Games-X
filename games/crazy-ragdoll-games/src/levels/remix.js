// Every course comes back once as "After Hours": evening light and a
// tougher ask.
const scale = (stars, k) => stars.map((s, i) => Math.round((s * k[i]) / 10) * 10);

const HARDER = {
  cannon: (l) => ({ reveal: (l.reveal ?? 0.55) * 0.65 }),
  crash: (l) => ({ stars: scale(l.stars, [1.1, 1.2, 1.25]) }),
  cart: (l) => ({ stars: scale(l.stars, [1.1, 1.2, 1.25]) }),
  drop: (l) => ({ stars: scale(l.stars, [1.1, 1.2, 1.25]) }),
  hammer: (l) => ({ stars: l.stars.map((s) => Math.round((s * 1.2) / 50) * 50) }),
  rocket: (l) => ({ speed: (l.speed ?? 6.5) + 1 }),
  wipe: (l) => ({ time: l.time + 6, ramp: (l.ramp ?? 0.5) + 0.3 }),
  pin: (l) => ({ stars: l.stars.map((s) => Math.round((s * 1.25) / 100) * 100), balls: 3 }),
  plinko: (l) => ({ goals: l.goals.map((g) => Math.round((g * 1.25) / 100) * 100) }),
  bounce: (l) => ({ time: Math.round(l.time * 0.8) }),
  sling: (l) => ({ shots: Math.max(2, (l.shots ?? 3) - 1) }),
  bowl: (l) => ({ rolls: 1, goals: l.goals.map((g) => g - 1) }),
  smash: (l) => ({ hp: Math.round(l.hp * 1.3), time: Math.round(l.time * 0.9) }),
  swing: (l) => ({ tries: Math.max(2, (l.tries ?? 3) - 1), pad: { ...l.pad, r: (l.pad.r ?? 2) * 0.8 } }),
};

export function remixes(dept, levels) {
  const harder = HARDER[dept];
  if (!harder) return [];
  return levels.map((l) => ({ ...l, ...harder(l), name: `${l.name}: After Hours`, theme: 'sunset', hint: undefined }));
}
