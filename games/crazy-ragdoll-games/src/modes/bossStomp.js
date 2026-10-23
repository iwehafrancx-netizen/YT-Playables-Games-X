import * as THREE from 'three';
import { BossLevel } from './bossLevel.js';
import { RAPIER, Group, groups } from '../physics/physics.js';

const HALF = 9; // half-width of the trampoline floor
const PAD_Y = 0.5;
const PAD_D = 3;
const POWER = 10.5; // every bounce goes this high
const AIR_SPEED = 6;
const SCALE = 1;
const HEAD_TOP = 4.6 * SCALE;
const HEARTS = 3;
const _a = new THREE.Vector3();

/**
 * Stomper: the whole floor is one big trampoline, and a robot is marching up
 * and down it. The ragdoll bounces on his own; steer him in the air and come
 * down on the robot's head. Bump into its body instead and it swats you.
 */
export class BossStompLevel extends BossLevel {
  setup() {
    this.left = this.def.time;
    this.hearts = HEARTS;
    this.botX = -5;
    this.botDir = 1;
    this.safeT = 0;
    this.steer = 0;
    this.keys = { left: false, right: false };
    this.scenery({ extent: 30 });
    this.clutter([[-12, 1.5], [12, 1], [-13, -3]]);
    this.floor();
    this.bossSetup({ scale: SCALE }, [
      { id: 'hearts', icon: 'heart', value: this.hearts },
      { id: 'time', icon: 'clock', value: Math.ceil(this.left) },
    ]);
    this.dummy = this.spawnDummy({ position: [3, PAD_Y + 1.5, 0], yaw: 0, pose: 'starfish', muscle: 0.55 });
    this.physics.snapAll();
    this.cameraFor(true);
  }

  floor() {
    const w = this.world;
    const frame = w.mesh(new THREE.BoxGeometry(HALF * 2 + 0.4, 0.3, PAD_D + 0.4), 'toyBlue');
    frame.position.set(0, PAD_Y - 0.1, 0);
    const mat = w.mesh(new THREE.BoxGeometry(HALF * 2, 0.06, PAD_D), 'toyDark');
    mat.position.set(0, PAD_Y + 0.08, 0);
    w.add(frame, mat);
    const body = this.physics.createBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, PAD_Y, 0));
    const spring = { kind: 'spring', pad: mat, power: POWER, squash: 0 };
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF, 0.15, PAD_D / 2).setFriction(0.9).setCollisionGroups(groups(Group.WORLD)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
      { kind: 'spring', spring, material: 'rubber' },
    );
    w.springs.push(spring);
    for (const s of [-1, 1]) {
      const wall = w.mesh(new THREE.BoxGeometry(0.3, 9, PAD_D), 'toyPink');
      wall.position.set(s * (HALF + 0.15), 4.5, 0);
      w.add(wall);
      const b = w.fixedBody([s * (HALF + 0.15), 4.5, 0], new THREE.Quaternion());
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(0.15, 4.5, PAD_D / 2).setRestitution(0.5).setCollisionGroups(groups(Group.WORLD)), b);
    }
  }

  /** Every bounce throws him to the same height, however he lands. */
  bounce(spring, info) {
    const d = this.dummyFor(info);
    if (d) this.launch(d, POWER);
  }

  launch(d, power) {
    if (d.lastBounce && this.time - d.lastBounce < 0.3) return;
    const v = d.velocity(_a);
    if (v.y > 1 && power === POWER) return;
    d.lastBounce = this.time;
    d.ragdoll.addVelocity({ x: v.x * 0.2, y: power - v.y * 0.3, z: -v.z * 0.3 }, 0.3);
    this.audio.spring();
  }

  // ---------- input ----------

  onPointerDown(p) {
    this.steer = p.x < 0.5 ? -1 : 1;
    this.hud.clearHint();
  }

  onPointerMove(p) {
    this.steer = p.x < 0.5 ? -1 : 1;
  }

  onPointerUp() {
    this.steer = 0;
  }

  onKeyDown(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = true;
    this.hud.clearHint();
  }

  onKeyUp(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = false;
  }

  // ---------- fight ----------

  fixedUpdate(dt) {
    const d = this.dummy;
    const c = d.com(_a);
    const v = d.velocity();
    const dir = this.phase === 'fight' ? THREE.MathUtils.clamp(this.steer + (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0), -1, 1) : 0;
    const k = dir ? 0.12 : 0.03;
    d.ragdoll.addVelocity({ x: (dir * AIR_SPEED - v.x) * k, y: 0, z: (-c.z * 3 - v.z) * 0.2 });
    // Settled on the floor without a fresh contact: bounce him anyway.
    if (Math.abs(v.y) < 0.6 && c.y < PAD_Y + 1.6 && this.time - (d.lastBounce ?? 0) > 0.6) this.launch(d, POWER);

    if (this.phase !== 'fight') return;
    // March up and down, turning at the ends and now and then on a whim.
    this.botX += this.botDir * this.def.pace * dt;
    if (Math.abs(this.botX) > HALF - 2 || (Math.random() < dt * 0.15 && Math.abs(this.botX) < HALF - 4)) {
      this.botDir = -Math.sign(this.botX) || -this.botDir;
      if (Math.abs(this.botX) < HALF - 4) this.botDir = -this.botDir;
    }
    this.robot.root.position.set(this.botX, PAD_Y + 0.1, 0);
    this.robot.root.rotation.y = this.botDir > 0 ? Math.PI / 2 : -Math.PI / 2;

    this.safeT = Math.max(0, this.safeT - dt);
    const dx = c.x - this.botX;
    if (v.y < 0 && Math.abs(dx) < 1.3 && c.y > HEAD_TOP - 0.3 && c.y < HEAD_TOP + 1.8) {
      // Stomped on its head: bounce off sky high.
      d.lastBounce = 0;
      this.launch(d, 13);
      d.ragdoll.addVelocity({ x: Math.sign(dx || 1) * 3, y: 0, z: 0 });
      this.hit(this.robot.headPosition(_a.clone()).add(new THREE.Vector3(0, 0.6, 0)), 'STOMP!');
    } else if (this.safeT <= 0 && Math.abs(dx) < 1.4 && c.y < HEAD_TOP - 0.6) {
      // Walked into it: it swats him away.
      this.safeT = 1.5;
      this.hearts--;
      this.hud.set('hearts', this.hearts);
      this.hud.bump('hearts');
      d.ragdoll.setVelocity({ x: Math.sign(dx || 1) * 10, y: 6, z: 0 });
      this.fx.text(c.clone().add(new THREE.Vector3(0, 1.3, 0)), 'SWAT!', { color: '#ff5a4e', size: 34 });
      this.audio.impact(1, 'metal');
      this.rig.shake(0.4);
      if (this.hearts <= 0) this.lose('The Stomper swatted you three times. Land on its head!');
    }
  }

  tick(dt) {
    this.bossTick(dt, this.phase === 'fight' ? 1 : 0);
    this.cameraFor();
    this.coach(`Land on its HEAD · touching its body hurts · ${this.hitsLeft()}`, this.robot.headPosition(_a).add(new THREE.Vector3(0, 0.9, 0)));
    if (this.phase === 'fight') {
      this.left -= dt;
      this.hud.set('time', Math.max(0, Math.ceil(this.left)));
      if (this.left <= 0) this.lose('Time ran out before the Stomper went down.');
    }
  }

  /** More time and a heart back. */
  revive() {
    this.left = Math.max(this.left, 0) + 20;
    this.hearts = Math.max(1, this.hearts);
    this.hud.set('hearts', this.hearts);
    this.phase = 'fight';
    this.safeT = 1.5;
  }

  spare() {
    return Math.max(0, this.left) / this.def.time;
  }

  bossStats() {
    return [
      ['Hearts left', `${Math.max(0, this.hearts)}/${HEARTS}`],
      ['Time left', `${Math.max(0, Math.ceil(this.left))}s`],
    ];
  }

  cameraFor(snap = false) {
    // On a tall screen the whole trampoline won't fit up close, so frame
    // just the stretch between him and the robot.
    const portrait = this.stage.width < this.stage.height;
    let x0 = -HALF - 0.5;
    let x1 = HALF + 0.5;
    if (portrait) {
      const c = this.dummy.com(_a).x;
      x0 = Math.max(x0, Math.min(c, this.botX) - 3);
      x1 = Math.min(x1, Math.max(c, this.botX) + 3);
      const grow = Math.max(0, 9 - (x1 - x0)) / 2;
      x0 -= grow;
      x1 += grow;
    }
    const { pos, look } = this.frameBox(_a.set(x0, 0, -PAD_D / 2), new THREE.Vector3(x1, 8.5, PAD_D / 2), { pitch: portrait ? 16 : 12 });
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 2.5, 3);
    this.stage.focusShadows(look, 18);
  }
}
