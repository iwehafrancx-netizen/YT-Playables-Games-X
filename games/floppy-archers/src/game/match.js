import { STEP } from '../engine/physics.js';
import { Archer } from './archer.js';
import { Arrows, ARROW_G } from './arrows.js';
import { Brain } from './brain.js';
import { Orchard, FRUIT } from './fruit.js';
import { ARROWS, SUITS } from './catalog.js';
import { drawSky, drawGround, drawSolid, drawArcher } from './draw.js';

const D2R = Math.PI / 180;
const TOWER_H = 3.2;
const SHOT_COST = 8;
const JUMP_COST = 5;
const MIN_SPEED = 12;
const MAX_SPEED = 26;
const BASE_DMG = 22;
const HEADSHOT = 2;
const DOTS = 13;
const ENEMY_SUITS = ['green', 'blue', 'purple', 'yellow', 'orange', 'teal', 'black'];
// What an enemy's special arrow does; the player's come from the shop levels.
const FOE_ARROW_FX = { fire: { burn: 5, time: 3 }, shock: { stun: 1.1 }, bomb: { blast: 1.6 } };

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * One fight. `mode` is 'solo' (the player against a level's queue of enemy
 * archers, one at a time), 'duel' (two players on one screen) or 'show' (two
 * computer archers going at it behind the title screen).
 */
export class Match {
  constructor(game, opts) {
    this.game = game;
    this.view = game.view;
    this.audio = game.audio;
    this.fx = game.fx;
    this.opts = opts;
    this.mode = opts.mode;
    this.spec = opts.spec ?? null;
    this.theme = this.spec?.theme ?? opts.theme ?? 'meadow';
    this.time = 0;
    this.phase = 'play';
    this.slowmo = 1;
    this.slowT = 0;
    this.hitstop = 0;
    this.acc = 0;
    this.solids = [{ x: -200, y: -50, w: 400, h: 50, kind: 'ground' }];
    this.archers = [];
    this.arrows = new Arrows(this);
    this.fruit = new Orchard();
    this.aims = new Map(); // pointer id → archer being aimed
    this.kills = 0;
    this.heads = 0;
    this.skulls = 0;
    this.fx.clear();
    if (this.mode === 'solo') this.setupSolo();
    else this.setupDuel();
    this.frameCamera(true);
  }

  // ---------- setting up ----------

  tower(x, h, w = 1.6) {
    const s = { x: x - w / 2, y: 0, w, h, kind: 'tower' };
    this.solids.push(s);
    return s;
  }

  setupSolo() {
    const o = this.opts;
    const base = this.tower(0, TOWER_H);
    this.player = this.addArcher({ x: 0, y: TOWER_H, side: 1, team: 'player', look: { suit: o.suit }, hp: o.stats.hp, platform: base });
    this.player.human = true;
    this.player.regen = o.stats.regen;
    this.player.power = o.stats.power;
    this.player.loaded = o.arrow;
    this.player.arrowLv = o.arrowLv;
    this.queue = this.spec.foes.slice();
    this.total = this.queue.length;
    this.beaten = 0;
    this.foe = null;
    this.nextFoeT = 0.9;
  }

  setupDuel() {
    const dx = this.view.portrait ? 6 : 11;
    this.sides = [-1, 1].map((s, i) => {
      const t = this.tower((s * dx) / 2, TOWER_H);
      const suit = this.mode === 'show' ? ['red', 'blue'][i] : i === 0 ? this.opts.suit : this.opts.suit === 'blue' ? 'yellow' : 'blue';
      const a = this.addArcher({ x: (s * dx) / 2, y: TOWER_H, side: -s, team: `p${i + 1}`, look: { suit }, hp: 100, platform: t });
      a.regen = 12;
      a.power = 1;
      a.loaded = 'basic';
      a.arrowLv = 1;
      a.human = this.mode === 'duel';
      if (!a.human) a.brain = new Brain({ rate: [1.4, 2.4], err: 0.07, speed: 21, dmg: 18 });
      return a;
    });
    this.player = this.sides[0];
    this.round = this.opts.round ?? 1;
    this.wins = this.opts.wins ?? [0, 0];
    this.fruit.area = { x0: -dx / 2 + 1.5, x1: dx / 2 - 1.5, y0: TOWER_H + 0.8, y1: TOWER_H + 3.5 };
  }

  addArcher(o) {
    const a = new Archer(o);
    this.archers.push(a);
    return a;
  }

  /** Brings on the next enemy: a fresh spot to stand on, and he drops in from above. */
  spawnFoe() {
    const def = this.queue.shift();
    const portrait = this.view.portrait;
    const boss = def.boss;
    const dx = boss ? (portrait ? 6 : 11) : portrait ? rand(4.6, 6.4) : rand(8.5, 12.5);
    const spot = [];
    let stand;
    let top;
    if (boss || Math.random() < 0.45) {
      top = boss ? rand(2.4, 3.6) : rand(1.6, 5);
      stand = this.tower(dx, top, boss ? 2.4 : 1.6);
    } else {
      top = rand(2.2, 6.2);
      stand = { x: dx - 0.95, y: top - 0.3, w: 1.9, h: 0.3, kind: 'plank' };
      if (this.spec.movers && Math.random() < 0.45) stand.bob = { base: stand.y, amp: rand(0.6, 1.2), speed: rand(0.9, 1.5), phase: rand(0, 6) };
      this.solids.push(stand);
    }
    spot.push(stand);
    // Sometimes a hanging crate in the way, to shoot over or under.
    if (this.spec.obstacles && !boss && Math.random() < 0.35) {
      const lo = Math.min(TOWER_H, top);
      const hi = Math.max(TOWER_H, top);
      const crate = { x: dx * rand(0.42, 0.58) - 0.4, y: (lo + hi) / 2 + rand(-0.2, 1.2), w: 0.8, h: 1.5, kind: 'crate' };
      if (this.spec.movers && Math.random() < 0.5) crate.bob = { base: crate.y, amp: rand(1, 1.8), speed: rand(0.8, 1.3), phase: rand(0, 6) };
      this.solids.push(crate);
      spot.push(crate);
    }
    let suit = def.suit;
    if (suit === this.player.look.suit) suit = ENEMY_SUITS.find((s) => s !== suit && s !== def.suit);
    const foe = this.addArcher({ x: dx, y: stand.y + stand.h, side: -1, team: 'foe', look: { suit, hat: def.hat }, hp: def.hp, size: def.size ?? 1, platform: stand });
    foe.def = def;
    foe.brain = new Brain(def);
    foe.spot = spot;
    foe.ragdoll.teleport(0, 6);
    foe.jumpY = 6;
    foe.jumpV = -2;
    this.foe = foe;
    this.fruit.area = { x0: 1.2, x1: dx - 1.2, y0: TOWER_H + 0.6, y1: Math.max(TOWER_H, top) + 3 };
    this.audio.whoosh(0.7);
    if (boss) {
      this.game.ui.banner(def.name, def.title);
      this.audio.boom();
    }
  }

  /** Clears a beaten enemy away: his body, his spot and the arrows in them. */
  retire(a) {
    a.retired = true;
    this.archers = this.archers.filter((x) => x !== a);
    this.arrows.release(a);
    for (const s of a.spot ?? []) {
      this.arrows.release(s);
      this.solids = this.solids.filter((x) => x !== s);
    }
  }

  // ---------- input ----------

  humans() {
    if (this.mode === 'solo') return [this.player];
    if (this.mode === 'duel') return this.sides;
    return [];
  }

  onPointerDown(p) {
    if (this.phase !== 'play') return;
    const humans = this.humans();
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
    const reach = Math.min(p.w, p.h) * 0.28;
    archer.pull = Math.min(1, Math.hypot(dx, dy) / reach);
    if (archer.pull > 0.04) {
      // Drag back like a slingshot: the shot goes the opposite way.
      const ax = -dx * archer.side;
      archer.aim(Math.atan2(dy, Math.max(ax, 2)), archer.canShoot ? archer.pull : 0);
    }
  }

  onPointerUp(p) {
    const archer = this.aims.get(p.id);
    if (!archer) return;
    this.aims.delete(p.id);
    if (archer.pull > 0.15 && this.phase === 'play') this.playerShoot(archer, archer.pull);
    else archer.draw = 0;
    archer.pull = 0;
  }

  onKeyDown(code) {
    const p = this.player;
    if (!p?.human || this.phase !== 'play') return false;
    if (code === 'ArrowUp' || code === 'KeyW') p.aim(p.angle + 4 * D2R, p.draw);
    else if (code === 'ArrowDown' || code === 'KeyS') p.aim(p.angle - 4 * D2R, p.draw);
    else if (code === 'Space' || code === 'Enter') this.keyDraw = this.time;
    else if (code === 'KeyJ' || code === 'ShiftLeft' || code === 'ShiftRight') this.jump(p);
    else return false;
    return true;
  }

  onKeyUp(code) {
    const p = this.player;
    if ((code !== 'Space' && code !== 'Enter') || this.keyDraw === undefined || !p) return;
    const pull = Math.min(1, (this.time - this.keyDraw) / 0.8);
    this.keyDraw = undefined;
    if (pull > 0.15 && this.phase === 'play') this.playerShoot(p, pull);
    else p.draw = 0;
  }

  jump(archer) {
    if (this.phase !== 'play' || !archer.alive) return;
    if (archer.stamina < JUMP_COST) {
      this.game.ui.toast('Out of stamina!');
      return;
    }
    if (archer.jump()) {
      archer.stamina -= JUMP_COST;
      this.audio.jump(false);
    }
  }

  // ---------- shooting ----------

  playerShoot(archer, pull) {
    if (!archer.canShoot) {
      archer.draw = 0;
      return;
    }
    if (archer.stamina < SHOT_COST) {
      this.game.ui.toast('Out of stamina!');
      archer.draw = 0;
      return;
    }
    archer.stamina -= SHOT_COST;
    const type = archer.loaded;
    const L = ARROWS[type].lv[archer.arrowLv - 1];
    const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pull;
    this.loose(archer, { type, speed, dmg: BASE_DMG * L.dmg * archer.power, count: L.count ?? 1, spread: L.spread ?? 0, fx: L });
    this.audio.twang(pull);
  }

  foeShoot(archer) {
    const def = archer.brain.def;
    const type = def.arrow ?? 'basic';
    const dmg = def.dmg * (archer.poison ? 0.7 : 1);
    this.loose(archer, { type, speed: def.speed, dmg, count: def.fan ?? 1, spread: def.spread ?? 0, fx: { ...FOE_ARROW_FX[type], blastDmg: dmg, knock: def.knock } });
    this.audio.twang(0.8);
  }

  loose(archer, { type, speed, dmg, count, spread, fx }) {
    const m = archer.muzzle();
    for (let i = 0; i < count; i++) {
      const ang = archer.angle + (i - (count - 1) / 2) * spread * D2R;
      const vx = Math.cos(ang) * archer.side * speed;
      const vy = Math.sin(ang) * speed;
      this.arrows.fire({ x: m.x, y: m.y, vx, vy, owner: archer, type, damage: dmg, fx });
    }
    archer.draw = 0;
    // A little kick back through the bow arm.
    archer.ragdoll.push(-archer.side * 0.8, 0, [3, 4]);
  }

  // ---------- hits ----------

  onArrowHit(a, target, bone, t) {
    this.arrows.stickBody(a, target, bone, t);
    const pts = target.ragdoll.points;
    const k = target.alive ? 0.22 : 0.45;
    const knock = a.fx?.knock ?? 1;
    for (const i of new Set([bone.a, bone.b])) pts[i].push(a.vx * k * knock, a.vy * k * knock);
    const x = a.x;
    const y = a.y;
    if (a.spent || !target.alive || target.team === a.owner?.team) {
      this.fx.burst(x, y, { count: 4, colors: ['#ffffff'], speed: 2, size: 0.04 });
      this.audio.impact(0.4, 'body');
      return;
    }
    const shooter = a.owner;
    const head = bone.zone === 'head';
    const headMult = Math.min(HEADSHOT, target.def?.headshot ?? HEADSHOT);
    const dmg = Math.round(a.damage * (head ? headMult : bone.mult));
    const suit = SUITS[target.look.suit] ?? SUITS.red;
    target.lastHitBy = shooter;
    this.fx.burst(x, y, { count: head ? 22 : 12, colors: [suit.body, suit.trim, '#ffffff'], speed: head ? 7 : 5, size: 0.06, dir: Math.atan2(a.vy, a.vx), spread: 2.4 });
    this.fx.text(x, y + 0.5, head ? `HEADSHOT! -${dmg}` : `-${dmg}`, { color: head ? '#ffd23a' : '#ffffff', size: head ? 30 : 24 });
    if (head) {
      this.fx.ring(target.ragdoll.head.x, target.ragdoll.head.y, { r: 0.8, color: '#ffd23a', width: 0.07 });
      this.fx.burst(x, y, { count: 6, colors: ['#ffd23a'], speed: 4, size: 0.12, shape: 'star', gravity: 4 });
      if (shooter?.human) this.heads++;
    }
    this.audio.impact(head ? 1 : 0.75, 'body');
    this.hitstop = Math.max(this.hitstop, head ? 0.11 : 0.05);
    this.view.shake(target.human ? 7 : head ? 6 : 3, 0.25);
    if (target.human && this.mode === 'solo') this.fx.screenFlash(0.35, '#ff3b30');
    this.applyEffects(a, target, x, y);
    const killed = target.hurt(dmg);
    if (shooter?.human && this.mode === 'solo' && target !== this.player) this.lastPlayerHit = this.time;
    if (killed) this.onKill(target, shooter, head);
    else if (a.fx?.blast) this.explode(x, y, a);
  }

  applyEffects(a, target, x, y) {
    const f = a.fx ?? {};
    if (f.burn) {
      target.burn = { dps: f.burn, t: f.time ?? 3 };
      this.fx.burst(x, y, { count: 10, colors: ['#ffd23a', '#ff7a1a', '#ff3b1a'], speed: 3, size: 0.07, gravity: -3 });
      this.audio.noise(0.3, { freq: 900, q: 0.6, gain: 0.25 });
    }
    if (f.poison) {
      target.poison = { dps: f.poison, t: f.time ?? 6 };
      this.fx.puff(x, y, { count: 6, color: 'rgba(122,209,58,0.7)', size: 0.2, rise: 0.6 });
    }
    if (f.stun) {
      target.stun = Math.max(target.stun, f.stun);
      target.draw = 0;
      const c = target.chest();
      for (let i = 0; i < 3; i++) this.fx.bolt(x, y, c.x + rand(-0.6, 0.6), c.y + rand(-0.8, 0.8));
      this.fx.burst(x, y, { count: 12, colors: ['#bfe9ff', '#ffffff'], speed: 5, size: 0.04, gravity: 0 });
      this.audio.zap();
    }
  }

  /** A bomb arrow going off: damage falls off with distance, everything gets thrown. */
  explode(x, y, a) {
    const r = a.fx.blast;
    this.fx.ring(x, y, { r: r * 1.3, color: '#ffd23a', width: 0.16, life: 0.4 });
    this.fx.burst(x, y, { count: 30, colors: ['#ffd23a', '#ff7a1a', '#ff3b1a', '#4a4f5c'], speed: 9, size: 0.09, gravity: 8 });
    this.fx.puff(x, y, { count: 10, color: 'rgba(70,70,80,0.6)', size: 0.4, speed: 2, rise: 1.5, life: 1.1 });
    this.fx.screenFlash(0.4, '#ffd23a');
    this.view.shake(10, 0.4);
    this.view.punch(0.06);
    this.audio.boom();
    for (const t of this.archers) {
      const c = t.chest();
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > r * 1.6) continue;
      const k = 1 - d / (r * 1.6);
      for (const p of t.ragdoll.points) {
        const dx = p.x - x;
        const dy = p.y - y;
        const l = Math.hypot(dx, dy) || 1;
        p.push((dx / l) * 14 * k, (dy / l) * 14 * k + 4 * k);
      }
      if (t.alive) t.ragdoll.muscle = Math.min(t.ragdoll.muscle, 0.2);
      if (!t.alive || t.team === a.owner?.team || d > r) continue;
      const dmg = Math.round((a.fx.blastDmg ?? 25) * (0.5 + 0.5 * k));
      t.lastHitBy = a.owner;
      this.fx.text(c.x, c.y + 0.8, `BOOM! -${dmg}`, { color: '#ffb02e', size: 26 });
      if (t.hurt(dmg)) this.onKill(t, a.owner, false);
    }
  }

  onArrowSolid(a, solid) {
    if (a.fx?.blast && !a.spent) {
      this.arrows.stickSolid(a, solid);
      this.explode(a.x, a.y, a);
      return;
    }
    this.arrows.stickSolid(a, solid);
    this.fx.burst(a.x, a.y, { count: 5, colors: solid.kind === 'ground' ? ['#8a5a2e', '#5aa94f'] : ['#d8c49a', '#9a6634'], speed: 2.5, size: 0.05 });
    this.audio.impact(0.35, solid.kind === 'tower' ? 'concrete' : 'wood');
  }

  onFruit(a, f) {
    f.gone = true;
    const owner = a.owner;
    const def = FRUIT[f.kind];
    if (f.kind === 'red') owner.heal(30);
    else if (f.kind === 'green') owner.stamina = Math.min(owner.maxStamina, owner.stamina + 50);
    else {
      this.skulls += 5;
      this.showSkulls();
    }
    this.fx.burst(f.x, f.y, { count: 20, colors: [def.color, '#ffffff'], speed: 5, size: 0.07 });
    this.fx.ring(f.x, f.y, { r: 0.7, color: def.color });
    this.fx.text(f.x, f.y + 0.5, def.label, { color: def.color, size: 24 });
    this.audio.coin(f.kind === 'gold' ? 4 : 2);
  }

  onClash(x, y) {
    this.fx.burst(x, y, { count: 18, colors: ['#ffd23a', '#ffffff'], speed: 6, size: 0.05, gravity: 6 });
    this.fx.ring(x, y, { r: 0.6, color: '#ffffff', width: 0.05, life: 0.25 });
    this.fx.text(x, y + 0.4, 'CLASH!', { color: '#ffffff', size: 22 });
    this.audio.impact(0.7, 'metal');
    this.hitstop = Math.max(this.hitstop, 0.06);
  }

  onKill(target, shooter, head) {
    const c = target.chest();
    this.slowmo = 0.3;
    this.slowT = 0.7;
    this.view.punch(0.08);
    this.view.shake(8, 0.35);
    this.fx.burst(c.x, c.y, { count: 10, colors: ['#ffd23a', '#ffffff'], speed: 5, size: 0.13, shape: 'star', gravity: 3 });
    this.fx.text(c.x, c.y + 1.2, 'K.O.!', { color: '#ff4a3d', size: 40, life: 1.2 });
    this.audio.crack();
    target.ragdoll.push(-target.side * 3, 3);
    target.goneT = 2.6;
    if (this.mode === 'solo') {
      if (target === this.player) return this.lose();
      this.kills++;
      this.beaten++;
      const won = 1 + (head ? 1 : 0) + (target.def?.boss ? (target.def.reward ?? 15) : 0);
      this.skulls += won;
      this.fx.text(c.x, c.y + 2, `+${won} 💀`, { color: '#ffffff', size: 26, life: 1.3, rise: 1 });
      this.game.ui.hudApi?.set('score', `${this.beaten}/${this.total}`);
      this.game.ui.hudApi?.bump('score');
      this.showSkulls();
      if (this.beaten >= this.total) this.win();
      else this.nextFoeT = 1.6;
      return;
    }
    if (this.mode === 'show') return;
    const winner = this.sides.indexOf(shooter);
    this.wins[winner] = (this.wins[winner] ?? 0) + 1;
    this.phase = 'end';
    this.endT = 2;
    this.roundWinner = winner;
  }

  showSkulls() {
    this.game.ui.hudApi?.set('kills', this.game.save.data.skulls + this.skulls);
    this.game.ui.hudApi?.bump('kills');
  }

  win() {
    this.phase = 'end';
    this.endT = 2.3;
    this.passed = true;
    this.audio.win();
    const c = this.player.headPos();
    this.fx.burst(c.x, c.y + 1, { count: 70, colors: ['#ffd23a', '#ff4a3d', '#35c24a', '#2f7de1', '#ffffff'], speed: 9, size: 0.08, life: 1.6, gravity: 8 });
    this.game.ui.banner(this.spec.bonus ? 'BOSS BEATEN!' : 'LEVEL CLEAR!', this.spec.boss ? `${this.spec.foes.at(-1).name} is down` : `${this.total} archers down`);
  }

  lose() {
    this.phase = 'end';
    this.endT = 1.8;
    this.passed = false;
    this.audio.lose();
  }

  /** Back up with most of his health to finish the level. */
  revive() {
    const p = this.player;
    p.alive = true;
    p.hp = Math.round(p.maxHp * 0.6);
    p.stamina = p.maxStamina;
    p.ragdoll.muscle = 0.3;
    this.arrows.release(p);
    this.phase = 'play';
    this.aims.clear();
    const h = p.home;
    const c = p.ragdoll.pelvis;
    p.ragdoll.teleport(h.x - c.x, h.y + 0.9 - c.y);
    this.fx.ring(h.x, h.y + 1, { r: 1.4, color: '#35c24a', width: 0.1 });
    this.fx.burst(h.x, h.y + 1, { count: 24, colors: ['#35c24a', '#ffffff'], speed: 5, size: 0.08, shape: 'star', gravity: 2 });
  }

  // ---------- running ----------

  fixedStep() {
    this.simTime = (this.simTime ?? 0) + STEP;
    for (const s of this.solids) {
      if (!s.bob) continue;
      const y = s.bob.base + Math.sin(this.simTime * s.bob.speed + s.bob.phase) * s.bob.amp;
      s.dy = y - s.y;
      s.dx = 0;
      s.y = y;
    }
    for (const a of this.archers) a.step(this.solids);
    this.arrows.step();
  }

  update(dt) {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.fx.update(dt * 0.15);
      this.view.update(dt);
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slowmo = 1;
    }
    const sdt = dt * this.slowmo;
    this.time += sdt;
    this.acc += sdt;
    let n = 0;
    while (this.acc >= STEP && n < 10) {
      this.fixedStep();
      this.acc -= STEP;
      n++;
    }
    if (n >= 10) this.acc = 0;
    if (this.keyDraw !== undefined && this.player?.alive) this.player.draw = Math.min(1, (this.time - this.keyDraw) / 0.8);
    for (const a of this.archers) this.tickArcher(a, sdt);
    this.fruit.update(sdt, this.phase === 'play' && this.mode !== 'show' && (this.mode !== 'solo' || this.foe?.alive));
    if (this.mode === 'solo') this.tickSolo(sdt);
    else this.tickDuel(sdt);
    this.fx.update(sdt);
    this.frameCamera();
    this.view.update(dt);
    this.game.ui.hudApi?.vitals?.(this.vitals());
  }

  tickArcher(a, dt) {
    const regen = a.brain ? 0 : a.regen;
    const hurt = a.tick(dt, regen);
    if (hurt > 0 && a.hurt(hurt)) this.onKill(a, a.lastHitBy, false);
    if (a.burn && Math.random() < dt * 30) {
      const c = a.chest();
      this.fx.burst(c.x + rand(-0.2, 0.2), c.y + rand(-0.5, 0.4), { count: 1, colors: ['#ffd23a', '#ff7a1a', '#ff3b1a'], speed: 0.6, size: 0.08, gravity: -5, life: 0.5, shape: 'dot' });
    }
    if (a.poison && Math.random() < dt * 8) {
      const c = a.chest();
      this.fx.puff(c.x + rand(-0.2, 0.2), c.y + rand(-0.4, 0.4), { count: 1, color: 'rgba(122,209,58,0.6)', size: 0.08, rise: 0.8, life: 0.7 });
    }
    if (a.brain && this.phase === 'play') {
      const target = this.mode === 'solo' ? this.player : this.sides.find((s) => s !== a);
      a.brain.think(a, target, dt, (x) => this.foeShoot(x));
      if (a.brain.dodge(a, this.arrows.flying)) this.audio.jump(false);
    }
    // Landing from a drop-in or a big jump.
    if (a.landed > 6) {
      const h = a.home;
      this.fx.puff(h.x, h.y + 0.05, { count: 8, color: 'rgba(255,255,255,0.7)', size: 0.2, speed: 1.5, rise: 0.2 });
      this.audio.impact(0.6, 'wood');
    }
    a.landed = 0;
  }

  tickSolo(dt) {
    for (const a of [...this.archers]) {
      if (a === this.player || a.goneT === undefined) continue;
      a.goneT -= dt;
      if (a.goneT <= 0) this.retire(a);
    }
    if (this.phase === 'play' && this.queue.length && !this.archers.some((a) => a.team === 'foe' && a.alive)) {
      this.nextFoeT -= dt;
      if (this.nextFoeT <= 0) this.spawnFoe();
    }
    if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.phase = 'done';
        this.game.levelOver(this, this.result());
      }
    }
  }

  tickDuel(dt) {
    if (this.mode === 'show') {
      for (const [i, a] of this.sides.entries()) {
        if (a.alive || (a.goneT -= dt) > 0) continue;
        // In the title show the fallen archer just pops back up.
        a.alive = true;
        a.hp = a.maxHp;
        a.goneT = undefined;
        this.arrows.release(a);
        const h = a.home;
        const c = a.ragdoll.pelvis;
        a.ragdoll.teleport(h.x - c.x, h.y + 6 - c.y);
        a.jumpY = 6;
        a.jumpV = -2;
        a.brain = new Brain(a.brain.def);
        this.sides[i] = a;
      }
      return;
    }
    if (this.phase === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.phase = 'done';
        this.game.roundOver(this, { winner: this.roundWinner, wins: this.wins, round: this.round });
      }
    }
  }

  result() {
    return {
      passed: this.passed,
      level: this.spec.n,
      boss: this.spec.boss,
      bonus: this.spec.bonus,
      kills: this.kills,
      heads: this.heads,
      skulls: this.skulls,
      beaten: this.beaten,
      total: this.total,
    };
  }

  vitals() {
    const v = (a) => a && { hp: a.hp, maxHp: a.maxHp, stamina: a.stamina, maxStamina: a.maxStamina };
    return this.mode === 'solo' ? [v(this.player)] : this.sides.map(v);
  }

  // ---------- camera ----------

  frameCamera(snap = false) {
    const v = this.view;
    const portrait = v.portrait;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const take = (a) => {
      const h = a.home;
      x0 = Math.min(x0, h.x);
      x1 = Math.max(x1, h.x);
      y0 = Math.min(y0, h.y);
      y1 = Math.max(y1, h.y + 1.9 * a.size);
    };
    if (this.mode === 'solo') {
      take(this.player);
      const foe = this.archers.find((a) => a.team === 'foe' && !a.retired);
      if (foe) take(foe);
      else x1 = Math.max(x1, this.player.home.x + (portrait ? 5.5 : 10));
    } else this.sides.forEach(take);
    const dist = x1 - x0;
    const side = portrait ? 1.15 : 1.6;
    x0 -= side;
    x1 += side;
    y0 -= 0.7;
    y1 += 1.4 + dist * 0.07;
    const pad = portrait ? [110, 14, 96, 14] : [96, 24, 30, 24];
    v.frame(x0, y0, x1, y1, { pad, maxS: Math.min(v.h / 5.2, v.w / 3.6), snap });
  }

  // ---------- drawing ----------

  draw() {
    const v = this.view;
    const ctx = v.ctx;
    v.screen();
    drawSky(ctx, v, this.theme, this.time);
    v.world();
    const b = v.bounds();
    drawGround(ctx, this.theme, b);
    for (const s of this.solids) drawSolid(ctx, s, this.theme);
    this.fruit.draw(ctx);
    // The dead first, so the living are drawn over them.
    const order = [...this.archers].sort((a, c) => Number(a.alive) - Number(c.alive));
    for (const a of order) drawArcher(ctx, a, this.time);
    this.drawTrails(ctx);
    this.arrows.draw(ctx);
    this.drawAim(ctx);
    this.fx.draw(ctx);
    v.screen();
    this.drawBars(ctx);
    this.drawIncoming(ctx);
    this.fx.drawScreen(ctx, v);
    this.drawDanger(ctx);
  }

  drawTrails(ctx) {
    ctx.lineCap = 'round';
    for (const a of this.arrows.flying) {
      a.trail.push(a.x, a.y);
      if (a.trail.length > 16) a.trail.splice(0, 2);
      const t = a.trail;
      if (t.length < 4) continue;
      const color = ARROWS[a.type]?.color ?? '#ffffff';
      ctx.strokeStyle = a.type === 'basic' ? 'rgba(255,255,255,0.55)' : color;
      ctx.globalAlpha = a.type === 'basic' ? 1 : 0.6;
      ctx.lineWidth = a.type === 'fire' ? 0.12 : 0.05;
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      for (let i = 2; i < t.length; i += 2) ctx.lineTo(t[i], t[i + 1]);
      ctx.stroke();
      if (a.type === 'fire' && Math.random() < 0.5) this.fx.burst(a.x, a.y, { count: 1, colors: ['#ffd23a', '#ff7a1a'], speed: 0.5, size: 0.06, gravity: -3, life: 0.35, shape: 'dot' });
    }
    ctx.globalAlpha = 1;
  }

  /** Dotted arc showing where the shot being drawn will go: just the first part, like a real eye. */
  drawAim(ctx) {
    for (const a of this.humans()) {
      if (!a.alive || a.draw < 0.08) continue;
      const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * a.draw;
      const m = a.muzzle();
      const vx = Math.cos(a.angle) * a.side * speed;
      const vy = Math.sin(a.angle) * speed;
      ctx.fillStyle = '#ffffff';
      for (let i = 1; i <= DOTS; i++) {
        const t = i * 0.045;
        ctx.globalAlpha = 0.9 * (1 - i / (DOTS + 2));
        ctx.beginPath();
        ctx.arc(m.x + vx * t, m.y + vy * t - 0.5 * ARROW_G * t * t, 0.07 * (1 - i / (DOTS * 1.6)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Health bars over the enemies' heads (the player's own are in the HUD). */
  drawBars(ctx) {
    const at = {};
    for (const a of this.archers) {
      if (!a.alive || a.human) continue;
      if (this.mode !== 'solo') continue;
      const h = a.ragdoll.head;
      this.view.toScreen(h.x, h.y + 0.42 * a.size, at);
      const boss = a.def?.boss;
      const w = boss ? 96 : 54;
      const hh = boss ? 11 : 8;
      ctx.fillStyle = 'rgba(20,22,28,0.8)';
      roundRect(ctx, at.x - w / 2 - 2, at.y - hh / 2 - 2, w + 4, hh + 4, 5);
      ctx.fillStyle = boss ? '#ffd23a' : '#ff4a3d';
      roundRect(ctx, at.x - w / 2, at.y - hh / 2, (w * a.hp) / a.maxHp, hh, 3);
      if (boss && a.def?.name) {
        ctx.font = '15px "Lilita One", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1b1d24';
        ctx.strokeText(a.def.name, at.x, at.y - 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(a.def.name, at.x, at.y - 14);
      }
    }
  }

  /** Little arrows at the top edge for enemy shots arcing overhead. */
  drawIncoming(ctx) {
    const at = {};
    for (const a of this.arrows.flying) {
      if (a.spent || a.owner?.human) continue;
      this.view.toScreen(a.x, a.y, at);
      if (at.y > 8) continue;
      const x = Math.max(12, Math.min(this.view.w - 12, at.x));
      ctx.fillStyle = '#ff4a3d';
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x - 7, 18);
      ctx.lineTo(x + 7, 18);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Red edges when the player is nearly done for. */
  drawDanger(ctx) {
    const p = this.player;
    if (this.mode !== 'solo' || !p.alive || p.hp / p.maxHp > 0.3) return;
    const v = this.view;
    const pulse = 0.35 + 0.2 * Math.sin(this.time * 8);
    const g = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(220,20,20,${pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (w <= 0) return;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}
