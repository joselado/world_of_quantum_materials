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
  config/
    screen.ts                 CANVAS_W/CANVAS_H (854x480, 16:9) -- single source of truth for
                                 the game's canvas size, read directly by main.ts's GameConfig
                                 and BattleScene.ts's FIELD_W/FIELD_H alias, re-exported from
                                 art/perspective.ts for every scene/panel that already imports
                                 its canvas size from there
  scenes/
    TitleScene.ts             Loads save -> registry, title showcase crystals, "Continue"/"New Game" -> Hub,
                                 Story Mode / Superposition Mode picker
    HubScene.ts                World 0, static room, up to 9 stations: 3 that always exist
                                 (Qumatex/Save/Door -- door label/click resume-in-place to
                                 highestUnlockedWorld() via canResumeWorld(), tracks
                                 rivalDefeated progress in Story Mode, pinned to "Enter World 1"
                                 in Superposition Mode; the Enter *key* instead resumes
                                 resumeWorld() -- the exact world/position mapState holds,
                                 not necessarily highestUnlockedWorld())
                                 plus up to 6 reference/settings stations (Moves/Stats/Abilities/
                                 Guardians/Tutorial/Settings, panels/hubStations.ts's
                                 LAB_STATIONS -- Abilities/Guardians filtered out until a first
                                 passive/guardian is unlocked/met). No crystal render anywhere in
                                 the room except the player's own (addStationRow builds every
                                 station as a plain text button with an optional small
                                 art/labMotifs.ts icon beside it)
    OverworldScene.ts          Per-world walkable map: movement, encounters, rival gate, shared
                                 dialogue/panel infrastructure (addDialogueButton(At),
                                 renderPagedButtons, renderFarewellFooter) every panels/ file uses.
                                 H and Enter both warp straight to the Hub (scene.start('Hub')) --
                                 no in-world menu
    panels/                    One file per guardian's panel UI (see "Guardian panels" below),
                                 e.g. noether.ts's showNoetherShop(), sklodowskaCurie.ts's
                                 showSklodowskaCuriePanel(), anderson.ts's showAndersonPanel() --
                                 passiveList.ts's renderPassiveList() is franklin.ts's own
                                 buy-list-plus-switch helper, kept in its own file rather than
                                 folded into franklin.ts directly (see "Guardian panels" below),
                                 tunableMoveShop.ts's renderTunableMoveShop()/
                                 showMoveClassPicker() is the one shared by laughlin.ts's Analytic
                                 shop (Skłodowska-Curie's Ultimate shop is priced too differently
                                 to reuse it, see "Guardians" below), and hubStations.ts holds the
                                 Lab's own six reference/settings stations (see "Lab stations and
                                 settings" below) -- taking scene: HubScene instead of
                                 scene: GuardianPanelHost, since HubScene is their only caller
    BattleScene.ts             Turn-based battle: move buttons, HP bars, attack effects, log
  world/
    mapgen.ts                  generateWorldMap(gridW, gridH, start, world, playerType?) -- dispatches
                                  to generators/world<N>.ts by world number (world 10 additionally by
                                  playerType, see generators/world10.ts), then runs two passes common
                                  to all ten: forceChokepoint (walls off the guardian's row except a
                                  small gap, so the returned `mid` is a true articulation point --
                                  invariant B) and deriveRows/scatterTokens (encounter-row sampling +
                                  qumatessence placement, computed from the final walkable grid rather
                                  than something each generator handles itself). Retries a failing
                                  generator (reachability or chokepoint check fails) with fresh
                                  randomness up to 10 times before falling back to generators/fallback.ts's
                                  plain corridor, console.error-ing rather than throwing -- generation
                                  is randomized and runs on every world entry, so a bad roll shouldn't
                                  crash the scene
    generators/
      shared.ts                 GridPoint/WorldMap-adjacent types (GeneratedMap, NullableNumberGrid),
                                  grid helpers (makeGrid/makeColorGrid/shuffled/clamp/inBounds), the
                                  wandering-band painter every corridor-like generator builds on
                                  (wanderBands/paintBand/paintBands, parameterized on width so a 7-wide
                                  main corridor and a 2-wide lane share one implementation),
                                  paintSplitMerge (world1.ts's/world8.ts's split-then-remerge stretch,
                                  optionally regionColor-tinted), paintColumnBand (paintBand's vertical
                                  mirror, world4.ts's horizontal branches), carveThickPath/nearestWalkable
                                  (splicing a fixed point into a network-shaped layout that doesn't
                                  already touch it, world3.ts/world5.ts), and the invariant-B primitives
                                  (forceChokepoint/reachable/verifyChokepoint) mapgen.ts runs centrally
      fallback.ts                generateFallbackMap() -- the plain wide wandering corridor with no
                                  per-world motif of its own; mapgen.ts's retry-exhausted fallback, also
                                  the base shape world6.ts/world9.ts build their own motif on top of
      world1.ts .. world10.ts    One file per world's own generator (GeneratedMap: walkable/start/goal/
                                  mid/regionColor/biomeOverride), each implementing that world's own
                                  course-topic motif -- see DESIGN.md §2's per-world table for what each
                                  one is. world10.ts dispatches to whichever of world1-8's own generator
                                  matches the player's current Material.type (data/materials.ts's
                                  getPlayerMaterial), re-triggered live by OverworldScene.applyPlayerForm
                                  whenever the player transmutes/fuses while standing in World 10
  art/
    perspective.ts             Pseudo-3D projection (grid coord -> screen point); re-exports
                                  CANVAS_W/CANVAS_H from config/screen.ts since every
                                  scene/panel that needs the canvas size already imports it
                                  from here
    biomes.ts                  Per-world visual skin (sky, walls, path, decoration, fog, wallTheme)
    crystals.ts                 makeCrystal() -- shared shard/cluster/prism sprite builder, opts.seed
                                  for per-compound jitter (jitterFor) and opts.hybrid for a fused
                                  hybrid look (drawHybridCrystal)
    noether.ts                    makeNoetherAvatar()
    bloch.ts                    makeBlochAvatar()
    dresselhaus.ts               makeDresselhausAvatar()
    laughlin.ts                  makeLaughlinAvatar()
    majorana.ts                  makeMajoranaAvatar()
    anderson.ts                   makeAndersonAvatar() -- disordered-lattice head motif, world 6
    feynman.ts                   makeFeynmanAvatar() -- vertex/propagator diagram-construct motif, world 7
    kondo.ts                     makeKondoAvatar()
    franklin.ts                   makeFranklinAvatar() -- diffraction/lattice-defect motif, world 9
    sklodowskaCurie.ts            makeSklodowskaCurieAvatar(), world 10
    boss.ts                      makeBossCrystal() -- gigantic multi-shard golem boss avatar at a world's goal
    tokens.ts                   makeToken() -- qumatessence pickup sprite
    labMotifs.ts                 One small icon builder per Lab station (Save Point/
                                  Moves/Stats/Abilities/Guardians/Tutorial/Settings -- see "Lab
                                  stations and settings" below), planted beside that station's
                                  own button in the room (HubScene.addStationRow), fixed-px art
                                  like every other builder in this directory, never run through
                                  ui/text.ts's fontPx()/fontScale()
    attackEffects.ts            playAttackEffect() -- bolt/ring/burst/beam/eruption/meteor/nova
                                  particle effect; beam/eruption are ANALYTIC_SHAPES' per-move-id
                                  overrides (Laughlin's skyfallBeam/groundEruption), meteor/nova are
                                  ULTIMATE_SHAPES' overrides (Skłodowska-Curie's ultimateMeteor/
                                  ultimateNova, a 4-6s multi-phase sequence -- see "Stats and battle
                                  resolution" below), every other shape is per-MoveClass
    colors.ts                   shade(), hueShift(), hashSeed()/seededRandom() -- the deterministic
                                  per-compound PRNG jitterFor() (crystals.ts) is built from
  audio/
    sfx.ts                      Procedural sound effects (attack/impact/playGuardianChime)
    music.ts                    MusicEngine, per-scene/per-world tracks in two selectable
                                  styles (SCORES/"Classic", SCORES_MODERN/"Modern", all keyed
                                  `overworld:${world}`/`battle:${world}`), setStyle(MusicStyle)
                                  picks the table + restarts the current track,
                                  makeBattleScore()/makeModernBattleScore() generate worlds
                                  2-10's (resp. all 10 modern) battle themes (classic world 1 is
                                  hand-written), duck() for attack beats
  data/
    types.ts                    Move, Material, MoveClass, MaterialType, CrystalVariant, Stats
    balance.ts                   Every pure battle/economy formula, deliberately free of any
                                  Phaser import (unlike materials.ts, which pulls in Phaser via
                                  art/colors.ts at module scope) so game/scripts/balance-sim.mjs
                                  can transpile and import it directly at runtime: BASE_STAT,
                                  DEFAULT_STATS, enemyStatsForWorld(), statUpgradeCost(),
                                  shopCost(), MOVE_LEVEL_MULTIPLIERS, MOVE_LEVEL_STREAKS,
                                  feynmanLevelCost(), battleStakeForWorld(),
                                  FRACTIONAL_GUARD_DAMAGE_MULT/ANYON_ECHO_FRACTION/
                                  EDGE_CURRENT_MISMATCH_MULT (Franklin's passives, §5),
                                  MISMATCH_MULTIPLIER, mitigationFraction() (Kondo's buff-cap
                                  math, §4/§5), critChance(), and resolveHitDamage() -- the exact
                                  crit-chance/defense-factor/mismatch/final-product math
                                  BattleScene.resolveHit calls into rather than computing inline,
                                  so the battle scene and the balance simulator can never
                                  disagree on what a hit deals. materials.ts imports the
                                  stat/economy exports from here and re-exports them, so every
                                  existing `import { shopCost, ... } from '../data/materials'`
                                  call site is unaffected.
    materials.ts                 MOVES, TYPE_LOOK, materialTypeLabel() -- MaterialType's
                                  player-facing name (e.g. 'classicalMagnet' -> "Classical
                                  Magnet"), read by Qumatex's type filter and by
                                  gen-docs.mjs so a raw camelCase identifier is never shown
                                  to a player, WORLD_CRYSTALS, WORLD_RIVALS,
                                  PLAYER_MATERIAL, SHOP_MOVE_IDS, ANALYTIC_MOVE_IDS,
                                  ULTIMATE_MOVE_IDS, ULTIMATE_CLASS_UNLOCK_COST,
                                  TUNABLE_MOVE_CLASSES, RIVAL_9_TYPES, WORLD_NAMES,
                                  getWildPool(), getRival(world, rival9Type?),
                                  compatibleMoves(),
                                  canHost(), getPlayerMaterial(), getPlayerStats(), getBattleMoves(),
                                  findMaterialByName(),
                                  rollRival9Type() -- rolls World 9's rival's random MaterialType,
                                  fed into getRival() (see "Rival/boss fights" below),
                                  getTunedMoveClass()/tunedMoveDisplayName() -- read a tunable move's
                                  tuned quasiparticle (falling back to its default 'phonon' class),
                                  shared by Laughlin's Analytic moves and Skłodowska-Curie's Ultimate
                                  moves alike since both read/write the same registry/save
                                  moveClassTuning map,
                                  MOVE_LEVEL_NAMES/MOVE_LEVEL_MULTIPLIERS/MOVE_LEVEL_STREAKS/
                                  getMoveLevel()/effectiveMovePower()/feynmanLevelCost()/
                                  moveDisplayName() -- Feynman's move-leveling (§5, World 7): a
                                  move's level (registry/save moveLevels), its power scaled by that
                                  level's multiplier, the qumatessence cost to attempt the next
                                  tier, and the composed display name (level prefix plus
                                  tunedMoveDisplayName, or a 'screening' move's own static name)
                                  every rendering site reads,
                                  allCrystals() -- every WORLD_CRYSTALS entry deduped by name, feeds
                                  Dresselhaus/Majorana/Anderson's Superposition Mode candidate pools,
                                  hybridRecipeResult()/HYBRID_RECIPES -- Majorana's named parent-pair
                                  recipe catalog, combineMaterials() -- Majorana's hybrid-material fuser
    passives.ts                   PASSIVES/FRANKLIN_PASSIVE_IDS/PASSIVE_OWNERS/
                                  PASSIVE_OWNER_LABELS -- Franklin's whole-battle passive
                                  abilities (id/name/owner/description/cost)
    tokens.ts                    Qumatessence value tiers + weights
    quiz.ts                      Per-world physics question pools (WORLD_QUESTIONS[1-9]) as the
                                  primary wild-encounter quiz source; a few materials additionally
                                  carry a supplementary pool in MATERIAL_QUESTIONS (multi-world
                                  materials with topic-uniform content, plus every WORLD_CRYSTALS[10]
                                  hybrid result), which getWorldQuestion(world, materialName)
                                  coin-flips against the world's own pool whenever the fought
                                  material has one. World 10 draws differently: getWorldQuestion(10,
                                  materialName) coin-flips between the fought hybrid's own
                                  MATERIAL_QUESTIONS pool and ML_LECTURE_QUESTIONS (session10.tex,
                                  the course's ML finale) -- plus the world-tagged ANALYTIC_QUESTIONS pool
                                  (AnalyticQuestion carries worlds: number[]) via
                                  getAnalyticQuestion(visitedWorlds) for Laughlin's two quiz-gated
                                  Analytic moves -- draws only questions tagged with a visited
                                  world's topic (falling back to the full pool if that intersection
                                  is ever empty) -- and getAnalyticQuestions(visitedWorlds, count) for
                                  Feynman's move-leveling streak (§5, World 7), the same pool drawn
                                  `count` times in a row with no immediate repeat -- and the broad,
                                  any-topic ULTIMATE_QUESTIONS pool via getUltimateQuestions(n) for
                                  Skłodowska-Curie's two Ultimate moves -- no visited-world
                                  filtering, since the finale is meant to test everything the course
                                  covered, not one world's own topic
    greetings.ts                 Per-MaterialType flavor lines (encounter/victory/defeat)
    materialdex.ts               Per-material (fallback per-type) physics blurb for Qumatex
    save.ts                      localStorage schema + persistFromRegistry()/load()
    tutorial.ts                    TUTORIAL_TIPS/TUTORIAL_PAGES -- contextual + replayable tutorial copy
    settings.ts                    DENSITY_PRESETS/DEFAULT_ENCOUNTER_DENSITY -- wild-encounter density presets,
                                    FONT_SCALE_PRESETS, MUSIC_STYLE_PRESETS/DEFAULT_MUSIC_STYLE
    story.ts                       STORY_BEATS -- per-world Decoherence-arc line shown on advancing worlds --
                                    and WORLD_GOAL_TEXT -- per-world one-liner for the goal-tile banner,
                                    falling back to a generic line for a world with no entry
    worldLore.ts                   WORLD_LORE (per-world 2-page history, shown once per save on first entry)/
                                    RIVAL_TAUNTS (per-world 2-part rival gate taunt) -- worldLoreSeen gating via
                                    hasSeenWorldLore/markWorldLoreSeen
  ui/
    text.ts                       fontPx()/fontScale() -- see "Lab stations and settings" below
    theme.ts                      PANEL_BG/GOLD_ACCENT(_HEX)/REFERENCE_BLUE_GREY(_HEX)/
                                   TUTORIAL_CYAN(_HEX)/STORY_LAVENDER -- colors reused for a shared
                                   UI role (a panel background, an "active" accent, etc.) across
                                   multiple scene/panel files. A guardian's own identity color
                                   (their `art/<guardian>.ts` avatar plus their own
                                   `scenes/panels/<guardian>.ts` panel) stays a literal in those two
                                   files instead, since it never appears outside that pair.
```

`game/scripts/gen-docs.mjs` (run via `npm run docs`) is outside `src/` -- it reads
`materials.ts`/`passives.ts` with the TypeScript compiler API (not a normal import,
since `materials.ts` pulls in Phaser at module scope) and regenerates the
`<!-- GENERATED -->` table blocks in the top-level `docs/*.md` files.

`game/scripts/balance-sim.mjs` (run via `npm run balance-sim`, see
DEVELOPMENT.md's "Balance simulator") is also outside `src/` -- it reads the
same static tables the same AST way, but transpiles and actually imports
`data/balance.ts` (Phaser-free, unlike `materials.ts`) to run the real damage/
economy formulas against three reference player builds across worlds 1-10, a
difficulty-curve sanity check rather than a docs generator.

## Data model (`data/types.ts`, `data/materials.ts`)

- A **Material** is a crystal: `name`, `type` (`MaterialType`), `color`, `variant`
  (shard/cluster/prism/layer/twisted), `moves` (string ids into `MOVES`), an optional
  `shortName` (a short chemical-formula/acronym form, e.g. "MnO", "YIG" -- only set where one's
  genuinely worth authoring; `materials.ts`'s `materialDisplayName()` is the one consumer today,
  Qumatex's "Name (ShortName)" line), and an optional `hybridParents` (both parents' own
  `color`/`variant`, set only by `combineMaterials` -- see below and STYLE.md's "Crystal
  sprites" section). No `maxHp` field -- HP is never intrinsic to a crystal, see "Max HP" below.
- `crystal(name, type, moves, shadeStep?, variantOverride?, shortName?)` is the
  `WORLD_CRYSTALS`/`WORLD_RIVALS` row builder -- adding a `shortName` to an existing call while
  leaving `shadeStep`/`variantOverride` at their defaults means passing `undefined` for those
  positionally rather than omitting them (matches the existing pattern for `shadeStep` alone).
- The player is not a separate class -- `PLAYER_MATERIAL` is just one `Material` row (currently
  Silicon, `type: 'semiconductor'`). Its starting `moves` is the tutorial loadout; moves actually
  available in battle also depend on the registry's `unlockedMoves` (grows via Noether's shop).
- `WORLD_CRYSTALS: Record<world, Material[]>` -- wild-encounter pool per world, pulled via
  `getWildPool(world)`. `WORLD_RIVALS: Partial<Record<world, Material>>` -- the one gating
  fight per world, pulled via `getRival(world, rival9Type?)`; it has a fixed entry for every
  world except 9, whose rival is built on the fly instead (see "Rival/boss fights" below) --
  `getRival` still returns a `Material` for all ten worlds either way.
- `MOVES: Record<id, Move>` -- every move is named after the quasiparticle that carries it
  (Phonon Beam, not "Thermal Attack"). `class: MoveClass` drives the attack-effect
  shape/color (`art/attackEffects.ts`'s `EFFECT_STYLE`) and `MOVE_COMPATIBILITY`; `power`
  climbs with how unconventional that quasiparticle is (DESIGN.md §3), not per-move balance
  tuning in isolation.
- `canHost(defenderType, moveClass)` -- does the defender's own `MOVE_COMPATIBILITY` list
  include this class at all; the sole type-interaction check battle damage uses (DESIGN.md
  §4's "quasiparticle mismatch" 2x). There is deliberately no separate strong/weak
  `TYPE_CHART` + `effectiveness()` stacked on top of this -- don't add one (it would be an
  unplaytested second system) without updating DESIGN.md §3/§4 and STYLE.md's
  battle-log/move-menu sections together.
- **`MOVE_COMPATIBILITY` gates both offense *and* defense at once -- a gotcha worth
  remembering before adding a new `MoveClass`.** The same table backs `compatibleMoves`
  (what the attacker can use) and `canHost` (whether the defender takes the mismatch 2x), so
  leaving a new *attack* class off every type's list doesn't make it "unavailable," it makes
  every defender mismatch against it -- a silent, permanent 2x stacked on top of whatever
  bonus the move's own mechanic already applies. `'screening'` (Kondo's three self-buff
  moves) is the one class this doesn't apply to at all: it's deliberately left off *every*
  type's list, since a self-buff never attacks in the first place -- `BattleScene.resolveHit`
  routes it to `resolveSelfBuff` before `canHost` is ever checked, so it's simply never
  gated, not "always compatible" the way Phonon Beam's universal-but-still-checked class is.
  `getBattleMoves` (`data/materials.ts`) mirrors this: a `KONDO_MOVE_IDS` entry is surfaced
  purely by whether it's the active `kondoActiveMove`, never intersected with
  `compatibleMoves`. Laughlin's two Analytic
  moves (`skyfallBeam`, `groundEruption`) and Skłodowska-Curie's two Ultimate moves
  (`ultimateMeteor`, `ultimateNova`) reach the same "usable from any form, never mismatches"
  result without needing a class of their own -- their static `class` defaults to `'phonon'`,
  the same universal class every crystal's own lattice already grants Phonon Beam, and stays
  there until the player tunes it via the relevant guardian's picker (`getTunedMoveClass`, see
  "Guardians" below). Decide any new class's `MOVE_COMPATIBILITY` membership on purpose, not by omission.
- Per-type look lives in `TYPE_LOOK` (base color + variant, exported); individual compounds
  of the same type get `shade(color, shadeStep * 18)` so siblings (Iron vs. Cobalt) read as a
  family, *and* (rendering-side, not stored on the `Material` itself) `art/crystals.ts`'s
  `jitterFor(material.name, ...)` gives each one its own hue/rotation/stretch/sparkle
  variation so same-type siblings don't render as one recolored shape reused across every
  compound of that type -- see STYLE.md. `TitleScene`'s showcase cluster is the one consumer
  outside `data/materials.ts` itself so far (and the one place that skips per-compound jitter,
  since it only has a `MaterialType` to draw from, not a specific compound name). A compound
  whose actual dimensionality/stacking doesn't match its type's usual gem look overrides it via
  `crystal()`'s `variantOverride` param (Graphene/Monolayer WTe₂/Chromium Triiodide → `'layer'`,
  Twisted Bilayer MoTe₂ → `'twisted'`; see STYLE.md).
- `combineMaterials(a, b)` (Majorana's hybrid fuser, §5) looks up `hybridRecipeResult(a.name,
  b.name)` -- a curated, named parent-pair catalog (`HYBRID_RECIPES`), not a type-derived
  result -- and spreads that recipe's own authored `Material` (name/type/color/moves all
  fixed on its `WORLD_CRYSTALS` entry, not computed here), adding only `hybridParents` (both
  inputs' own `color`/`variant`, sorted the same way the lookup itself is order-independent) so
  `makeCrystal()`'s `opts.hybrid` can render an actual fused mixture on top of the recipe's own
  base look (see STYLE.md). Optional field, so a save whose `playerForm` predates
  `hybridParents` just renders the ordinary single-shape look instead of throwing.

## Cross-cutting patterns (reuse these, don't reinvent)

- **Registry-then-persist.** The Phaser registry (`this.registry`/`game.registry`) is the
  runtime source of truth every scene reads/writes; `data/save.ts`'s `persistFromRegistry()` is
  called after *every* mutation that should survive a reload (token pickup, move purchase, stat
  upgrade, rival defeat, battle outcome, transmutation) rather than only at fixed checkpoints.
  `TitleScene` is the only place that loads localStorage *into* the registry. Any new persistent
  state should follow this same registry-first, persist-on-mutation shape and get added to
  `data/save.ts`'s `SaveData`/`defaultSave()`/`persistFromRegistry()` together.
- **World sprites.** Wild-encounter crystals, qumatessence pickups, every guardian's overworld
  avatar (Noether, Bloch, Dresselhaus, and every other guardian alike), the goal-tile boss, and
  the two world-door landmarks all share one `WorldSprite` projection/wander/bob system in
  `OverworldScene` (`updateWorldSprites`) rather than bespoke per-kind code -- a new NPC or
  landmark should spawn through the single unified `OverworldScene.spawnGuardianSprite` (looked
  up from `WORLD_GUARDIANS`) pattern, not a bespoke `spawnXSprite` per guardian.
- **Panel/dialogue UI.** Every overlay (wild encounter, guardian panels, rival gate, Hub's
  Qumatex/Save panels, the Lab's own six stations) is the same dark rounded-rectangle-with-stroke
  treatment, with the stroke color signaling the panel's kind: blue-grey `0x444466` = wild
  encounter (`OverworldScene.showEncounter`) and the Lab's Moves/Stats/Abilities/Settings
  stations (`0x8fa0c9`, a distinct blue-grey so it doesn't collide), gold `0xffe066` = Noether, teal `0x4adde0` =
  Bloch, teal-green `0x4ad9a0` = Dresselhaus's transmutation panel, blue-violet `0x6a7fff` =
  Laughlin's Analytic shop (`panels/tunableMoveShop.ts`'s `renderTunableMoveShop`, shared
  chrome), green `0x4fd97a` = Majorana's hybrid panel, rust `0xc9884a` = Anderson's
  impurity-doping panel, amber `0xffa64a` = Feynman's move-leveling panel (and its own
  question-streak sub-panel), red `0xe86a44` = Kondo's
  self-buff shop, purple `0xa878c9` = Franklin's passive panel, olive `0xc9d84a` =
  Skłodowska-Curie's Ultimate shop, red `0xff6666` = rival gate (`showRivalEncounter`'s
  two-part taunt), purple `0x9a6ad9` = Hub's
  `showPanel` (Qumatex/Save), lavender `0xd9a5ff` = `OverworldScene.showStoryBeat`'s
  between-worlds panel and `showWorldLore`'s once-per-save world-entry lore screen, and
  (in `BattleScene`, the one place dialogue-style overlays live outside
  `OverworldScene`) gold `0xffe066` again for `showAnalyticQuestion`'s in-battle question panel
  (matching the move menu's own border) and magenta `0xff66ff` for `showUltimateQuestions`'s.
  A new panel should pick a stroke color that doesn't collide with these.
- **Guardian panels live in `scenes/panels/<guardian>.ts`, one file per guardian, not as
  methods on `OverworldScene`.** Each exports a `show<Guardian>Panel(scene: GuardianPanelHost)`
  (or, for Bloch, `showBlochHub`) that the `WORLD_GUARDIANS` table's
  `open` field calls directly (`open: (s) => showDresselhausPanel(s)`), replacing the older
  `open: (s) => s.showXPanel()` shape from when every panel body lived on the class itself.
  `GuardianPanelHost` (`OverworldScene.ts`) is the interface every panel file is actually
  written against, not the concrete `OverworldScene` class -- both `OverworldScene` (a
  guardian met mid-walk) and `HubScene` (the same guardian reopened from the Lab's Guardians
  station, `scenes/panels/hubStations.ts`'s `showGuardiansPanel`) implement it, so a guardian's
  panel renders identically -- same shop, same state, no scene transition -- regardless of
  which of the two scenes the player actually opened it from. A panel-specific helper only that
  one guardian calls (e.g. Noether's `renderShopTabs`) moves
  into the same file as a plain (non-exported) function taking `scene` as its first param; a
  helper more than one guardian calls gets its own file under `scenes/panels/` instead rather
  than living in either guardian's file -- `passiveList.ts`'s `renderPassiveList` (Franklin's
  own passive-kit shop today, written generically enough for a future second passive-owning
  guardian to reuse without a rewrite) is the current example. `tunableMoveShop.ts`'s `renderTunableMoveShop`/
  `showMoveClassPicker` currently has only one caller (Laughlin's Analytic shop) -- it still
  lives in its own file rather than `laughlin.ts` since it's written generically (any move-id
  list, any `shopCost`-flow purchase), the same shape a future flat-purchase tunable-move
  guardian could reuse; Skłodowska-Curie's Ultimate shop deliberately does *not* reuse it (see
  "Guardians" below), since her per-class-unlock pricing is fundamentally different from a flat
  purchase. Genuinely cross-cutting dialogue infrastructure -- `addDialogueButton(At)`,
  `renderPagedButtons`, `renderFarewellFooter`, `closeDialogue`, state accessors like
  `getUnlockedMoves`/`getDefeatedMaterials`/`getVisitedWorlds`/`isSuperpositionMode`, `world`/
  `advanceToWorld` (Bloch's own travel action), every guardian's per-panel pagination/selection
  field (`shopTab`, `blochPage`, `dresselhausPage`, `majoranaPage`/`majoranaSelection`,
  `andersonPage`/`andersonSelection`/`andersonMovePage`, `feynmanPage`), and the player-form
  mutator `applyPlayerForm` (shared by Dresselhaus's `transmuteInto` and Majorana's
  `becomeHybrid`, both of which moved into their own panel file as plain functions) -- is each
  member of `GuardianPanelHost`, implemented as public (not `private`) methods/fields on both
  `OverworldScene` and `HubScene` independently (not a shared base class), since panel modules
  living outside either class can't reach a `private` member and Phaser scenes don't share a
  common non-`Phaser.Scene` ancestor to hang shared state on. `HubScene`'s own copies of this
  infrastructure (`world = 0`, never a real built world so Bloch's own "exclude the world I'm
  in" filter excludes nothing; `qumatessence`/`playerMaterial` mirrored from the registry the
  same way `OverworldScene.create()` does; `advanceToWorld` a genuine `scene.start('Overworld',
  { world, regenerate: true, ... })`, since a guardian panel's own explicit travel action, e.g.
  Bloch's destination rows, is still real travel) live next to `HubScene`'s existing duplicated
  dialogue primitives (`addDialogueButtonAt`, `closeDialogue`, `addButton`). This
  public-instead-of-private, duplicated-instead-of-shared tradeoff is deliberate: it's the cost
  of splitting a god-object scene into per-guardian files, and of letting the Lab host the same
  panels as the overworld, without a much larger shared-base-class redesign, not an invitation to
  reach into either scene's internals from unrelated code. A new panel-only helper should default
  to `private` and only widen to public (and join `GuardianPanelHost`, implemented on both
  classes) if a panel file genuinely needs to call it from outside the class.
- **Guardian avatars.** One builder per guardian in its own file: `art/noether.ts`'s
  `makeNoetherAvatar()`, `art/bloch.ts`'s `makeBlochAvatar()`, `art/dresselhaus.ts`'s
  `makeDresselhausAvatar()`. Never a shared parameterized builder -- each guardian needs to read as
  visually distinct. Distinct from the guardian *panel* files above (`scenes/panels/`, the
  shop/dialogue UI) -- the avatar builder only draws the little floating figure, used both by
  the panel (for its header portrait) and by `OverworldScene.spawnGuardianSprite` (the
  wandering overworld landmark).
- **Attack effects keyed by MoveClass**, not by move id -- adding/removing a move never touches
  `attackEffects.ts`, only adding/removing a whole `MoveClass` does (update `EFFECT_STYLE` in
  `art/attackEffects.ts` and `MOVE_COMPATIBILITY` in `data/materials.ts` together). Two
  deliberate exceptions, both `Record<moveId, AttackShape>` lookups consulted in the same order
  (`ANALYTIC_SHAPES[move.id] ?? ULTIMATE_SHAPES[move.id]`) before falling back to
  `EFFECT_STYLE`'s per-class shape: `ANALYTIC_SHAPES` overrides the shape for Laughlin's two
  moves (`skyfallBeam`, `groundEruption`), and `ULTIMATE_SHAPES` overrides it for
  Skłodowska-Curie's two (`ultimateMeteor`, `ultimateNova`) -- both since these moves want their
  own silhouette regardless of whichever ordinary quasiparticle class each is currently tuned
  to. `BattleScene.resolveHit` passes the resolved override as `playAttackEffect`'s
  `shapeOverride` param. A future class wanting the same per-move variety should reuse this
  pattern rather than inventing a second override mechanism.
- **Discovery vs. defeat tracking.** Two separate registry/save lists, both excluding rivals
  (gate encounters, not collectible materials): `discoveredMaterials` (`OverworldScene.recordDiscovery`, written on
  first wild *encounter*, feeds the Hub's Qumatex) and `defeatedMaterials`
  (`BattleScene.endBattle`, written on an ordinary wild *win*, feeds Dresselhaus's transmutation
  panel). Don't conflate them -- a material can be encountered without being defeated.

## Player form and moves

**Player form.** `PLAYER_MATERIAL` (Silicon) is only the *default* -- the player's actual
current crystal is `getPlayerMaterial(registry)` (`data/materials.ts`), which reads
registry/save key `playerForm` (a full `Material` or `null`). Every scene that draws/sizes/
types the player goes through this rather than `PLAYER_MATERIAL` directly: `BattleScene
.playerMaterial`, `OverworldScene.playerMaterial`, `HubScene`'s crystal. Two guardians write it,
both through the shared `OverworldScene.applyPlayerForm(material)` (sets `playerForm`, clamps
HP down to the current world's own cap if above it (`wildHpForWorld`, `data/balance.ts` --
HP is never intrinsic to the new form itself, see "Max HP" below), persists, redraws the
crystal -- never a full heal): Dresselhaus's `transmuteInto(name)` looks the target up by name across `WORLD_CRYSTALS` via
`findMaterialByName` (never `WORLD_RIVALS` -- rivals are gate encounters, not a form to
transmute into). Majorana's
`becomeHybrid(material)` is called with an already-resolved `Material` object rather than a
name -- freshly built each time by `combineMaterials`, which additionally attaches
`hybridParents` for the fused-visual render; there's no memory of earlier fusions to pull a
past one back from, every visit to Majorana rebuilds the pair from scratch.
Anderson's `learnImpurityMove` is a third guardian that touches player state but deliberately
*doesn't* go through `applyPlayerForm` at all -- it only appends a move id to `unlockedMoves`,
leaving `playerForm` untouched, since the whole point of the impurity-doping mechanic is
borrowing one move without becoming (or fusing into) anything. `learnImpurityMove` is also the
only place that writes registry/save key `andersonDopant` (`scenes/panels/anderson.ts`),
replacing whatever was doped in before -- only one impurity at a time; merely picking a host to
browse its moveset (`scene.andersonSelection`) doesn't touch it, so previewing a candidate and
backing out without learning a move leaves the previous impurity's channel firing.

**Move availability is an intersection, not a flat list.** `unlockedMoves` (registry/save) is
a global "moves learned," unaffected by transmuting. What's actually offered in the battle
menu or Noether's shop is `getBattleMoves(registry)`/an inline `compatibleMoves(...)` filter --
learned ∩ `compatibleMoves(currentForm)`, where `compatibleMoves` derives from
`MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]>` (`data/materials.ts`). `getBattleMoves`
additionally unions in `compatibleMoves(dopant)` when `andersonDopant` is set, so a move
Anderson taught from a doped-in impurity is usable for as long as that impurity stays doped in,
even if the player's own current form can't otherwise host it. Phonon Beam (`phonon`) is the
one class every type allows, so it's always available regardless of form. Every move maps to a
real quasiparticle; there is no abstract "disorder" move or class.

## Stats and battle resolution

**Stats** (`data/types.ts`'s `Stats`, `data/materials.ts`): `quantumness`/`velocity`/
`correlation`, base `10` each (`BASE_STAT`/`DEFAULT_STATS`). Player stats live in registry/save
key `playerStats`, grown via `OverworldScene.renderShopStats` (Noether's "Stats" tab, cost
`statUpgradeCost(current)` per +1 point). Opponent stats are never stored per-material --
`enemyStatsForWorld(world)` (`data/balance.ts`) computes them fresh at battle start
(`BattleScene.create`), scaling by a two-phase curve, gentle through worlds 1-3 and steeper from
world 4 on (`EARLY_GROWTH_PER_STEP`/`LATE_GROWTH_PER_STEP`, see that function's own comment for
the exact rates and the reasoning behind the two phases), rounded to whole numbers.

**Max HP** (`data/balance.ts`) is never intrinsic to a `Material` either (no `maxHp` field at
all -- see "Data model" above) -- both sides' current-battle max HP are resolved fresh in
`BattleScene.create` and held in two scene fields, `playerMaxHp`/`opponentMaxHp`, read by
every other HP-related spot in the file (`updateBars`, `applyHeal`/`applyRegenTick`, the
registry reset in `endBattle`) instead of any `Material.maxHp`. `wildHpForWorld(world)` is a
gentle linear base (23 at World 1 to 33 at World 10) shared by every ordinary wild
in that world and by the player's own current max HP (no roll for the player, or for a
rival -- see below); an ordinary wild's own battle HP additionally gets one
`rollEncounterFactor()` roll (+/-15%, `data/balance.ts`, same range `resolveHitDamage`'s own
damage variance uses) applied to it *and* that same battle's `enemyStats` together (one
shared roll, not four independent ones) -- `this.isRival ? 1 : rollEncounterFactor()` in
`create()`. A rival instead uses `rivalHpForWorld(world)` (steeper, no roll) and plain
`enemyStatsForWorld(world)` -- a rival is a fixed, repeatable challenge, not a specimen with
sample-to-sample variance. `OverworldScene.applyPlayerForm`/`HubScene.applyPlayerForm`
(transmuting/fusing into a new form) clamp the player's saved HP down to
`wildHpForWorld(<current world>)` if above it, rather than to anything about the new form
itself.

`BattleScene.resolveHit` is the single damage-resolution function both sides' attacks go
through: crit chance from the attacker's Quantumness, incoming damage divided by the defender's
Correlation (`BASE_STAT / correlation`), and a `2x` "quasiparticle mismatch" multiplier from
`data/materials.ts`'s `canHost(defenderType, move.class)` -- a defender whose own
`MOVE_COMPATIBILITY` list doesn't include the attacking move's class takes it at double force.
The crit-chance/defense-factor/mismatch/final-product arithmetic itself lives in `data/
balance.ts`'s `resolveHitDamage` (Phaser-free, so `game/scripts/balance-sim.mjs` can run the
same math outside the browser) -- `resolveHit` assembles that hit's own per-term multipliers
(mismatch bool + which multiplier applies, quiz/Analytic/Ultimate bonus, Kondo/Franklin
defensive terms) and calls into it rather than computing the product inline.
This is the only type-interaction term in the damage formula (DESIGN.md §3/§4) -- there is no
separate type-chart multiplier. The move's own `power` feeding that formula is `move.power`
verbatim for the defender's side, but for the *attacker's* side only when `isPlayer` is false --
when `isPlayer` is true it reads `effectiveMovePower(registry, moveId)` instead (Feynman's
move-leveling, §5, `data/materials.ts`), so a leveled move's power bump is the player's own
save state and never leaks onto a wild's own copy of the same move id. Every rendering of a
move's name in `BattleScene` (move buttons, the battle log) goes through the matching
`moveDisplayName(registry, moveId)` on the player's own side (`tunedMoveDisplayName` otherwise)
for the same isPlayer-gated reason -- see `moveButtonContent`/`resolveHit`'s `applyResult`/
`resolveSelfBuff`. `resolveHit` also takes a `bonusMultiplier` param (default `1`,
a no-op) -- `playerAttack` forwards one of Laughlin's Analytic moves' answer-gated 2x/0.5x, or
one of Skłodowska-Curie's Ultimate moves' all-or-nothing 1x/0x, through to the one `resolveHit`
call for that specific move id; the opponent's hit(s) in the same round are never affected. The
question(s) are always answered *before* `resolveHit` runs (`BattleScene.showAnalyticQuestion`/
`showUltimateQuestions`, called from the move button's own click handler, not from inside
`playerAttack`/`resolveHit`) -- keeping `resolveHit` itself synchronous rather than teaching it
to await something was a deliberate call, since it already inline-calls `endBattle` and chains
via `time.delayedCall` for ordinary moves. An Ultimate move is the one exception to that
synchronicity, deferring its own damage-application/log and win-lose-check/turn-release into
`playAttackEffect`'s `onImpact`/`onComplete` callbacks instead of running them inline -- see the
Ultimate-specific paragraph below.

**Turn order and multi-attack (`BattleScene.playerAttack`, `BattleScene.currentHitOrder`).**
Velocity (each side's own raw effective value) decides both who
swings first each round and how many times the faster side swings: `currentHitOrder()` returns
`{ fasterIsPlayer, fasterHits }`, where `ratio` is the faster side's effective Velocity divided
by the slower side's, and `fasterHits` is `Phaser.Math.Clamp(Math.floor(ratio), 1, 3)` -- the
slower side always gets exactly one hit. A tie keeps the player going first, one hit each, same
as the ratio-1 case. Both `playerAttack` (which resolves the round's actual hits) and
`drawTurnPreview` (the "Turns" widget, STYLE.md's "Turn-order preview") call this same helper
so their two views of "who's faster this round" can't drift apart. `playerAttack` builds
an explicit `hits: { isPlayer, moveId }[]` array for the round (the faster side's entries first,
reusing the same player-chosen `moveId` each time or re-rolling `opponentMoveId()` each time on
the enemy's side, then the slower side's single entry) and walks it with a small recursive
`runHit(index)` helper chained through `time.delayedCall(TURN_GAP_MS, ...)`, the same gap every
hit has always used. Because `resolveHit`'s own `checkEndOrContinue` only calls its `onDone`
callback when neither side's HP has hit 0 (it calls `endBattle` directly otherwise), `runHit`
never needs its own extra KO check beyond mirroring that guard -- a KO partway through the
faster side's hit sequence simply never schedules the remaining queued hits. `turnLock` is
released exactly once, when the round's actual last hit's `onDone` fires. `ANALYTIC_MOVE_IDS`/
`ULTIMATE_MOVE_IDS` moves are exempt from this queue entirely -- `playerAttack` short-circuits to
the plain one-hit-each alternation for those, since Analytic/Ultimate's own quiz-gating and (for
Ultimates) multi-phase animation timing are tuned around exactly one `resolveHit` call per side
per round.

**Self-buffs (Kondo's three moves).** `this.playerStatus`/`this.opponentStatus`
(`ActiveStatus | null`, `{ kind: 'shielded' | 'evasive' | 'regenerating'; turnsLeft: number }`)
are battle-only fields, explicitly reset to `null` in `create()` (Phaser reuses the same Scene
instance across `scene.start()` calls, so a field initializer alone doesn't reset them between
battles -- same gotcha `OverworldScene`'s own dialogue-state fields already call out). A Kondo
move (`KONDO_MOVE_IDS`) is never an attack -- `resolveHit` checks for one first thing and routes
it to `resolveSelfBuff(isPlayer, move, tickStatus, onDone)` instead, which never touches
`canHost`/`dmg`/`applyDamage` at all, applying the buff to the *caster's own* side
(`isPlayer`, not `defenderIsPlayer`). Two small per-side lookups feed the buff's actual effect
into the existing formulas rather than adding a parallel damage path: `statusShieldMultiplier`
(`resolveHit`'s `dmg`, keyed by `defenderIsPlayer` -- Shielded reduces *incoming* damage to
whoever holds it) and `statusEvasionChance` (returns 0 when not evasive; checked once per hit
against `defenderIsPlayer`, and if `Math.random()` rolls under it the hit deals zero damage and
`applyResult` logs "evaded!" instead of the usual damage/mismatch/crit clauses). All three of
Kondo's buffs -- Shielded's damage reduction, Evasive's dodge chance, Regenerating's heal
fraction -- scale with Feynman's own move-leveling (§5, World 7) via the shared
`kondoMitigationFraction(isPlayer, moveId, base, cap)`: the *caster's own* level of the specific
move that cast the buff (`screeningCloud`/`scatteringDrag`/`kondoBreakdown`) multiplies the base
mitigation strength by `MOVE_LEVEL_MULTIPLIERS` the same way `effectiveMovePower` scales an
ordinary attack, capped well under 100% so even an Infinite-tier buff leaves real risk on the
table -- gated on `isPlayer` the same isPlayer-only way `effectiveMovePower` is, since no wild
ever casts a Kondo move. `resolveHit`/`resolveSelfBuff` both take a
`tickStatus` param (default `true`) gating whether `applyOrTickBuff(move, isPlayer)` runs at
all -- `playerAttack`'s `runHit` computes, per round, each side's own last index into `hits`
(`lastIndexFor`, a scan rather than an arithmetic shortcut, since a self-buff move collapses its
caster's own hit count to exactly 1 regardless of `fasterHits` -- see `playerAttack`'s own
comment) and passes `true` only there. Ticking on a side's last action rather than its first
matters: an existing buff (e.g. Regenerating on its final `turnsLeft`) has to keep applying
through every one of that side's earlier hits that round before it expires, and a buff cast
this round shouldn't retroactively apply to the actions that cast it. `applyOrTickBuff` itself
does one of two things: if the move is one of Kondo's three (`KONDO_MOVE_BUFF: Record<moveId,
StatusKind>`, a fixed lookup -- no randomness), it replaces the caster's buff outright via
`setStatus` (one buff per side, never stacked); otherwise it ticks the caster's *existing* buff
down by one, applying a Regenerating heal on every tick via `applyRegenTick` (a fraction
(`REGEN_BASE_HEAL_FRACTION`, scaled by `kondoMitigationFraction` above) of the caster's own max
HP, capped so it can't overheal), and clears the
buff once `turnsLeft` hits 0. Either branch returns a log-line clause (`STATUS_INFO[kind]
.applyText`/`.expireText`, plus the heal clause for Regenerating) appended to that hit's own
message, the same "stack a clause onto the existing line" pattern `mismatchText`/`critText`
already use. `setStatus` also calls `renderStatusLabel`, which updates a small
always-present-but-usually-empty `Text` pill (`playerStatusLabel`/`opponentStatusLabel`,
positioned just under each side's HP bar) to `"<Label> (<turnsLeft>)"` or clears it to `''` when
there's no active buff.

**Passives (Franklin's abilities).** `this.playerActivePassives`/
`this.opponentActivePassives` (`Set<string>` of `data/passives.ts` ids) are read once in
`create()` from registry/save `activePassiveByOwner` (keyed by `PassiveOwner`, `data/
passives.ts`) and held for the whole battle -- unlike Kondo's self-buffs above, a passive has no `turnsLeft`/tick-down
machinery at all, it's just on or off for the battle. Each side's active passives get their
own pill too, built by `addPassivePill(x, naturalY, text, statusBottom, maxRightX)` and stacked
directly below that side's status pill (`naturalY` offset from the status pill's own measured
`y`/`height`, same text-size-scaling reasoning the name/bar row's own layout uses) -- since the
set never changes mid-battle there's no tick-down render function like `renderStatusLabel`,
the pill's text (`passivePillText`, `PASSIVES[id]?.name` joined with `·` for the 0-2 entries a
side can hold, `?.` guarding against a stale id from an old save) is built once at creation and
the `Text` object isn't kept as a field, matching `opponentName`/`playerName` above rather than
`playerStatusLabel`/`opponentStatusLabel` (those are fields because `renderStatusLabel` reads
them back later; nothing reads the passive pill back). `addPassivePill` clamps the pill's `x`
back against its caller's own `maxRightX` if the joined text would otherwise run past it at the
largest text-size setting -- `FIELD_W - 8` on the opponent's side, but `MENU_X - 12` on the
player's, since the bottom-anchored move menu shares that side's vertical band for the whole
battle (`MENU_MIN_TOP`, see "Battle move menu" below) -- and if the vertical stack above it
(boost/fail note + the name/bar row + status pill, on the player side) leaves no room left
under `FIELD_H` at that same setting, destroys the pill outright rather than let it land back
on top of the status pill above it -- the status pill's own readability takes priority over
showing the passive pill in that narrow combo. It uses
`PASSIVE_PILL_COLOR` (a muted blue-violet) rather than `STATUS_PILL_COLOR`'s rust-orange, so
an always-on passive reads as visually distinct from a ticking status at a glance.
`activePassives(isPlayer)` is the
generic per-side lookup every hook below reads (`opponentActivePassives` stays empty today,
kept as its own field rather than hardcoding "player only" so the hooks read symmetrically
off either side, same reasoning `statusShieldMultiplier` etc. already follow). All three of
Franklin's own hook directly into `resolveHit`, identified by id (`data/passives.ts`'s
`fractionalGuard`/`anyonEcho`/`edgeCurrent` -- ids kept as originally minted from an earlier
retheme, see "Guardians" below): **Amorphous Halo** (`edgeCurrent`) softens the mismatch
multiplier (`mismatchMult`, 2x → `EDGE_CURRENT_MISMATCH_MULT` 1.5x) when the *defender* has it
active; **Diffraction Shadow** (`fractionalGuard`) adds a `fractionalGuardMult` (0.85) term to
the `dmg` formula, also keyed off the defender; **Satellite Reflection** (`anyonEcho`) fires
after the primary hit's damage already landed, sharing a small helper with the ordinary
damage-application code path -- `applyDamage(toPlayer, amount)` (mirrors the
registry-write/persist-only-for-the-player rule the original inline branch used, and calls
`updateBars()`) -- re-called for a bonus `Math.round(dmg * ANYON_ECHO_FRACTION)` tick against
the same defender when the attacker's own crit lands with it active. Its own log clause
(`echoText`) stacks onto the hit's line after `statusText`, same "stack a clause onto the
existing line" pattern `mismatchText`/`critText`/`statusText` already use, in that fixed
order.

**Ultimate moves defer damage/turn-handoff to match their multi-second animation.**
`resolveHit`'s tail is fully synchronous for every ordinary move: `playAttackEffect` fires
(fire-and-forget), `applyResult()` (damage/log/passive hooks) and `checkEndOrContinue()`
(win-lose check + `onDone()`/turn-release) run immediately afterward, all before the
~830ms-or-shorter animation even finishes -- fine at that duration, but a 4-6s Ultimate summon
would desync badly (HP dropping and the opponent's counter-swing scheduled while the summon is
still playing). `playAttackEffect` takes an additional optional `onComplete?: () => void`
alongside its existing `onImpact?: () => void` (`art/attackEffects.ts`) -- for
`ULTIMATE_MOVE_IDS` only, `resolveHit` folds `applyResult()` into `onImpact` (so it lands at the
sequence's own impact beat, not five seconds early) and defers `checkEndOrContinue()` into
`onComplete` (so it only fires once the full windup→charge→impact→aftermath sequence finishes).
Every other move's call to `playAttackEffect` omits `onComplete` and keeps calling
`applyResult()`/`checkEndOrContinue()` inline right after, so this is zero-regression for the
~25 non-Ultimate moves. `turnLock` (set before the move fires, cleared in `onDone`) already
blocks all input for however long it stays `true`, so no separate locking logic was needed for
the longer window. A whiff (`bonusMultiplier === 0`, only reachable for an Ultimate move --
`showUltimateQuestions`' any-wrong-answer path) still plays through `onImpact`/`onComplete` the
same way, just with `dmg` resolving to (near-)zero and the log line reading a distinct fizzle
message rather than the ordinary "used `<move>`! (N dmg)" line.

**Battle move menu is sectioned, paged one section (or one section-fragment) at a time.**
`BattleScene.moveSections(moveIds)` splits `getBattleMoves`'s result into up to four
sections (a module-level `MoveSection[]`, filtered to only the ones with at least one usable
move): **Attacks** (every move whose id isn't in `ANALYTIC_MOVE_IDS` or `ULTIMATE_MOVE_IDS`, and
whose `class` isn't `'screening'`), **Analytic** (Laughlin's two moves, identified by id rather
than by a shared class, `★` tag, own "right=2x wrong=½x" legend sub-line under its own header),
**Ultimate** (Skłodowska-Curie's two moves, `★★★` tag, own "3/3 correct or it whiffs" legend
sub-line), **Buffs** (Kondo's currently-active self-buff move, at most one, own "self-buff, no
damage, 3 turns" legend sub-line -- `moveButtonContent` special-cases `KONDO_MOVE_IDS` to skip
the mismatch check and `Pwr <n>` label entirely, showing "`<n>`-turn buff" instead).
`moveMenuPages(moveIds)`
further splits any section larger than the fixed `MOVE_MENU_MAX_ROWS` (3) into several
same-label pages (e.g. a `chernSuperconductor`-type form's full **Attacks** list -- the
broadest single main type's own `MOVE_COMPATIBILITY` list, 5 classes -- becomes "ATTACKS (1/2)"
then "ATTACKS (2/2)", 3 moves plus 2) rather than measuring available field space to decide how
many rows fit -- the cap is a plain constant, so every page's row budget stays close to
identical regardless of how many moves a section has in total.
`drawMoveMenu(moveIds)` builds a docked `Container` (field `moveMenu`, destroyed and rebuilt
from scratch on every call, not just once at battle start) at the field's bottom-right, but
renders only `moveMenuPages(moveIds)[movePageIndex]` -- one page, not every
section stacked. `moveButtonContent(moveId)` returns the shared `{ text, color }` label both
`addMoveButton(container, moveId, y, btnPx, padY)` (the per-move-button builder: click-handler,
interactivity) and `drawMoveMenu`'s own line-count safety check (below) read, so the two can't
drift on what a button actually says.

Paging: `switchMovePage(delta)` (fields `movePageIndex`/`currentMoveIds`) recomputes
`moveMenuPages`, wraps `movePageIndex` by `delta`, and calls `drawMoveMenu` again -- wired
to on-screen ◀/▶ `Text` buttons flanking the header (rendered only when
`moveMenuPages(...).length > 1`) and to `create()`'s `keydown-LEFT`/`keydown-RIGHT` listeners.
Guarded by `turnLock` (mid-swing) and `!this.moveMenu` (already destroyed by `endBattle`) so a
keypress can never act mid-resolution or resurrect the panel after the battle ends.

Sizing: `drawMoveMenu` runs its own title/legend/header/pager layout twice -- a throwaway
measurement pass (destroyed immediately) that exists only to learn the current page's real
content height, then the same layout again for the real, permanently-positioned elements --
because the panel is bottom-anchored (`menuTop = FIELD_H - MENU_BOTTOM_MARGIN - height`,
floored at `MENU_MIN_TOP` so it can never grow up into the opponent's cluster) rather than
built down from a fixed top the way a top-anchored panel could measure and place in one pass.
The header `Text` (label + page indicator + optional legend) is capped well below the
text-size setting's own range (`headerScale = Math.min(scale, 1.15)`, base 10px label / 8px
legend), and the panel's own title/legend are capped the same way (`chromeScale =
Math.min(scale, 1.35)`, matching `rowH`'s own cap below) -- letting either scale all the way
to the 2x 'Large' preset would eat directly into the row budget; the pager arrows render at a
larger px than the header label (`arrowPx`), so the header's own row advances by
`Math.max(headerLabel.height, pagerRowH)`, not the label's height alone, or the taller arrows
would bleed into the first move row. Row height (`rowH`) is computed from the fixed vertical
band the panel may occupy (`MENU_MIN_TOP` down to `FIELD_H - MENU_BOTTOM_MARGIN`) minus the
chrome above, divided by the current page's `rowCount` (never more than `MOVE_MENU_MAX_ROWS`)
via `Phaser.Math.Clamp` against a `20`px floor and a scale-scaled `maxRowH` ceiling. Each
button's font size (`btnPx`) starts at `Math.min(desiredPx, fitPx)` (`fitPx` derived from
`rowH`, assuming a label wraps to at most 2 lines), then `drawMoveMenu` measures every label
on the page with a throwaway `Text` object's `getWrappedText()` and shrinks `btnPx` in
whole-pixel steps, uniformly across the page, until none of them actually wrap past 2 lines --
catches a long tuned quasiparticle name (e.g. "Heavy Fermion Meteor") stacked with a `★★★
!!2x` tag, which `fitPx`'s purely-vertical budget alone doesn't account for, without ever
letting a label reach a 3rd line the row-height math has no room for.

A move whose id is one of `ANALYTIC_MOVE_IDS` still gets its `★` tag on the button itself (the
2x/0.5x legend text now lives under the Analytic section header instead, see above); its
button's `pointerdown` handler branches before `playerAttack` -- it opens
`BattleScene.showAnalyticQuestion` first (locking `turnLock` for the duration) and only calls
`playerAttack(moveId, bonusMultiplier)` once answered, rather than calling `playerAttack`
directly the way every other move button does. A move in `ULTIMATE_MOVE_IDS` follows the same
shape but with `showUltimateQuestions` (up to 3 sequential questions, stopping at the first
wrong answer since the outcome is already decided) in place of `showAnalyticQuestion`, and
`playerAttack(moveId, allCorrect ? 1 : 0)` instead of a continuous multiplier.

**BattleScene reads the world's biome.** `drawBackground` calls `getBiome(this.world)` (the
same `art/biomes.ts` table `OverworldScene`'s corridor uses) -- sky/ridge/ground gradients, the
decorative crystal outcrops, and the ground tufts all derive from the biome's `skyTop`/
`skyBottom`/`hillColor`/`ground`/`path` fields via `shade()`. Any future per-biome visual field
added to `Biome` should flow through here too if it should affect the battle arena, not just
the overworld.

**BattleScene also requests the world's battle track.** `create()` calls `music.play` with the
key `battle:<world>` -- `audio/music.ts`'s `SCORES` table has one procedural battle score per
world (`BATTLE_SCORE`/`BATTLE_SCORE_2`.../`BATTLE_SCORE_10`, world 1 hand-written, worlds 2-10
built by `makeBattleScore()`), the battle counterpart to `OverworldScene`'s existing
`overworld:<world>` lookup. `this.world` is set in `init()`, which Phaser always runs before
`create()`, so it's populated before this call.

## Rival/boss fights

**Rival fights render the boss look in battle too.** `BattleScene.create` picks `art/boss.ts`'s
`makeBossCrystal` over the plain `makeCrystal` when `this.isRival`, sized `BOSS_CRYSTAL_SIZE`
and positioned at `BOSS_OPPONENT_POS` (both module constants) instead of the wild encounter's
`OPPONENT_POS` -- the instance field `this.opponentPos` tracks whichever was actually used, and
`resolveHit`'s attack-effect `from`/`to` read that field, not the `OPPONENT_POS` constant
directly, so bolts/rings/bursts still travel to the crystal's real (possibly shifted) position.

**The goal tile belongs to that world's boss, not a guardian.** `OverworldScene.spawnBossSprite`
spawns `art/boss.ts`'s `makeBossCrystal` (a golem silhouette fused from multiple shards + pulsing
aura + orbiting embers, `BOSS_CRYSTAL_SIZE = 70`) at `goalTile` for every built world's `getRival()` (via
`OverworldScene.getWorldRival()`, see below), for as long as that world's rival is undefeated --
purely a visual landmark via the same `WorldSprite` machinery, no click handler of its own.
`openGoalGuardianPanel()`'s branch on `guardian?.tile === 'goal'` is a permanent no-op (no entry
uses it), so it always falls through to `showGatePanel()`, which is what renders at the goal.

**World doors.** `OverworldScene.spawnDoorSprites` puts a doorway landmark (`art/door.ts`'s
`makeDoorSprite`, `DOOR_SPRITE_SIZE = 46`) at every built world's `startTile`, and a second one at
`goalTile` once `isRivalDefeated()` is true for that world -- `spawnBossSprite` stops spawning its
own avatar there once the rival is beaten, so the two never share the tile. Walking onto the
start-tile door is tile-exact (`OverworldScene.maybeReachStartDoor`, checked against `startTile.x`
*and* `.y`, unlike the row-only `maybeReachGoal`/`maybeReachMiddle`) and opens
`showStartDoorPanel`, a confirm panel offering to step back into World N-1 (or the Hub for World
1) via `returnToPreviousWorld`, which calls `advanceToWorld(world, 'goal')` -- the second param
threads through `OverworldInitData.enterFrom` and `Overworld`'s own `create()`/`generateMap()` so
the destination scene overrides its freshly generated `playerTile` to that map's own `goalTile`
and marks `reachedGoal = true` immediately, landing the player as if they'd walked in from the far
end rather than restarting that world's corridor. The goal-tile door doesn't need its own confirm
panel -- walking onto it (also tile-exact, checked in `tryMove`'s `onComplete` alongside
`maybeReachGoal`) just reopens the same `showGatePanel` the boss's "Face the Rival" button already
lived in, now offering "Continue to World N+1" via the existing `renderShopFooter`/
`tryAdvanceToNextWorld` path -- no separate door-specific advance logic.

**World 9's rival has no fixed type, unlike every other world's.** `data/materials.ts`'s
`getRival(world, rival9Type?)` takes an optional second param that only world 9 reads --
`getRival(9, t)` builds `rivalImpurityResonance(t)`, a `Material` whose `type` is whatever's
passed in and whose name is looked up per-type from `RIVAL_9_NAMES` (a polycrystalline-golem
name for each of `RIVAL_9_TYPES`' 7 members, same "real compound's polycrystalline form"
naming `WORLD_RIVALS[1-8]` uses); every other world ignores the param and returns its fixed
`WORLD_RIVALS[world]` entry. `RIVAL_9_TYPES` (7 of the 13 `MaterialType` values -- metal,
quantumSpinHall, superconductor, classicalMagnet, quantumSpinLiquid, multiferroic,
chernInsulator) and `rollRival9Type()` (a uniform pick from it) live in `data/materials.ts`
too. `OverworldScene.resolveRival9Type()` is the one caller that actually rolls: it reads
registry/save `rival9Type`, rolling and caching a fresh one via `rollRival9Type()` +
`persistFromRegistry` the first time it's ever called for that save, so every later call
(the goal-tile boss preview, the rival battle itself) returns the same cached type instead of
re-rolling. `OverworldScene.getWorldRival()` is the shared wrapper both `spawnBossSprite` and
the rival-battle code path call -- it passes `resolveRival9Type()` for world 9 and `undefined`
for every other world, so callers never need their own `this.world === 9` branch.

**World 10's rival has no fixed type either, unlike World 9's, decided live in `BattleScene`
rather than rolled once per visit.** `data/materials.ts`'s `WORLD_RIVALS[10]` ("The Adapted")
carries a placeholder `type` (never read once a battle starts) used only for the pre-battle
overworld/dialogue preview -- `BattleScene`'s own `adaptedForm` field (`Material | null`,
non-null only for `this.isRival && this.world === 10`) is this fight's actual live
type/look/name, read through the `opponentView()` helper everywhere the opponent's identity
matters (`resolveHit`'s mismatch check, `moveButtonContent`'s `!!2x` preview, `drawTurnPreview`,
every opponent-identity log line, `endBattle`'s flavor/blurb) instead of `this.wild` directly.
Set in `create()` to mirror `getPlayerMaterial`'s own current type (visuals/name stay "The
Adapted"'s own until the first transmutation). `resolveHit`'s `checkEndOrContinue` calls
`transmuteAdapted(effectiveClass)` once per player Attack/Analytic/Ultimate move that resolves
against a still-living Adapted (Kondo's self-buff moves never reach that function at all, see
`resolveHit`'s own early return) -- it reverse-looks-up `data/materials.ts`'s
`typesHosting(moveClass)` (every `MaterialType` whose `MOVE_COMPATIBILITY` list actually
includes that class), picks a real compound of one of those types at random from `allCrystals()`,
and becomes a "Polycrystalline `<compound>` Golem" of it (same naming `WORLD_RIVALS[1-8]` uses),
rebuilding `opponentCrystal`/`opponentNameText` and logging the change. `this.wild.moves`
(its actual attack moveset) is never touched by this -- only its defensive identity is
dynamic; HP was never tied to its identity in the first place (`opponentMaxHp`, see "Max
HP" below, stays fixed for the whole battle).

**Progression (Face the Rival/Continue) is exclusive to the goal panel.** `renderShopFooter`
(Farewell + Face-the-Rival/Continue, `showGatePanel`'s only caller) and `renderFarewellFooter`
(Farewell only) are siblings -- every mid-corridor guardian panel (`showNoetherShop`'s two tabs,
`showBlochHub`, `showGuardianLore`, `showDresselhausPanel`) calls `renderFarewellFooter`, never
`renderShopFooter`, so no guardian panel can trigger that world's boss fight without the player
walking to (or seeing) the goal. If a future guardian panel needs a progression action, route it
through `showGatePanel`, not by reaching for `renderShopFooter` directly.

## World progression

`HubScene.highestUnlockedWorld()` walks `rivalDefeated` from world 1 until it finds a world not
yet beaten, capped at `BUILT_WORLDS`'s own max (10) so beating World 10's rival and returning to
the Hub before the finale panel fires re-enters World 10 rather than a nonexistent World 11.
`OverworldScene.tryAdvanceToNextWorld()`/`advanceToWorld(this.world + 1)` likewise
compute the next world rather than hardcoding it. `advanceToWorld`'s second param, `enterFrom:
'start' | 'goal'` (default `'start'`), is what the world-door feature (above) uses to land the
player on the destination's `goalTile` instead of its `startTile` -- every other caller
(`showBlochHub`'s destination buttons, `showStoryBeat`'s "Onward") omits it and gets the ordinary
south-edge spawn. `BUILT_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9,
10]` is the single source of truth for "worlds with a walkable map," used by Bloch's
teleport destination filter (and, in Superposition Mode, the list every world gets
pre-marked visited against -- `OverworldScene.applySuperpositionLeveling`); extend it (plus
a biome entry in `art/biomes.ts`) together if a future world is ever added past 10.
`OverworldScene.recordVisit()`/`getVisitedWorlds()` track registry/save key `visitedWorlds`
(distinct from `rivalDefeated` -- you can visit a world without beating its rival), written
once per world the first time that world's scene is created.

**Returning to the Hub always snapshots the in-progress world first.**
`OverworldScene.returnToHub()` (H/Enter, the World 10 finale's "Return to the Lab", and
`returnToPreviousWorld()`'s World-1 case -- every path from a world back to the Hub) calls
`saveMapState()` before `scene.start('Hub')`, so the registry's `mapState` key always reflects
wherever the player actually stood, not just wherever a wild encounter/goal/middle-row event
last happened to fire (`saveMapState`'s other call sites). `HubScene.canResumeWorld(world)`
reads that same `mapState` key (`.world === world`) together with `visitedWorlds` to decide
whether the Hub door (and the Lab's own Enter key, `HubScene.create()`'s `keydown-ENTER`
listener -- the reverse direction of `OverworldScene`'s own H/Enter, guarded by the same
one-panel-at-a-time `dialogueContainer` check every Lab station already uses) can promise a
resume-in-place; `mapState` is registry-only and doesn't survive a page reload the way
`visitedWorlds` does, so checking both is what keeps a reloaded session's door label from
promising a resume it can no longer deliver. `HubScene.doorLabel()`/`enterWorld()` and the Lab's
`keydown-ENTER` handler all read this one predicate rather than three separate checks that could
drift apart.

`WORLD_NAMES` is meant to be readable as "which course topic is this," not a generic RPG
terrain name. `WORLD_RIVALS`' own names (and, per-type, `RIVAL_9_NAMES`) instead follow
"Polycrystalline `<real compound>` Golem" -- the world's own topic anchors which compound
(see DESIGN.md §2) -- so check both tables together when renaming a world, since a mismatched
rival name is easy to miss if only `WORLD_NAMES` is updated.

## Guardians

Every guardian has its own avatar builder in its own file: `art/noether.ts`'s `makeNoetherAvatar`,
`art/bloch.ts`'s `makeBlochAvatar` (wireframe Bloch-sphere head, teal),
`art/dresselhaus.ts`'s `makeDresselhausAvatar` (spin-momentum-locked arrow ring, teal-green),
and one file per remaining guardian (`art/laughlin.ts`, `art/majorana.ts`, `art/anderson.ts` --
disordered-lattice head motif, world 6, `art/feynman.ts` -- vertex/propagator diagram
construct, no robe/cloak fill at all unlike every other guardian's avatar, amber, world 7,
`art/kondo.ts`, `art/franklin.ts` -- diffraction/lattice-defect motif, world 9,
`art/sklodowskaCurie.ts`, world 10). Every guardian spawns through one
unified `OverworldScene.spawnGuardianSprite` (looked up from the `WORLD_GUARDIANS` table), not a
bespoke `spawnXSprite` per guardian, and all share one chime, `playGuardianChime()` in
`audio/sfx.ts`.

**Renaming a guardian is a display-layer change, not a mechanic change.** `WORLD_GUARDIANS[N].id`
(a `metGuardians`/save-list key, never displayed) can stay whatever it was, or change to match --
nothing special-cases a specific id string. What actually needs touching for a rename: the
avatar file + exported function name (by convention, `art/<name>.ts`'s `make<Name>Avatar`,
though this is a style convention, not something the code enforces), the `WORLD_GUARDIANS` entry's
`id`/`name`/`quote`/`avatar` fields, the corresponding `import` line in `OverworldScene.ts`, and
every doc that names the guardian by name (DESIGN.md §5, this file, DEVELOPMENT.md, README.md --
`grep -rn` the old name across the repo, not just `game/src/`, since course-content
cross-references in DESIGN.md's crystal database can share a physicist's name with a guardian
without being about the guardian at all -- e.g. "Anderson localization"/"Anderson's theorem"
physics terminology (DESIGN.md, `quiz.ts`) has nothing to do with the guardian named Anderson, so
a blind find-and-replace on a name is unsafe).

**Laughlin (world 4), Majorana (world 5), Anderson (world 6), Feynman (world 7), Kondo (world 8),
Franklin (world 9), and Skłodowska-Curie (world 10) all have real mechanics**, following the
same `open: (s) => showXPanel(s)` pattern as Noether/Bloch/Dresselhaus (see "Guardian panels"
above for the `scenes/panels/` file-per-guardian convention every one of them follows):
- **Franklin's passive panel** (`scenes/panels/franklin.ts`'s `showFranklinPanel`) uses
  `scenes/panels/passiveList.ts`'s `renderPassiveList(scene, container, y, passiveIds,
  owner: PassiveOwner, reopen)`, parameterized over which `data/passives.ts` `PassiveOwner`
  it's rendering for even though Franklin is the sole caller today -- it reads/writes the two
  fixed generic registry/save keys (`passivesUnlocked` and `activePassiveByOwner`, keyed by
  owner) internally rather than taking them as params, filtering/writing by the `owner` param.
  Same "still-unbought get a buy button, already-bought get a 'Make `<name>` active' button or
  a dimmed '`<name>` (active)' tag" shape `renderKondoMoves` established, right down to
  "buying the very first one auto-activates it, buying a second or third doesn't." Like
  Kondo's own self-buff moves, a passive is never gated by `MOVE_COMPATIBILITY` at all (the
  same "player-learned technique, not a quasiparticle a crystal has to host" reasoning) --
  every passive is always purchasable regardless of current form, so the panel has no "wrong
  form" empty state to special-case. Each still-unbought row also prints the passive's own
  `description` underneath in a smaller, capped-scale font (`Math.min(fontScale(this), 1.3)`
  for the buy button itself, `1.2` for the description) -- the panel has no shrink-to-fit
  safety net the way `showInfoPanel` does, and letting either scale all the way to the
  text-size setting's uncapped 'Large' preset (like every other guardian panel's buttons do)
  pushed the panel's Farewell button off the bottom of the canvas the first time this was
  tried, verified via a live headless-Chromium run at every `fontScale` preset. See "Stats and
  battle resolution" above for exactly how each of her three passives hooks into `BattleScene`.
- **Feynman's move-leveling panel** (`scenes/panels/feynman.ts`'s `showFeynmanPanel`) is a
  different mechanic shape entirely from every other guardian's -- not a purchase catalog, but
  a leveling attempt against a move the player already owns. `renderMoveLevelList` builds one
  row per `scene.getUnlockedMoves()` entry (deliberately not `getBattleMoves()` -- a move
  currently unusable in the player's present form is still worth leveling), paginated via
  `scene.renderPagedButtons`/`scene.feynmanPage` the same way Bloch's/Dresselhaus's/Majorana's/
  Anderson's own candidate lists are (see "Overworld menus and settings" below), since the
  full unlocked-move list can outgrow one panel well before Superposition Mode's "every
  crystal" case even applies. Each row reads a move's current level (`data/materials.ts`'s
  `getMoveLevel`) and, if not already at tier 3, the cost to attempt the next tier
  (`feynmanLevelCost`) and that tier's own streak length (`MOVE_LEVEL_STREAKS`); a maxed or
  unaffordable row dims via `renderPagedButtons`' own `isDim` param and is a no-op. Clicking an
  eligible row deducts the cost immediately (before a single question is asked, and never
  refunded) and calls `showLevelStreak`, a self-contained recursive question flow (`getAnalyticQuestions`
  from `data/quiz.ts`, the same visited-world-filtered pool Laughlin's own single question
  draws from) built the same way `OverworldScene.showEncounter`'s pre-battle quiz and
  `BattleScene.showUltimateQuestions` are, just living in the overworld panel rather than
  mid-battle -- stops at the first wrong answer (writing nothing) or, on a full streak, writes
  the new tier to registry/save `moveLevels` before returning to `showFeynmanPanel`. See "Stats
  and battle resolution" above for `effectiveMovePower`/`moveDisplayName`, the two places a
  move's level actually surfaces in `BattleScene`.
- **Majorana's hybrid-material panel** (`scenes/panels/majorana.ts`'s `showMajoranaPanel`) lets the player fuse
  two `defeatedMaterials` into a new `Material` via `data/materials.ts`'s `combineMaterials(a,
  b)`, which spreads whatever `Material` the matching `HYBRID_RECIPES` entry authored
  (name/type/moves all fixed there, not computed at combine time) and adds only
  `hybridParents` for the fused-visual render, then becomes it immediately via `applyPlayerForm`
  (see "Player form" above). **Not any two defeated crystals** -- only pairs with a named entry
  in `HYBRID_RECIPES`, keyed by parent *name* rather than main type (`hybridRecipeResult(nameA,
  nameB)` returns the recipe's result, or `undefined` for an unrecognized pair) -- same-type
  pairs are allowed when a named recipe explicitly covers them (e.g. Graphene + Graphene). The
  panel filters both the first-pick list (only crystals with *some* valid partner among the
  other recently-defeated ones) and the second-pick list (only crystals that pair with whichever
  was picked first) through this before ever rendering a button, so an invalid combination is
  never one click away -- `createHybrid` doesn't re-validate, it trusts the panel already
  filtered. A two-step pick (`scene.majoranaSelection: string | null`, the first choice, while the
  panel rebuilds for the second) rather than one screen of every valid pair -- reset in both
  `create()` and `closeDialogue()` so a stale first pick can't survive a cancel-and-reopen.
  Deliberately no memory of earlier fusions to re-become without recombining -- every visit
  starts the two-step pick fresh; `createHybrid` doesn't persist anything beyond calling
  `becomeHybrid`, which just runs `applyPlayerForm` (the player's *current* form, hybrid or
  not, already survives a reload on its own via `playerForm`). Each individual result is its
  own one-time `MAJORANA_FUSE_COST` (60) qumatessence unlock (registry/save
  `majoranaUnlockedResults`, a list of result names), charged and recorded inside
  `createHybrid` at the moment a specific partner is picked (the point the result is first
  known) rather than at the first-crystal-browse step -- see the Superposition Mode bullets
  above and DESIGN.md §5 for the pricing rationale.
- **Laughlin's Analytic-move shop** (`scenes/panels/laughlin.ts`'s `showLaughlinPanel`, calling
  `scenes/panels/tunableMoveShop.ts`'s shared `renderTunableMoveShop(scene, container, y,
  moveIds, reopen)`) mirrors `scenes/panels/noether.ts`'s `showNoetherShop`/`renderShopMoves`'s
  standard `shopCost` purchase flow but sells only `data/materials.ts`'s `ANALYTIC_MOVE_IDS`
  (a hardcoded pair, `skyfallBeam`/`groundEruption` -- identity by id, since neither move has a
  distinguishing class of its own to filter on), which `SHOP_MOVE_IDS` deliberately excludes so
  Noether never also offers them. Two rendered sections: still-unbought moves, then every
  already-bought one showing which quasiparticle it's tuned to (its row label is
  `tunedMoveDisplayName`, e.g. "Magnon Lance -- tuned to Magnon (retune)"). Buying
  (or later retuning) a move opens `tunableMoveShop.ts`'s `showMoveClassPicker` -- a sub-panel
  offering `TUNABLE_MOVE_CLASSES` (every ordinary Attacks-section class, i.e. everything except
  Kondo's `'screening'`) filtered through `canHost(playerMaterial.type, cls)` (so only
  classes the player's *current* form can host are ever pickable), each labeled via
  `quasiparticleLabel` -- which writes registry/save `moveClassTuning[moveId]` (a map shared
  with Skłodowska-Curie's Ultimate moves below, since it's keyed by move id, not owner), read by
  `data/materials.ts`'s `getTunedMoveClass` in place of the move's own static `class`
  (which defaults to `'phonon'`, the same universal class Phonon Beam carries) wherever
  `BattleScene` checks quasiparticle-mismatch (both `addMoveButton`'s `!!2x`
  tag and `resolveHit`'s actual damage multiplier) and by `tunedMoveDisplayName` for the
  label; the move's own static `class` never changes, so an untuned move stays
  purchasable/usable from any form and still asks its question regardless of tuning. The
  picker only filters at pick time, so a saved assignment can outlive a later transmute into
  a form that can't host it -- `getTunedMoveClass` re-checks `canHost` against the player's
  *current* form every call and falls back to `'phonon'` (universal) when it
  fails, and `tunedMoveDisplayName`/the shop row label read that same fallback rather than the
  raw saved value, so name and mismatch math can't disagree -- `tunedMoveDisplayName` reads as
  "Phonon Lance"/"Phonon Eruption" in that state, the shop row's own fallback text reads the
  bare noun instead ("reverted to Phonon", `quasiparticleLabel`). See
  `BattleScene.showAnalyticQuestion` (Stats and battle resolution, above) for how a purchased
  Analytic move actually plays out in a fight.
- **Skłodowska-Curie's Ultimate-move shop** (`scenes/panels/sklodowskaCurie.ts`'s
  `showSklodowskaCuriePanel`/`renderUltimateMoves`/`showUltimateClassPicker`) sells
  `data/materials.ts`'s `ULTIMATE_MOVE_IDS` (`ultimateMeteor`/`ultimateNova`), and is deliberately
  **not** built on `tunableMoveShop.ts` -- her pricing model has no separate "buy the move" step
  at all. `renderUltimateMoves` shows one row per Ultimate move, always (there's no
  forSale/learned split the way `renderTunableMoveShop`'s does, since opening the class picker
  and paying for a class *is* what first unlocks the move): the row names the move's current
  quasiparticle (`tunedMoveDisplayName`/`getTunedMoveClass`, the same helpers Laughlin's shop
  reads/writes) or says "not yet unlocked" if the move isn't in `unlockedMoves` yet.
  `showUltimateClassPicker` offers the same `TUNABLE_MOVE_CLASSES`-filtered-by-`canHost` list
  `showMoveClassPicker` does, but each row's cost is per-class rather than a flat move price:
  "Free (already unlocked)" for a class already in registry/save
  `ultimateClassesUnlocked[moveId]`, else `ULTIMATE_CLASS_UNLOCK_COST` (1000) qumatessence.
  Picking an already-unlocked class just retunes (writes `moveClassTuning[moveId]`); picking a
  new one deducts the cost, appends the class to `ultimateClassesUnlocked[moveId]`, retunes, and
  -- only on that move's very first-ever unlock -- appends the move id to `unlockedMoves` so it
  appears in the battle menu. Once tuned, an Ultimate move's battle-side quasiparticle-mismatch
  math reads exactly like an Analytic move's (`getTunedMoveClass`) -- no special-casing beyond
  the 3-question gate, which lives entirely in `BattleScene` (see "Ultimate moves defer
  damage/turn-handoff," above, and `showUltimateQuestions` in "Battle move menu is sectioned,"
  above). Unlike `showMoveClassPicker` (every row there is always immediately actionable, so it
  needs no separate exit), a row here can be genuinely unaffordable -- with no class yet
  unlocked for that move and too little qumatessence, every row is a no-op click. A `<- Back`
  footer button (calling the same `onDone` a successful pick would) is therefore required:
  any sub-panel where every row *can* be a dead end needs an explicit way out that doesn't
  depend on one of those rows succeeding.
- **Kondo's self-buff shop** (`scenes/panels/kondo.ts`'s `showKondoPanel`/`renderKondoMoves`)
  sells `data/materials.ts`'s `KONDO_MOVE_IDS` (three moves:
  `screeningCloud`/`scatteringDrag`/`kondoBreakdown`, each tied to one of `types.ts`'s
  `'screening'`-class `MOVES` entries, deliberately excluded from `SHOP_MOVE_IDS`/
  `ANALYTIC_MOVE_IDS`/`ULTIMATE_MOVE_IDS`). Same two-section shape as Laughlin's shop:
  still-unbought moves (usable from any form, since a self-buff isn't gated by
  `MOVE_COMPATIBILITY` at all, same afford/dim buy-button treatment as every shop) followed by
  every already-bought Kondo move as its own row -- a bought-and-inactive move gets a "Make
  `<name>` active" button, the currently active one (registry/
  save `kondoActiveMove: string | null`) shows a dimmed "`<name>` (active)" tag instead (no
  click handler), the same dimmed-current convention Dresselhaus's own "(current
  form)" rows already use. Every row, bought or not, also prints the move's own `description`
  underneath (`data/materials.ts`'s `Move.description`, only Kondo's three moves carry one),
  the same convention `renderPassiveList` established for Franklin's own passives. Buying
  the first Kondo move auto-activates it (so a purchase is
  never silently unusable); buying a second or third on top of an already-active one doesn't
  -- switching between already-bought moves is always its own explicit click either way, and
  only one can ever be active at a time. None of the three is gated by `MOVE_COMPATIBILITY`,
  so every one of them is always for sale until bought -- there's no empty/wrong-form state to
  render here, unlike Noether's shop. This
  active/inactive split is a narrow, Kondo-specific special case in
  `getBattleMoves` (`data/materials.ts`): a `KONDO_MOVE_IDS` entry is surfaced purely by
  whether it equals `kondoActiveMove`, checked before (not intersected with) the ordinary
  `compatibleMoves` filter every other learned move goes through -- no other move class has
  (or needs) an equip-slot-style mechanic like this. In battle, casting one calls
  `BattleScene`'s `resolveSelfBuff`/`applyOrTickBuff` (see "Self-buffs (Kondo's three moves)"
  above) to apply its one fixed buff (`KONDO_MOVE_BUFF`, no randomness -- the move id decides
  the buff) to the caster's own side, not the opponent.
- **Anderson's impurity-doping panel** (`scenes/panels/anderson.ts`'s `showAndersonPanel`/
  `learnImpurityMove`) is a two-step pick like Majorana's, but the *result* is different: step
  one picks a host crystal (`defeatedMaterials`, or every crystal in Superposition Mode -- same
  pool source as Dresselhaus/Majorana), filtered to exclude any `isHybridMaterial` (a
  Majorana fusion, or one of world 10's own named recipe-result wilds) -- doping in an
  impurity is meant to be one real compound's own excitation, not a channel a fusion already
  borrowed from two others. Picking a host only sets `scene.andersonSelection` -- it does not
  touch `andersonDopant`, so browsing a candidate's moveset and backing out doesn't disturb
  whatever's already doped in. Step two looks the host up via `findMaterialByName` and lists
  whichever of its `.moves` aren't already *usable* (`!getBattleMoves(registry).includes(id)`,
  checked before this host becomes the dopant) rather than merely unlearned -- Superposition
  Mode auto-grants every move id to `unlockedMoves` on every world entry, so comparing against
  raw `unlockedMoves` would report every host as teaching nothing there. Picking a move is what
  actually commits: `unlockedMoves.push(id)` (if not already present) and `andersonDopant` are
  set together, then persisted. No `applyPlayerForm` call at all -- see "Player form" above.
  `scene.andersonSelection: string | null` mirrors `majoranaSelection`'s reset rules
  (`create()`/`closeDialogue()`), and `scene.andersonMovePage` (the second step's own pager)
  resets alongside it at every one of those same reset points. Each individual host is its own
  one-time `ANDERSON_DOPE_COST` (35) qumatessence unlock (registry/save
  `andersonUnlockedHosts`, a list of host names), charged and recorded inside
  `learnImpurityMove` -- the same place that already commits `andersonDopant` and the
  `unlockedMoves` append -- rather than at the host-browsing step, so browsing a host's
  moveset and backing out still costs nothing. See the Superposition Mode bullets above and
  DESIGN.md §5 for the pricing rationale.

**Every guardian stands mid-corridor, not at the goal or start.** `GuardianDef.tile` is `'goal' |
'start' | 'middle'`, but every current `WORLD_GUARDIANS` entry uses `'middle'` -- `world/mapgen
.ts`'s `generateWorldMap` computes a `mid: GridPoint` (a forced, verified chokepoint every route
from `start` to `goal` is routed through, not just a point near the geometric middle of one of
several possible routes -- see the `world/` file-tree entry above and DESIGN.md §2)
alongside `start`/`goal`, threaded through `OverworldScene.midTile` and `SavedMapState` the same
way `goalTile`/`startTile` are. Reaching that row (`OverworldScene.maybeReachMiddle`, mirroring
`maybeReachGoal`'s "whole row counts, not one tile" rule) sets `reachedMiddle` and calls
`maybeAutoOpenMiddleDialogue()` -- the counterpart to `maybeAutoOpenGoalDialogue()`/
`maybeReachGoal`, both still used for the goal tile's own panel. `'start'`/`'goal'` remain valid
`tile` values (and `spawnGuardianSprite`'s tile-lookup still branches on all three) purely so a
future guardian could choose them; nothing currently does.

## Lab stations and settings

**The Lab's six reference/settings stations** (`scenes/panels/hubStations.ts`'s
`LAB_STATIONS` array -- `showMovesPanel`/`showStatsPanel`/`showAbilitiesPanel`/
`showGuardiansPanel`/`showTutorialTopics`/`showSettingsPanel`, each taking `scene: HubScene`):
built the same way a guardian panel file takes `scene: GuardianPanelHost` (see "Guardian panels"
above) -- these six only ever run from `HubScene`, since pressing `H` or `Enter` from any
Overworld scene warps straight there (`this.scene.start('Hub')`, no menu/overlay of choices in
between) rather than opening anything mid-world. Each is a pure function of registry/save
state (player stats/moves/passives, `metGuardians`, game settings), not of anything tied to
being mid-world, which is what makes moving them out of `OverworldScene` safe. They follow
`HubScene`'s own `dialogueContainer`/`closeDialogue()` overlay convention (both made public,
not private, on `HubScene` for the same "panel modules living outside the class can't reach a
`private` member" reason `OverworldScene` widens its own dialogue infrastructure), gated so a
station can't open over another already-open panel (`HubScene.addStationRow`'s
`dialogueContainer` check). Each `LAB_STATIONS` entry also carries a `visible(scene)` predicate
-- true unconditionally for Moves/Stats/Tutorial/Settings, and for Abilities/Guardians only
once `passivesUnlocked`/`metGuardians` is non-empty (or `isSuperpositionMode()` is true, matching
`showGuardiansPanel`'s own "list every guardian regardless" treatment in that mode) --
`HubScene.create()` filters `LAB_STATIONS` by this before laying out the room's station rows,
so Abilities/Guardians simply don't appear until there's something to check/revisit there.
`showMovesPanel` lists `getBattleMoves(registry)`
(learned ∩ currently form-compatible, not the raw `unlockedMoves` list) as plain
`<name> -- Pwr N` lines (`moveDisplayName`/`effectiveMovePower`, so a Feynman-leveled move's
name/power both show up here too) -- no
move-class label, no "incompatible" entries; a move the player has learned but can't currently
use just doesn't show up until they transmute into a form that supports it. `showAbilitiesPanel`
is the "check anytime" surface for Franklin's current passive loadout -- its own
dedicated panel (not folded into `showStatsPanel`/its shared `showInfoPanel` body), looping over `data/
passives.ts`'s `PASSIVE_OWNERS` (rather than a hand-written block) to build one
name+description row per owner, labeled via `PASSIVE_OWNER_LABELS` and read from registry
`activePassiveByOwner[owner]`, so a player doesn't have to walk back to either guardian's own
panel just to remember which passive is running (and doesn't have to remember what that passive
actually does either, since the full description shows here too). `showGuardiansPanel` lists
every met guardian (`OverworldScene.guardianRoster()`, a public static id/name/world/`open` list
derived from the private `WORLD_GUARDIANS` table) and, on a row click, calls that guardian's own
`open` callback with `scene` (the `HubScene` itself) directly -- the exact same callback
`WORLD_GUARDIANS` dispatches to when the player walks up to that guardian mid-world -- rather
than warping anywhere. This works because `HubScene` implements `GuardianPanelHost` (see
"Guardian panels" above) with its own copies of the qumatessence readout, `applyPlayerForm`,
`advanceToWorld`, and every per-guardian pagination field, so a guardian's panel has everything
it needs without the player's world/scene/position ever changing just from opening it.

**All eight of the Lab's non-door panels** (the six stations above, plus `HubScene`'s own
`showSavePoint`/`renderMaterialdexPanel`) share one heading color -- `hubStations.ts`'s exported
`LAB_TITLE_COLOR` (`#ffe066`) -- and one centered-content geometry: `hubStations.ts`'s
`labPanelColumns(panelWidth)` returns a fixed `contentCenterX`/`contentWrapW` margined in from
both edges of the panel. A panel's own themed motif (`art/labMotifs.ts`'s `makeQumatexMotif`/
`makeMovesMotif`/`makeStatsMotif`/`makeAbilitiesMotif`/`makeGuardiansMotif`/`makeTutorialMotif`/
`makeSettingsMotif`/`makeSavePointMotif` -- fixed-px art, never run through `ui/text.ts`'s
`fontPx()`/`fontScale()`) is never drawn inside the panel; each `LAB_STATIONS` entry (and
`HubScene`'s own hardcoded Qumatex/Save Point rows) instead carries its motif builder for
`HubScene.addStationRow` to plant beside that station's own button in the room, at a much
smaller fixed size (`STATION_MOTIF_SIZE = 26`) than a motif drawn inside a full panel would
use. A panel whose own row list can grow long (Guardians, up to every guardian in
Superposition Mode) caps its row font scale (`Math.min(fontScale(scene), 1.3)`) rather than
adding a shrink-to-fit loop, the same tradeoff `renderPassiveList`/`showAbilitiesPanel` already
make; `showInfoPanel`/`showTutorialTopic`/`HubScene.showPanel` keep their own shrink-to-fit
loops (floor `9`px) since their body length varies more per instance.

**Story Mode vs. Superposition Mode** (save/registry `superpositionMode`, picked on
`TitleScene`'s title screen via `addModeSelector` -- a two-button picker, not a toggle; Story
Mode is just `superpositionMode: false`, no separate field): Superposition Mode is a
testing/exploration aid, not part of normal progression. Three things key off
`isSuperpositionMode()`:
- `OverworldScene.applySuperpositionLeveling()` runs on every `create()` (covers Continue,
  Bloch teleport, and the Hub door's World-1 jump alike) -- re-levels `playerStats` to
  `enemyStatsForWorld(this.world)` plus a flat `+2`, grants every move (`Object.keys(MOVES)`),
  fully heals, merges every `BUILT_WORLDS` entry into `visitedWorlds` so Bloch's teleport
  hub (gated on `visitedWorlds`, see "Guardians" above) offers every world immediately -- this is
  what makes Bloch alone sufficient for world-to-world movement in this mode; there is no
  separate warp panel -- and unconditionally overwrites registry `discoveredMaterials` with one
  entry per `data/materials.ts`'s `allCrystals()` result, so the Hub's Qumatex (see
  "Qumatex" below) reads as fully discovered. That grant is unconditional rather than
  seed-once like `kondoActiveMove`/`activePassiveByOwner` below, because `discoveredMaterials` is
  a passive discovery log, not a player choice, so there is no prior pick an overwrite could
  clobber. Also seeds registry `kondoActiveMove` to `KONDO_MOVE_IDS[0]` if it's
  still `null` -- granting every move id (including all three Kondo ones) into `unlockedMoves`
  wouldn't otherwise make any of them usable, since `getBattleMoves` filters Kondo's moves down
  to whichever one is active regardless of what's learned (only seeded once, so a deliberate
  pick made via `showKondoPanel` survives every later re-level).
- `HubScene.enterWorld()`/`doorLabel()` branch on `isSuperpositionMode()` to jump straight to
  World 1 (`{ world: 1, regenerate: true }`) instead of `highestUnlockedWorld()`, bypassing
  `rivalDefeated` entirely -- reaching Bloch (who stands at World 2's own middle tile, reachable
  via the walkable world doors) is what then unlocks every other world via the point above.
- `showDresselhausPanel`/`showMajoranaPanel`/`showAndersonPanel` each swap their candidate pool from
  `getDefeatedMaterials()` to `data/materials.ts`'s `allCrystals()` when `isSuperpositionMode()`
  is true, per their own sections above.
- `showBlochHub`/`showDresselhausPanel`/`showMajoranaPanel`/`showAndersonPanel` each check
  `isSuperpositionMode()` directly (not the persisted `blochUnlockedWorlds`/
  `dresselhausUnlockedCrystals`/`majoranaUnlockedResults`/`andersonUnlockedHosts` lists) to
  treat every individual option -- every world, crystal, hybrid result, or host -- as already
  unlocked, the same way Skłodowska-Curie's `showUltimateClassPicker` treats every
  quasiparticle class as already unlocked in this mode -- so toggling the mode back off doesn't
  leave any option permanently free sitting in the save.

**Contextual tutorial tips** (`data/tutorial.ts`'s `TUTORIAL_TIPS`/`TutorialTipId`/
`hasSeenTip`/`markTipSeen`): each tip fires once per save, right at the trigger site for its
own feature, not as one first-run sequence. `OverworldScene.showTutorialTip(id, onClose)` is
the shared entry point for six of the seven (`controls` on Overworld create, `encounter` in
`maybeTriggerEncounter`, `battle` in `startBattle`, `qumatessence` in `maybeCollectToken`,
`guardian` in `openGuardian`, `goal` in `maybeAutoOpenGoalDialogue`) -- it checks `hasSeenTip`,
and either calls `onClose` straight away (already seen) or renders the tip via
`renderTutorialTipPopup` and calls `onClose` once the player dismisses it, so callers just
pass "whatever I was about to do next" and never branch on seen/unseen themselves. The
seventh (`lab`) fires from `HubScene.maybeShowLabTip` instead, reusing that scene's own
`showPanel` rather than `renderTutorialTipPopup`, since the Lab is the one tip that fires
before an Overworld scene has ever been created. Both trigger sites persist through the same
`markTipSeen` + `persistFromRegistry` pair.

**Full tutorial recap** (`data/tutorial.ts`'s `TUTORIAL_PAGES` -- `Object.values(TUTORIAL_TIPS)`,
same tips in a fixed order -- `scenes/panels/hubStations.ts`'s `showTutorialTopics`/
`showTutorialTopic`): a topic menu, not a linear pager -- `showTutorialTopics` lists every
`TUTORIAL_PAGES` entry's own `title` as its own clickable row (same
`dialogueContainer`/`addDialogueButtonAt` overlay convention as every other panel, stroked
cyan `0x5ad9ff`, see `STYLE.md`), so every topic is visible up front rather than reachable only
by paging through the rest. Picking a row calls `showTutorialTopic(scene, index)`, which
renders just that topic's title/body plus a `<- Topics` button back to the menu and a Close
button -- no Back/Next between topics, no `tutorialIndex` state on `HubScene` to track a
current page (each row's click handler closes over its own `index` directly). Only reachable
from the Lab's Tutorial station, not auto-triggered. To add/edit a tip, only `data/tutorial.ts`
needs touching -- both this and the contextual popups above read it generically.

**Qumatex indexes every crystal, not just discovered ones, as a two-column list+detail
panel.** `HubScene.materialdexIndex()` maps `data/materials.ts`'s `allCrystals()` against
registry `discoveredMaterials`; `filteredMaterialdexIndex()` narrows that by
`materialdexTypeFilter` (a `MaterialType` or `'all'`). `renderMaterialdexPanel()` renders the
left column as one clickable row per (filtered) entry -- masked to "???" when undiscovered,
long labels trimmed to an ellipsis against their own measured width (`fitListLabel`) rather
than wrapped -- paginated via `materialdexListPage` once the list outgrows one screen, same
sample-row-measurement technique `OverworldScene.renderPagedButtons` uses. The right column
renders whichever entry `materialdexSelectedName` points at (looked up by name in the
*unfiltered* index, so it stays valid across a list-page flip and only gets reassigned to the
new filtered list's first entry on a type-filter change) -- crystal render, name, physics
blurb, masked the same way when undiscovered. This panel skips the `labPanelColumns` treatment
the other seven Lab panels use (above) in favor of its own two-column list/detail layout; its
own right-column crystal render already is a themed motif, so instead of reusing the station
row's own `makeQumatexMotif` icon (`art/labMotifs.ts`, a small 2x2 grid of tiny faceted gems,
planted beside the Qumatex button out in the room itself) the title line gets a small purple
prism icon of its own (`makeCrystal(this, 16, 0x9a6ad9, 'prism')`) planted just to its left.
Panel height is computed top-down from each
element's actual measured height (`renderMaterialdexPanel`'s running `y`, same pattern as
`hubStations.ts`'s `showInfoPanel`), taking the taller of the two columns before placing the
shared "Close" footer, with the blurb's own font shrinking in whole-px steps (floor `9`) if a
long entry would otherwise overflow.

**Candidate-crystal lists share one pager: `OverworldScene.renderPagedButtons<T>`.** Used by
Dresselhaus's transmute list, both steps of Majorana's and Anderson's combine/dope flows, and Bloch's
destination list -- anywhere Superposition Mode's "every crystal"/"every world" pool can
outgrow one panel. Takes the container/running-`y`/item array/current page/a `maxPerPage`
ceiling/label+onPick callbacks/an `onPageChange` callback (expected to rebuild the whole panel:
set the field, destroy `dialogueContainer`, re-call `showXPanel()` -- same pattern as every
other in-panel action) and returns the advanced `y`. **The actual per-page row count isn't
`maxPerPage` verbatim** -- it measures every candidate's own label for real at the current
`fontScale` (`ui/text.ts`), off-canvas and destroyed immediately after, and packs each page
until the next label wouldn't fit above the panel's own trailing footer, because a fixed
row count overflowed the canvas once the *default* text-size preset (1.5x, not 1x) met a
9-destination Bloch list, and a uniform single-line estimate under-counts a page's real
height once a long, multi-word label (a crystal name, or a guardian-shop row with a cost
suffix) word-wraps to two lines rather than staying on one. The trailing `<- Prev`/
`Next ->`/`Page N/M` row (only rendered once the list needs more than one page) is a single
shared row, not a button row with the page label stacked underneath it -- reclaiming that
row's worth of height is what keeps a guardian whose avatar/intro text already leaves little
slack (Majorana, Anderson) inside the canvas at the largest text-size preset. Each caller owns
its own page field (`dresselhausPage`, `majoranaPage`, `andersonPage`, `andersonMovePage`,
`blochPage`, `feynmanPage`), all reset in both `create()` and `closeDialogue()` the same way
`majoranaSelection` is. Reuse this rather than a bespoke row-count/shrink-to-fit calculation for
any future candidate list that can grow unboundedly.

## Save schema

`data/save.ts`'s `SaveData`: `playerStats: Stats`, `visitedWorlds: number[]`,
`defeatedMaterials: DiscoveredMaterial[]` (written by `BattleScene.endBattle` on an ordinary
wild win, same "not for rivals" rule as `discoveredMaterials`), `playerForm: Material | null`
(round-trips a *whole* `Material` object through `JSON.stringify`/`localStorage`, so the
player's *current* form -- hybrid or not -- survives a reload for free; there's no separate
history list of past Majorana fusions, every visit to his panel picks a fresh pair),
`tutorialTipsSeen:
string[]`, `superpositionMode: boolean` (Story Mode is just its `false` state -- see "Story
Mode vs. Superposition Mode" above), `encounterDensity: number` (one of
`data/settings.ts`'s `DENSITY_PRESETS`, set via the Lab's Settings station),
`musicStyle: MusicStyle` (same station's third row, one of `data/settings.ts`'s
`MUSIC_STYLE_PRESETS` -- which of `audio/music.ts`'s `SCORES`/`SCORES_MODERN`
tables `MusicEngine` draws from, applied immediately via `music.setStyle()`),
`kondoActiveMove: string | null` (which of
`data/materials.ts`'s `KONDO_MOVE_IDS` is currently
usable in battle, `null` until the player picks one via `scenes/panels/kondo.ts`'s `showKondoPanel` -- see
"Guardians" above; the other two bought-but-inactive Kondo moves, if any, still live in the
ordinary `unlockedMoves` list, this field only tracks which one currently passes
`getBattleMoves`' extra filter), `passivesUnlocked: string[]` (every passive ever bought, flat
since passive ids are globally unique across `PASSIVES`) and
`activePassiveByOwner: Partial<Record<PassiveOwner, string>>` (which passive is currently
equipped, per owner -- `data/passives.ts`'s `PassiveOwner`/`PASSIVE_OWNERS`, same "several
unlocked, one active per owner" shape as `kondoActiveMove`, see "Guardians" above),
`moveClassTuning: Partial<Record<string, MoveClass>>` (which quasiparticle a given tunable move
is tuned to, by move id -- shared by Laughlin's two Analytic moves and Skłodowska-Curie's two
Ultimate moves alike, since it's keyed by move id, not owner; an id missing from this map is
"untuned," `data/materials.ts`'s `getTunedMoveClass` falls back to the move's own default
`'phonon'` class), `ultimateClassesUnlocked: Partial<Record<string, MoveClass[]>>` (which
quasiparticle classes have been paid for, per Ultimate move id -- `data/materials.ts`'s
`ULTIMATE_CLASS_UNLOCK_COST`, see "Guardians" above), `rival9Type: MaterialType | null` (World
9's rival's randomly-rolled type, `null` until the player first reaches World 9 --
`OverworldScene.resolveRival9Type` rolls and
caches it via `data/materials.ts`'s `rollRival9Type`, see "Rival/boss fights" below),
`andersonDopant: string | null` (the crystal name currently doped in via Anderson's panel, `null`
until first picked -- see "Guardians" above), `blochUnlockedWorlds: number[]`/
`dresselhausUnlockedCrystals: string[]`/`andersonUnlockedHosts: string[]`/
`majoranaUnlockedResults: string[]` (which individual *options* of each of those four
guardians' abilities have been paid for at least once -- `data/materials.ts`'s
`BLOCH_DESTINATION_COST`/`DRESSELHAUS_TRANSMUTE_COST`/`ANDERSON_DOPE_COST`/
`MAJORANA_FUSE_COST` -- a world number/crystal name/host name/hybrid-result name present in
the matching list is free from then on, one absent still costs qumatessence to pick again; see
"Guardians" above and "Story Mode vs. Superposition Mode" for how Superposition Mode bypasses
these without ever setting them), `moveLevels: Partial<Record<string, 0 | 1 | 2 | 3>>` (Feynman's
move-leveling, §5 -- which level a given move id is currently at, missing entry means 0/never
attempted; `data/materials.ts`'s `getMoveLevel`/`effectiveMovePower`/`feynmanLevelCost`, see
"Guardians" above -- unlike the four one-time-unlock lists just above, Superposition Mode does
*not* bypass this one, since leveling is a knowledge gate, not a currency gate), plus the
earlier fields covered under Registry-then-persist above. `defaultSave()`/
`persistFromRegistry()` are the two places that need touching together for any future field, and
`loadSave()`'s `{ ...defaultSave(), ...saved }` spread keeps a save predating that field
compatible for free -- it just gets the default.

**Renaming or restructuring a field that holds real progress is a different case** from adding
a new one -- the spread above can't carry an old value across to a new key on its own, and
resetting it to default would erase actual play (currency, an unlock list, stats), not just a
cheap-to-redo selection. `loadSave()`'s `MIGRATIONS` array (`data/save.ts`) handles this: each
entry patches a raw parsed save forward by one schema version (`MIGRATIONS[i]`: version `i` ->
`i+1`), run in order from whatever version the save was last written at up to
`CURRENT_SCHEMA_VERSION` (just `MIGRATIONS.length`, so nothing separate needs bumping);
`persistFromRegistry()` stamps that current version onto every save it writes. A migration is
appended, never edited in place, once shipped -- a save could be sitting at any past version.
This is separate from `loadSave()`'s other two safety nets (filtering `unlockedMoves` to ids
still in `MOVES`, resetting `playerForm`/`rival9Type` if their `type` isn't in `TYPE_LOOK`),
which guard against a *reference* going stale inside an otherwise current-shape field -- that
can happen in any version whenever content is renamed, not just at a save-format change, so
those stay permanent and unversioned rather than living in `MIGRATIONS`.

**Gotcha: `TitleScene.create()` copies `SaveData` into the registry field-by-field, not by
looping over the object.** `defaultSave()`/`persistFromRegistry()` being updated for a new
field isn't enough on its own -- `TitleScene`'s `registry.set('<key>', save.<key>)` calls are
a third, separate hand-written list that has to gain the same new field too, or that field
silently stays `undefined` in the registry on every fresh load (a save file itself would still
have the right value, since `loadSave()`'s `{ ...defaultSave(), ...saved }` spread is generic
-- only the registry-seeding step in `TitleScene` is the hand-listed one). Caught the hard way
while wiring up `activePassiveByOwner`: `OverworldScene`/`BattleScene`
both read the *registry*, not `loadSave()` directly, so a field missing from this list reads as
permanently unset in every scene despite `data/save.ts` being fully correct.

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
