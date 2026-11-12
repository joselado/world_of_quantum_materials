---
name: verify-ui
description: Verify a Phaser UI/panel change in world_of_quantum_materials actually renders correctly, by driving a headless Chromium instance against the running dev server. Use after any change touching OverworldScene/BattleScene/HubScene/TitleScene layout, panel sizing, or text -- before reporting that kind of change as done. Catches text overflow, clipped panels, and dead click targets that `tsc --noEmit` can't see.
---

# Verify a Phaser UI change

This game has no headless test suite for its Phaser scenes
(`dev_notes/DEVELOPMENT.md` §"Verifying UI changes"). "I changed the layout
and it typechecks" is not
verification -- typecheck catches type errors, not broken layouts. This skill
drives the actual running scene in a headless browser and measures real
rendered bounds.

Everything below is procedure this project has already worked out the hard
way (see the "Gotcha" notes) -- follow it rather than re-deriving a check from
scratch.

## 1. Start the dev server

```
cd game
npm run dev &
```

Note the printed URL (typically `http://localhost:5173`).

## 2. Get a headless Chromium driver

Use `puppeteer-core`, which is a devDependency of `game/`, with the cached
Chrome for Testing binary: the `run-game` skill has the exact recipe. On this
machine's Node 18 both `npx playwright` and the `npx puppeteer` CLI fail.

## 3. Drive the scene via `window.__game`

`main.ts` exposes the live `Phaser.Game` instance as `window.__game` in dev
builds. This lets a script reach into scenes directly without clicking
through the UI:

```js
const ow = window.__game.scene.getScene('Overworld'); // or 'Hub' / 'Battle' / 'Title'
ow['showSettingsPanel'](); // TypeScript `private` is compile-time only -- bracket notation still calls it
```

To set the font-scale preset, set it on the registry:

```js
window.__game.registry.set('fontScale', 2);
```

**Do not write `localStorage['qm-rpg-save-v1']` for this.** Saves are per-mode
(`qm-rpg-save-story-v1` / `qm-rpg-save-superposition-v1`), so that key is only a
legacy fallback and writing it **silently does nothing** — you get default-scale
renders while believing you are at Large, with no error. Confirm the scale
actually changed in the render before trusting any "no overflow at Large" result.

To measure a panel for overflow, grab its container's real rendered bounds
and compare against the canvas (`CANVAS_W = 854`, `CANVAS_H = 480`,
`game/src/config/screen.ts`, re-exported from `game/src/art/perspective.ts`):

```js
const bounds = scene['dialogueContainer'].getBounds();
// bounds.right > 854 || bounds.bottom > 480 || bounds.left < 0 || bounds.top < 0  => overflow
```

**Gotcha:** set the headless browser's viewport to exactly `854x480` before
loading the page. `main.ts`'s Phaser config uses `Phaser.Scale.FIT`, so a
viewport of any other size letterboxes/scales the canvas -- game-space pixel
bounds (like the overflow check above) stay correct either way since Phaser's
own coordinate system is unaffected by the CSS-level scaling, but a
screenshot taken at a mismatched viewport will show letterboxing bars rather
than the game filling the frame.

## 4. Check every font-scale preset -- not just the extremes

`game/src/data/settings.ts`'s `FONT_SCALE_PRESETS`:

| label | value |
|---|---|
| Compact | 1 |
| Normal (default) | **1.5** |
| Large | 2 |

**Gotcha:** the default preset is 1.5, not 1. A panel that fits at 1 and at
2 can still overflow at 1.5 -- this happened for real (Bloch's teleport hub,
once Superposition Mode made a 9-destination list routine: fine at 1, not
caught until checked at 1.5). Always include the default, not just the
extremes.

Loop over all three values, reload, re-open the panel under test, and measure.

## 5. Gotchas when scripting multiple scene switches

**Gotcha:** `window.__game.scene.start(key)` called on the top-level
`SceneManager` does *not* stop whatever scene was already running (unlike
`this.scene.start()` called from inside a live scene, which does
stop-then-start). `main.ts`'s scene array is `[Title, Hub, Overworld,
Battle]`, later-indexed scenes render on top -- jumping straight from e.g.
Battle to Overworld this way leaves Battle running invisibly underneath and
the canvas silently freezes on its last frame. When driving multiple scene
switches from outside any scene, explicitly stop every other gameplay scene
first (`window.__game.scene.stop('Battle')` etc.), or route every switch
through a small in-page helper that does that for you.

**Gotcha:** when triggering a button programmatically instead of an actual
click (e.g. `page.evaluate` calling `.emit('pointerdown')` on a button game
object), scope your object search to the specific overlay container
(`scene['dialogueContainer']` for an overworld/hub panel, or the specific
`Container` at the panel's own `depth` for an in-battle popup like
`showAnalyticQuestion`) rather than walking the whole scene's
`children.list`. Decorative non-interactive `Text` objects (wandering-crystal
labels, orbiting avatar glyphs) can share a real button's exact label text --
filter to `obj.input` (only set once `setInteractive()` is called), which is
necessary but not sufficient once a scene has multiple panels/containers
layered at once.

**Gotcha:** an open panel is more than its container. The overworld and the
Lab put a dark layer under it and hide the HUD labels and, over a panel that
does not spend, the qumatessence counter (`scenes/panels/scrim.ts`'s
`PanelChrome`); a battle question dims the field and hides the move menu.
Close a panel through the scene's own path (`closeDialogue()`, a click on its
button). A script that destroys the container directly leaves the dark layer
up and the menu hidden, and the next thing it captures is a dim, empty frame:
that is how a doc screenshot of the move menu came out blank once. In a battle
the reset is `b['setScrim'](false)` and `b['moveMenu'].setVisible(true)`.

**Gotcha:** do not edit files under `game/src` while a check is running. Vite
reloads the page, `window.__game` is gone for a moment, and the run reports
failures that are not real.

**Gotcha:** at an 854x480 viewport the game draws at display scale 1. A player
on a large screen sees the same layout at two or three drawn pixels per game
pixel, with text rasterized at that scale. Bounds are in game pixels at any
scale, so overflow checks do not change, but to look at the frame a player
sees load `?scale=2` with `deviceScaleFactor: 2` (see `run-game`).

## 6. What to actually check

For the panel(s)/scene(s) your change touched:
- No overflow/clipping at any of the three font-scale presets (§4), including
  the panel's own background rectangle sized to its real content height where
  relevant (many panels in this codebase lay out content top-down first with a
  running `y`, then insert a background sized to the final `y` -- confirm that
  final size is what's checked, not a stale fixed guess).
- Every interactive element (buttons, list rows, hotspots) is actually
  reachable/clickable at the viewport size the game runs at, not just present
  in the scene graph.
- If the change added a scrollable/paginated list, check it at both the
  shortest and longest realistic content length (e.g. zero results, one
  result, and a full-size list -- Superposition Mode's fuller candidate pools
  are usually the largest realistic case in this game).
- Take a screenshot (`page.screenshot()`) of each checked state to the
  scratchpad directory as supporting evidence, not just a pass/fail claim.

## 7. Report

State plainly which states you checked (scene, panel, font-scale preset,
content-length case), whether each passed, and attach/reference the
screenshots. If something overflows, report the exact bounds you measured
and at which preset -- that's what actually gets it fixed, not "looked fine
to me."
