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

What works: install `puppeteer-core` (not full `puppeteer`, and not via the
`npx puppeteer` CLI) as a plain dependency, and point it at the Chrome for
Testing binary Puppeteer has already cached on this machine, rather than
letting it try to download/manage a browser itself:

```bash
mkdir -p /tmp/pptr-driver && cd /tmp/pptr-driver
npm init -y >/dev/null 2>&1
npm install puppeteer-core@22

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

Check `page.on('console', ...)` for `type() === 'error'` before declaring
success -- a blank canvas with a thrown error is not a working title screen.
A single `Failed to load resource: 404` for `/favicon.ico` is expected and
harmless.
