import { STEP } from '../physics/physics.js';
import { platform } from '../platform/index.js';
import { Match } from '../archery/match.js';
import { offer, PERKS } from '../archery/perks.js';
import { SUIT_PRICES } from '../ui/ui.js';

// Interstitials on a 3–5–3 rhythm of waves: after waves 3, 8 and 11, then the
// same again every eleven waves (14, 19, 22…).
const BREAKS = [3, 8, 11];
const adAfter = (n) => n > 0 && BREAKS.includes(((n - 1) % 11) + 1);
const ROUNDS_TO_WIN = 2;

/** Top-level flow: title → waves → results and upgrades, plus the frame loop. */
export class Game {
  constructor({ stage, ui, audio, save, input, fx, rig }) {
    this.stage = stage;
    this.ui = ui;
    this.audio = audio;
    this.save = save;
    this.input = input;
    this.fx = fx;
    this.rig = rig;
    this.scene = null;
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.timeScale = 1;
    // Ads: one as the game opens, interstitials between waves on the BREAKS
    // rhythm, rewarded ads for a revive and for doubling a wave's coins.
    this.lastAdAfter = 0;

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

    // First user gesture unlocks audio (browsers require it).
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
    this.scene?.dispose();
    this.fx.clear();
    this.acc = 0;
    this.scene = scene;
    this.input.handler = scene;
    scene.build();
  }

  showTitle() {
    platform.gameplayStop();
    this.paused = false;
    this.ui.clearHud();
    this.ui.closeModal();
    if (this.scene?.mode !== 'show') this.setScene(new Match(this, { mode: 'show', theme: 'dusk' }));
    this.input.handler = null;
    const d = this.save.data;
    this.ui.title({
      wave: d.wave,
      kills: d.kills,
      coins: d.coins,
      onPlay: () => this.startWave(d.wave),
      onDuel: () => this.startDuel(),
      onSettings: () => this.ui.settings({ save: this.save, onClose: () => this.ui.closeModal() }),
      onWardrobe: () => this.openWardrobe(),
    });
  }

  openWardrobe() {
    this.ui.wardrobe({
      save: this.save,
      onPick: (id) => {
        const d = this.save.data;
        if (!d.owned.includes(id)) {
          if (d.coins < SUIT_PRICES[id]) return false;
          d.coins -= SUIT_PRICES[id];
          d.owned = [...d.owned, id];
        }
        this.save.set('suit', id);
        if (this.scene?.mode === 'show') this.showTitle();
        return true;
      },
      onClose: () => this.ui.closeModal(),
    });
  }

  startWave(n) {
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.revived = false;
    this.current = { mode: 'solo', wave: n };
    this.setScene(new Match(this, { mode: 'solo', wave: n, perks: this.save.data.perks, theme: n % 5 === 0 ? 'sunset' : 'dusk' }));
    this.ui.archeryHud({ mode: 'solo', wave: n, kills: this.save.data.kills, total: this.scene.total, onJump: (i) => this.scene.jump(this.scene.player) });
    platform.levelEvent('level_started');
    const seen = this.save.data.seen ?? [];
    if (!seen.includes('solo')) {
      this.paused = true;
      this.ui.intro({
        name: 'Floppy Archers',
        icon: 'target',
        goal: 'Knock out every enemy archer in the wave before they get you.',
        how: [
          ['back', 'Drag back anywhere to aim and pull the bow'],
          ['play', 'Let go to fire — headshots hit hardest'],
          ['next', 'Tap JUMP to dodge incoming arrows'],
          ['star', 'Shoot the apples: red heals, green restores stamina, gold is coins'],
        ],
        onGo: () => {
          this.save.set('seen', [...seen, 'solo']);
          this.ui.closeModal();
          this.paused = false;
          this.last = performance.now();
          this.go(`Wave ${n}`);
        },
      });
    } else this.go(`Wave ${n}`);
  }

  go(text, sub = 'Get ready!') {
    this.ui.banner(text, sub);
    this.ui.hint('Drag back to aim · let go to fire');
    platform.gameplayStart();
  }

  startDuel(round = 1, wins = [0, 0]) {
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.current = { mode: 'duel', round, wins };
    this.setScene(new Match(this, { mode: 'duel', round, wins, theme: 'noon' }));
    this.ui.archeryHud({ mode: 'duel', round, wins, onJump: (i) => this.scene.jump(this.scene.sides[i]) });
    platform.levelEvent('level_started');
    this.go(`Round ${round}`, 'Player 1 on the left · Player 2 on the right');
  }

  /** A wave is won or lost; bank what was earned and show how it went. */
  waveOver(scene, r) {
    if (this.scene !== scene) return;
    const d = this.save.data;
    d.kills += r.kills;
    d.coins += r.coins;
    if (r.passed) {
      d.wave = r.wave + 1;
      d.best = Math.max(d.best, r.wave);
    }
    this.save.flush();
    this.ui.clearHint();
    platform.sendScore(d.kills);
    platform.levelEvent(r.passed ? 'level_completed' : 'level_failed');
    platform.gameplayStop();
    this.ui.waveResult({
      ...r,
      ads: platform.ads,
      canRevive: !r.passed && !this.revived,
      canDouble: r.passed && r.coins > 0,
      onRevive: async () => {
        if (!(await this.earn('revive', 'revive'))) return;
        this.revived = true;
        this.ui.closeModal();
        scene.revive();
        this.ui.archeryHud({ mode: 'solo', wave: r.wave, kills: d.kills, total: r.total, beaten: r.beaten, onJump: () => this.scene.jump(this.scene.player) });
        platform.gameplayStart();
        this.ui.toast('Back in the fight!');
      },
      onDouble: async () => {
        if (!(await this.earn('double your coins', 'double-coins'))) return false;
        d.coins += r.coins;
        this.save.flush();
        return true;
      },
      onRetry: () => this.startWave(r.wave),
      onNext: () => this.pickPerk(() => this.nextWave(r.wave + 1)),
      onHome: () => this.showTitle(),
    });
  }

  /** After a cleared wave: choose one of three upgrades (once they're all maxed, skip straight on). */
  pickPerk(then) {
    const have = this.save.data.perks;
    const choices = offer(have);
    if (!choices.length) return then();
    this.ui.perks({
      choices,
      have,
      onPick: (id) => {
        this.save.set('perks', { ...have, [id]: (have[id] ?? 0) + 1 });
        this.ui.toast(`${PERKS.find((p) => p.id === id).name}!`);
        then();
      },
    });
  }

  async nextWave(n) {
    const done = n - 1;
    if (platform.ads && adAfter(done) && done !== this.lastAdAfter) {
      this.lastAdAfter = done;
      await this.showAd('interstitial');
    }
    this.startWave(n);
  }

  /** A duel round ends; first to two rounds wins the match. */
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
   * Rewarded ads only ever pay out for a finished ad. If none can be served
   * the reward is given anyway; closing the ad early gives nothing.
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

  restart() {
    if (this.current?.mode === 'duel') this.startDuel(this.current.round, this.current.wins);
    else this.startWave(this.current?.wave ?? this.save.data.wave);
  }

  pause(fromSystem = false) {
    if (this.adPlaying) return;
    if (!this.scene || this.scene.mode === 'show' || this.ui.modalOpen) {
      if (fromSystem) this.audio.suspend();
      return;
    }
    if (fromSystem) this.audio.suspend();
    if (this.paused) return;
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
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.stage.resize();
    const s = this.scene;
    if (s && !this.paused) {
      this.acc += dt * s.slowmo * this.timeScale;
      const maxSteps = 4 * this.timeScale;
      let steps = 0;
      while (this.acc >= STEP && steps < maxSteps) {
        s.fixedUpdate(STEP);
        s.physics.step();
        this.acc -= STEP;
        steps++;
      }
      if (steps >= maxSteps) this.acc = 0;
      s.physics.sync(this.acc / STEP);
      s.update(dt * s.slowmo * this.timeScale);
      this.fx.update(dt);
    }
    this.rig.update(dt);
    const cam = this.stage.camera;
    const fov = this.stage.baseFov + this.rig.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.stage.render();
    if (!this.paused) this.stage.trackFrame(dt);
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
