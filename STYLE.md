# Style Notes

Living record of current visual/style decisions for the game (`game/src/art/`,
`game/src/world/`, `game/src/scenes/OverworldScene.ts`, `game/src/scenes/BattleScene.ts`).
Companion to `DESIGN.md` (mechanics/content) and `CODEMAP.md` (where things live in the
code); this file covers "how things currently look" -- sizes, colors, shapes. Edit in place
as choices change; when a new decision replaces an old one, remove the old entry rather
than appending a changelog, so this always reflects current reality.

## Title screen (`scenes/TitleScene.ts`)

- Dark indigo gradient (`0x0c1030` → `0x241a44`), no biome/perspective machinery involved --
  this screen exists to load the save (see DESIGN.md §7) and hand off to the Hub, not to be a
  world of its own. Title text reads "WORLD OF QUANTUM MATERIALS" (`26px` bold) over "a
  crystal RPG" in muted italic blue-grey. Button label reads "Continue" if a save exists
  (`data/save.ts`'s `hasSave`) or "New Game" otherwise; both SPACE and a click on the button
  start the Hub.
- Above the title text, a small showcase cluster of five crystals (`drawShowcaseCrystals`,
  the module-level `SHOWCASE` array) rather than a single crystal -- a curated handful of
  `data/materials.ts`'s `TYPE_LOOK` entries (trivial, tensornet, magnet, supercon,
  topological), not tied to the player's own save/current form, since this is a "world full
  of different materials" branding image rather than a "welcome back" one (the Hub is where
  the player's own crystal gets its own moment). One centered "hero" crystal (biggest,
  drawn last so it renders on top) flanked by two nearer and two further/smaller ones, each
  bobbing on its own independent duration/delay so the cluster reads as alive rather than a
  single synchronized animation.
- Below the "Press SPACE..." hint, a small **Debug Mode** toggle (`addDebugToggle`) -- a single
  text button reading `Debug Mode: OFF`/`ON`, dim blue-grey (`#8fa0c9`) when off and a warning
  pink (`#ff8fa0`) when on so it's visually obvious debug mode is active. Deliberately placed on
  the title screen (a deliberate choice made before starting) rather than toggleable mid-run.

## The Hub (`scenes/HubScene.ts`, world 0)

- A single static room, not a walkable map: dark blue-purple gradient background with a
  lighter "floor" band (from y=340 down) ruled into vertical panel lines for a bit of
  architectural texture. No perspective/camera machinery -- everything is laid out at fixed
  canvas coordinates.
- Three hotspots in a row on the floor band (`addHotspot`), each a small `makeCrystal` icon
  bobbing in place with a label underneath, in the same gold-on-black label treatment as
  overworld encounters/tokens: a purple prism for "Materialdex", a gold shard for "Save
  Point", and a green cluster for the door, whose label switches between "Enter World 1" and
  "Enter World N+1" depending on how far `rivalDefeated` has progressed -- or, while Debug Mode
  is on, reads "Debug: Warp" and opens a world-select panel instead (see below). Clicking a
  hotspot while another panel is already open is a no-op (one panel at a time).
- Materialdex/Save Point panels reuse the same dark rounded-rectangle-with-stroke treatment
  as overworld dialogues (`showPanel`), stroked in purple (`0x9a6ad9`) to match the
  Materialdex icon, with a single "Close" button -- no per-material navigation yet, just a
  scrolled list of `name -- blurb` lines (`data/materialdex.ts`).

## Overworld path

- The grid is `GRID_W = 27` columns wide (`OverworldScene.ts`), but the walkable corridor
  itself is narrow relative to that -- `CORRIDOR_HALF_WIDTH = 3` in `world/mapgen.ts`, so
  7 tiles wide. The corridor's center drifts left/right (by 1, occasionally 2, tiles at a
  time) as it climbs toward the goal row, and drifts often/far enough that walking straight
  (holding one direction) runs off the edge of the corridor -- reaching the goal requires
  actually tracking the bend sideways, not just holding "forward."
- Short (3-6 tile) dead-end branches fork off the corridor's edges at random rows. Exactly
  one route (the corridor itself) reaches the goal row; branches never reconnect to it.
- Off-path tiles render as raised, solid-looking wall blocks, not just differently-colored
  flat ground: every edge a non-walkable tile shares with a walkable neighbor gets an
  extruded vertical face (`OverworldScene.drawWallFaces`, `WALL_HEIGHT_PX = 30`), shaded
  darker than the tile's own top color and shaded differently per facing (near/far/left/
  right) for a bit of pseudo-3D shading. Each face also gets a darker mortar line partway
  up and a brighter rim along its top edge (as if lit from above), so it reads as a
  stacked stone block rather than a flat colored card. Reads unambiguously as "you cannot
  walk here."
- Decoration (flowers / crystal glints) is placed in the off-path terrain only, not on
  walkable tiles -- those are reserved for wild encounters (on the corridor) and
  qumatoken pickups (at branch dead ends).
- Map regenerates fresh (new `Math.random` layout) on first load and on an explicit world
  switch (Space). A round trip through a battle restores the exact same layout and player
  position instead of regenerating (`OverworldScene.saveMapState`/`restoreMap`); the
  pre-battle encounter dialogue itself never leaves the overworld scene, so passing on it
  needs no round trip at all.

## Biomes (`art/biomes.ts`)

Per-world skin: sky/ceiling gradient, hill/ceiling silhouette, wall-block color (off-path),
on-path trail color, ambient decoration style, fog blend target, and whether clouds render.

| World | Biome | Sky/ceiling | Walls (off-path) | Path | Decoration | Clouds |
|---|---|---|---|---|---|---|
| 1 | Tutorial Meadow | pale blue gradient (`0x8fd0ff`→`0xe8f6ff`) | grass `0x2e7d32` | dirt `0xb08d57` | flowers | yes |
| 2 | Crystalline Caves | dark purple gradient (`0x1a1730`→`0x362f5c`) | stone `0x2b2b3a` | cave floor `0x585073` | crystal glints (cyan) | no |
| 3 | Floating Islands | deep-to-pale blue gradient (`0x2a3d6b`→`0x8fb8e8`) | slate blue `0x35507a` | pale sky-blue walkway `0x9ac0e0` | crystal glints (cyan) | yes |

## Qumatoken pickups (`art/tokens.ts`, `data/tokens.ts`)

- One token sits at the dead end of each branch (not scattered along it).
- Rendered as a "shiny cloud" (cluster of soft overlapping circles + bright core + halo +
  sparkles), `makeToken()` -- deliberately different silhouette from the faceted
  crystal/prism look used for wild encounters and the player, so pickups read as
  collectibles rather than creatures at a glance.
- Size: `TOKEN_SIZE = 26` in `OverworldScene.ts` (bigger than the `CRYSTAL_SIZE = 22` wild
  encounters, since a pickup should stand out).
- Value tiers, color-coded, weighted toward the common tier (`data/tokens.ts`):
  - `1` -- cyan `0x8fe8ff`, weight 0.6 (common)
  - `5` -- gold `0xffe066`, weight 0.3 (uncommon)
  - `10` -- pink `0xff7ce0`, weight 0.1 (rare)
- Each pickup shows a `+<value>` label underneath, same treatment as wild-encounter name
  labels.

## Crystal sprites (player + wild encounters)

- Shared `makeCrystal()` builder (`art/crystals.ts`): faceted `shard` / `cluster` / `prism`
  silhouette per material, colored per its main type (`TYPE_LOOK` in `data/materials.ts`),
  plus a highlight and twinkling sparkles.
- Sizes: player `PLAYER_CRYSTAL_SIZE = 34` (largest, always on-screen), wild encounters
  `CRYSTAL_SIZE = 22`.

## Wild encounter dialogue (`OverworldScene.showEncounter`)

- Appears as an overlay panel inside the overworld itself (dark `0x10101c` rectangle,
  `600x300`, stroked in `0x444466`) rather than switching to a separate scene --
  asking a question or offering a fight shouldn't feel like leaving the map. Movement is
  frozen (`dialogueActive`) while it's open.
- Single screen, no click-through: the wild crystal bobs at the top (`makeCrystal()`, size
  30), directly below it an italic greeting line keyed to the material's main type
  (`data/greetings.ts`'s `encounterGreeting`, in muted blue-grey `#cfd8ff`), and directly
  below that -- already visible, no "Continue" step -- either the physics question (gold
  `#ffe066`, if the material has a `data/quiz.ts` entry -- one question drawn at random
  from that material's pool of at least 6, via `getMaterialQuestion`, so the same material
  doesn't always ask the same thing) with two shuffled answer buttons plus "Let me pass," or
  a plain "Fight!" / "Let me pass" choice if it doesn't. Buttons use
  the same `[ #222244 background / #ffff88 text ]` treatment `BattleScene`'s move buttons
  use, for visual continuity between the map and the battle screen. Question, answer, and
  greeting text are all kept short (one line each) so the panel reads at a glance.
- Choosing to fight (via a correct/wrong answer or the no-question "Fight!" button) starts
  `BattleScene`; "Let me pass" just closes the panel with no scene change and no
  win/loss consequence.

## Mentors in the overworld (`OverworldScene.spawnMentorSprite`)

- Every mentor (Noether included) stands floating at their world's *middle* tile
  (`WORLD_MENTORS`' `tile: 'middle'`, `mid.x`/`mid.y` from `world/mapgen.ts` --
  roughly the corridor's halfway row), not the goal -- the goal tile itself now
  belongs to that world's boss avatar (see below). One shared `spawnMentorSprite`
  builds all of them from the `WORLD_MENTORS` table (avatar builder, scale `1.1`,
  name label in the mentor's own `labelColor`) rather than a bespoke function per
  mentor. Reuses the crystal/token `WorldSprite` projection/wander/bob machinery
  (`updateWorldSprites`) rather than a bespoke sprite path, so a mentor scrolls,
  fades with distance, and idly wanders exactly like every other world sprite --
  the player sees and walks up to them instead of them only materializing once
  their dialogue fires. Depth `20`/`21` (container/label), matching wild-encounter
  crystals. Permanent -- unlike encounter/token sprites a mentor is never removed,
  since reaching their row still opens their panel on top of (not instead of) them
  standing there.

## Noether's shop (`OverworldScene.showNoetherShop`)

- Same panel treatment as a wild encounter, but stroked in gold (`0xffe066`) instead of
  blue-grey, and fronted by Noether's own avatar (`art/mentor.ts`'s `makeNoetherAvatar`)
  instead of a crystal -- a small cartoon deity floating in a flowing golden robe with wide
  welcoming sleeves, a haloed head, and four motes orbiting the whole figure, deliberately
  not another faceted crystal so a mentor reads as a distinct, benevolent presence rather
  than a wild encounter. An inner container sways gently on its own (independent of the
  panel's own bob tween on the outer container) so she reads as adrift rather than fixed in
  place; a soft additive glow behind her pulses slowly for a "presence" that a flat
  silhouette wouldn't give. A short layered-bell chime (`audio/sfx.ts`'s `playMentorChime`,
  shared by every mentor panel) plays whenever the shop opens. Sized and positioned
  (`panelY - 105`, avatar top edge landing a few px inside the panel's own top edge, intro
  text pushed down to `panelY - 68`) to fit the same panel every later mentor panel
  (Bloch's, Bohr's) reuses -- each mentor still gets its own avatar builder in its own file
  (`art/bloch.ts`, `art/bohr.ts`, ...) even though the surrounding panel shape is shared.
  Appears automatically every time the Overworld scene is (re)created with this world's
  middle row already reached (`OverworldScene.maybeAutoOpenMiddleDialogue`) -- first on
  stepping onto that row, then again after every later round trip through `BattleScene`,
  so the panel stays revisitable instead of a single one-shot popup. Panel height `340`
  (taller than a wild encounter's `300`) to fit the fixed footer row below the content.
- Below the intro line, two small tab buttons (`renderShopTabs`, `panelY - 42`) switch the
  panel between a **Moves** list and a **Stats** list (`OverworldScene.shopTab`, reset to
  `'moves'` on every scene create) -- the active tab is highlighted gold-on-slate, the
  inactive one dim blue-grey, same click-to-rebuild-the-panel pattern as buying itself.
  - **Moves**: one button per still-unbought move the player's *current crystal form* can
    physically carry (`data/materials.ts`'s `SHOP_MOVE_IDS` filtered through
    `compatibleMoves`), labeled `<move name> -- <cost> qumatokens`; unaffordable buttons dim
    to 50% alpha rather than hide, so the shop still previews what's coming.
  - **Stats**: one button per stat (Quantumness/Velocity/Correlation), labeled
    `<stat> (<role>): <value> -> <value+1> -- <cost> qumatokens`, same afford/dim treatment.
  - Both tabs' rows start at `panelY - 8`, spaced `36`px apart, buying/upgrading rebuilds
    the whole panel so the list updates and the token total on display stays correct.
- Below the (variable-length) tab content, a fixed footer row at `panelY + 120`
  (`renderShopFooter`) -- not stacked beneath the content, so it can't run off the panel
  regardless of how many rows are showing -- holds "Farewell" and a second button reading
  "Face the Rival ->" (before that world's rival is beaten) or "Continue to World N+1 ->"
  (after), side by side via `addDialogueButtonAt`. Bloch's and Bohr's panels (below) reuse
  this same footer/tab-content layout.

## Bloch in the overworld (`OverworldScene.showBlochHub`)

- World 2 only, standing at the middle tile like every other mentor -- same
  landmark/wander/re-open pattern as Noether (see above), just with `art/bloch.ts`'s
  `makeBlochAvatar` and a cyan
  (`0x8fe8ff`) name label. His avatar swaps Noether's halo/head for a wireframe **Bloch
  sphere** (equator + two tilted meridian ellipses, additive-blended, slowly spinning) with
  a bright state-vector arrow pointing off-axis -- a superposition, not a pinned-down state,
  matching his teleport ability -- plus three small orbiting `◇` waypoint marks instead of
  Noether's `✦` motes.
- His panel (`showBlochHub`) is stroked teal (`0x4adde0`) and reuses the same tab-content/
  footer shape as Noether's shop, minus the tabs -- one button per world the player has
  visited (`visitedWorlds`) that also has a built map (`BUILT_WORLDS`), excluding the
  current world, labeled `Travel to World N -- <name>`; clicking teleports there instantly
  (`advanceToWorld`, no battle). Empty state: "You haven't mapped anywhere else yet."

## Bohr in the overworld (`OverworldScene.showBohrPanel`)

- World 3 only, standing at the middle tile like every other mentor, and his panel
  auto-opens on reaching that row (`maybeAutoOpenMiddleDialogue`), same as every
  other mentor. Amber (`0xffa64a`) name label; his avatar
  (`art/bohr.ts`'s `makeBohrAvatar`) swaps the head for a small Bohr-model atom -- a bright
  additive nucleus with three tilted elliptical shells, each carrying one orbiting electron
  at its own speed.
- His panel is stroked amber (`0xffa64a`); up to the 3 most recently defeated wild
  materials (`defeatedMaterials`) each get a button (`Become <name>`, or a dimmed
  `<name> (current form)` for whichever the player is already wearing) that transmutes the
  player's own crystal into that form (`transmuteInto`) -- swaps color/variant/max HP and
  clamps current HP down if needed, and immediately redraws the overworld avatar
  (`redrawPlayerCrystal`). Empty state: "You haven't defeated any crystals yet -- there is
  nothing to become."

## Boss avatars (`OverworldScene.spawnBossSprite`, `art/boss.ts`)

- Every built world's rival/boss stands at the goal tile as a purely visual
  landmark, sized `BOSS_CRYSTAL_SIZE = 70` -- roughly 2x a wild crystal (`22`) and
  2x the player's own on-map size (`34`) -- and rendered by `makeBossCrystal`
  rather than the shared `makeCrystal` every wild/rival crystal otherwise uses:
  four smaller satellite shards (shaded siblings of the core's color, via `shade`)
  fused around one oversized core, a two-layer additive aura that slowly pulses
  scale/alpha, and six hot-orange embers orbiting the whole mass (same
  orbiting-container-angle-tween trick as a mentor avatar's orbiting motes, just
  warmer/redder to read as hostile rather than benevolent). Name label in a
  bold, warning-toned pink-red (`#ff8f8f`), distinct from any mentor's own label
  color. Reuses the `WorldSprite` projection/wander/bob machinery, so it scrolls
  and fades with distance like everything else standing on the map -- it doesn't
  add its own click handler, the fight is still only reached through the goal
  panel's "Face the Rival" button.

## The rival gate (`OverworldScene.showRivalEncounter`)

- Triggered by clicking "Face the Rival ->" in Noether's shop, not automatically on reaching
  the goal -- so the player can shop for moves before ever facing the fight they're being
  gated on. Same panel treatment as a wild encounter (600×260, centered crystal, italic
  line beneath), but stroked in red (`0xff6666`) instead of blue-grey or gold, and with a
  single mandatory "Battle!" button -- no "let me pass," since a gate that can be skipped
  isn't a gate. Losing doesn't set anything back except the token stake (see Stakes in
  DESIGN.md §4): the shop simply reopens and "Face the Rival ->" is still there to retry.

## Boss opponent in battle (`scenes/BattleScene.ts`)

- A rival fight's opponent renders with `art/boss.ts`'s `makeBossCrystal` at
  `BOSS_CRYSTAL_SIZE = 64` -- bigger than an ordinary wild encounter's plain
  `makeCrystal` at `50` -- positioned at `BOSS_OPPONENT_POS` (`{ x: 430, y: 155 }`,
  shifted left and slightly down from the wild encounter's `OPPONENT_POS`) so the
  wider multi-shard silhouette clears the move menu docked at `MENU_X = 456` instead
  of overlapping it. Same look the boss already has standing at its world's goal
  tile in the overworld (`OverworldScene.spawnBossSprite`), carried into the fight
  itself rather than switching to the plain crystal look every wild battle uses.
  Attack effects (`playAttackEffect`'s `from`/`to`) target this shifted position too
  (`BattleScene.opponentPos`), not the wild encounter's fixed `OPPONENT_POS`, so
  bolts/rings/bursts still travel to and from where the crystal actually is.

## Battle status effects (`scenes/BattleScene.ts`)

- Answering the pre-encounter question correctly wraps the player's crystal in a "super
  saiyan"-style golden aura: a soft additive-blended glow fill, two pulsing rings, a ring of
  ten radiant spikes slowly rotating around the crystal, and small embers rising and fading
  above it. All pieces use `Phaser.BlendModes.ADD` so they actually glow (brighten what's
  behind them) instead of reading as flat gold shapes. Answering wrong instead droops a
  small grey raincloud (`addFailCloud`) just above the crystal, bobbing gently. Everything
  is added directly to the player crystal's container so it moves with the existing
  idle-bob tween for free.
- The "A wild X appeared!" opener and the win/lose closing line are flavor text from
  `data/greetings.ts` (`victoryLine`/`defeatLine`), keyed to the wild material's type the
  same way the overworld encounter greeting is. A rival fight swaps the opener for "X blocks
  the way onward!" (no "wild") but reuses the same victory/defeat lines.
- The end-of-battle log text repositions from its usual bottom-anchored combat-log spot
  (`20, 440`) up to `20, 210` -- the summary runs several lines longer once the physics blurb
  (`data/materialdex.ts`'s `materialBlurb`) is appended after the flavor/token lines, and at
  the original position those extra lines would run off the bottom of the canvas.
- Per-turn log text appends "It was super effective!"/"It was not very effective..." for the
  type chart, then a separate "No natural defense against this!" when the quasiparticle
  mismatch multiplier fires (`BattleScene.resolveHit`), then "A coherent critical hit!" for a
  crit -- up to three clauses can stack on one line, in that fixed order.

## Battle move menu (`BattleScene.drawMoveMenu`)

- A docked panel on the right of the field (`x = 456`, `y = 190`, width `176`), same dark
  rounded-rectangle-with-stroke treatment as the overworld's dialogue panels, stroked gold
  (`0xffe066`) to match Noether's own panel color, titled "MOVES" in bold gold. Height grows
  with however many moves are currently usable (`34 + rowCount * 34`) rather than a fixed
  size, since that count changes as the player learns moves or transmutes into a form with
  a different physics-compatible set (§3 of DESIGN.md). Replaces the old scattered
  individually-positioned buttons that used to run off the field past ~4 moves.
- Each move is a `[ #222244 background / #ffff88 text ]` button, same treatment used
  everywhere else (overworld dialogue buttons, the old scattered layout) for visual
  continuity, stacked vertically inside the panel rather than spread horizontally. A form
  with zero currently-usable moves (shouldn't normally happen, since Phonon Beam is
  universal) shows "No usable moves" instead of an empty panel.

## Enter-key pause menu (`OverworldScene.showPauseMenu`/`showInfoPanel`)

- Same dark rounded-rectangle-with-stroke panel treatment as everywhere else, stroked
  blue-grey (`0x8fa0c9`, distinct from every mentor/encounter panel's own stroke color). Rows
  are a data-driven list (`320` wide, height grows with row count, vertically centered on
  the canvas rather than a fixed `panelY` now that the row count regularly reaches 7-8)
  rather than fixed buttons: Return to Lab (same destination as the `H` key), View Moves,
  View Stats, Advisors, Tutorial, Settings, and -- only while Debug Mode is on -- Warp
  (Debug), then Close. Respects `dialogueActive` (won't open over an already-open panel)
  and only exists in `OverworldScene`, not mid-battle.
- "View Moves"/"View Stats" swap the pause menu for a second, generic info panel
  (`showInfoPanel`, `420x300`, same blue-grey stroke) listing the player's learned moves
  (each flagged "-- not compatible with your current form" if the current crystal form
  doesn't support it) or their Quantumness/Velocity/Correlation plus qumatokens and current
  form name, with a single "Close" button.

## Settings panel (`OverworldScene.showSettingsPanel`)

- Same blue-grey (`0x8fa0c9`) stroke as the pause menu it's opened from, sized
  `380x220`. Just one row so far -- "Enemy Density: `<preset>`" -- that cycles
  through `data/settings.ts`'s `DENSITY_PRESETS` (Low/Normal/High/Very High) on
  click and rebuilds the panel in place, same click-to-rebuild pattern Noether's
  shop tabs use, rather than a slider (only four discrete steps). A muted
  blue-grey hint line beneath explains it only affects maps generated after the
  change, then a single "Close" button.

## Tutorial popup (`OverworldScene.showTutorial`/`renderTutorialPage`)

- Same dark rounded-rectangle-with-stroke panel as everywhere else (`560x300`), stroked a
  fresh cyan (`0x5ad9ff`) not used by any other panel. A small `TUTORIAL -- n / N` counter in
  that same cyan sits above the page title (bold white) and body text (muted blue-grey
  `#cfd8ff`, center-aligned, matching the wild-encounter greeting's tone).
- Footer row: `<- Back` (hidden on the first page) and `Next ->` (hidden on the last page)
  flank a center button that reads "Skip" on every page except the last, where it becomes
  "Done" -- both close the panel either way, "Skip"/"Done" is just the honest label for what
  happens at that point in the sequence.
- Triggers automatically once, the first time an Overworld scene is ever created for a save
  (`tutorialSeen`); afterward only opens on request via the Enter-menu's "Tutorial" button,
  always restarting from page 1.

## Debug warp panels (`HubScene.showWorldSelectPanel`, `OverworldScene.showDebugWarpPanel`)

- Both replace the normal way to change world with a plain scrollable-feeling list of all 10
  worlds (`World N -- <name>`, one button per row) when Debug Mode is on -- the Hub's version
  in place of the door's usual "Enter World N" action, the Overworld's as an extra pause-menu
  row for warping mid-run without backtracking to the Hub. Deliberately stroked magenta
  (`0xff4fd8` panel border, `#ff8fe0` title text) -- distinct from every diegetic mentor/
  dialogue panel color on purpose, so a debug-only panel never reads as part of the story.
  The Overworld version dims (50% alpha) and disables the row matching the world already
  entered, labeled "(current)".

## Attack effects (`art/attackEffects.ts`, `audio/sfx.ts`, `scenes/BattleScene.ts`)

- Every move renders a distinct particle effect keyed by its move class, not just a color
  swap: a fast focused **bolt** with a glowing double-width trailing line (Phonon Beam,
  Electron Pulse, Spinon Swap), an **expanding ring** pulse with a bright inner rim (Magnon
  Pulse, Polaron Drag), or a cluster of small particles that **converge/scatter** near the
  target (Anyon Braid, Majorana Split). Each class also has its own color (e.g. orange for
  Phonon Beam, red for Magnon Pulse). All three shapes render additive-blended
  (`Phaser.BlendModes.ADD`) so they glow instead of reading as flat shapes.
- The full beat, in order: a ~90ms additive windup flash at the attacker's own position, the
  travelling effect itself (~340-460ms depending on shape), then a fire-and-forget impact
  shockwave (a white flash plus 8 radiating shards, ~260ms) at the target -- on top of which
  `BattleScene.impactPunch` layers the target crystal's scale-squash (`flashHit`), a small
  camera shake (`0.006`, kept subtle since the field's background is solid black right up to
  the canvas edge), and a brief camera flash. `BattleScene`'s `TURN_GAP_MS` (850ms) leaves
  room for the full ~810ms worst case (ring shape) before the next turn fires.
  Drawn fresh each frame with a `Graphics` object cleared and redrawn every tween tick (same
  pattern as the overworld's per-frame ground mesh) rather than a sprite, then destroyed on
  arrival/decay.
- Each attack also plays a procedural one-shot sound keyed to the same bolt/ring/burst shape
  (`audio/sfx.ts`'s `playAttackSfx`) on launch and an impact thump scaled by the move's
  type-effectiveness multiplier (`playImpactSfx`) on arrival, and dips the currently-playing
  music track's volume for the beat's duration (`audio/music.ts`'s `MusicEngine.duck`) so the
  hit reads clearly over the score before the music comes back up.
