import { STEP } from '../physics/physics.js';
import { yt } from '../platform/yt.js';
import { DEPARTMENTS, levelAt } from '../levels/index.js';
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
    this.fails = {};

    ui.onPause = () => this.pause();
    ui.onSettingsChanged = () => this.applySettings();
    this.applySettings();

    yt.onPause(() => this.pause(true));
    yt.onResume(() => this.audio.resume());
    yt.onAudioEnabledChange((on) => this.audio.setEnabled(on));
    this.audio.setEnabled(yt.isAudioEnabled());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(true);
      else this.audio.resume();
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
    this.ui.clearHud();
    this.ui.closeModal();
    if (!(this.scene instanceof Showcase)) this.setScene(new Showcase(this, { theme: 'morning' }, { theme: 'morning' }));
    this.input.handler = null;
    this.ui.title({
      level: this.save.data.level,
      onPlay: () => this.startLevel(this.save.data.level),
      onSettings: () => this.ui.settings({ save: this.save, onClose: () => this.ui.closeModal() }),
      onWardrobe: () => this.openWardrobe(),
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
  startLevel(n) {
    const { dept, level } = levelAt(n);
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.current = { n, dept, level };
    this.setScene(new dept.Mode(this, level, dept));
    this.ui.banner(`Level ${n}`, level.name);
  }

  levelFinished(level, result) {
    const { n, level: def } = this.current;
    const prev = this.save.level(def.id);
    this.save.record(def.id, { stars: result.stars, score: result.passed ? result.score : 0, done: result.passed });
    if (result.passed) {
      this.save.data.level = Math.max(this.save.data.level, n + 1);
      this.save.data.score += Math.round(result.score);
      this.save.flush();
      yt.sendScore(this.save.data.score);
      this.audio.win();
      this.fx.confetti(this.rig.look.clone(), 120);
    } else {
      this.audio.lose();
    }
    setTimeout(() => {
      if (this.scene !== level) return;
      this.ui.clearHud();
      this.ui.results({
        ...result,
        title: `Level ${n}`,
        subtitle: def.name,
        total: this.save.data.score,
        isBest: result.passed && prev.best > 0 && result.score > prev.best,
        // A stubborn level can be skipped after a couple of tries so the run keeps moving.
        canSkip: !result.passed && (this.fails[n] = (this.fails[n] ?? 0) + 1) >= 2,
        onRetry: () => this.startLevel(n),
        onNext: () => this.startLevel(n + 1),
        onSkip: () => {
          this.save.data.level = Math.max(this.save.data.level, n + 1);
          this.save.flush();
          this.startLevel(n + 1);
        },
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
    this.ui.pause({
      save: this.save,
      onResume: () => this.resume(),
      onRestart: () => this.startLevel(this.current.n),
      onHome: () => this.showTitle(),
    });
  }

  resume() {
    this.paused = false;
    this.ui.closeModal();
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
        yt.logError(err);
      }
    };
    requestAnimationFrame(loop);
  }
}
