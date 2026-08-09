# Style Notes

Living record of current visual/style decisions for the game (`game/src/art/`,
`game/src/world/`, `game/src/scenes/OverworldScene.ts`, `game/src/scenes/BattleScene.ts`).
Companion to `DESIGN.md`, which
covers mechanics/content; this file covers "how things currently look" -- sizes, colors,
shapes. Edit in place as choices change; when a new decision replaces an old one, remove
the old entry rather than appending a changelog, so this always reflects current reality.

## Title screen (`scenes/TitleScene.ts`)

- Dark indigo gradient (`0x0c1030` → `0x241a44`), the player's own crystal (`makeCrystal`,
  size `60`) bobbing above the title text, no biome/perspective machinery involved -- this
  screen exists to load the save (see DESIGN.md §7) and hand off to the Hub, not to be a
  world of its own. Button label reads "Continue" if a save exists (`data/save.ts`'s
  `hasSave`) or "New Game" otherwise; both SPACE and a click on the button start the Hub.

## The Hub (`scenes/HubScene.ts`, world 0)

- A single static room, not a walkable map: dark blue-purple gradient background with a
  lighter "floor" band (from y=340 down) ruled into vertical panel lines for a bit of
  architectural texture. No perspective/camera machinery -- everything is laid out at fixed
  canvas coordinates.
- Three hotspots in a row on the floor band (`addHotspot`), each a small `makeCrystal` icon
  bobbing in place with a label underneath, in the same gold-on-black label treatment as
  overworld encounters/tokens: a purple prism for "Materialdex", a gold shard for "Save
  Point", and a green cluster for the door, whose label switches between "Enter World 1" and
  "Enter World N+1" depending on how far `rivalDefeated` has progressed. Clicking a hotspot
  while another panel is already open is a no-op (one panel at a time).
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

## Noether in the overworld (`OverworldScene.spawnNoetherSprite`)

- World 1 only: her avatar (`art/mentor.ts`'s `makeNoetherAvatar`, scaled up slightly to
  `1.1`) stands floating at the map's goal tile (`goal.x`/`goal.y` from `world/mapgen.ts`),
  a `Noether` name label beneath her in the same gold-on-black treatment wild-encounter/
  token labels use. Reuses the crystal/token `WorldSprite` projection/wander/bob machinery
  (`updateWorldSprites`) rather than a bespoke sprite path, so she scrolls, fades with
  distance, and idly wanders exactly like every other world sprite -- the player sees and
  walks up to her instead of her only materializing once the goal-row dialogue fires.
  Depth `20`/`21` (container/label), matching wild-encounter crystals. Permanent -- unlike
  encounter/token sprites she's never removed, since reaching the goal row still opens her
  shop dialogue on top of (not instead of) her standing there.

## Noether's shop (`OverworldScene.showNoetherShop`)

- Same panel treatment as a wild encounter, but stroked in gold (`0xffe066`) instead of
  blue-grey, and fronted by Noether's own avatar (`art/mentor.ts`'s `makeNoetherAvatar`)
  instead of a crystal -- a small cartoon deity floating in a flowing golden robe with wide
  welcoming sleeves, a haloed head, and four motes orbiting the whole figure, deliberately
  not another faceted crystal so a mentor reads as a distinct, benevolent presence rather
  than a wild encounter. An inner container sways gently on its own (independent of the
  panel's own bob tween on the outer container) so she reads as adrift rather than fixed in
  place; a soft additive glow behind her pulses slowly for a "presence" that a flat
  silhouette wouldn't give. A short layered-bell chime (`audio/sfx.ts`'s `playNoetherChime`)
  plays whenever the shop opens. Sized and positioned (`panelY - 105`, avatar top edge
  landing a few px inside the panel's own top edge, intro text pushed down to `panelY - 68`)
  to fit the same panel that a future mentor-specific builder would need to budget for too --
  future mentors (Bloch, Dirac, ...) should get their own builders in their own files rather
  than reusing this one. Appears automatically every time the Overworld scene is (re)created
  with world 1's goal already reached (`OverworldScene.maybeAutoOpenGoalDialogue`) -- first
  on stepping onto the goal row, then again after every later round trip through
  `BattleScene`, so the shop stays revisitable as the player earns more qumatokens instead
  of a single one-shot popup. Panel height `340` (taller than a wild encounter's `300`) to
  fit the fixed footer row below the shop list.
- Below the intro line, one button per still-unbought move (`data/materials.ts`'s
  `SHOP_MOVE_IDS`), labeled `<move name> -- <cost> qumatokens`; a button for a move the
  player can't yet afford is dimmed to 50% alpha rather than hidden, so the shop still
  previews what's coming. Buying rebuilds the whole panel so the bought move drops off the
  list. Below the (variable-length) shop list, a fixed footer row at `panelY + 120` -- not
  stacked beneath the list, so it can't run off the panel regardless of how many moves are
  still for sale -- holds "Farewell" and a second button reading "Face the Rival ->" (before
  that world's rival is beaten) or "Continue to World N+1 ->" (after), side by side via
  `addDialogueButtonAt`.

## The rival gate (`OverworldScene.showRivalEncounter`)

- Triggered by clicking "Face the Rival ->" in Noether's shop, not automatically on reaching
  the goal -- so the player can shop for moves before ever facing the fight they're being
  gated on. Same panel treatment as a wild encounter (600×260, centered crystal, italic
  line beneath), but stroked in red (`0xff6666`) instead of blue-grey or gold, and with a
  single mandatory "Battle!" button -- no "let me pass," since a gate that can be skipped
  isn't a gate. Losing doesn't set anything back except the token stake (see Stakes in
  DESIGN.md §4): the shop simply reopens and "Face the Rival ->" is still there to retry.

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

## Attack effects (`art/attackEffects.ts`, `audio/sfx.ts`, `scenes/BattleScene.ts`)

- Every move renders a distinct particle effect keyed by its move class, not just a color
  swap: a fast focused **bolt** with a glowing double-width trailing line (Phonon Beam,
  Electron Pulse, Spinon Swap), an **expanding ring** pulse with a bright inner rim (Magnon
  Pulse, Polaron Drag), or a cluster of small particles that **converge/scatter** near the
  target (Impurity Scatter, Anyon Braid, Majorana Split). Each class also has its own color
  (e.g. orange for Phonon Beam, red for Magnon Pulse, grey for Impurity Scatter). All three
  shapes render additive-blended (`Phaser.BlendModes.ADD`) so they glow instead of reading
  as flat shapes.
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
