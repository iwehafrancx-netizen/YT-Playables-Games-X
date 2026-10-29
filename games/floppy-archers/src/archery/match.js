import * as THREE from 'three';
import { Scene } from '../scene/scene.js';
import { cargoYard } from '../world/cargoYard.js';
import { SUITS } from '../dummy/dummyView.js';
import { Archer } from './archer.js';
import { Arrows } from './arrows.js';
import { Orchard, FRUIT } from './fruit.js';
import { wave } from './foes.js';
import { stats as perkStats } from './perks.js';

const ARROW_G = 9.5;
const SHOT_COST = 6;
const JUMP_COST = 5;
const MIN_SPEED = 11;
const MAX_SPEED = 25;
const DOTS = 16;
const TOWER_X = 9.5;
const TOWER_TOP = 5.2; // two containers
const D2R = Math.PI / 180;
// How hard each part of the body takes a hit; heads are set by who's shooting.
const ZONE = { chest: 1.2, pelvis: 1, upperArmL: 0.7, upperArmR: 0.7, thighL: 0.75, thighR: 0.75, lowerArmL: 0.55, lowerArmR: 0.55, shinL: 0.6, shinR: 0.6 };
// Where enemies can stand: [x, height of their feet, what they stand on].
const SLOTS = [
  [4, 2.6, 'stack'],
  [10.5, 2.6, 'stack'],
  [2.5, 6.4, 'girder'],
  [6.5, 4.4, 'girder'],
  [9, 7.6, 'girder'],
  [12.5, 5.2, 'girder'],
  [14, 2.6, 'stack'],
];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Low-arc launch angle that lands an arrow at `dx` across and `dy` up, at `speed`; null if out of reach. */
function solve(dx, dy, speed) {
  const v2 = speed * speed;
  const disc = v2 * v2 - ARROW_G * (ARROW_G * dx * dx + 2 * dy * v2);
  if (disc < 0) return null;
  return Math.atan2(v2 - Math.sqrt(disc), ARROW_G * dx);
}

/**
 * The archery duel. `mode` is 'solo' (the player against a wave of enemy
 * archers, one after another), 'duel' (two players on one screen, best of
 * three) or 'show' (two computer archers going at it behind the title).
 */
export class Match extends Scene {
  setup() {
    const o = this.opts;
    this.mode = o.mode ?? 'solo';
    this.phase = 'play';
    this.rand = Math.random;
    this.arrows = new Arrows(this);
    this.aims = new Map(); // pointer id → archer being aimed
    this.bars = [];
    this.kills = 0;
    this.heads = 0;
    this.coins = 0;
    this.yard();
    this.dots = this.trail();
    if (this.mode === 'solo') this.setupSolo();
    else this.setupDuel();
    this.orchard = new Orchard(this, { area: { x0: -5, x1: this.mode === 'solo' ? 9 : 5, y0: 5.5, y1: 10 } });
    this.cameraFor(true);
  }

  // ---------- the yard ----------

  yard() {
    const w = this.world;
    cargoYard(w, { run: { axis: 'x', to: 20 }, seed: 11 });
    // The player's tower, and in a duel a second one facing it.
    const towers = this.mode === 'solo' ? [-TOWER_X] : [-TOWER_X, TOWER_X];
    const colors = [['steelBlue', 'steelRed'], ['steelGreen', 'steelOrange']];
    towers.forEach((x, i) => {
      w.container({ pos: [x, 0, 0], color: colors[i][0] });
      w.container({ pos: [x, 2.6, 0], color: colors[i][1] });
    });
    if (this.mode !== 'solo') {
      // A couple of girders in no-man's-land to shoot over and under.
      this.girder(0, 4.2);
      this.girder(0, 9.2);
      return;
    }
    // Girders only hang there while someone stands on one (see spawnFoe), so
    // the sky between the archers stays clear.
    for (const [x, , kind] of SLOTS) if (kind === 'stack') w.container({ pos: [x, 0, 0], color: 'steelGrey' });
  }

  /** A steel beam hanging off a crane hook, for an archer to stand on. */
  girder(x, y) {
    const w = this.world;
    const beam = w.block({ pos: [x, y - 0.15, 0], size: [2.4, 0.3, 1.1], mat: 'hazard', friction: 1 });
    const parts = [beam.mesh];
    for (const s of [-0.9, 0.9]) {
      const cable = w.mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), 'darkSteel', { cast: false });
      const top = y + 3.2;
      cable.scale.y = Math.hypot(top - y, s * 0.9);
      cable.position.set(x + s / 2, (top + y) / 2, 0);
      cable.rotation.z = Math.atan2(s * 0.9, top - y);
      parts.push(cable);
    }
    const hook = w.mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), 'toyYellow');
    hook.position.set(x, y + 3.3, 0);
    const line = w.mesh(new THREE.CylinderGeometry(0.03, 0.03, 20, 6), 'darkSteel', { cast: false });
    line.position.set(x, y + 13.4, 0);
    parts.push(hook, line);
    w.add(...parts.slice(1));
    return { ...beam, parts };
  }

  /** Takes a girder down, along with any arrows stuck in it. */
  removeGirder(g) {
    for (const m of g.parts) m.removeFromParent();
    this.physics.removeBody(g.body);
  }

  trail() {
    const geo = new THREE.SphereGeometry(0.07, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    this.world.disposables.push(geo, mat);
    const dots = new THREE.InstancedMesh(geo, mat, DOTS);
    dots.frustumCulled = false;
    dots.count = 0;
    this.world.add(dots);
    return dots;
  }

  // ---------- who's fighting ----------

  setupSolo() {
    const o = this.opts;
    this.perks = perkStats(o.perks ?? {});
    this.player = new Archer(this, { position: [-TOWER_X, TOWER_TOP + 0.02, 0], side: 1, hp: this.perks.hp, team: 'player' });
    this.player.human = true;
    this.wave = wave(o.wave ?? 1);
    this.queue = this.wave.foes.slice();
    this.total = this.queue.length;
    this.beaten = 0;
    this.foes = [];
    this.nextFoeT = 1.2;
    this.lastSlot = -1;
  }

  setupDuel() {
    const base = { hp: 100, damage: 20, regen: 9, arrows: 1, burn: 0, leech: 0, headshot: 2.2, speed: 1 };
    this.perks = base;
    const suits = this.mode === 'show' ? ['red', 'blue'] : [this.game.save.data.suit, this.game.save.data.suit === 'blue' ? 'yellow' : 'blue'];
    this.sides = [-1, 1].map((s, i) => {
      const a = new Archer(this, { position: [s * TOWER_X, TOWER_TOP + 0.02, 0], side: -s, suit: suits[i], team: `p${i + 1}` });
      a.stats = base;
      a.human = this.mode === 'duel';
      if (!a.human) a.brain = this.brainFor(a, { rate: [1.4, 2.4], err: 0.09, speed: 22, damage: 18, burst: 1 });
      return a;
    });
    this.player = this.sides[0];
    this.round = this.opts.round ?? 1;
    this.wins = this.opts.wins ?? [0, 0];
  }

  brainFor(archer, def) {
    return { def, state: 'wait', t: 1 + this.rand() * 1.2, volley: 0 };
  }

  /** Brings on the next enemy, on a spot that isn't the one just used. */
  spawnFoe() {
    const def = this.queue.shift();
    let slot;
    do slot = Math.floor(this.rand() * SLOTS.length);
    while (slot === this.lastSlot && SLOTS.length > 1);
    this.lastSlot = slot;
    const [x, y, kind] = SLOTS[slot];
    const perch = kind === 'girder' ? this.girder(x, y) : null;
    const foe = new Archer(this, { position: [x, y + 0.02, 0], side: -1, suit: def.suit === this.player.suit ? def.alt : def.suit, hp: def.hp, team: 'foe', look: { helmet: def.helmet } });
    foe.def = def;
    foe.perch = perch;
    foe.brain = this.brainFor(foe, def);
    this.foes.push(foe);
    this.fx.puff(_a.set(x, y + 1, 0), { count: 10, size: 0.9, color: 0xffffff, up: 0.6 });
    this.audio.whoosh(0.8);
    if (def.boss) this.game.ui.banner('THE CAPTAIN!', 'Boss archer');
    this.bar(foe, def.boss);
  }

  /** A little health bar that floats over an enemy's head. */
  bar(archer, big) {
    const el = document.createElement('div');
    el.className = `foe-bar${big ? ' boss' : ''}`;
    el.innerHTML = '<i></i>';
    document.getElementById('fx-layer').appendChild(el);
    this.bars.push({ archer, el, fill: el.firstChild });
  }

  targetsOf(archer) {
    if (this.mode === 'solo') return archer.team === 'player' ? this.foes.filter((f) => f.alive) : [this.player].filter((p) => p.alive);
    return this.sides.filter((s) => s !== archer && s.alive);
  }

  // ---------- aiming and shooting ----------

  /** Drag back from anywhere to aim, like drawing a bow: further back pulls harder. */
  onPointerDown(p) {
    if (this.phase !== 'play') return;
    const humans = this.mode === 'solo' ? [this.player] : this.mode === 'duel' ? this.sides : [];
    const archer = this.mode === 'duel' ? humans[p.x < 0.5 ? 0 : 1] : humans[0];
    if (!archer?.alive || [...this.aims.values()].includes(archer)) return;
    this.aims.set(p.id, archer);
    archer.pull = 0;
    this.game.ui.clearHint();
  }

  onPointerMove(p, start) {
    const archer = this.aims.get(p.id);
    if (!archer) return;
    const dx = p.px - start.px;
    const dy = p.py - start.py;
    const reach = Math.min(p.w, p.h) * 0.3;
    archer.pull = Math.min(1, Math.hypot(dx, dy) / reach);
    if (archer.pull > 0.05) {
      // Aim is the drag reversed; screen y runs down, world y up.
      const ax = -dx * archer.side;
      const angle = Math.atan2(dy, Math.max(ax, 1));
      archer.aim(angle, archer.pull);
    }
  }

  onPointerUp(p) {
    const archer = this.aims.get(p.id);
    if (!archer) return;
    this.aims.delete(p.id);
    if (archer.pull > 0.15 && this.phase === 'play') this.shoot(archer, archer.pull);
    else archer.aim(archer.angle, 0);
    archer.pull = 0;
  }

  onKeyDown(code) {
    const p = this.player;
    if (!p?.human || this.phase !== 'play') return false;
    if (code === 'ArrowUp' || code === 'KeyW') p.aim(p.angle + 4 * D2R, p.draw);
    else if (code === 'ArrowDown' || code === 'KeyS') p.aim(p.angle - 4 * D2R, p.draw);
    else if (code === 'Space') {
      this.keyDraw = this.time;
      p.aim(p.angle, 0.1);
    } else if (code === 'KeyJ' || code === 'ShiftLeft') this.jump(p);
    else return false;
    return true;
  }

  onKeyUp(code) {
    const p = this.player;
    if (code !== 'Space' || this.keyDraw === undefined || !p) return;
    const pull = Math.min(1, (this.time - this.keyDraw) / 0.9);
    this.keyDraw = undefined;
    if (pull > 0.15 && this.phase === 'play') this.shoot(p, pull);
    else p.aim(p.angle, 0);
  }

  jump(archer) {
    if (!archer.alive || !archer.canAfford(JUMP_COST)) return;
    if (archer.jump()) {
      archer.spend(JUMP_COST);
      this.audio.jump(false);
    }
  }

  shoot(archer, pull, def = null) {
    const s = def ?? archer.stats ?? this.perks;
    if (!def && !archer.canAfford(SHOT_COST)) {
      this.game.ui.toast('Out of stamina!');
      archer.aim(archer.angle, 0);
      return;
    }
    if (!def) archer.spend(SHOT_COST);
    const speed = def ? def.speed : (MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pull) * s.speed;
    const count = def ? 1 : s.arrows;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 3.5 * D2R;
      const dir = new THREE.Vector3(Math.cos(archer.angle + spread) * archer.side, Math.sin(archer.angle + spread), 0);
      // The fight is side-on: every arrow flies in the z = 0 plane.
      const origin = archer.muzzle(new THREE.Vector3()).setZ(0);
      this.arrows.fire({ origin, dir, speed, owner: archer, damage: def ? def.damage : s.damage, burn: def ? 0 : s.burn });
    }
    archer.aim(archer.angle, 0);
    this.audio.whoosh(0.6 + pull * 0.6);
    this.audio.twang?.(pull);
  }

  /** What the computer archers do: wait, draw toward a (slightly off) firing solution, loose. */
  think(archer, dt) {
    const b = archer.brain;
    const def = b.def;
    const target = this.targetsOf(archer)[0];
    if (!archer.alive || !target || this.phase !== 'play') return;
    b.t -= dt;
    if (b.state === 'wait') {
      if (b.t > 0) return;
      const from = archer.muzzle(_a);
      // Mostly at the chest, now and then at the head.
      const to = target.dummy.partPosition(this.rand() < 0.25 ? 'head' : 'chest', _b);
      const angle = solve(Math.abs(to.x - from.x), to.y - from.y, def.speed) ?? 40 * D2R;
      b.goal = angle + (this.rand() - 0.5) * 2 * def.err;
      b.from = archer.angle;
      b.state = 'draw';
      b.t = b.dur = def.draw ?? 0.85;
      b.volley = def.burst ?? 1;
    } else if (b.state === 'draw') {
      const k = 1 - Math.max(0, b.t) / b.dur;
      archer.aim(THREE.MathUtils.lerp(b.from, b.goal, Math.min(1, k * 1.6)), k);
      if (b.t > 0) return;
      this.shoot(archer, 1, def);
      b.volley--;
      if (b.volley > 0) {
        b.state = 'burst';
        b.t = 0.22;
      } else {
        b.state = 'wait';
        b.t = def.rate[0] + this.rand() * (def.rate[1] - def.rate[0]);
      }
    } else if (b.state === 'burst' && b.t <= 0) {
      archer.aim(b.goal + (this.rand() - 0.5) * def.err, 1);
      this.shoot(archer, 1, def);
      b.volley--;
      if (b.volley > 0) b.t = 0.22;
      else {
        b.state = 'wait';
        b.t = def.rate[0] + this.rand() * (def.rate[1] - def.rate[0]);
      }
    }
  }

  // ---------- hits ----------

  onArrowHit(arrow, info, point, collider) {
    const target = info.ragdoll && this.dummies.find((d) => d.ragdoll === info.ragdoll)?.archer;
    this.arrows.stick(arrow, point, target?.dummy.view.meshes[info.part]);
    // Knock the part the way the arrow was going.
    const body = collider.parent();
    if (body) {
      const v = body.linvel();
      const k = target?.alive === false ? 0.35 : 0.18;
      body.setLinvel({ x: v.x + arrow.vel.x * k, y: v.y + arrow.vel.y * k, z: v.z }, true);
    }
    if (!target || !target.alive) return;
    if (target === arrow.owner) return;
    const shooter = arrow.owner;
    const head = info.part === 'head';
    const headMult = shooter.def ? 1.6 : (shooter.stats ?? this.perks).headshot;
    const mult = head ? Math.min(headMult, target.def?.headshot ?? headMult) : ZONE[info.part] ?? 1;
    const dmg = Math.round(arrow.damage * mult);
    const killed = target.hurt(dmg);
    if (arrow.burn) target.burn = { dps: arrow.burn, t: 3 };
    if (shooter === this.player && this.mode === 'solo' && this.perks.leech) this.player.heal(dmg * this.perks.leech);
    const color = new THREE.Color((SUITS[target.suit] ?? SUITS.red).body).getHex();
    this.fx.chips(point, { count: 10 + (head ? 10 : 0), colors: [color, 0xffffff], size: 0.06, speed: 4, life: 0.8 });
    this.fx.text(_a.copy(point).add(_b.set(0, 0.5, 0)), head ? `HEADSHOT! -${dmg}` : `-${dmg}`, { color: head ? '#ffd23a' : '#ffffff', size: head ? 30 : 22 });
    this.audio.impact(head ? 1 : 0.7, 'body');
    if (head) {
      this.rig.shake(0.25);
      if (shooter === this.player) this.heads++;
    }
    if (killed) this.onKill(target, shooter, head);
    else if (target === this.player && this.mode === 'solo') this.rig.shake(0.2);
  }

  onArrowLodge(arrow, point, info, collider) {
    const perch = this.foes?.find((f) => f.perch?.collider === collider)?.perch;
    if (perch) this.arrows.attach(arrow.mesh, perch.mesh);
    if (arrow.spent) return;
    this.fx.puff(point, { count: 2, size: 0.25, color: 0xd8d2c4 });
  }

  onArrowPath(arrow, from, to) {
    if (arrow.owner?.team === 'foe' || !arrow.owner?.human) return;
    const got = this.orchard.pierce(from, to);
    if (!got) return;
    const a = arrow.owner;
    if (got.kind === 'red') a.heal(30);
    else if (got.kind === 'green') a.stamina = Math.min(a.maxStamina, a.stamina + 50);
    else this.coins += 25;
    this.fx.chips(got.at, { count: 18, colors: [FRUIT[got.kind].color, 0xffffff], size: 0.07, speed: 4, life: 0.8 });
    this.fx.text(got.at.clone().add(_a.set(0, 0.6, 0)), FRUIT[got.kind].label, { color: '#ffffff', size: 24 });
    this.audio.coin(got.kind === 'gold' ? 4 : 2);
  }

  onClash(at) {
    this.fx.chips(at, { count: 16, colors: [0xffd23a, 0xffffff], size: 0.05, speed: 5, life: 0.5 });
    this.audio.impact(0.6, 'metal');
  }

  onKill(target, shooter, head) {
    target.dummy.ragdoll.addVelocity({ x: -target.side * 2.5, y: 1.5, z: 0 });
    this.slowmo = 0.35;
    this.slowT = 0.45;
    this.audio.crack?.();
    if (this.mode === 'solo') {
      if (target === this.player) return this.lose();
      this.kills++;
      this.beaten++;
      this.coins += 5 + (head ? 3 : 0) + (target.def.boss ? 40 : 0);
      this.game.ui.hudApi?.set('score', `${this.beaten}/${this.total}`);
      this.game.ui.hudApi?.bump('score');
      target.goneT = 3;
      if (this.beaten >= this.total) this.win();
      else this.nextFoeT = 1.4;
      return;
    }
    const winner = this.sides.indexOf(shooter);
    if (this.mode === 'show') {
      target.goneT = 2.5;
      return;
    }
    this.wins[winner] = (this.wins[winner] ?? 0) + 1;
    this.phase = 'end';
    this.endT = 2;
    this.roundWinner = winner;
  }

  win() {
    this.phase = 'end';
    this.endT = 2.2;
    this.passed = true;
    this.audio.win();
    this.fx.confetti(this.player.dummy.com(new THREE.Vector3()).add(_a.set(0, 2, 0)), 120);
    this.game.ui.banner('WAVE CLEAR!', `${this.total} archers down`);
  }

  lose() {
    this.phase = 'end';
    this.endT = 1.8;
    this.passed = false;
    this.audio.lose();
  }

  /** Back on his feet with half his health, to finish the wave. */
  revive() {
    const p = this.player;
    const fresh = new Archer(this, { position: [-TOWER_X, TOWER_TOP + 0.02, 0], side: 1, hp: this.perks.hp, team: 'player' });
    fresh.human = true;
    fresh.hp = Math.round(this.perks.hp * 0.6);
    this.removeDummy(p.dummy);
    p.string.removeFromParent();
    p.nocked.removeFromParent();
    this.player = fresh;
    this.aims.clear();
    this.phase = 'play';
    this.physics.snapAll();
  }

  // ---------- frame ----------

  fixedUpdate(dt) {
    this.arrows.step(dt);
    for (const a of this.archers()) {
      if (a.brain) this.think(a, dt);
      if (a.burn && a.alive) {
        a.burn.t -= dt;
        if (a.hurt(a.burn.dps * dt)) this.onKill(a, this.player, false);
        if (a.burn && a.burn.t <= 0) a.burn = null;
      }
      // Falling off the world is the end of anyone.
      if (a.alive && a.dummy.com(_a).y < -3 && a.hurt(a.hp)) this.onKill(a, this.archers().find((x) => x !== a), false);
    }
  }

  archers() {
    if (this.mode === 'solo') return [this.player, ...this.foes];
    return this.sides;
  }

  tick(dt) {
    if (this.slowT > 0) {
      this.slowT -= dt / this.slowmo;
      if (this.slowT <= 0) this.slowmo = 1;
    }
    const regen = (a) => (a.def ? 0 : (a.stats ?? this.perks).regen);
    for (const a of this.archers()) a.update(dt, regen(a));
    this.orchard.update(dt, this.phase === 'play' && this.mode !== 'show');
    if (this.mode === 'solo') this.tickSolo(dt);
    else this.tickDuel(dt);
    this.drawTrail();
    this.drawBars();
    this.game.ui.hudApi?.vitals?.(this.vitals());
    this.cameraFor();
  }

  tickSolo(dt) {
    for (const f of this.foes) {
      if (f.goneT === undefined) continue;
      f.goneT -= dt;
      if (f.goneT <= 0) this.retire(f);
    }
    this.foes = this.foes.filter((f) => !f.retired);
    if (this.phase === 'play' && this.queue.length && !this.foes.some((f) => f.alive)) {
      this.nextFoeT -= dt;
      if (this.nextFoeT <= 0) this.spawnFoe();
    }
    if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.phase = 'done';
        this.game.waveOver(this, { passed: this.passed, wave: this.wave.n, kills: this.kills, heads: this.heads, coins: this.coins, beaten: this.beaten, total: this.total });
      }
    }
  }

  tickDuel(dt) {
    for (const a of this.sides) {
      if (a.goneT === undefined) continue;
      a.goneT -= dt;
      if (a.goneT <= 0) {
        // In the title show the fallen archer just gets back up.
        const i = this.sides.indexOf(a);
        this.retire(a);
        const s = i === 0 ? -1 : 1;
        const fresh = new Archer(this, { position: [s * TOWER_X, TOWER_TOP + 0.02, 0], side: -s, suit: i ? 'blue' : 'red', team: `p${i + 1}` });
        fresh.stats = this.perks;
        fresh.brain = this.brainFor(fresh, a.brain.def);
        this.sides[i] = fresh;
        this.physics.snapAll();
      }
    }
    if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.phase = 'done';
        this.game.roundOver(this, { winner: this.roundWinner, wins: this.wins, round: this.round });
      }
    }
  }

  retire(archer) {
    archer.retired = true;
    this.removeDummy(archer.dummy);
    if (archer.perch) this.removeGirder(archer.perch);
    archer.string.removeFromParent();
    archer.nocked.removeFromParent();
    const bar = this.bars.find((b) => b.archer === archer);
    if (bar) {
      bar.el.remove();
      this.bars = this.bars.filter((b) => b !== bar);
    }
  }

  vitals() {
    const v = (a) => a && { hp: a.hp, maxHp: a.maxHp, stamina: a.stamina, maxStamina: a.maxStamina };
    return this.mode === 'solo' ? [v(this.player)] : this.sides.map(v);
  }

  /** Dotted arc of where the arrow being drawn would go. */
  drawTrail() {
    const archer = [...this.aims.values()][0] ?? (this.keyDraw !== undefined ? this.player : null);
    if (!archer || archer.draw < 0.1 || !archer.alive) {
      this.dots.count = 0;
      return;
    }
    const s = archer.stats ?? this.perks;
    const speed = (MIN_SPEED + (MAX_SPEED - MIN_SPEED) * archer.draw) * s.speed;
    const p = archer.muzzle(_a);
    const v = archer.aimDir(_b).multiplyScalar(speed);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 1; i <= DOTS; i++) {
      const t = i * 0.055;
      _c.set(p.x + v.x * t, p.y + v.y * t - 0.5 * ARROW_G * t * t, 0);
      if (_c.y < 0) break;
      const k = 1 - i / (DOTS + 4);
      m.makeScale(k, k, k).setPosition(_c);
      this.dots.setMatrixAt(n++, m);
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
  }

  drawBars() {
    const cam = this.stage.camera;
    const w = this.stage.width;
    const h = this.stage.height;
    for (const b of this.bars) {
      const a = b.archer;
      const p = a.dummy.headPosition(_a).add(_b.set(0, 0.42, 0)).project(cam);
      b.el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px)`;
      b.el.style.opacity = a.alive ? 1 : 0;
      b.fill.style.width = `${(100 * a.hp) / a.maxHp}%`;
    }
  }

  cameraFor(snap = false) {
    // The whole fight in shot: both towers, or the player and wherever the
    // enemies stand.
    const portrait = this.stage.width < this.stage.height;
    let x1 = TOWER_X + 1.8;
    if (this.mode === 'solo') x1 = Math.max(4, ...this.foes.map((f) => f.home.x + 2));
    const min = _a.set(-TOWER_X - 1.8, portrait ? -1 : 1.4, -0.5);
    const max = _b.set(x1, 11, 0.5);
    const { pos, look } = this.frameBox(min, max, { pitch: 5, margin: 0.92 });
    if (snap) this.rig.set(pos, look);
    else this.rig.aim(pos, look, 1.2, 1.5);
    this.stage.focusShadows(look, 26);
  }

  dispose() {
    for (const b of this.bars) b.el.remove();
    super.dispose();
  }
}
