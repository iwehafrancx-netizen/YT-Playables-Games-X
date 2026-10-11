import * as THREE from 'three';
import { AttemptLevel } from './attemptLevel.js';
import { Cart } from '../world/cart.js';
import { Track, trackPose } from '../world/track.js';
import { landingTarget } from '../render/textures.js';

const _v = new THREE.Vector3();
const DOWN = { x: 0, y: -1, z: 0 };
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
    this.air = 0;
    this.airBest = 0;
    this.bailed = false;
    this.targets = [];

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
    this.cart.setGhost(true);
    this.solidAt = -1;

    this.hud = this.game.ui.hud({
      title: def.name,
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

  /** Painted landing target; where the dummy comes to rest decides the points. */
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

  cameraFor(p, snap = false) {
    const off = new THREE.Vector3(...(this.def.cam ?? [-7.5, 3.2, -2.5]));
    if (this.stage.width < this.stage.height) off.multiplyScalar(1.35);
    const look = new THREE.Vector3(p.x, p.y + 0.6, p.z + 3);
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
    this.solidAt = this.time + 0.6;
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
      if (strength > 0.45) this.eject(this.onTrack ? this.trackVelocity(new THREE.Vector3()) : this.dummy.velocity(new THREE.Vector3()), 1.5, 'CRASH!', false);
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

  /** Height of the dummy's middle above whatever is below it. */
  clearance(com) {
    const handles = this.dummy.ragdoll.handles;
    const hit = this.physics.castRay({ x: com.x, y: com.y, z: com.z }, DOWN, 30, (c) => !handles.has(c.handle) && this.physics.info(c.handle)?.kind !== 'cart');
    return hit ? hit.distance : 30;
  }

  tick(dt) {
    this.cart.update(dt);
    if (this.solidAt > 0 && this.time >= this.solidAt && this.cart.free) {
      this.solidAt = -1;
      this.cart.setGhost(false);
    }
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

      const h = this.clearance(com);
      if (this.bailed && h > 0.9) {
        this.air += dt;
      } else if (this.air > 0) {
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
    const pelvis = this.dummy.partPosition('pelvis');
    for (const t of this.targets) {
      const d = Math.hypot(pelvis.x - t.centre.x, pelvis.z - t.centre.z);
      if (Math.abs(pelvis.y - t.centre.y) > 1.2 || d > t.radius) continue;
      const pts = d < t.radius * 0.33 ? t.points[2] : d < t.radius * 0.66 ? t.points[1] : t.points[0];
      this.runScore += pts;
      const bull = pts === t.points[2];
      this.fx.text(pelvis.clone().add(new THREE.Vector3(0, 1.2, 0)), `${bull ? 'BULLSEYE!' : 'ON TARGET'} +${pts}`, { color: bull ? '#ff7a6b' : '#ffe066', size: bull ? 34 : 28, life: 1.6 });
      this.audio.ding(bull ? 4 : 2);
      if (bull) this.fx.confetti(pelvis, 80);
      break;
    }
    this.runScore += this.zoneBonus(com);
    this.endRun();
  }
}
