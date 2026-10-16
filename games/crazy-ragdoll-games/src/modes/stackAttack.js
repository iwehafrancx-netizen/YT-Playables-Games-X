import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';
import { SUITS } from '../dummy/dummyView.js';

const SUIT_IDS = Object.keys(SUITS);
const HAND = { x: 0, y: -0.13, z: 0 }; // end of the forearm, in its local frame
const SETTLE_SPEED = 1;
const HOLD_TIME = 0.5; // seconds the tower has to stand at the line
const _a = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Stack Attack: a crane swings ragdolls over a podium. Tap to let go and pile
 * them up past the line before you run out. A floppy tower is still a tower.
 */
export class StackAttackLevel extends Level {
  setup() {
    const def = this.def;
    this.left = def.dummies ?? 6;
    this.used = 0;
    this.goal = def.goal ?? 3.4;
    this.best = 0;
    this.heldT = 0;
    this.phase = 'play';
    this.craneT = 0;
    this.carried = null;
    this.waitT = 0.4;
    this.spin = 0;

    this.studio();
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
      position: [x, this.railY - 2.85, 0],
      yaw: 0,
      pose: 'hang',
      muscle: 0.7,
      suit: SUIT_IDS[(this.used + (this.game.save.data.suit === 'classic' ? 0 : 1)) % SUIT_IDS.length],
    });
    const joints = ['lowerArmL', 'lowerArmR'].map((part) =>
      this.physics.world.createImpulseJoint(RAPIER.JointData.spherical({ x: 0, y: -0.75, z: 0 }, HAND), this.hook, d.parts[part].body, true),
    );
    this.carried = { d, joints };
    this.physics.snapAll();
  }

  drop() {
    if (!this.carried || this.phase !== 'play') return;
    const { d, joints } = this.carried;
    for (const j of joints) this.physics.world.removeImpulseJoint(j, true);
    // Curled up they make chunky building blocks; spread out they make a rug.
    d.setPose('tuck');
    d.setMuscle(0.8);
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
    if (d && d.dropped && strength > 0.15 && !d.flopped) {
      // First real landing: they go floppy and heavy, which is what makes them stack.
      d.flopped = true;
      d.setMuscle(0.6);
      d.ragdoll.forEachBody((body) => {
        body.setLinearDamping(4);
        body.setAngularDamping(4);
      });
      this.fx.puff(d.com(), { count: 4, size: 0.5, color: 0xffffff });
    }
  }

  /** Height of the pile: the highest settled part standing on the podium. */
  towerHeight() {
    const [w, dd] = this.baseSize;
    let top = 0;
    for (const d of this.dummies) {
      if (!d.dropped) continue;
      if (d.speed() > SETTLE_SPEED) continue;
      for (const name in d.parts) {
        const t = d.parts[name].body.translation();
        if (Math.abs(t.x) > w / 2 + 1.3 || Math.abs(t.z) > dd / 2 + 1.3) continue;
        top = Math.max(top, t.y + 0.1);
      }
    }
    return top;
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
    const wind = this.def.wind ?? 0;
    if (wind) {
      for (const d of this.dummies) if (d.dropped && d.com().y > this.baseTop + 0.5) d.ragdoll.addVelocity({ x: wind * dt, y: 0, z: 0 });
    }
  }

  tick(dt) {
    this.cameraFor();
    if (this.phase === 'play' && !this.carried && this.left > 0) {
      this.waitT -= dt;
      if (this.waitT <= 0) this.load();
    }
    const h = this.towerHeight();
    this.best = Math.max(this.best, h);
    this.hud.set('height', `${h.toFixed(1)}/${this.goal.toFixed(1)}m`);
    this.goalLine.material.opacity = h >= this.goal ? 0.85 + Math.sin(this.time * 18) * 0.15 : 0.85;

    if (this.phase === 'play') {
      if (h >= this.goal) {
        this.heldT += dt;
        if (this.heldT >= HOLD_TIME) this.win();
      } else this.heldT = 0;
      // Out of ragdolls: give the last one time to land, then call it.
      if (this.left <= 0 && !this.carried && h < this.goal) {
        const moving = this.dummies.some((d) => d.speed() > SETTLE_SPEED);
        this.outT = moving ? 0 : (this.outT ?? 0) + dt;
        if (this.outT > 1.2) this.lose();
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
