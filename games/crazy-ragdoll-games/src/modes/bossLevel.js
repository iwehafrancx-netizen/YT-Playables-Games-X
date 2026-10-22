import * as THREE from 'three';
import { Level } from './level.js';
import { buildRobot } from '../world/robot.js';

const _a = new THREE.Vector3();

/**
 * Shared shape of every boss fight: a giant robot with a health bar that
 * the ragdoll has to knock out before a resource (shots, rolls, tries, time
 * or hearts) runs out. Each fight supplies its own way of landing a hit.
 */
export class BossLevel extends Level {
  hudTitle() {
    return `Boss · ${this.def.name}`;
  }

  /** Builds the robot and the boss HUD; `stats` are the fight's own counters. */
  bossSetup(robot, stats, build = buildRobot) {
    this.hp = this.def.hp;
    this.phase = 'fight';
    this.robot = build(this.world, { paint: this.def.paint, trim: this.def.trim, core: this.def.core, ...robot });
    this.hud = this.game.ui.hud({ title: this.hudTitle(), stats });
    this.hud.meter(this.def.name, 1);
    this.hud.hint(this.def.hint);
  }

  /** A landed blow: knock a bar off the health meter, and finish it on the last one. */
  hit(at, label = 'HIT!') {
    if (this.phase !== 'fight') return;
    this.hp--;
    this.robot.hurt();
    this.hud.meter(this.def.name, this.hp / this.def.hp, this.hp <= 1);
    this.fx.chips(at, { count: 30, colors: [0xffc93c, 0xff5a4e, 0xffffff], size: 0.1, speed: 7, life: 1 });
    this.fx.puff(at, { count: 10, size: 1.2, speed: 3, color: 0xffd9a0, up: 1.2 });
    this.fx.text(_a.copy(at).add(new THREE.Vector3(0, 1.4, 0)), label, { color: '#ffc93c', size: 40, life: 1.1 });
    this.audio.boom();
    this.audio.crack?.();
    this.rig.shake(0.7);
    this.slowmoT = 0.35;
    if (this.hp <= 0) this.defeat(at);
  }

  defeat(at) {
    this.phase = 'end';
    this.passed = true;
    this.endT = 2.4;
    this.robot.topple();
    this.audio.win();
    this.fx.confetti(_a.copy(at).add(new THREE.Vector3(0, 2, 0)), 180);
    this.game.ui.banner('BOSS DOWN!', this.def.name);
  }

  lose(reason) {
    if (this.phase !== 'fight') return;
    this.phase = 'end';
    this.passed = false;
    this.endT = 1.2;
    this.loseReason = reason;
    this.audio.lose();
  }

  /** Call from `tick`: handles the slow-motion on hits and the end of the fight. */
  bossTick(dt, walking = 0) {
    this.robot.tick(dt, this.time, walking);
    if (this.slowmoT > 0) this.slowmoT -= dt / this.slowmo;
    this.slowmo = this.slowmoT > 0 ? 0.35 : 1;
    if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  /** Resource left over (0–1) decides the stars on a win. */
  complete(left = this.spare?.() ?? 0, stats = []) {
    this.phase = 'done';
    const stars = !this.passed ? 0 : left >= 0.5 ? 3 : left >= 0.2 ? 2 : 1;
    this.finish({
      passed: this.passed,
      stars,
      score: this.passed ? 3000 + Math.round(left * 3000) : (this.def.hp - this.hp) * 400,
      reason: this.loseReason ?? 'Knock the boss out before you run out.',
      stats: [['Boss health', `${Math.max(0, this.hp)}/${this.def.hp}`], ...(this.bossStats?.() ?? stats)],
    });
  }
}
