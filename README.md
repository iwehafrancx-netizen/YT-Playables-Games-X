# YT Playables Games

A collection of HTML5 games built for [YouTube Playables](https://developers.google.com/youtube/gaming/playables).

Each game lives in `games/<name>/` as a standalone static bundle that can be
zipped and uploaded as-is.

## Games

_Coming soon._

## Running a game locally

```
python3 -m http.server -d games/<name> 8080
```

Then open http://localhost:8080.

## Packaging for upload

```
cd games/<name> && zip -r ../../<name>.zip . -x "README.md"
```
