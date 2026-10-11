import * as THREE from 'three';
import { Level } from './level.js';

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

  rebuild() {
    for (const d of this.dummies) d.view.dispose();
    this.dummies.length = 0;
    this.world.dispose();
    this.physics.dispose();
    this.audio.stopLoops();
    this.fx.clear();
    this.build();
  }
}
