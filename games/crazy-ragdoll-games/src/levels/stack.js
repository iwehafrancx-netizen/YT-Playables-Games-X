// Stack Attack: podium size, goal height (from the ground), ragdolls to
// spend, crane speed, plus wind and turntables on the later ones.
export const STACK = [
  { name: 'First Floor', goal: 2.1, dummies: 5, base: [3, 1.8], speed: 0.9, hint: 'Tap to drop · each ragdoll sets solid where it lands · build up past the red line' },
  { name: 'Pile Up', goal: 2.1, dummies: 6, base: [2.8, 1.6], speed: 1.1 },
  { name: 'Narrow Podium', goal: 2, dummies: 6, base: [1.7, 1.4], speed: 1 },
  { name: 'Turntable', goal: 2, dummies: 6, base: [2.6, 1.6], speed: 1, turn: 0.5, baseMat: 'toyPurple', hint: 'The podium turns · time your drops' },
  { name: 'Breezy', goal: 2.2, dummies: 7, base: [2.6, 1.6], speed: 1.1, wind: 1.4, baseMat: 'toyGreen', hint: 'Wind blows them sideways · drop a little early' },
  { name: 'Skyscraper', goal: 2.5, dummies: 9, base: [3, 1.8], speed: 1.3, baseMat: 'toyOrange' },
  { name: 'Spin Cycle', goal: 2.1, dummies: 8, base: [2, 1.5], speed: 1.2, turn: 0.8, baseMat: 'toyPink' },
];
