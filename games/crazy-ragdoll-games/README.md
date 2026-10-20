# Crazy Ragdoll Games

Eight ways to fling a ragdoll. Zero ways to be careful.

A physics party game on a clean white studio stage. Every game is played with
the same floppy, fully jointed ragdoll — in a new coat of paint each time:

| Game | Play | Controls |
|---|---|---|
| **Stack Attack** | A crane swings ragdolls over a podium. Drop them so they pile up past the red line before you run out. Turntables and wind on the later ones. | Tap to drop |
| **Hammer Spin** | The ragdoll is the hammer. Spin him round by the ankles and fling him onto the targets; the red ring shows where he'd land. | Hold to spin · let go to throw |
| **Rocket Rider** | He's hanging on to a rocket. Thread the gates, dodge the blocks, collect the rings, and he lets go over the landing pad. | Hold to fly up · let go to drop |
| **Wipeout** | Sweeper arms come round a spinning stage. Hop the low bars, big-jump the tall ones, grab the stars, and stay on till the clock runs out. | Tap to hop · hold for a big jump |
| **Ragdoll Pinball** | He curls into a ball on a real pinball table: flippers, bumpers, star rollovers. Hit the target score before your three balls drain. | Tap left / right to flip |
| **Plinko Party** | Aim the dropper and let him tumble down through the pegs into the scoring buckets. Bumpers kick, ×2 buckets double the lot. | Drag to aim · let go to drop |
| **Bounce Up** | A tower of trampolines. Steer him in the air from pad to pad up to the flag before the clock runs out; purple pads slide. | Hold left / right to steer |
| **Slip 'n' Slide** | Belly-first down a soapy slide: dodge the blocks and sweepers, hit the ramps, grab the stars, splash into the pool. | Hold left / right to steer |

Play drops you into an endless run: it opens with the crane, then the hammer,
and after that deals every game in a shuffled order with the difficulty
climbing. The first time each game comes up, a short card explains the goal
and the controls before the level starts. The results card shows what's up
next and how many stars until the next suit unlocks. Each course comes back as a tougher "After Hours" remix (warm studio
light), and later laps reshuffle everything, so there's always a next level.
Levels earn 1–3 stars, stars unlock ragdoll colours in the Wardrobe, and
passed levels can be replayed.

Keyboard: <kbd>Space</kbd> / <kbd>Enter</kbd> works wherever a tap does;
pinball, Plinko, Bounce Up and the slide also take <kbd>←</kbd> / <kbd>→</kbd>.

### Boss fights

After every sixth level a boss steps in between levels — a bonus round you can
take or skip. A sumo ring on top of a tower: walk your ragdoll around while a
toy robot (Big Bouncer, Mega Mixer, Sir Smashalot, Turbo Toaster…) charges at
you. Lure it into a pylon to stun it, then dive into it. Drag to walk · tap to
dive.

## Building for upload

Made for Playgama first; the same code also builds for CrazyGames and YouTube
Playables.

```
npm install
npm run zip:playgama           # Playgama Bridge   → crazy-ragdoll-games-playgama.zip
npm run zip:crazygames-basic   # CrazyGames Basic  → crazy-ragdoll-games-crazygames-basic.zip (no ads)
npm run zip:crazygames-full    # CrazyGames Full   → crazy-ragdoll-games-crazygames-full.zip
npm run zip                    # YouTube Playables → crazy-ragdoll-games.zip
```

Each zip has `index.html` at its root and everything bundled inside; the only
outside request is the platform's own SDK script.

### Ads (Playgama and CrazyGames Full)

| When | Ad | Notes |
|---|---|---|
| **Next level**, on a 3–5–3 rhythm of levels passed | Interstitial | Playgama paces interstitials itself (`platform/playgama-bridge-config.json`). |
| **Fight boss** on the boss card (every sixth level) | Rewarded | **Skip boss** is free and carries on to the next level. |
| **Revive**, every second use | Rewarded | Picks the failed level up where it stopped; offered for 5 seconds. |
| **Skip level** on the fail card | Rewarded | Shown on every fail. |
| **Try again** | — | Never shows an ad. |
| Game start (preroll) | Platform | Not requested by the game; Playgama and CrazyGames run their own where a portal allows it. |

The reward is only given for a fully watched ad; if no ad can be served the
player gets it anyway. The game pauses and mutes for every ad.

## Running locally

```
npm install
npm run build
npx serve .        # then open /dist/
```

## Project layout

```
src/
  core/      game flow, ads, input, audio, save
  dummy/     the ragdoll: physics and looks
  render/    renderer, studio lighting, materials, textures, effects, camera
  world/     props and level building blocks
  modes/     one class per game (stackAttack, hammerSpin, rocketRider, wipeout, pinball,
             plinko, bounceUp, slide, bossFight)
  levels/    level data for each game, remixes and the endless sequence
  platform/  Playgama, CrazyGames and YouTube SDK adapters
  ui/        menus, HUD and cards
```
