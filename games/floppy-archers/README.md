# Floppy Archers

Pull back. Let go. Watch them flop.

A ragdoll archery duel in a shipping yard. You stand on a container tower with
a bow; enemy archers turn up one at a time on girders swinging from the cranes
and on the container stacks across the yard, and they shoot back. Every
archer is the same floppy, googly-eyed ragdoll, so every hit knocks someone
about and every last arrow sends them tumbling.

## How it plays

- **Waves.** Each wave is a queue of enemy archers, one on the field at a
  time. Knock them all out (`SCORE 3/5`) to clear the wave. The skull counts
  every archer you've beaten.
- **Health and stamina.** Shots cost 6 stamina and jumps 5. Stamina refills
  over time.
- **Where you hit matters.** Headshots do the most damage, then the chest; arms
  and legs do less. Arrows stick where they land, and two arrows that meet in
  the air knock each other out of the sky.
- **Apples.** Shoot them out of the air: red heals 30, green restores 50
  stamina, and the golden one with wings is worth 25 coins but flies straight
  across, so be quick.
- **Enemies.** Rookies, archers, snipers (slow but deadly accurate), rapid
  shooters (three-arrow bursts) and heavies in helmets that shrug off
  headshots. Waves get longer and tougher.
- **Bosses.** Every fifth wave ends with the Captain: a gold-helmeted archer
  with a two-arrow burst and a lot of health.
- **Upgrades.** After each cleared wave, pick one of three: damage, health,
  stamina, double shot, fire arrows, vampire arrows, eagle eye (bigger
  headshots) or power draw (faster arrows).
- **Colours.** Coins from kills, headshots, bosses and golden apples buy new
  suit colours.
- **2 Players.** Two archers on one screen, best of three. Player 1 aims on the
  left half, player 2 on the right; each has their own JUMP button.

## Controls

| | Touch / mouse | Keyboard |
|---|---|---|
| Aim and draw | Drag back anywhere, the further the harder | <kbd>↑</kbd> / <kbd>↓</kbd> (or <kbd>W</kbd> / <kbd>S</kbd>) to aim, hold <kbd>Space</kbd> to draw |
| Fire | Let go | Release <kbd>Space</kbd> |
| Jump | JUMP button | <kbd>J</kbd> or <kbd>Shift</kbd> |

## Platforms

One build for every storefront through the
[Playgama Bridge](https://wiki.playgama.com/), which detects the platform it's
running on and talks to its SDK. The game:

- sends `game_ready` once it can be played, and `gameplay_started` /
  `gameplay_stopped` around play (menus, pauses, results and ads stop it);
- pauses on the platform's pause and on a hidden tab, and follows the
  platform's audio setting;
- saves progress with the Bridge's storage, never with `localStorage` or
  cookies;
- shows ads only through the Bridge, with the game paused and muted;
- makes no other network requests: every model, texture and sound is built
  in code or bundled.

### Ads

| When | Ad |
|---|---|
| Game opens | Interstitial (preroll), once |
| **Next wave** after waves 3, 8 and 11, then every eleven waves (14, 19, 22…) | Interstitial |
| **Revive** on the fail card, once per wave | Rewarded: back in with 60% health |
| **Double coins** on the wave-clear card | Rewarded |

Rewards are only given for a fully watched ad; if no ad can be served the
player gets the reward anyway. Playgama also paces interstitials itself
(`platform/playgama-bridge-config.json`: none held back at the start, 30 s
apart).

## Running locally

```
npm install
npm run build
npx serve .        # then open /dist/
```

## Building the upload zip

```
npm run zip        # → floppy-archers.zip
```

The zip has `index.html` at its root with the game bundle and the Bridge
config beside it; the only outside request is the Bridge's own SDK script.

## Project layout

```
src/
  archery/   the match (waves, duels, hits, camera), archers, arrows, enemy
             types, upgrades and apples
  core/      game flow, ads, input, audio, save
  dummy/     the ragdoll: physics and looks
  render/    renderer, sky and lighting, materials, textures, effects, camera
  scene/     scene base: physics world, props and camera framing
  world/     props and the cargo yard
  platform/  the Playgama Bridge adapter
  ui/        menus, HUD and cards
```
