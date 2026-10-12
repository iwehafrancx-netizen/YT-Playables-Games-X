import * as THREE from 'three';
import { AttemptLevel } from './attemptLevel.js';
import { Cart } from '../world/cart.js';
import { Track, trackPose } from '../world/track.js';

const _v = new THREE.Vector3();
const ROLLING = 0.25; // m/s² of rolling resistance

/**
 * Cart Hill: wind up, send the dummy down the ramp in a shopping cart and
 * bail at the right moment to land on the target. Air time pays extra.
 */
export class CartHillLevel extends AttemptLevel {
  setupRun() {
    const def = this.def;
    this.phase = 'ready';
    this.power = 0;
    this.charging = false;
    this.chargeT = 0;
    this.settle = 0;
    this.runTime = 0;
    this.bailed = false;

    this.yard({ mat: def.ground ?? 'concrete', fences: def.fences ?? true, extent: def.extent ?? 40 });
    this.track = new Track(this.world, def.path);
    if (def.path.end === 'bumper') this.track.bumper(this.track.endZ + 1.1);
    def.build?.(this.world, this);

    // The cart's own coordinates start at the bottom of its wheels.
    this.z = this.track.startZ + 2.2;
    this.speed = 0;
    this.onTrack = true;
    const start = trackPose(this.track, this.z);
    this.cart = new Cart(this.world, { pos: start.pos.toArray(), yaw: 0 });
    const seat = this.cart.seat();
    this.dummy = this.spawnDummy({ position: [seat.x, seat.y, seat.z], pose: 'cart', muscle: 0.45 });
    this.cart.buckle(this.dummy.ragdoll);
    // Cart and passenger never collide: they overlap at launch, and pushing
    // apart two interpenetrating bodies is what made the landings shake.
    this.cart.setGhost(true);

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'try', icon: 'dummy', value: `${this.attempt}/${this.attempts}` },
        { id: 'run', icon: 'bolt', value: 0 },
        { id: 'best', icon: 'star', value: this.bestLabel() },
      ],
    });
    this.hud.hint(this.attempt === 1 ? def.hint ?? 'Hold to wind up · release to push · tap again to BAIL' : `Attempt ${this.attempt} — beat ${this.bestRun.toLocaleString()}`);
    this.hud.meter('Push', 0);
    this.cameraFor(start.pos, true);
  }

  cameraFor(p, snap = false) {
    const portrait = this.stage.width < this.stage.height;
    // Landscape watches from the side; portrait chases from behind so the track ahead stays in frame.
    const off = portrait ? new THREE.Vector3(-2.2, 4.6, -7.5) : new THREE.Vector3(...(this.def.cam ?? [-7.5, 3.2, -2.5]));
    const look = new THREE.Vector3(p.x, p.y + 0.6, p.z + (portrait ? 6 : 3));
    const pos = new THREE.Vector3(p.x, p.y, p.z).add(off);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3.5, 6);
    this.stage.focusShadows(look, 18);
  }

  onPointerDown() {
    if (this.phase === 'ready') {
      this.charging = true;
      this.chargeT = 0;
      this.hud.clearHint();
    } else if (this.phase === 'ride') {
      this.bail();
    }
  }

  onPointerUp() {
    if (this.phase === 'ready' && this.charging) this.launch();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter') this.onPointerDown();
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'Enter') this.onPointerUp();
  }

  launch() {
    this.charging = false;
    this.phase = 'ride';
    this.hud.hideMeter();
    this.hud.clearHint();
    this.speed = 2.5 + this.power * (this.def.maxPush ?? 6);
    this.audio.whoosh(0.8);
    this.audio.impact(0.4, 'metal');
    this.hud.button('BAIL!', () => this.bail());
  }

  /** Velocity of the cart along the track right now. */
  trackVelocity(out = new THREE.Vector3()) {
    const s = this.track.slope(this.z);
    const c = 1 / Math.sqrt(1 + s * s);
    return out.set(0, this.speed * s * c, this.speed * c);
  }

  fixedUpdate(dt) {
    if (!this.onTrack || !this.cart) return;
    const pose = trackPose(this.track, this.z);
    if (this.phase === 'ride') {
      const s = this.track.slope(this.z);
      const sin = s / Math.sqrt(1 + s * s);
      const cos = 1 / Math.sqrt(1 + s * s);
      this.speed += (this.gravity * sin - ROLLING) * dt;
      this.speed = Math.max(this.speed, 0.3);
      this.z += this.speed * cos * dt;
      if (this.z >= this.track.endZ) {
        this.leaveTrack();
        return;
      }
      trackPose(this.track, this.z, pose);
    }
    this.cart.place(pose.pos, pose.rot);
  }

  /** End of the rails: the cart is on its own now, and so is the passenger. */
  leaveTrack() {
    this.onTrack = false;
    const v = this.trackVelocity(new THREE.Vector3());
    this.cart.release({ x: v.x, y: v.y, z: v.z });
    this.hud.clearButtons();
    if (this.bailed) return;
    if (this.def.path.end === 'bumper') this.eject(v, 4.5, 'LAUNCH!', true);
    else this.eject(v, 1, 'AIRBORNE!', false);
  }

  bail() {
    if (this.bailed || this.phase !== 'ride') return;
    const v = this.onTrack ? this.trackVelocity(new THREE.Vector3()) : this.dummy.velocity(new THREE.Vector3());
    this.eject(v, this.def.bailKick ?? 5.5, 'BAIL!', false);
    this.audio.jump(true);
  }

  eject(v, kick, label, lift) {
    this.bailed = true;
    this.cart.unbuckle();
    this.hud.clearButtons();
    for (const name in this.dummy.parts) {
      const b = this.dummy.parts[name].body;
      if (lift) {
        const p = b.translation();
        b.setTranslation({ x: p.x, y: p.y + 0.3, z: p.z }, true);
      }
      b.setLinvel({ x: v.x, y: Math.max(v.y, 0) + kick, z: v.z }, true);
    }
    this.dummy.ragdoll.addSpin(new THREE.Vector3(1, 0, 0).multiplyScalar(2 + Math.random() * 4));
    this.dummy.setPose('starfish');
    this.dummy.setMuscle(0.3);
    this.audio.whoosh(1.2);
    this.rig.shake(lift ? 0.5 : 0.2);
    this.fx.text(this.dummy.com().add(new THREE.Vector3(0, 1.2, 0)), label, { color: '#ffe066', size: 32 });
  }

  onImpact(a, b, force, strength) {
    if (this.phase !== 'ride') return;
    const info = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!info) return;
    const other = info === a ? b : a;
    if (other.kind === 'cart') return;
    if (!this.bailed) {
      // Strapped in and something solid hit him: the belt gives way.
      if (strength > 0.7) this.eject(this.onTrack ? this.trackVelocity(new THREE.Vector3()) : this.dummy.velocity(new THREE.Vector3()), 1.5, 'CRASH!', false);
      return;
    }
    if (strength > 0.3 && this.dummy.knockout <= 0) this.dummy.knockOut(3, 2);
  }

  checkProps() {
    for (const p of this.world.props) {
      if (p.knocked) continue;
      const t = p.body.translation();
      if (Math.hypot(t.x - p.start.x, t.y - p.start.y, t.z - p.start.z) > 0.6) {
        p.knocked = true;
        if (this.phase !== 'ride') continue;
        this.runScore += 50;
        this.hud.set('run', this.runScore.toLocaleString());
        this.fx.text(new THREE.Vector3(t.x, t.y + 0.5, t.z), '+50', { size: 16, life: 0.7 });
      }
    }
  }

  tick(dt) {
    this.cart.update(dt);
    if (this.time % 0.2 < dt) this.checkProps();

    if (this.phase === 'ready') {
      if (this.charging) {
        this.chargeT += dt;
        // Ping-pong so holding too long costs power.
        const k = (this.chargeT / 1.1) % 2;
        this.power = k < 1 ? k : 2 - k;
        this.hud.meter('Push', this.power, this.power > 0.9);
      }
      this.cameraFor(this.cart.body.translation());
      return;
    }

    if (this.phase === 'ride') {
      this.runTime += dt;
      const com = this.dummy.com();
      this.cameraFor(com);
      this.audio.loop('rumble', this.onTrack ? Math.min(1, this.speed / 11) : 0, 'rumble');
      this.audio.loop('wind', Math.min(1, this.dummy.velocity(_v).length() / 16), 'wind');

      this.trackAir(dt, com, this.bailed);

      const still = this.bailed && this.dummy.speed() < 0.4;
      this.settle = still ? this.settle + dt : 0;
      if (this.settle > 1.1 || this.runTime > (this.def.maxTime ?? 16) || com.y < -6) this.finishRun(com);
    }

    if (this.phase === 'between') this.tickBetween(dt);
  }

  finishRun(com) {
    this.audio.loop('rumble', 0, 'rumble');
    this.audio.loop('wind', 0, 'wind');
    this.hud.clearButtons();
    this.runScore += this.landingBonus();
    this.runScore += this.zoneBonus(com);
    this.endRun();
  }
}
