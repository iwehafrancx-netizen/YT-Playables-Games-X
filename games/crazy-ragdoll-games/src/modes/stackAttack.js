import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { SUITS } from '../dummy/dummyView.js';

const SUIT_IDS = Object.keys(SUITS);
const CHEST = { x: 0, y: 0.17, z: 0 }; // top of the chest, in its local frame
const SET_SPEED = 0.9; // below this a landed ragdoll starts to set
const SET_TIME = 0.3;
const _a = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Stack Attack: a crane swings ragdolls over a podium. Tap to let go and pile
 * them up past the line before you run out. Each one lands floppy, then sets
 * solid where it came to rest, so the tower is exactly as good as your drops.
 */
export class StackAttackLevel extends Level {
  setup() {
    const def = this.def;
    this.left = def.dummies ?? 6;
    this.used = 0;
    this.goal = def.goal ?? 3.4;
    this.best = 0;
    this.height = 0;
    this.statues = [];
    this.phase = 'play';
    this.craneT = 0;
    this.carried = null;
    this.waitT = 0.4;
    this.spin = 0;

    this.scenery();
    this.clutter([[-4.6, 1.2], [4.8, 0.8], [-3.6, -3.4], [3.9, -3.2], [0.4, -5]]);
    this.podium();
    this.crane();
    def.build?.(this.world, this);

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'left', icon: 'dummy', value: this.left },
        { id: 'height', icon: 'target', value: `0.0/${this.goal.toFixed(1)}m` },
      ],
    });
    this.hud.hint(def.hint ?? 'Tap to drop · stack them up past the line');
    this.cameraFor(true);
  }

  podium() {
    const def = this.def;
    const [w, d] = def.base ?? [2.6, 1.6];
    this.baseSize = [w, d];
    this.baseTop = def.baseHeight ?? 1;
    const h = this.baseTop;
    const g = new THREE.Group();
    const top = this.world.mesh(new THREE.BoxGeometry(w, h, d), def.baseMat ?? 'toyBlue');
    top.position.y = -h / 2;
    const rim = this.world.mesh(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08), 'toyDark', { cast: false });
    rim.position.y = -0.05;
    g.add(top, rim);
    this.world.add(g);
    // A turning podium is a kinematic body; a fixed one never moves.
    this.turn = def.turn ?? 0;
    const desc = this.turn ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    this.podiumBody = this.physics.createBody(desc.setTranslation(0, h, 0));
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(0, -h / 2, 0).setFriction(1.2).setCollisionGroups(groups(Group.WORLD)),
      this.podiumBody,
      { kind: 'static', material: 'rubber' },
    );
    // A low lip round the edge catches limbs that would otherwise slide off.
    for (const [x, z, hx, hz] of [[0, d / 2, w / 2, 0.05], [0, -d / 2, w / 2, 0.05], [w / 2, 0, 0.05, d / 2], [-w / 2, 0, 0.05, d / 2]]) {
      this.physics.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, 0.09, hz).setTranslation(x, 0.09, z).setFriction(1.2).setCollisionGroups(groups(Group.WORLD)),
        this.podiumBody,
      );
      const lip = this.world.mesh(new THREE.BoxGeometry(hx * 2 + 0.02, 0.18, hz * 2 + 0.02), 'toyDark', { cast: false });
      lip.position.set(x, 0.09, z);
      g.add(lip);
    }
    this.physics.link(this.podiumBody, g);

    // The finish line: a dashed band floating at goal height.
    const lineGeo = new THREE.PlaneGeometry(Math.max(w, 3) + 3, 0.12);
    const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xef4b3c, transparent: true, opacity: 0.85, depthWrite: false }));
    line.position.set(0, this.goal, 0.9);
    const flagGeo = new THREE.PlaneGeometry(Math.max(w, 3) + 3, 1.2);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ color: 0xef4b3c, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
    flag.position.set(0, this.goal - 0.6, 0);
    this.world.disposables.push(lineGeo, line.material, flagGeo, flag.material);
    this.world.add(line, flag);
    this.goalLine = line;
  }

  crane() {
    const def = this.def;
    const w = this.world;
    this.span = def.span ?? 2.6;
    this.railY = this.goal + (def.drop ?? 3.3);
    for (const x of [-this.span - 2, this.span + 2]) {
      const post = w.mesh(new THREE.BoxGeometry(0.3, this.railY + 0.4, 0.3), 'toyYellow');
      post.position.set(x, (this.railY + 0.4) / 2, -1.2);
      w.add(post);
    }
    const rail = w.mesh(new THREE.BoxGeometry(this.span * 2 + 4.6, 0.3, 0.3), 'toyYellow');
    rail.position.set(0, this.railY + 0.4, -1.2);
    const arm = w.mesh(new THREE.BoxGeometry(this.span * 2 + 4.6, 0.12, 1.4), 'toyDark', { cast: false });
    arm.position.set(0, this.railY + 0.55, -0.5);
    w.add(rail, arm);

    const g = new THREE.Group();
    const cab = w.mesh(new THREE.BoxGeometry(0.8, 0.45, 0.8), 'toyRed');
    const claw = w.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), 'toyDark');
    claw.position.y = -0.45;
    const jaw = w.mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 16, Math.PI), 'toyDark');
    jaw.position.y = -0.7;
    jaw.rotation.z = Math.PI;
    g.add(cab, claw, jaw);
    w.add(g);
    this.hook = this.physics.createBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, this.railY, 0));
    this.physics.link(this.hook, g);
  }

  hookX() {
    const def = this.def;
    const speed = def.speed ?? 1.1;
    // Ping-pong with ease at the ends, like a real gantry.
    return Math.sin(this.craneT * speed) * this.span;
  }

  load() {
    const x = this.hookX();
    const d = this.spawnDummy({
      position: [x, this.railY - 0.75 - 0.12 - 1.41, 0],
      yaw: 0,
      pose: 'hang',
      muscle: 0.7,
      // Each ragdoll on the pile in a different colour, starting with yours.
      suit: SUIT_IDS[(SUIT_IDS.indexOf(this.game.save.data.suit) + this.used + SUIT_IDS.length) % SUIT_IDS.length],
    });
    // Held by the scruff on a short rope: pinning the hands to a moving crane
    // fights the arm limits and shakes the body apart.
    const joints = [this.physics.world.createImpulseJoint(RAPIER.JointData.rope(0.12, { x: 0, y: -0.75, z: 0 }, CHEST), this.hook, d.parts.chest.body, true)];
    this.carried = { d, joints };
    this.physics.snapAll();
  }

  drop() {
    if (!this.carried || this.phase !== 'play') return;
    const { d, joints } = this.carried;
    for (const j of joints) this.physics.world.removeImpulseJoint(j, true);
    // It drops more or less straight down from where it is: carrying the
    // crane's full sideways speed would fling even a perfect drop off the podium.
    const v = d.velocity(_a);
    d.ragdoll.addVelocity({ x: -v.x * 0.75, y: 0, z: -v.z * 0.75 });
    // Curled up they make chunky building blocks; spread out they make a rug.
    d.setPose('tuck');
    d.setMuscle(0.8);
    d.lively = 0.5;
    d.dropped = this.time;
    this.carried = null;
    this.left--;
    this.used++;
    this.hud.set('left', this.left);
    this.hud.bump('left');
    this.hud.clearHint();
    this.audio.whoosh(0.7);
    this.waitT = this.def.reload ?? 1.1;
  }

  onPointerDown() {
    this.drop();
  }

  onKeyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowDown') this.drop();
  }

  onImpact(a, b, force, strength) {
    const info = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    const d = info && this.dummyFor(info);
    if (d && d.dropped && strength > 0.15 && !d.flopped) this.flop(d);
  }

  /** First real landing: they go floppy and heavy, which is what makes them stack. */
  flop(d) {
    d.flopped = true;
    // Once he's landed, holding still is what lets him set into the tower.
    d.lively = 0;
    d.setMuscle(0.6);
    d.ragdoll.forEachBody((body) => {
      body.setLinearDamping(4);
      body.setAngularDamping(4);
    });
    this.fx.puff(d.com(), { count: 4, size: 0.5, color: 0xffffff });
  }

  onPodium(p, margin = 0.9) {
    const [w, dd] = this.baseSize;
    return Math.abs(p.x) < w / 2 + margin && Math.abs(p.z) < dd / 2 + margin && p.y > this.baseTop - 0.2;
  }

  /** A landed ragdoll that has come to rest on the pile sets solid. */
  settle(d, dt) {
    d.stillT = d.speed() < SET_SPEED ? (d.stillT ?? 0) + dt : 0;
    d.landedT = (d.landedT ?? 0) + dt;
    if (d.stillT < SET_TIME && d.landedT < 4) return;
    const c = d.com(_a);
    // Off the podium and below its top: he missed. Draped over the edge of the
    // pile counts as part of it.
    if (!this.onPodium(c) && c.y < this.baseTop - 0.3) {
      d.lost = true;
      this.fx.text(c.clone().add(new THREE.Vector3(0, 1, 0)), 'MISSED!', { color: '#ff7a6b', size: 24 });
      return;
    }
    d.frozen = true;
    d.ragdoll.freeze(!!this.turn);
    if (this.turn) {
      // Remember where each part sits on the turntable, to carry it round.
      _q.setFromAxisAngle(_a.set(0, 1, 0), -this.spin);
      d.ragdoll.forEachBody((body) => {
        const t = body.translation();
        const r = body.rotation();
        this.statues.push({
          body,
          p: new THREE.Vector3(t.x, t.y, t.z).applyQuaternion(_q),
          q: _q.clone().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w)),
        });
      });
    }
    let top = 0;
    d.ragdoll.forEachBody((body) => {
      const t = body.translation();
      if (this.onPodium(t, 1.3)) top = Math.max(top, t.y + 0.12);
    });
    const gain = top - this.height;
    this.height = Math.max(this.height, top);
    this.best = this.height;
    this.audio.impact(0.6, 'wood');
    this.fx.puff(c, { count: 6, size: 0.6, color: 0xffffff });
    if (gain > 0.05) this.fx.text(c.clone().add(new THREE.Vector3(0, 1.1, 0)), `+${gain.toFixed(1)}m`, { color: '#3c86e8', size: 26 });
  }

  fixedUpdate(dt) {
    if (this.phase === 'play' || this.phase === 'hold') this.craneT += dt;
    const x = this.hookX();
    this.hook.setNextKinematicTranslation({ x, y: this.railY, z: 0 });
    if (this.turn) {
      this.spin += this.turn * dt;
      _q.setFromAxisAngle(_a.set(0, 1, 0), this.spin);
      this.podiumBody.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    if (this.turn) {
      for (const s of this.statues) {
        const p = _a.copy(s.p).applyQuaternion(_q);
        s.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
        const r = _q.clone().multiply(s.q);
        s.body.setNextKinematicRotation({ x: r.x, y: r.y, z: r.z, w: r.w });
      }
    }
    const wind = this.def.wind ?? 0;
    for (const d of this.dummies) {
      if (!d.dropped || d.frozen || d.lost) continue;
      if (wind && d.com(_a).y > this.baseTop + 0.5) d.ragdoll.addVelocity({ x: wind * dt, y: 0, z: 0 });
      // A landing too soft to register as an impact still counts.
      if (!d.flopped && this.time - d.dropped > 2.5) this.flop(d);
      if (d.flopped) this.settle(d, dt);
    }
  }

  tick(dt) {
    this.cameraFor();
    if (this.phase === 'play' && !this.carried && this.left > 0) {
      this.waitT -= dt;
      if (this.waitT <= 0) this.load();
    }
    const h = this.height;
    this.hud.set('height', `${h.toFixed(1)}/${this.goal.toFixed(1)}m`);
    this.goalLine.material.opacity = h >= this.goal ? 0.85 + Math.sin(this.time * 18) * 0.15 : 0.85;

    if (this.phase === 'play') {
      if (h >= this.goal) this.win();
      // Out of ragdolls: once the last one has set or fallen, call it.
      const pending = this.dummies.some((d) => d.dropped && !d.frozen && !d.lost);
      if (this.left <= 0 && !this.carried && !pending && h < this.goal) {
        this.outT = (this.outT ?? 0) + dt;
        if (this.outT > 0.8) this.lose();
      }
    } else if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) this.complete();
    }
  }

  win() {
    this.phase = 'end';
    this.passed = true;
    this.endT = 1.6;
    this.audio.win();
    this.fx.confetti(new THREE.Vector3(0, this.goal, 0), 140);
    this.game.ui.banner('TOWER UP!', `${this.used} ragdoll${this.used === 1 ? '' : 's'}`);
  }

  lose() {
    this.phase = 'end';
    this.passed = false;
    this.endT = 0.6;
  }

  /** Two more ragdolls for the pile. */
  revive() {
    this.left += 2;
    this.outT = 0;
    this.phase = 'play';
    this.hud.set('left', this.left);
    this.waitT = 0.3;
  }

  complete() {
    this.phase = 'done';
    const spare = this.left;
    const stars = !this.passed ? 0 : spare >= 2 ? 3 : spare >= 1 ? 2 : 1;
    this.finish({
      passed: this.passed,
      stars,
      score: this.passed ? Math.round(this.best * 300 + spare * 600) : Math.round(this.best * 100),
      reason: `Stack them up to the ${this.goal.toFixed(1)} m line.`,
      stats: [
        ['Tower', `${this.best.toFixed(1)} m`],
        ['Ragdolls used', `${this.used}`],
      ],
    });
  }

  cameraFor(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const midY = (this.baseTop + this.railY) / 2;
    const look = new THREE.Vector3(0, midY - 0.4, 0);
    const pos = new THREE.Vector3(0, midY + (portrait ? 1.5 : 1), portrait ? 15 : 11.5);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2, 2);
    this.stage.focusShadows(look, 10);
  }
}
