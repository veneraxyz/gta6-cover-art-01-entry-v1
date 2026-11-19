# Vice Cover Studio

Turn your photo and a caption into poster cover art in the style of classic
open-world games: multi-panel layouts, bold caption lettering, and a Vice
City sunset or neon colour grade — exported as a PNG to share.

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/veneraxyz/gta6-cover-art-01-entry-v1/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/veneraxyz/gta6-cover-art-01-entry-v1/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

## What it does

- **Any photo** — load your own photos (file picker or drag-and-drop), or try
  the built-in samples. Fill several panels with one photo or several.
- **Crop and position each panel** — click a panel, drag to position its
  photo, scroll or use the slider to zoom, double-click to reset.
- **Three layouts** — Triptych, Split and Quad, each adapting to the export
  shape. Panels without a photo show a sunset drawn in code (slatted sun,
  sea, palm silhouettes), so the cover always looks finished.
- **Caption lettering** — editable title and subtitle, size, five title
  colours, and three lettering styles (bold outline, drop shadow, flat),
  set in Anton (SIL Open Font License, shipped under `app/fonts/`).
- **Colour grades** — Sunset, Neon Nights, Ultraviolet and Palm Dusk.
- **Fast export** — one click renders an exact-pixel PNG at 1080 × 1080,
  1080 × 1350 or 1920 × 1080. What the live preview shows is what exports.

Everything is original: no Rockstar Games logo, wordmark, artwork, character
or font. Photos are read on your own machine and never uploaded; the app is
static files with no network request.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no
dependencies — `app/index.html` plus its files under `app/` is the whole app.

## Layout of the entry

- `app/index.html` — the editor page
- `app/style.css` — the editor styling
- `app/src/cover.js` — the cover engine: layouts, crops, grades, the drawn
  sunset backdrop and the caption lettering
- `app/src/main.js` — the editor: photo library, panel controls, export
- `app/src/shots.js` — reproducible screenshot setups (`?shot=editor` /
  `?shot=cover`)
- `app/fonts/anton.woff2` — Anton display font (SIL OFL 1.1, see `OFL.txt`)
- `app/samples/` — two kit-provided sample photos, free to use
- `screenshots/` — the entry screenshots: exported covers and the editor

<sub>Entered on [make.fun](https://make.fun/?ref=xfyp0yk1&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
