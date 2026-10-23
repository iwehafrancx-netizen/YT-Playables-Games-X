import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { SUITS } from '../dummy/dummyView.js';

const HALF = 6; // half-width of the pen
const ROOF = 8;
const GRAB_SPEED = 16; // fastest you can drag him, m/s
const HIT_GAP = 0.3; // s between two hits on the same body part
const ANY_GAP = 0.12; // s between any two hits
const BLAST_R = 3.4;
const BULLET_SPEED = 26;
// How much a hit hurts, by what he hits.
const HURT = { spikes: 3, hazard: 3, press: 3, bullet: 2.4, prop: 1.3, static: 1.1, ground: 0.6 };
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

/**
 * Smash Yard: a pen in the yard full of things that hurt — crates,
 * containers, spikes, saws, a crusher, TNT, a gun turret. Grab the ragdoll
 * anywhere on screen, drag him about and fling him into them. Every hard
 * knock takes a bite out of his health bar; empty it before the clock runs
 * out and he comes apart at the seams.
 */
export class SmashYardLevel extends Level {
  setup() {
    const def = this.def;
    this.maxHp = def.hp ?? 100;
    this.hp = this.maxHp;
    this.left = def.time ?? 45;
    this.phase = 'play';
    this.grab = null;
    this.target = new THREE.Vector3(0, 4, 0);
    this.lastHit = {};
    this.biggest = 0;
    this.tnts = [];
    this.guns = [];
    this.bullets = [];

    this.scenery({ run: { axis: 'x', to: 10 } });
    this.pen();
    for (const item of def.items) this.item(item);

    const d = this.spawnDummy({ position: [def.start ?? 0, 3, 0], yaw: 0, pose: 'starfish', muscle: 0.45 });
    d.lively = 0.6;
    this.dummy = d;
    this.physics.snapAll();

    this.hud = this.game.ui.hud({ title: this.hudTitle(), stats: [{ id: 'time', icon: 'clock', value: Math.ceil(this.left) }] });
    this.hud.meter('Ragdoll', 1);
    this.hud.goal(def.goal ?? 'Smash him to pieces!');
    this.hud.hint(def.hint ?? 'Drag to grab him · fling him into things to break him');
    this.cameraFor(true);
  }

  // ---------- the pen ----------

  pen() {
    const w = this.world;
    // Low steel walls either side, kept thin so they never block the view;
    // above them the pen carries on up to the lid in glass.
    for (const s of [-1, 1]) {
      w.block({ pos: [s * (HALF + 0.3), 1.6, 0], size: [0.6, 3.2, 1.1], mat: s < 0 ? 'steelBlue' : 'steelRed', restitution: 0.2 });
      w.block({ pos: [s * (HALF + 0.3), 0.3, 0], size: [0.7, 0.6, 1.2], mat: 'hazard' });
      w.block({ pos: [s * (HALF + 0.3), ROOF / 2 + 1.6, 0], size: [0.6, ROOF - 3.2, 3], visible: false, restitution: 0.3 });
    }
    // Glass he can't see: a lid on top, and front and back panes keeping him in line.
    const glass = (pos, half) => {
      const b = w.fixedBody(pos, new THREE.Quaternion());
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(...half).setRestitution(0.3).setCollisionGroups(groups(Group.WORLD)), b, { kind: 'static', material: 'glass' });
    };
    glass([0, ROOF + 0.5, 0], [HALF + 3, 0.5, 3]);
    glass([0, ROOF / 2, 1.6], [HALF + 3, ROOF, 0.2]);
    glass([0, ROOF / 2, -1.6], [HALF + 3, ROOF, 0.2]);
    w.paint({ pos: [0, 0, 0], size: [HALF * 2, 2.6], color: 0xf2c230, opacity: 0.25 });
  }

  item(p) {
    const w = this.world;
    const y = p.y ?? 0;
    if (p.t === 'crates') {
      for (let i = 0; i < (p.n ?? 3); i++) w.crate({ pos: [p.x, y + 0.45 + i * 0.9, 0], size: 0.9, kind: p.metal ? 'metal' : 'crate' });
    } else if (p.t === 'container') w.container({ pos: [p.x, y, 0], yaw: 90, color: p.color ?? 'steelGrey' });
    else if (p.t === 'barrels') {
      for (let i = 0; i < (p.n ?? 2); i++) w.barrel({ pos: [p.x + i * 0.65, y + 0.45, 0], color: ['steelRed', 'steelBlue', 'steelGreen'][i % 3] });
    } else if (p.t === 'tnt') this.tnts.push({ prop: w.tnt({ pos: [p.x, y + 0.4, 0] }), alive: true });
    else if (p.t === 'spikes') this.spikes(p);
    else if (p.t === 'saw') {
      const { body } = w.saw({ pos: [p.x, p.y, 0], r: p.r ?? 0.8, amp: p.amp ?? 0, axis: p.axis ?? 'y', speed: p.speed ?? 1.4 });
      body.collider(0).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    } else if (p.t === 'press') this.press(p);
    else if (p.t === 'ball') this.wreckingBall(p);
    else if (p.t === 'gun') this.gun(p);
  }

  /** A strip of steel spikes along the floor (`side` 'floor'), a wall or the lid. */
  spikes({ x = 0, y = 0, w = 3, side = 'floor' }) {
    const count = Math.max(2, Math.round(w / 0.45));
    const cone = new THREE.ConeGeometry(0.16, 0.55, 10);
    const base = new THREE.BoxGeometry(w, 0.14, 0.9);
    this.world.disposables.push(cone);
    const g = new THREE.Group();
    g.add(this.world.mesh(base, 'darkSteel'));
    const tips = new THREE.InstancedMesh(cone, this.world.mesh(cone, 'steel').material, count * 2);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count * 2; i++) {
      const col = i % count;
      tips.setMatrixAt(i, m.makeTranslation(-w / 2 + (col + 0.5) * (w / count), 0.33, i < count ? -0.2 : 0.2));
    }
    tips.castShadow = true;
    g.add(tips);
    this.world.disposables.push({ dispose: () => tips.dispose() });
    const at = { floor: [x, y + 0.07, 0, 0], roof: [x, ROOF - 0.07, 0, Math.PI], left: [-HALF + 0.07, y, 0, -Math.PI / 2], right: [HALF - 0.07, y, 0, Math.PI / 2] }[side];
    g.position.set(at[0], at[1], at[2]);
    g.rotation.z = at[3];
    this.world.add(g);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), at[3]);
    const b = this.world.fixedBody([at[0], at[1], at[2]], q);
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, 0.3, 0.45).setTranslation(0, 0.25, 0).setCollisionGroups(groups(Group.WORLD)),
      b,
      { kind: 'spikes', material: 'metal' },
    );
  }

  /** A crusher that slams down from the lid and winds back up. */
  press({ x = 0, w = 2, period = 2.6, phase = 0 }) {
    const g = new THREE.Group();
    const plate = this.world.mesh(new THREE.BoxGeometry(w, 0.5, 1.2), 'hazard');
    const ram = this.world.mesh(new THREE.BoxGeometry(0.35, ROOF, 0.35), 'steel');
    ram.position.y = ROOF / 2 + 0.25;
    g.add(plate, ram);
    this.world.add(g);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, ROOF - 1, 0));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, 0.25, 0.6).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'press', material: 'metal' },
    );
    this.world.mover({
      body,
      object: g,
      fn: (t) => {
        // Hang, drop fast, hold, then wind slowly back up.
        const k = ((t + phase) % period) / period;
        const down = k < 0.4 ? 0 : k < 0.5 ? (k - 0.4) / 0.1 : k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
        return { pos: [x, ROOF - 1 - down * (ROOF - 1.6), 0] };
      },
    });
  }

  /** A steel ball on a chain, swinging across the pen. */
  wreckingBall({ x = 0, len = 5, swing = 1, speed = 1.3 }) {
    const top = ROOF;
    const g = new THREE.Group();
    const ball = this.world.mesh(new THREE.SphereGeometry(0.7, 24, 16), 'darkSteel');
    const chain = this.world.mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 6).translate(0, len / 2, 0), 'steel', { cast: false });
    g.add(ball, chain);
    this.world.add(g);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, top - len, 0));
    this.physics.createCollider(RAPIER.ColliderDesc.ball(0.7).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body, {
      kind: 'hazard',
      material: 'metal',
    });
    const spin = new THREE.Vector3(0, 0, 1);
    this.world.mover({
      body,
      object: g,
      fn: (t) => {
        const a = Math.sin(t * speed) * swing;
        const q = new THREE.Quaternion().setFromAxisAngle(spin, a);
        return { pos: [x + Math.sin(a) * len, top - Math.cos(a) * len, 0], rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
      },
    });
  }

  /** A turret on the wall that tracks him and fires steel slugs. */
  gun({ side = 1, y = 4, rate = 1.4 }) {
    const g = new THREE.Group();
    const mount = this.world.mesh(new THREE.BoxGeometry(0.5, 0.9, 0.9), 'darkSteel');
    const head = new THREE.Group();
    const housing = this.world.mesh(new THREE.SphereGeometry(0.42, 18, 12), 'steelRed');
    const barrel = this.world.mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.2, 12).rotateZ(Math.PI / 2).translate(-0.6, 0, 0), 'darkSteel');
    head.add(housing, barrel);
    head.position.x = -side * 0.35;
    g.add(mount, head);
    g.position.set(side * (HALF - 0.25), y, 0);
    if (side < 0) g.scale.x = -1;
    this.world.add(g);
    this.guns.push({ g, head, side, rate, t: rate * 0.8, at: new THREE.Vector3(side * (HALF - 0.9), y, 0) });
  }

  fire(gun) {
    const c = this.dummy.parts.chest.body.translation();
    const dir = _a.set(c.x - gun.at.x, c.y - gun.at.y, 0).normalize();
    const mesh = this.world.mesh(this.bulletGeo ??= new THREE.SphereGeometry(0.13, 10, 8), 'darkSteel', { cast: false });
    this.world.add(mesh);
    const body = this.world.dynamicBody([gun.at.x + dir.x * 0.3, gun.at.y + dir.y * 0.3, 0], new THREE.Quaternion(), { ccd: true });
    body.setGravityScale(0.15, true);
    body.setLinvel({ x: dir.x * BULLET_SPEED, y: dir.y * BULLET_SPEED, z: 0 }, true);
    const shot = { body, mesh, life: 2.5 };
    this.physics.createCollider(
      RAPIER.ColliderDesc.ball(0.13).setMass(3).setRestitution(0.2).setCollisionGroups(groups(Group.PROP)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'bullet', material: 'metal', shot },
    );
    this.physics.link(body, mesh);
    this.bullets.push(shot);
    this.fx.puff(_b.copy(gun.at).addScaledVector(dir, 0.5), { count: 4, size: 0.5, speed: 2, color: 0xffd9a0, life: 0.3 });
    this.audio.impact(0.7, 'metal');
    this.rig.shake(0.08);
  }

  // ---------- input ----------

  pointAt(p, out) {
    _ray.setFromCamera({ x: (p.px / p.w) * 2 - 1, y: -(p.py / p.h) * 2 + 1 }, this.stage.camera);
    if (!_ray.ray.intersectPlane(_plane, out)) return out;
    out.x = THREE.MathUtils.clamp(out.x, -HALF + 0.4, HALF - 0.4);
    out.y = THREE.MathUtils.clamp(out.y, 0.5, ROOF - 0.5);
    return out;
  }

  onPointerDown(p) {
    if (this.phase !== 'play') return;
    this.grab = true;
    this.pointAt(p, this.target);
    this.hud.clearHint();
    this.audio.click?.();
  }

  onPointerMove(p) {
    if (this.grab) this.pointAt(p, this.target);
  }

  onPointerUp() {
    if (!this.grab) return;
    this.grab = false;
    this.audio.whoosh(Math.min(1.4, this.dummy.speed() / 10));
  }

  // ---------- smashing ----------

  onImpact(a, b, force, strength) {
    const body = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!body) {
      this.checkTnt(a, b, strength);
      return;
    }
    const other = body === a ? b : a;
    if (other.prop && this.tnts.some((n) => n.prop === other.prop && n.alive) && strength > 0.15) this.tntHit(other.prop);
    const k = HURT[other.prop ? 'prop' : other.kind] ?? 0;
    if (!k) return;
    const v = this.dummy.parts[body.part]?.body.linvel();
    if (!v) return;
    const speed = Math.hypot(v.x, v.y, v.z);
    // Damage comes from how fast he's going when he hits; a slow lean against
    // something isn't a hit at all.
    if (speed < 3.5) return;
    this.hurt(body.part, (speed - 3) * 1.5 * k * (0.6 + strength * 0.4));
  }

  onContact(a, b) {
    // Blades and slugs hurt on touch, however gently he brushes them.
    for (const [x, y] of [[a, b], [b, a]]) {
      if (y.kind !== 'dummy') continue;
      if (x.kind === 'bullet') {
        x.shot.life = Math.min(x.shot.life, 0.05);
        this.hurt(y.part, 12, 'BANG!');
      } else if (x.kind === 'hazard' || x.kind === 'spikes' || x.kind === 'press') this.hurt(y.part, 6);
    }
  }

  checkTnt(a, b, strength) {
    if (strength < 0.3) return;
    for (const x of [a, b]) if (x.prop && this.tnts.some((n) => n.prop === x.prop && n.alive)) this.tntHit(x.prop);
  }

  tntHit(prop) {
    const n = this.tnts.find((t) => t.prop === prop && t.alive);
    if (n) n.hit = true;
  }

  explode(n) {
    n.alive = false;
    const t = n.prop.body.translation();
    const at = new THREE.Vector3(t.x, t.y, t.z);
    this.physics.removeBody(n.prop.body);
    n.prop.mesh.visible = false;
    this.world.props = this.world.props.filter((x) => x !== n.prop);
    const d = this.dummy.com(_a).distanceTo(at);
    this.blast(at, BLAST_R);
    if (d < BLAST_R) this.hurt('chest', 60 * (1 - d / BLAST_R) + 10, 'KABOOM!');
  }

  hurt(part, amount, label) {
    if (this.phase !== 'play' || amount < 1) return;
    const now = this.time;
    if (now - (this.lastHit[part] ?? -9) < HIT_GAP || now - (this.lastAny ?? -9) < ANY_GAP) return;
    this.lastHit[part] = now;
    this.lastAny = now;
    const dmg = Math.round(Math.min(amount, 70));
    this.hp -= dmg;
    this.biggest = Math.max(this.biggest, dmg);
    const at = this.dummy.partPosition(part in this.dummy.parts ? part : 'chest', _b);
    this.fx.text(at.clone().add(_a.set(0, 0.6, 0)), label && dmg >= 10 ? `${label} -${dmg}` : `-${dmg}`, { color: dmg >= 25 ? '#ff4a3d' : '#ffd23a', size: 22 + Math.min(24, dmg * 0.5) });
    this.fx.chips(at, { count: 4 + Math.round(dmg / 4), colors: [this.suitColor(), 0xffffff], size: 0.06, speed: 3 + dmg / 10, life: 0.7 });
    this.hud.meter('Ragdoll', Math.max(0, this.hp) / this.maxHp, this.hp < this.maxHp * 0.3);
    if (dmg >= 20) {
      this.rig.shake(Math.min(0.6, dmg / 80));
      this.slowmoT = 0.12;
      this.dummy.knockOut(0.5, 0.6);
    }
    if (this.hp <= 0) this.smashed();
  }

  suitColor() {
    return new THREE.Color((SUITS[this.game.save.data.suit] ?? SUITS.red).body).getHex();
  }

  /** Health gone: he comes apart at every joint. */
  smashed() {
    this.phase = 'end';
    this.passed = true;
    this.endT = 2.6;
    this.grab = false;
    const c = this.dummy.com(new THREE.Vector3());
    this.dummy.ragdoll.breakApart(7);
    this.fx.chips(c, { count: 60, colors: [this.suitColor(), 0xffffff, 0xffd23a], size: 0.1, speed: 9, life: 1.6 });
    this.fx.puff(c, { count: 16, size: 1.2, speed: 3, color: 0xffffff, up: 1, life: 1.2 });
    this.fx.confetti(c.clone().add(_a.set(0, 1.5, 0)), 140);
    this.audio.crack();
    this.audio.boom();
    this.audio.win();
    this.rig.shake(0.7);
    this.rig.kick(8);
    this.slowmoT = 0.6;
    this.hud.goal('');
    this.game.ui.banner('SMASHED!', 'He came apart!');
  }

  fixedUpdate(dt) {
    const d = this.dummy;
    if (!d.ragdoll.broken) {
      const c = d.com(_a);
      d.ragdoll.addVelocity({ x: 0, y: 0, z: -c.z * 3 * dt });
      if (this.grab && this.phase === 'play') {
        // Hauled toward your finger by the chest; the rest of him trails along.
        for (const name of ['chest', 'pelvis']) {
          const body = d.parts[name].body;
          const t = body.translation();
          const off = name === 'chest' ? 0 : -0.45;
          _b.set(this.target.x - t.x, this.target.y + off - t.y, -t.z).multiplyScalar(9);
          if (_b.length() > GRAB_SPEED) _b.setLength(GRAB_SPEED);
          const lv = body.linvel();
          body.setLinvel({ x: lv.x + (_b.x - lv.x) * 0.35, y: lv.y + (_b.y - lv.y) * 0.35, z: _b.z }, true);
        }
      }
    }
    for (const n of this.tnts) if (n.alive && n.hit) this.explode(n);
    if (this.phase !== 'play') return;
    for (const gun of this.guns) {
      gun.t -= dt;
      if (gun.t <= 0) {
        gun.t = gun.rate;
        this.fire(gun);
      }
    }
  }

  tick(dt) {
    this.slowmoT = Math.max(0, (this.slowmoT ?? 0) - dt / (this.slowmo || 1));
    this.slowmo = this.slowmoT > 0 ? 0.3 : 1;
    this.cameraFor();
    const c = this.dummy.parts.chest.body.translation();
    for (const gun of this.guns) gun.head.rotation.z = Math.atan2(-(c.y - gun.at.y), -(c.x - gun.at.x) * gun.side);
    for (const shot of this.bullets) {
      shot.life -= dt;
      if (shot.life <= 0 && !shot.gone) {
        shot.gone = true;
        this.physics.removeBody(shot.body);
        shot.mesh.visible = false;
      }
    }
    this.bullets = this.bullets.filter((s) => !s.gone);
    if (this.phase === 'play') {
      this.left -= dt;
      this.hud.set('time', Math.max(0, Math.ceil(this.left)));
      if (this.left <= 0) {
        this.phase = 'end';
        this.passed = false;
        this.endT = 1.2;
        this.grab = false;
        this.audio.lose();
        this.game.ui.banner("TIME'S UP!", 'He survived this time');
      }
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  /** Fifteen more seconds to finish him off. */
  revive() {
    this.left = 15;
    this.phase = 'play';
  }

  complete() {
    this.phase = 'done';
    const time = this.def.time ?? 45;
    const spare = Math.max(0, this.left) / time;
    const stars = !this.passed ? 0 : spare >= 0.45 ? 3 : spare >= 0.2 ? 2 : 1;
    this.finish({
      passed: this.passed,
      stars,
      score: this.passed ? 1500 + Math.round(Math.max(0, this.left) * 40) + this.biggest * 5 : Math.round((1 - this.hp / this.maxHp) * 800),
      reason: 'Fling him into the dangerous stuff to empty his health bar.',
      stats: [
        ['Health left', `${Math.max(0, Math.round(this.hp))}`],
        ['Biggest hit', `${this.biggest}`],
        ['Time left', `${Math.max(0, Math.ceil(this.left))}s`],
      ],
    });
  }

  cameraFor(snap = false) {
    // Landscape takes in the whole pen; on a tall screen it follows him
    // across a window two-thirds as wide.
    const portrait = this.stage.width < this.stage.height;
    let x0 = -HALF - 0.6;
    let x1 = HALF + 0.6;
    let y0 = portrait ? -0.8 : -1.8;
    let y1 = ROOF;
    if (this.dummy.ragdoll.broken) {
      // Zoom in on the pieces.
      const c = this.dummy.parts.pelvis.body.translation();
      x0 = c.x - 3;
      x1 = c.x + 3;
      y0 = Math.max(-1, c.y - 2.5);
      y1 = y0 + 4.5;
    } else if (portrait) {
      const span = 8;
      const cx = THREE.MathUtils.clamp(this.dummy.parts.chest.body.translation().x, x0 + span / 2, x1 - span / 2);
      x0 = cx - span / 2;
      x1 = cx + span / 2;
    }
    const { pos, look } = this.frameBox(_a.set(x0, y0, -0.5), _b.set(x1, y1, 0.5), { pitch: 8, margin: 0.94 });
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 4);
    this.stage.focusShadows(look, 14);
  }
}
