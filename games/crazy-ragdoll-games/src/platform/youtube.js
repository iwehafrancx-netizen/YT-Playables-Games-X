// YouTube Playables. Every call is a no-op outside Playables so the game runs
// in any browser during development; progress then lives in localStorage.
// Ads go through ytgame.ads, which YouTube still marks as experimental: a
// request may not show anything, and the game carries on either way.

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
  get ads() {
    return inPlayables && Boolean(sdk.ads);
  },

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

  async interstitial() {
    if (!this.ads) return;
    try {
      await sdk.ads.requestInterstitialAd();
    } catch (err) {
      console.warn('[ytgame] interstitial', err);
    }
  },

  /** `id` names the reward; YouTube wants one fixed id per kind of reward. */
  async rewarded(id) {
    if (!this.ads) return 'unavailable';
    try {
      return (await sdk.ads.requestRewardedAd(id)) ? 'done' : 'skipped';
    } catch (err) {
      console.warn('[ytgame] rewarded', err);
      return 'unavailable';
    }
  },

  logError(err) {
    if (inPlayables) safe(() => sdk.health.logError());
    console.error(err);
  },
};
