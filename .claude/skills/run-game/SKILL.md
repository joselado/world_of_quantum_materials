---
name: run-game
description: Launch world_of_quantum_materials (the Vite + Phaser 3 dev server) and drive it headlessly to prove it renders, for use with the general "run" skill or whenever asked to run/start/screenshot the game. Captures the Node-version workaround this machine needs (system Node is 18, so Playwright and the `puppeteer` CLI both fail) -- use `puppeteer-core` against the cached Chrome-for-Testing binary instead.
---

# Running world_of_quantum_materials

The game is a Vite dev server (`game/`), not a static site -- "running" it
means starting that server and loading the page in a browser. See
`dev_notes/DEVELOPMENT.md` for the full project layout; this skill only
covers the launch + headless-verify mechanics.

## 1. Start the dev server

```bash
cd game
npm install   # only if node_modules is missing
npm run dev &
```

Poll instead of guessing a sleep:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:5173/ >/dev/null; do sleep 1; done'
```

Vite prints the URL -- normally `http://localhost:5173/`. To stop it later:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

## 2. Drive it headlessly

**Gotcha:** this machine's system Node is 18.19.1.
- `npx playwright` fails outright: "Playwright requires Node.js 20 or
  higher."
- `npx puppeteer` (the CLI) also fails, from an unrelated transitive
  dependency (`string-width`) using a regex `v` flag Node 18 doesn't
  support -- a confusing error that looks unrelated to Puppeteer itself.

What works: `puppeteer-core` (not full `puppeteer`, and not the
`npx puppeteer` CLI), pointed at the Chrome for Testing binary Puppeteer has
already cached on this machine. It is a devDependency of `game/`, so nothing
needs installing; a script that lives outside `game/` (the scratchpad, a
skill's folder) reaches it through `createRequire`:

```js
import { createRequire } from 'node:module';
const require = createRequire('/abs/path/to/game/package.json');
const puppeteer = require('puppeteer-core');
```

```bash
export CHROME_BIN=$(find ~/.cache/puppeteer/chrome -maxdepth 2 -type d -iname 'linux-*' \
  -exec find {} -maxdepth 2 -type f -iname chrome \; | head -1)
```

Then a small script using `puppeteer-core` directly (`launch({
executablePath: process.env.CHROME_BIN, args: ['--no-sandbox',
'--disable-setuid-sandbox'] })`) works fine on Node 18 -- it's only the CLI
wrappers/newer libraries that break, not the browser or the core API.

## 3. Drive the scene / take a screenshot

Set the viewport to `854x480` (the game's canvas size, `Phaser.Scale.FIT`
letterboxes at other sizes) before `goto`, `waitForSelector('canvas')`, then
give it ~1-1.5s for Phaser's boot sequence before screenshotting -- the title
screen ("WORLD OF QUANTUM MATERIALS", New Game / Story Mode / Superposition
Mode) is the representative first paint that proves the app is actually
running, not just that the dev server responds.

`main.ts` exposes `window.__game` in dev builds for driving scenes/panels
directly instead of clicking through the UI -- see `verify-ui` skill and
`dev_notes/DEVELOPMENT.md` §"Verifying UI changes" for the full API and its gotchas
(scene-switching, font-scale presets, container scoping) when the task is
verifying a specific UI change rather than just confirming the game boots.

## 4. Which game the headless browser is running

Headless Chrome's WebGL is a software one by default, and the game answers
that by choosing its Canvas renderer and staying at display scale 1
(`main.ts`'s `chooseRenderer`). That is not what a player with a GPU sees.
Say which one you want:

- `?renderer=webgl` forces the WebGL renderer on the software backend. The
  check scripts under `game/scripts/` all load the page this way.
- `?scale=N` pins the display scale (drawn pixels per game pixel). Use it with
  `deviceScaleFactor: N` on the viewport for a sharp frame at N times 854x480;
  a `deviceScaleFactor` alone is a blurred enlargement.
- `?vectors=phaser` turns the vector layers off (`art/graphicsCache.ts`,
  `art/fastGraphics.ts`), for a reference frame.
- For this machine's real GPU, launch Chrome with `--use-angle=vulkan
  --enable-features=Vulkan --enable-gpu --ignore-gpu-blocklist`. The default
  GL backend gives "Cannot create WebGL context" here. Anything about frame
  rate needs this; see the `measure-smoothness` skill.

Do not edit files under `game/src` while a headless script is running: Vite
reloads the page under it and the script fails in ways that look like game
bugs.

The built game (`npm run build && npm run bundle`,
`game/dist/world_of_quantum_materials.html`, opened as a `file://` URL) has no
`window.__game`. Drive it with real keys and clicks: Space on the title, a
click on the Lab tip's Close and on "Enter The Mean Fields", clicks through
the world's opening story, then the arrow keys.

Check `page.on('console', ...)` for `type() === 'error'` before declaring
success -- a blank canvas with a thrown error is not a working title screen.
A single `Failed to load resource: 404` for `/favicon.ico` is expected and
harmless.
