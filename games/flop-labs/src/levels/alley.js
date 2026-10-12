// Pin Alley. Lane runs along +Z from the foul line at z = 0; pin deck starts at `length`.

const SPACING = 0.88;
const ROW = SPACING * 0.866;

/** Classic triangle: `rows` rows, head pin at (cx, z0), opening away from the bowler. */
function tri(rows, cx, z0, y) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i <= r; i++) out.push([cx + (i - r / 2) * SPACING, z0 + r * ROW, y]);
  }
  return out;
}

export const ALLEY = [
  {
    name: 'Lucky Strike',
    theme: 'dusk',
    hint: 'Swipe up to bowl the dummy · swipe at an angle to steer',
    pins: tri(4, 0, 18.6),
    target: 6,
  },
  {
    name: 'Pillar Talk',
    theme: 'dusk',
    hint: 'A pillar guards the head pin. Go around it!',
    pins: tri(4, 0, 18.6),
    target: 6,
    build(w) {
      w.block({ pos: [0, 0.9, 10], size: [0.7, 1.3, 0.7], mat: 'hazard', tile: 1 });
    },
  },
  {
    name: 'Sweeper Lane',
    theme: 'morning',
    hint: 'Time your throw past the sweeper arm',
    pins: tri(4, 0, 18.6),
    target: 7,
    build(w) {
      // Hub sits beside the lane so the arm swings across it like a gate.
      w.spinner({ pos: [2.1, 0, 10], length: 6.4, height: 0.7, speed: 1.2, thick: 0.35 });
    },
  },
  {
    name: 'Jump Shot',
    theme: 'morning',
    hint: 'Hit the ramp hard enough to clear the pit',
    length: 19,
    pins: tri(4, 0, 18.6, 0.85),
    target: 6,
    build(w) {
      // Kicker ramp, a foam pit, then a raised pin deck.
      w.ramp({ from: [0, 0.25, 7.5], to: [0, 0.95, 10], width: 2.4, thick: 0.3, mat: 'hazard', tile: 1, friction: 0.05 });
      w.block({ pos: [0, 0.27, 11.25], size: [3, 0.04, 2.5], mat: 'foam', tile: 1 });
      w.block({ pos: [0, 0.55, 17.25], size: [3, 0.6, 9.5], mat: 'lane', tile: 0, friction: 0.04, slick: true });
    },
  },
  {
    name: 'Pyramid Scheme',
    theme: 'sunset',
    hint: 'Fifteen pins. Throw hard.',
    pins: tri(5, 0, 18.2),
    throws: 2,
    target: 9,
    width: 3.6,
  },
  {
    name: 'Twin Decks',
    theme: 'sunset',
    hint: 'Two racks, three balls',
    width: 4.4,
    pins: [...tri(3, -1.25, 19), ...tri(3, 1.25, 19)],
    throws: 3,
    target: 9,
    build(w) {
      w.block({ pos: [0, 0.55, 13.5], size: [0.25, 0.6, 9], mat: 'steelGrey', tile: 1 });
    },
  },
];
