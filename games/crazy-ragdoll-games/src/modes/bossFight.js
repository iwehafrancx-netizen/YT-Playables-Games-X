import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const ARENA_R = 9;
const BOSS_R = 1.35;
const PYLON_RING = 5.4;
const PYLON_R = 0.45;
const HEARTS = 3;
const WALK = 4.2; // m/s
const DIVE = 9.5; // m/s
const HOP_H = 2.4;
const HOP_T = 0.75;
const WAVE_SPEED = 11; // shockwave ring growth, m/s
const DOWN = { x: 0, y: -1, z: 0 };
const UP = new THREE.Vector3(0, 1, 0);
const RED = new THREE.Color(0xff2a1a);
const DIM = new THREE.Color(0x3a3d42);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Boss fight: a sumo ring on top of a tower and a robot that wants you off
 * it. The player walks a dummy around and dives; the boss turns, revs and
 * charges in a straight line. Charging into a pylon stuns it, and a dive
 * into a stunned boss is the only thing that hurts it.
 */
export class BossFightLevel extends Level {
  setup() {
    const def = this.def;
    this.hp = def.hp;
    this.hearts = HEARTS;
    this.clock = 0;
    this.phase = 'fight';
    this.pstate = 'ok';
    this.invulnT = 0;
    this.slowmoT = 0;
    this.slowAmount = 1;
    this.lastStep = 0;
    this.stick = null;
    this.touch = null;
    this.wave = null;
    this.debris = [];
    this.move = new THREE.Vector3();

    this.arena();
    this.pylons = this.makePylons();
    this.scatterProps();
    this.makeBoss();
    this.spawnPlayer([0, 0.05, 4.2]);

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'hearts', icon: 'heart', value: this.hearts },
        { id: 'time', icon: 'clock', value: 0 },
      ],
    });
    this.hud.meter(def.name, 1);
    this.hud.hint(def.hint ?? 'Drag to walk · tap to dive · lure it into a pylon, then dive into it!');
    this.cameraFor(true);
  }

  hudTitle() {
    return `Boss · Mk ${this.def.mk}`;
  }

  // ---------- set dressing ----------

  arena() {
    const w = this.world;
    this.scenery({ y: -32, extent: 30 });
    const top = w.mesh(new THREE.CylinderGeometry(ARENA_R, ARENA_R, 0.6, 64), 'toyBlue');
    top.position.y = -0.3;
    const band = w.mesh(new THREE.CylinderGeometry(ARENA_R + 0.03, ARENA_R + 0.03, 0.32, 64, 1, true), 'hazard', { cast: false });
    band.position.y = -0.16;
    const tower = w.mesh(new THREE.CylinderGeometry(ARENA_R * 0.8, ARENA_R * 0.62, 31.4, 40, 1, true), 'white');
    tower.position.y = -16.3;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.3, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf2b90f, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    ring.position.y = 0.01;
    // A painted warning strip just inside the drop.
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(ARENA_R - 0.55, ARENA_R - 0.25, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf2b90f, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    edge.position.y = 0.01;
    w.disposables.push(ring.geometry, ring.material, edge.geometry, edge.material);
    w.add(top, band, tower, ring, edge);
    const body = w.fixedBody([0, -0.3, 0], new THREE.Quaternion());
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(0.3, ARENA_R).setFriction(1).setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'ground', material: 'concrete' },
    );
  }

  makePylons() {
    const w = this.world;
    const list = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const x = Math.sin(a) * PYLON_RING;
      const z = Math.cos(a) * PYLON_RING;
      const g = new THREE.Group();
      const post = w.mesh(new THREE.CylinderGeometry(PYLON_R, PYLON_R * 1.15, 2.2, 20), 'steelGrey');
      post.position.y = 1.1;
      const band = w.mesh(new THREE.CylinderGeometry(PYLON_R + 0.02, PYLON_R + 0.02, 0.4, 20, 1, true), 'hazard', { cast: false });
      band.position.y = 0.45;
      const capMat = new THREE.MeshStandardMaterial({ color: 0x7fe6ff, emissive: 0x27b8e8, emissiveIntensity: 0.6, roughness: 0.3 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), capMat);
      cap.position.y = 2.35;
      w.disposables.push(capMat, cap.geometry);
      g.add(post, band, cap);
      g.position.set(x, 0, z);
      w.add(g);
      const body = w.fixedBody([x, 1.1, z], new THREE.Quaternion());
      this.physics.createCollider(RAPIER.ColliderDesc.cylinder(1.1, PYLON_R).setCollisionGroups(groups(Group.WORLD)), body, {
        kind: 'static',
        material: 'metal',
      });
      list.push({ x, z, capMat, cap, flash: 0 });
    }
    return list;
  }

  scatterProps() {
    const w = this.world;
    const C = 0.7;
    for (const [x, z, n] of [[-3.2, -1.2, 2], [3.4, -2.4, 1], [-6.4, 1.6, 1], [6.2, 1.2, 2], [0.6, -6.4, 1], [-2.4, 6.2, 1]]) {
      for (let k = 0; k < n; k++) w.crate({ pos: [x, C / 2 + k * C, z], size: C, rot: [0, (x * 37 + k * 23) % 40, 0] });
    }
    w.barrel({ pos: [2.2, 0.45, 6.6] });
    w.barrel({ pos: [-7.1, 0.45, -2.8], color: 'steelBlue' });
  }

  makeBoss() {
    const def = this.def;
    const w = this.world;
    const g = new THREE.Group();
    const body = new THREE.Group(); // shakes and wobbles on top of the physics pose
    g.add(body);
    const add = (mesh, x, y, z) => {
      mesh.position.set(x, y, z);
      body.add(mesh);
      return mesh;
    };
    add(w.mesh(new THREE.CylinderGeometry(1.32, 1.36, 0.3, 32), 'darkSteel'), 0, 0.32, 0);
    add(w.mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.1, 32), 'steelGrey'), 0, 0.98, 0);
    add(w.mesh(new THREE.SphereGeometry(1.02, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), def.paint), 0, 1.52, 0);
    add(w.mesh(new THREE.CylinderGeometry(1.04, 1.04, 0.16, 32, 1, true), 'hazard', { cast: false }), 0, 1.5, 0);
    for (const x of [-1.18, 1.18]) add(w.mesh(new THREE.BoxGeometry(0.42, 0.52, 2.4), 'rubber'), x, 0.26, 0);
    for (const x of [-0.5, 0.5]) add(w.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 12), 'darkSteel'), x, 1.85, -0.75);

    const plow = add(w.mesh(new THREE.BoxGeometry(2.8, 0.72, 0.22), 'hazard'), 0, 0.5, 1.45);
    plow.rotation.x = -0.35;
    for (const x of [-0.9, 0.9]) add(w.mesh(new THREE.BoxGeometry(0.14, 0.14, 0.5), 'darkSteel'), x, 0.55, 1.2);

    this.eyeMat = new THREE.MeshStandardMaterial({ color: def.eye, emissive: def.eye, emissiveIntensity: 1.3, roughness: 0.25 });
    const eye = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), this.eyeMat), 0, 1.86, 0.86);
    eye.scale.z = 0.6;
    const socket = add(w.mesh(new THREE.TorusGeometry(0.34, 0.07, 10, 28), 'darkSteel'), 0, 1.86, 0.88);
    socket.rotation.x = -0.45;

    // The weak spot on the back: dull behind its grille until it's stunned.
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x27b8e8, emissiveIntensity: 0.2, roughness: 0.3 });
    const core = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 24), this.coreMat), 0, 1.0, -1.28);
    core.rotation.x = Math.PI / 2;
    add(w.mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 24), 'darkSteel'), 0, 1.0, -1.32);

    add(w.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), 'darkSteel'), 0.35, 2.75, -0.2);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.eyeMat), 0.35, 3.22, -0.2);
    w.disposables.push(this.eyeMat, this.coreMat, eye.geometry, core.geometry);

    // Little stars that circle its head while it's seeing them.
    this.stars = new THREE.Group();
    const starGeo = new THREE.OctahedronGeometry(0.16);
    w.disposables.push(starGeo);
    for (let i = 0; i < 3; i++) {
      const s = w.mesh(starGeo, 'gold', { cast: false });
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
      this.stars.add(s);
    }
    this.stars.position.y = 2.75;
    this.stars.visible = false;
    body.add(this.stars);
    w.add(g);

    // Telegraph: a red lane across the floor along the line it's about to charge.
    const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.lane = new THREE.Mesh(laneGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0, depthWrite: false }));
    this.lane.position.y = 0.02;
    this.lane.renderOrder = 2;
    const waveGeo = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
    this.waveMesh = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0, depthWrite: false }));
    this.waveMesh.position.y = 0.04;
    // Where a leap is going to come down.
    const markGeo = new THREE.RingGeometry(BOSS_R * 0.75, BOSS_R + 0.1, 48).rotateX(-Math.PI / 2);
    this.marker = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0, depthWrite: false }));
    this.marker.position.y = 0.03;
    w.disposables.push(laneGeo, this.lane.material, waveGeo, this.waveMesh.material, markGeo, this.marker.material);
    w.add(this.lane, this.waveMesh, this.marker);

    const rb = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 12, -2.5));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(0.85, BOSS_R).setTranslation(0, 0.85, 0).setFriction(0.6).setCollisionGroups(groups(Group.WORLD)),
      rb,
      { kind: 'boss', material: 'metal' },
    );
    this.physics.link(rb, g);
    this.boss = { rb, g, body, x: 0, z: -2.5, y: 12, vy: 0, heading: 0, state: 'intro', t: 0, dur: 0, speed: 0, aim: 0, from: null, to: null, flash: 0, cycles: 0 };
  }

  // ---------- the player ----------

  spawnPlayer(pos) {
    if (this.player) this.removeDummy(this.player);
    const b = this.boss;
    const yaw = Math.atan2(b.x - pos[0], b.z - pos[2]);
    this.player = this.spawnDummy({ position: pos, yaw, pose: 'ready', muscle: 1 });
    this.player.balance = 1;
    this.pstate = 'ok';
    this.physics.snapAll();
  }

  /** Back on the ring on the far side from the boss, dropped in from above. */
  respawn() {
    const b = this.boss;
    const a = Math.atan2(-b.x, -b.z) + (b.x === 0 && b.z === 0 ? Math.PI : 0);
    this.spawnPlayer([Math.sin(a) * 4, 2.5, Math.cos(a) * 4]);
    this.invulnT = 1.5;
  }

  grounded() {
    const pel = this.player.parts.pelvis.body.translation();
    const handles = this.player.ragdoll.handles;
    const hit = this.physics.castRay({ x: pel.x, y: pel.y, z: pel.z }, DOWN, 1.3, (c) => !handles.has(c.handle));
    return hit && hit.distance < 1.12;
  }

  /** Screen-space stick (x right, y down) to a direction on the arena floor. */
  screenToWorld(sx, sy, out) {
    this.stage.camera.getWorldDirection(_d);
    _d.y = 0;
    _d.normalize();
    return out.set(-_d.z * sx + _d.x * -sy, 0, _d.x * sx + _d.z * -sy);
  }

  moveInput(out) {
    let sx = this.stick?.x ?? 0;
    let sy = this.stick?.y ?? 0;
    const held = (...codes) => codes.some((c) => this.game.input.held(c));
    if (held('ArrowLeft', 'KeyA')) sx -= 1;
    if (held('ArrowRight', 'KeyD')) sx += 1;
    if (held('ArrowUp', 'KeyW')) sy -= 1;
    if (held('ArrowDown', 'KeyS')) sy += 1;
    const m = Math.min(1, Math.hypot(sx, sy));
    if (m < 0.15) return out.set(0, 0, 0);
    return this.screenToWorld(sx, sy, out).normalize().multiplyScalar(m);
  }

  dive(dir) {
    if (this.phase !== 'fight' || this.pstate !== 'ok') return;
    const d = this.player;
    const com = d.com(_a);
    const aim = _b.copy(dir ?? d.ragdoll.facing);
    aim.y = 0;
    // A dive in the general direction of the boss homes in on it; once it's
    // stunned, any dive within reach goes for it.
    const b = this.boss;
    const to = _c.set(b.x - com.x, 0, b.z - com.z);
    const dist = to.length();
    const cone = b.state === 'stunned' ? -1 : 0.5;
    if (dist > 0.01 && dist < 7.5 && to.divideScalar(dist).dot(aim.normalize()) > cone) aim.copy(to);
    aim.normalize();
    d.balance = 0;
    d.setPose('hang');
    d.ragdoll.addVelocity({ x: aim.x * DIVE, y: 3.4, z: aim.z * DIVE }, 0.25);
    d.ragdoll.addSpin(_c.crossVectors(UP, aim).multiplyScalar(7));
    this.pstate = 'dive';
    this.diveAt = this.time;
    this.diveDir = aim.clone();
    this.diveHit = false;
    this.fx.puff(d.partPosition('shinL', _c), { count: 4, size: 0.35, color: 0xe8e4da, up: 0.2 });
    this.audio.whoosh(1);
    this.audio.jump(true);
    this.hud.clearHint();
  }

  getUp() {
    const d = this.player;
    this.pstate = 'rise';
    this.riseT = 0.55;
    d.knockout = 0;
    d.setMuscle(1);
    d.setPose('ready');
    d.balance = 1;
    d.ragdoll.addVelocity({ x: 0, y: 4.2, z: 0 }, 0.4);
  }

  knockDown(dir, { push = 9, up = 6.5, seconds = 1.1, hurt = true, label = 'OUCH!' } = {}) {
    const d = this.player;
    d.balance = 0;
    d.knockOut(seconds, 0.6);
    d.setPose('starfish');
    d.ragdoll.addVelocity({ x: dir.x * push, y: up, z: dir.z * push }, 0.2);
    d.ragdoll.addSpin({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 8 });
    this.pstate = 'down';
    this.downT = seconds + 0.2;
    this.rig.shake(hurt ? 0.6 : 0.35);
    this.audio.impact(1, 'body');
    if (hurt) this.loseHeart(label);
  }

  loseHeart(label) {
    if (this.invulnT > 0 || this.phase !== 'fight') return;
    this.hearts--;
    this.invulnT = 1.8;
    this.hud.set('hearts', Math.max(0, this.hearts));
    this.hud.bump('hearts');
    this.fx.text(this.player.com(_c).add(UP), label, { color: '#ff7a6b', size: 30 });
    if (this.hearts <= 0) this.knockedOut();
  }

  ringOut() {
    this.pstate = 'out';
    this.outT = 1.1;
    this.loseHeart('RING OUT!');
    this.audio.whoosh(1.2);
  }

  playerStep(dt) {
    const d = this.player;
    const com = d.com(_a);
    if (this.pstate !== 'out' && com.y < -2.5) this.ringOut();

    if (this.pstate === 'ok') {
      const want = this.moveInput(this.move);
      const moving = want.lengthSq() > 0.02;
      if (this.grounded()) {
        const v = d.velocity(_b);
        d.ragdoll.addVelocity({ x: (want.x * WALK - v.x) * 0.3, y: 0, z: (want.z * WALK - v.z) * 0.3 });
        // A bouncy shuffle reads better than feet sliding along the floor.
        if (moving && this.time - this.lastStep > 0.26) {
          this.lastStep = this.time;
          d.ragdoll.addVelocity({ x: 0, y: 1.5, z: 0 });
        }
      }
      this.edgeGuard(com);
      if (moving) d.ragdoll.facing.set(want.x, 0, want.z).normalize();
      else d.ragdoll.facing.set(this.boss.x - com.x, 0, this.boss.z - com.z).normalize();
    } else if (this.pstate === 'dive') {
      const since = this.time - this.diveAt;
      if ((since > 0.35 && this.grounded()) || since > 1.3) {
        this.pstate = 'down';
        this.downT = 0.35;
        d.setPose('starfish');
      }
    } else if (this.pstate === 'down') {
      this.downT -= dt;
      if (this.downT <= 0 && this.phase !== 'lost') this.getUp();
    } else if (this.pstate === 'rise') {
      this.edgeGuard(com);
      this.riseT -= dt;
      if (this.riseT <= 0) this.pstate = 'ok';
    } else if (this.pstate === 'out') {
      this.outT -= dt;
      if (this.outT <= 0 && this.phase === 'fight') this.respawn();
    }
  }

  /**
   * Walking never takes him over the edge by itself: near the drop, outward
   * speed is soaked up. Getting knocked off is still very much on the cards.
   */
  edgeGuard(com) {
    const r = Math.hypot(com.x, com.z);
    if (r < ARENA_R - 1.2) return;
    const nx = com.x / r;
    const nz = com.z / r;
    const v = this.player.velocity(_c);
    const out = v.x * nx + v.z * nz;
    if (out <= 0) return;
    const k = Math.min(1, (r - (ARENA_R - 1.2)) / 0.8);
    this.player.ragdoll.addVelocity({ x: -nx * out * k, y: 0, z: -nz * out * k });
  }

  // ---------- the boss ----------

  setBoss(state, dur = 0) {
    const b = this.boss;
    b.state = state;
    b.t = 0;
    b.dur = dur;
  }

  rage() {
    return this.def.hp - this.hp;
  }

  bossStep(dt) {
    const b = this.boss;
    b.t += dt;
    const p = this.player.com(_a);
    const fwdX = Math.sin(b.heading);
    const fwdZ = Math.cos(b.heading);

    switch (b.state) {
      case 'intro':
        b.vy -= 32 * dt;
        b.y += b.vy * dt;
        b.heading = Math.atan2(p.x - b.x, p.z - b.z);
        if (b.y <= 0) {
          b.y = 0;
          this.land(false);
          this.setBoss('recover', 1);
        }
        break;
      case 'track': {
        const want = Math.atan2(p.x - b.x, p.z - b.z);
        const turn = 2.4 + this.rage() * 0.4;
        b.heading += THREE.MathUtils.clamp(wrap(want - b.heading), -turn * dt, turn * dt);
        if (Math.abs(wrap(want - b.heading)) < 0.5) this.drive(1.2 * dt);
        if (b.t > b.dur) {
          this.setBoss('windup', Math.max(0.45, 0.85 - this.rage() * 0.1));
          this.audio.rev();
        }
        break;
      }
      case 'windup':
        if (b.t > b.dur) {
          this.setBoss('charge');
          b.speed = 0;
          this.audio.whoosh(1.4);
        }
        break;
      case 'charge': {
        const top = this.def.speed + this.rage() * 1.2;
        b.speed = Math.min(top, b.speed + top * 5 * dt);
        if (!this.drive(b.speed * dt)) {
          // Ran out of ring: brakes hard at the edge.
          this.fx.puff(_b.set(b.x + fwdX * BOSS_R, 0.3, b.z + fwdZ * BOSS_R), { count: 8, size: 0.7, color: 0xd8d2c4 });
          this.audio.impact(0.6, 'metal');
          this.rig.shake(0.25);
          this.setBoss('recover', 0.8);
          break;
        }
        const pylon = this.pylons.find((y) => Math.hypot(y.x - b.x, y.z - b.z) < BOSS_R + PYLON_R + 0.1);
        if (pylon) this.stun(pylon);
        else if (this.invulnT <= 0 && this.pstate !== 'out' && p.y < 2.2 && Math.hypot(p.x - b.x, p.z - b.z) < BOSS_R + 0.6) {
          const away = _c.set(p.x - b.x, 0, p.z - b.z).normalize().add(_b.set(fwdX, 0, fwdZ)).normalize();
          this.knockDown(away);
          this.setBoss('recover', 0.9);
        } else if (b.t > 2.6) this.setBoss('recover', 0.6);
        break;
      }
      case 'stunned':
        if (b.t > this.def.stun) {
          this.setBoss('recover', 0.4);
          this.fx.text(_b.set(b.x, 3, b.z), 'GRR!', { color: '#ff7a6b', size: 26 });
        }
        break;
      case 'hurt': {
        const k = Math.max(0, 1 - b.t / 0.5);
        this.drive(7 * k * dt, b.push);
        if (b.t > 0.55) this.startHop();
        break;
      }
      case 'hop': {
        const k = Math.min(1, b.t / HOP_T);
        b.y = 4 * HOP_H * k * (1 - k);
        b.x = THREE.MathUtils.lerp(b.from.x, b.to.x, k);
        b.z = THREE.MathUtils.lerp(b.from.z, b.to.z, k);
        if (k >= 1) {
          b.y = 0;
          this.land(true);
          this.setBoss('recover', 0.7);
        }
        break;
      }
      case 'recover':
        if (b.t > b.dur) {
          b.cycles++;
          if (this.def.stomps && b.cycles % 3 === 0) this.startHop();
          else this.setBoss('track', Math.max(0.7, 1.6 - this.rage() * 0.2) + Math.random() * 0.5);
        }
        break;
      default:
        break;
    }

    // Kinematic bodies pass straight through scenery, so outside a charge it's
    // simply kept clear of the pylons.
    if (b.state !== 'charge' && b.y < 1.5) {
      for (const y of this.pylons) {
        const dx = b.x - y.x;
        const dz = b.z - y.z;
        const dist = Math.hypot(dx, dz);
        const min = BOSS_R + PYLON_R + 0.05;
        if (dist < min && dist > 1e-4) {
          b.x = y.x + (dx / dist) * min;
          b.z = y.z + (dz / dist) * min;
        }
      }
    }

    b.rb.setNextKinematicTranslation({ x: b.x, y: b.y, z: b.z });
    _q.setFromAxisAngle(UP, b.heading);
    b.rb.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
  }

  /** Moves the boss along its heading (or `dir`); false if the edge of the ring stopped it. */
  drive(dist, dir) {
    const b = this.boss;
    const dx = dir ? dir.x : Math.sin(b.heading);
    const dz = dir ? dir.z : Math.cos(b.heading);
    const x = b.x + dx * dist;
    const z = b.z + dz * dist;
    const lim = ARENA_R - BOSS_R - 0.15;
    const r = Math.hypot(x, z);
    if (r > lim) {
      b.x = (x / r) * lim;
      b.z = (z / r) * lim;
      return false;
    }
    b.x = x;
    b.z = z;
    return true;
  }

  startHop() {
    const b = this.boss;
    const p = this.player.com(_a);
    // Leaps at where you're standing, but never off its own ring.
    const to = new THREE.Vector3(THREE.MathUtils.lerp(b.x, p.x, 0.45), 0, THREE.MathUtils.lerp(b.z, p.z, 0.45));
    const lim = ARENA_R - BOSS_R - 0.4;
    if (to.length() > lim) to.setLength(lim);
    b.from = new THREE.Vector3(b.x, 0, b.z);
    b.to = to;
    this.setBoss('hop');
    this.audio.jump(true);
  }

  /** It hits the floor: dust, a rumble and a shockwave across the ring. */
  land(hurts) {
    const b = this.boss;
    this.rig.shake(0.55);
    this.audio.boom();
    this.fx.puff(_b.set(b.x, 0.2, b.z), { count: 14, size: 1.1, speed: 3.2, color: 0xd8d2c4, up: 0.3 });
    this.wave = { x: b.x, z: b.z, r: BOSS_R, hurts, hit: false, pushed: new Set() };
    if (!hurts || this.pstate === 'out' || this.invulnT > 0) return;
    const p = this.player.com(_a);
    const dist = Math.hypot(p.x - b.x, p.z - b.z);
    if (dist < BOSS_R + 0.5 && p.y < 2) {
      this.wave.hit = true;
      const away = dist > 0.05 ? _c.set(p.x - b.x, 0, p.z - b.z).normalize() : _c.set(-b.x, 0, -b.z).normalize();
      this.knockDown(away, { push: 4, up: 6, label: 'SQUASHED!' });
    }
  }

  waveStep(dt) {
    const w = this.wave;
    if (!w) return;
    w.r += WAVE_SPEED * dt;
    if (w.r > ARENA_R + 1) {
      this.wave = null;
      return;
    }
    for (const prop of this.world.props) {
      if (w.pushed.has(prop)) continue;
      const t = prop.body.translation();
      const dist = Math.hypot(t.x - w.x, t.z - w.z);
      if (Math.abs(dist - w.r) > 0.5 || t.y > 1.5) continue;
      w.pushed.add(prop);
      const m = prop.body.mass();
      prop.body.applyImpulse({ x: ((t.x - w.x) / dist) * 2.5 * m, y: 3.5 * m, z: ((t.z - w.z) / dist) * 2.5 * m }, true);
    }
    if (!w.hurts || w.hit || this.pstate === 'out' || this.invulnT > 0) return;
    const p = this.player.com(_a);
    const dist = Math.hypot(p.x - w.x, p.z - w.z);
    // Only catches you on the ground; a dive carries you over it.
    if (Math.abs(dist - w.r) < 0.6 && p.y < 1.2 && (this.pstate === 'ok' || this.pstate === 'rise')) {
      w.hit = true;
      this.knockDown(_c.set(p.x - w.x, 0, p.z - w.z).normalize(), { push: 2.2, up: 4.2, seconds: 0.8, hurt: false });
      this.fx.text(_b.copy(p).add(UP), 'WHOA!', { color: '#fff3d6', size: 24 });
    }
  }

  stun(pylon) {
    const b = this.boss;
    this.drive(-0.35);
    this.setBoss('stunned');
    pylon.flash = 1;
    const at = _b.set((b.x + pylon.x) / 2, 1.2, (b.z + pylon.z) / 2);
    this.fx.chips(at, { count: 26, colors: [0xfff3a0, 0xffffff, 0x8ff0ff], size: 0.07, speed: 7, life: 1 });
    this.fx.puff(at, { count: 6, size: 0.8, color: 0xd8d2c4 });
    this.fx.text(_c.set(b.x, 3.2, b.z), 'STUNNED!', { color: '#8ff0ff', size: 30 });
    this.audio.crack();
    this.audio.impact(1, 'metal');
    this.rig.shake(0.55);
    this.hitStop(0.2, 0.25);
  }

  /** A dive connects with the boss: only counts while it's stunned. */
  checkDive() {
    if (this.pstate !== 'dive' || this.diveHit) return;
    const b = this.boss;
    if (b.state === 'intro' || b.state === 'dead' || b.state === 'hop') return;
    let hit = null;
    for (const name of ['head', 'chest', 'pelvis']) {
      const t = this.player.parts[name].body.translation();
      if (t.y < 2.6 && Math.hypot(t.x - b.x, t.z - b.z) < BOSS_R + 0.4) hit = t;
    }
    if (!hit) return;
    this.diveHit = true;
    const back = _c.copy(this.diveDir).multiplyScalar(-1);
    if (b.state !== 'stunned') {
      this.fx.text(_b.set(hit.x, hit.y + 0.8, hit.z), 'CLANK!', { color: '#d9dde3', size: 26 });
      this.audio.impact(0.9, 'metal');
      this.player.ragdoll.addVelocity({ x: back.x * 5, y: 3, z: back.z * 5 }, 0.2);
      return;
    }
    this.hp--;
    b.flash = 1;
    const at = _b.set(hit.x, hit.y, hit.z);
    this.fx.chips(at, { count: 34, colors: [0xffd23a, 0xffffff, 0x8ff0ff, 0x2b2e33], size: 0.09, speed: 7.5, life: 1.4 });
    this.fx.puff(at, { count: 8, size: 0.9, color: 0xd8d2c4 });
    this.fx.text(_d.set(b.x, 3.4, b.z), this.hp > 0 ? 'BAM!' : 'K.O.!', { color: '#ffd23a', size: 40 });
    this.audio.boom();
    this.audio.crack();
    this.rig.shake(0.8);
    this.rig.kick(6);
    this.hud.meter(this.def.name, this.hp / this.def.hp, true);
    this.player.ragdoll.addVelocity({ x: back.x * 4, y: 4, z: back.z * 4 }, 0.2);
    if (this.hp <= 0) this.defeat();
    else {
      this.hitStop(0.12, 0.05);
      b.push = this.diveDir.clone();
      this.setBoss('hurt');
    }
  }

  hitStop(seconds, amount) {
    this.slowmoT = seconds;
    this.slowAmount = amount;
    this.slowmo = amount;
  }

  // ---------- endings ----------

  defeat() {
    const b = this.boss;
    this.setBoss('dead');
    this.phase = 'won';
    this.endT = 2.6;
    this.hitStop(1.1, 0.3);
    b.g.visible = false;
    this.lane.material.opacity = 0;
    b.rb.setNextKinematicTranslation({ x: b.x, y: -60, z: b.z });
    // It comes apart: chunks of plating everywhere.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const piece = this.world.crate({ pos: [b.x + Math.cos(a) * 0.6, 0.6 + (i % 3) * 0.5, b.z + Math.sin(a) * 0.6], size: 0.35 + (i % 3) * 0.12, kind: 'metal' });
      const m = piece.body.mass();
      piece.body.applyImpulse({ x: Math.cos(a) * 6 * m, y: (6 + (i % 4)) * m, z: Math.sin(a) * 6 * m }, true);
      piece.body.applyTorqueImpulse({ x: (i - 4) * m * 0.3, y: m * 0.2, z: (4 - i) * m * 0.3 }, true);
    }
    const at = _b.set(b.x, 1.2, b.z);
    this.fx.chips(at, { count: 60, colors: [0xffd23a, 0x2b2e33, 0x8ff0ff, 0xd9dde3], size: 0.1, speed: 9, life: 2 });
    this.fx.puff(at, { count: 16, size: 1.4, speed: 3, color: 0x6c7178 });
    this.fx.confetti(at.clone().add(UP), 160);
    this.audio.boom();
    setTimeout(() => this.audio.boom(), 180);
    this.rig.shake(1);
    this.game.ui.banner('BOSS DOWN!', this.def.name);
    this.hud.hideMeter();
  }

  knockedOut() {
    this.phase = 'lost';
    this.endT = 1.6;
    this.lane.material.opacity = 0;
    this.game.ui.banner('K.O.', 'The boss wins this round');
  }

  revive() {
    this.hearts = 1;
    this.hud.set('hearts', 1);
    this.phase = 'fight';
    this.respawn();
    this.invulnT = 2.5;
    this.setBoss('recover', 1.4);
  }

  complete() {
    this.phase = 'done';
    const passed = this.hp <= 0;
    const mk = this.def.mk;
    const score = passed ? 3000 + 1500 * (mk - 1) + this.hearts * 1000 + Math.round(Math.max(0, 120 - this.clock) * 15) : 0;
    this.finish({
      passed,
      stars: passed ? Math.max(1, this.hearts) : 0,
      score,
      reason: 'Lure it into a pylon, then dive into it while it sees stars.',
      stats: [
        ['Hearts left', `${Math.max(0, this.hearts)}/${HEARTS}`],
        ['Boss health', `${Math.max(0, this.hp)}/${this.def.hp}`],
        ['Time', `${Math.round(this.clock)}s`],
      ],
    });
  }

  // ---------- input ----------

  onPointerDown(p) {
    this.touch = { x: p.px, y: p.py, ax: p.px, ay: p.py, at: performance.now(), moved: false };
  }

  onPointerMove(p) {
    const t = this.touch;
    if (!t) return;
    const s = Math.min(p.w, p.h);
    if (Math.hypot(p.px - t.x, p.py - t.y) > s * 0.03) t.moved = true;
    // A floating stick: the anchor trails the finger, so turning round is instant.
    const max = s * 0.12;
    let dx = p.px - t.ax;
    let dy = p.py - t.ay;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      t.ax = p.px - (dx / len) * max;
      t.ay = p.py - (dy / len) * max;
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    if (t.moved) this.stick = { x: dx / max, y: dy / max };
  }

  onPointerUp(p) {
    const t = this.touch;
    this.touch = null;
    this.stick = null;
    if (!t || performance.now() - t.at > 280) return;
    const fx = p.px - t.x;
    const fy = p.py - t.y;
    // A tap dives where he's facing; a quick flick dives that way.
    if (!t.moved) this.dive();
    else if (Math.hypot(fx, fy) > Math.min(p.w, p.h) * 0.06) this.dive(this.screenToWorld(fx, fy, _d).normalize());
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'KeyJ') this.dive();
  }

  // ---------- frame ----------

  fixedUpdate(dt) {
    if (!this.player) return;
    this.invulnT -= dt;
    this.playerStep(dt);
    if (this.boss.state !== 'dead' && this.phase !== 'lost') this.bossStep(dt);
    this.checkDive();
    this.waveStep(dt);
    if (this.phase === 'won' && this.pstate === 'ok') {
      this.player.setPose('cheer');
      this.player.ragdoll.facing.set(this.stage.camera.position.x, 0, this.stage.camera.position.z).normalize();
    }
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const c = this.player.com(_a);
    const follow = portrait ? 0.6 : 0.45;
    const look = new THREE.Vector3(c.x * follow, 0.3, Math.max(-7, Math.min(7, c.z)) * follow - 0.4);
    const pos = look.clone().add(portrait ? _b.set(0, 15, 12) : _b.set(0, 10, 9.5));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 4);
    this.stage.focusShadows(look, 13);
  }

  tick(dt) {
    if (this.slowmoT > 0) {
      this.slowmoT -= dt / this.slowmo;
      this.slowmo = this.slowmoT > 0 ? this.slowAmount : 1;
    }
    if (this.phase === 'fight') {
      this.clock += dt;
      this.hud.set('time', Math.floor(this.clock));
    } else if (this.phase === 'won' || this.phase === 'lost') {
      this.endT -= dt / this.slowmo;
      if (this.endT <= 0) this.complete();
    }
    if (this.pstate !== 'out') this.cameraFor();
    this.animateBoss(dt);
    this.audio.loop('rumble', this.boss.state === 'charge' ? Math.min(1, this.boss.speed / 12) : this.boss.state === 'track' ? 0.25 : 0, 'rumble');
  }

  animateBoss(dt) {
    const b = this.boss;
    const t = this.time;
    const body = b.body;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    this.stars.visible = b.state === 'stunned';
    if (b.state === 'windup') {
      body.position.x = (Math.random() - 0.5) * 0.08;
      body.rotation.x = -0.08;
    } else if (b.state === 'stunned') {
      body.rotation.z = Math.sin(t * 9) * 0.1;
      body.rotation.x = 0.12;
      this.stars.rotation.y = t * 4;
    } else if (b.state === 'hurt') {
      body.rotation.x = -0.25 * (1 - b.t / 0.55);
    } else if (b.state === 'charge') {
      body.rotation.x = 0.08;
    }

    const angry = b.state === 'windup' || b.state === 'charge';
    this.eyeMat.color.set(b.state === 'stunned' ? DIM : angry ? RED : this.def.eye);
    this.eyeMat.emissive.copy(this.eyeMat.color);
    this.eyeMat.emissiveIntensity = b.state === 'stunned' ? 0.1 : angry ? 1.6 + Math.sin(t * 30) * 0.4 : 1.2;
    this.coreMat.emissiveIntensity = b.state === 'stunned' ? 1.6 + Math.sin(t * 12) * 0.8 : 0.2;
    b.flash = Math.max(0, b.flash - dt * 4);
    this.coreMat.emissiveIntensity += b.flash * 3;

    for (const y of this.pylons) {
      y.flash = Math.max(0, y.flash - dt * 2);
      y.capMat.emissiveIntensity = 0.6 + Math.sin(t * 3 + y.x) * 0.15 + y.flash * 3;
      y.cap.scale.setScalar(1 + y.flash * 0.4);
    }

    // The lane shows where it's going to go, flickering faster as it revs.
    const lane = this.lane;
    if (b.state === 'windup' || (b.state === 'charge' && b.t < 0.15)) {
      const fx = Math.sin(b.heading);
      const fz = Math.cos(b.heading);
      // Distance from the boss to the edge of the ring along its heading.
      const lim = ARENA_R - 0.2;
      const proj = b.x * fx + b.z * fz;
      const len = -proj + Math.sqrt(Math.max(0, proj * proj - (b.x * b.x + b.z * b.z - lim * lim)));
      lane.position.set(b.x, 0.02, b.z);
      lane.rotation.y = b.heading;
      lane.scale.set(BOSS_R * 2, 1, Math.max(0.1, len));
      const k = b.state === 'windup' ? b.t / Math.max(0.01, b.dur) : 1;
      lane.material.opacity = 0.18 + 0.32 * k * (0.6 + 0.4 * Math.sin(t * (12 + k * 30)));
    } else {
      lane.material.opacity = Math.max(0, lane.material.opacity - dt * 3);
    }

    if (b.state === 'hop' || (b.state === 'hurt' && b.to)) {
      this.marker.position.set(b.to.x, 0.03, b.to.z);
      this.marker.material.opacity = 0.35 + 0.3 * Math.sin(t * 18);
    } else {
      this.marker.material.opacity = 0;
    }

    const w = this.wave;
    if (w) {
      this.waveMesh.position.set(w.x, 0.04, w.z);
      this.waveMesh.scale.setScalar(w.r);
      this.waveMesh.material.opacity = 0.8 * (1 - w.r / (ARENA_R + 1));
    } else {
      this.waveMesh.material.opacity = 0;
    }
  }
}
