# Code Map

Living reference for **where things live in the code**, companion to `DESIGN.md`
(mechanics/content) and `STYLE.md` (visual look). Those two answer "what should this do" and
"what should this look like"; this one answers "which file, which function, which existing
pattern to reuse" -- so a future session can implement a new feature without re-reading the
whole `game/src/` tree first. Edit this in place as the code changes; if something below goes
stale, fix it rather than leaving it wrong.

## File tree

```
game/src/
  main.ts                    Phaser game config, scene list, boot order
  scenes/
    TitleScene.ts             Loads save -> registry, title showcase crystals, "Continue"/"New Game" -> Hub,
                                 Story Mode / Superposition Mode picker
    HubScene.ts                World 0, static room, 3 hotspots (Materialdex/Save/Door, door reads
                                 "Enter World 2 (Bloch)" and drops straight into World 2 in Superposition Mode)
    OverworldScene.ts          Per-world walkable map: movement, encounters, shop, rival gate
    BattleScene.ts             Turn-based battle: move buttons, HP bars, attack effects, log
  world/
    mapgen.ts                  Per-world corridor layout generator (walkable grid, branches)
  art/
    perspective.ts             Pseudo-3D projection (grid coord -> screen point)
    biomes.ts                  Per-world visual skin (sky, walls, path, decoration, fog)
    crystals.ts                 makeCrystal() -- shared shard/cluster/prism sprite builder
    mentor.ts                   makeNoetherAvatar()
    bloch.ts                    makeBlochAvatar()
    bohr.ts                     makeBohrAvatar()
    laughlin.ts                  makeLaughlinAvatar()
    majorana.ts                  makeMajoranaAvatar()
    curie.ts                     makeCurieAvatar()
    bell.ts                      makeBellAvatar()
    kondo.ts                     makeKondoAvatar()
    anderson.ts                   makeAndersonAvatar() -- disordered-lattice head motif, world 9
    boss.ts                      makeBossCrystal() -- gigantic multi-shard boss avatar at a world's goal
    tokens.ts                   makeToken() -- qumatoken pickup sprite
    attackEffects.ts            playAttackEffect() -- bolt/ring/burst/beam/eruption particle effect;
                                  beam/eruption are ANALYTIC_SHAPES' per-move-id overrides (Curie's
                                  Skyfall Beam/Ground Eruption), every other shape is per-MoveClass
    colors.ts                   shade() and other color helpers
  audio/
    sfx.ts                      Procedural sound effects (attack/impact/playMentorChime)
    music.ts                    MusicEngine, per-scene tracks, duck() for attack beats
  data/
    types.ts                    Move, Material, MoveClass, MaterialType, CrystalVariant, Stats
    materials.ts                 MOVES, TYPE_LOOK, WORLD_CRYSTALS, WORLD_RIVALS,
                                  PLAYER_MATERIAL, SHOP_MOVE_IDS, ANALYTIC_MOVE_IDS, WORLD_NAMES,
                                  DEFAULT_STATS, getWildPool(), getRival(), compatibleMoves(),
                                  canHost(), getPlayerMaterial(), getPlayerStats(), getBattleMoves(),
                                  enemyStatsForWorld(), statUpgradeCost(), findMaterialByName(),
                                  allCrystals() -- every WORLD_CRYSTALS entry deduped by name, feeds
                                  Bohr/Majorana/Anderson's Superposition Mode candidate pools,
                                  hybridResultType()/HYBRID_RULES -- Majorana's valid-pairing table,
                                  combineMaterials() -- Majorana's hybrid-material fuser
    tokens.ts                    Qumatoken value tiers + weights
    quiz.ts                      Per-material physics question pools (>=6 each) via
                                  getMaterialQuestion(), plus one flat ANALYTIC_QUESTIONS pool via
                                  getAnalyticQuestion() for Curie's analytic moves (not per-material)
    greetings.ts                 Per-MaterialType flavor lines (encounter/victory/defeat)
    materialdex.ts               Per-material (fallback per-type) physics blurb for Materialdex
    save.ts                      localStorage schema + persistFromRegistry()/load()
    tutorial.ts                    TUTORIAL_TIPS/TUTORIAL_PAGES -- contextual + replayable tutorial copy
    settings.ts                    DENSITY_PRESETS/DEFAULT_ENCOUNTER_DENSITY -- wild-encounter density presets
    story.ts                       STORY_BEATS -- per-world Decoherence-arc line shown on advancing worlds
data/materials.json            Repo-root design-time reference (fuller roster than materials.ts)
```

## Data model (`data/types.ts`, `data/materials.ts`)

- A **Material** is a crystal: `name`, `type` (`MaterialType`), `color`, `variant`
  (shard/cluster/prism/layer/twisted), `maxHp`, `moves` (string ids into `MOVES`).
- The player is not a separate class -- `PLAYER_MATERIAL` is just one `Material` row (currently
  Silicon, `type: 'trivial'`). Its starting `moves` is the tutorial loadout; moves actually
  available in battle also depend on the registry's `unlockedMoves` (grows via Noether's shop).
- `WORLD_CRYSTALS: Record<world, Material[]>` -- wild-encounter pool per world, pulled via
  `getWildPool(world)`. `WORLD_RIVALS: Record<world, Material>` -- the one gating fight per
  world, pulled via `getRival(world)`.
- `MOVES: Record<id, Move>` -- every move is named after the quasiparticle that carries it
  (Phonon Beam, not "Thermal Attack"). `class: MoveClass` drives the attack-effect
  shape/color (`art/attackEffects.ts`'s `EFFECT_STYLE`) and `MOVE_COMPATIBILITY`; `power`
  climbs with how unconventional that quasiparticle is (DESIGN.md §3), not per-move balance
  tuning in isolation.
- `canHost(defenderType, moveClass)` -- does the defender's own `MOVE_COMPATIBILITY` list
  include this class at all; the sole type-interaction check battle damage uses (DESIGN.md
  §4's "quasiparticle mismatch" 2x). There used to be a separate strong/weak `TYPE_CHART` +
  `effectiveness()` stacked on top of this -- removed as an unplaytested second system; don't
  reintroduce it without updating DESIGN.md §3/§4 and STYLE.md's battle-log/move-menu
  sections together.
- **`MOVE_COMPATIBILITY` gates both offense *and* defense at once -- a gotcha worth
  remembering before adding a new `MoveClass`.** The same table backs `compatibleMoves`
  (what the attacker can use) and `canHost` (whether the defender takes the mismatch 2x), so
  leaving a new class off every type's list doesn't make it "unavailable," it makes every
  defender mismatch against it -- a silent, permanent 2x stacked on top of whatever bonus the
  move's own mechanic already applies. This is why `'analytic'` (Curie's moves) is
  deliberately on *every* type's list rather than scoped like every other class: they're a
  technique the player learned, not physics a crystal has to host, so the intent is "always
  usable, never mismatched," and the 2x/0.5x answer-gated multiplier is the class's only
  risk/reward term. Decide this on purpose for any future class, not by omission.
- Per-type look lives in `TYPE_LOOK` (base color + variant, exported); individual compounds
  of the same type get `shade(color, shadeStep * 18)` so siblings (Iron vs. Cobalt) read as a
  family. `TitleScene`'s showcase cluster is the one consumer outside `data/materials.ts`
  itself so far. A compound whose actual dimensionality/stacking doesn't match its type's
  usual gem look overrides it via `crystal()`'s `variantOverride` param (Graphene/Monolayer
  WTe₂/Chromium Triiodide → `'layer'`, Twisted Bilayer MoTe₂ → `'twisted'`; see STYLE.md).

## Cross-cutting patterns (reuse these, don't reinvent)

- **Registry-then-persist.** The Phaser registry (`this.registry`/`game.registry`) is the
  runtime source of truth every scene reads/writes; `data/save.ts`'s `persistFromRegistry()` is
  called after *every* mutation that should survive a reload (token pickup, move purchase, stat
  upgrade, rival defeat, battle outcome, transmutation) rather than only at fixed checkpoints.
  `TitleScene` is the only place that loads localStorage *into* the registry. Any new persistent
  state should follow this same registry-first, persist-on-mutation shape and get added to
  `data/save.ts`'s `SaveData`/`defaultSave()`/`persistFromRegistry()` together.
- **World sprites.** Wild-encounter crystals, qumatoken pickups, and every mentor's overworld
  avatar (Noether, Bloch, Bohr) all share one `WorldSprite` projection/wander/bob system in
  `OverworldScene` (`updateWorldSprites`) rather than bespoke per-kind code -- a new NPC should
  spawn through the same system (see `spawnNoetherSprite`/`spawnBlochSprite`/`spawnBohrSprite`
  as templates), not a new one-off.
- **Panel/dialogue UI.** Every overlay (wild encounter, mentor panels, rival gate, Hub's
  Materialdex/Save panels, the Enter-key menu) is the same dark rounded-rectangle-with-stroke
  treatment, with the stroke color signaling the panel's kind: blue-grey `0x444466` = wild
  encounter (`OverworldScene.showEncounter`) and the Enter-key menu/info panels (`0x8fa0c9`,
  a distinct blue-grey so it doesn't collide), gold `0xffe066` = Noether (and its analytic-move
  counterpart, Curie's `showCuriePanel`, at olive `0xc9d84a`), teal `0x4adde0` = Bloch, amber
  `0xffa64a` = Bohr, green `0x4fd97a` = Majorana's hybrid panel, rust `0xc9884a` = Anderson's
  impurity-doping panel, red `0xff6666` = rival gate,
  purple `0x9a6ad9` = Hub's `showPanel` (Materialdex/Save), lavender `0xd9a5ff` =
  `OverworldScene.showStoryBeat`'s between-worlds panel, and gold `0xffe066` again (matching
  Curie) for `BattleScene.showAnalyticQuestion`'s in-battle question panel, the one dialogue-style
  overlay that lives in `BattleScene` rather than `OverworldScene`. A new panel should pick a
  stroke color that doesn't collide with these.
- **Mentor avatars.** One builder per mentor in its own file: `art/mentor.ts`'s
  `makeNoetherAvatar()`, `art/bloch.ts`'s `makeBlochAvatar()`, `art/bohr.ts`'s
  `makeBohrAvatar()`. Never a shared parameterized builder -- each mentor needs to read as
  visually distinct.
- **Attack effects keyed by MoveClass**, not by move id -- adding/removing a move never touches
  `attackEffects.ts`, only adding/removing a whole `MoveClass` does (update `EFFECT_STYLE` in
  `art/attackEffects.ts` and `MOVE_COMPATIBILITY` in `data/materials.ts` together). One
  deliberate exception: `ANALYTIC_SHAPES: Record<moveId, AttackShape>` overrides the shape
  per move id for the `'analytic'` class specifically, since Curie's two moves (Skyfall Beam,
  Ground Eruption) want two different silhouettes despite sharing one class --
  `BattleScene.resolveHit` looks a move up in `ANALYTIC_SHAPES` and passes it as
  `playAttackEffect`'s `shapeOverride` param, falling back to `EFFECT_STYLE`'s per-class shape
  when a move isn't in that map. A future class wanting the same per-move variety should reuse
  this pattern rather than inventing a second override mechanism.
- **Discovery vs. defeat tracking.** Two separate registry/save lists, both excluding rivals
  (not real compounds): `discoveredMaterials` (`OverworldScene.recordDiscovery`, written on
  first wild *encounter*, feeds the Hub's Materialdex) and `defeatedMaterials`
  (`BattleScene.endBattle`, written on an ordinary wild *win*, feeds Bohr's transmutation
  panel). Don't conflate them -- a material can be encountered without being defeated.

## Player form and moves

**Player form.** `PLAYER_MATERIAL` (Silicon) is only the *default* -- the player's actual
current crystal is `getPlayerMaterial(registry)` (`data/materials.ts`), which reads
registry/save key `playerForm` (a full `Material` or `null`). Every scene that draws/sizes/
types the player goes through this rather than `PLAYER_MATERIAL` directly: `BattleScene
.playerMaterial`, `OverworldScene.playerMaterial`, `HubScene`'s crystal. Two mentors write it,
both through the shared `OverworldScene.applyPlayerForm(material)` (sets `playerForm`, clamps
HP down to the new form's `maxHp` if lower, persists, redraws the crystal -- never a full
heal): Bohr's `transmuteInto(name)` looks the target up by name across `WORLD_CRYSTALS` via
`findMaterialByName` (never `WORLD_RIVALS` -- rivals aren't real compounds, and never a
hybrid -- `findMaterialByName` only searches `WORLD_CRYSTALS`, so it silently returns
`undefined` for a synthesized hybrid name); Majorana's `becomeHybrid(material)` is called
with an already-resolved `Material` object instead (either freshly built by
`combineMaterials` or pulled straight from the `hybridMaterials` save list), since there's
nothing to look up by name for a hybrid that was never in `WORLD_CRYSTALS` to begin with.
Anderson's `learnImpurityMove` is a third mentor that touches player state but deliberately
*doesn't* go through `applyPlayerForm` at all -- it only appends a move id to `unlockedMoves`,
leaving `playerForm` untouched, since the whole point of the impurity-doping mechanic is
borrowing one move without becoming (or fusing into) anything.

**Move availability is an intersection, not a flat list.** `unlockedMoves` (registry/save) is
a global "moves learned," unaffected by transmuting. What's actually offered in the battle
menu or Noether's shop is `getBattleMoves(registry)`/an inline `compatibleMoves(...)` filter --
learned ∩ `compatibleMoves(currentForm)`, where `compatibleMoves` derives from
`MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]>` (`data/materials.ts`). Phonon Beam
(`thermal`) is the one class every type allows, so it's always available regardless of form.
Every move maps to a real quasiparticle; there is no abstract "disorder" move or class.

## Stats and battle resolution

**Stats** (`data/types.ts`'s `Stats`, `data/materials.ts`): `quantumness`/`velocity`/
`correlation`, base `10` each (`BASE_STAT`/`DEFAULT_STATS`). Player stats live in registry/save
key `playerStats`, grown via `OverworldScene.renderShopStats` (Noether's "Stats" tab, cost
`statUpgradeCost(current)` per +1 point). Opponent stats are never stored per-material --
`enemyStatsForWorld(world)` computes them fresh at battle start (`BattleScene.create`), scaling
`+2` per stat per world past world 1.

`BattleScene.resolveHit` is the single damage-resolution function both sides' attacks go
through: crit chance from the attacker's Quantumness, turn order each round from comparing both
sides' Velocity, incoming damage divided by the defender's Correlation (`BASE_STAT /
correlation`), and a `2x` "quasiparticle mismatch" multiplier from `data/materials.ts`'s
`canHost(defenderType, move.class)` -- a defender whose own `MOVE_COMPATIBILITY` list doesn't
include the attacking move's class takes it at double force. This is the only type-interaction
term in the damage formula (DESIGN.md §3/§4) -- there is no separate type-chart multiplier.
`resolveHit` also takes a `bonusMultiplier` param (default `1`, a no-op) -- the only current
caller that passes anything else is `playerAttack` forwarding an analytic move's answer-gated
2x/0.5x through to the one `resolveHit` call for that specific move id; the opponent's
follow-up hit in the same exchange is never affected. The question itself is always answered
*before* `resolveHit` runs (`BattleScene.showAnalyticQuestion`, called from the move button's
own handler, not from inside `playerAttack`/`resolveHit`) -- keeping `resolveHit` synchronous
rather than teaching it to await something was a deliberate call, since it already inline-calls
`endBattle` and chains via `time.delayedCall`.

**Battle move menu.** `BattleScene.drawMoveMenu(moveIds)` builds a docked `Container` (field
`moveMenu`) on the right of the field from `getBattleMoves`, sized to the current move count.
It also computes `canHost()` per listed move against `this.wild.type` and appends a `!!2x`
tag (plus a power number) to each button when the quasiparticle-mismatch rule applies; row
height (`rowH`) is
computed from `rowCount` via `Phaser.Math.Clamp` rather than a fixed constant, since world 10's
'adaptive' type can host all 7 `MOVES` at once (see `MOVE_COMPATIBILITY`). Below `rowH < 40` the
row switches to a smaller font/padding (`compact`) rather than clipping. A move whose `class`
is `'analytic'` also gets a `★` tag and a legend line explaining the 2x/0.5x mechanic; its
button's `pointerdown` handler branches before `playerAttack` -- it opens
`BattleScene.showAnalyticQuestion` first (locking `turnLock` for the duration) and only calls
`playerAttack(moveId, bonusMultiplier)` once answered, rather than calling `playerAttack`
directly the way every other move button does.

**BattleScene reads the world's biome.** `drawBackground` calls `getBiome(this.world)` (the
same `art/biomes.ts` table `OverworldScene`'s corridor uses) -- sky/ridge/ground gradients, the
decorative crystal outcrops, and the ground tufts all derive from the biome's `skyTop`/
`skyBottom`/`hillColor`/`ground`/`path` fields via `shade()`. Any future per-biome visual field
added to `Biome` should flow through here too if it should affect the battle arena, not just
the overworld.

## Rival/boss fights

**Rival fights render the boss look in battle too.** `BattleScene.create` picks `art/boss.ts`'s
`makeBossCrystal` over the plain `makeCrystal` when `this.isRival`, sized `BOSS_CRYSTAL_SIZE`
and positioned at `BOSS_OPPONENT_POS` (both module constants) instead of the wild encounter's
`OPPONENT_POS` -- the instance field `this.opponentPos` tracks whichever was actually used, and
`resolveHit`'s attack-effect `from`/`to` read that field, not the `OPPONENT_POS` constant
directly, so bolts/rings/bursts still travel to the crystal's real (possibly shifted) position.

**The goal tile belongs to that world's boss, not a mentor.** `OverworldScene.spawnBossSprite`
spawns `art/boss.ts`'s `makeBossCrystal` (a fused multi-shard cluster + pulsing aura + orbiting
embers, `BOSS_CRYSTAL_SIZE = 70`) at `goalTile` for every built world's `getRival()` -- purely a
visual landmark via the same `WorldSprite` machinery, no click handler of its own.
`openGoalMentorPanel()`'s branch on `mentor?.tile === 'goal'` is a permanent no-op (no entry
uses it), so it always falls through to `showGatePanel()`, which is what renders at the goal.

**Progression (Face the Rival/Continue) is exclusive to the goal panel.** `renderShopFooter`
(Farewell + Face-the-Rival/Continue, `showGatePanel`'s only caller) and `renderFarewellFooter`
(Farewell only) are siblings -- every mid-corridor mentor panel (`showNoetherShop`'s two tabs,
`showBlochHub`, `showMentorLore`, `showBohrPanel`) calls `renderFarewellFooter`, never
`renderShopFooter`, so no mentor panel can trigger that world's boss fight without the player
walking to (or seeing) the goal. If a future mentor panel needs a progression action, route it
through `showGatePanel`, not by reaching for `renderShopFooter` directly.

## World progression

`HubScene.highestUnlockedWorld()` walks `rivalDefeated` from world 1 until it finds a world not
yet beaten. `OverworldScene.tryAdvanceToNextWorld()`/`advanceToWorld(this.world + 1)` likewise
compute the next world rather than hardcoding it. `BUILT_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9,
10]` is the single source of truth for "worlds with a walkable map," used by Bloch's
teleport destination filter (and, in Superposition Mode, the list every world gets
pre-marked visited against -- `OverworldScene.applySuperpositionLeveling`); extend it (plus
a biome entry in `art/biomes.ts`) together if a future world is ever added past 10.
`OverworldScene.recordVisit()`/`getVisitedWorlds()` track registry/save key `visitedWorlds`
(distinct from `rivalDefeated` -- you can visit a world without beating its rival), written
once per world the first time that world's scene is created.

`WORLD_NAMES` (and `WORLD_RIVALS`' own names) are meant to be readable as "which course topic
is this," not generic RPG terrain/monster names -- check both tables together when renaming a
world, since a mismatched rival name is easy to miss if only `WORLD_NAMES` is updated.

## Mentors

Every mentor has its own avatar builder in its own file: `art/mentor.ts`'s `makeNoetherAvatar`,
`art/bloch.ts`'s `makeBlochAvatar` (wireframe Bloch-sphere head, teal), `art/bohr.ts`'s
`makeBohrAvatar` (Bohr-model-atom head, amber), and one file per remaining mentor
(`art/laughlin.ts`, `art/majorana.ts`, `art/curie.ts`, `art/bell.ts`, `art/kondo.ts`,
`art/anderson.ts` -- disordered-lattice head motif, world 9, formerly `feynman.ts`/
`makeFeynmanAvatar` before the Feynman→Anderson rename). Every mentor spawns through one
unified `OverworldScene.spawnMentorSprite` (looked up from the `WORLD_MENTORS` table), not a
bespoke `spawnXSprite` per mentor, and all share one chime, `playMentorChime()` in
`audio/sfx.ts`.

**Renaming a mentor is a display-layer change, not a mechanic change.** `WORLD_MENTORS[N].id`
(a `metMentors`/save-list key, never displayed) can stay whatever it was, or change to match --
nothing special-cases a specific id string. What actually needs touching for a rename: the
avatar file + exported function name (by convention, `art/<name>.ts`'s `make<Name>Avatar`,
though this is a style convention, not something the code enforces), the `WORLD_MENTORS` entry's
`id`/`name`/`quote`/`avatar` fields, the corresponding `import` line in `OverworldScene.ts`, and
every doc that names the mentor by name (DESIGN.md §5, this file, DEVELOPMENT.md, README.md --
`grep -rn` the old name across the repo, not just `game/src/`, since course-content
cross-references in DESIGN.md's crystal database can share a physicist's name with a mentor
without being about the mentor at all -- e.g. "Dirac point"/"Dirac fermion" physics terminology
stays untouched by a Dirac→Laughlin mentor rename, and "Feynman diagram" terminology elsewhere
in the repo stays untouched by the later Feynman→Anderson rename).

**Majorana (world 5), Curie (world 6), and Anderson (world 9) all have real mechanics**,
following the same `open: (s) => s.showXPanel()` pattern as Noether/Bloch/Bohr:
- **Majorana's hybrid-material panel** (`OverworldScene.showMajoranaPanel`) lets the player fuse
  two `defeatedMaterials` into a new `Material` via `data/materials.ts`'s `combineMaterials(a,
  b)` (`maxHp: round(max(a.maxHp, b.maxHp) * 1.5)`, colors blended) and become it immediately
  via `applyPlayerForm` (see "Player form" above). **Not any two defeated crystals** -- only
  pairs whose main types are both different *and* listed together in `HYBRID_RULES`
  (`hybridResultType(typeA, typeB)` returns the result type, or `undefined` for an unrecognized
  or same-type pair). The panel filters both the first-pick list (only crystals with *some*
  valid partner among the other recently-defeated ones) and the second-pick list (only
  crystals that pair with whichever was picked first) through this before ever rendering a
  button, so an invalid combination is never one click away -- `createHybrid` doesn't
  re-validate, it trusts the panel already filtered. A two-step pick
  (`this.majoranaSelection: string | null`, the first choice, while the panel rebuilds for the
  second) rather than one screen of every valid pair -- reset in both `create()` and
  `closeDialogue()` so a stale first pick can't survive a cancel-and-reopen. Every hybrid ever
  created is appended to the `hybridMaterials` save list (deduped by name, since
  `combineMaterials` sorts its two parents' names before formatting so pick order doesn't
  produce two differently-named hybrids for the same pair) so the panel's own "become again"
  section can offer an earlier one without recombining -- deliberately sourced separately from
  `defeatedMaterials`, so a hybrid can never be fed back in as a combine ingredient (that would
  compound the 1.5x multiplier every time, on top of never being a recognized `HYBRID_RULES`
  type to begin with).
- **Curie's analytic-move shop** (`OverworldScene.showCuriePanel`/`renderCurieMoves`) mirrors
  `showNoetherShop`/`renderShopMoves` but sells only `data/materials.ts`'s `ANALYTIC_MOVE_IDS`
  (currently `skyfallBeam`/`groundEruption`), which `SHOP_MOVE_IDS` deliberately excludes so
  Noether never also offers them. See `BattleScene.showAnalyticQuestion` (Stats and battle
  resolution, above) for how a purchased analytic move actually plays out in a fight.
- **Anderson's impurity-doping panel** (`OverworldScene.showAndersonPanel`/
  `learnImpurityMove`) is a two-step pick like Majorana's, but the *result* is different: step
  one picks a host crystal (`defeatedMaterials`, or every crystal in Superposition Mode -- same
  pool source as Bohr/Majorana), step two looks the host up via `findMaterialByName` and lists
  whichever of its `.moves` the player hasn't already learned (`!unlockedMoves.includes(id)`);
  picking one just does `unlockedMoves.push(id)` + persist. No `applyPlayerForm` call at all --
  see "Player form" above. `this.andersonSelection: string | null` mirrors
  `majoranaSelection`'s reset rules (`create()`/`closeDialogue()`).

**Every mentor stands mid-corridor, not at the goal or start.** `MentorDef.tile` is `'goal' |
'start' | 'middle'`, but every current `WORLD_MENTORS` entry uses `'middle'` -- `world/mapgen
.ts`'s `generateWorldMap` computes a `mid: GridPoint` (roughly the corridor's halfway row)
alongside `start`/`goal`, threaded through `OverworldScene.midTile` and `SavedMapState` the same
way `goalTile`/`startTile` are. Reaching that row (`OverworldScene.maybeReachMiddle`, mirroring
`maybeReachGoal`'s "whole row counts, not one tile" rule) sets `reachedMiddle` and calls
`maybeAutoOpenMiddleDialogue()` -- the counterpart to `maybeAutoOpenGoalDialogue()`/
`maybeReachGoal`, both still used for the goal tile's own panel. `'start'`/`'goal'` remain valid
`tile` values (and `spawnMentorSprite`'s tile-lookup still branches on all three) purely so a
future mentor could choose them; nothing currently does.

## Overworld menus and settings

**Enter-key pause menu** (`OverworldScene.togglePauseMenu`/`showPauseMenu`/`showInfoPanel`):
follows the `dialogueContainer`/`dialogueActive`/`closeDialogue()` overlay convention, gated so
it can't open over another panel. Lives only in `OverworldScene`, not `BattleScene` or
`HubScene`. `showPauseMenu`'s rows are a data-driven array (label + onClick) rather than
hand-placed buttons -- a fixed six rows (Return to Lab, View Moves, View Stats, Advisors,
Tutorial, Settings, Close) now that the old debug-only "Warp" row is gone; keep the
data-driven-array shape for any future conditional row rather than reverting to fixed
positions. `showMovesPanel` lists `getBattleMoves(registry)` (learned ∩ currently
form-compatible, not the raw `unlockedMoves` list) as plain `<name> -- Pwr N` lines -- no
move-class label, no "incompatible" entries; a move the player has learned but can't currently
use just doesn't show up until they transmute into a form that supports it.

**Story Mode vs. Superposition Mode** (save/registry `superpositionMode`, picked on
`TitleScene`'s title screen via `addModeSelector` -- a two-button picker, not a toggle; Story
Mode is just `superpositionMode: false`, no separate field): Superposition Mode is a
testing/exploration aid, not part of normal progression. Three things key off
`isSuperpositionMode()`:
- `OverworldScene.applySuperpositionLeveling()` runs on every `create()` (covers Continue,
  Bloch teleport, and the Hub door's World-2 jump alike) -- re-levels `playerStats` to
  `enemyStatsForWorld(this.world)` plus a flat `+2`, grants every move (`Object.keys(MOVES)`),
  fully heals, and merges every `BUILT_WORLDS` entry into `visitedWorlds` so Bloch's teleport
  hub (gated on `visitedWorlds`, see "Mentors" above) offers every world immediately -- this is
  what makes Bloch alone sufficient for world-to-world movement in this mode; there is no
  separate warp panel anymore (removed along with `HubScene.showWorldSelectPanel`/
  `OverworldScene.showDebugWarpPanel`).
- `HubScene.enterWorld()`/`doorLabel()` branch on `isSuperpositionMode()` to jump straight to
  World 2 (`{ world: 2, regenerate: true }`) instead of `highestUnlockedWorld()`, bypassing
  `rivalDefeated` entirely -- reaching Bloch (who stands at World 2's own middle tile) is what
  then unlocks every other world via the point above.
- `showBohrPanel`/`showMajoranaPanel`/`showAndersonPanel` each swap their candidate pool from
  `getDefeatedMaterials()` to `data/materials.ts`'s `allCrystals()` when `isSuperpositionMode()`
  is true, per their own sections above.

**Contextual tutorial tips** (`data/tutorial.ts`'s `TUTORIAL_TIPS`/`TutorialTipId`/
`hasSeenTip`/`markTipSeen`): each tip fires once per save, right at the trigger site for its
own feature, not as one first-run sequence. `OverworldScene.showTutorialTip(id, onClose)` is
the shared entry point for six of the seven (`controls` on Overworld create, `encounter` in
`maybeTriggerEncounter`, `battle` in `startBattle`, `qumatoken` in `maybeCollectToken`,
`mentor` in `openMentor`, `goal` in `maybeAutoOpenGoalDialogue`) -- it checks `hasSeenTip`,
and either calls `onClose` straight away (already seen) or renders the tip via
`renderTutorialTipPopup` and calls `onClose` once the player dismisses it, so callers just
pass "whatever I was about to do next" and never branch on seen/unseen themselves. The
seventh (`lab`) fires from `HubScene.maybeShowLabTip` instead, reusing that scene's own
`showPanel` rather than `renderTutorialTipPopup`, since the Lab is the one tip that fires
before an Overworld scene has ever been created. Both trigger sites persist through the same
`markTipSeen` + `persistFromRegistry` pair.

**Full tutorial recap** (`data/tutorial.ts`'s `TUTORIAL_PAGES` -- `Object.values(TUTORIAL_TIPS)`,
same tips in a fixed order -- `OverworldScene.showTutorial`/`renderTutorialPage`): a paged
overlay using the same `dialogueContainer`/`addDialogueButtonAt` overlay convention as every
other panel, stroked cyan (`0x5ad9ff`, see `STYLE.md`). Only reachable from the Enter-menu's
"Tutorial" button now, not auto-triggered. `showTutorial(startIndex)` always resets
`tutorialIndex` and re-renders; Back/Next mutate `tutorialIndex` and call `renderTutorialPage()`
again rather than rebuilding the whole scene. To add/edit a tip, only `data/tutorial.ts` needs
touching -- both this and the contextual popups above read it generically.

**Materialdex is paginated.** `HubScene.renderMaterialdexPage` -- `MATERIALDEX_ENTRIES_PER_PAGE
= 2`, `materialdexPage` field reset to 0 on open, Back/Next re-render in place, same shape as
`OverworldScene`'s tutorial paging.

**Candidate-crystal lists share one pager: `OverworldScene.renderPagedButtons<T>`.** Used by
Bohr's transmute list, both steps of Majorana's and Anderson's combine/dope flows, and Bloch's
destination list -- anywhere Superposition Mode's "every crystal"/"every world" pool can
outgrow one panel. Takes the container/running-`y`/item array/current page/a `maxPerPage`
ceiling/label+onPick callbacks/an `onPageChange` callback (expected to rebuild the whole panel:
set the field, destroy `dialogueContainer`, re-call `showXPanel()` -- same pattern as every
other in-panel action) and returns the advanced `y`. **The actual per-page row count isn't
`maxPerPage` verbatim** -- it measures one sample button at the current `fontScale` (`ui/text
.ts`) and shrinks to whatever still fits above the panel's own trailing footer, because a fixed
row count overflowed the canvas once the *default* text-size preset (1.5x, not 1x) met a
9-destination Bloch list. Each caller owns its own page field (`bohrPage`, `majoranaPage`,
`andersonPage`, `blochPage`), all reset in both `create()` and `closeDialogue()` the same way
`majoranaSelection` is. Reuse this rather than a bespoke row-count/shrink-to-fit calculation for
any future candidate list that can grow unboundedly.

## Save schema

`data/save.ts`'s `SaveData`: `playerStats: Stats`, `visitedWorlds: number[]`,
`defeatedMaterials: DiscoveredMaterial[]` (written by `BattleScene.endBattle` on an ordinary
wild win, same "not for rivals" rule as `discoveredMaterials`), `playerForm: Material | null`,
`hybridMaterials: Material[]` (every hybrid Majorana's panel has ever created, for its "become
again" list -- note `playerForm` already round-trips a *whole* `Material` object through
`JSON.stringify`/`localStorage`, so the player's *current* hybrid form survives a reload for
free even without this list; this field only exists for the history), `tutorialTipsSeen:
string[]`, `superpositionMode: boolean` (Story Mode is just its `false` state -- see "Story
Mode vs. Superposition Mode" above), `encounterDensity: number` (one of
`data/settings.ts`'s `DENSITY_PRESETS`, set via the Enter-menu's Settings panel), plus the
earlier fields covered under Registry-then-persist above. `defaultSave()`/
`persistFromRegistry()` are the two places that need touching together for any future field, and
`loadSave()`'s `{ ...defaultSave(), ...saved }` spread keeps old localStorage saves compatible
for free.

**Starting over.** `data/save.ts`'s `clearSave()` just removes the localStorage key --
`TitleScene`'s "New Game (erase save)" link (behind `confirmNewGame`'s yes/no confirm) pairs it
with `this.scene.restart()` rather than hand-resetting the registry, so the same
`loadSave()`-into-registry block at the top of `create()` re-seeds every key from
`defaultSave()`. Any future direct registry reset (skipping a scene restart) would need to
re-seed every key itself -- prefer the restart approach.

## How to use this file

Before touching `game/src/`, read this file (and the relevant section of
`DESIGN.md`/`STYLE.md`) instead of re-exploring the tree. If you learn something mid-task that
would have saved a file read -- an exact function name, a pattern you had to reverse-engineer,
a gotcha in how two files interact -- add it here before you forget it, in the section it best
fits. Keep entries about *structure and pattern*, not a changelog of specific past edits (that's
what git history is for).
