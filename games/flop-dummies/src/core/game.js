import { STEP } from '../physics/physics.js';
import { platform } from '../platform/index.js';
import { DEPARTMENTS, levelAt, numberOf } from '../levels/index.js';
import { Showcase } from '../modes/showcase.js';
import { SUIT_UNLOCKS } from '../ui/ui.js';

/** Top-level flow: title → an endless run of levels → results, plus the frame loop. */
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
    this.baseFov = stage.camera.fov;
    this.timeScale = 1;
    // Ads: an interstitial after every second level passed, and a rewarded ad
    // on every second revive and on every skip. Retrying never shows an ad.
    this.passedSinceAd = 0;
    this.revives = 0;

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

  totalStars() {
    return DEPARTMENTS.reduce((n, d) => n + this.save.totalStars(d.levels.map((l) => l.id)), 0);
  }

  showTitle() {
    platform.gameplayStop();
    this.ui.clearHud();
    this.ui.closeModal();
    if (!(this.scene instanceof Showcase)) this.setScene(new Showcase(this, { theme: 'morning' }, { theme: 'morning' }));
    this.input.handler = null;
    this.ui.title({
      level: this.save.data.level,
      canReplay: this.replayGroups().length > 0,
      onPlay: () => this.startLevel(this.save.data.level),
      onReplay: () => this.showReplay(),
      onSettings: () => this.ui.settings({ save: this.save, onClose: () => this.ui.closeModal() }),
      onWardrobe: () => this.openWardrobe(),
    });
  }

  /** Passed levels, grouped by department in the order they were met. */
  replayGroups() {
    return DEPARTMENTS.map((dept) => ({
      dept,
      entries: dept.levels
        .map((level) => ({ level, rec: this.save.level(level.id) }))
        .filter((e) => e.rec.done)
        .map((e) => ({ ...e, n: e.rec.n ?? numberOf(e.level.id) }))
        .sort((a, b) => a.n - b.n),
    })).filter((g) => g.entries.length > 0);
  }

  showReplay() {
    this.ui.replay({
      groups: this.replayGroups(),
      onPick: (n) => this.startLevel(n, { replay: true }),
      onBack: () => this.showTitle(),
    });
  }

  openWardrobe() {
    this.ui.wardrobe({
      save: this.save,
      totalStars: this.totalStars(),
      onPick: (id) => {
        if (this.totalStars() >= SUIT_UNLOCKS[id]) this.save.set('suit', id);
      },
      onClose: () => this.ui.closeModal(),
    });
  }

  /** Level numbers just keep counting; the course behind each one comes from the endless sequence. */
  startLevel(n, { replay = false } = {}) {
    const { dept, level } = levelAt(n);
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.current = { n, dept, level, replay };
    this.setScene(new dept.Mode(this, level, dept));
    this.ui.banner(`Level ${n}`, level.name);
    platform.levelEvent('level_started');
    platform.gameplayStart();
  }

  /** Plays a platform ad with the game paused and muted, then picks up where it was. */
  async showAd(kind) {
    this.adPlaying = true;
    this.ui.modalEl.classList.add('ad-hold');
    this.paused = true;
    this.audio.suspend();
    platform.gameplayStop();
    const outcome = kind === 'rewarded' ? await platform.rewarded() : (await platform.interstitial(), 'done');
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
  async earn(reason) {
    if (!platform.ads) return true;
    const outcome = await this.showAd('rewarded');
    if (outcome === 'skipped') {
      this.ui.toast(`Watch the whole ad to ${reason}`);
      return false;
    }
    return true;
  }

  async nextLevel(n) {
    if (platform.ads && this.passedSinceAd >= 2) {
      this.passedSinceAd = 0;
      await this.showAd('interstitial');
    }
    this.startLevel(n);
  }

  async skipLevel(n) {
    if (!(await this.earn('skip this level'))) return;
    this.save.data.level = Math.max(this.save.data.level, n + 1);
    this.save.flush();
    this.startLevel(n + 1);
  }

  /** Every second revive is paid for with a rewarded ad. */
  async revive() {
    const paid = (this.revives + 1) % 2 === 0;
    if (paid && !(await this.earn('revive'))) return;
    this.revives++;
    const scene = this.scene;
    this.ui.closeModal();
    scene.state = 'play';
    scene.revive();
    platform.gameplayStart();
    this.ui.toast('Revived!');
  }

  levelFinished(level, result) {
    const { n, level: def, replay } = this.current;
    const prev = this.save.level(def.id);
    this.save.record(def.id, { stars: result.stars, score: result.passed ? result.score : 0, done: result.passed, n });
    if (result.passed) {
      this.save.data.level = Math.max(this.save.data.level, n + 1);
      this.save.data.score += Math.round(result.score);
      this.save.flush();
      platform.sendScore(this.save.data.score);
      this.passedSinceAd++;
      this.audio.win();
      this.fx.confetti(this.rig.look.clone(), 120);
      platform.happy();
    } else {
      this.audio.lose();
    }
    platform.levelEvent(result.passed ? 'level_completed' : 'level_failed');
    platform.gameplayStop();
    setTimeout(() => {
      if (this.scene !== level) return;
      // A failed level keeps its HUD under the card, ready for a revive.
      if (result.passed) this.ui.clearHud();
      this.ui.results({
        ...result,
        title: `Level ${n}`,
        subtitle: def.name,
        total: this.save.data.score,
        isBest: result.passed && prev.best > 0 && result.score > prev.best,
        ads: platform.ads,
        canRevive: !result.passed && level.canRevive(),
        reviveIsPaid: platform.ads && (this.revives + 1) % 2 === 0,
        canSkip: !result.passed && !replay,
        onRevive: () => this.revive(),
        onRetry: () => this.startLevel(n, { replay }),
        // A replay hands back to the run where the player left it.
        onNext: () => this.nextLevel(replay ? this.save.data.level : n + 1),
        onSkip: () => this.skipLevel(n),
        onHome: () => this.showTitle(),
      });
    }, result.passed ? 1100 : 900);
  }

  pause(fromSystem = false) {
    if (!this.scene || this.scene instanceof Showcase || this.scene.state === 'done') {
      if (fromSystem) this.audio.suspend();
      return;
    }
    if (this.paused) return;
    this.paused = true;
    if (fromSystem) this.audio.suspend();
    platform.gameplayStop();
    this.ui.pause({
      save: this.save,
      onResume: () => this.resume(),
      onRestart: () => this.startLevel(this.current.n, { replay: this.current.replay }),
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
