// Single point of contact with the YouTube Playables SDK. Every call is a
// no-op outside Playables so the game runs in any browser during development.

const sdk = typeof window !== 'undefined' ? window.ytgame : undefined;
export const inPlayables = Boolean(sdk?.IN_PLAYABLES_ENV);

function safe(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    console.warn('[ytgame]', err);
    return fallback;
  }
}

export const yt = {
  firstFrameReady() {
    if (inPlayables) safe(() => sdk.game.firstFrameReady());
  },

  gameReady() {
    if (inPlayables) safe(() => sdk.game.gameReady());
  },

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

  async language() {
    if (!inPlayables) return navigator.language || 'en';
    return safe(() => sdk.system.getLanguage(), Promise.resolve('en'));
  },

  async loadData() {
    if (!inPlayables) return null;
    return safe(() => sdk.game.loadData(), Promise.resolve(''));
  },

  async saveData(text) {
    if (!inPlayables) return;
    await safe(() => sdk.game.saveData(text), Promise.resolve());
  },

  sendScore(value) {
    if (inPlayables) safe(() => sdk.engagement.sendScore({ value: Math.max(0, Math.round(value)) }));
  },

  logError(err) {
    if (inPlayables) safe(() => sdk.health.logError());
    console.error(err);
  },
};
