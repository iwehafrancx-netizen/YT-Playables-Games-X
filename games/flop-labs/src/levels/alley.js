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
    name: 'Pyramid Scheme',
    theme: 'sunset',
    hint: 'Fifteen pins. Throw hard.',
    pins: tri(5, 0, 18.2),
    throws: 2,
    target: 9,
    width: 3.6,
  },
];
