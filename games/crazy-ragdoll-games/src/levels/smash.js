// Smash Yard pens, side on: x across (±6), y up (0–8). `hp` is how much
// punishment he takes before he breaks apart, `time` how long you get.
export const SMASH = [
  {
    name: 'Crate Crusher', hp: 80, time: 40, goal: 'Fling him into the crates!',
    items: [{ t: 'crates', x: -4, n: 3 }, { t: 'crates', x: 4, n: 3, metal: true }, { t: 'crates', x: 0.5, n: 2 }],
  },
  {
    name: 'Spike Pit', hp: 100, time: 40, goal: 'Slam him down on the spikes!', start: -3,
    items: [{ t: 'spikes', x: 1.5, w: 5 }, { t: 'spikes', side: 'right', y: 4.5, w: 3 }, { t: 'crates', x: -4.5, n: 2 }],
  },
  {
    name: 'Container Slam', hp: 110, time: 40, goal: 'Smash him into the steel containers!', start: -4.5,
    items: [{ t: 'container', x: 1.5 }, { t: 'container', x: 2.2, y: 2.6, color: 'steelRed' }, { t: 'barrels', x: -2, n: 2 }],
  },
  {
    name: 'Saw Mill', hp: 120, time: 40, goal: 'Feed him to the spinning saws!',
    items: [{ t: 'saw', x: -3.2, y: 3.5, amp: 1.6 }, { t: 'saw', x: 3.2, y: 2.2, r: 1 }, { t: 'spikes', side: 'roof', x: 0, w: 4 }],
  },
  {
    name: 'Shooting Gallery', hp: 120, time: 40, goal: 'Drag him into the line of fire!',
    items: [{ t: 'gun', side: 1, y: 5.5, rate: 1.1 }, { t: 'gun', side: -1, y: 3, rate: 1.6 }, { t: 'crates', x: 0, n: 2, metal: true }],
  },
  {
    name: 'The Crusher', hp: 130, time: 45, goal: 'Hold him under the crusher!',
    items: [{ t: 'press', x: 0, w: 2.6 }, { t: 'spikes', x: 0, w: 2.6 }, { t: 'spikes', side: 'left', y: 3.5, w: 3 }, { t: 'crates', x: 4.3, n: 2 }],
    start: 3.5,
  },
  {
    name: 'TNT Party', hp: 140, time: 45, goal: 'Throw him at the TNT and blow him up!',
    items: [{ t: 'tnt', x: -4.5 }, { t: 'tnt', x: 4.5 }, { t: 'crates', x: -1.5, n: 2 }, { t: 'tnt', x: -1.5, y: 1.8 }, { t: 'tnt', x: 2 }, { t: 'barrels', x: 2.8, n: 2 }],
  },
  {
    name: 'Wrecking Ball', hp: 150, time: 45, goal: 'Put him in the way of the wrecking ball!',
    items: [{ t: 'ball', x: 0, len: 5.5, swing: 0.95, speed: 1.4 }, { t: 'spikes', side: 'left', y: 3, w: 3.5 }, { t: 'spikes', side: 'right', y: 3, w: 3.5 }],
  },
  {
    name: 'Everything Yard', hp: 200, time: 50, goal: 'Use everything in the yard to smash him!',
    items: [
      { t: 'gun', side: 1, y: 6, rate: 1.5 }, { t: 'saw', x: -3.5, y: 4.5, amp: 1.2, axis: 'x' }, { t: 'press', x: 2.5, w: 2 },
      { t: 'spikes', x: 2.5, w: 2.2 }, { t: 'tnt', x: -4.6 }, { t: 'crates', x: -1, n: 2 },
    ],
  },
];
