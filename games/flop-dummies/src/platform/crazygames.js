// CrazyGames HTML5 SDK v3. The SDK script is loaded by index.html before the
// game; outside CrazyGames (or if it fails to load) every call falls back to
// a harmless default so the game still runs.

const sdk = () => window.CrazyGames?.SDK;
let ready = false;
let playing = false;

function call(fn, fallback) {
  if (!ready) return fallback;
  try {
    return fn(sdk());
  } catch (err) {
    console.warn('[crazygames]', err);
    return fallback;
  }
}

function requestAd(type) {
  return new Promise((resolve) => {
    if (!ready) return resolve('unavailable');
    try {
      sdk().ad.requestAd(type, {
        adStarted: () => {},
        adFinished: () => resolve('done'),
        adError: () => resolve('unavailable'),
      });
    } catch (err) {
      console.warn('[crazygames]', err);
      resolve('unavailable');
    }
  });
}

export function crazygames({ ads }) {
  return {
    name: 'crazygames',
    ads,

    async init() {
      try {
        await sdk()?.init();
        ready = Boolean(sdk());
      } catch (err) {
        console.warn('[crazygames] init failed', err);
      }
      call((s) => s.game.loadingStart());
    },

    firstFrameReady() {},

    gameReady() {
      call((s) => s.game.loadingStop());
    },

    gameplayStart() {
      if (playing) return;
      playing = true;
      call((s) => s.game.gameplayStart());
    },

    gameplayStop() {
      if (!playing) return;
      playing = false;
      call((s) => s.game.gameplayStop());
    },

    levelEvent() {},

    happy() {
      call((s) => s.game.happytime());
    },

    onPause() {},
    onResume() {},

    isAudioEnabled() {
      return !call((s) => s.game.settings?.muteAudio, false);
    },

    onAudioEnabledChange(cb) {
      call((s) => s.game.addSettingsChangeListener((settings) => cb(!settings.muteAudio)));
    },

    // The data module syncs progress for signed-in players and falls back to
    // local storage otherwise, with the same API as localStorage.
    async loadData(key) {
      return call((s) => s.data.getItem(key), null) ?? localStorage.getItem(key);
    },

    async saveData(key, text) {
      if (call((s) => (s.data.setItem(key, text), true), false)) return;
      localStorage.setItem(key, text);
    },

    sendScore() {},

    async interstitial() {
      if (ads) await requestAd('midgame');
    },

    async rewarded() {
      return ads ? requestAd('rewarded') : 'unavailable';
    },

    logError(err) {
      console.error(err);
    },
  };
}
