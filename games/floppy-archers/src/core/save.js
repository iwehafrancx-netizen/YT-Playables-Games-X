import { platform } from '../platform/index.js';

const SAVE_KEY = 'floppy-archers-save';
const VERSION = 2;

function blank() {
  return {
    v: VERSION,
    level: 1,
    best: 0,
    kills: 0,
    skulls: 0,
    arrows: { basic: 1 }, // arrow type → upgrade level
    equip: 'basic',
    stats: {},
    suit: 'red',
    owned: ['red'],
    seen: [],
    sfx: true,
    music: true,
  };
}

/**
 * Progress store: level reached, skulls, arrows, upgrades and colours. It goes
 * through the platform's own save (via the Playgama Bridge), never straight
 * to the browser's storage.
 */
export class Save {
  constructor() {
    this.data = blank();
    this.timer = 0;
  }

  async load() {
    let text = null;
    try {
      text = await platform.loadData(SAVE_KEY);
    } catch {
      text = null;
    }
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.v === VERSION) this.data = { ...blank(), ...parsed };
      } catch {
        // Corrupt save: start fresh rather than crash.
      }
    }
    return this.data;
  }

  set(key, value) {
    this.data[key] = value;
    this.flush();
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.write(), 250);
  }

  async write() {
    const text = JSON.stringify(this.data);
    try {
      await platform.saveData(SAVE_KEY, text);
    } catch (err) {
      console.warn('save failed', err);
    }
  }
}
