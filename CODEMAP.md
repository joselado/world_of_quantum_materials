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
    biomes.ts                  Per-world visual skin (sky, walls, path, decoration, fog, wallTheme)
    crystals.ts                 makeCrystal() -- shared shard/cluster/prism sprite builder, opts.seed
                                  for per-compound jitter (jitterFor) and opts.hybrid for a fused
                                  hybrid look (drawHybridCrystal)
    guardian.ts                   makeNoetherAvatar()
    bloch.ts                    makeBlochAvatar()
    dresselhaus.ts               makeDresselhausAvatar()
    laughlin.ts                  makeLaughlinAvatar()
    majorana.ts                  makeMajoranaAvatar()
    curie.ts                     makeCurieAvatar()
    bohr.ts                     makeBohrAvatar()
    kondo.ts                     makeKondoAvatar()
    anderson.ts                   makeAndersonAvatar() -- disordered-lattice head motif, world 9
    boss.ts                      makeBossCrystal() -- gigantic multi-shard boss avatar at a world's goal
    tokens.ts                   makeToken() -- qumatoken pickup sprite
    attackEffects.ts            playAttackEffect() -- bolt/ring/burst/beam/eruption particle effect;
                                  beam/eruption are ANALYTIC_SHAPES' per-move-id overrides (Curie's
                                  Skyfall Beam/Ground Eruption), every other shape is per-MoveClass
    colors.ts                   shade(), hueShift(), hashSeed()/seededRandom() -- the deterministic
                                  per-compound PRNG jitterFor() (crystals.ts) is built from
  audio/
    sfx.ts                      Procedural sound effects (attack/impact/playGuardianChime)
    music.ts                    MusicEngine, per-scene/per-world tracks (SCORES, keyed
                                  `overworld:${world}`/`battle:${world}`), makeBattleScore()
                                  generates worlds 2-10's battle themes (world 1 is hand-
                                  written), duck() for attack beats
  data/
    types.ts                    Move, Material, MoveClass, MaterialType, CrystalVariant, Stats
    materials.ts                 MOVES, TYPE_LOOK, WORLD_CRYSTALS, WORLD_RIVALS,
                                  PLAYER_MATERIAL, SHOP_MOVE_IDS, ANALYTIC_MOVE_IDS, WORLD_NAMES,
                                  DEFAULT_STATS, getWildPool(), getRival(), compatibleMoves(),
                                  canHost(), getPlayerMaterial(), getPlayerStats(), getBattleMoves(),
                                  enemyStatsForWorld(), statUpgradeCost(), findMaterialByName(),
                                  allCrystals() -- every WORLD_CRYSTALS entry deduped by name, feeds
                                  Dresselhaus/Majorana/Anderson's Superposition Mode candidate pools,
                                  hybridRecipeResult()/HYBRID_RECIPES -- Majorana's named parent-pair
                                  recipe catalog, combineMaterials() -- Majorana's hybrid-material fuser
    passives.ts                   PASSIVES/LAUGHLIN_PASSIVE_IDS/BOHR_PASSIVE_IDS -- Laughlin's and
                                  Bohr's whole-battle passive abilities (id/name/owner/description/cost)
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
```

## Data model (`data/types.ts`, `data/materials.ts`)

- A **Material** is a crystal: `name`, `type` (`MaterialType`), `color`, `variant`
  (shard/cluster/prism/layer/twisted), `maxHp`, `moves` (string ids into `MOVES`), and an
  optional `hybridParents` (both parents' own `color`/`variant`, set only by
  `combineMaterials` -- see below and STYLE.md's "Crystal sprites" section).
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
  §4's "quasiparticle mismatch" 2x). There is deliberately no separate strong/weak
  `TYPE_CHART` + `effectiveness()` stacked on top of this -- don't add one (it would be an
  unplaytested second system) without updating DESIGN.md §3/§4 and STYLE.md's
  battle-log/move-menu sections together.
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
  result -- and spreads that recipe's own authored `Material` (name/type/color/maxHp/moves all
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
- **World sprites.** Wild-encounter crystals, qumatoken pickups, and every guardian's overworld
  avatar (Noether, Bloch, Dresselhaus, and every other guardian alike) all share one `WorldSprite`
  projection/wander/bob system in `OverworldScene` (`updateWorldSprites`) rather than bespoke
  per-kind code -- a new NPC should spawn through the single unified
  `OverworldScene.spawnGuardianSprite` (looked up from `WORLD_GUARDIANS`), not a bespoke
  `spawnXSprite` per guardian.
- **Panel/dialogue UI.** Every overlay (wild encounter, guardian panels, rival gate, Hub's
  Materialdex/Save panels, the Enter-key menu) is the same dark rounded-rectangle-with-stroke
  treatment, with the stroke color signaling the panel's kind: blue-grey `0x444466` = wild
  encounter (`OverworldScene.showEncounter`) and the Enter-key menu/info panels (`0x8fa0c9`,
  a distinct blue-grey so it doesn't collide), gold `0xffe066` = Noether (and its analytic-move
  counterpart, Curie's `showCuriePanel`, at olive `0xc9d84a`), teal `0x4adde0` = Bloch,
  teal-green `0x4ad9a0` = Dresselhaus's transmutation panel, green `0x4fd97a` = Majorana's
  hybrid panel, rust `0xc9884a` = Anderson's impurity-doping panel, red `0xff6666` = rival gate,
  purple `0x9a6ad9` = Hub's `showPanel` (Materialdex/Save), lavender `0xd9a5ff` =
  `OverworldScene.showStoryBeat`'s between-worlds panel, and gold `0xffe066` again (matching
  Curie) for `BattleScene.showAnalyticQuestion`'s in-battle question panel, the one dialogue-style
  overlay that lives in `BattleScene` rather than `OverworldScene`. A new panel should pick a
  stroke color that doesn't collide with these.
- **Guardian avatars.** One builder per guardian in its own file: `art/mentor.ts`'s
  `makeNoetherAvatar()`, `art/bloch.ts`'s `makeBlochAvatar()`, `art/dresselhaus.ts`'s
  `makeDresselhausAvatar()`. Never a shared parameterized builder -- each guardian needs to read as
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
  (`BattleScene.endBattle`, written on an ordinary wild *win*, feeds Dresselhaus's transmutation
  panel). Don't conflate them -- a material can be encountered without being defeated.

## Player form and moves

**Player form.** `PLAYER_MATERIAL` (Silicon) is only the *default* -- the player's actual
current crystal is `getPlayerMaterial(registry)` (`data/materials.ts`), which reads
registry/save key `playerForm` (a full `Material` or `null`). Every scene that draws/sizes/
types the player goes through this rather than `PLAYER_MATERIAL` directly: `BattleScene
.playerMaterial`, `OverworldScene.playerMaterial`, `HubScene`'s crystal. Two guardians write it,
both through the shared `OverworldScene.applyPlayerForm(material)` (sets `playerForm`, clamps
HP down to the new form's `maxHp` if lower, persists, redraws the crystal -- never a full
heal): Dresselhaus's `transmuteInto(name)` looks the target up by name across `WORLD_CRYSTALS` via
`findMaterialByName` (never `WORLD_RIVALS` -- rivals aren't real compounds). Since
`HYBRID_RECIPES`' results are themselves ordinary `WORLD_CRYSTALS` entries (mostly World 10's
pool) rather than synthesized on the fly, a hybrid's name is findable there too -- the one
exception is a `hybridMaterials` save entry from a save file old enough to predate
`HYBRID_RECIPES`, whose name may be a synthesized `"A × B"` placeholder with no matching
`WORLD_CRYSTALS` row. Majorana's `becomeHybrid(material)` is called with an
already-resolved `Material` object rather than a name (either freshly built by
`combineMaterials`, which additionally attaches `hybridParents` for the fused-visual render, or
pulled straight from the `hybridMaterials` save list).
Anderson's `learnImpurityMove` is a third guardian that touches player state but deliberately
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

**Status effects (Kondo's three moves).** `this.playerStatus`/`this.opponentStatus`
(`ActiveStatus | null`, `{ kind: 'screened' | 'localized' | 'decohered'; turnsLeft: number }`)
are battle-only fields, explicitly reset to `null` in `create()` (Phaser reuses the same Scene
instance across `scene.start()` calls, so a field initializer alone doesn't reset them between
battles -- same gotcha `OverworldScene`'s own dialogue-state fields already call out). Three
small per-side multiplier lookups (`statusDamageMultiplier`/`statusVelocityMultiplier`/
`statusCorrelationMultiplier`) feed straight into the existing formulas rather than adding a
parallel damage path: `playerAttack`'s turn-order comparison multiplies each side's Velocity by
its own `statusVelocityMultiplier` before comparing, and `resolveHit`'s `dmg` gains a
`screenedMult` term (attacker's own `statusDamageMultiplier`) alongside a `defenseFactor`
denominator now also scaled by the defender's `statusCorrelationMultiplier`. `resolveHit`'s
`applyOrTickStatus(move, defenderIsPlayer)`, called once near the end of every hit (same spot
`mismatchText`/`critText` are built), does one of two things: if the landing move is one of
Kondo's three (`KONDO_MOVE_STATUS: Record<moveId, StatusKind>`, a fixed lookup -- no
randomness), it replaces the defender's status outright via `setStatus` (one status per side,
never stacked); otherwise it ticks the defender's *existing* status down by one and clears it
once `turnsLeft` hits 0. Since each side is the defender of exactly one `resolveHit` call per
round, this ticks (or applies) exactly once per side per round without any separate
round-boundary bookkeeping. Either branch returns a log-line clause (`STATUS_INFO[kind]
.applyText`/`.expireText`) appended to that hit's own message, the same "stack a clause onto
the existing line" pattern `mismatchText`/`critText` already use. `setStatus` also calls
`renderStatusLabel`, which updates a small always-present-but-usually-empty `Text` pill
(`playerStatusLabel`/`opponentStatusLabel`, positioned just under each side's HP bar) to
`"<Label> (<turnsLeft>)"` or clears it to `''` when there's no active status.

**Passives (Laughlin's/Bohr's abilities).** `this.playerActivePassives`/
`this.opponentActivePassives` (`Set<string>` of `data/passives.ts` ids) are read once in
`create()` from registry/save `laughlinActivePassive`/`bohrActivePassive` and held for the
whole battle -- unlike Kondo's status effects above, a passive has no `turnsLeft`/tick-down
machinery at all, it's just on or off for the battle. `activePassives(isPlayer)` is the
generic per-side lookup every hook below reads (`opponentActivePassives` stays empty today,
kept as its own field rather than hardcoding "player only" so the hooks read symmetrically
off either side, same reasoning `statusDamageMultiplier` etc. already follow). Five of the
six hook directly into `resolveHit`: **Edge Current** softens the mismatch multiplier
(`mismatchMult`, 2x → `EDGE_CURRENT_MISMATCH_MULT` 1.5x) when the *defender* has it active;
**Fractional Guard** adds a `fractionalGuardMult` (0.85) term to the `dmg` formula, also
keyed off the defender; **Correlated Response** arms `this.guaranteedCritNext[isPlayer ?
'player' : 'opponent']` on the defender's side whenever they're crit against while it's
active, consumed (before the ordinary `Math.random() < critChance` roll, not after -- a
natural crit shouldn't burn a guaranteed one) on that side's own very next `resolveHit` call
regardless of which move it is; **Anyon Echo** and **Shared State** both fire after the
primary hit's damage/heal already landed, sharing two small helpers with the ordinary
damage-application code path: `applyDamage(toPlayer, amount)` and `applyHeal(toPlayer,
amount, maxHp)` (both mirror the registry-write/persist-only-for-the-player rule the
original inline branch used, and both call `updateBars()`) -- Anyon Echo re-calls
`applyDamage` for a bonus `Math.round(dmg * ANYON_ECHO_FRACTION)` tick against the same
defender when the attacker's own crit lands with it active, Shared State re-calls
`applyHeal` for `Math.round(dmg * SHARED_STATE_HEAL_FRACTION)` back onto the attacker's own
side. **Nonlocal Correlation** is the one exception that doesn't touch `resolveHit` at all --
it's applied once in `create()`, adding half of `enemyStats.quantumness` onto a *spread copy*
of `playerStats` (`{ ...this.playerStats, correlation: ... }`, never `+=` in place) --
`getPlayerStats(registry)` returns the registry's own live object, so mutating it directly
would permanently ratchet the save's own Correlation stat the next time anything persists
the registry. Each hook's own log clause (`echoText`/`healText`) stacks onto the hit's line
after `statusText`, same "stack a clause onto the existing line" pattern `mismatchText`/
`critText`/`statusText` already use, in that fixed order.

**Battle move menu is sectioned, not one flat list.** `BattleScene.drawMoveMenu(moveIds)`
builds a docked `Container` (field `moveMenu`) on the right of the field from
`getBattleMoves`, split into up to three sections (a local `MoveSection[]`, filtered to only
the ones with at least one usable move) rendered in order: **Attacks** (every `MoveClass`
other than `'analytic'`/`'screening'`), **Analytic** (Curie's moves, `★` tag, own
"right=2x wrong=½x" legend sub-line under its own header), **Screening** (Kondo's
currently-active move, at most one). `addMoveButton(container, moveId, y, btnPx, padY)` is
the shared per-move-button builder (mismatch tag/color/click-handler) both the section loop
and any future caller should reuse rather than duplicating.

Sizing is a two-pass layout: pass one builds every section's header `Text` (label + optional
legend) *unpositioned* purely to measure its real height (`headerTotalH`) -- header font size
is capped well below the text-size setting's own range (`headerScale = Math.min(scale,
1.15)`, base 10px label / 8px legend) rather than scaling all the way to the 2x 'Large'
preset the way the panel title does, since up to three headers now share the same fixed
480px field height 9 move rows already had to fit into on their own. Row height (`rowH`) is
then computed from `rowCount` via `Phaser.Math.Clamp` against `avail` (the field's remaining
height *after* subtracting `headerTotalH`) rather than a fixed constant, since world 10's
'adaptive' type can host every attack `MoveClass` plus `'analytic'` at once (9 moves,
`MOVE_COMPATIBILITY`); the `rowCount <= 7` floor came down from 30 to 20px once headers
started eating into the same budget (a 6-move spinliquid/defect form's 3 headers, or a
6-move supercon/topological form's 2, both used to clamp `rowH` *up* past what was actually
left and overflow the canvas -- see STYLE.md's "Battle move menu" section for the worked
numbers, verified against a live headless-Chromium run at `fontScale` 1/1.5/2). Below
`rowH < 40` the row switches to a smaller font/padding (`compact`) rather than clipping.
Pass two places each header at its final y (now that `rowH` is known) and its own section's
buttons right below it, in lockstep with pass one's own running-`y` shape so there's no
drift between measured and actual layout.

A move whose `class` is `'analytic'` still gets its `★` tag on the button itself (the
2x/0.5x legend text now lives under the Analytic section header instead, see above); its
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
spawns `art/boss.ts`'s `makeBossCrystal` (a fused multi-shard cluster + pulsing aura + orbiting
embers, `BOSS_CRYSTAL_SIZE = 70`) at `goalTile` for every built world's `getRival()` -- purely a
visual landmark via the same `WorldSprite` machinery, no click handler of its own.
`openGoalGuardianPanel()`'s branch on `guardian?.tile === 'goal'` is a permanent no-op (no entry
uses it), so it always falls through to `showGatePanel()`, which is what renders at the goal.

**Progression (Face the Rival/Continue) is exclusive to the goal panel.** `renderShopFooter`
(Farewell + Face-the-Rival/Continue, `showGatePanel`'s only caller) and `renderFarewellFooter`
(Farewell only) are siblings -- every mid-corridor guardian panel (`showNoetherShop`'s two tabs,
`showBlochHub`, `showGuardianLore`, `showDresselhausPanel`) calls `renderFarewellFooter`, never
`renderShopFooter`, so no guardian panel can trigger that world's boss fight without the player
walking to (or seeing) the goal. If a future guardian panel needs a progression action, route it
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

## Guardians

Every guardian has its own avatar builder in its own file: `art/mentor.ts`'s `makeNoetherAvatar`,
`art/bloch.ts`'s `makeBlochAvatar` (wireframe Bloch-sphere head, teal),
`art/dresselhaus.ts`'s `makeDresselhausAvatar` (spin-momentum-locked arrow ring, teal-green),
and one file per remaining guardian (`art/laughlin.ts`, `art/majorana.ts`, `art/curie.ts`,
`art/bohr.ts` -- Bohr-model-atom head, amber, `art/kondo.ts`,
`art/anderson.ts` -- disordered-lattice head motif, world 9). Every guardian spawns through one
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

**Laughlin (world 4), Majorana (world 5), Curie (world 6), Bohr (world 7), Kondo (world 8),
and Anderson (world 9) all have real mechanics**, following the same `open: (s) =>
s.showXPanel()` pattern as Noether/Bloch/Dresselhaus:
- **Laughlin's and Bohr's passive panels** (`OverworldScene.showLaughlinPanel`/
  `showBohrPanel`) both share one helper, `renderPassiveList(container, y, passiveIds,
  unlockedKey, activeKey, reopen)`, parameterized over which guardian's registry keys
  (`laughlinPassivesUnlocked`/`laughlinActivePassive` or `bohrPassivesUnlocked`/
  `bohrActivePassive`) and `data/passives.ts` id list (`LAUGHLIN_PASSIVE_IDS`/
  `BOHR_PASSIVE_IDS`) it's rendering for -- the exact same "still-unbought get a buy
  button, already-bought get a 'Make `<name>` active' button or a dimmed '`<name>`
  (active)' tag" shape `renderKondoMoves` already established, right down to "buying the
  very first one for this guardian auto-activates it, buying a second or third doesn't."
  Unlike Kondo's moves, a passive is never gated by `MOVE_COMPATIBILITY` (the same
  "player-learned technique, not a quasiparticle a crystal has to host" reasoning as
  Curie's analytic moves) -- every passive is always purchasable regardless of current
  form, so neither panel has a "wrong form" empty state to special-case. Each still-unbought
  row also prints the passive's own `description` underneath in a smaller, capped-scale
  font (`Math.min(fontScale(this), 1.3)` for the buy button itself, `1.2` for the
  description) -- both panels have no shrink-to-fit safety net the way `showInfoPanel`
  does, and letting either scale all the way to the text-size setting's uncapped 'Large'
  preset (like every other guardian panel's buttons do) pushed the whole panel's Farewell
  button off the bottom of the canvas the first time this was tried, verified via a live
  headless-Chromium run at every `fontScale` preset. See "Stats and battle resolution"
  below for exactly how each of the six passives hooks into `BattleScene`.
- **Majorana's hybrid-material panel** (`OverworldScene.showMajoranaPanel`) lets the player fuse
  two `defeatedMaterials` into a new `Material` via `data/materials.ts`'s `combineMaterials(a,
  b)`, which spreads whatever `Material` the matching `HYBRID_RECIPES` entry authored
  (name/type/maxHp/moves all fixed there, not computed at combine time) and adds only
  `hybridParents` for the fused-visual render, then becomes it immediately via `applyPlayerForm`
  (see "Player form" above). **Not any two defeated crystals** -- only pairs with a named entry
  in `HYBRID_RECIPES`, keyed by parent *name* rather than main type (`hybridRecipeResult(nameA,
  nameB)` returns the recipe's result, or `undefined` for an unrecognized pair) -- same-type
  pairs are allowed when a named recipe explicitly covers them (e.g. Graphene + Graphene). The
  panel filters both the first-pick list (only crystals with *some* valid partner among the
  other recently-defeated ones) and the second-pick list (only crystals that pair with whichever
  was picked first) through this before ever rendering a button, so an invalid combination is
  never one click away -- `createHybrid` doesn't re-validate, it trusts the panel already
  filtered. A two-step pick (`this.majoranaSelection: string | null`, the first choice, while the
  panel rebuilds for the second) rather than one screen of every valid pair -- reset in both
  `create()` and `closeDialogue()` so a stale first pick can't survive a cancel-and-reopen. Every
  hybrid ever created is appended to the `hybridMaterials` save list (deduped by name -- a
  recipe's result name is fixed regardless of parent pick order, so fusing the same pair twice
  would otherwise list the same hybrid twice) so the panel's own "become again" section can offer
  an earlier one without recombining -- deliberately sourced separately from
  `defeatedMaterials`, so a hybrid can never be fed back in as a combine ingredient (no recipe
  takes another hybrid as a parent, by construction of `HYBRID_RECIPES`).
- **Curie's analytic-move shop** (`OverworldScene.showCuriePanel`/`renderCurieMoves`) mirrors
  `showNoetherShop`/`renderShopMoves` but sells only `data/materials.ts`'s `ANALYTIC_MOVE_IDS`
  (currently `skyfallBeam`/`groundEruption`), which `SHOP_MOVE_IDS` deliberately excludes so
  Noether never also offers them. See `BattleScene.showAnalyticQuestion` (Stats and battle
  resolution, above) for how a purchased analytic move actually plays out in a fight.
- **Kondo's screening-move shop** (`OverworldScene.showKondoPanel`/`renderKondoMoves`)
  mirrors Curie's shop shape but sells `data/materials.ts`'s `KONDO_MOVE_IDS` (three moves:
  `screeningCloud`/`heavyFermionDrag`/`kondoBreakdown`, each tied to one of `types.ts`'s
  `'screening'`-class `MOVES` entries, deliberately excluded from `SHOP_MOVE_IDS`/
  `ANALYTIC_MOVE_IDS`). Two rendered sections instead of Curie's flat list: still-unbought
  moves the player's current form can host (`compatibleMoves`, same afford/dim buy-button
  treatment as every shop) followed by every already-bought Kondo move as its own row -- a
  bought-and-inactive move gets a "Make `<name>` active" button, the currently active one (registry/
  save `kondoActiveMove: string | null`) shows a dimmed "`<name>` (active)" tag instead (no
  click handler), the same dimmed-current convention Dresselhaus's/Majorana's "(current
  form)" rows already use. Buying the first Kondo move auto-activates it (so a purchase is
  never silently unusable); buying a second or third on top of an already-active one doesn't
  -- switching between already-bought moves is always its own explicit click either way, and
  only one can ever be active at a time. The empty state (nothing bought, current form can't
  host `'screening'` at all) names the actual unlock condition ("...come back wearing a spin
  liquid or a defect state") rather than reusing Noether's generic "nothing left to teach"
  line, since for Kondo the gate is almost always "wrong form," not "already bought
  everything." This active/inactive split is a narrow, Kondo-specific special case in
  `getBattleMoves` (`data/materials.ts`): the normal learned-∩-`compatibleMoves` filter runs
  first, then any `KONDO_MOVE_IDS` entry that isn't `kondoActiveMove` is filtered back out
  even though it's still in `unlockedMoves` -- no other move class has (or needs) an
  equip-slot-style mechanic like this. In battle, a screening move landing calls
  `BattleScene`'s `applyOrTickStatus` (see "Stats and battle resolution" below) to inflict its
  one fixed status effect (`KONDO_MOVE_STATUS`, no randomness -- the move id decides the
  effect).
- **Anderson's impurity-doping panel** (`OverworldScene.showAndersonPanel`/
  `learnImpurityMove`) is a two-step pick like Majorana's, but the *result* is different: step
  one picks a host crystal (`defeatedMaterials`, or every crystal in Superposition Mode -- same
  pool source as Dresselhaus/Majorana), step two looks the host up via `findMaterialByName` and lists
  whichever of its `.moves` the player hasn't already learned (`!unlockedMoves.includes(id)`);
  picking one just does `unlockedMoves.push(id)` + persist. No `applyPlayerForm` call at all --
  see "Player form" above. `this.andersonSelection: string | null` mirrors
  `majoranaSelection`'s reset rules (`create()`/`closeDialogue()`).

**Every guardian stands mid-corridor, not at the goal or start.** `GuardianDef.tile` is `'goal' |
'start' | 'middle'`, but every current `WORLD_GUARDIANS` entry uses `'middle'` -- `world/mapgen
.ts`'s `generateWorldMap` computes a `mid: GridPoint` (roughly the corridor's halfway row)
alongside `start`/`goal`, threaded through `OverworldScene.midTile` and `SavedMapState` the same
way `goalTile`/`startTile` are. Reaching that row (`OverworldScene.maybeReachMiddle`, mirroring
`maybeReachGoal`'s "whole row counts, not one tile" rule) sets `reachedMiddle` and calls
`maybeAutoOpenMiddleDialogue()` -- the counterpart to `maybeAutoOpenGoalDialogue()`/
`maybeReachGoal`, both still used for the goal tile's own panel. `'start'`/`'goal'` remain valid
`tile` values (and `spawnGuardianSprite`'s tile-lookup still branches on all three) purely so a
future guardian could choose them; nothing currently does.

## Overworld menus and settings

**Enter-key pause menu** (`OverworldScene.togglePauseMenu`/`showPauseMenu`/`showInfoPanel`):
follows the `dialogueContainer`/`dialogueActive`/`closeDialogue()` overlay convention, gated so
it can't open over another panel. Lives only in `OverworldScene`, not `BattleScene` or
`HubScene`. `showPauseMenu`'s rows are a data-driven array (label + onClick) rather than
hand-placed buttons -- a fixed six rows (Return to Lab, View Moves, View Stats, Guardians,
Tutorial, Settings, Close); keep the data-driven-array shape for any future conditional row
rather than switching to fixed positions. `showMovesPanel` lists `getBattleMoves(registry)`
(learned ∩ currently form-compatible, not the raw `unlockedMoves` list) as plain
`<name> -- Pwr N` lines -- no
move-class label, no "incompatible" entries; a move the player has learned but can't currently
use just doesn't show up until they transmute into a form that supports it. `showStatsPanel`
is also the "check anytime" surface for Laughlin's/Bohr's current passive loadout -- two
terse `Laughlin passive: <name or None>` / `Bohr passive: <name or None>` lines read
straight from registry `laughlinActivePassive`/`bohrActivePassive`, alongside the existing
stat/qumatoken/form lines, so a player doesn't have to walk back to either guardian's own
panel just to remember which passive is running.

**Story Mode vs. Superposition Mode** (save/registry `superpositionMode`, picked on
`TitleScene`'s title screen via `addModeSelector` -- a two-button picker, not a toggle; Story
Mode is just `superpositionMode: false`, no separate field): Superposition Mode is a
testing/exploration aid, not part of normal progression. Three things key off
`isSuperpositionMode()`:
- `OverworldScene.applySuperpositionLeveling()` runs on every `create()` (covers Continue,
  Bloch teleport, and the Hub door's World-2 jump alike) -- re-levels `playerStats` to
  `enemyStatsForWorld(this.world)` plus a flat `+2`, grants every move (`Object.keys(MOVES)`),
  fully heals, and merges every `BUILT_WORLDS` entry into `visitedWorlds` so Bloch's teleport
  hub (gated on `visitedWorlds`, see "Guardians" above) offers every world immediately -- this is
  what makes Bloch alone sufficient for world-to-world movement in this mode; there is no
  separate warp panel. Also seeds registry `kondoActiveMove` to `KONDO_MOVE_IDS[0]` if it's
  still `null` -- granting every move id (including all three Kondo ones) into `unlockedMoves`
  wouldn't otherwise make any of them usable, since `getBattleMoves` filters Kondo's moves down
  to whichever one is active regardless of what's learned (only seeded once, so a deliberate
  pick made via `showKondoPanel` survives every later re-level).
- `HubScene.enterWorld()`/`doorLabel()` branch on `isSuperpositionMode()` to jump straight to
  World 2 (`{ world: 2, regenerate: true }`) instead of `highestUnlockedWorld()`, bypassing
  `rivalDefeated` entirely -- reaching Bloch (who stands at World 2's own middle tile) is what
  then unlocks every other world via the point above.
- `showDresselhausPanel`/`showMajoranaPanel`/`showAndersonPanel` each swap their candidate pool from
  `getDefeatedMaterials()` to `data/materials.ts`'s `allCrystals()` when `isSuperpositionMode()`
  is true, per their own sections above.

**Contextual tutorial tips** (`data/tutorial.ts`'s `TUTORIAL_TIPS`/`TutorialTipId`/
`hasSeenTip`/`markTipSeen`): each tip fires once per save, right at the trigger site for its
own feature, not as one first-run sequence. `OverworldScene.showTutorialTip(id, onClose)` is
the shared entry point for six of the seven (`controls` on Overworld create, `encounter` in
`maybeTriggerEncounter`, `battle` in `startBattle`, `qumatoken` in `maybeCollectToken`,
`guardian` in `openGuardian`, `goal` in `maybeAutoOpenGoalDialogue`) -- it checks `hasSeenTip`,
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
"Tutorial" button, not auto-triggered. `showTutorial(startIndex)` always resets
`tutorialIndex` and re-renders; Back/Next mutate `tutorialIndex` and call `renderTutorialPage()`
again rather than rebuilding the whole scene. To add/edit a tip, only `data/tutorial.ts` needs
touching -- both this and the contextual popups above read it generically.

**Materialdex is paginated.** `HubScene.renderMaterialdexPage` -- `MATERIALDEX_ENTRIES_PER_PAGE
= 2`, `materialdexPage` field reset to 0 on open, Back/Next re-render in place, same shape as
`OverworldScene`'s tutorial paging.

**Candidate-crystal lists share one pager: `OverworldScene.renderPagedButtons<T>`.** Used by
Dresselhaus's transmute list, both steps of Majorana's and Anderson's combine/dope flows, and Bloch's
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
`data/settings.ts`'s `DENSITY_PRESETS`, set via the Enter-menu's Settings panel),
`kondoActiveMove: string | null` (which of `data/materials.ts`'s `KONDO_MOVE_IDS` is currently
usable in battle, `null` until the player picks one via `OverworldScene.showKondoPanel` -- see
"Guardians" above; the other two bought-but-inactive Kondo moves, if any, still live in the
ordinary `unlockedMoves` list, this field only tracks which one currently passes
`getBattleMoves`' extra filter), `laughlinPassivesUnlocked: string[]`/`laughlinActivePassive:
string | null` and the same pair for `bohr` (`data/passives.ts`'s `LAUGHLIN_PASSIVE_IDS`/
`BOHR_PASSIVE_IDS`, same "several unlocked, one active" shape as `kondoActiveMove`, see
"Guardians" above), plus the
earlier fields covered under Registry-then-persist above. `defaultSave()`/
`persistFromRegistry()` are the two places that need touching together for any future field, and
`loadSave()`'s `{ ...defaultSave(), ...saved }` spread keeps old localStorage saves compatible
for free.

**Gotcha: `TitleScene.create()` copies `SaveData` into the registry field-by-field, not by
looping over the object.** `defaultSave()`/`persistFromRegistry()` being updated for a new
field isn't enough on its own -- `TitleScene`'s `registry.set('<key>', save.<key>)` calls are
a third, separate hand-written list that has to gain the same new field too, or that field
silently stays `undefined` in the registry on every fresh load (a save file itself would still
have the right value, since `loadSave()`'s `{ ...defaultSave(), ...saved }` spread is generic
-- only the registry-seeding step in `TitleScene` is the hand-listed one). Caught the hard way
while wiring up `laughlinActivePassive`/`bohrActivePassive`: `OverworldScene`/`BattleScene`
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
