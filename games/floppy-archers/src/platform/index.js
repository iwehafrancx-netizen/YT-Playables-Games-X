import { playgama } from './playgama.js';

// One build for every storefront: the Playgama Bridge works out which
// platform it is running on and speaks that platform's SDK.
export const platform = playgama;
