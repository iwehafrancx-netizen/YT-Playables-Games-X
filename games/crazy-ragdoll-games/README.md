# Crazy Ragdoll Games

Thirteen ways to fling a ragdoll. Zero ways to be careful.

A physics party game set in a busy shipping yard: stacked containers, dock
cranes, and crates and barrels everywhere to crash into. Every game stars the
same ragdoll: a stunt man in a one-colour suit, built like a real person,
who bends and flops but never folds the wrong way.

| Game | Play | Controls |
|---|---|---|
| **Hammer Spin** | The ragdoll is the hammer. Spin him round by the ankles and fling him onto the targets; the red ring shows where he'd land. | Hold to spin · let go to throw |
| **Rocket Rider** | He's hanging on to a rocket. Thread the gates, dodge the blocks, collect the rings, and he lets go over the landing pad. | Hold to fly up · let go to drop |
| **Wipeout** | Sweeper arms come round a spinning stage. Hop the low bars, big-jump the tall ones, grab the stars, and stay on till the clock runs out. | Tap to hop · hold for a big jump |
| **Ragdoll Pinball** | He curls into a ball on a real pinball table: flippers, bumpers, star rollovers. Hit the target score before your three balls drain. | Tap left / right to flip |
| **Plinko Party** | Aim the dropper and let him tumble down through the pegs into the scoring buckets. Bumpers kick, ×2 buckets double the lot. | Drag to aim · let go to drop |
| **Bounce Up** | A tower of trampolines. Steer him in the air from pad to pad up to the flag before the clock runs out; purple pads slide. | Hold left / right to steer |
| **Sling Smash** | From behind a giant slingshot, fire him into crate forts and blow up every TNT crate; bullseyes on posts round the fort score bonus points. Blasts set off the TNT next door. | Drag down to pull back · sideways to aim · let go to fire |
| **Ragdoll Bowling** | He curls up into the ball. Time the swinging aim arrow, power up, and bowl at giant pins and barrels. | Hold to power up · let go to bowl |
| **Cannon Blast** | Aim a cannon and fire him at targets: lob over walls, thread windows, bounce off trampolines, hit moving ones. | Drag to aim · let go to fire |
| **Crash Course** | Drive a test car at a wall and send him through the windscreen onto the landing target. Speed is everything. | Hold for gas · let go to coast |
| **Cart Hill** | Push him off in a shopping cart down ramps and jumps, then bail out at the right moment to land on the target. | Hold to wind up · let go to push · tap to bail |
| **Smash Yard** | A pen full of things that hurt: crates, containers, spikes, saws, a crusher, a wrecking ball, TNT and a gun turret. Grab him, fling him into them and empty his health bar until he breaks apart. | Drag to grab · let go to fling |
| **Drop Test** | Shove him down stairs, scaffolds and rotor shafts and score every bump, smash and crate on the way down. | Drag to aim the shove · let go to push |

Play drops you into an endless run: a new player starts with the cannon, the
car crash, the cart and Smash Yard, and after that it deals every game in a shuffled order with the difficulty
climbing. The first time each game comes up, a short card explains the goal
and the controls before the level starts. The results card shows what's up
next and how many stars until the next colour unlocks. Each course comes back
as a tougher "After Hours" remix at sunset, and later laps reshuffle
everything, so there's always a next level. Levels earn 1–3 stars, stars
unlock new colours in the Wardrobe (Red, Yellow, Green, Blue, Purple and
Pink), and passed levels can be replayed.

Keyboard: <kbd>Space</kbd> / <kbd>Enter</kbd> works wherever a tap does;
pinball, Plinko and Bounce Up also take <kbd>←</kbd> / <kbd>→</kbd>, and
Sling Smash aims with the arrow keys.

### Boss fights

After every sixth level a boss steps in between levels — a bonus round you can
take or skip. The boss card says how to win, and during the fight an
instruction at the top and a bouncing arrow show exactly what to hit next.
There are five, each fought a different way; they take turns, so two in a row
never play the same, and each lap round they get tougher.

| Boss | Fight | Controls |
|---|---|---|
| **Big Bouncer** (and friends) | A sumo ring on top of a tower. A robot charges at you; lure it into a pylon to stun it, then dive into it. | Drag to walk · tap to dive |
| **Goliath** | A giant robot stomps towards your cannon. Fire the ragdoll at the glowing core on its chest before it reaches you. | Drag to aim · let go to fire |
| **Crab King** | A mechanical crab scuttles across a bowling lane, guarding its belly with its claws. Bowl the ragdoll in while the claws are up. | Hold to power up · let go to bowl |
| **Wrecker** | Swing from a crane rope and fly head first into the glass dome on the robot's head. | Hold to swing higher · let go to fly |
| **Stomper** | The floor is one giant trampoline. Bounce onto the robot's head; touch its body and it swats you. | Hold left / right to steer |

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

### Ads (YouTube Playables, Playgama and CrazyGames Full)

| When | Ad | Notes |
|---|---|---|
| **Next level**, after levels 3, 8 and 11, then again every eleven levels (14, 19, 22…) | Interstitial | Playgama also paces interstitials itself (`platform/playgama-bridge-config.json`: none held back at start, 30 s apart). |
| **Fight boss** on the boss card (every sixth level) | Rewarded | **Skip boss** is free and carries on to the next level. |
| **Revive**, every second use | Rewarded | Picks the failed level up where it stopped; offered for 5 seconds. |
| **Skip level** on the fail card | Rewarded | Shown on every fail. |
| **Try again** | — | Never shows an ad. |
| **Game opens** (preroll) | Interstitial | Requested once as the title screen appears. |

The reward is only given for a fully watched ad; if no ad can be served the
player gets it anyway. The game pauses and mutes for every ad.

On YouTube the ads go through `ytgame.ads` (`requestInterstitialAd` and
`requestRewardedAd` with the ids `boss-fight`, `revive` and `skip-level`),
which YouTube still marks as experimental.

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
  render/    renderer, sky and lighting, materials, textures, effects, camera
  world/     props, the cargo yard, vehicles (car, cart, cannon), the boss robots and
             level building blocks
  modes/     one class per game (hammerSpin, rocketRider, wipeout, pinball,
             plinko, bounceUp, slingSmash, bowling, ballistics,
             crashCourse, cartHill, dropTest, smashYard; bossFight is the first boss, and
             bossCannon, bossBowl, bossSwing and bossStomp share bossLevel; attemptLevel is the
             shared base for games played as best-of-three attempts)
  levels/    level data for each game, remixes and the endless sequence
  platform/  Playgama, CrazyGames and YouTube SDK adapters
  ui/        menus, HUD and cards
```
