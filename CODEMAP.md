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
    TitleScene.ts             Loads save -> registry, title showcase crystals, "Continue"/"New Game" -> Hub, Debug Mode toggle
    HubScene.ts                World 0, static room, 3 hotspots (Materialdex/Save/Door, door doubles
                                 as a debug world-select when Debug Mode is on)
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
    boss.ts                      makeBossCrystal() -- gigantic multi-shard boss avatar at a world's goal
    tokens.ts                   makeToken() -- qumatoken pickup sprite
    attackEffects.ts            playAttackEffect() -- bolt/ring/burst particle effect per MoveClass
    colors.ts                   shade() and other color helpers
  audio/
    sfx.ts                      Procedural sound effects (attack/impact/playMentorChime)
    music.ts                    MusicEngine, per-scene tracks, duck() for attack beats
  data/
    types.ts                    Move, Material, MoveClass, MaterialType, CrystalVariant, Stats
    materials.ts                 MOVES, TYPE_LOOK, WORLD_CRYSTALS, WORLD_RIVALS,
                                  PLAYER_MATERIAL, SHOP_MOVE_IDS, WORLD_NAMES, DEFAULT_STATS,
                                  getWildPool(), getRival(), compatibleMoves(),
                                  canHost(), getPlayerMaterial(), getPlayerStats(), getBattleMoves(),
                                  enemyStatsForWorld(), statUpgradeCost(), findMaterialByName()
    tokens.ts                    Qumatoken value tiers + weights
    quiz.ts                      Per-material physics question pools (>=6 each)
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
  a distinct blue-grey so it doesn't collide), gold `0xffe066` = Noether, teal `0x4adde0` =
  Bloch, amber `0xffa64a` = Bohr, red `0xff6666` = rival gate, purple `0x9a6ad9` = Hub's
  `showPanel` (Materialdex/Save), lavender `0xd9a5ff` = `OverworldScene.showStoryBeat`'s
  between-worlds panel. A new panel should pick a stroke color that doesn't collide
  with these.
- **Mentor avatars.** One builder per mentor in its own file: `art/mentor.ts`'s
  `makeNoetherAvatar()`, `art/bloch.ts`'s `makeBlochAvatar()`, `art/bohr.ts`'s
  `makeBohrAvatar()`. Never a shared parameterized builder -- each mentor needs to read as
  visually distinct.
- **Attack effects keyed by MoveClass**, not by move id -- adding/removing a move never touches
  `attackEffects.ts`, only adding/removing a whole `MoveClass` does (update `EFFECT_STYLE` in
  `art/attackEffects.ts` and `MOVE_COMPATIBILITY` in `data/materials.ts` together).
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
.playerMaterial`, `OverworldScene.playerMaterial`, `HubScene`'s crystal. Bohr's `OverworldScene
.transmuteInto(name)` is the only writer (`findMaterialByName` looks the target up across
`WORLD_CRYSTALS`, never `WORLD_RIVALS` -- rivals aren't real compounds).

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

**Battle move menu.** `BattleScene.drawMoveMenu(moveIds)` builds a docked `Container` (field
`moveMenu`) on the right of the field from `getBattleMoves`, sized to the current move count.
It also computes `canHost()` per listed move against `this.wild.type` and appends a `!!2x`
tag (plus a power number) to each button when the quasiparticle-mismatch rule applies; row
height (`rowH`) is
computed from `rowCount` via `Phaser.Math.Clamp` rather than a fixed constant, since world 10's
'adaptive' type can host all 7 `MOVES` at once (see `MOVE_COMPATIBILITY`). Below `rowH < 40` the
row switches to a smaller font/padding (`compact`) rather than clipping.

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
10]` is the single source of truth for "worlds with a walkable map," used by both Bloch's
teleport destination filter and Debug Mode's warp panels; extend it (plus a biome entry in
`art/biomes.ts`) together if a future world is ever added past 10.
`OverworldScene.recordVisit()`/`getVisitedWorlds()` track registry/save key `visitedWorlds`
(distinct from `rivalDefeated` -- you can visit a world without beating its rival), written
once per world the first time that world's scene is created.

`WORLD_NAMES` (and `WORLD_RIVALS`' own names) are meant to be readable as "which course topic
is this," not generic RPG terrain/monster names -- check both tables together when renaming a
world, since a mismatched rival name is easy to miss if only `WORLD_NAMES` is updated.

## Mentors

Every mentor has its own avatar builder in its own file: `art/mentor.ts`'s `makeNoetherAvatar`,
`art/bloch.ts`'s `makeBlochAvatar` (wireframe Bloch-sphere head, teal), `art/bohr.ts`'s
`makeBohrAvatar` (Bohr-model-atom head, amber), and one file per mentor from Dirac onward.
Every mentor spawns through one unified `OverworldScene.spawnMentorSprite` (looked up from the
`WORLD_MENTORS` table), not a bespoke `spawnXSprite` per mentor, and all share one chime,
`playMentorChime()` in `audio/sfx.ts`.

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
hand-placed buttons, specifically so the debug-only "Warp" row can be spliced in without
recomputing every other button's y position -- follow that pattern for any future conditional
row rather than reverting to fixed positions.

**Debug Mode** (save/registry `debugMode`, toggled on `TitleScene`'s title screen via
`addDebugToggle`): a testing/exploration aid, not part of normal progression.
`OverworldScene.applyDebugLeveling()` runs on every `create()` (covers Continue, Bloch teleport,
and an explicit debug warp alike) and re-levels `playerStats` to `enemyStatsForWorld(this.world)`
plus a flat `+2`, grants every move (`Object.keys(MOVES)`), and fully heals. World access while
debug mode is on bypasses `rivalDefeated` entirely via two separate warp panels that both jump
straight to any of the 10 worlds: `HubScene.showWorldSelectPanel` (replaces the door's normal
`enterWorld()` when `isDebugMode()`) and `OverworldScene.showDebugWarpPanel` (an extra
pause-menu row, for mid-run use without backtracking to the Hub). Both are stroked magenta
(`0xff4fd8`/`0xff5a7a` label tint) to read as clearly non-diegetic, distinct from every
mentor/dialogue panel color.

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

## Save schema

`data/save.ts`'s `SaveData`: `playerStats: Stats`, `visitedWorlds: number[]`,
`defeatedMaterials: DiscoveredMaterial[]` (written by `BattleScene.endBattle` on an ordinary
wild win, same "not for rivals" rule as `discoveredMaterials`), `playerForm: Material | null`,
`tutorialTipsSeen: string[]`, `debugMode: boolean`, `encounterDensity: number` (one of
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

Before touching `video_game/game/src/`, read this file (and the relevant section of
`DESIGN.md`/`STYLE.md`) instead of re-exploring the tree. If you learn something mid-task that
would have saved a file read -- an exact function name, a pattern you had to reverse-engineer,
a gotcha in how two files interact -- add it here before you forget it, in the section it best
fits. Keep entries about *structure and pattern*, not a changelog of specific past edits (that's
what git history is for).
