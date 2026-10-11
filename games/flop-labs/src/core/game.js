import { STEP } from '../physics/physics.js';
import { yt } from '../platform/yt.js';
import { DEPARTMENTS, findLevel } from '../levels/index.js';
import { Showcase } from '../modes/showcase.js';
import { SUIT_UNLOCKS } from '../ui/ui.js';

/** Top-level flow: title → departments → levels → results, plus the frame loop. */
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
      onPlay: () => this.showDepartments(),
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

  showDepartments() {
    this.ui.closeModal();
    this.ui.clearHud();
    if (!(this.scene instanceof Showcase)) this.setScene(new Showcase(this, { theme: 'morning' }, { theme: 'morning' }));
    this.input.handler = null;
    this.ui.departments({
      depts: DEPARTMENTS,
      save: this.save,
      onPick: (id) => this.showLevels(DEPARTMENTS.find((d) => d.id === id)),
      onBack: () => this.showTitle(),
    });
  }

  showLevels(dept) {
    this.ui.closeModal();
    this.ui.clearHud();
    if (!(this.scene instanceof Showcase)) this.setScene(new Showcase(this, { theme: 'morning' }, { theme: 'morning' }));
    this.input.handler = null;
    this.ui.levels({
      dept,
      save: this.save,
      onPick: (id) => this.startLevel(id),
      onBack: () => this.showDepartments(),
    });
  }

  startLevel(id) {
    const found = findLevel(id);
    if (!found) return;
    this.ui.clearScreens();
    this.ui.closeModal();
    this.ui.clearHud();
    this.paused = false;
    this.current = found;
    const { dept, level } = found;
    this.setScene(new dept.Mode(this, level, dept));
    this.ui.banner(level.name, `${dept.name} · Test ${level.index + 1}`);
  }

  levelFinished(level, result) {
    const { dept, level: def, next } = this.current;
    const prev = this.save.level(def.id);
    const isBest = result.passed && result.score > prev.best && prev.best > 0;
    this.save.record(def.id, { stars: result.stars, score: result.passed ? result.score : 0, done: result.passed });
    yt.sendScore(this.save.totalScore());
    if (result.passed) this.audio.win();
    else this.audio.lose();
    if (result.passed) this.fx.confetti(this.rig.look.clone(), 120);
    setTimeout(() => {
      if (this.scene !== level) return;
      this.ui.clearHud();
      this.ui.results({
        ...result,
        title: def.name,
        best: Math.max(prev.best, result.passed ? result.score : 0),
        isBest,
        hasNext: Boolean(next),
        onRetry: () => this.startLevel(def.id),
        onNext: () => (next ? this.startLevel(next.id) : this.showLevels(dept)),
        onLevels: () => this.showLevels(dept),
      });
    }, result.passed ? 1300 : 900);
  }

  pause(fromSystem = false) {
    if (!this.scene || this.scene instanceof Showcase || this.scene.state === 'done') {
      if (fromSystem) this.audio.suspend();
      return;
    }
    if (this.paused) return;
    this.paused = true;
    if (fromSystem) this.audio.suspend();
    const { dept, level } = this.current;
    this.ui.pause({
      save: this.save,
      onResume: () => this.resume(),
      onRestart: () => this.startLevel(level.id),
      onLevels: () => this.showLevels(dept),
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
