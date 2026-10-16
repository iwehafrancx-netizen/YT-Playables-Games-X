// YouTube Playables. Every call is a no-op outside Playables so the game runs
// in any browser during development; progress then lives in localStorage.

const sdk = typeof window !== 'undefined' ? window.ytgame : undefined;
const inPlayables = Boolean(sdk?.IN_PLAYABLES_ENV);

function safe(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    console.warn('[ytgame]', err);
    return fallback;
  }
}

export const youtube = {
  name: 'youtube',
  ads: false,

  async init() {},

  firstFrameReady() {
    if (inPlayables) safe(() => sdk.game.firstFrameReady());
  },

  gameReady() {
    if (inPlayables) safe(() => sdk.game.gameReady());
  },

  gameplayStart() {},
  gameplayStop() {},
  levelEvent() {},
  happy() {},

  onPause(cb) {
    if (inPlayables) safe(() => sdk.system.onPause(cb));
  },

  onResume(cb) {
    if (inPlayables) safe(() => sdk.system.onResume(cb));
  },

  isAudioEnabled() {
    return inPlayables ? safe(() => sdk.system.isAudioEnabled(), true) : true;
  },

  onAudioEnabledChange(cb) {
    if (inPlayables) safe(() => sdk.system.onAudioEnabledChange(cb));
  },

  async loadData(key) {
    if (!inPlayables) return localStorage.getItem(key);
    return safe(() => sdk.game.loadData(), Promise.resolve(''));
  },

  async saveData(key, text) {
    if (!inPlayables) return localStorage.setItem(key, text);
    await safe(() => sdk.game.saveData(text), Promise.resolve());
  },

  sendScore(value) {
    if (inPlayables) safe(() => sdk.engagement.sendScore({ value: Math.max(0, Math.round(value)) }));
  },

  async interstitial() {},

  async rewarded() {
    return 'unavailable';
  },

  logError(err) {
    if (inPlayables) safe(() => sdk.health.logError());
    console.error(err);
  },
};
