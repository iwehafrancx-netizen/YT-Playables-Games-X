// Sling Smash forts: pieces at x metres from the slingshot, `y` = what they
// stand on. A container's roof is at 2.6 m. `targets` are bullseyes on posts
// round the fort: [x, z (sideways), height, points].
const tower = (x, high, y = 0, tnt = true) => [
  ...Array.from({ length: high }, (_, i) => ({ t: 'crate', x, y: y + i })),
  ...(tnt ? [{ t: 'tnt', x, y: y + high }] : []),
];
const ROOF = 2.6;

export const SLING = [
  {
    name: 'Knock Knock', view: 14, targets: [[11, -2.6, 1.8, 300], [14, 2.4, 2.2, 500]],
    fort: [...tower(12, 3), { t: 'crate', x: 13.2 }, { t: 'box', x: 10.8 }],
    hint: 'Drag down to pull back · left or right to aim · let go to fire',
  },
  {
    name: 'Twin Towers', view: 17, targets: [[13.5, -2.8, 2, 300], [17, 2.6, 2.4, 500]],
    fort: [...tower(11, 3), ...tower(16, 4), { t: 'barrel', x: 13.5 }],
  },
  {
    name: 'Container Castle', view: 19, targets: [[12, 2.8, 1.8, 300], [18, -3, 3.8, 500]],
    fort: [{ t: 'container', x: 15 }, { t: 'crate', x: 13, y: ROOF }, { t: 'crate', x: 17, y: ROOF }, { t: 'crate', x: 13, y: ROOF + 1 }, { t: 'tnt', x: 15, y: ROOF }, ...tower(20.5, 1)],
    hint: 'TNT on a container roof: lob him up high',
  },
  {
    name: 'Plank Bridge', view: 19, targets: [[11, -2.6, 1.6, 300], [16, 2.8, 2.4, 500], [19.5, -2.4, 2, 300]],
    fort: [...tower(12, 2, 0, false), ...tower(15, 2, 0, false), { t: 'plank', x: 13.5, y: 2, len: 4.2 }, { t: 'tnt', x: 13.5, y: 2.1 }, { t: 'barrel', x: 17.2 }, { t: 'barrel', x: 17.8 }, { t: 'tnt', x: 19 }],
  },
  {
    name: 'Barrel Bunker', view: 22, targets: [[12, 2.8, 2, 300], [18, -3, 2.4, 500], [22, 3, 3.6, 500]],
    fort: [
      { t: 'barrel', x: 10 }, { t: 'barrel', x: 10.65 }, { t: 'barrel', x: 11.3 }, { t: 'barrel', x: 10.3, y: 0.9 }, { t: 'barrel', x: 11, y: 0.9 },
      ...tower(13.5, 2, 0, false), ...tower(16.5, 2, 0, false), { t: 'plank', x: 15, y: 2, len: 4.2 }, { t: 'tnt', x: 15, y: 2.1 },
      { t: 'container', x: 22, color: 'steelRed' }, { t: 'tnt', x: 21, y: ROOF }, { t: 'crate', x: 23, y: ROOF },
    ],
    shots: 4,
  },
  {
    name: 'Big Boom', view: 23, targets: [[13, -3, 2, 300], [19, 3, 3.8, 500], [23, -3, 2.6, 500]],
    fort: [
      ...tower(10.5, 2), { t: 'box', x: 9.6 }, { t: 'box', x: 11.4 },
      { t: 'container', x: 17, color: 'steelGreen' }, { t: 'tnt', x: 14.6, y: ROOF }, { t: 'crate', x: 15.8, y: ROOF }, { t: 'tnt', x: 17, y: ROOF }, { t: 'crate', x: 18.2, y: ROOF }, { t: 'tnt', x: 19.4, y: ROOF },
      ...tower(22.5, 3),
    ],
    shots: 4,
    hint: 'One blast sets off the next: line them up',
  },
];
