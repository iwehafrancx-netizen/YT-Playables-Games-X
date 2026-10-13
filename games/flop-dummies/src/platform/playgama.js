// Playgama Bridge. The bridge script and playgama-bridge-config.json ship
// next to index.html; outside Playgama the bridge answers with safe defaults.

const bridge = () => window.bridge;
let ready = false;
let playing = false;

function call(fn, fallback) {
  if (!ready) return fallback;
  try {
    return fn(bridge());
  } catch (err) {
    console.warn('[playgama]', err);
    return fallback;
  }
}

/** Shows an ad and resolves with how it ended, from the bridge's state events. */
function showAd(kind) {
  return new Promise((resolve) => {
    const ad = call((b) => b.advertisement);
    const supported = kind === 'rewarded' ? ad?.isRewardedSupported : ad?.isInterstitialSupported;
    if (!supported) return resolve('unavailable');
    const event = `${kind}_state_changed`;
    let earned = false;
    const onState = (state) => {
      if (state === 'rewarded') earned = true;
      if (state !== 'closed' && state !== 'failed') return;
      ad.off?.(event, onState);
      resolve(state === 'failed' ? 'unavailable' : earned || kind === 'interstitial' ? 'done' : 'skipped');
    };
    ad.on(event, onState);
    if (kind === 'rewarded') ad.showRewarded();
    else ad.showInterstitial();
  });
}

export const playgama = {
  name: 'playgama',
  ads: true,

  async init() {
    try {
      await bridge()?.initialize();
      ready = Boolean(bridge());
    } catch (err) {
      console.warn('[playgama] init failed', err);
    }
  },

  firstFrameReady() {},

  gameReady() {
    call((b) => b.platform.sendMessage('game_ready'));
  },

  gameplayStart() {
    if (playing) return;
    playing = true;
    call((b) => b.platform.sendMessage('gameplay_started'));
  },

  gameplayStop() {
    if (!playing) return;
    playing = false;
    call((b) => b.platform.sendMessage('gameplay_stopped'));
  },

  /** 'level_started' | 'level_completed' | 'level_failed' */
  levelEvent(name) {
    call((b) => b.platform.sendMessage(name));
  },

  happy() {},

  onPause(cb) {
    call((b) => b.platform.on('pause_state_changed', (paused) => paused && cb()));
    call((b) => b.game?.on('visibility_state_changed', (state) => state === 'hidden' && cb()));
  },

  onResume(cb) {
    call((b) => b.platform.on('pause_state_changed', (paused) => !paused && cb()));
  },

  isAudioEnabled() {
    return call((b) => b.platform.isAudioEnabled, true);
  },

  onAudioEnabledChange(cb) {
    call((b) => b.platform.on('audio_state_changed', cb));
  },

  async loadData(key) {
    const value = await call((b) => b.storage.get(key, false), null);
    return typeof value === 'string' ? value : null;
  },

  async saveData(key, text) {
    await call((b) => b.storage.set(key, text), null);
  },

  sendScore() {},

  async interstitial() {
    await showAd('interstitial');
  },

  rewarded() {
    return showAd('rewarded');
  },

  logError(err) {
    console.error(err);
  },
};
