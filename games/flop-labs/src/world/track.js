import * as THREE from 'three';

const WIDTH = 3.2;

/** Height profile shapes for a track piece. */
function shape(kind, k) {
  if (kind === 'kick') return k * k;
  if (kind === 'ease') return k * k * (3 - 2 * k);
  return k;
}

/**
 * A cart track running along +Z at x = 0. Built from a start point and a list
 * of `[z, h, kind]` knots; it lays the decks, ramps, rails and trestles, and
 * answers height/slope queries for the cart that rides it.
 */
export class Track {
  constructor(world, { start, points, width = WIDTH }) {
    this.world = world;
    this.width = width;
    const knots = [[start[0], start[1]]];
    for (const [z, h, kind = 'line'] of points) {
      const [z0, h0] = knots[knots.length - 1];
      const n = kind === 'line' ? 1 : Math.max(3, Math.ceil((z - z0) / 1.2));
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        knots.push([z0 + (z - z0) * k, h0 + (h - h0) * shape(kind, k)]);
      }
    }
    this.knots = knots;
    this.startZ = start[0];
    this.endZ = knots[knots.length - 1][0];
    this.build();
  }

  height(z) {
    const K = this.knots;
    if (z <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) {
      if (z <= K[i][0]) {
        const [za, ha] = K[i - 1];
        const [zb, hb] = K[i];
        return ha + ((hb - ha) * (z - za)) / Math.max(1e-6, zb - za);
      }
    }
    return K[K.length - 1][1];
  }

  /** dh/dz, smoothed over a short window so the cart doesn't twitch on knots. */
  slope(z) {
    const d = 0.35;
    return (this.height(z + d) - this.height(z - d)) / (2 * d);
  }

  build() {
    const w = this.world;
    const W = this.width;
    const K = this.knots;
    for (let i = 0; i < K.length - 1; i++) {
      const [za, ha] = K[i];
      const [zb, hb] = K[i + 1];
      if (ha < 0.01 && hb < 0.01) continue;
      if (Math.abs(ha - hb) < 1e-3) {
        // Level deck: solid block down to the ground.
        w.block({ pos: [0, ha / 2, (za + zb) / 2], size: [W, ha, zb - za], mat: 'concreteDark', tile: 1.5 });
        continue;
      }
      w.ramp({ from: [0, ha, za], to: [0, hb, zb + 0.03], width: W, thick: 0.35, mat: 'asphalt', tile: 2, friction: 0.5 });
      const top = Math.min(ha, hb) - 0.35;
      if (i % 2 === 0 && top > 0.3) {
        const z = (za + zb) / 2;
        for (const sx of [-1, 1]) w.block({ pos: [sx * (W / 2 - 0.2), top / 2, z], size: [0.14, top, 0.14], mat: 'steelGrey', tile: 1 });
        w.block({ pos: [0, top - 0.07, z], size: [W - 0.2, 0.14, 0.14], mat: 'steelGrey', tile: 1 });
      }
    }
    // Guard rails the whole way, following the profile.
    for (let i = 0; i < K.length - 1; i++) {
      const [za, ha] = K[i];
      const [zb, hb] = K[i + 1];
      for (const sx of [-1, 1]) {
        w.ramp({ from: [sx * (W / 2 + 0.06), ha + 0.4, za], to: [sx * (W / 2 + 0.06), hb + 0.4, zb + 0.02], width: 0.12, thick: 0.4, mat: 'hazard', tile: 1, friction: 0.1 });
      }
    }
    // Painted start line on the top deck.
    w.paint({ pos: [0, K[0][1], this.startZ + 1.2], size: [W, 0.25], color: 0xffffff, opacity: 0.9 });
  }

  /** Padded stop block at the end of the run: the cart halts, the passenger doesn't. */
  bumper(z) {
    const w = this.world;
    const W = this.width;
    w.block({ pos: [0, 0.35, z + 0.25], size: [W + 0.4, 0.7, 0.5], mat: 'hazard', tile: 1, restitution: 0.1, kind: 'bumper' });
    w.block({ pos: [0, 0.35, z - 0.05], size: [W, 0.5, 0.1], mat: 'rubber', tile: 1 });
  }
}

export function trackPose(track, z, out = { pos: new THREE.Vector3(), rot: new THREE.Quaternion() }) {
  const h = track.height(z);
  const pitch = Math.atan(track.slope(z));
  out.pos.set(0, h, z);
  out.rot.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);
  return out;
}
