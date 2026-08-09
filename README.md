# Quantum Materials RPG

A browser-based, Pokemon-style RPG for teaching Advanced Quantum Materials concepts.
See `DESIGN.md` for the full design.

## Folder contents

- `DESIGN.md` — the living design document (world map, type system, battle rules,
  mentors/story, tech stack, roadmap, open questions). Expect this to change as we
  build and playtest; edit it directly rather than starting a new doc.
- `data/materials.json` — data-driven reference for the full type system (all 10
  material types, subtypes, moves, type chart). This is the design-time source of
  truth; `game/src/data/materials.ts` is the smaller, type-checked subset the
  running game actually imports.
- `game/` — **active development happens here.** A Vite + TypeScript + Phaser 3
  project (see "Running the game" below).
- `demo/` — a frozen, no-install snapshot of the game from before the move to
  `game/`. Kept only as a zero-setup fallback (just open the HTML file, no Node
  required); not maintained going forward, so it will drift from `game/` over time.

## Running the game

`game/` needs Node.js (npm) installed.

```
cd video_game/game
npm install
npm run dev
```

This starts a local dev server (Vite prints the URL, typically
`http://localhost:5173`) with hot-reload — edits to any file under `game/src/`
apply instantly in the browser.

To produce a static build (e.g. for hosting on GitHub Pages/Netlify):

```
npm run build    # outputs to game/dist/
npm run preview  # serve that build locally to sanity-check it
```

### `game/` project layout

```
game/
  src/
    main.ts            entry point, creates the Phaser.Game
    data/
      types.ts          shared TS types (Material, Move, MoveClass, ...)
      materials.ts       the moves/materials/type-chart the game currently uses
    art/
      colors.ts          shade() helper + palette
      crystals.ts         procedural faceted-crystal drawing (makeCrystal)
      perspective.ts        over-the-shoulder pseudo-3D projection + fog shading
    scenes/
      OverworldScene.ts    tile-based movement, random encounters
      BattleScene.ts        turn-based battle loop
```

No external image assets yet — all visuals (crystals, tiles) are drawn procedurally
with Phaser's Graphics API, so there's nothing to load/bundle besides code. See
`DESIGN.md` §8 for the art pipeline once real sprites are wanted.

## Running the old demo (no Node required)

Easiest: open `demo/index.html` directly in a browser.

If your browser blocks local scripts from `file://`, serve it instead:

```
cd video_game/demo
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Current status

This is **prototype step 1** from the roadmap in `DESIGN.md`: just enough of World 1
(the tutorial meadow) to test whether the core loop — walk around, get ambushed in
tall grass, fight a turn-based battle with type-effective moves — is fun. No mentors,
no economy, no save system yet.

- The game is about the crystals, not a trainer catching them — the
  player-controlled avatar is itself a crystal (currently Silicon), the same one
  used on the player's side of every battle. There is no separate human sprite.
- Over-the-shoulder pseudo-3D camera (World of Final Fantasy-style): the
  player's crystal floats fixed near the bottom of the screen, while the meadow
  scrolls toward the camera as you walk. Up/Down walk the path forward/back,
  Left/Right step sideways; movement/encounter logic underneath is still a
  plain 2D grid, only the rendering is projected in perspective
  (`src/art/perspective.ts`).
- Walking into tall grass has a chance to trigger a random battle against a wild
  crystal drawn from World 1's pool, each named after a real compound (e.g.
  Graphene, Manganese Oxide, Nickel Oxide) and rendered as a shiny faceted
  crystal. Wild pools are data-driven per world (`WORLD_CRYSTALS` in
  `game/src/data/materials.ts`), so other worlds can have their own specials
  once their maps are built — only World 1 has a built overworld map so far.
- Battles are two-move turn-based fights with a type-effectiveness system
  covering all 8 move classes / 10 material types from `DESIGN.md` §3.
- Win or lose, you return to the same world and can keep walking into the grass.
