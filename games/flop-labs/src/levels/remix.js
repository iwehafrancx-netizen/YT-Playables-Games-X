// Remixes stretch each department's hand-built courses into more levels:
// the same place at a different time of day with tighter limits, or the
// whole layout flipped left to right.

const SKY = { morning: 'dusk', noon: 'sunset', sunset: 'overcast', dusk: 'morning', overcast: 'noon' };
const LATER = { morning: 'sunset', noon: 'dusk', sunset: 'morning', dusk: 'overcast', overcast: 'dusk' };

const round = (n, step = 50) => Math.round(n / step) * step;
const scale = (stars, k) => stars.map((s, i) => round(s * (k[i] ?? k[k.length - 1])));

/** Department-specific ways to make a course harder without changing its layout. */
const HARDER = {
  bay: (l, k) => ({ reveal: (l.reveal ?? 0.55) * (k > 1 ? 0.45 : 0.65) }),
  drop: (l, k) => ({ stars: scale(l.stars, k > 1 ? [1.2, 1.3, 1.4] : [1.1, 1.2, 1.25]) }),
  cart: (l, k) => ({ stars: scale(l.stars, k > 1 ? [1.2, 1.3, 1.4] : [1.1, 1.2, 1.25]) }),
  crash: (l, k) => ({ stars: scale(l.stars, k > 1 ? [1.2, 1.3, 1.4] : [1.1, 1.2, 1.25]) }),
  hop: (l, k) => ({ par: Math.round(l.par * (k > 1 ? 0.75 : 0.85)) }),
  alley: (l, k) => ({ target: Math.min(l.pins.length, (l.target ?? Math.ceil(l.pins.length * 0.6)) + k) }),
  golf: (l, k) => ({ arc: (l.arc ?? 1) * (k > 1 ? 0.4 : 0.6) }),
  swing: (l, k) => ({ par: Math.round(l.par * (k > 1 ? 0.75 : 0.85)), lives: Math.max(2, (l.lives ?? 3) - 1) }),
  pins: () => ({}),
};

const flipX = (p) => (p ? [-p[0], ...p.slice(1)] : p);

/** Mirrors whatever a build function asks the world (or level) to place. */
function flipArgs(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return a;
  const o = { ...a };
  for (const k of ['pos', 'from', 'to']) if (Array.isArray(o[k])) o[k] = flipX(o[k]);
  if (typeof o.yaw === 'number') o.yaw = -o.yaw;
  if (Array.isArray(o.rot)) o.rot = [o.rot[0], -(o.rot[1] ?? 0), -(o.rot[2] ?? 0)];
  if (typeof o.speed === 'number') o.speed = -o.speed;
  if (typeof o.move === 'function') {
    const move = o.move;
    o.move = (t) => flipX(move(t));
  }
  return o;
}

function mirrored(target) {
  return new Proxy(target, {
    get(t, k) {
      const v = t[k];
      return typeof v === 'function' ? (...args) => v.apply(t, args.map(flipArgs)) : v;
    },
  });
}

const flipBuild = (build) => build && ((w, L) => build(mirrored(w), L && mirrored(L)));

/** Layout flips for the departments whose courses read the same either way round. */
const MIRROR = {
  bay: (l) => ({ yaw: -(l.yaw ?? 0), cannon: flipX(l.cannon), build: flipBuild(l.build) }),
  alley: (l) => ({ pins: l.pins.map(flipX), build: flipBuild(l.build) }),
  golf: (l) => ({
    cup: flipX(l.cup),
    tee: flipX(l.tee),
    wind: flipX(l.wind),
    pads: l.pads.map((p) => ({ ...p, at: [-p.at[2], p.at[1], -p.at[0], p.at[3]] })),
    build: flipBuild(l.build),
  }),
  pins: (l) => {
    const pt = (o) => ({ ...o, x: -o.x });
    return {
      view: [-l.view[2], l.view[1], -l.view[0], l.view[3]],
      walls: l.walls.map(([x1, y1, x2, y2, t]) => (t === undefined ? [-x1, y1, -x2, y2] : [-x1, y1, -x2, y2, t])),
      pins: l.pins.map((p) => ({ from: flipX(p.from), to: flipX(p.to) })),
      dummy: flipX(l.dummy),
      goal: pt(l.goal),
      crates: l.crates?.map(pt),
      balls: l.balls?.map(pt),
      saws: l.saws?.map(pt),
      spikes: l.spikes?.map(pt),
      glass: l.glass?.map(pt),
    };
  },
};

/**
 * Two remixes per course: "After Hours" (different sky, tighter limits) and
 * either "Flipside" (mirrored) or "Overtime" (tighter still).
 */
export function remixes(deptId, levels) {
  const harder = HARDER[deptId];
  const mirror = MIRROR[deptId];
  const after = levels.map((l) => ({ ...l, ...harder(l, 1), name: `${l.name}: After Hours`, theme: SKY[l.theme] ?? l.theme }));
  const second = levels.map((l) =>
    mirror
      ? { ...l, ...mirror(l), name: `${l.name}: Flipside`, theme: LATER[l.theme] ?? l.theme }
      : { ...l, ...harder(l, 2), name: `${l.name}: Overtime`, theme: LATER[l.theme] ?? l.theme },
  );
  return [...after, ...second];
}
