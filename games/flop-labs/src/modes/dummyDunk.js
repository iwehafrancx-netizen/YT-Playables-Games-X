import * as THREE from 'three';
import { Level } from './level.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const RIM_R = 1.15;
const LOFT = 55 * (Math.PI / 180);
const _v = new THREE.Vector3();

/**
 * Dummy Dunk: the dummy is the basketball. Flick up to shoot, steer with the
 * angle of the flick, and sink enough baskets before the shots run out.
 */
export class DummyDunkLevel extends Level {
  setup() {
    const def = this.def;
    this.hoops = [];
    this.shots = def.shots;
    this.need = def.need;
    this.taken = 0;
    this.made = 0;
    this.score = 0;
    this.power = 0;
    this.aimYaw = 0;

    this.yard({ fences: true, extent: 40 });
    this.court();
    for (const h of def.hoops) this.addHoop(h);
    def.build?.(this.world, this);
    this.makeArc();

    this.hud = this.game.ui.hud({
      title: this.hudTitle(),
      stats: [
        { id: 'made', icon: 'target', value: `0/${this.need}` },
        { id: 'shots', icon: 'dummy', value: this.shots },
        { id: 'score', icon: 'star', value: 0 },
      ],
    });
    this.hud.hint(def.hint ?? 'Flick up to shoot · flick at an angle to steer');
    this.nextShooter(true);
  }

  court() {
    const w = this.world;
    w.block({ pos: [0, 0.02, 8], size: [17, 0.04, 24], mat: 'asphalt', tile: 3, friction: 0.9 });
    for (const x of [-8.3, 8.3]) w.paint({ pos: [x, 0.04, 8], size: [0.12, 24], color: 0xf2f2ee });
    w.paint({ pos: [0, 0.04, -3.9], size: [16.6, 0.12], color: 0xf2f2ee });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.82, 48), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.045, 0);
    w.add(ring);
    w.disposables.push(ring.geometry, ring.material);
  }

  /** Backboard, rim and net. Moving hoops ride a kinematic body; the pole is just for looks. */
  addHoop({ x, z, y = 4.2, move }) {
    const w = this.world;
    const g = new THREE.Group();
    const back = RIM_R + 0.3;
    const board = w.mesh(new THREE.BoxGeometry(3.6, 2.4, 0.12), 'white');
    board.position.set(0, 0.8, back);
    const square = w.mesh(new THREE.BoxGeometry(1.5, 1.1, 0.02), 'steelRed', { cast: false });
    square.position.set(0, 0.55, back - 0.07);
    const rim = w.mesh(new THREE.TorusGeometry(RIM_R, 0.07, 10, 40), 'steelOrange');
    rim.rotation.x = Math.PI / 2;
    const bracket = w.mesh(new THREE.BoxGeometry(0.2, 0.12, 0.35), 'steelOrange');
    bracket.position.set(0, 0, RIM_R + 0.12);
    const netGeo = new THREE.CylinderGeometry(RIM_R, RIM_R * 0.6, 1.2, 16, 3, true);
    netGeo.translate(0, -0.6, 0);
    const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.75 }));
    w.disposables.push(netGeo, net.material);
    const pole = w.mesh(new THREE.CylinderGeometry(0.16, 0.2, y - 0.4, 12), 'steelGrey');
    pole.position.set(0, -(y - 0.4) / 2 - 0.4, back + 0.6);
    const arm = w.mesh(new THREE.BoxGeometry(0.2, 0.2, 0.7), 'steelGrey');
    arm.position.set(0, -0.3, back + 0.35);
    g.add(board, square, rim, bracket, net, pole, arm);
    w.add(g);

    const desc = move ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
    const body = this.physics.createBody(desc.setTranslation(x, y, z));
    const col = (d, info) => this.physics.createCollider(d.setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body, info);
    col(RAPIER.ColliderDesc.cuboid(1.8, 1.2, 0.06).setTranslation(0, 0.8, back).setRestitution(0.3), { kind: 'board', material: 'wood' });
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      col(RAPIER.ColliderDesc.ball(0.08).setTranslation(Math.cos(a) * RIM_R, 0, Math.sin(a) * RIM_R).setRestitution(0.4), { kind: 'rim', material: 'metal' });
    }
    const hoop = { body, g, net, base: new THREE.Vector3(x, y, z), swish: 0 };
    if (move) {
      const { dx = 0, dy = 0, speed = 1, phase = 0 } = move;
      w.mover({ body, object: g, fn: (t) => { const k = Math.sin(phase + t * speed); return { pos: [x + dx * k, y + dy * k, z] }; } });
    } else {
      g.position.set(x, y, z);
    }
    this.hoops.push(hoop);
  }

  makeArc() {
    const n = 26;
    const geo = new THREE.SphereGeometry(0.1, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false });
    this.dots = new THREE.InstancedMesh(geo, mat, n);
    this.dots.frustumCulled = false;
    this.dots.visible = false;
    this.world.add(this.dots);
    this.world.disposables.push(geo, mat);
  }

  spot() {
    const spots = this.def.spots ?? [this.def.spot ?? [0, 0]];
    return spots[this.taken % spots.length];
  }

  hoopPos(h, out = new THREE.Vector3()) {
    const t = h.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  nextShooter(snap = false) {
    // Keep the last couple of attempts lying around; older ones are cleared away.
    const old = this.dummies.filter((d) => d !== this.shooter);
    if (old.length >= 2) this.removeDummy(old[0]);
    const [x, z] = this.spot();
    const target = this.hoopPos(this.hoops[0]);
    this.baseYaw = Math.atan2(target.x - x, target.z - z);
    this.aimYaw = this.baseYaw;
    this.power = 0;
    this.from = new THREE.Vector3(x, 0, z);
    this.shooter = this.spawnDummy({ position: [x, 0.05, z], yaw: this.baseYaw, pose: 'ready', muscle: 1 });
    this.shooter.balance = 1;
    this.phase = 'aim';
    this.shot = null;
    this.aimCamera(snap);
  }

  aimCamera(snap = false) {
    const portrait = this.stage.width < this.stage.height;
    const fwd = _v.set(Math.sin(this.baseYaw), 0, Math.cos(this.baseYaw));
    const hoop = this.hoopPos(this.hoops[0]);
    const pos = this.from.clone().addScaledVector(fwd, portrait ? -8 : -6.5).add(new THREE.Vector3(0, portrait ? 3.6 : 3.2, 0));
    const look = this.from.clone().lerp(hoop, 0.65).setY(hoop.y * 0.75);
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 3, 3);
    this.stage.focusShadows(look, 16);
  }

  launchVelocity(out = new THREE.Vector3()) {
    const speed = 6 + this.power * 10;
    const loft = this.def.loft ? this.def.loft * (Math.PI / 180) : LOFT;
    const h = Math.cos(loft) * speed;
    return out.set(Math.sin(this.aimYaw) * h, Math.sin(loft) * speed, Math.cos(this.aimYaw) * h);
  }

  onPointerDown() {
    if (this.phase === 'aim') this.dragging = true;
  }

  onPointerMove(p, start) {
    if (!this.dragging || this.phase !== 'aim') return;
    const s = Math.min(p.w, p.h);
    const dx = (p.px - start.px) / s;
    const dy = -(p.py - start.py) / s;
    this.power = THREE.MathUtils.clamp((dy - 0.03) / 0.45, 0, 1);
    this.aimYaw = this.baseYaw + THREE.MathUtils.clamp(-dx * 0.9, -0.6, 0.6);
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.power < 0.05) {
      this.power = 0;
      this.aimYaw = this.baseYaw;
      return;
    }
    this.shoot();
  }

  onKeyDown(code) {
    if (this.phase !== 'aim') return;
    if (code === 'ArrowLeft') this.aimYaw = Math.min(this.baseYaw + 0.6, this.aimYaw + 0.03);
    if (code === 'ArrowRight') this.aimYaw = Math.max(this.baseYaw - 0.6, this.aimYaw - 0.03);
    if (code === 'ArrowUp') this.power = Math.min(1, this.power + 0.04);
    if (code === 'ArrowDown') this.power = Math.max(0, this.power - 0.04);
    this.keyAim = true;
    if ((code === 'Space' || code === 'Enter') && this.power > 0) this.shoot();
  }

  shoot() {
    this.phase = 'fly';
    this.keyAim = false;
    this.taken++;
    this.hud.set('shots', this.shots - this.taken);
    this.hud.clearHint();
    this.dots.visible = false;
    this.shot = { t: 0, settle: 0, made: false, rim: false, board: false };
    const d = this.shooter;
    d.balance = 0;
    d.setPose('tuck');
    d.setMuscle(0.8);
    d.ragdoll.addVelocity(this.launchVelocity(), 0);
    // Backspin, like a proper jump shot.
    const side = new THREE.Vector3(Math.cos(this.aimYaw), 0, -Math.sin(this.aimYaw));
    d.ragdoll.addSpin(side.multiplyScalar(-4));
    this.prevY = d.com().y;
    this.audio.whoosh(0.6 + this.power);
    this.audio.jump(true);
  }

  onContact(a, b) {
    if (!this.shot) return;
    const dummy = a.kind === 'dummy' ? a : b.kind === 'dummy' ? b : null;
    if (!dummy || dummy.ragdoll !== this.shooter.ragdoll) return;
    const other = dummy === a ? b : a;
    if (other.kind === 'rim') this.shot.rim = true;
    if (other.kind === 'board') this.shot.board = true;
  }

  /** A basket is the dummy's middle dropping down through the ring. */
  checkBasket(com) {
    for (const h of this.hoops) {
      const c = this.hoopPos(h, _v);
      if (this.prevY > c.y && com.y <= c.y && Math.hypot(com.x - c.x, com.z - c.z) < RIM_R * 0.9) return h;
    }
    return null;
  }

  scoreBasket(h) {
    const s = this.shot;
    s.made = true;
    s.madeAt = s.t;
    this.made++;
    let pts = 300;
    let label = 'BUCKET!';
    if (!s.rim && !s.board) {
      pts += 200;
      label = 'SWISH!';
    } else if (s.board) {
      pts += 100;
      label = 'BANK SHOT!';
    }
    this.score += pts;
    h.swish = 1;
    const at = this.hoopPos(h).add(new THREE.Vector3(0, 0.6, 0));
    this.fx.confetti(at, label === 'SWISH!' ? 120 : 70);
    this.fx.text(at.clone().add(new THREE.Vector3(0, 1, 0)), `${label} +${pts}`, { color: '#ffe066', size: 32, life: 1.4 });
    this.audio.cup();
    this.audio.ding(label === 'SWISH!' ? 4 : 2);
    this.rig.shake(0.15);
    this.hud.set('made', `${this.made}/${this.need}`);
    this.hud.set('score', this.score.toLocaleString());
    this.hud.bump('made');
  }

  updateArc() {
    const show = this.dragging || this.keyAim ? this.power > 0.02 : false;
    this.dots.visible = show;
    if (!show) return;
    const p = this.shooter.com();
    const v = this.launchVelocity();
    const reveal = this.def.arc ?? 0.6;
    const flight = (2 * v.y) / -this.gravity;
    const m = new THREE.Matrix4();
    const n = this.dots.count;
    for (let i = 0; i < n; i++) {
      const t = ((i + 1) / n) * flight * reveal;
      m.makeScale(1 - (i / n) * 0.5, 1 - (i / n) * 0.5, 1 - (i / n) * 0.5).setPosition(p.x + v.x * t, p.y + v.y * t + 0.5 * this.gravity * t * t, p.z + v.z * t);
      this.dots.setMatrixAt(i, m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }

  tick(dt) {
    for (const h of this.hoops) {
      h.swish = Math.max(0, h.swish - dt * 2.5);
      h.net.scale.set(1 - h.swish * 0.15, 1 + Math.sin(h.swish * 12) * 0.25 * h.swish, 1 - h.swish * 0.15);
    }

    if (this.phase === 'aim') {
      this.aimCamera();
      this.updateArc();
      const yaw = this.dragging || this.keyAim ? this.aimYaw : this.baseYaw;
      this.shooter.ragdoll.facing.set(Math.sin(yaw), 0, Math.cos(yaw));
      return;
    }

    if (this.phase === 'fly') {
      const s = this.shot;
      s.t += dt;
      const com = this.shooter.com();
      if (!s.made) {
        const h = this.checkBasket(com);
        if (h) this.scoreBasket(h);
      }
      this.prevY = com.y;
      const hoop = this.hoopPos(this.hoops[0]);
      const portrait = this.stage.width < this.stage.height;
      const look = com.clone().lerp(hoop, 0.5);
      this.rig.aim(this.from.clone().add(new THREE.Vector3(0, portrait ? 3.6 : 3.2, portrait ? -8 : -6.5)).lerp(com, 0.25), look, 2.5, 4);
      this.audio.loop('wind', Math.min(1, this.shooter.speed() / 14), 'wind');
      const quiet = com.y < 1.2 && this.shooter.speed() < 1.2;
      s.settle = quiet ? s.settle + dt : 0;
      if ((s.made && s.t - s.madeAt > 1.1) || s.settle > 0.4 || s.t > 5) this.endShot();
      return;
    }

    if (this.phase === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) this.nextShooter();
    }
  }

  endShot() {
    this.audio.loop('wind', 0, 'wind');
    if (!this.shot.made) this.game.ui.banner('MISS!', `${this.shots - this.taken} left`);
    const left = this.shots - this.taken;
    // Stop early once the job's done perfectly or can no longer be done.
    if (left <= 0 || this.made + left < this.need) {
      this.complete();
      return;
    }
    this.phase = 'wait';
    this.waitT = 0.5;
  }

  complete() {
    this.phase = 'done';
    const need = this.need;
    const stars = this.made < need ? 0 : this.made >= Math.min(this.shots, need + 2) ? 3 : this.made >= need + 1 ? 2 : 1;
    this.finish({
      passed: stars > 0,
      stars,
      score: this.score,
      reason: `Sink at least ${need} baskets.`,
      stats: [
        ['Baskets', `${this.made}/${this.taken}`],
        ['Needed', `${need}`],
      ],
    });
  }
}
