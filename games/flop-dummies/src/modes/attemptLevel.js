import * as THREE from 'three';
import { Level } from './level.js';
import { landingTarget } from '../render/textures.js';

const DOWN = { x: 0, y: -1, z: 0 };

/**
 * A level played as a few scored attempts; the best attempt counts.
 * The world is rebuilt from scratch between attempts.
 */
export class AttemptLevel extends Level {
  setup() {
    if (this.attempt === undefined) {
      this.attempt = 0;
      this.attempts = this.def.attempts ?? 3;
      this.bestRun = 0;
    }
    this.attempt++;
    this.runScore = 0;
    this.zones = [];
    this.targets = [];
    this.air = 0;
    this.airBest = 0;
    this.setupRun();
  }

  /** Bonus area: if the dummy comes to rest inside it, the run earns `points`. */
  zone({ pos, size, points, label, mesh = true }) {
    const z = { box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...pos), new THREE.Vector3(...size)), points, label };
    if (mesh) this.world.paint({ pos: [pos[0], pos[1] - size[1] / 2 + 0.02, pos[2]], size: [size[0], size[2]], color: 0x3fc79a, opacity: 0.35 });
    this.zones.push(z);
    return z;
  }

  zoneBonus(com) {
    for (const z of this.zones) {
      if (z.box.containsPoint(com)) {
        this.fx.text(com.clone().add(new THREE.Vector3(0, 1, 0)), `${z.label} +${z.points}`, { color: '#7dffb7', size: 32, life: 1.6 });
        this.audio.ding(3);
        this.fx.confetti(com, 60);
        return z.points;
      }
    }
    return 0;
  }

  /** Painted landing target; where the dummy's pelvis comes to rest decides the points. */
  landing({ pos, radius = 4, points = [200, 500, 1000] }) {
    const mat = new THREE.MeshStandardMaterial({ map: landingTarget(points), roughness: 0.8, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos[0], pos[1] + 0.012, pos[2]);
    m.receiveShadow = true;
    this.world.add(m);
    this.world.disposables.push(m.geometry, mat, mat.map);
    this.targets.push({ centre: new THREE.Vector3(...pos), radius, points });
  }

  landingBonus() {
    const pelvis = this.dummy.partPosition('pelvis');
    for (const t of this.targets) {
      const d = Math.hypot(pelvis.x - t.centre.x, pelvis.z - t.centre.z);
      if (Math.abs(pelvis.y - t.centre.y) > 1.2 || d > t.radius) continue;
      const pts = d < t.radius * 0.33 ? t.points[2] : d < t.radius * 0.66 ? t.points[1] : t.points[0];
      const bull = pts === t.points[2];
      this.fx.text(pelvis.clone().add(new THREE.Vector3(0, 1.2, 0)), `${bull ? 'BULLSEYE!' : 'ON TARGET'} +${pts}`, { color: bull ? '#ff7a6b' : '#ffe066', size: bull ? 34 : 28, life: 1.6 });
      this.audio.ding(bull ? 4 : 2);
      if (bull) this.fx.confetti(pelvis, 80);
      return pts;
    }
    return 0;
  }

  /** Height of the dummy's middle above whatever is below it (ignoring the dummy and its vehicle). */
  clearance(com) {
    const handles = this.dummy.ragdoll.handles;
    const hit = this.physics.castRay({ x: com.x, y: com.y, z: com.z }, DOWN, 30, (c) => !handles.has(c.handle) && this.physics.info(c.handle)?.kind !== 'cart');
    return hit ? hit.distance : 30;
  }

  /** Scores air time once the dummy is flying free; call every frame with `free` once it has left its vehicle. */
  trackAir(dt, com, free) {
    if (free && this.clearance(com) > 0.9) {
      this.air += dt;
      return;
    }
    if (this.air <= 0) return;
    if (this.air > 0.35) {
      const pts = Math.round(this.air * 250);
      this.runScore += pts;
      this.hud.set('run', this.runScore.toLocaleString());
      this.fx.text(com.clone().add(new THREE.Vector3(0, 1.2, 0)), `AIR ${this.air.toFixed(1)}s +${pts}`, { color: '#9fe8ff', size: 26 });
      this.audio.coin(2);
    }
    this.airBest = Math.max(this.airBest, this.air);
    this.air = 0;
  }

  bestLabel() {
    return `${this.bestRun.toLocaleString()} / ${this.def.stars[0].toLocaleString()}`;
  }

  starsFor(score) {
    const [a, b, c] = this.def.stars;
    return score >= c ? 3 : score >= b ? 2 : score >= a ? 1 : 0;
  }

  /** Call when a run is over; shows the run score and queues the next attempt or the result. */
  endRun() {
    this.phase = 'between';
    this.hud.set('run', this.runScore.toLocaleString());
    const improved = this.runScore > this.bestRun;
    this.bestRun = Math.max(this.bestRun, this.runScore);
    this.hud.set('best', this.bestLabel());
    if (improved) this.hud.bump('best');
    const last = this.attempt >= this.attempts;
    this.finishing = last || this.starsFor(this.bestRun) === 3;
    this.betweenT = this.finishing ? 1.4 : 2.2;
    this.game.ui.banner(this.runScore.toLocaleString(), improved && this.attempt > 1 ? 'New best run!' : 'Run score');
  }

  tickBetween(dt) {
    this.betweenT -= dt;
    if (this.betweenT > 0) return;
    if (!this.finishing) {
      this.rebuild();
      return;
    }
    const stars = this.starsFor(this.bestRun);
    this.finish({
      passed: stars > 0,
      stars,
      score: this.bestRun,
      reason: `Score ${this.def.stars[0].toLocaleString()} to pass this test.`,
      stats: [
        ['Best run', this.bestRun.toLocaleString()],
        ['Attempts used', `${this.attempt}/${this.attempts}`],
        ['Star targets', this.def.stars.map((s) => s.toLocaleString()).join(' · ')],
      ],
    });
  }

  /** One more attempt; the best run so far still counts. */
  revive() {
    this.attempts++;
    this.finishing = false;
    this.rebuild();
  }
}
