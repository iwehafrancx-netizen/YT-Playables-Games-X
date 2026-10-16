// Wipeout: sweeper arms (low = tap hop, tall = held jump), clock length and
// how much the arms speed up over it.
export const WIPE = [
  { name: 'Spin Class', time: 15, arms: [{ kind: 'low', speed: 1.2 }], hint: 'Tap to hop the bar · stay on till the clock runs out' },
  { name: 'Double Trouble', time: 18, arms: [{ kind: 'low', speed: 1.3 }, { kind: 'low', speed: 1.3, phase: Math.PI }] },
  { name: 'Tall Order', time: 20, arms: [{ kind: 'tall', speed: 1.1 }], hint: 'Orange bars are tall · hold for a big jump' },
  { name: 'Crossfire', time: 20, arms: [{ kind: 'low', speed: 1.2 }, { kind: 'low', speed: 0.9, dir: -1, phase: 2 }] },
  { name: 'Rush Hour', time: 25, ramp: 0.8, arms: [{ kind: 'low', speed: 1.1 }, { kind: 'tall', speed: 1.1, phase: Math.PI }] },
  { name: 'The Gauntlet', time: 30, ramp: 0.7, arms: [{ kind: 'low', speed: 1.2 }, { kind: 'tall', speed: 0.8, dir: -1, phase: 1.5 }, { kind: 'low', speed: 1.2, phase: Math.PI }] },
];
