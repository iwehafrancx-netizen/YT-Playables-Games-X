import * as THREE from 'three';

// What each fruit does when an arrow goes through it.
export const FRUIT = {
  red: { color: 0xe23b35, label: '+30 health', weight: 4 },
  green: { color: 0x7ccf3a, label: '+50 stamina', weight: 4 },
  gold: { color: 0xffc81f, label: '+25 coins', weight: 2, flies: true },
};

const R = 0.32;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function pickKind(rand) {
  const total = Object.values(FRUIT).reduce((n, f) => n + f.weight, 0);
  let r = rand() * total;
  for (const [kind, f] of Object.entries(FRUIT)) if ((r -= f.weight) < 0) return kind;
  return 'red';
}

/**
 * Apples bobbing in the air over the yard. Shoot one to collect it: red
 * heals, green tops up stamina, and the golden one with wings is worth coins
 * but flies straight across, so it's gone if you're slow.
 */
export class Orchard {
  constructor(scene, { area, rand = Math.random }) {
    this.scene = scene;
    this.area = area; // { x0, x1, y0, y1 }
    this.rand = rand;
    this.items = [];
    this.wait = 4;
    const w = scene.world;
    this.geo = {
      apple: new THREE.SphereGeometry(R, 20, 14).scale(1, 0.92, 1),
      stem: new THREE.CylinderGeometry(0.02, 0.025, 0.12, 6).translate(0, R + 0.03, 0),
      leaf: new THREE.SphereGeometry(0.08, 8, 6).scale(1, 0.35, 0.55).translate(0.08, R + 0.06, 0),
      wing: new THREE.PlaneGeometry(0.42, 0.24).translate(0.24, 0, 0),
      halo: new THREE.TorusGeometry(0.2, 0.025, 6, 24).rotateX(Math.PI / 2).translate(0, R + 0.16, 0),
    };
    this.mats = Object.fromEntries(Object.entries(FRUIT).map(([k, f]) => [k, new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.35, emissive: k === 'gold' ? 0x664400 : 0 })]));
    this.leafMat = new THREE.MeshStandardMaterial({ color: 0x3e8f2e, roughness: 0.6 });
    this.stemMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.8 });
    this.wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });
    w.disposables.push(...Object.values(this.geo), ...Object.values(this.mats), this.leafMat, this.stemMat, this.wingMat);
  }

  spawn() {
    const kind = pickKind(this.rand);
    const f = FRUIT[kind];
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.geo.apple, this.mats[kind]), new THREE.Mesh(this.geo.stem, this.stemMat), new THREE.Mesh(this.geo.leaf, this.leafMat));
    const wings = [];
    if (f.flies) {
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(this.geo.wing, this.wingMat);
        wing.scale.x = s;
        wing.position.x = s * 0.18;
        g.add(wing);
        wings.push(wing);
      }
      g.add(new THREE.Mesh(this.geo.halo, this.mats.gold));
    }
    g.traverse((m) => (m.castShadow = true));
    const { x0, x1, y0, y1 } = this.area;
    const pos = f.flies ? new THREE.Vector3(x1 + 2, y0 + (y1 - y0) * (0.4 + this.rand() * 0.6), 0) : new THREE.Vector3(x0 + (x1 - x0) * this.rand(), y0 + (y1 - y0) * this.rand(), 0);
    g.position.copy(pos);
    g.scale.setScalar(0.01);
    this.scene.world.add(g);
    this.items.push({ kind, g, wings, base: pos.clone(), t: 0, phase: this.rand() * 6, life: f.flies ? 9 : 14, grow: 0 });
  }

  /** Does the arrow path `from`→`to` go through a fruit? Collects it and returns its kind. */
  pierce(from, to) {
    for (const it of this.items) {
      if (it.gone) continue;
      // Closest point on the segment to the fruit's centre.
      const seg = _a.subVectors(to, from);
      const len2 = seg.lengthSq();
      const k = len2 > 0 ? Math.max(0, Math.min(1, _b.subVectors(it.g.position, from).dot(seg) / len2)) : 0;
      const close = _b.copy(from).addScaledVector(seg, k);
      if (close.distanceTo(it.g.position) < R + 0.12) {
        it.gone = true;
        it.g.removeFromParent();
        return { kind: it.kind, at: it.g.position.clone() };
      }
    }
    return null;
  }

  update(dt, active) {
    if (active) {
      this.wait -= dt;
      if (this.wait <= 0 && this.items.filter((i) => !i.gone).length < 2) {
        this.spawn();
        this.wait = 6 + this.rand() * 5;
      }
    }
    for (const it of this.items) {
      if (it.gone) continue;
      it.t += dt;
      it.grow = Math.min(1, it.grow + dt * 3);
      it.g.scale.setScalar(it.grow * (it.life < 1 ? Math.max(0.01, it.life) : 1));
      if (FRUIT[it.kind].flies) {
        it.g.position.set(it.base.x - it.t * 2.4, it.base.y + Math.sin(it.t * 3 + it.phase) * 0.5, 0);
        for (const [i, w] of it.wings.entries()) w.rotation.y = (i ? -1 : 1) * Math.sin(it.t * 18) * 0.7;
      } else {
        it.g.position.y = it.base.y + Math.sin(it.t * 1.6 + it.phase) * 0.25;
      }
      it.g.rotation.y = Math.sin(it.t * 0.9 + it.phase) * 0.5;
      it.life -= dt;
      if (it.life <= 0 || it.g.position.x < this.area.x0 - 3) {
        it.gone = true;
        it.g.removeFromParent();
      }
    }
    this.items = this.items.filter((i) => !i.gone);
  }
}
