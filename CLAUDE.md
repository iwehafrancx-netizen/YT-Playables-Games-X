# Working in this repo

This repo holds HTML5 games built for YouTube Playables. Each game lives in its
own folder under `games/` and ships as a self-contained static bundle.

## The bar

Every game should read like it came out of a small, experienced indie studio:

- A real name, a short pitch and a consistent visual identity — no "Game 1",
  "Demo", "Test" or placeholder art.
- Juice: easing, screen shake, particles, hit-stop, sound feedback. Menus,
  pause, game over and a restart loop are all finished, not stubbed.
- Code that a working developer would write and keep: small modules, clear
  names, comments only where the *why* isn't obvious. No tutorial-style
  narration, no "TODO: implement", no banner comments explaining what a
  function plainly does, no leftover debug logging.
- Commit history that tells the story of the work in normal, imperative
  commit messages ("Add combo multiplier", "Fix jump buffer on slow frames").
- Each game has its own short `README.md`: pitch, controls, how to run, how to
  build the upload zip.

## Layout

```
games/<slug>/
  index.html        entry point (must be at the root of the zip)
  src/              game code (ES modules, no framework unless it earns it)
  assets/           images, audio, fonts — all bundled locally
  README.md
```

Keep games dependency-free by default. If a game needs a build step, keep it to
a single `package.json` script and commit nothing generated except the final
`dist/` when asked.

## Playables platform rules

Verify against https://developers.google.com/youtube/gaming/playables before
submitting — the rules change.

- Load the SDK before any game code:
  `<script src="https://www.youtube.com/game_api/v1"></script>`
- Call `ytgame.game.firstFrameReady()` as soon as something is drawn, and
  `ytgame.game.gameReady()` once the player can interact.
- Pause on `ytgame.system.onPause` and resume on `ytgame.system.onResume`.
- Respect `ytgame.system.isAudioEnabled()` and
  `ytgame.system.onAudioEnabledChange`; don't play audio before it's allowed.
- Persist progress with `ytgame.game.saveData` / `loadData` — not
  `localStorage`, cookies or IndexedDB.
- Report scores with `ytgame.engagement.sendScore({ value })` (integer).
- Localise with `ytgame.system.getLanguage()` where text matters.
- No outbound network requests, external links, CDNs or remote fonts. Every
  asset ships inside the bundle.
- Must fill the viewport and work in portrait and landscape, on touch, mouse
  and keyboard. Handle resize and devicePixelRatio.
- Keep the initial load small and fast; stay well under the bundle size limits.
- Guard SDK calls with `ytgame?.IN_PLAYABLES_ENV` checks so the game still runs
  locally in a normal browser.

## Running locally

Serve the game folder over HTTP (ES modules don't load from `file://`):

```
npx serve games/<slug>
# or
python3 -m http.server -d games/<slug> 8080
```
