import * as THREE from 'three';
import { Physics } from '../physics/physics.js';
import { World } from '../world/world.js';
import { Dummy } from '../dummy/dummy.js';

const _a = new THREE.Vector3();
const _corner = new THREE.Vector3();

/**
 * Base for everything drawn in the yard: owns the physics world, the props
 * and the ragdolls, and turns hard contacts into sounds and dust. A scene
 * implements `setup`, and optionally `fixedUpdate`, `tick` and input hooks.
 */
export class Scene {
  constructor(game, opts = {}) {
    this.game = game;
    this.opts = opts;
    this.stage = game.stage;
    this.audio = game.audio;
    this.fx = game.fx;
    this.rig = game.rig;
    this.time = 0;
    this.dummies = [];
    this.gravity = -11;
    this.slowmo = 1;
  }

  build() {
    this.physics = new Physics(this.gravity);
    this.ctx = { scene: this.stage.scene, physics: this.physics };
    this.world = new World(this.ctx);
    this.stage.setTheme(this.opts.theme ?? 'dusk');
    this.physics.onImpact = (a, b, f) => this.handleImpact(a, b, f);
    this.setup();
    this.physics.snapAll();
  }

  /**
   * Camera that fits the box `min`–`max` on screen, looking at its centre from
   * `pitch` degrees above straight-on.
   */
  frameBox(min, max, { pitch = 6, margin = 0.9, out = (this._view ??= { pos: new THREE.Vector3(), look: new THREE.Vector3() }) } = {}) {
    const cam = (this._frameCam ??= new THREE.PerspectiveCamera());
    cam.fov = this.stage.baseFov;
    cam.aspect = this.stage.width / this.stage.height;
    cam.updateProjectionMatrix();
    const look = out.look.copy(min).add(max).multiplyScalar(0.5);
    const p = THREE.MathUtils.degToRad(pitch);
    const dir = _a.set(0, Math.sin(p), Math.cos(p));
    const fits = (d) => {
      cam.position.copy(look).addScaledVector(dir, d);
      cam.lookAt(look);
      cam.updateMatrixWorld();
      for (let i = 0; i < 8; i++) {
        _corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).project(cam);
        if (_corner.z > 1 || Math.abs(_corner.x) > margin || Math.abs(_corner.y) > margin) return false;
      }
      return true;
    };
    let lo = 1;
    let hi = 150;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    out.pos.copy(look).addScaledVector(dir, hi);
    return out;
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

  handleImpact(h1, h2, force) {
    const a = this.physics.info(h1);
    const b = this.physics.info(h2);
    if (!a || !b) return;
    const strength = Math.min(1, Math.max(0, (force - 150) / 2600));
    if (strength <= 0.02) return;
    const body = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    const other = body === a ? b : a;
    let mat = other.material ?? 'concrete';
    if (body && (mat === 'concrete' || other.kind === 'dummy')) mat = 'body';
    const part = body && body.ragdoll.parts[body.part];
    if (part) {
      // Only real knocks make noise and dust; a body resting against
      // something produces a steady trickle of small contact forces.
      const v = part.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > 1.5 && this.time - (body.ragdoll.lastFx ?? -1) > 0.15) {
        body.ragdoll.lastFx = this.time;
        this.audio.impact(strength, mat);
        if (strength > 0.25) {
          const t = part.body.translation();
          this.fx.puff(_a.set(t.x, t.y, t.z), { count: 2 + Math.round(strength * 5), size: 0.35 + strength * 0.6, color: 0xd8d2c4 });
        }
      }
    } else {
      this.audio.impact(strength, mat);
    }
  }

  fixedUpdate() {}

  update(dt) {
    this.time += dt;
    for (const d of this.dummies) d.update(dt);
    this.world.update(dt);
    this.tick?.(dt);
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
