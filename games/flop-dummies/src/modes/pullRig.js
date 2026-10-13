import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups, STEP } from '../physics/physics.js';
import { Mat } from '../render/materials.js';

const DEPTH = 1.6;
const PIN_R = 0.11;
const SLIDE = 0.4; // seconds for a pin to slide out
const D2R = Math.PI / 180;
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Pull Rig: a pull-the-pin puzzle, side on. Tap pins to slide them out and
 * get the dummy down to the safe zone — in the right order, or he gets
 * sawn, spiked or flattened on the way.
 */
export class PullRigLevel extends Level {
  setup() {
    const def = this.def;
    this.pins = [];
    this.panes = [];
    this.pulls = 0;
    this.log = [];
    this.focus = -1;
    this.phase = 'play';
    this.settle = 0;
    this.idle = 0;

    this.yard({ fences: true, extent: 40 });
    this.frame();
    for (const s of def.walls) this.wall(...s);
    for (const p of def.pins) this.addPin(p);
    for (const s of def.spikes ?? []) this.spikes(s);
    for (const g of def.glass ?? []) this.pane(g);
    for (const s of def.saws ?? []) this.world.saw({ pos: [s.x, s.y, 0], r: s.r ?? 0.6, amp: s.amp ?? 0, axis: s.axis ?? 'y' });
    for (const c of def.crates ?? []) this.world.crate({ pos: [c.x, c.y + (c.size ?? 1.4) / 2, 0], size: [c.size ?? 1.4, c.size ?? 1.4, 1.3], mass: 60 });
    for (const b of def.balls ?? []) this.world.ball({ pos: [b.x, b.y + 0.55, 0], r: 0.55 });
    this.goalZone(def.goal);

    const [x, y] = def.dummy;
    this.dummy = this.spawnDummy({ position: [x, y + 0.02, 0], yaw: def.facing ?? 0, pose: 'ready', muscle: 1 });
    this.dummy.balance = 1;
    this.standing = true;

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'pulls', icon: 'target', value: '0' },
        { id: 'best', icon: 'star', value: `${def.best}` },
      ],
    });
    this.hud.hint(def.hint ?? 'Tap a pin to pull it · get him to the green zone');
    this.cameraFit(true);
  }

  /** Back panel and an invisible front pane keep everything in one plane. */
  frame() {
    const [x0, y0, x1, y1] = this.def.view;
    const w = x1 - x0 + 2;
    const h = y1 - Math.max(0, y0) + 1;
    const cx = (x0 + x1) / 2;
    this.world.block({ pos: [cx, h / 2, -DEPTH / 2 - 0.15], size: [w, h, 0.3], mat: 'wall', tile: 2.5 });
    this.world.block({ pos: [cx, h / 2, DEPTH / 2 + 0.15], size: [w, h, 0.3], visible: false });
  }

  wall(x1, y1, x2, y2, thick = 0.3) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1) / D2R;
    // Polished chutes: whatever lands on a slope should slide off it.
    this.world.block({ pos: [(x1 + x2) / 2, (y1 + y2) / 2, 0], size: [len + thick, thick, DEPTH], rot: [0, 0, ang], mat: 'steelBlue', tile: 1.5, friction: 0.15, slick: true });
  }

  addPin({ from, to }) {
    const a = new THREE.Vector3(from[0], from[1], 0);
    const b = new THREE.Vector3(to[0], to[1], 0);
    const len = a.distanceTo(b);
    const dir = _v.copy(a).sub(b).normalize().clone(); // the way it slides out
    const centre = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().negate());

    const g = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(PIN_R, PIN_R, len, 14);
    rodGeo.rotateZ(Math.PI / 2);
    const rod = new THREE.Mesh(rodGeo, Mat.steel());
    rod.castShadow = true;
    const ringGeo = new THREE.TorusGeometry(0.26, 0.07, 10, 24);
    const handle = new THREE.Mesh(ringGeo, Mat.gold());
    handle.position.x = -len / 2 - 0.3;
    handle.castShadow = true;
    this.world.disposables.push(rodGeo, ringGeo);
    g.add(rod, handle);
    this.world.add(g);

    const body = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(centre.x, centre.y, 0).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(len / 2, PIN_R, DEPTH / 2)
        .setFriction(0.05)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'static', material: 'metal' },
    );
    this.physics.link(body, g);
    this.pins.push({ a, b, dir, centre, len, body, g, handle, pulled: false, t: 0 });
  }

  spikes({ x, y, w }) {
    const n = Math.max(3, Math.round(w / 0.32));
    const geo = new THREE.ConeGeometry(0.13, 0.5, 8);
    const base = this.world.mesh(new THREE.BoxGeometry(w, 0.12, DEPTH), 'darkSteel');
    base.position.set(x, y + 0.06, 0);
    this.world.add(base);
    for (let i = 0; i < n; i++) {
      for (const z of [-0.45, 0, 0.45]) {
        const c = new THREE.Mesh(geo, Mat.saw());
        c.position.set(x - w / 2 + (i + 0.5) * (w / n), y + 0.37, z + (i % 2 ? 0.15 : -0.15));
        c.castShadow = true;
        this.world.add(c);
      }
    }
    this.world.disposables.push(geo);
    const body = this.world.fixedBody([x, y + 0.3, 0], new THREE.Quaternion());
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, 0.3, DEPTH / 2).setFriction(0.9).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'hazard', material: 'metal', label: 'SPIKED!' },
    );
  }

  /** Glass shelf: holds a dummy, but a wrecking ball goes straight through. */
  pane({ x, y, w }) {
    const mesh = this.world.mesh(new THREE.BoxGeometry(w, 0.12, DEPTH), 'glass', { cast: false });
    mesh.position.set(x, y, 0);
    this.world.add(mesh);
    const body = this.world.fixedBody([x, y, 0], new THREE.Quaternion());
    const collider = this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, 0.06, DEPTH / 2).setFriction(0.5).setCollisionGroups(groups(Group.WORLD)),
      body,
      { kind: 'glass', material: 'glass' },
    );
    this.panes.push({ mesh, body, collider, x, y, w, broken: false });
  }

  goalZone({ x, y, w, h = 2, pad = true }) {
    this.goal = new THREE.Box3(new THREE.Vector3(x - w / 2, y, -1), new THREE.Vector3(x + w / 2, y + h, 1));
    const mat = new THREE.MeshBasicMaterial({ color: 0x3ad16b, transparent: true, opacity: 0.18, depthWrite: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH * 0.98), mat);
    box.position.set(x, y + h / 2, 0);
    this.world.add(box);
    this.world.disposables.push(box.geometry, mat);
    this.goalMesh = box;
    if (pad) this.world.block({ pos: [x, y - 0.05, 0], size: [w, 0.1, DEPTH], mat: 'glowGreen', tile: 0 });
  }

  cameraFit(snap = false) {
    const [x0, y0, x1, y1] = this.def.view;
    const cam = this.stage.camera;
    const t = Math.tan((cam.fov * D2R) / 2);
    const W = x1 - x0;
    const H = y1 - y0;
    const dist = Math.max(H / 2 / t, W / 2 / (t * cam.aspect)) * 1.08 + DEPTH / 2;
    const look = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const pos = look.clone().add(new THREE.Vector3(0, 0.6, dist));
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 3);
    this.stage.focusShadows(look, Math.max(W, H) * 0.7);
  }

  /** Pin nearest the tap on screen, within a forgiving radius. */
  pickPin(p) {
    const cam = this.stage.camera;
    const s = Math.min(p.w, p.h);
    let best = null;
    let bestD = s * 0.09;
    for (const pin of this.pins) {
      if (pin.pulled) continue;
      _a.copy(pin.a).project(cam);
      _b.copy(pin.b).project(cam);
      const ax = ((_a.x + 1) / 2) * p.w;
      const ay = ((1 - _a.y) / 2) * p.h;
      const bx = ((_b.x + 1) / 2) * p.w;
      const by = ((1 - _b.y) / 2) * p.h;
      const dx = bx - ax;
      const dy = by - ay;
      const k = THREE.MathUtils.clamp(((p.px - ax) * dx + (p.py - ay) * dy) / (dx * dx + dy * dy || 1), -0.15, 1);
      const d = Math.hypot(p.px - (ax + dx * k), p.py - (ay + dy * k));
      if (d < bestD) {
        bestD = d;
        best = pin;
      }
    }
    return best;
  }

  onPointerDown(p) {
    if (this.phase !== 'play') return;
    const pin = this.pickPin(p);
    if (pin) this.pull(pin);
  }

  onKeyDown(code) {
    if (this.phase !== 'play') return;
    const open = this.pins.filter((p) => !p.pulled);
    if (!open.length) return;
    if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Tab') {
      const i = open.indexOf(this.pins[this.focus]);
      const step = code === 'ArrowLeft' ? -1 : 1;
      this.focus = this.pins.indexOf(open[(i + step + open.length) % open.length]);
      return true;
    }
    if (code === 'Space' || code === 'Enter') {
      const pin = this.pins[this.focus] && !this.pins[this.focus].pulled ? this.pins[this.focus] : open[0];
      this.pull(pin);
      this.focus = -1;
    }
  }

  pull(pin, quiet = false) {
    pin.pulled = true;
    pin.t = 0;
    this.pulls++;
    this.log.push({ i: this.pins.indexOf(pin), t: this.physics.time });
    this.idle = 0;
    this.hud.set('pulls', this.pulls);
    this.hud.bump('pulls');
    this.hud.clearHint();
    // Anything resting on a pin may have fallen asleep; it has to notice the pin going.
    for (const p of this.world.props) p.body.wakeUp();
    this.dummy.ragdoll.forEachBody((b) => b.wakeUp());
    if (quiet) return;
    this.audio.noise(0.25, { freq: 2600, q: 2, gain: 0.25, sweep: 0.5 });
    this.audio.click();
    this.fx.puff(pin.a, { count: 3, color: 0xffffff, size: 0.3 });
  }

  fixedUpdate(dt) {
    for (const pin of this.pins) {
      if (!pin.pulled || pin.t >= SLIDE) continue;
      pin.t = Math.min(SLIDE, pin.t + dt);
      const k = pin.t / SLIDE;
      const e = k * k * (3 - 2 * k);
      const at = _v.copy(pin.centre).addScaledVector(pin.dir, e * (pin.len + 0.4));
      pin.body.setNextKinematicTranslation({ x: at.x, y: at.y, z: 0 });
    }
  }

  onContact(a, b) {
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!dummy) return;
    const other = dummy === a ? b : a;
    if (other.kind === 'hazard') this.die(other.label ?? 'OUCH!');
  }

  onImpact(a, b, force, strength) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.kind === 'glass' && y.prop?.kind === 'ball') this.shatter(x);
      if (x.kind === 'dummy' && y.prop?.kind === 'ball' && strength > 0.3) {
        const v = y.prop.body.linvel();
        if (Math.hypot(v.x, v.y, v.z) > 2.5) this.die('FLATTENED!');
      }
    }
  }

  shatter(info) {
    const pane = this.panes.find((p) => !p.broken && this.physics.info(p.collider.handle) === info);
    if (!pane) return;
    pane.broken = true;
    this.physics.removeBody(pane.body);
    pane.mesh.visible = false;
    const at = new THREE.Vector3(pane.x, pane.y, 0);
    this.fx.chips(at, { count: 40, colors: [0xbfe6ff, 0xe6f6ff, 0x9fc6d6], size: 0.07, speed: 4, floor: 0 });
    this.audio.impact(1, 'glass');
    this.rig.shake(0.25);
  }

  die(label) {
    if (this.phase !== 'play') return;
    this.phase = 'dead';
    this.endT = 1.8;
    this.dummy.balance = 0;
    this.dummy.setPose('starfish');
    this.dummy.knockOut(5, 3);
    const at = this.dummy.com();
    this.fx.chips(at, { count: 24, colors: [0xf2b705, 0x16161a, 0xffffff], size: 0.06, speed: 5, floor: 0 });
    this.fx.puff(at, { count: 8, size: 0.6 });
    this.audio.saw();
    this.audio.impact(1, 'body');
    this.rig.shake(0.5);
    this.game.ui.banner(label, 'Tap retry and try another order');
  }

  win() {
    this.phase = 'won';
    this.endT = 2;
    this.goalMesh.material.opacity = 0.35;
    const at = this.dummy.com().add(new THREE.Vector3(0, 0.8, 0));
    this.fx.confetti(at, 120);
    this.audio.win();
    this.game.ui.banner(this.pulls <= this.def.best ? 'PERFECT!' : 'SAFE!', `${this.pulls} ${this.pulls === 1 ? 'pull' : 'pulls'}`);
    this.dummy.balance = 0.6;
    this.dummy.setMuscle(1);
    this.dummy.setPose('cheer');
  }

  tick(dt) {
    this.cameraFit();
    for (let i = 0; i < this.pins.length; i++) {
      const pin = this.pins[i];
      const hot = i === this.focus && !pin.pulled;
      pin.handle.material = hot ? Mat.glowGreen() : Mat.gold();
      pin.handle.rotation.y = pin.pulled ? 0 : Math.sin(this.time * 3 + i) * 0.25;
    }
    if (this.phase === 'play') {
      const d = this.dummy;
      // Standing until the floor goes; then he's just cargo.
      if (this.standing && d.velocity(_v).y < -1.5) {
        this.standing = false;
        // Arms in: he drops like a sack, which keeps the rigs fair.
        d.balance = 0;
        d.setPose('tuck');
        d.setMuscle(0.6);
        this.audio.whoosh(0.6);
      }
      const pelvis = d.partPosition('pelvis');
      const quiet = d.speed() < 0.5;
      this.settle = quiet && this.goal.containsPoint(pelvis) ? this.settle + dt : 0;
      if (this.settle > 0.7) this.win();
      if (pelvis.y < -3) this.die('LOST!');
      // Nothing left to pull and he's come to rest somewhere else.
      this.idle = quiet && this.pins.every((p) => p.pulled) ? this.idle + dt : 0;
      if (this.idle > 2.5) this.die('STUCK!');
    }
    if (this.phase === 'dead' || this.phase === 'won') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete(this.phase === 'won');
    }
  }

  /**
   * Rewinds to the moment before the fatal pull: the rig is rebuilt and the
   * earlier pulls are replayed at their original physics times. The
   * simulation is deterministic, so everything lands exactly where it was.
   */
  revive() {
    const replay = this.log.slice(0, -1);
    const until = this.log.at(-1)?.t ?? 0;
    this.rebuild();
    let k = 0;
    while (this.physics.time < until - 1e-6) {
      while (k < replay.length && replay[k].t <= this.physics.time + 1e-6) this.pull(this.pins[replay[k++].i], true);
      this.fixedUpdate(STEP);
      this.physics.step();
      this.update(STEP);
    }
    this.physics.snapAll();
    this.hud.hint('Rewound — try a different pin');
  }

  complete(passed) {
    this.phase = 'done';
    const best = this.def.best;
    const stars = !passed ? 0 : this.pulls <= best ? 3 : this.pulls === best + 1 ? 2 : 1;
    this.finish({
      passed,
      stars,
      score: passed ? 1000 + Math.max(0, best + 2 - this.pulls) * 400 : 0,
      reason: 'Get him to the green zone in one piece.',
      stats: [
        ['Pins pulled', `${this.pulls}`],
        ['Fewest possible', `${best}`],
      ],
    });
  }
}
