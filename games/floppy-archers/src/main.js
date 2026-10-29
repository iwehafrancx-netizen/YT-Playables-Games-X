import './style.css';
import { View } from './engine/view.js';
import { Fx } from './engine/fx.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Game } from './core/game.js';
import { UI } from './ui/ui.js';
import { platform } from './platform/index.js';
import { SUITS, ARROWS } from './game/catalog.js';

async function boot() {
  const app = document.getElementById('app');
  const canvas = document.getElementById('view');
  const audio = new Audio();
  const ui = new UI(app, audio);
  ui.loading(0.1, 'Stringing the bows…');
  platform.firstFrameReady();
  await platform.init();
  ui.loading(0.4, 'Sharpening arrows…');

  const save = new Save();
  await Promise.all([save.load(), document.fonts?.ready]);
  const d = save.data;
  if (!SUITS[d.suit]?.price && d.suit !== 'red') d.suit = 'red';
  if (!ARROWS[d.equip]) d.equip = 'basic';
  ui.loading(0.8, 'Hanging the targets…');

  const view = new View(canvas);
  const fx = new Fx();
  const input = new Input(canvas);
  const game = new Game({ view, ui, audio, save, input, fx });
  game.showTitle();
  game.frame(performance.now());
  ui.loading(1);
  game.run();
  setTimeout(() => ui.hideLoading(), 200);
  platform.gameReady();
  window.__game = game;
  game.preroll();
}

boot().catch((err) => {
  console.error(err);
  platform.logError(err);
  document.querySelector('#loading .load-text').textContent = 'Something went wrong while loading. Please reload.';
});
