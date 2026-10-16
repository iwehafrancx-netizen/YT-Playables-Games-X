// Bounce Up towers: trampoline pads (x, y, width, power), stars, and the flag
// height. `amp` makes a pad slide side to side.
export const BOUNCE = [
  { name: 'First Bounce', height: 11, time: 40, pads: [{ x: -2.5, y: 3.5 }, { x: 2.5, y: 6 }, { x: -1.5, y: 8.5 }], pickups: [{ x: 0, y: 7.5 }], hint: 'Hold left or right to steer · land on the next pad up' },
  { name: 'Zig Zag', height: 15, time: 45, pads: [{ x: -4, y: 3.5 }, { x: 0, y: 5.8 }, { x: 4, y: 8.1 }, { x: 0, y: 10.4 }, { x: -3.5, y: 12.7 }], pickups: [{ x: -2, y: 7 }, { x: 2, y: 11.5 }] },
  { name: 'Slim Pickings', height: 15, time: 45, pads: [{ x: 3, y: 3.5, w: 1.8 }, { x: -1, y: 6, w: 1.6 }, { x: 3, y: 8.5, w: 1.6 }, { x: -2.5, y: 11, w: 1.6 }, { x: 1.5, y: 13.2, w: 1.8 }], pickups: [{ x: 1, y: 10 }, { x: -3.5, y: 13.5 }] },
  { name: 'On the Move', height: 16, time: 50, pads: [{ x: -3, y: 3.5 }, { x: 0, y: 6, amp: 3, sp: 0.9 }, { x: 3.5, y: 8.5 }, { x: 0, y: 11, amp: 3, sp: 1.1, ph: 1 }, { x: -3.5, y: 13.5 }], pickups: [{ x: 0, y: 8.5 }, { x: 0, y: 13.5 }], hint: 'Purple pads slide — time your jump' },
  { name: 'Sky Ladder', height: 22, time: 60, pads: [{ x: -3, y: 3.5 }, { x: 2, y: 5.8 }, { x: -2, y: 8.1, w: 1.8 }, { x: 3.5, y: 10.4 }, { x: -1, y: 12.7, amp: 2.5, sp: 1 }, { x: 3, y: 15, w: 1.8 }, { x: -2.5, y: 17.3 }, { x: 1, y: 19.6, w: 1.8 }], pickups: [{ x: 0, y: 9.5 }, { x: -4, y: 14 }, { x: 4, y: 18 }] },
  { name: 'Moon Shot', height: 26, time: 70, pads: [{ x: 0, y: 3.5, amp: 3.5, sp: 1 }, { x: -3.5, y: 5.8, w: 1.8 }, { x: 0, y: 8.1, amp: 3, sp: 1.3 }, { x: 3.5, y: 10.4, w: 1.8 }, { x: 0, y: 12.7, amp: 4, sp: 1.1, ph: 1 }, { x: -3.5, y: 15, w: 1.6 }, { x: 0, y: 17.3, amp: 3, sp: 1.5 }, { x: 3.5, y: 19.6, w: 1.6 }, { x: 0, y: 21.9, amp: 3.5, sp: 1.2, ph: 2 }, { x: -2, y: 24.2 }], pickups: [{ x: 2, y: 7 }, { x: -2, y: 14 }, { x: 2, y: 21 }] },
];
