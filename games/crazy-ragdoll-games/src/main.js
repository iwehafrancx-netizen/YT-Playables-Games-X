import './style.css';
import { Stage } from './render/stage.js';
import { Fx } from './render/fx.js';
import { CameraRig } from './render/cameraRig.js';
import { loadPhysics } from './physics/physics.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Game } from './core/game.js';
import { UI } from './ui/ui.js';
import { platform } from './platform/index.js';
import { SUITS } from './dummy/dummyView.js';

async function boot() {
  const app = document.getElementById('app');
  const canvas = document.getElementById('view');
  const audio = new Audio();
  const ui = new UI(app, audio);
  ui.loading(0.05, 'Warming up the lab…');
  platform.firstFrameReady();
  await platform.init();

  let stage;
  try {
    stage = new Stage(canvas);
  } catch (err) {
    ui.error('This device could not start WebGL.');
    platform.logError(err);
    return;
  }
  ui.loading(0.25, 'Calibrating dummies…');

  const save = new Save();
  await Promise.all([loadPhysics(), save.load(), document.fonts?.ready]);
  // Saves from before the colours were renamed start back on red.
  if (!SUITS[save.data.suit]) save.data.suit = 'red';
  ui.loading(0.7, 'Loading the yard…');

  const rig = new CameraRig(stage.camera);
  const fx = new Fx(stage.scene, stage.camera, document.getElementById('fx-layer'));
  const input = new Input(canvas);
  const game = new Game({ stage, ui, audio, save, input, fx, rig });
  game.showTitle();
  // Render a couple of frames behind the loader so the reveal isn't blank.
  game.frame(performance.now());
  ui.loading(1);
  game.run();
  setTimeout(() => ui.hideLoading(), 250);
  platform.gameReady();
  window.__game = game;
}

boot().catch((err) => {
  console.error(err);
  platform.logError(err);
  document.querySelector('#loading .load-text').textContent = 'Something went wrong while loading. Please reload.';
});
