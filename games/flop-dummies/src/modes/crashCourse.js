import * as THREE from 'three';
import { AttemptLevel } from './attemptLevel.js';
import { Car } from '../world/car.js';

const _v = new THREE.Vector3();
const KMH = 3.6;

/**
 * Crash Course: floor it down the runway and hit the barrier at just the
 * right speed. The car stops; the unbelted dummy goes through the windscreen.
 */
export class CrashCourseLevel extends AttemptLevel {
  setupRun() {
    const def = this.def;
    this.phase = 'ready';
    this.holding = false;
    this.settle = 0;
    this.runTime = 0;
    this.speed = 0;
    this.maxSpeed = def.maxSpeed ?? 30;
    this.accel = def.accel ?? 8.5;
    this.barrierZ = def.barrier ?? 40;
    this.flying = false;

    this.yard({ fences: true, extent: def.extent ?? 70 });
    this.buildRunway();
    def.build?.(this.world, this);

    this.car = new Car(this.world, { pos: [0, 0, 1.5], color: def.carColor ?? 0xeeeeea });
    this.z = 1.5;
    const seat = this.car.seat();
    this.dummy = this.spawnDummy({ position: [seat.x, seat.y, seat.z], pose: 'sit', muscle: 0.45 });
    this.car.buckle(this.dummy.ragdoll);

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'try', icon: 'dummy', value: `${this.attempt}/${this.attempts}` },
        { id: 'run', icon: 'bolt', value: 0 },
        { id: 'best', icon: 'star', value: this.bestLabel() },
      ],
    });
    this.hud.hint(this.attempt === 1 ? def.hint ?? 'Hold to hit the gas · let go to coast · hit the wall at the right speed' : `Attempt ${this.attempt} — beat ${this.bestRun.toLocaleString()}`);
    this.hud.meter('0 km/h', 0);
    this.cameraFor(new THREE.Vector3(0, 1, this.z), true);
  }

  buildRunway() {
    const w = this.world;
    const z1 = this.barrierZ;
    w.block({ pos: [0, 0.01, z1 / 2 - 2], size: [5, 0.02, z1 + 4], mat: 'asphalt', tile: 3, friction: 0.9 });
    for (let z = 2; z < z1 - 2; z += 4) w.paint({ pos: [0, 0.03, z], size: [0.15, 2], color: 0xf2f2ee, opacity: 0.85 });
    for (const s of [-1, 1]) w.paint({ pos: [s * 2.35, 0.03, z1 / 2 - 2], size: [0.12, z1 + 4], color: 0xf2b705, opacity: 0.9 });
    // Speed marks every 10 m so a player can learn their braking point.
    for (let z = 10; z < z1; z += 10) w.paint({ pos: [0, 0.03, z], size: [4.6, 0.3], color: 0xffffff, opacity: 0.5 });
    // Concrete crash barrier with an impact pad on the front.
    const h = this.def.barrierHeight ?? 0.8;
    w.block({ pos: [0, h / 2, z1 + 0.45], size: [6, h, 0.9], mat: 'concreteDark', tile: 1.5, kind: 'barrier' });
    w.block({ pos: [0, h / 2, z1 + 0.04], size: [5.6, h * 0.8, 0.08], mat: 'hazard', tile: 1 });
  }

  cameraFor(p, snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const off = portrait ? new THREE.Vector3(-3, 5, -9) : new THREE.Vector3(-8, 3.4, -4);
    const look = new THREE.Vector3(p.x, p.y + 0.5, p.z + (portrait ? 8 : 5));
    const pos = p.clone().add(off);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3.5, 5);
    this.stage.focusShadows(look, 20);
  }

  onPointerDown() {
    if (this.phase === 'ready') {
      this.phase = 'drive';
      this.hud.clearHint();
    }
    this.holding = true;
  }

  onPointerUp() {
    this.holding = false;
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.onPointerDown();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') this.onPointerUp();
  }

  fixedUpdate(dt) {
    if (this.phase !== 'drive') return;
    if (this.holding) this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    else this.speed = Math.max(0, this.speed - 2.2 * dt);
    this.z += this.speed * dt;
    if (this.z + 2.05 >= this.barrierZ) {
      this.crash();
      return;
    }
    this.car.place(this.z);
  }

  crash() {
    this.phase = 'fly';
    this.flying = true;
    this.holding = false;
    this.hud.hideMeter();
    const v = this.speed;
    this.car.release({ x: 0, y: 0, z: v });
    this.car.unbuckle();
    for (const name in this.dummy.parts) {
      const b = this.dummy.parts[name].body;
      const p = b.translation();
      b.setTranslation({ x: p.x, y: p.y + 0.5, z: p.z }, true);
      b.setLinvel({ x: 0, y: 2.6 + v * 0.17, z: v * 0.92 }, true);
    }
    this.dummy.ragdoll.addSpin(new THREE.Vector3(1, 0, 0).multiplyScalar(3 + v * 0.15));
    this.dummy.setPose('starfish');
    this.dummy.knockOut(4, 2);
    this.dummy.setMuscle(0.3);

    const at = new THREE.Vector3(0, 1, this.barrierZ - 0.2);
    this.audio.boom();
    this.audio.impact(1, 'metal');
    this.audio.impact(1, 'glass');
    this.rig.shake(0.7);
    this.rig.kick(8);
    this.fx.chips(at.clone().add(new THREE.Vector3(0, 0.4, 0)), { count: 40, colors: [0xbfe6ff, 0xe6f6ff, 0x9fc6d6], size: 0.06, speed: 7, floor: 0.02 });
    this.fx.puff(at, { count: 14, color: 0xcfc8bb, size: 1.2, speed: 2.5 });
    this.fx.text(at.clone().add(new THREE.Vector3(0, 1.6, 0)), `${Math.round(v * KMH)} KM/H`, { color: '#ffffff', size: 30 });
    this.slowmoT = 0.35;
  }

  checkProps() {
    for (const p of this.world.props) {
      if (p.knocked) continue;
      const t = p.body.translation();
      const r = p.body.rotation();
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y, t.z - p.start.z) > 0.6 || 1 - Math.abs(r.w) > 0.1) {
        p.knocked = true;
        if (!this.flying || this.phase === 'between') continue;
        const pts = p.kind === 'pin' ? 100 : 50;
        this.runScore += pts;
        this.hud.set('run', this.runScore.toLocaleString());
        this.fx.text(new THREE.Vector3(t.x, t.y + 0.6, t.z), `+${pts}`, { size: 16, life: 0.7 });
      }
    }
  }

  tick(dt) {
    if (this.slowmoT > 0) this.slowmoT -= dt / this.slowmo;
    this.slowmo = this.slowmoT > 0 ? 0.3 : 1;
    this.car.update(dt, this.phase === 'drive' ? this.speed : 0);
    if (this.time % 0.2 < dt) this.checkProps();

    if (this.phase === 'ready' || this.phase === 'drive') {
      const kmh = Math.round(this.speed * KMH);
      this.hud.meter(`${kmh} km/h`, this.speed / this.maxSpeed, this.holding && this.speed > this.maxSpeed * 0.9);
      this.audio.loop('rumble', Math.min(1, 0.15 + this.speed / this.maxSpeed), 'rumble');
      this.cameraFor(new THREE.Vector3(0, 1, this.car.body.translation().z));
      if (this.phase === 'drive' && this.speed === 0 && this.time > 20) this.finishRun(this.dummy.com());
      return;
    }

    if (this.phase === 'fly') {
      this.runTime += dt;
      this.audio.loop('rumble', 0, 'rumble');
      const com = this.dummy.com();
      this.cameraFor(com);
      this.audio.loop('wind', Math.min(1, this.dummy.velocity(_v).length() / 18), 'wind');
      this.trackAir(dt, com, true);
      const still = this.dummy.speed() < 0.4;
      this.settle = still && this.runTime > 0.8 ? this.settle + dt : 0;
      if (this.settle > 1.1 || this.runTime > 14 || com.y < -6) this.finishRun(com);
    }

    if (this.phase === 'between') this.tickBetween(dt);
  }

  finishRun(com) {
    this.audio.loop('rumble', 0, 'rumble');
    this.audio.loop('wind', 0, 'wind');
    this.runScore += this.landingBonus();
    this.runScore += this.zoneBonus(com);
    this.endRun();
  }
}
