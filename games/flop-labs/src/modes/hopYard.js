import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { Mat } from '../render/materials.js';

const DOWN = { x: 0, y: -1, z: 0 };
const DEPTH = 2.4;
const YAW = Math.PI / 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const PLATFORM_MAT = {
  static: 'concreteDark',
  bob: 'steelBlue',
  slide: 'steelOrange',
  spin: 'steelGrey',
  tilt: 'crate',
  crumble: 'cardboard',
  finish: 'steelGreen',
};

/**
 * Hop Yard: a side-on obstacle course for a self-balancing dummy. Tap to
 * hop, hold for a bigger jump, tap again in the air for one more.
 */
export class HopYardLevel extends Level {
  setup() {
    const def = this.def;
    this.yard({ fences: true, extent: 60 });
    this.platforms = [];
    this.hazards = [];
    this.gears = [];
    this.checkpoints = [];
    this.crumbles = [];
    this.deaths = 0;
    this.collected = 0;
    this.clock = 0;
    this.started = false;
    this.phase = 'play';
    this.holding = false;
    this.lastJump = -9;
    this.lastGround = -9;
    this.airJumps = 1;

    for (const p of def.pieces) this.addPiece(p);
    const goal = def.pieces.find((p) => p.t === 'finish');
    this.finishX = goal.x - goal.w / 2 + 0.3;
    this.spawnPoint = [...def.spawn];
    this.spawn();

    this.hud = this.game.ui.hud({
      title: def.name,
      stats: [
        { id: 'gears', icon: 'gearItem', value: `0/${this.gears.length}` },
        { id: 'time', icon: 'clock', value: '0.0' },
        { id: 'deaths', icon: 'skull', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Tap to hop · hold for a big jump · tap again in the air to double jump');
    const c = this.dummy.com();
    this.cameraFor(c, true);
  }

  // ---------- course pieces ----------

  slab(x, y, w, mat, thick = 0.5) {
    const g = new THREE.Group();
    const top = this.world.mesh(new THREE.BoxGeometry(w, thick, DEPTH), mat);
    top.position.y = -thick / 2;
    g.add(top);
    const edge = this.world.mesh(new THREE.BoxGeometry(w, 0.05, 0.12), 'hazard', { cast: false });
    edge.position.set(0, -0.02, DEPTH / 2 - 0.06);
    g.add(edge);
    this.world.add(g);
    return g;
  }

  kinematic(x, y, colliders, info) {
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, 0));
    for (const c of colliders) this.physics.createCollider(c.setCollisionGroups(groups(Group.WORLD)).setFriction(1.1), body, info);
    return body;
  }

  addPiece(p) {
    const w = this.world;
    const t = p.t;
    if (t === 'gear') return this.addGear(p);
    if (t === 'check') return this.addCheckpoint(p);
    if (t === 'saw') return this.addSaw(p);
    if (t === 'pend') return this.addPendulum(p);

    const width = p.w ?? 3;
    const thick = 0.5;
    const mat = PLATFORM_MAT[t] ?? 'concreteDark';
    const g = this.slab(p.x, p.y, width, mat, thick);
    const box = RAPIER.ColliderDesc.cuboid(width / 2, thick / 2, DEPTH / 2).setTranslation(0, -thick / 2, 0);
    const info = { kind: t === 'crumble' ? 'crumble' : 'static', material: t === 'tilt' ? 'wood' : t === 'crumble' ? 'cardboard' : t === 'static' ? 'concrete' : 'metal' };
    const body = this.kinematic(p.x, p.y, [box], info);

    if (t === 'static' || t === 'finish') {
      // Support column down to the yard floor sells the height.
      if (p.y > 1) {
        const col = w.mesh(new THREE.BoxGeometry(Math.min(0.8, width * 0.3), p.y - thick, 0.8), 'steelGrey');
        col.position.set(p.x, (p.y - thick) / 2, 0);
        w.add(col);
      }
      g.position.set(p.x, p.y, 0);
      if (t === 'finish') this.addFinishGate(p.x + width / 2 - 0.6, p.y);
      this.platforms.push({ body, g });
      return;
    }

    const amp = p.amp ?? 1;
    const sp = p.sp ?? 1;
    const ph = p.ph ?? 0;
    let fn;
    if (t === 'bob') fn = (time) => ({ pos: [p.x, p.y + Math.sin(time * sp + ph) * amp, 0] });
    else if (t === 'slide') fn = (time) => ({ pos: [p.x + Math.sin(time * sp + ph) * amp, p.y, 0] });
    else if (t === 'spin') {
      fn = (time) => {
        const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, time * sp + ph);
        return { pos: [p.x, p.y, 0], rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      };
      const hub = w.mesh(new THREE.CylinderGeometry(0.22, 0.22, DEPTH + 0.2, 16), 'darkSteel');
      hub.rotation.x = Math.PI / 2;
      hub.position.set(p.x, p.y - 0.25, 0);
      w.add(hub);
      const post = w.mesh(new THREE.BoxGeometry(0.3, p.y, 0.3), 'steelGrey');
      post.position.set(p.x, p.y / 2 - 0.25, -DEPTH / 2 - 0.2);
      w.add(post);
    } else if (t === 'tilt') {
      const a = ((p.amp ?? 16) * Math.PI) / 180;
      fn = (time) => {
        const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.sin(time * sp + ph) * a);
        return { pos: [p.x, p.y, 0], rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      };
      const fulcrum = w.mesh(new THREE.ConeGeometry(0.35, 0.7, 4), 'darkSteel');
      fulcrum.position.set(p.x, p.y - 0.85, 0);
      w.add(fulcrum);
    } else if (t === 'crumble') {
      fn = (time) => {
        const c = this.crumbles.find((k) => k.body === body);
        const shake = c && c.touched >= 0 ? (Math.random() - 0.5) * 0.06 : 0;
        return { pos: [p.x + shake, p.y, 0] };
      };
      // Pre-cracked look
      const crack = w.mesh(new THREE.BoxGeometry(0.04, 0.02, DEPTH * 0.8), 'darkSteel', { cast: false });
      crack.position.set(width * 0.15, 0.005, 0);
      crack.rotation.y = 0.4;
      g.add(crack);
      this.crumbles.push({ body, g, touched: -1, fallen: false, x: p.x, y: p.y });
    }
    const mover = w.mover({ body, object: g, fn });
    const crumble = this.crumbles.find((k) => k.body === body);
    if (crumble) crumble.mover = mover;
    this.platforms.push({ body, g, mover });
  }

  addFinishGate(x, y) {
    const w = this.world;
    const g = new THREE.Group();
    for (const z of [-DEPTH / 2 + 0.1, DEPTH / 2 - 0.1]) {
      const post = w.mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 10), 'steelGrey');
      post.position.set(0, 1.5, z);
      g.add(post);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.6, DEPTH),
      new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.6 }),
    );
    banner.position.y = 2.8;
    g.add(banner);
    g.position.set(x, y, 0);
    w.add(g);
  }

  addGear(p) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.24 : 0.32;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.1, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
    geo.center();
    const mesh = this.world.mesh(geo, Mat.gold());
    g.add(mesh);
    g.position.set(p.x, p.y, 0);
    this.world.add(g);
    this.gears.push({ g, pos: new THREE.Vector3(p.x, p.y, 0), got: false });
  }

  addCheckpoint(p) {
    const w = this.world;
    const g = new THREE.Group();
    const pole = w.mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), 'steelGrey');
    pole.position.y = 0.9;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshStandardMaterial({ color: 0x9aa1a8, side: THREE.DoubleSide, roughness: 0.7 }));
    flag.position.set(0.32, 1.6, 0);
    g.add(pole, flag);
    g.position.set(p.x, p.y, -DEPTH / 2 + 0.2);
    w.add(g);
    this.checkpoints.push({ x: p.x, y: p.y, flag, reached: false });
  }

  addSaw(p) {
    const w = this.world;
    const r = p.r ?? 0.55;
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    const n = 18;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * 0.82 : r;
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    geo.center();
    const blade = w.mesh(geo, 'saw');
    const hub = w.mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.12, 16), 'steelRed');
    hub.rotation.x = Math.PI / 2;
    g.add(blade, hub);
    w.add(g);
    // Guide rail showing the saw's travel
    const amp = p.amp ?? 0;
    if (amp) {
      const len = amp * 2 + r * 2;
      const rail = w.mesh(new THREE.BoxGeometry(p.axis === 'x' ? len : 0.08, p.axis === 'x' ? 0.08 : len, 0.05), 'darkSteel', { cast: false });
      rail.position.set(p.x, p.y, -0.1);
      w.add(rail);
    }
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, 0));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cylinder(0.1, r * 0.9)
        .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
        .setCollisionGroups(groups(Group.WORLD))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'hazard', material: 'metal', label: 'SAWED!' },
    );
    const sp = p.sp ?? 1.6;
    const ph = p.ph ?? 0;
    w.mover({
      body,
      object: g,
      fn: (time) => {
        const o = Math.sin(time * sp + ph) * amp;
        const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -time * 9);
        return { pos: [p.x + (p.axis === 'x' ? o : 0), p.y + (p.axis === 'x' ? 0 : o), 0], rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      },
    });
    this.hazards.push({ body });
  }

  addPendulum(p) {
    const w = this.world;
    const len = p.len ?? 3;
    const r = 0.45;
    const g = new THREE.Group();
    const chain = w.mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), 'darkSteel');
    chain.position.y = -len / 2;
    const ball = w.mesh(new THREE.IcosahedronGeometry(r, 1), 'steelRed');
    ball.position.y = -len;
    g.add(chain, ball);
    const spikeGeo = new THREE.ConeGeometry(0.09, 0.3, 6);
    this.world.disposables.push(spikeGeo);
    const dirs = new THREE.IcosahedronGeometry(1, 0).attributes.position;
    for (let i = 0; i < dirs.count; i += 3) {
      const d = new THREE.Vector3(dirs.getX(i), dirs.getY(i), dirs.getZ(i)).normalize();
      const s = new THREE.Mesh(spikeGeo, Mat.steel());
      s.position.copy(d).multiplyScalar(r + 0.1).add(new THREE.Vector3(0, -len, 0));
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      g.add(s);
    }
    const mount = w.mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), 'steelGrey');
    mount.position.set(p.x, p.y + 0.1, 0);
    w.add(mount, g);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, 0));
    this.physics.createCollider(
      RAPIER.ColliderDesc.ball(r + 0.08).setTranslation(0, -len, 0).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'hazard', material: 'metal', label: 'SMASHED!' },
    );
    const amp = ((p.amp ?? 50) * Math.PI) / 180;
    const sp = p.sp ?? 1.8;
    const ph = p.ph ?? 0;
    w.mover({
      body,
      object: g,
      fn: (time) => {
        const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.sin(time * sp + ph) * amp);
        return { pos: [p.x, p.y, 0], rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      },
    });
    this.hazards.push({ body });
  }

  // ---------- dummy ----------

  /** Puts fallen cardboard platforms back so a respawn always has a way through. */
  resetCrumbles() {
    for (const k of this.crumbles) {
      if (k.touched < 0 && !k.fallen) continue;
      k.touched = -1;
      if (!k.fallen) continue;
      k.fallen = false;
      const b = k.body;
      b.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      b.setTranslation({ x: k.x, y: k.y, z: 0 }, true);
      b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.world.movers.push(k.mover);
      const link = this.physics.links.find((l) => l.body === b);
      if (link) this.physics.snap(link);
    }
  }

  spawn() {
    if (this.dummy) {
      this.removeDummy(this.dummy);
      this.resetCrumbles();
    }
    const [x, y] = this.spawnPoint;
    this.dummy = this.spawnDummy({ position: [x, y + 0.02, 0], yaw: YAW, pose: 'ready', muscle: 1 });
    this.dummy.balance = 1;
    this.dead = false;
    this.airJumps = 1;
    this.lastGround = this.time;
    this.physics.snapAll();
  }

  grounded() {
    const pel = this.dummy.parts.pelvis.body.translation();
    const handles = this.dummy.ragdoll.handles;
    const hit = this.physics.castRay({ x: pel.x, y: pel.y, z: pel.z }, DOWN, 1.2, (c) => !handles.has(c.handle));
    return hit && hit.distance < 1.08;
  }

  jump() {
    if (this.dead || this.phase !== 'play') return;
    const onGround = this.time - this.lastGround < 0.12 && this.time - this.lastJump > 0.2;
    let k;
    if (onGround) {
      k = 1;
      this.airJumps = 1;
    } else if (this.airJumps > 0 && this.time - this.lastJump > 0.15) {
      this.airJumps--;
      k = 0.85;
    } else return;
    if (!this.started) {
      this.started = true;
      this.hud.clearHint();
    }
    this.lastJump = this.time;
    this.lastGround = -9;
    const fwd = this.def.hopForward ?? 2.5;
    const up = this.def.hopUp ?? 5.4;
    this.dummy.ragdoll.addVelocity({ x: fwd * k, y: up * k, z: 0 }, 0.35);
    // Head goes up a touch faster than the feet so he leads with his chest.
    const h = this.dummy.parts.head.body;
    const hv = h.linvel();
    h.setLinvel({ x: hv.x, y: hv.y + 0.6, z: hv.z }, true);
    this.dummy.setPose('hop');
    const foot = this.dummy.partPosition('shinL');
    this.fx.puff(foot, { count: k === 1 ? 5 : 3, size: 0.35, color: 0xe8e4da, up: 0.2 });
    this.audio.jump(k === 1);
  }

  die(label) {
    if (this.dead) return;
    this.dead = true;
    this.deaths++;
    this.hud.set('deaths', this.deaths);
    this.hud.bump('deaths');
    this.dummy.balance = 0;
    this.dummy.knockOut(99, 1);
    this.dummy.setPose('starfish');
    const c = this.dummy.com();
    this.fx.text(c.clone().add(new THREE.Vector3(0, 1.2, 0)), label, { color: '#ff7a6b', size: 30 });
    this.fx.chips(c, { count: 18, colors: [0xf2b90f, 0x25272c, 0xd9dde3], size: 0.06, speed: 5, floor: 0.02 });
    this.audio.saw();
    this.rig.shake(0.5);
    this.respawnT = 1.4;
  }

  onPointerDown() {
    this.holding = true;
    this.jump();
  }

  onPointerUp() {
    this.holding = false;
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') {
      this.holding = true;
      this.jump();
    }
  }

  onKeyUp(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'Enter') this.holding = false;
  }

  onContact(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (y.kind !== 'dummy' || this.dummyFor(y) !== this.dummy) continue;
      if (x.kind === 'hazard') this.die(x.label ?? 'OUCH!');
    }
  }

  fixedUpdate(dt) {
    if (!this.dummy) return;
    const R = this.dummy.ragdoll;
    // Keep him in the lane: steer the centre of mass back to z = 0.
    const com = this.dummy.com();
    const v = this.dummy.velocity();
    const dvz = (-com.z * 4 - v.z) * 0.2;
    for (const name in R.parts) {
      const b = R.parts[name].body;
      const lv = b.linvel();
      b.setLinvel({ x: lv.x, y: lv.y, z: lv.z + dvz }, true);
    }
    if (this.dead) return;

    const onGround = this.grounded();
    if (onGround) {
      this.lastGround = this.time;
      this.airJumps = 1;
    }
    // Holding after a jump stretches it, like the 2D original.
    if (this.holding && this.time - this.lastJump < 0.3) {
      R.addVelocity({ x: 0.03, y: -this.gravity * 0.75 * dt, z: 0 }, 1);
    }
    this.dummy.balance = onGround ? 1 : 0.55;
    // Feet grip on landing so he doesn't skate off the far edge.
    if (onGround && this.time - this.lastJump > 0.3) {
      for (const name in R.parts) {
        const b = R.parts[name].body;
        const lv = b.linvel();
        b.setLinvel({ x: lv.x * 0.9, y: lv.y, z: lv.z }, true);
      }
    }
    if (onGround && this.time - this.lastJump > 0.25 && R.poseName !== 'ready') this.dummy.setPose('ready');
  }

  cameraFor(c, snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const pos = new THREE.Vector3(c.x + (portrait ? 1.2 : 2.4), Math.max(c.y, 2) + (portrait ? 2.2 : 1.5), portrait ? 11.5 : 8.8);
    const look = new THREE.Vector3(c.x + (portrait ? 1.2 : 2.6), Math.max(c.y, 2) + 0.2, 0);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 4, 5);
    this.stage.focusShadows(look, 16);
  }

  tick(dt) {
    if (!this.dummy) return;
    const com = this.dummy.com();
    if (this.started && this.phase === 'play') {
      this.clock += dt;
      this.hud.set('time', this.clock.toFixed(1));
    }
    this.cameraFor(this.dead ? this.deathCam ?? com : com);
    if (!this.dead) this.deathCam = com.clone();

    for (const g of this.gears) {
      if (g.got) {
        g.g.scale.multiplyScalar(0.9);
        g.g.position.y += dt * 2;
        continue;
      }
      g.g.rotation.y += dt * 2.5;
      if (!this.dead && com.distanceTo(g.pos) < 0.95) {
        g.got = true;
        this.collected++;
        this.hud.set('gears', `${this.collected}/${this.gears.length}`);
        this.hud.bump('gears');
        this.audio.coin(this.collected * 2);
        this.fx.text(g.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'GEAR!', { color: '#ffe066', size: 24 });
        this.fx.chips(g.pos, { count: 12, colors: [0xf5c518, 0xffffff], size: 0.05, speed: 3 });
      }
    }

    for (const c of this.checkpoints) {
      if (!c.reached && !this.dead && com.x > c.x - 0.3 && Math.abs(com.y - c.y - 0.9) < 1.5) {
        c.reached = true;
        c.flag.material.color.set(0x3fc79a);
        this.spawnPoint = [c.x, c.y];
        this.audio.ding(1);
        this.fx.text(new THREE.Vector3(c.x, c.y + 2.2, 0), 'CHECKPOINT', { color: '#7dffb7', size: 22 });
      }
    }

    for (const k of this.crumbles) {
      if (k.fallen) continue;
      if (k.touched < 0 && !this.dead && Math.abs(com.x - k.body.translation().x) < (this.def.crumbleReach ?? 1.8) && com.y > k.y && com.y - k.y < 1.4 && this.grounded()) {
        k.touched = this.time;
        this.audio.crack();
      }
      if (k.touched >= 0 && this.time - k.touched > 0.55) {
        k.fallen = true;
        k.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        this.world.movers = this.world.movers.filter((m) => m.body !== k.body);
        this.audio.impact(0.6, 'wood');
      }
    }

    if (!this.dead && com.y < (this.def.floor ?? 1.3)) this.die('SPLAT!');

    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.spawn();
    } else if (this.phase === 'play' && com.x >= this.finishX && this.grounded()) {
      this.win();
    }
  }

  win() {
    this.phase = 'won';
    this.dummy.setPose('cheer');
    this.dummy.balance = 1;
    const par = this.def.par;
    const allGears = this.collected === this.gears.length;
    const fast = this.clock <= par;
    const stars = 1 + (allGears ? 1 : 0) + (fast ? 1 : 0);
    const timeBonus = Math.max(0, Math.round((par * 1.5 - this.clock) * 40));
    const score = 1000 + this.collected * 300 + timeBonus - this.deaths * 100;
    this.fx.confetti(this.dummy.com().add(new THREE.Vector3(0, 1, 0)), 120);
    this.finish({
      passed: true,
      stars,
      score: Math.max(100, score),
      stats: [
        ['Time', `${this.clock.toFixed(1)}s (par ${par}s)`],
        ['Gears', `${this.collected}/${this.gears.length}`],
        ['Falls', String(this.deaths)],
      ],
    });
  }
}

let checkerTex = null;
function checker() {
  if (checkerTex) return checkerTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 4; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  checkerTex = new THREE.CanvasTexture(c);
  checkerTex.colorSpace = THREE.SRGBColorSpace;
  return checkerTex;
}
