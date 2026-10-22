import * as THREE from 'three';
import { Physics } from '../physics/physics.js';
import { World } from '../world/world.js';
import { cargoYard, clutter } from '../world/cargoYard.js';
import { Dummy } from '../dummy/dummy.js';

const _a = new THREE.Vector3();

/**
 * Base class for every playable level: owns the physics world, the props and
 * dummies, routes collisions to sounds/effects, and reports the result.
 * Department modes extend this and implement `setup`, `tick` and input hooks.
 */
export class Level {
  constructor(game, def, dept) {
    this.game = game;
    this.def = def;
    this.dept = dept;
    this.stage = game.stage;
    this.audio = game.audio;
    this.fx = game.fx;
    this.rig = game.rig;
    this.hud = null;
    this.time = 0;
    this.state = 'play';
    this.dummies = [];
    this.score = 0;
    this.gravity = -11;
    this.slowmo = 1;
  }

  build() {
    this.physics = new Physics(this.gravity);
    this.ctx = { scene: this.stage.scene, physics: this.physics };
    this.world = new World(this.ctx);
    this.stage.setTheme(this.def.theme ?? this.dept.theme);
    this.physics.onImpact = (a, b, f) => this.handleImpact(a, b, f);
    this.physics.onContact = (a, b, started) => this.handleContact(a, b, started);
    this.setup();
    this.physics.snapAll();
  }

  /** The set every game is played on: the shipping yard (see world/cargoYard.js). */
  scenery(opts) {
    cargoYard(this.world, opts);
  }

  /** Crates, barrels and boxes for him to crash into, at these [x, z] spots. */
  clutter(spots, y = 0) {
    clutter(this.world, spots, y);
  }

  /** HUD heading: the running level number, never the course name or how many are left. */
  hudTitle() {
    return this.game.current ? `Level ${this.game.current.n}` : this.def.name;
  }

  spawnDummy(opts = {}) {
    const d = new Dummy(this.ctx, { suit: this.game.save.data.suit, ...opts });
    this.dummies.push(d);
    return d;
  }

  removeDummy(d) {
    d.dispose();
    this.dummies = this.dummies.filter((x) => x !== d);
  }

  dummyFor(info) {
    return info?.ragdoll ? this.dummies.find((d) => d.ragdoll === info.ragdoll) : null;
  }

  handleImpact(h1, h2, force) {
    const a = this.physics.info(h1);
    const b = this.physics.info(h2);
    if (!a || !b) return;
    const strength = Math.min(1, Math.max(0, (force - 150) / 2600));
    if (strength <= 0.02) return;
    const body = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    const other = body === a ? b : a;
    // A passenger jostling in its own cart is not an impact worth dust and noise.
    if (body && other.kind === 'cart' && strength < 0.6) return;
    let mat = other.material ?? 'concrete';
    if (body && (mat === 'concrete' || other.kind === 'dummy')) mat = 'body';

    const part = body && body.ragdoll.parts[body.part];
    if (part) {
      // Dust, noise and shake belong to real hits. A dummy being pushed along
      // by something (a moving target, a sweeper) produces a steady stream of
      // contact forces at low speed; rate-limit it per dummy and require speed.
      const v = part.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const fxReady = this.time - (body.ragdoll.lastFx ?? -1) > 0.15;
      if (speed > 1.5 && fxReady) {
        body.ragdoll.lastFx = this.time;
        this.audio.impact(strength, mat);
        if (strength > 0.25) {
          const t = part.body.translation();
          _a.set(t.x, t.y, t.z);
          this.fx.puff(_a, { count: 2 + Math.round(strength * 5), size: 0.35 + strength * 0.6, color: 0xd8d2c4 });
          if (strength > 0.55 && speed > 4) this.rig.shake(strength * 0.25);
        }
      }
    } else {
      this.audio.impact(strength, mat);
    }
    this.onImpact?.(a, b, force, strength);
  }

  handleContact(h1, h2, started) {
    if (!started) return;
    const a = this.physics.info(h1);
    const b = this.physics.info(h2);
    if (!a || !b) return;
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.kind === 'spring' && y.kind === 'dummy') this.bounce(x.spring, y);
      if (x.kind === 'target' && (y.kind === 'dummy' || y.kind === 'prop')) this.onTargetHit?.(x.target, y);
    }
    this.onContact?.(a, b);
  }

  bounce(spring, info) {
    const d = this.dummyFor(info);
    if (!d || (d.lastBounce && this.time - d.lastBounce < 0.35)) return;
    d.lastBounce = this.time;
    const v = d.velocity(_a);
    d.ragdoll.addVelocity({ x: v.x * 0.15, y: spring.power - Math.min(0, v.y) * 0.25, z: v.z * 0.15 }, 0.6);
    spring.squash = 1;
    this.audio.spring();
    this.fx.puff(d.com(), { count: 5, color: 0xffffff, size: 0.5 });
  }

  fixedUpdate() {}

  update(dt) {
    this.time += dt;
    for (const d of this.dummies) d.update(dt);
    this.world.update(dt);
    this.tick?.(dt);
  }

  /** Whether a failed run can pick up where it left off (see `revive`). */
  canRevive() {
    return this.revive !== Level.prototype.revive;
  }

  /** Puts a failed level back into play where it left off. Modes that support it override this. */
  revive() {}

  /** Tears the world down and builds the level again from its definition. */
  rebuild() {
    for (const d of this.dummies) d.view.dispose();
    this.dummies.length = 0;
    this.world.dispose();
    this.physics.dispose();
    this.audio.stopLoops();
    this.fx.clear();
    this.build();
  }

  /** Ends the level and hands the result to the game. */
  finish(result) {
    if (this.state === 'done') return;
    this.state = 'done';
    this.game.levelFinished(this, result);
  }

  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}
  onKeyDown() {}
  onKeyUp() {}

  dispose() {
    for (const d of this.dummies) d.view.dispose();
    this.dummies.length = 0;
    this.world.dispose();
    this.physics.dispose();
    this.audio.stopLoops();
  }
}
