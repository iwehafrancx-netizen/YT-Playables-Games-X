import { platform } from '../platform/index.js';

const LOCAL_KEY = 'crazy-ragdoll-save';
const VERSION = 1;

function blank() {
  return { v: VERSION, levels: {}, level: 1, score: 0, suit: 'classic', sfx: true, music: true };
}

/**
 * Progress store. Inside Playables it goes through the SDK cloud save; in a
 * plain browser it falls back to localStorage so local testing keeps progress.
 */
export class Save {
  constructor() {
    this.data = blank();
    this.timer = 0;
  }

  async load() {
    let text = null;
    try {
      text = await platform.loadData(LOCAL_KEY);
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

  level(id) {
    return this.data.levels[id] ?? { stars: 0, best: 0, done: false };
  }

  /** Records a result, keeping the best stars and score. Returns true if anything improved. */
  record(id, { stars, score, done, n }) {
    const prev = this.level(id);
    const next = {
      stars: Math.max(prev.stars, stars),
      best: Math.max(prev.best, Math.round(score)),
      done: prev.done || done,
      n: prev.n ?? n,
    };
    const improved = next.stars > prev.stars || next.best > prev.best || next.done !== prev.done;
    this.data.levels[id] = next;
    if (improved) this.flush();
    return improved;
  }

  totalStars(ids) {
    return ids.reduce((n, id) => n + this.level(id).stars, 0);
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
      await platform.saveData(LOCAL_KEY, text);
    } catch (err) {
      console.warn('save failed', err);
    }
  }
}
