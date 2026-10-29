import { platform } from '../platform/index.js';
import { Match } from '../game/match.js';
import { level, bonusLevel } from '../game/foes.js';
import { ARROWS, STATS, SUITS, playerStats } from '../game/catalog.js';

// Interstitials on a 3–5–3 rhythm of levels: after levels 3, 8 and 11, then
// the same again every eleven levels (14, 19, 22…). Boss levels are ordinary
// levels and count; the bonus boss doesn't.
const BREAKS = [3, 8, 11];
const adAfter = (n) => n > 0 && BREAKS.includes(((n - 1) % 11) + 1);
// The Golden Archer is offered (for a rewarded ad) after every sixth level.
const BONUS_EVERY = 6;
const ROUNDS_TO_WIN = 2;

/** Top-level flow: title → levels → results, shop and ads, plus the frame loop. */
export class Game {
  constructor({ view, fx, ui, audio, save, input }) {
    this.view = view;
    this.fx = fx;
    this.ui = ui;
    this.audio = audio;
    this.save = save;
    this.input = input;
    this.scene = null;
    this.paused = false;
    this.last = performance.now();
    this.lastAdAfter = 0;
    this.trial = null; // an arrow lent for one level by a rewarded ad

    ui.onPause = () => this.pause();
    ui.onSettingsChanged = () => this.applySettings();
    this.applySettings();

    platform.onPause(() => this.pause(true));
    platform.onResume(() => !this.adPlaying && this.audio.resume());
    platform.onAudioEnabledChange((on) => this.audio.setEnabled(on));
    this.audio.setEnabled(platform.isAudioEnabled());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(true);
      else if (!this.adPlaying) this.audio.resume();
    });

    // The first gesture unlocks audio (browsers require it).
    window.addEventListener('pointerdown', () => this.unlockAudio(), { capture: true });
    window.addEventListener('keydown', () => this.unlockAudio(), { capture: true });
  }

  unlockAudio() {
    this.audio.unlock();
    if (this.save.data.music) this.audio.startMusic();
  }

  applySettings() {
    this.audio.setSfx(this.save.data.sfx);
    this.audio.setMusic(this.save.data.music);
    if (this.save.data.music) this.audio.startMusic();
  }

  setScene(scene) {
    this.scene = scene;
    this.input.handler = scene.mode === 'show' ? null : scene;
  }

  showTitle() {
    platform.gameplayStop();
    this.paused = false;
    this.ui.clearHud();
    this.ui.closeModal();
    if (this.scene?.mode !== 'show') this.setScene(new Match(this, { mode: 'show', theme: 'meadow' }));
    this.input.handler = null;
    const d = this.save.data;
    this.ui.title({
      level: d.level,
      boss: level(d.level).boss,
      skulls: d.skulls,
      onPlay: () => this.startLevel(d.level),
      onDuel: () => this.startDuel(),
      onShop: () => this.openShop(() => this.showTitle()),
      onSettings: () => this.ui.settings({ save: this.save, onClose: () => this.ui.closeModal() }),
    });
  }

  /** The arrow the player fights with this level, and at what upgrade level. */
  loadout() {
    const d = this.save.data;
    if (this.trial) return { arrow: this.trial, arrowLv: Math.max(1, d.arrows[this.trial] ?? 1) };
    const arrow = d.arrows[d.equip] ? d.equip : 'basic';
    return { arrow, arrowLv: d.arrows[arrow] };
  }

  startLevel(n) {
    this.play(level(n));
  }

  startBonus() {
    this.play(bonusLevel(this.save.data.level));
  }

  play(spec) {
    const d = this.save.data;
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.revived = false;
    this.current = { mode: 'solo', spec };
    const { arrow, arrowLv } = this.loadout();
    this.setScene(new Match(this, { mode: 'solo', spec, suit: d.suit, stats: playerStats(d), arrow, arrowLv }));
    this.hud(spec, 0, arrow);
    platform.levelEvent('level_started');
    const title = spec.bonus ? 'Bonus boss' : spec.boss ? `Level ${spec.n}: Boss!` : `Level ${spec.n}`;
    const sub = spec.bonus ? 'The Golden Archer' : this.trial ? `Trying the ${ARROWS[this.trial].name}` : 'Get ready!';
    const seen = d.seen ?? [];
    if (!seen.includes('solo')) {
      this.paused = true;
      this.ui.intro({
        name: 'Floppy Archers',
        icon: 'target',
        goal: 'Knock out every enemy archer before they knock you out.',
        how: [
          ['back', 'Drag back anywhere to aim and pull the bow'],
          ['play', 'Let go to shoot. Headshots hit twice as hard'],
          ['next', 'Tap JUMP to hop over arrows'],
          ['star', 'Shoot the apples: red heals, green gives stamina, gold gives skulls'],
          ['skull', 'Spend skulls in the shop on new arrows and upgrades'],
        ],
        onGo: () => {
          this.save.set('seen', [...seen, 'solo']);
          this.ui.closeModal();
          this.paused = false;
          this.last = performance.now();
          this.go(title, sub);
        },
      });
    } else this.go(title, sub);
  }

  hud(spec, beaten, arrow) {
    this.ui.archeryHud({
      mode: 'solo',
      title: spec.bonus ? 'BONUS' : spec.boss ? `BOSS · ${spec.n}` : `Level ${spec.n}`,
      skulls: this.save.data.skulls,
      total: spec.foes.length,
      beaten,
      arrow,
      onJump: () => this.scene.jump(this.scene.player),
    });
  }

  go(text, sub) {
    this.ui.banner(text, sub);
    this.ui.hint('Drag back to aim · let go to shoot');
    platform.gameplayStart();
  }

  startDuel(round = 1, wins = [0, 0]) {
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.current = { mode: 'duel', round, wins };
    this.setScene(new Match(this, { mode: 'duel', round, wins, suit: this.save.data.suit, theme: ['meadow', 'desert', 'snow', 'dusk'][(round - 1) % 4] }));
    this.ui.archeryHud({ mode: 'duel', round, wins, onJump: (i) => this.scene.jump(this.scene.sides[i]) });
    platform.levelEvent('level_started');
    this.ui.banner(`Round ${round}`, 'Player 1 on the left · Player 2 on the right');
    this.ui.hint('Each player drags on their own half');
    platform.gameplayStart();
  }

  /** A level is won or lost: bank what was earned and show how it went. */
  levelOver(scene, r) {
    if (this.scene !== scene) return;
    const d = this.save.data;
    d.kills += r.kills;
    d.skulls += r.skulls;
    if (r.passed && !r.bonus) {
      d.level = r.level + 1;
      d.best = Math.max(d.best, r.level);
    }
    this.save.flush();
    this.ui.clearHint();
    this.trial = null;
    platform.sendScore(d.best);
    platform.levelEvent(r.passed ? 'level_completed' : 'level_failed');
    platform.gameplayStop();
    this.result = { scene, r, doubled: false, reviveGone: false };
    this.showResult();
  }

  showResult() {
    const res = this.result;
    const { scene, r } = res;
    const d = this.save.data;
    this.ui.levelResult({
      ...r,
      ads: platform.ads,
      canRevive: !r.passed && !this.revived && !res.reviveGone,
      canDouble: r.passed && r.skulls > 0 && !res.doubled,
      onRevive: async () => {
        if (!(await this.earn('revive', 'revive'))) return;
        this.revived = true;
        this.ui.closeModal();
        scene.revive();
        this.hud(scene.spec, scene.beaten, scene.player.loaded);
        platform.gameplayStart();
        this.ui.toast('Back in the fight!');
      },
      onDouble: async () => {
        if (!(await this.earn('double your skulls', 'double-skulls'))) return false;
        res.doubled = true;
        d.skulls += r.skulls;
        this.save.flush();
        return true;
      },
      onRetry: () => (r.bonus ? this.startBonus() : this.startLevel(r.level)),
      onNext: () => this.afterLevel(r),
      onShop: () => {
        res.reviveGone = true;
        this.openShop(() => this.showResult());
      },
      onHome: () => this.showTitle(),
    });
  }

  /** Between levels: maybe the bonus boss offer, maybe an interstitial, then on. */
  async afterLevel(r) {
    const next = this.save.data.level;
    if (r.bonus) return this.startLevel(next);
    if (r.level % BONUS_EVERY === 0 && platform.ads) {
      return this.ui.bossOffer({
        level: next,
        reward: 60,
        onFight: async () => {
          if (await this.earn('fight the Golden Archer', 'bonus-boss')) this.startBonus();
        },
        onSkip: () => this.toNext(r.level),
      });
    }
    this.toNext(r.level);
  }

  async toNext(done) {
    if (platform.ads && adAfter(done) && done !== this.lastAdAfter) {
      this.lastAdAfter = done;
      await this.showAd('interstitial');
    }
    this.startLevel(this.save.data.level);
  }

  /** A duel round ends; first to two wins the match. */
  roundOver(scene, { winner, wins, round }) {
    if (this.scene !== scene) return;
    platform.gameplayStop();
    this.ui.clearHint();
    const over = wins[winner] >= ROUNDS_TO_WIN;
    platform.levelEvent('level_completed');
    this.ui.duelResult({
      winner,
      wins,
      over,
      onNext: () => (over ? this.startDuel(1, [0, 0]) : this.startDuel(round + 1, wins)),
      onHome: () => this.showTitle(),
    });
  }

  // ---------- the shop ----------

  openShop(onClose) {
    const d = this.save.data;
    const spend = (cost) => {
      if (d.skulls < cost) {
        this.ui.toast('Not enough skulls yet!');
        this.audio.lose();
        return false;
      }
      d.skulls -= cost;
      this.audio.coin(4);
      return true;
    };
    const refresh = (tab) => this.ui.shop({ save: this.save, ads: platform.ads, tab, handlers, onClose });
    const handlers = {
      arrow: (id) => {
        const lv = d.arrows[id] ?? 0;
        const price = ARROWS[id].price[lv];
        if (price === undefined || !spend(price)) return;
        d.arrows = { ...d.arrows, [id]: lv + 1 };
        if (!lv) d.equip = id;
        this.save.flush();
        refresh('arrows');
      },
      equip: (id) => {
        if (!d.arrows[id]) return;
        this.save.set('equip', id);
        refresh('arrows');
      },
      try: async (id) => {
        if (!(await this.earn('try this arrow', 'try-arrow'))) return;
        this.trial = id;
        this.ui.toast(`${ARROWS[id].name} is yours for the next level!`);
        refresh('arrows');
      },
      stat: (id) => {
        const lv = d.stats[id] ?? 0;
        const price = STATS[id].price[lv];
        if (price === undefined || !spend(price)) return;
        d.stats = { ...d.stats, [id]: lv + 1 };
        this.save.flush();
        refresh('upgrades');
      },
      suit: (id) => {
        if (!d.owned.includes(id)) {
          if (!spend(SUITS[id].price)) return;
          d.owned = [...d.owned, id];
        }
        d.suit = id;
        this.save.flush();
        refresh('colours');
      },
    };
    refresh('arrows');
  }

  // ---------- ads ----------

  /** The ad that plays once as the game opens, where the platform runs ads. */
  async preroll() {
    if (platform.ads) await this.showAd('interstitial');
  }

  /** Plays a platform ad with the game paused and muted, then picks up where it was. */
  async showAd(kind, reward) {
    this.adPlaying = true;
    this.ui.modalEl.classList.add('ad-hold');
    this.paused = true;
    this.audio.suspend();
    platform.gameplayStop();
    const outcome = kind === 'rewarded' ? await platform.rewarded(reward) : (await platform.interstitial(), 'done');
    this.adPlaying = false;
    this.ui.modalEl.classList.remove('ad-hold');
    this.paused = false;
    this.last = performance.now();
    this.audio.resume();
    return outcome;
  }

  /**
   * Rewarded ads only pay out for a finished ad. If none can be served the
   * reward is given anyway; closing the ad early gives nothing.
   */
  async earn(reason, reward) {
    if (!platform.ads) return true;
    const outcome = await this.showAd('rewarded', reward);
    if (outcome === 'skipped') {
      this.ui.toast(`Watch the whole ad to ${reason}`);
      return false;
    }
    return true;
  }

  // ---------- pause and the loop ----------

  restart() {
    if (this.current?.mode === 'duel') this.startDuel(this.current.round, this.current.wins);
    else this.play(this.current.spec);
  }

  pause(fromSystem = false) {
    if (this.adPlaying) return;
    if (fromSystem) this.audio.suspend();
    if (!this.scene || this.scene.mode === 'show' || this.ui.modalOpen || this.paused) return;
    this.paused = true;
    platform.gameplayStop();
    this.ui.pause({
      save: this.save,
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onHome: () => this.showTitle(),
    });
  }

  resume() {
    this.paused = false;
    this.ui.closeModal();
    platform.gameplayStart();
    this.audio.resume();
    this.last = performance.now();
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.view.resize();
    const s = this.scene;
    if (!s) return;
    if (!this.paused) s.update(dt);
    s.draw();
  }

  run() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      try {
        this.frame(now);
      } catch (err) {
        platform.logError(err);
      }
    };
    requestAnimationFrame(loop);
  }
}
