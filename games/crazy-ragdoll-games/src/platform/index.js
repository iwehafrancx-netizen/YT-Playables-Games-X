import { youtube } from './youtube.js';
import { crazygames } from './crazygames.js';
import { playgama } from './playgama.js';

/* global __TARGET__, __ADS__ */

// The storefront is picked at build time (`node build.mjs --target=…`), so
// each upload only talks to its own SDK.
const targets = {
  youtube: () => youtube,
  crazygames: () => crazygames({ ads: __ADS__ }),
  playgama: () => playgama,
};

export const platform = targets[__TARGET__]();
