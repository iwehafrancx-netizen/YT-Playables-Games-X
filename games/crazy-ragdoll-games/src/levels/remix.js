// Every course comes back once as "After Hours": evening light and a
// tougher ask.
const HARDER = {
  stack: (l) => ({ goal: +(l.goal + 0.2).toFixed(1), dummies: l.dummies + 1, speed: (l.speed ?? 1) * 1.2 }),
  hammer: (l) => ({ stars: l.stars.map((s) => Math.round((s * 1.2) / 50) * 50) }),
  rocket: (l) => ({ speed: (l.speed ?? 6.5) + 1 }),
  wipe: (l) => ({ time: l.time + 6, ramp: (l.ramp ?? 0.5) + 0.3 }),
  pin: (l) => ({ stars: l.stars.map((s) => Math.round((s * 1.25) / 100) * 100), balls: 3 }),
  plinko: (l) => ({ goals: l.goals.map((g) => Math.round((g * 1.25) / 100) * 100) }),
  bounce: (l) => ({ time: Math.round(l.time * 0.8) }),
  slide: (l) => ({ maxSpeed: (l.maxSpeed ?? 13) + 2, bonks: Math.max(3, (l.bonks ?? 4) - 1) }),
};

export function remixes(dept, levels) {
  const harder = HARDER[dept];
  if (!harder) return [];
  return levels.map((l) => ({ ...l, ...harder(l), name: `${l.name}: After Hours`, theme: 'sunset', hint: undefined }));
}
