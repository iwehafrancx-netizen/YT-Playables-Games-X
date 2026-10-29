# Floppy Archers

Pull back. Let go. Watch them flop.

A 2D ragdoll archery game. You stand on a stone tower with a bow; enemy
archers drop in one at a time onto towers and hanging planks across the
field, and they shoot back. Every archer is the same floppy, googly-eyed
stick ragdoll, so every hit knocks someone about and the last arrow sends
them tumbling.

## How it plays

- **Levels.** Each level is a queue of enemy archers, one on the field at a
  time. Knock them all out (`SCORE 3/5`) to clear it. Later levels add
  hanging crates in the way and planks that bob up and down.
- **Health and stamina.** Shots cost 8 stamina and jumps 5; stamina refills
  over time. Jump to hop over incoming arrows.
- **Where you hit matters.** Headshots do double damage, the body full, arms
  and legs less. Arrows stick where they land, and two arrows that meet in
  the air knock each other out of the sky.
- **Apples.** Shoot them out of the air: red heals 30, green restores 50
  stamina, and the golden one with wings is worth 5 skulls but flies off.
- **Enemies.** Rookies, archers, snipers, rapid shooters (three-arrow bursts),
  ninjas who jump your arrows and heavies in helmets.
- **Boss levels.** Every fifth level ends with a boss: Big Bruno, the Triple
  King, the Fire Chief, the Shock Wizard and the Bomb Baron take turns. Boss
  levels are ordinary levels in the run.
- **Bonus boss.** After every sixth level the Golden Archer is offered as an
  optional fight for a rewarded ad, worth 60 skulls. Skipping is free.
- **Skull shop.** Kills, headshots, bosses and golden apples pay skulls. Spend
  them on arrows (Triple Shot, Fire, Poison, Shock, Bomb), each with three
  upgrade levels; on health, stamina and power; and on suit colours. Any
  locked arrow can be tried for one level by watching an ad.
- **2 Players.** Two archers on one screen, best of three. Player 1 aims on the
  left half, player 2 on the right; each has their own JUMP button.

## Controls

| | Touch / mouse | Keyboard |
|---|---|---|
| Aim and draw | Drag back anywhere, the further the harder | <kbd>↑</kbd> / <kbd>↓</kbd> (or <kbd>W</kbd> / <kbd>S</kbd>) to aim, hold <kbd>Space</kbd> to draw |
| Fire | Let go | Release <kbd>Space</kbd> |
| Jump | JUMP button | <kbd>J</kbd> or <kbd>Shift</kbd> |

It plays in landscape and portrait; the camera keeps both archers close.

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
- makes no other network requests: every picture and sound is drawn or
  synthesised in code.

### Ads

| When | Ad |
|---|---|
| Game opens | Interstitial (preroll), once |
| **Next level** after levels 3, 8 and 11, then every eleven levels (14, 19, 22…); boss levels count | Interstitial |
| **Fight him** on the bonus-boss card (after every sixth level) | Rewarded |
| **Try 1 level** on a locked arrow in the shop | Rewarded |
| **Revive** on the fail card, once per level | Rewarded: back in with 60% health |
| **Double skulls** on the level-clear card | Rewarded |

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
  engine/    canvas and camera, verlet physics, the ragdoll, particles
  game/      the match (levels, hits, camera), archers, arrows, enemy AI,
             enemy and boss types, the shop catalogue, apples and drawing
  core/      game flow, ads, input, audio, save
  platform/  the Playgama Bridge adapter
  ui/        menus, HUD, shop and cards
```
