# YT Playables Games

A collection of HTML5 games built for [YouTube Playables](https://developers.google.com/youtube/gaming/playables).

Each game lives in `games/<name>/` as a standalone static bundle that can be
zipped and uploaded as-is.

## Games

| Game | Pitch |
|---|---|
| [Flop Dummies](games/flop-dummies) | A 3D physics party of nine mini-games starring one very floppy crash-test dummy: cannons, carts, cars, backflips, a wrecking-ball crane, rope swings, pin puzzles and more, dealt out as an endless run. |
| [Crazy Ragdoll Games](games/crazy-ragdoll-games) | Fifteen physics party games in a shipping yard — hammer throw, rocket riding, crane stacking, wipeout sweepers, human pinball, Plinko, a trampoline tower, a giant slide, slingshot TNT smashing, bowling, crane swinging, a human cannon, car crashes, shopping-cart jumps and stair falls — starring one very floppy ragdoll. Built for Playgama. |

## Running a game locally

```
python3 -m http.server -d games/<name> 8080
```

Then open http://localhost:8080.

## Packaging for upload

```
cd games/<name> && zip -r ../../<name>.zip . -x "README.md"
```
