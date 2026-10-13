# Flop Labs

Professional crash testing. Unprofessional results.

A 3D physics game about a very floppy crash-test dummy. Every department of the
lab is a different kind of game, all built on the same jointed, wobbly dummy:

| Department | Play | Controls |
|---|---|---|
| **Ballistics Bay** | Fire the dummy out of a cannon and flatten every target before you run out of shots. | Drag to aim · release to fire |
| **Drop Test** | Shove a standing dummy down stairs, scaffolds and pegboards; every bump, bonk and crunch scores. | Drag to aim the shove · release to push |
| **Cart Hill** | Ride a shopping cart down a ramp and bail at the right moment to land on the target. | Hold to wind up · release to push · tap to bail |
| **Hop Yard** | Hop a self-balancing dummy across moving, tilting and crumbling platforms. | Tap to hop · hold for a big jump · tap again in mid-air |
| **Pin Alley** | The dummy is the bowling ball. Two lanes of giant pins. | Swipe up to bowl · swipe at an angle to steer |
| **Flip Test** | Springboard backflips: tuck to spin, open up to stop, and stick the landing on his feet. Diving boards, moving mats and triple flips. | Tap to jump · hold to flip · let go to land |
| **Wrecking Crew** | Hung by his ankles from a gantry crane, the dummy is the wrecking ball. Flatten crate towers, walls, barrels and pins before the shift ends. | Drag sideways to swing · drag up and down to winch |
| **Crash Course** | Floor a crash-test car down the runway; the barrier stops the car, not the passenger. Judge the speed to land him on target. | Hold for gas · let go to coast |
| **Swing Shift** | Rope-swing along hooks over a crash mat, past rotors, saws and walls. | Hold to grab the nearest hook · let go to fling |
| **Pull Rig** | Pull-the-pin puzzles: get him down to the green zone without being sawn, spiked or flattened. | Tap a pin to pull it |

Play drops you straight into an endless run: level 1, level 2, level 3…
The hand-built courses each come in two remixes as well — "After Hours" (new sky, tighter limits) and "Flipside" (mirrored) or
"Overtime" (tighter still) — for 216 levels. The run opens with the cart, then the cannon; after that
each pass deals the next-hardest course from every department in a shuffled
order, and every lap after the first reshuffles everything, so there's always
a next level and no visible end. Passed levels can be played again from the
Replay page. Progress and total score are saved; each level earns 1–3 stars,
and stars unlock new dummy suits.

Keyboard: <kbd>Space</kbd> / <kbd>Enter</kbd> works wherever a tap does.

## Tech

- [three.js](https://threejs.org) rendering with a physical sky, image-based
  lighting and soft shadows. Every texture is painted procedurally at load.
- [Rapier](https://rapier.rs) physics. The dummy is 11 rigid bodies joined by
  ball and hinge joints, driven by joint motors for muscle tone plus a balance
  controller that keeps him (mostly) upright.
- All audio is synthesised with WebAudio — no sound files.
- YouTube Playables SDK: first-frame/ready signals, pause/resume, audio
  toggle, cloud saves and score reporting live in `src/platform/yt.js`.
  Outside Playables the SDK calls are no-ops and progress is kept in
  `localStorage`.

## Project layout

```
src/
  main.js            boot sequence
  core/              game flow, input, audio, save
  physics/           Rapier world wrapper
  dummy/             ragdoll physics + visuals
  render/            renderer, materials, textures, effects, camera
  world/             level building blocks (props, hazards, cannon, cart, car, track)
  modes/             one class per department
  levels/            level data for each department, plus the endless sequence
  ui/                menus, HUD and modals
```

## Running

```
npm install
npm run dev       # unminified build into dist/
npx serve dist    # or any static server
```

## Building for upload

```
npm run build     # minified bundle in dist/ (index.html at the root)
npm run zip       # dist/ zipped as flop-labs.zip, ready to upload
npm run preview   # preview/flop-labs.html: one self-contained file to open anywhere
```
