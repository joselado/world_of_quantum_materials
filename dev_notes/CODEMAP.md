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
    HubScene.ts                World 0, static room, up to 7 stations: 2 that always exist
                                 (Qumatex/Door -- door label/click resume-in-place to
                                 highestUnlockedWorld() via canResumeWorld(), tracks
                                 rivalDefeated progress in Story Mode, labeled with the
                                 destination's own name (materials.ts's worldName), pinned to
                                 World 1 in Superposition Mode; the Enter *key* instead resumes
                                 resumeWorld() -- the exact world/position mapState holds,
                                 not necessarily highestUnlockedWorld())
                                 plus up to 5 reference/settings stations (Moves/Stats/Abilities/
                                 Tutorial/Settings, panels/hubStations.ts's LAB_STATIONS --
                                 Abilities filtered out until a first passive is learned).
                                 Progress autosaves, so the room has no save station of its own.
                                 Every met guardian also stands in the room as their own
                                 clickable avatar (spawnGuardianAvatars/guardianSlot, see "Lab
                                 stations and settings" below). No crystal render anywhere in
                                 the room except the player's own (addStationRow builds every
                                 station as a plain text button with an optional small
                                 art/labMotifs.ts icon beside it)
    OverworldScene.ts          Per-world walkable map: movement, encounters, rival gate, shared
                                 dialogue/panel infrastructure (addDialogueButton(At),
                                 renderPagedButtons, renderFarewellFooter) every panels/ file uses.
                                 H and Enter both warp straight to the Hub (scene.start('Hub')) --
                                 no in-world menu
    overworld/                 The corridor's ground plane and air, split out of OverworldScene
                                 (see "Overworld terrain rendering" below). Plain functions taking
                                 a per-frame render context, holding no scene state, the same
                                 shape battle/hud.ts uses
      projection.ts            The grid/camera constants (GRID_W/GRID_H, TILE_SCALE, LANE_CLIP,
                                 DRAW_DISTANCE_TILES, VISIBLE_DEPTH_FRACTION -- the fraction
                                 of it a world sprite is still drawn within, and so the far
                                 edge of the player's field of vision OverworldScene's
                                 respawn placement stays beyond -- CAMERA_BACK_TILES) plus projectTile() and
                                 laneClipAt(). The one place the camera pullback is applied
      sky.ts                   The static backdrop (drawSky: sky gradient, base ground wash,
                                 clouds) and the per-frame atmosphere (drawDepthHaze: the ground
                                 wash, the horizon band, the sky's own graduation into the fog,
                                 and drawDistantSelf's neighbour silhouette), plus
                                 hazeTarget/forwardHazeBlend and the HazeView/AtmosphereView
                                 contexts they read
      terrain/
        types.ts               TerrainKind/OffPathKind/TerrainTile/TerrainPlan, the TerrainView
                                 render context, and the AccentTile/AccentDraw contract every
                                 off-path material is written against
        plan.ts                buildTerrainPlan(TerrainSource) -- the camera-independent read of
                                 the grid: per-tile terrain, farEdgeRow, and the contour trace
        paint.ts               drawTerrain(TerrainView) -- the per-frame projection and painting
                                 of that plan, including the lateral/depth margins, the contact
                                 shadow and the chokepoint glow
        color.ts               groundColor(), the depth haze every ground fill goes through
        decoration.ts          decorateTile(), the per-biome floor motif, and
                                 GROUND_MOTIFS_ENABLED, the default-off switch that decides
                                 whether the walkable floor draws one at all
        materials/             One module per off-path material behind a dispatcher (see
                                 "Off-path terrain materials" below): rock.ts, forest.ts,
                                 columns.ts, deadFloor.ts, charged.ts, ice.ts, shards.ts,
                                 fog.ts, lava.ts, consuming.ts, and index.ts's
                                 TERRAIN_ACCENTS table
    panels/                    One file per guardian's panel UI (see "Guardian panels" below),
                                 e.g. noether.ts's showNoetherShop(), sklodowskaCurie.ts's
                                 showSklodowskaCuriePanel(), anderson.ts's showAndersonPanel() --
                                 passiveList.ts's renderChoiceList() is the shared
                                 buy-list-plus-switch engine franklin.ts calls (via its own
                                 renderPassiveList() wrapper), kept in its own file rather than
                                 folded into franklin.ts itself (see "Guardian panels" below),
                                 tunableMoveShop.ts's hostableClasses()/renderInlineClassPicker()
                                 is the shared inline quasiparticle-picker row-strip laughlin.ts's
                                 and sklodowskaCurie.ts's own two-column panels each render
                                 directly beneath a move's own column (Skłodowska-Curie's own
                                 per-class-unlock pricing is different enough from Laughlin's flat
                                 one-time move purchase that each panel still formats/prices its
                                 own rows, see "Guardians" below), listDetail.ts's
                                 renderListColumn()/listDetailColumns()/fitListLabel()/
                                 insertColumnDivider()/renderDetailCrystalHeader()/
                                 renderMoveDetailHeader()/renderSelfBuffMoveDetailHeader()/
                                 renderStatusAndConfirm()/destroyPanel()/sideBySideColumns() is the
                                 shared detail-pane scaffolding (STYLE.md's "List+detail panels") --
                                 renderListColumn/listDetailColumns back the paginated-left-column
                                 shape HubScene's own Qumatex panel, dresselhaus.ts/anderson.ts
                                 (host-pick step only)/majorana.ts (both pick-a-crystal steps),
                                 noether.ts (Moves tab only)/kondo.ts (its own move-browsing step),
                                 and bloch.ts (its own destination table -- the one caller whose
                                 right side is the persistent Qumatuomi map, art/qumatuomiMap.ts,
                                 rather than a per-selection detail pane) all use, while
                                 sideBySideColumns backs laughlin.ts's/sklodowskaCurie.ts's own
                                 bespoke always-both-visible two-column layout instead (no
                                 candidate list, so neither imports renderListColumn/
                                 listDetailColumns at all). Every one of these panels' own
                                 "which crystal"/"which move"/"which world" detail pane opens
                                 through -- renderDetailCrystalHeader for a crystal-plus-name
                                 header, renderMoveDetailHeader for a looping centered
                                 attack-effect-plus-name one, renderSelfBuffMoveDetailHeader for
                                 the same idea over a rendered player crystal
                                 (kondo.ts's own self-buff moves --
                                 see "Kondo in the overworld" in STYLE.md and
                                 art/moveEffectPreview.ts, above) -- and closes through
                                 renderStatusAndConfirm, the shared cost/status-line-plus-confirm-
                                 button tail. destroyPanel() is the shared teardown every panel
                                 rebuild runs before calling showXPanel again (art/crystals.ts's
                                 killTweensDeep over the whole container, then destroy). And
                                 hubStations.ts holds the
                                 Lab's own six reference/settings stations (see "Lab stations and
                                 settings" below) -- taking scene: HubScene instead of
                                 scene: GuardianPanelHost, since HubScene is their only caller
    BattleScene.ts             Turn-based battle: move menu, damage/turn resolution, attack
                                 effects, log, end-of-battle summary
    battle/
      hud.ts                   Battle-screen layout, split out of BattleScene: the rails/positions/
                                 sizing constants every battle element is placed from (LEFT/RIGHT/
                                 TOP/BOTTOM_RAIL, PLAYER_POS/OPPONENT_POS/BOSS_OPPONENT_POS, the
                                 measured *_HEAD_RISE/BOSS_FOOT_DROP painted-art offsets, HP-bar
                                 dims, MENU_*, TURN_PREVIEW_*, LOG_*), plus the two HUD pieces that
                                 are pure geometry: drawNameplate (one floating name-over-bar plate,
                                 both sides) and drawTurnPreview (the "TURNS" icon row). Plain
                                 functions taking the scene, holding no battle state, the same shape
                                 panels/hubStations.ts uses. The move menu stays in BattleScene --
                                 it reads/writes that scene's paging + turn-lock state and wires up
                                 move buttons, so it's battle behaviour with a layout, not layout
  world/
    mapgen.ts                  generateWorldMap(gridW, gridH, start, world, playerType?) -- dispatches
                                  to generators/world<N>.ts by world number (world 10 additionally by
                                  playerType, see generators/world10.ts), then runs three passes common
                                  to all ten: forceChokepoint (walls off the guardian's row except a
                                  small gap, so the returned `mid` is a true articulation point --
                                  invariant B), narrowGoalPass/openStartMouth (the corridor tapers into
                                  a pass at the goal and out of the same pass at the start), and
                                  deriveRows/scatterTokens (encounter-row sampling + qumatessence
                                  placement, computed from the final walkable grid rather than
                                  something each generator handles itself, and kept out of both
                                  passes via passZoneRows). Retries a failing
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
                                  already touch it, world3.ts/world5.ts), the invariant-B primitives
                                  (forceChokepoint/reachable/verifyChokepoint) mapgen.ts runs centrally,
                                  and the pass taper (narrowGoalPass/openStartMouth/passZoneRows) that
                                  makes world N's entry the same geography as world N-1's exit
      fallback.ts                generateFallbackMap() -- the plain wide wandering corridor with no
                                  per-world motif of its own; mapgen.ts's retry-exhausted fallback, also
                                  the base shape world6.ts/world9.ts build their own motif on top of
      world1.ts .. world10.ts    One file per world's own generator (GeneratedMap: walkable/start/goal/
                                  mid/regionColor/biomeOverride/vortexCores), each implementing that world's own
                                  course-topic motif -- see DESIGN.md §2's per-world table for what each
                                  one is. world10.ts dispatches to whichever of world1-8's own generator
                                  matches the player's current Material.type (data/materials.ts's
                                  getPlayerMaterial), re-triggered live by OverworldScene.applyPlayerForm
                                  whenever the player transmutes/fuses while standing in World 10
  art/
    perspective.ts             Pseudo-3D projection (lane/depth from the camera -> screen point); re-exports
                                  CANVAS_W/CANVAS_H from config/screen.ts since every
                                  scene/panel that needs the canvas size already imports it
                                  from here
    biomes.ts                  Per-world visual skin (sky, off-path ground, path, decoration,
                                  fog, cloud drift, flat-band ramp, wallTheme, distant-self
                                  colour/swallow)
    horizons.ts                Per-world distant-self profiles, their sky extras, and the
                                  separate OVERHEAD_SKIES motifs read from the world stood in
    trees.ts                   The shared tree sprite, drawn by worlds 1 and 8 in two palettes
    shapes.ts                  ellipseSteps(w, h) -- how many points to draw an ellipse with,
                                 bucketed by its on-screen size (see "Ellipse tessellation"
                                 below)
    contours.ts                Smoothed walkable/impassable boundary geometry in tile space --
                                  per-tile ground outline, contact-shadow strips, rim light --
                                  built once per world-state by OverworldScene's cached terrain
                                  pass and only projected per frame
    crystals.ts                 makeCrystal() -- shared shard/cluster/prism sprite builder, opts.seed
                                  for per-compound jitter (jitterFor), opts.hybrid for a fused
                                  hybrid look (drawHybridCrystal), opts.plain to drop the highlight
                                  and sparkle glyphs when the crystal is one piece of a larger
                                  composition; drawShardShape()/drawCubicShape() -- the bare faceted
                                  primitives, exported for boss.ts's golem limbs; killTweensDeep(scene, obj) --
                                  the shared recursive tween-kill every caller about to destroy a
                                  Container runs first (scenes/panels/listDetail.ts's destroyPanel,
                                  franklin.ts's crystal-block re-render, BattleScene's
                                  opponent-crystal swap and turn-preview redraw), since Phaser's own
                                  destroy() leaves tweens targeting a dead object running and the
                                  sparkle/glow tweens handed out here repeat forever
    noether.ts                    makeNoetherAvatar() -- golden robed deity, halo + wide sleeves, world 1
    bloch.ts                    makeBlochAvatar() -- robed figure, wireframe Bloch-sphere head, world 2
    dresselhaus.ts               makeDresselhausAvatar() -- half-crystal transmutation figure, carbon-hexagon head, world 3
    laughlin.ts                  makeLaughlinAvatar() -- wedding-cake quantum Hall droplet + quasihole, world 4
    majorana.ts                  makeMajoranaAvatar() -- figure split into two breathing halves, world 5
    anderson.ts                   makeAndersonAvatar() -- disconnected-fragment scatter, bright localized core, world 6
    feynman.ts                   makeFeynmanAvatar() -- vertex/propagator diagram-construct motif, world 7
    kondo.ts                     makeKondoAvatar() -- small moment figure inside a screening-cloud arc shell, world 8
    franklin.ts                   makeFranklinAvatar() -- figure holding a diffraction-ring detector plate, world 9
    sklodowskaCurie.ts            makeSklodowskaCurieAvatar() -- radiant ray-crowned spire, world 10
    boss.ts                      makeBossCrystal() -- towering humanoid golem boss avatar at a world's goal,
                                  plus the BOSS_SILHOUETTE_TOP/BOTTOM extents its callers lay out around
    tokens.ts                   makeToken() -- qumatessence pickup sprite
    labMotifs.ts                 One small icon builder per Lab station (Qumatex/Door/
                                  Moves/Stats/Abilities/Tutorial/Settings -- see "Lab
                                  stations and settings" below), planted beside that station's
                                  own button in the room (HubScene.addStationRow), fixed-px art
                                  like every other builder in this directory, never run through
                                  ui/text.ts's fontPx()/fontScale()
    attackEffects.ts            The attack-effect engine, and the single entry point every caller
                                  imports from (it re-exports whatever the four modules below
                                  define publicly, so a caller never needs to know which one a
                                  given piece lives in). playAttackEffect() picks the shape --
                                  beam/eruption are ANALYTIC_SHAPES' per-move-id overrides
                                  (Laughlin's skyfallBeam/groundEruption), meteor/nova are
                                  ULTIMATE_SHAPES' overrides (Skłodowska-Curie's ultimateMeteor/
                                  ultimateNova, a 4-6s multi-phase sequence -- see "Stats and battle
                                  resolution" below), every other shape is per-MoveClass. Its own
                                  `level` param (Feynman's MoveLevel, §5, "Stats and battle
                                  resolution" below) escalates the effect into several staggered,
                                  growing repeats via playOrdinaryRepeats/playUltimateRepeats,
                                  only the last of which is wired to the real onImpact/onComplete.
                                  Its own `depthOffset` param (default 0, every BattleScene call site
                                  unaffected) shifts every Graphics object it creates by a fixed
                                  amount -- moveEffectPreview.ts (below) is the one caller that
                                  passes a nonzero value. playTargetEffect() is the same engine's
                                  preview half: the *target's* share of the beat alone, centered on
                                  one point -- meteor/nova and beam/eruption play their own full
                                  sequences (they summon themselves at the target anyway, just
                                  without the windup), a ring collapses onto the centre, and
                                  bolt/burst -- which are nothing but travel -- are left with their
                                  impact shockwave. resolveAttackShape()/attackEffectDurationMs()/
                                  attackEffectTotalDurationMs()/targetEffectTotalDurationMs() are
                                  exported for moveEffectPreview.ts's
                                  own use (below) -- the last two fold the `level` escalation's own
                                  stagger into the single-play duration, the real wall-clock time
                                  until a leveled cascade's last repeat settles
    attackAnchors.ts            EffectAnchor -- where one side of an effect draws, resolved live
                                  on every tween tick rather than copied once. followAnchor(get)
                                  tracks a game object through a thunk to whichever field holds it
                                  (BattleScene's playerAnchor/opponentAnchor; the thunk is what
                                  survives transmuteAdapted replacing opponentCrystal mid-effect),
                                  fixedAnchor(x, y) is a point that never moves (moveEffectPreview.ts's
                                  panel previews), latchAnchor(a) freezes one sample for a
                                  travelling shape's launch-time aim. See "Attack-effect anchoring"
                                  below for the attacker/target independence rule
    attackStyles.ts             EFFECT_STYLE (per-MoveClass color + silhouette), ANALYTIC_SHAPES/
                                  ULTIMATE_SHAPES (per-move-id overrides), resolveAttackShape()
    attackShapes.ts             The single-beat silhouettes and their timings: playWindup (attacker
                                  side), playBolt/playRing/playBurst/playBeam/playEruption,
                                  playImpactShockwave (target side), WINDUP_MS/TRAVEL_MS/IMPACT_MS,
                                  GROUND_DROP
    attackUltimates.ts          Skłodowska-Curie's Ultimate tier: playMeteor/playNova and their
                                  summon->charge->impact->aftermath phase functions,
                                  METEOR_TOTAL_MS/NOVA_TOTAL_MS
    moveEffectPreview.ts         startMoveEffectPreview(params, key?)/stopMoveEffectPreview(key?) --
                                  loops playTargetEffect (above) inside a guardian panel's detail
                                  pane (Noether's Moves tab, Kondo's self-buff step, Laughlin's/
                                  Skłodowska-Curie's own two-column panels, scenes/panels/noether.ts,
                                  kondo.ts, laughlin.ts, sklodowskaCurie.ts's own
                                  renderMoveDetailHeader/renderSelfBuffMoveDetailHeader calls,
                                  scenes/panels/listDetail.ts) rather than a static icon. A caller
                                  passes one point (`params.at`, its own pane's centre) and gets the
                                  target's half of the beat landing there. Plays at a
                                  PREVIEW_DEPTH_OFFSET pushing the effect's Graphics (normally
                                  depth 58-61) above a dialogue panel's own container (depth 100) so
                                  it draws on top of the pane instead of underneath it -- that same
                                  nonzero offset is what marks the objects as a detached preview for
                                  attackFx.ts. `params.level`
                                  (Feynman's MoveLevel) is forwarded straight into playTargetEffect's
                                  own `level`, so a leveled move's preview escalates the same way a
                                  real cast does. Tracks any number of independent, simultaneously-
                                  looping preview *chains* in a `Map<string, PreviewChain>` keyed by
                                  `key` (default `'default'`, what every single-preview caller --
                                  Noether, Kondo -- implicitly uses, unaffected by the multi-chain
                                  support) rather than one module-scoped `current`/`generation` pair
                                  for the whole module -- Laughlin's/Skłodowska-Curie's own two-column
                                  panels are the one case with two chains genuinely running at once
                                  (keyed `laughlin:<moveId>`/`curie:<moveId>`, one per column), so
                                  retuning one column's own move never disturbs the other column's
                                  already-looping chain. Calling startMoveEffectPreview again on the
                                  same key retargets that chain to a different move without needing to
                                  stop it first -- the in-flight play finishes on its own and that
                                  chain's next cycle picks up whatever
                                  its own `current` is by then, so a rapid preview switch never draws
                                  two overlapping plays at once on the same chain. Callers must NOT
                                  call stopMoveEffectPreview()
                                  unconditionally right before a startMoveEffectPreview() on the same
                                  key in the same rebuild (that would clear that chain's `current` and
                                  defeat the retarget) -- only
                                  from a branch that renders no detail pane at all (Noether's Stats tab,
                                  its own empty-forSale state) or a real teardown
                                  (OverworldScene.closeDialogue()/HubScene.closeDialogue(), which call
                                  the no-key form to stop every chain at once). Stopping also wipes
                                  whatever is mid-flight (attackFx.ts's cancelPreviewFx), so closing a
                                  panel takes its animation with it rather than leaving a
                                  multi-second Ultimate sequence playing over the room
    attackFx.ts                  fxGraphics()/fxCounter()/fxDelayedCall()/cancelPreviewFx() -- the
                                  object-creation choke point every attackShapes.ts/attackUltimates.ts
                                  shape draws through, so a *preview* of an effect can be torn down
                                  mid-flight. A nonzero depthOffset means "detached preview" (it is 0
                                  for every BattleScene call site and large for moveEffectPreview.ts's
                                  panel previews) and is the sole condition for tracking anything here
                                  -- a real cast allocates and tracks nothing extra and stays
                                  fire-and-forget, every phase destroying its own Graphics in its own
                                  onComplete. cancelPreviewFx stops tracked tweens
                                  before destroying tracked Graphics: a Phaser tween's stop() fires
                                  onStop, never onComplete, so no phase chained off an onComplete gets
                                  to draw anything new after the cancel
    colors.ts                   shade(), darken(), blend(), hueShift(), hashSeed()/seededRandom() --
                                  the deterministic per-compound PRNG jitterFor() (crystals.ts) is built from
    qumatuomiMap.ts              buildQumatuomiMap(scene, { width, height, discoveredWorlds }) -- a
                                  standalone, hand-drawn Finland-coastline map (a Suomi/"Qumatuomi"
                                  pun) with one circle marker per world (1-10), each tinted with that
                                  world's own art/biomes.ts palette once discovered or rendered
                                  shrouded in mist otherwise (STYLE.md's "Qumatuomi map"); scales its
                                  silhouette uniformly to fit the given width/height. Returns
                                  { container, markers, width, height } -- markers is a { world,
                                  marker: Phaser.GameObjects.Shape }[] (each also carries
                                  setData('world', n)) so a caller can attach its own click
                                  handling/tooltips later; width/height are the actual rendered size
                                  (uniform scale-to-fit is usually smaller than the requested budget
                                  on one axis). Knows nothing about scene.game.registry, travel
                                  costs, or any guardian panel -- scenes/panels/bloch.ts is its one
                                  consumer, wiring its own setInteractive/pointerdown handling onto
                                  each returned marker.
  audio/
    sfx.ts                      Procedural sound effects (attack/impact/playGuardianChime)
    music.ts                    MusicEngine, per-scene/per-world tracks in two selectable
                                  styles (SCORES/"Classic", SCORES_MODERN/"Modern", all keyed
                                  `overworld:${world}`/`battle:${world}`), setStyle(MusicStyle)
                                  picks the table + restarts the current track,
                                  makeBattleScore()/makeModernBattleScore() generate worlds
                                  2-10's (resp. all 10 modern) battle themes (classic world 1 is
                                  hand-written), duck() for attack beats.
                                  The ten overworld scores are one darkening arc keyed to
                                  WORLDS.md's light rule (DESIGN.md §7's "Soundtrack" is the
                                  world-by-world table): C tonic through worlds 1-6 with the
                                  mode draining, a tritone to F# at world 7 that never comes
                                  back. Classic worlds 1, 7 and 8 are hand-written Score
                                  literals because their shape isn't a chord progression plus a
                                  melody contour (7 is a whole-tone canon with no harmony at
                                  all; 8 transforms world 1's own melody); every other classic
                                  overworld comes from makeOverworldScore(), whose optional
                                  knobs (bassMode/padMode/leadOctave/leadWet/mirrorDelayBeats/
                                  extraTracks...) all default to the plain arrangement.
                                  Battle articulation (silenceOpening/turnoverWalk/
                                  addBrassPickups/battleSnarePattern/battleHatPattern/
                                  crashTrack) is applied in makeBattleScore AND again in
                                  world 1's hand-written BATTLE_SCORE -- a change to the battle
                                  feel has to be made in both or world 1 silently diverges from
                                  the other nine. These are separate from kickPulse/snarePulse/
                                  hatPulse/subBassBar/battleIntroSting/chordTones/padVoiceBar/
                                  harmonizeThird, which SCORES_MODERN also uses: fork those
                                  rather than editing them.
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
                                  TUNABLE_MOVE_CLASSES, RIVAL_9_TYPES, WORLD_NAMES/worldName()
                                  -- the latter the "name, falling back to World N" read every
                                  caller showing a world by name uses (the Lab's door station,
                                  Bloch's destination rows, a world's own entry banner),
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
                                  recipe catalog, combinableHybridResults() -- every recipe reachable
                                  from a pool, indexed by result, combineMaterials() -- Majorana's
                                  hybrid-material fuser
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
    materialdex.ts               Per-material (fallback per-type) physics blurb for Qumatex --
                                  MATERIAL_BLURBS/materialBlurb(); HYBRID_FUSION_LORE, a separate
                                  epic-plus-physics blurb per HYBRID_RECIPES result for Majorana's
                                  panel
    save.ts                      localStorage schema + persistFromRegistry()/load()
    tutorial.ts                    TUTORIAL_TIPS (copy + per-topic `unlock`)/visibleTutorialPages() --
                                    contextual + replayable tutorial copy
    settings.ts                    DENSITY_PRESETS/DEFAULT_ENCOUNTER_DENSITY -- wild-encounter density presets,
                                    FONT_SCALE_PRESETS, MUSIC_STYLE_PRESETS/DEFAULT_MUSIC_STYLE,
                                    DIFFICULTY_TIER_PRESETS/DEFAULT_DIFFICULTY_TIER -- B.Sc./M.Sc./
                                    Ph.D. difficulty tier, data/balance.ts's DIFFICULTY_MULTIPLIERS
                                    applied to enemyStatsForWorld
    story.ts                       STORY_BEATS -- per-world Decoherence-arc line shown on advancing worlds --
                                    and WORLD_GOAL_TEXT -- per-world one-liner for the goal-tile banner,
                                    falling back to a generic line for a world with no entry
    worldLore.ts                   WORLD_LORE (per-world 2-page history, shown once per save on first entry)/
                                    RIVAL_TAUNTS (per-world 2-part rival gate taunt) -- worldLoreSeen gating via
                                    hasSeenWorldLore/markWorldLoreSeen
    worldFlavor.ts                  WORLD_FLAVOR -- one short epic-plus-physics paragraph per world, Bloch's
                                    own panel's detail-pane blurb for whichever destination is currently
                                    previewed -- distinct from story.ts's transition
                                    beats and worldLore.ts's once-per-save Decoherence-arc history
  ui/
    text.ts                       fontPx()/fontScale() -- see "Lab stations and settings" below --
                                   and fitProseToBudget(), the shared fitter for authored prose
                                   whose length the layout can't assume (see "Long authored
                                   prose is fitted to the canvas" below)
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

`game/scripts/content-lint.mjs` (`npm run content-lint`) parses the data tables the same
AST way for its consistency checks, and additionally walks every `src/` file's AST for
class properties declared with a definite-assignment `!` and no initializer, flagging any
whose name is never an assignment target anywhere in `src/` -- the `!` is what stops `tsc`
from checking, so an unassigned one reads as `undefined` at runtime with no diagnostic.

`game/scripts/art-sweep.mjs` (`npm run art-sweep`, see DEVELOPMENT.md's "Art-builder input
sweep") is the one script that imports `src/` modules for real rather than parsing them:
it drives the running dev build in headless Chrome and calls every art builder
(`makeBossCrystal`, `makeCrystal`, the `make<Name>Avatar` set, `playAttackEffect`/
`playTargetEffect`) over every input the data tables admit, asserting no throw. It exists
because `BattleScene.transmuteAdapted` is the only runtime path that feeds a randomly
picked `Material` into an art builder, so any input a builder can't handle surfaces at
World 10's Adapted and nowhere else.

## Data model (`data/types.ts`, `data/materials.ts`)

- A **Material** is a crystal: `name`, `type` (`MaterialType`), `color`, `variant`
  (shard/cluster/prism/layer/twisted), `moves` (string ids into `MOVES`), an optional
  `shortName` (a short chemical-formula/acronym form, e.g. "MnO", "YIG" -- only set where one's
  genuinely worth authoring; `materials.ts`'s `materialDisplayName()` is the one consumer today,
  Qumatex's "Name (ShortName)" line), and an optional `hybridParents` (both parents' own
  `color`/`variant`, set only by `combineMaterials` -- see below and STYLE.md's "Crystal
  sprites" section). No `maxHp` field -- HP is never intrinsic to a crystal, see "Max HP" below.
- `crystal(name, type, moves, shadeStep?, variantOverride?, shortName?, colorOverride?)` is the
  `WORLD_CRYSTALS`/`WORLD_RIVALS` row builder -- adding a `shortName` to an existing call while
  leaving `shadeStep`/`variantOverride` at their defaults means passing `undefined` for those
  positionally rather than omitting them (matches the existing pattern for `shadeStep` alone).
  `colorOverride`, when given, replaces the whole `shade(look.color, shadeStep * 18)` computation
  with that exact color -- every `WORLD_RIVALS[1-8]` entry uses it, since none of their
  lore-described looks (a specific real-world hue/darkness) reduce to "the type's base color,
  brightened by a multiple of 18%." Those calls build the override with `shade()`/`darken()`/
  `blend()`/`hueShift()` (`art/colors.ts`) over a raw `TYPE_LOOK[type].color` hex literal rather
  than a `TYPE_LOOK[type].color` property read, and never a bare negative-number literal (use
  `darken(color, amount)`, not `shade(color, -amount)`) -- both `scripts/content-lint.mjs` and
  `scripts/gen-docs.mjs` parse this file with the TypeScript compiler API rather than importing
  it (materials.ts pulls in Phaser at module scope) and walk every `crystal()` call's arguments
  as literal AST nodes; their literal-reducers don't handle a `PropertyAccessExpression` or a
  `PrefixUnaryExpression`, only literals and calls/`new` built from those.
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
  shape/color (`art/attackStyles.ts`'s `EFFECT_STYLE`) and `MOVE_COMPATIBILITY`; `power`
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
  family (`WORLD_RIVALS[1-8]`'s golems opt out of this via `colorOverride` instead, see
  `crystal()`'s own entry above), *and* (rendering-side, not stored on the `Material` itself) `art/crystals.ts`'s
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
  A `WorldSprite` carries two vertical offsets and they mean different things: `size` is how far
  its art reaches *above* its container origin (what the name label rides on), and `foot` is where
  its own ground contact sits *below* that origin. `updateWorldSprites` lands `foot` on the
  projected centre of tile `(x, y)`, so every landmark stands on its tile the way the player's
  avatar does. Art that carries a contact shadow exports the offset it drew that shadow at
  (`art/boss.ts`'s `BOSS_FOOT`, `art/door.ts`'s `DOOR_FOOT`) rather than the caller guessing;
  art that deliberately hovers (a qumatessence cloud, a guardian adrift) passes `foot: 0`. The
  player's avatar is not a `WorldSprite` -- it is drawn at one fixed screen position -- but obeys
  the same rule via `CAMERA_BACK_TILES`: the camera sits that far behind the player's tile, and
  `PLAYER_GROUND_Y` is the projection of the player's own tile centre, so the fixed avatar and
  the scrolling ground agree on which tile the player occupies. Every depth handed to
  `projectTile` is measured from the player's tile, which is where that constant gets applied;
  a new caller should not add it itself.
- **Panel/dialogue UI.** Every overlay (wild encounter, guardian panels, rival gate, Hub's
  Qumatex panel, the Lab's own six stations) is the same dark rounded-rectangle-with-stroke
  treatment, with the stroke color signaling the panel's kind: blue-grey `0x444466` = wild
  encounter (`OverworldScene.showEncounter`) and the Lab's Moves/Stats/Abilities/Settings
  stations (`0x8fa0c9`, a distinct blue-grey so it doesn't collide), gold `0xffe066` = Noether, teal `0x4adde0` =
  Bloch, teal-green `0x4ad9a0` = Dresselhaus's transmutation panel, blue-violet `0x6a7fff` =
  Laughlin's Analytic shop, green `0x4fd97a` = Majorana's hybrid panel, rust `0xc9884a` = Anderson's
  impurity-doping panel, amber `0xffa64a` = Feynman's move-leveling panel (and its own
  question-streak sub-panel), red `0xe86a44` = Kondo's
  self-buff shop, purple `0xa878c9` = Franklin's passive panel, olive `0xc9d84a` =
  Skłodowska-Curie's Ultimate shop, red `0xff6666` = rival gate (`showRivalEncounter`'s
  two-part taunt), purple `0x9a6ad9` = Hub's
  `showPanel`/Qumatex, lavender `0xd9a5ff` = `OverworldScene.showStoryBeat`'s
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
  guardian met mid-walk) and `HubScene` (the same guardian reopened by clicking their own
  avatar in the Lab, `HubScene.spawnGuardianAvatars`) implement it, so a guardian's
  panel renders identically -- same shop, same state, no scene transition -- regardless of
  which of the two scenes the player actually opened it from. A panel-specific helper only that
  one guardian calls (e.g. Noether's `renderShopTabs`) moves
  into the same file as a plain (non-exported) function taking `scene` as its first param; a
  helper more than one guardian calls (or written generically enough that a future guardian
  plausibly could) gets its own file under `scenes/panels/` instead rather than living in either
  guardian's file -- `passiveList.ts`'s `renderChoiceList` (the shared "buy several, only one
  active, switch by revisiting" engine Franklin's passive kit sells, through its own thin
  `renderPassiveList` adapter over its own `passivesUnlocked`/`activePassiveByOwner` registry
  keys) is the current example, kept in its own file even with a single caller today since a
  future guardian selling another flat, non-previewable "buy several, equip one" kit could reuse
  it the same way. `listDetail.ts`'s own `renderListColumn`/`renderMoveDetailHeader`/
  `renderSelfBuffMoveDetailHeader`/`renderStatusAndConfirm`/`insertColumnDivider`/
  `renderListColumnFooter`/`destroyPanel`/`sideBySideColumns` (see the file-tree entry above) is the
  genuinely multi-caller case, shared today by Dresselhaus/Anderson/Majorana/Noether/Kondo/
  Feynman's own
  panels plus HubScene's Qumatex panel (the paginated-left-column shape), by Laughlin's/
  Skłodowska-Curie's own panels (the bespoke always-both-visible two-column shape), and -- for
  `insertColumnDivider`/`destroyPanel`, which are about panel chrome rather than the list+detail
  split itself -- by Franklin's own crystal-beside-list panel too. Both
  Laughlin's and Skłodowska-Curie's panels also share `tunableMoveShop.ts`'s
  `hostableClasses`/`renderInlineClassPicker` -- the inline quasiparticle-picker row strip each
  renders directly beneath a move's own column, written generically (any move id, filtered to
  whatever the player's current form can host via `canHost`; caller supplies its own row
  labels/afford state) rather than folded into either guardian's own file, the same shape a
  future guardian selling another tunable move could reuse. Their pricing models still differ --
  Skłodowska-Curie's per-class-unlock cost is fundamentally different from Laughlin's flat
  one-time move purchase (see "Guardians" below) -- so each panel keeps its own
  `buyLaughlinMove`/`retuneLaughlinMove` or `pickUltimateClass` commit logic; only the picker's
  own row-packing/rendering is shared.
  Genuinely cross-cutting dialogue infrastructure -- `addDialogueButton(At)`,
  `renderPagedButtons`, `renderFarewellFooter`/`renderCancelFarewellFooter` (the latter's
  two-button "Never mind"/"Farewell" row, for a guardian panel with a pending two-step pick --
  Anderson's dope-in choice), `closeDialogue`, state accessors like
  `getUnlockedMoves`/`getDefeatedMaterials`/`getVisitedWorlds`/`isSuperpositionMode`, `world`/
  `advanceToWorld` (Bloch's own travel action), every guardian's
  per-panel pagination/selection
  field (`shopTab`, `blochPage`, `dresselhausPage`, `majoranaPage`,
  `andersonPage`/`andersonSelection`/`andersonMovePage`, `feynmanPage`/`feynmanPreview`,
  `noetherMovePage`/`kondoMovePage`), each list+detail
  crystal-, move-, or (Bloch's own) world-pick step's own transient "which row is currently
  previewed but not yet
  committed" field (`dresselhausPreview`, `andersonHostPreview`, `majoranaPreview`,
  `noetherMovePreview`/`kondoMovePreview`/
  `blochPreview` -- the last one `number | null`, a world number rather than a
  crystal/move name string -- distinct
  from `andersonSelection` above, which holds the already-*committed* host choice; Majorana/
  Kondo/Bloch have no such committed-choice field of their own, since each
  panel is a single browse step and its own preview field alone -- holding the previewed
  *hybrid result's*/*move's*/*world number's* name -- drives its whole detail (or, for Bloch,
  status/confirm) pane (Kondo's own committed choice,
  which of its three moves is actually usable in battle, lives in registry/save
  `kondoActiveMove` instead, written by the detail pane's own confirm button -- the same
  "browsing is free, committing is the confirm button" split every other list+detail panel
  uses -- with Superposition Mode's `applySuperpositionUnlocks` additionally seeding it to a
  random one of the three while it's still unset)) -- Laughlin's and Skłodowska-Curie's own
  panels have no pagination/preview field of their own at all, since each always renders both of its two fixed moves at once rather than
  browsing a candidate list -- and the player-form
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
  shop/dialogue UI) -- the avatar builder only draws the little floating figure, used by
  the panel (for its header portrait), by `OverworldScene.spawnGuardianSprite` (the
  wandering overworld landmark), and by `HubScene.spawnGuardianAvatars` (the clickable figure
  standing in the Lab), each at its own `scale`.
- **Attack-effect anchoring: each side resolves its own position, live.** `playAttackEffect`'s
  `from`/`to` are `EffectAnchor`s (`art/attackAnchors.ts`), not copied points, and every draw
  function reads `.x`/`.y` off one of them on every tween tick. So the attacker's half of an
  effect (`playWindup`) and the target's half (`playImpactShockwave`, `playBeam`,
  `playEruption`, every meteor/nova phase) are each computed from one crystal alone, with
  nothing shared between them -- move either crystal and its own half follows on its own.
  `BattleScene` holds one anchor per side (`playerAnchor`/`opponentAnchor`, built with
  `followAnchor(() => this.playerCrystal)` -- a thunk to the *field*, so `transmuteAdapted`
  replacing `opponentCrystal` mid-effect keeps being tracked), and passes them to both
  `resolveHit` and `resolveSelfBuff` (which passes the caster's own anchor as both `from` and
  `to`). The one place information legitimately crosses sides is *aim*: a travelling shape
  (`playBolt`/`playBurst`) latches its origin once at launch (`latchAnchor`) while its
  destination stays live, and `playRing` samples both once to place its origin. Anything new
  that positions a battle effect relative to a crystal should take an anchor the same way
  rather than reading a fixed field coordinate -- `PLAYER_POS`/`opponentPos` stay what the
  static field furniture (HP bars, ground shadows, where a crystal is first placed) is laid
  out from, not what effects follow.
- **Attack effects keyed by MoveClass**, not by move id -- adding/removing a move never touches
  the shape/timing code, only adding/removing a whole `MoveClass` does (update `EFFECT_STYLE` in
  `art/attackStyles.ts` and `MOVE_COMPATIBILITY` in `data/materials.ts` together). Two
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
past one back from, every visit to Majorana recomputes the reachable-hybrid list from scratch.
Anderson's `learnImpurityMove` is a third guardian that touches player state but deliberately
*doesn't* go through `applyPlayerForm` at all -- it only appends a move id to `unlockedMoves`,
leaving `playerForm` untouched, since the whole point of the impurity-doping mechanic is
borrowing one move without becoming (or fusing into) anything. `learnImpurityMove` is also the
one place a deliberate pick writes registry/save key `andersonDopant`
(`scenes/panels/anderson.ts`), replacing whatever was doped in before -- only one impurity at a
time (in Superposition Mode `applySuperpositionUnlocks` additionally seeds that key to a random
non-hybrid crystal while it's still unset); merely picking a host to
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

**Stats** (`data/types.ts`'s `Stats`, `data/materials.ts`/`data/balance.ts`): `quantumness`/
`velocity`/`correlation`, base `1` each (`BASE_STAT`/`DEFAULT_STATS`), capped at `100`
(`MAX_STAT`) -- Noether's shop (`scenes/panels/noether.ts`'s `renderShopStats`) refuses to sell
a stat past that, showing it as maxed instead. Player stats live in registry/save key `playerStats`, grown
via that same shop (cost `statUpgradeCost(current, stat)` per +1 point, the same rate for all
three -- `CORRELATION_COST_MULTIPLIER` is `1`, kept as its own named constant in case a future
formula change reopens the gap that once justified pricing Correlation steeper). Opponent stats
are never stored per-material -- in Story Mode, `enemyStatsForWorld(world, difficultyMultiplier)`
(`data/balance.ts`) computes them fresh at battle start (`BattleScene.create`), scaling by a
two-phase curve, gentle through worlds 1-3 and steeper from world 4 on
(`EARLY_GROWTH_PER_STEP`/`LATE_GROWTH_PER_STEP`, see that function's own comment for the exact
rates and the reasoning behind the two phases); in Superposition Mode (every player stat already
pinned to `MAX_STAT`, so there's no per-world climb left to track on the opponent's side either),
`superpositionEnemyStats(difficultyMultiplier)` returns one flat baseline
(`SUPERPOSITION_BASE_ENEMY_STAT`) shared by every world instead. Both apply the active difficulty
tier's own multiplier on top (`DIFFICULTY_MULTIPLIERS`, read live off registry `difficultyTier`,
the Lab's Settings station). Left fractional (never rounded) here -- an opponent's stats are never
shown to the player as a number, only felt through hit chance/damage/turn order -- and
`BattleScene.create` rounds them only for an ordinary wild, whose `rollEncounterFactor()` roll
(+/-15%) scales the baseline first; a rival's are used exactly as returned. The player's own
`playerStats` never come off this curve at all: Story Mode grows them a whole point at a time
through Noether's shop, and `applySuperpositionUnlocks` pins each of them to `MAX_STAT` outright.

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
through: crit chance from the attacker's Quantumness (linear from 1% at `BASE_STAT` to 100% at
`MAX_STAT`, `critChance`), incoming damage scaled by the defender's Correlation (`defenseFactor`,
a concave climb from 0% to a 90% cap -- see "Stats" above), and a `2x` "quasiparticle mismatch"
multiplier from
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
by the slower side's, and `fasterHits` is `Phaser.Math.Clamp(Math.floor(ratio), 1, MAX_MULTI_HIT)`
(`data/balance.ts`, `5`) -- the slower side always gets exactly one hit. A tie keeps the player going first, one hit each, same
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
own pill too, built inside `scenes/battle/hud.ts`'s `drawNameplate` from its `passiveText`
option and laid out as the last row of that plate's bottom-anchored stack, directly below the
side's status pill (its height counts toward the stack height the plate shrinks its name down
to fit into the room above the crystal's head) -- since the
set never changes mid-battle there's no tick-down render function like `renderStatusLabel`,
the pill's text (`passivePillText`, `PASSIVES[id]?.name` joined with `·` for the 0-2 entries a
side can hold, `?.` guarding against a stale id from an old save) is built once and passed
into `drawNameplate` as that plate's last stack row, and the `Text` object isn't kept as a
field, unlike `playerStatusLabel`/`opponentStatusLabel` (those are fields because
`renderStatusLabel` reads them back later; nothing reads the passive pill back). It uses
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

**A leveled move fires its animation as several staggered, growing repeats instead of once**
(Feynman's move-leveling, §5, `data/materials.ts`'s `MoveLevel`/`getMoveLevel`) -- purely
presentational, since `resolveHit`'s own `power`/`dmg` already fold in the real
`MOVE_LEVEL_MULTIPLIERS` bump once, upstream of any of this. `resolveHit` computes `level =
isPlayer ? getMoveLevel(this.game.registry, moveId) : 0` (an opponent's copy of the same move id
never carries a level) and passes it as `playAttackEffect`'s last param on both its ordinary and
Ultimate call sites, and `resolveSelfBuff` does the same for Kondo's three self-buff moves (also
leveled by Feynman, `kondoMitigationFraction`). Inside `art/attackEffects.ts`,
`playOrdinaryRepeats`/`playUltimateRepeats` fire `LEVEL_TRIGGER_COUNTS[level]` (1/2/3/4) copies
of the single-hit beat, each `LEVEL_TRIGGER_SCALES` bigger than the last and staggered by a
shape-family-specific delay (see STYLE.md's "Attack effects" for the exact numbers) -- only the
LAST copy is wired to the real `onImpact`/`onComplete` a caller passed in; every earlier copy
gets a no-op for both. This is what keeps a leveled Ultimate's `checkEndOrContinue` (folded into
`onComplete` above) firing exactly once regardless of trigger count -- wiring it to every repeat
instead would release `turnLock` (and could call `endBattle`) more than once per move. For an
ordinary (non-Ultimate) move this repeat-count is lower-stakes structurally: `applyResult()`/
`checkEndOrContinue()` already run synchronously right after `playAttackEffect` returns, not
gated on any callback from it (this section's own opening paragraph), so how many times the
animation itself fires can never affect real damage/turn-state for that path either way.

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

Sizing: `drawMoveMenu` runs its own header/pager/legend layout twice -- a throwaway
measurement pass (destroyed immediately) that exists only to learn the current page's real
content height, then the same layout again for the real, permanently-positioned elements --
because the panel is bottom-anchored (`menuTop = MENU_BOTTOM - height`, floored at
`MENU_MIN_TOP` -- derived from the boss golem's own measured painted feet, so it can never
grow up into the opponent's cluster) rather than
built down from a fixed top the way a top-anchored panel could measure and place in one pass.
The header `Text` (label + page indicator + optional legend) is capped well below the
text-size setting's own range (`headerScale = Math.min(scale, 1.15)`, base 12px label / 8px
section legend), and the panel's own bottom legend strip is capped the same way (`chromeScale
= Math.min(scale, 1.35)`, matching `rowH`'s own cap below) -- letting either scale all the way
to the 2x 'Large' preset would eat directly into the row budget; the pager arrows render at a
larger px than the header label (`arrowPx`), so the header's own row advances by
`Math.max(headerLabel.height, pagerRowH)`, not the label's height alone, or the taller arrows
would bleed into the first move row. Row height (`rowH`) is computed from the fixed vertical
band the panel may occupy (`MENU_MIN_TOP` down to `MENU_BOTTOM`) minus the
chrome above, divided by the current page's `rowCount` (never more than `MOVE_MENU_MAX_ROWS`)
via `Phaser.Math.Clamp` against a `20`px floor and a scale-scaled `maxRowH` ceiling. Each
button's font size (`btnPx`) starts at `Math.min(desiredPx, fitPx)` (`fitPx` derived from
`rowH`, assuming a label wraps to at most 2 lines), then `drawMoveMenu` measures every label
on the page with a throwaway `Text` object's `getWrappedText()` and shrinks `btnPx` in
whole-pixel steps, uniformly across the page, until none of them actually wrap past 2 lines --
catches a long tuned quasiparticle name (e.g. "Heavy Fermion Meteor") stacked with a `★★★
!!2x` tag, which `fitPx`'s purely-vertical budget alone doesn't account for, without ever
letting a label reach a 3rd line the row-height math has no room for. Each button is drawn
centered in its own row band (`addMoveButton` takes the band's center y, origin `(0.5, 0.5)`)
rather than pinned to its top edge, so a page with slack spreads it evenly instead of pooling
it all under the first button.

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
same `art/biomes.ts` table `OverworldScene`'s corridor uses) -- the eased sky wash, the four
Catmull-Rom ridgeline layers (`drawRidge`), the ground gradient/mist, the `wallTheme`-keyed
color grade (`drawColorGrade`), the drifting haze bands (`drawHazeBands`), the corner vignette
(`drawVignette`), the decorative crystal outcrops, and the ground tufts all derive from the
biome's `skyTop`/`skyBottom`/`hillColor`/`ground`/`path`/`fogTarget` fields via
`shade()`/`blend()`; battle-specific tints are always derived in `BattleScene` from those
shared fields rather than stored as extra `Biome` fields, so retuning the battle arena never
shifts the overworld's palette. See STYLE.md's "Battle backdrop" section for the visual
rules. Any future per-biome visual field added to `Biome` should flow through here too if it
should affect the battle arena, not just the overworld.

**`create()` draws the entire backdrop before any combatant exists**, so display-list position
from `opponentCrystal` onward is the seam between "what is drawn behind" and "what has to read
against it". `scripts/greyscale-check.mjs` (DEVELOPMENT.md's "Checking arena legibility") uses
exactly that seam to capture a backdrop-only frame, which is what lets it measure gameplay
against its own background without importing any palette data. Keep new backdrop drawing
inside `drawBackground()` rather than after the combatants; the check asserts the seam still
holds on every run and reports a broken harness rather than silently measuring the wrong
thing, but the assertion is a tripwire, not a fix.

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
spawns `art/boss.ts`'s `makeBossCrystal` (a humanoid golem outline fused from many grain shards,
with lit grain-boundary seams, a contact shadow and ground glow at its feet, and rising heat
sparks -- `BOSS_CRYSTAL_SIZE = 78`) at `goalTile` for every built world's `getRival()` (via
`OverworldScene.getWorldRival()`, see below), for as long as that world's rival is undefeated --
purely a visual landmark via the same `WorldSprite` machinery, no click handler of its own. The
`WorldSprite.size` it pushes is `BOSS_CRYSTAL_SIZE * BOSS_SILHOUETTE_TOP` rather than the bare
size, since that field only ever drives the name label's own offset and the golem's head reaches
higher above its center than any other landmark's art does; its `foot` is
`BOSS_CRYSTAL_SIZE * BOSS_FOOT`, the offset `makeBossCrystal` pooled its own contact shadow at.
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
rebuilding `opponentCrystal`, rebuilding the opponent's nameplate through `drawOpponentPlate()`
(whole, not retitled -- the plate is a one-shot fitted layout, see STYLE.md's "Nameplates")
and logging the change. Both rebuilds happen
inside a tween's `onComplete`, i.e. inside Phaser's own game step, so anything either throws
kills the `requestAnimationFrame` loop and freezes the canvas rather than just stalling the
turn; `component-check`'s Test 4d drives this path once per move class and watches
`game.loop.frame` for exactly that. `this.wild.moves`
(its actual attack moveset) is never touched by this -- only its defensive identity is
dynamic; HP was never tied to its identity in the first place (`opponentMaxHp`, see "Max
HP" below, stays fixed for the whole battle).

**Progression (Face the Rival/Continue) is exclusive to the goal panel.** `renderShopFooter`
(Farewell + Face-the-Rival/Continue, `showGatePanel`'s only caller) is the only footer helper that
offers a progression action. Every mid-corridor guardian panel closes with a plain Farewell
instead -- `renderFarewellFooter` for a full-width row, `renderListColumnFooter` for the
list+detail panels that put it in the left column -- and none of them calls `renderShopFooter`,
so no guardian panel can trigger that world's boss fight without the player walking to (or
seeing) the goal. If a future guardian panel needs a progression action, route it
through `showGatePanel`, not by reaching for `renderShopFooter` directly.

**Overworld terrain rendering.** Painting the corridor floor splits in two, and new terrain work
belongs on one side or the other. `scenes/overworld/terrain/plan.ts`'s `buildTerrainPlan(src)`
(reached through `OverworldScene`'s memoizing `terrainPlan()` accessor) reads the grid
(`walkable`/`regionColor`/`biomeOverride`/`vortexCores`/`flowerMap`/`midTile`) and classifies every
tile into a `TerrainTile`: its kind (one per off-path material, resolved from the biome's own
`wallTheme` by `offPathKindOf`, which is the single resolution both the plan and the lateral margin
use), its resolved `Biome`, its region tint, whether it carries decoration or the
guardian-chokepoint highlight, and whether it is a `vortexCore` -- a tile world 5's generator
placed as one and the finished grid still has blocked, which `materials/ice.ts` draws as a pit.
That last one comes down from the generator rather than being recognised from the shape, and
deliberately so: a blocked tile ringed by walkable ground is also what an ordinary corridor pinch
and a forced chokepoint's wall look like, so inference draws pits where the world has none and
misses the ones it is named for. A region tint *colors* its biome's material rather than replacing it:
the Edge Cliffs' two dead domain hues are its sunken floors, and that world needs the tint and the
crystalline stipple at once. That pass is camera-independent, so it covers
the whole grid rather than just the visible window -- a shape spanning the window edge stays one
continuous shape -- and the whole `TerrainPlan` (tiles, `farEdgeRow`, contours) is cached in
`OverworldScene.terrainPlanCache` for as long as the grid stands
still. The same pass also traces the contours via `art/contours.ts`'s
`buildContourGrid`, which follows the walkable/impassable boundary on the tile lattice and smooths
it (Laplacian on the lattice corners, then Catmull-Rom through them) with no bias to either side,
so along a straight run the drawn edge sits on the grid line the movement grid itself collides
against. `MAX_OFFSET` (`sqrt(2)/4`) caps how far a corner travels, radially rather than per axis:
that is simultaneously the clearance the curve keeps from every tile centre -- the margin an
entity standing on a tile gets -- the travel a 45-degree staircase needs to reach a clean
diagonal, and small enough that a deformed tile polygon cannot fold over itself. It
hands back per-tile ground-plane geometry in tile space: a curved `outline` (wound like the plain
quad, so the two are interchangeable at the draw call), `shadow` strips for the contact shadow at
the junction, and the walkable side's `rim` polyline. Both tiles sharing a boundary reference the
same curve points, so the two fills abut exactly rather than overlapping or leaving a sliver. A
tile away from any boundary gets no entry at all and is drawn as its plain projected quad. That
trace is the expensive part of the pass (a few ms for the whole grid) and, like the plan itself,
must never be reached for per frame. `create()` drops the cache right after the
`generateMap()`/`restoreMap()` branch, which is mandatory rather than defensive: Phaser reuses
the same scene instance across every `scene.start`, so a plan built for the previous visit would
otherwise survive into the next one; anything that ever mutates the grid mid-visit has to drop it
the same way. `scenes/overworld/terrain/paint.ts`'s `drawTerrain(view)` then runs every frame over
the visible window (`DRAW_DISTANCE_TILES`,
`laneClipAt`) doing only the camera-dependent half: projecting the cached contour geometry (or the
tile's four corners where it has none) through `projectTile` (`scenes/overworld/projection.ts`,
over `art/perspective.ts`) at the current
(possibly mid-tween) camera position (`projectContour`, `drawContactShadow`), deriving
`depthRatio` for the fog/detail falloff, and painting -- including the time-driven accents (lava
crust pulse, water shimmer, void starlight, chokepoint glow). Impassable tiles are painted flat,
in the same plane as the floor (`drawOffPathTile`/`offPathColor` plus the material's own accent,
see "Off-path terrain materials" below);
nothing in the scene rises above the ground plane, so the boundary read comes entirely from the
color break plus the contact shadow and rim light. When the camera stands near the grid's
left/right edge, `drawMarginColumns` first continues each row's edge tile past the grid as
impassable ground (same biome/tint/accent, widened by `art/contours.ts`'s `MAX_OFFSET` under an
adjacent walkable tile to tuck beneath the boundary curve), so the frame never shows the bare
backdrop in a stair-stepped strip where tiles run out. There is no per-tile seam stroke, so a run of
same-kind tiles reads as one region. Every ground color goes through `terrain/color.ts`'s
`groundColor` (which deepens
the haze past what `fogColor`'s own cap allows) with walkable ground hazing toward the lighter
`walkableHazeTarget`, and the frame closes with `sky.ts`'s `drawDepthHaze`, a whole-screen wash
over the far
ground plane. Geometry that is expensive to work out from the grid belongs in the plan; anything
that depends on where the camera is has to stay in `drawTerrain`, since that per-frame reprojection
is what makes the world scroll continuously instead of snapping tile-by-tile.

Neither module reaches back into the scene. `OverworldScene.terrainView()` assembles a
`TerrainView` once per frame -- the `Graphics` mesh, the plan, the camera position, the scene's own
biome, `midTile`, the chokepoint color, the clock, and the haze blend/memo -- and every drawing
function takes that context as a parameter, the same written-against-an-interface split the
guardian panels use with `GuardianPanelHost`. `TerrainView` widens `sky.ts`'s `AtmosphereView`,
which widens its `HazeView`, so a function that only needs the haze declares only that much.

**Reaching the horizon** (`dev_notes/WORLDS.md` §4 is the spec, `STYLE.md`'s "Overworld path" the
visual rule). `drawMarginRows` is `drawMarginColumns`'s counterpart in depth, run before the real
rows so every nearer row paints over it: it repeats `farEdgeRow` -- the northernmost row the
corridor reaches, resolved with the terrain plan and carried on it -- outward past the
grid's far edge, terrain kind included, so the walkable path repeats with it and a road runs on
past the world's end. `drawMarginColumns` takes the row's terrain and its depth row index
separately, which is what lets those repeated rows carry lateral margins of their own. The sweep
runs to `Math.floor(camY - DRAW_DISTANCE_TILES)`, the depth-fog saturation row that also bounds
the real rows, and breaks early on any row whose projected thickness has fallen under
`MIN_ROW_PX`; at the current constants the fog bound always binds first (the thinnest row drawn is
~2.8px, the sub-pixel bound would not bite until ~28 tiles out), so the guard is what keeps that
true if the constants move. How wide each row is painted comes from `laneClipAt(depth)`, which
returns the lane offset that reaches the frame edge at that depth: a fixed lane window cannot do
this job, since the projection shrinks a tile-width toward the vanishing point and one that fills
the frame up close covers a narrowing wedge in the distance, leaving the far screen corners on
bare backdrop. `LANE_CLIP` stays the constant for *actors*, whose visibility is a near-field
question. `terrain/color.ts`'s `groundColor` is bound to that same row: its blend is total at `depthRatio`
1, so the deepest row drawn arrives at the haze color exactly. That equality is what frees
everything above the horizon line to be translucent -- ground that stops one blend short of the
fog needs an opaque band over the join to hide the step, and an opaque band can never soften into
anything (`WORLDS.md` section 4). Its falloff is in two parts and where they meet is the point:
a gentle curve up close, with the remaining blend taken smoothly to total only past `FOG_CLOSE`.
Each grid row paints as one flat fill, so how fast the color moves *per row* is exactly how
visibly the mid-distance terraces -- worst in the open-sky worlds, whose fog target sits far above
their ground in value by design. Something has to be steep, since the blend must cross from
nothing to total over one draw distance; `FOG_CLOSE` sits inside the reach of `drawHorizonBand`'s
wash, so the rows carrying the fastest change are the rows already being painted over.
`HORIZON_BAND_FROM` is derived from `FOG_CLOSE` rather than set beside it, since a step is only
hidden in proportion to the wash actually over it -- the visible part is `(1 - alpha)` times the
step -- and a band whose foot landed on `FOG_CLOSE` itself would be down to a few percent exactly
where it is needed. The step itself scales with how far a world's ground sits from its haze
target, which is why the Vortex Glacier at an open gate is the binding case in the game: icy dark
ground against the Iron Steppe's cream air ahead spans three to four times the range any other
world reaches in either gate state.
`walkableHazeTarget` fades its own lightening out on the same
schedule (`0.35 * (1 - depthRatio^3)`, flat enough to hold the route nearly to the end), or the
repeated road surfaces as a bright stub against the band. `regionTintAt` puts a mapgen domain tint
on that same schedule, and for the same reason with more force: the tint is mixed over ground the
fog has *already* taken, so a fixed strength carries a raw saturated hue to the deepest row and
undoes the arrival at the haze color for exactly the worlds that use domains (1 and 3).
`sky.ts`'s `drawHorizonBand`, called from `drawDepthHaze`, owns the far reach of the draw
distance: opaque from `HORIZON_Y` down to `projectTile(0, DRAW_DISTANCE_TILES).y`, which is the
strip the projection puts out of the ground plane's reach -- rows approach the horizon line
asymptotically and never arrive, so something has to own the last few pixels of ground -- and
thinning from there to nothing at `HORIZON_BAND_FROM` of the draw distance, which is derived from
`FOG_CLOSE` and deliberately nearer the camera than it, so the wash still carries weight
everywhere the per-row color is moving fastest. Both ends are fixed depths rather than tracked off
the deepest row drawn, so the band never slides out from under the rows as the camera creeps. Both it and `drawDepthHaze`'s own wash go
through `fillVerticalFade`, which paints abutting one-pixel rows -- overlapping translucent bands
double-blend on the shared scanline and stripe the far distance, and two-pixel rows contour-band
where the ramp is steepest. It samples the ramp at each row's far edge (`(i + 1) / rows`) so a
fade that has to arrive opaque lands on `alphaAt(1)` rather than stopping a row short. The trace is fed
`plan.ts`'s `depthContinuedWalkable` (the real grid, with every row north of `farEdgeRow` carrying
that row's
walkability) so no boundary curve, contact shadow or rim light is drawn across the continuing
road; `walkable` itself is untouched, so the repeated road is scenery and the player still leaves
through the goal tile. Anything drawing at depth calls `projection.ts`'s `projectTile`, which
applies `CAMERA_BACK_TILES` internally -- adding the pullback again double-counts it.

**Forward haze inheritance.** `sky.ts`'s `hazeTarget(view, biome)` is what every haze in the
overworld reads
instead of `biome.fogTarget` directly (`walkableHazeTarget`, `offPathColor`, `drawDepthHaze`,
`drawHorizonBand`), so the per-tile fog and the whole-screen washes always agree on where the
atmosphere is going. It carries a biome's own fog color toward `getBiome(world + 1).fogTarget` by
`forwardHazeBlend()`, which ramps from zero at `HAZE_INHERIT_TILES` south of the goal row to
`HAZE_INHERIT_MAX` at the row itself, and returns zero for World 10 (no next world) or while
`OverworldScene.isRivalDefeated()` is false -- the goal gate is shut until that world's rival is
beaten, and a
shut gate shows nothing of what is beyond it. The blend factor and a small per-biome memo are
recomputed once per frame in `OverworldScene.drawWorld` before the view is assembled (World 9's
defect patches put several biomes on screen at once).

**The mist band and the distant self.** `drawDepthHaze` runs its passes off one `target`, so
nothing in the frame can disagree about what color the air is: a whole-sky tint, the ground wash,
`drawHorizonBand`, then -- above the horizon line -- the sky's graduation into the fog and
`drawDistantSelf`. The sky pass is the fog color at full strength from `SKY_BLEND_FULL` above the
line down to the line itself, feathering out smoothstepped over the `SKY_BLEND_H` above that. Its
full-strength height clears `MAX_CREST`, the tallest crest a silhouette reaches, which is
load-bearing rather than cosmetic: a silhouette drowned to within a few values of the fog while its
backdrop is still forty values off the fog reads as the same slab an undrowned one would. The
feather is what is left of the sky once that stretch and `SKY_CLEAR_H` of the world's own untouched
sky have been paid for, rather than a height of its own -- `HORIZON_Y` sits high in the frame, so a
mist sized independently of it would run off the top and take the sky's own colour with it.

Two things keep that stretch from reading as a panel laid over the picture. The mist is not one
color: `drawDepthHaze`'s `tone(y)` drifts it toward the world's own `skyTop` by `MIST_LIFT` as it
climbs, anchored to be exactly `target` at `projectTile(0, DRAW_DISTANCE_TILES).y` -- the row the
ground plane's own fog arrives on, so the drift lives entirely above the deepest terrain and
cannot open a step against it. Both mist passes read the same `tone`, so the ramp is continuous
across the horizon line. (`fillVerticalFade` takes a `colorAt(y)` for this and lerps packed ints
via `lerpColor`; it runs per scanline per frame, which is where Phaser `Color` objects would start
costing allocation.) And the sky takes a flat wash of `target` at
`SKY_TINT_MAX * hazeBlend` -- zero until the forward blend runs, so it changes nothing in a world's
own air, and at the gate it is what carries the clouds along with everything else. A bank of this
world's untouched daylight clouds over the next world's mist is the loudest available statement
that the color below them is an overlay rather than weather. The wash covers the sky whole, from
the top of the frame down to the horizon line and under the mist band, rather than stopping where
the band begins: a wash that ends anywhere the eye can find it has only moved the edge it was
drawn to remove, and the band's own ramp starts from zero at exactly that height.

`drawHorizonBand`'s own thinning is smoothstepped over `HORIZON_BAND_FROM` of the draw distance for
the same reason its ends are: a ramp that starts falling the instant the opaque stretch ends puts a
readable line there, the eye finding where a gradient stops changing as easily as it finds an edge.

`drawDistantSelf` composes world N's forward horizon out of world N+1's authored distant self --
`BIOMES[world + 1]`'s `hillColor` (base) and `hillAlpha` (swallow) plus `DISTANT_SELVES[world + 1]`'s
profile in `art/horizons.ts`, never the standing world's own,
and `BIOMES` rather than `getBiome` so World 10 draws nothing instead of falling back to the
meadow. A zero swallow draws nothing at all (Worlds 7, 8 and 10; see `art/biomes.ts` and
`WORLDS.md` section 4 for why each). The fill is that base blended `DISTANT_DROWN` of the way into
the *live* `hazeTarget` value -- the same one every other pass in the frame is using, never the
neighbour's own `fogTarget` -- which is what welds band and mist together: the two move as one as
the forward blend ramps, so the horizon resolves into the next world with nothing that switches.
The silhouette is painted as `DISTANT_SWALLOW_STEPS` nested copies, each starting a step higher up
its own *local* height so alpha accumulates from zero at the base (mist pooling at the foot of a
ridge, and a base that meets the mist with no line in it) to the authored swallow at the crest,
each repeated `DISTANT_FEATHER_PX` times with the crest dropped a pixel at a time for the soft top
edge. Every copy is painted at the one alpha that composites to the authored swallow where all of
them overlap, so the knob means what it says. `BattleScene`'s ridgelines borrow `hillColor` as a
per-world tone but not `hillAlpha`, which is the overworld's swallow and means nothing in a near
view.

**Per-world horizon shapes** live in `art/horizons.ts`, alongside two things a filled outline
cannot say. `DISTANT_SELVES[w].points` is that world's profile as an explicit polyline (screen x,
crest height above the horizon line), authored rather than sampled so a hard-edged surround stays
hard at a handful of points; `MAX_CREST` bounds every crest, and `sky.ts`'s `SKY_BLEND_FULL` is
derived from it so the mist always clears the tallest one. `DISTANT_SELVES[w].sky` is an optional
extra drawn over the mist for the *neighbour's* horizon (the Storm Flats' arc-flashes, the
Entangled Web's filament glints, which at swallow zero are its whole distant self).
`OVERHEAD_SKIES[w]` is the separate table read from the world the player is **standing in** rather
than from its neighbour -- the Iron Steppe's aurora. The two tables answer different questions and
must not be merged. The Storm Flats is deliberately absent from both: its storm is an event that
lands rather than a sky motif, so it is drawn with the terrain it strikes (`drawStormStrikes` in
`terrain/materials/charged.ts`, called from `drawTerrain` after `drawDepthHaze` -- a bolt has to
be painted over the atmosphere it crosses, and it reads the terrain plan so it can only ever land
on an impassable tile).

**Off-path terrain materials.** One module per material under
`scenes/overworld/terrain/materials/`, the same "one file per thing" convention the guardian
avatars follow: `rock.ts`, `forest.ts`, `columns.ts`, `deadFloor.ts`, `charged.ts`, `ice.ts`,
`shards.ts`, `fog.ts`, `lava.ts`, `consuming.ts`, reached through `index.ts`'s `TERRAIN_ACCENTS`
table keyed by `OffPathKind`. Every impassable tile is flat ground in its
biome's own off-path color, in the same plane as the walkable floor; what its material decides is
only the accent laid over that fill, so each world's impassable terrain reads as its own
substance while the "you cannot walk here" signal (the color break plus the contact shadow and rim
light) stays identical everywhere. An accent receives an `AccentTile` -- the tile's projected
outline for a full-tile wash, its screen centre and depth scale, its own grid coordinates, whether
it is a vortex core, its depth ratio and live fog target, the detail-pass falloff, the player's
crystal colour and the scene clock -- which `paint.ts` builds only for a material that actually
draws, so a bare-ground tile costs nothing beyond its fill. `rock.ts` is exactly that case and
maps to `null`.

Three of those fields are the ones a new material most often gets wrong. **Grid coordinates**, not
screen ones, are what make a feature stand still in the world: anything anchored to the map (the
Iron Steppe's shards leaning one way until the domain wall, the Vortex Glacier's pits) must derive
its geometry from `gx`/`gy`, since a feature phased off `cx`/`cy` swims across the ground as the
camera moves. **`haze` and `depth`** are how a material recedes into the same air as the ground
under it; ignoring them stands a world's palette straight up against the mist at the last row
drawn, undoing for the accent pass what the fill pass is careful to do. And **`detail`** fades over
the last stretch before accents stop being drawn at all, which is what keeps a material from ending
on a visible line across the middle distance -- most obvious with trees, where the cutoff otherwise
reads as the wood being mown flat at a fixed range.

`art/trees.ts` is the game's one shared terrain sprite, drawn by the Mean Fields' `forest` and the
Splitting Hollow's `fog` in two palettes. That sharing is a story beat rather than an optimization
-- the wood skirted at the start is the thing the player is lost inside near the end, and it only
lands if the trees are recognisable -- so a change there changes both worlds at once, which is the
coupling wanted. A wood is also by far the most expensive surround to draw -- trees are over half
of the command buffer in both worlds that have them, which are the two most expensive worlds in the
game -- so the crown is tiered on the tile's own `detail`: the full three-lobe crown while `detail`
is 1, a single lit cap over the shaded mass once the fade has started, and one trunkless blob below
`CROWN_SILHOUETTE_DETAIL`. Keying the tiers to `detail` rather than to a distance of the file's own
is what makes that safe -- `detail` is exactly 1 across the whole range where a tree is drawn at
full strength, so a crown is only ever simplified once the frame is already dissolving it, the near
wood the rhyme depends on is never touched, and a threshold keyed to a tree's *on-screen size*
instead would snap crowns between tiers as the player walked into them. Trees, columns and shards
stand up off the ground plane; the plane itself stays
flat everywhere (`STYLE.md`'s "Overworld path"). They get their occlusion free from the sweep
painting far-to-near, with no height field and no repaint pass. Adding a material means adding
a module and a table entry (plus the `wallTheme` in `art/biomes.ts` and the matching `TerrainKind`
in `terrain/types.ts`); nothing in the paint pass itself changes, and two people can add two
materials without touching the same file.

**Ground motifs.** `terrain/decoration.ts`'s `decorateTile` holds one floor motif per world --
the Stone Lattice's sublattice mosaic, the Storm Flats' orbit rings, the Iron Steppe's spin-wave
ripples, and the rest. Whether the walkable floor draws any of them is a single default-off
switch in that file, `GROUND_MOTIFS_ENABLED`, read at `terrain/paint.ts`'s one call site; with
it off the route is one flat colour in every world (`STYLE.md`'s "Overworld path"). The motifs
and the `flowerMap`/`TerrainTile.decorate` plumbing that feeds them stay wired and reachable, so
turning them back on is flipping that one constant rather than rebuilding the pass.

**Ellipse tessellation.** Phaser draws an ellipse as a polygon and takes 32 points for it at any
size, so a shape a few pixels across costs the same ~100 graphics commands as one filling the
frame. The ground is repainted every frame and its accents draw ellipses per tile, which made
that default the largest single item in the frame's command buffer. `art/shapes.ts`'s
`ellipseSteps(width, height)` supplies the point count instead, bucketed by the shape's own
on-screen size against a sub-pixel error budget (for an n-gon on a radius-r ellipse the widest
gap to the true curve is `r*(1 - cos(PI/n))`). The buckets are discrete deliberately: a count
that slid continuously with distance would re-tessellate a silhouette every frame the player
moves, and an edge that re-cuts itself each frame crawls. Every per-tile ellipse in the terrain
pass goes through it -- `art/trees.ts`'s crowns, `materials/lava.ts`, `materials/consuming.ts`,
`materials/ice.ts` and `materials/charged.ts`'s strike pools -- and any new one should.

**Overworld depth layering.** `OverworldScene`'s corridor is a fixed stack of Phaser depths:
`worldGfx` (the single `Graphics` mesh for the whole ground plane, repainted every frame -- see
"Overworld terrain rendering" above) at the default depth 0; qumatessence token bodies at 19;
every other `WorldSprite` body (wild-encounter crystal, guardian, boss, door) at 20; every
`WorldSprite`'s name label at 22; the player's own crystal container at a fixed 40
(`this.player.setDepth(40)`); corner HUD text at 50; and every dialogue/panel container at 100.
Every actor's depth is fixed rather than computed from its position, which is sound because the
terrain is drawn entirely in the ground plane: `worldGfx` has nothing standing up out of it that
an actor could be behind, so painting it first and every actor over it is always correct, and no
actor can ever appear to float in front of terrain it should be occluded by.

## World progression

`HubScene.highestUnlockedWorld()` walks `rivalDefeated` from world 1 until it finds a world not
yet beaten, capped at `BUILT_WORLDS`'s own max (10) so beating World 10's rival and returning to
the Hub before the finale panel fires re-enters World 10 rather than a nonexistent World 11.
`OverworldScene.tryAdvanceToNextWorld()`/`advanceToWorld(this.world + 1)` likewise
compute the next world rather than hardcoding it. `advanceToWorld`'s second param, `enterFrom:
'start' | 'goal'` (default `'start'`), is what the world-door feature (above) uses to land the
player on the destination's `goalTile` instead of its `startTile` -- every other caller
(`showBlochHub`'s own confirm button, `showStoryBeat`'s "Onward") omits it and gets the ordinary
south-edge spawn. `BUILT_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9,
10]` is the single source of truth for "worlds with a walkable map," used by Bloch's own
destination table (every row in the table is a `BUILT_WORLDS` entry, `???`-masked until
discovered -- see "Bloch in the overworld," STYLE.md) and, in Superposition Mode, the list every
world gets
pre-marked visited against -- `OverworldScene.applySuperpositionLeveling`); extend it (plus
a biome entry in `art/biomes.ts`) together if a future world is ever added past 10.
`OverworldScene.recordVisit()`/`getVisitedWorlds()` track registry/save key `visitedWorlds`
(distinct from `rivalDefeated` -- you can visit a world without beating its rival), written
once per world the first time that world's scene is created.

**Long authored prose is fitted to the canvas, never assumed to fit.** `data/worldLore.ts`'s
`WORLD_LORE`, `data/story.ts`'s `STORY_BEATS` and `data/tutorial.ts`'s `TUTORIAL_TIPS` are
authored copy whose length varies a lot per entry, so their panels size themselves to the
text rather than the other way round. `ui/text.ts`'s **`fitProseToBudget(text, paragraphs,
budget, minPx = 9)`** is the one implementation of that: it drops trailing paragraphs (which
the caller continues on a further screen, keeping what the reader does see at full size),
then shrinks the font to an absolute px floor once a single paragraph is all that's left.
The floor is absolute rather than a base size the caller's `fontScale` is re-applied to, so
it stays a real floor at every `FONT_SCALE_PRESETS` setting.

Three panels call it, each measuring its own title/button rather than estimating them:
`OverworldScene.renderWorldLorePage` and `renderTutorialTipPopup` pass a paragraph list and
recurse on the leftover onto a "Next ->" screen, and `showTutorialTopics`' detail pane passes
the whole body as one entry to get shrink-only behavior, since its only button is the list
column's shared "Close" and it has no second screen to continue onto. `showStoryBeat` needs
no fitting -- it's one line -- but follows the same principle by sizing its panel rectangle
to the measured beat and then centering it. See "The between-worlds story beat"/"The
world-entry lore screen"/"Contextual tutorial tips," STYLE.md, for the per-panel layout
numbers. Reach for this helper for any new panel rendering per-world or per-topic authored
prose -- a fixed panel box plus an uncapped `fontPx` is what lets a longer entry for one
world spill off the canvas while every other world looks fine.

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

**A walked world refills itself, out of sight ahead of the player.** `OverworldScene`'s
`respawnTick()` -- a `time.addEvent` loop started in `create()`, so Phaser's own clock drops
it on scene shutdown -- rolls independently for a wild (`respawnWild`) and a pickup
(`respawnToken`). Both draw their tile from the single `respawnTiles()` candidate set, which
is where every placement rule lives: strictly north of `RESPAWN_MIN_ROWS_AHEAD` (computed
from `DRAW_DISTANCE_TILES * VISIBLE_DEPTH_FRACTION`, not a literal, so widening the draw
distance can't start popping spawns into view), walkable, empty, outside
`passZoneRows(startTile, goalTile, midTile)` -- recomputed at runtime from the three points
the scene already holds, rather than stored -- and off the start/goal/guardian tiles. On top
of that, `respawnWild` keeps generation's own two rules (one encounter per row, never in a
run narrower than 2 tiles via `walkableRunWidth`) and draws from the same
`getWildPool(this.world)` the generator did, so no world's pool rule can drift; `respawnToken`
keeps the dead-end preference (`walkableDegree(x, y) === 1`) `scatterTokens` has and values
its drop with the same `pickTokenValue(world)`. Both build their sprite through
`addCrystalSprite`/`addTokenSprite` -- the per-tile builders `spawnCrystalSprites`/
`spawnTokenSprites` also loop over at map entry -- which create hidden, leaving
`updateWorldSprites` to decide visibility from projected depth on the next frame.

`wildTarget`/`tokenTarget`/`tokenRespawnsLeft` are the three ceilings (DESIGN.md §2's
"Respawning"), counted off the actual placements in `generateMap` and carried in
`SavedMapState` alongside the grids. They are the reason a respawn calls `saveMapState()`:
the grids are shared by reference with the registry's `mapState`, so mutating a tile
propagates for free, but these three are scalars and are genuinely copied. They deliberately
get no `SaveData`/`defaultSave`/`persistFromRegistry` entry -- unlike the registry-then-persist
rule's ordinary case, this is per-map state whose own map is registry-only and regenerated on
reload, so a persisted budget would describe a map the reloaded session doesn't have.

`WORLD_NAMES` is meant to be readable as "which course topic is this," not a generic RPG
terrain name. `WORLD_RIVALS`' own names (and, per-type, `RIVAL_9_NAMES`) instead follow
"Polycrystalline `<real compound>` Golem" -- the world's own topic anchors which compound
(see DESIGN.md §2) -- so check both tables together when renaming a world, since a mismatched
rival name is easy to miss if only `WORLD_NAMES` is updated.

## Guardians

Every guardian has its own avatar builder in its own file, each with its own silhouette --
distinguishable from the others by outline alone even at the Lab's small `0.55` scale, in
greyscale (see STYLE.md's per-guardian overworld sections for each design and the physics it
states): `art/noether.ts`'s `makeNoetherAvatar` (golden robed deity, halo + wide sleeves),
`art/bloch.ts`'s `makeBlochAvatar` (robed figure, wireframe Bloch-sphere head, teal),
`art/dresselhaus.ts`'s `makeDresselhausAvatar` (half-crystal transmutation figure with a
carbon-hexagon head, teal-green), `art/laughlin.ts` (stepped wedding-cake quantum Hall
droplet with a lifted quasihole), `art/majorana.ts` (figure split into two breathing halves
joined by a mote seam), `art/anderson.ts` (disconnected-fragment scatter around a bright
localized core, world 6), `art/feynman.ts` (vertex/propagator diagram construct, no
robe/cloak fill, amber, world 7), `art/kondo.ts` (small local-moment figure inside two
counter-rotating screening-cloud arc shells), `art/franklin.ts` (figure holding a
diffraction-ring detector plate, world 9), and `art/sklodowskaCurie.ts` (radiant
ray-crowned spire, world 10). Every guardian spawns through one
unified `OverworldScene.spawnGuardianSprite` (looked up from the `WORLD_GUARDIANS` table), not a
bespoke `spawnXSprite` per guardian, and all share one chime, `playGuardianChime()` in
`audio/sfx.ts`.

**Renaming a guardian is a display-layer change, not a mechanic change.** `WORLD_GUARDIANS[N].id`
(a `metGuardians`/save-list key, never displayed) can stay whatever it was, or change to match --
nothing special-cases a specific id string. What actually needs touching for a rename: the
avatar file + exported function name (by convention, `art/<name>.ts`'s `make<Name>Avatar`
-- the game itself doesn't enforce the name, but `scripts/art-sweep.mjs` finds the avatar
builders to sweep by matching it, so one named otherwise silently stops being covered), the `WORLD_GUARDIANS` entry's
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
- **Franklin's passive panel** (`scenes/panels/franklin.ts`'s `showFranklinPanel`) sells the
  "still-unbought get a buy button, already-bought get a 'Make `<name>` active' button or a
  dimmed '`<name>` (active)' tag" shape -- "buying the very first one auto-activates it, buying
  a second or third doesn't" -- through `scenes/panels/passiveList.ts`'s
  `renderChoiceList(scene, container, y, items: ChoiceListItem[], state: ChoiceListState, reopen,
  options?: ChoiceListRenderOptions)` via its own thin `renderPassiveList(scene, container, y,
  passiveIds, owner: PassiveOwner, reopen, options?)` wrapper, which builds `items` from
  `data/passives.ts` and a `ChoiceListState` backed by `passivesUnlocked`/`activePassiveByOwner`
  (keyed by `owner`, parameterized even though Franklin is the sole `PassiveOwner` today).
  `ChoiceListRenderOptions` (`centerX`/`wrapWidth`, defaulting to `CANVAS_W / 2`/`480` if
  omitted; `onSelect`) is the opt-in surface franklin.ts's own two-column layout (below) uses to
  lay the list out in a narrower right-hand column and to add a non-committal "look" click on
  each row's description on top of the existing buy/activate buttons. Like Kondo's self-buff
  moves (below), a passive is never gated by `MOVE_COMPATIBILITY` at all (the same "player-learned
  technique, not a quasiparticle a crystal has to host" reasoning) -- every passive is always
  purchasable regardless of current form, so this panel has no "wrong form" empty state to
  special-case. Each still-unbought row also prints its own `description` underneath in a
  smaller, capped-scale font (`Math.min(fontScale(this), 1.3)` for the buy button itself, `1.2`
  for the description) -- this panel has no shrink-to-fit safety net the way `showInfoPanel`
  does, and letting either scale all the way to the text-size setting's uncapped 'Large' preset
  (like every other guardian panel's buttons do) pushed the Farewell button off the bottom of the
  canvas the first time this was tried, verified via a live headless-Chromium run at every
  `fontScale` preset. See "Stats and battle resolution" above for exactly how each of Franklin's
  three passives hooks into `BattleScene`.
- **Franklin's own panel layout** puts a fixed-size crystal-preview block (`showFranklinPanel`'s
  `renderCrystalBlock`) in a left column beside the passive list's own right column (a `760`-wide
  panel split via `ChoiceListRenderOptions`' `centerX`/`wrapWidth`, divided by a thin vertical
  line the same way `HubScene.renderMaterialdexPanel`'s own two-column Qumatex divider is drawn),
  rather than stacking the crystal above the list -- putting the two side by side means the
  crystal block adds no extra panel height beyond whichever column is already taller, which
  matters since this panel has no shrink-to-fit net and was already tight against `CANVAS_H` at
  the largest text-size preset before this block existed. The crystal itself is
  `makeCrystal(scene, 34, scene.playerMaterial.color, scene.playerMaterial.variant, { seed:
  scene.playerMaterial.name, hybrid: scene.playerMaterial.hybridParents })` -- the player's own
  current crystal, the same call convention `BattleScene` uses -- standing on a plain ground
  shadow ellipse (`0x000000` at `0.3` alpha, no biome to shade it off the way `BattleScene`'s own
  shadow is). `art/passiveHalos.ts`'s `drawFranklinPassiveHalo(scene, container, x, y, passiveId,
  rx, ry, alpha?)` draws each of the three passives' own ground halo around that shadow, driven by
  which passive is being looked at -- a plain `previewId` closure variable local to
  `showFranklinPanel`, starting from whichever is actually active
  (`activePassiveByOwner.franklin`) and reassigned by `ChoiceListRenderOptions.onSelect` on a
  description-row click, never written to the registry so looking stays free -- rendered at full
  alpha with an "(active)" label for the one actually active in battle, or `0.45` alpha with a
  "(preview)" label for any other passive. This is deliberately *not* persisted state: buying or
  activating a passive (`renderChoiceList`'s own buttons) always calls `reopen()`
  (`showFranklinPanel` again from scratch), which re-reads `activePassiveByOwner.franklin` fresh
  and starts the crystal back on whatever is now actually active -- a persisted preview field
  would otherwise go stale across exactly that commit and show a passive that was only ever
  looked at, not the one just bought/activated. The crystal block itself is rebuilt in place
  (`art/crystals.ts`'s shared `killTweensDeep` first, to stop Amorphous Halo's own glow tween and
  `makeCrystal`'s per-shard sparkle tweens from still targeting a destroyed object; then
  `crystalBlock.removeAll(true)` and
  redrawn) on each preview click rather than a full `reopen()`, and the label's own height is
  reserved up front from the longest possible passive-name-plus-"(preview)" string (the same
  sample-measurement technique `renderPagedButtons`/Qumatex's own paginated list use) so a later
  preview click can never grow the block past the height the panel was first sized for.
  `BattleScene.create()` draws the same
  `drawFranklinPassiveHalo` once around the player's own ground shadow
  (`PLAYER_POS.x, PLAYER_POS.y + SHADOW_DROP`, matching `drawBackground`'s own shadow ellipse
  there) for whichever passive is in
  `playerActivePassives` (see "Passives (Franklin's abilities)" above) -- at full alpha only,
  since a passive showing up in battle at all already means it's the active one. `art/
  passiveHalos.ts` keeps each of the three halos visually distinct from each other and from
  `BattleScene.addBoostHalo`'s own "temporary bonus" aura: Diffraction Shadow is a static ring of
  small dim scattered spots (a powder/polycrystalline sample's own spotty diffraction rings);
  Satellite Reflection is a static, fainter ring offset to one side (a diffraction pattern's own
  secondary spot beside the main one); Amorphous Halo is the only one that moves, a soft
  additive-blended glow breathing on a slow 3.2s pulse (an amorphous solid's own diffuse halo,
  literally that term in X-ray diffraction) -- all three stay in Franklin's own lavender/purple
  family and never gold, so they can't be confused with `addBoostHalo`'s gold aura if both happen
  to be on screen at once.
- **Feynman's move-leveling panel** (`scenes/panels/feynman.ts`'s `showFeynmanPanel`) is a
  different mechanic shape entirely from every other guardian's -- not a purchase catalog, but
  a leveling attempt against a move the player already owns. `renderMoveLevelList` is a
  list+detail layout (`scenes/panels/listDetail.ts`, "Candidate-crystal lists" above) over
  `scene.getUnlockedMoves()` (deliberately not `getBattleMoves()` -- a move currently unusable
  in the player's present form is still worth leveling), paginated by `renderListColumn` via
  `scene.feynmanPage`/`scene.feynmanPreview`. Rows carry `tunedMoveDisplayName`, **not**
  `moveDisplayName`: the level prefix is the same word on every row of a well-leveled save and
  at the largest text-size preset it alone fills the `200`px column, trimming every row to an
  identical "Infinite ...". The detail pane, which has the width for the full leveled name,
  previews the selected move at its real current level (`renderMoveDetailHeader` + `getMoveLevel`,
  so the cascade matches what a real cast plays) over a `renderStatusAndConfirm` block naming the
  next tier, that tier's streak length (`MOVE_LEVEL_STREAKS`) and its cost (`feynmanLevelCost`).
  An already-maxed move still selects and previews but gets no confirm button (the same
  nothing-to-commit convention Dresselhaus's current form and Bloch's current world use); an
  unaffordable one dims the confirm rather than the row. With no unlocked moves at all the panel
  renders no columns, so it falls back to a full-width `renderFarewellFooter` -- the same
  no-left-column-to-put-it-in case Noether's empty Moves tab handles. Confirming deducts the cost
  immediately (before a single question is asked, and never refunded) and calls `showLevelStreak`, a self-contained recursive question flow (`getAnalyticQuestions`
  from `data/quiz.ts`, the same visited-world-filtered pool Laughlin's own single question
  draws from) built the same way `OverworldScene.showEncounter`'s pre-battle quiz and
  `BattleScene.showUltimateQuestions` are, just living in the overworld panel rather than
  mid-battle -- stops at the first wrong answer (writing nothing) or, on a full streak, writes
  the new tier to registry/save `moveLevels` before returning to `showFeynmanPanel`. See "Stats
  and battle resolution" above for `effectiveMovePower`/`moveDisplayName`, the two places a
  move's level actually surfaces in `BattleScene`.
- **Majorana's hybrid-material panel** (`scenes/panels/majorana.ts`'s `showMajoranaPanel`) lets
  the player fuse two crystals from the pool (`defeatedMaterials`, or `allCrystals()` in
  Superposition Mode) into a new `Material` via `data/materials.ts`'s `combineMaterials(a, b)`,
  which spreads whatever `Material` the matching `HYBRID_RECIPES` entry authored (name/type/moves
  all fixed there, not computed at combine time) and adds only `hybridParents` for the
  fused-visual render, then becomes it immediately via `applyPlayerForm` (see "Player form"
  above). **Not any two pool crystals** -- only pairs with a named entry in `HYBRID_RECIPES`,
  keyed by parent *name* rather than main type -- same-type pairs are allowed when a named recipe
  explicitly covers them (e.g. Graphene + Graphene). The panel is browsed by *result*, not by
  ingredient: `combinableHybridResults(pool)` (`data/materials.ts`) returns every `HYBRID_RECIPES`
  entry reachable from the pool -- a same-name recipe needs only one pool entry of that name
  (fusing doesn't consume the original crystal), a distinct-parent recipe needs both names
  present -- paired with the resolved `parentA`/`parentB` `Material` objects for that entry's own
  detail-pane render. The left column (`scenes/panels/listDetail.ts`'s `renderListColumn`,
  "Candidate-crystal lists" above) lists these results by name; a row click only sets
  `scene.majoranaPreview` (now the previewed *result's* name, not an ingredient's), so browsing
  freely costs nothing -- the right column's own confirm button ("Fuse into `<name>`") is what
  actually commits. The detail pane renders, top to bottom: the two component crystals small and
  side by side (a local `renderParentCrystalsRow` helper, not part of `listDetail.ts` since it's
  Majorana-specific), the resulting hybrid's own full render via the shared
  `renderDetailCrystalHeader`, an epic-plus-physics blurb (`materialdex.ts`'s
  `HYBRID_FUSION_LORE`, keyed by result name, shrinking in whole-px steps floor `9` the same way
  Qumatex's own blurb does), then the cost/status line and confirm button. Deliberately no memory
  of earlier fusions to re-become without recombining -- every visit recomputes
  `combinableHybridResults` from scratch; `createHybrid` doesn't persist anything beyond calling
  `becomeHybrid`, which just runs `applyPlayerForm` (the player's *current* form, hybrid or not,
  already survives a reload on its own via `playerForm`). Each individual result is its own
  one-time `MAJORANA_FUSE_COST` (60) qumatessence unlock (registry/save
  `majoranaUnlockedResults`, a list of result names), charged and recorded inside `createHybrid`
  -- called only from the confirm button, the point the result is first previewed being already a
  free browse -- see the Superposition Mode bullets above and DESIGN.md §5 for the pricing
  rationale.
- **Noether's Moves tab** (`scenes/panels/noether.ts`'s `showNoetherShop`/`renderShopMoves`)
  browses by move through the list+detail layout ("Candidate-crystal
  lists" below extends to move-browsing too) rather than a flat button list: the left column
  names candidates (still-unbought, current-form-compatible `SHOP_MOVE_IDS`), a row click only
  sets the panel's own preview field (`scene.noetherMovePreview`,
  "Candidate-crystal lists" below), and the right column's `renderMoveDetailHeader`
  (`scenes/panels/listDetail.ts`, backed by `art/moveEffectPreview.ts`'s
  `startMoveEffectPreview`) shows that move's own real battle-effect animation looping, plus a
  cost/status line and a "Learn `<name>` (`<cost>` qumatessence)" confirm button that
  deducts `shopCost` and appends to `unlockedMoves` directly. `ANALYTIC_MOVE_IDS`/
  `ULTIMATE_MOVE_IDS` (below) are deliberately excluded from `SHOP_MOVE_IDS` so Noether never
  also offers Laughlin's/Skłodowska-Curie's own moves.
- **Laughlin's Analytic-move panel** (`scenes/panels/laughlin.ts`'s `showLaughlinPanel`/
  `renderAnalyticColumns`/`renderAnalyticColumn`) is a **bespoke two-column layout**, not the
  list+detail shape above -- with only ever two fixed moves (`ANALYTIC_MOVE_IDS`:
  `skyfallBeam`/`groundEruption`), both always render side by side at once
  (`scenes/panels/listDetail.ts`'s `sideBySideColumns`, panel width `TWO_UP_PANEL_W`) rather than
  being browsed one at a time through a candidate list, so there is no preview/pagination field
  of Laughlin's own on `GuardianPanelHost` at all. Each column's own `renderMoveDetailHeader`
  call (its own `laughlin:<moveId>`-keyed preview chain, "Attack effects" in STYLE.md and
  `art/moveEffectPreview.ts` above) shows that move's own real battle-effect animation looping,
  its name read via `moveDisplayName` (folds in both the current quasiparticle and Feynman's own
  level prefix). Below that, a status line, then -- **inline, directly beneath that column**,
  not a separate full-panel sub-view -- `scenes/panels/tunableMoveShop.ts`'s
  `hostableClasses`/`renderInlineClassPicker`: one small pill button per `TUNABLE_MOVE_CLASSES`
  entry (every ordinary Attacks-section class, i.e. everything except Kondo's `'screening'`)
  filtered through `canHost(playerMaterial.type, cls)` (so only classes the player's *current*
  form can host are ever pickable), each labeled via `quasiparticleLabel`. Clicking a row on a
  still-unbought move both buys (checks/deducts `shopCost`, appends to `unlockedMoves`) and tunes
  in one click (`buyLaughlinMove`); clicking a row on an already-bought move just retunes, free
  (`retuneLaughlinMove`) -- either way it writes registry/save `moveClassTuning[moveId]` (a map
  shared with Skłodowska-Curie's Ultimate moves below, since it's keyed by move id, not owner),
  read by `data/materials.ts`'s `getTunedMoveClass` in place of the move's own static `class`
  (which defaults to `'phonon'`, the same universal class Phonon Beam carries) wherever
  `BattleScene` checks quasiparticle-mismatch (both `addMoveButton`'s `!!2x`
  tag and `resolveHit`'s actual damage multiplier) and by `tunedMoveDisplayName`/`moveDisplayName`
  for the label; the move's own static `class` never changes, so an untuned move stays
  purchasable/usable from any form and still asks its question regardless of tuning. Retuning
  only filters at pick time, so a saved assignment can outlive a later transmute into
  a form that can't host it -- `getTunedMoveClass` re-checks `canHost` against the player's
  *current* form every call and falls back to `'phonon'` (universal) when it
  fails, and `tunedMoveDisplayName`/the status line read that same fallback
  rather than the raw saved value, so name and mismatch math can't disagree --
  `tunedMoveDisplayName` reads as "Phonon Lance"/"Phonon Eruption" in that state, the status
  line's own fallback text reads the bare noun instead ("reverted to Phonon",
  `quasiparticleLabel`). `ANALYTIC_MOVE_IDS` is identity-by-id (`skyfallBeam`/`groundEruption`
  -- neither move has a distinguishing class of its own to filter on). See
  `BattleScene.showAnalyticQuestion`
  (Stats and battle resolution, above) for how a purchased Analytic move actually plays out in a
  fight.
- **Skłodowska-Curie's Ultimate-move panel** (`scenes/panels/sklodowskaCurie.ts`'s
  `showSklodowskaCuriePanel`/`renderUltimateColumns`/`renderUltimateColumn`/
  `pickUltimateClass`) is the same **bespoke two-column layout** Laughlin's own panel uses, and
  is deliberately **not** built on `tunableMoveShop.ts`'s buy/retune commit logic (though it does
  share that module's `hostableClasses`/`renderInlineClassPicker` row-rendering) -- her pricing
  model has no separate "buy the move" step at all. Both of the fixed `ULTIMATE_MOVE_IDS`
  (`ultimateMeteor`/`ultimateNova`) always render side by side, named via `moveDisplayName`
  (there's no forSale/learned split the way Noether's/Laughlin's own left columns have, since
  picking a class *is* what first unlocks the move); each column's `renderMoveDetailHeader` shows
  its own animation looping (overridden to the longer `playMeteor`/`playNova`
  sequences via `ULTIMATE_SHAPES`, "Attack effects" in STYLE.md, its own `curie:<moveId>`-keyed
  preview chain), a status line reading the
  move's current quasiparticle (`getTunedMoveClass`, the same helper Laughlin's panel reads) or
  "Not yet unlocked" if the move isn't in `unlockedMoves` yet, and -- **inline directly beneath
  it** -- one pill button per hostable class, this time each row's own cost read straight off
  registry/save `ultimateClassesUnlocked[moveId]` rather than a flat move price: "Free" (plus
  " (current)" on the presently-tuned class) for a class already unlocked for that move, else
  `ULTIMATE_CLASS_UNLOCK_COST` (1000) qumatessence, dimmed per-row (not all rows together, unlike
  Laughlin's flat-cost picker) if the player can't afford that specific class right now. Picking
  an already-unlocked class just retunes (writes `moveClassTuning[moveId]`); picking a
  new one deducts the cost, appends the class to `ultimateClassesUnlocked[moveId]`, retunes, and
  -- only on that move's very first-ever unlock -- appends the move id to `unlockedMoves` so it
  appears in the battle menu (`pickUltimateClass` does all of this in one click, no separate
  sub-panel). Once tuned, an Ultimate move's battle-side quasiparticle-mismatch
  math reads exactly like an Analytic move's (`getTunedMoveClass`) -- no special-casing beyond
  the 3-question gate, which lives entirely in `BattleScene` (see "Ultimate moves defer
  damage/turn-handoff," above, and `showUltimateQuestions` in "Battle move menu is sectioned,"
  above). A row here can be genuinely unaffordable -- with no class yet
  unlocked for a move and too little qumatessence, that row is a no-op click -- but the picker
  needs no dedicated escape button of its own for that case: `renderFarewellFooter` is always
  present below both columns regardless of affordability, so there is no dead-end risk to guard
  against (a too-poor player is never left with nothing clickable and `dialogueActive` stuck
  true).
- **Kondo's self-buff shop** (`scenes/panels/kondo.ts`'s `showKondoPanel`) sells
  `data/materials.ts`'s `KONDO_MOVE_IDS` (three moves: `screeningCloud`/`scatteringDrag`/
  `kondoBreakdown`, each tied to one of `types.ts`'s `'screening'`-class `MOVES` entries,
  deliberately excluded from `SHOP_MOVE_IDS`/`ANALYTIC_MOVE_IDS`/`ULTIMATE_MOVE_IDS`). List+detail
  browse-by-move shop like Noether's above (`scenes/panels/
  listDetail.ts`, "Candidate-crystal lists" above): the left column names all three
  `KONDO_MOVE_IDS` via `moveDisplayName`; a row click only sets `scene.kondoMovePreview`
  (browsing costs nothing regardless of how many moves are looked at, same as every other
  list+detail panel). Unlike Noether's/Laughlin's/Skłodowska-Curie's own moves, a Kondo move is a
  self-buff rather than a travelling attack -- `BattleScene.resolveSelfBuff` plays its real
  effect centered on the caster's own position (`from === to === pos`, not flying attacker to
  target) -- so the right column's detail header is `renderMoveDetailHeader`'s self-buff sibling,
  `renderSelfBuffMoveDetailHeader`: it renders the player's own current crystal
  (`scene.playerMaterial`, same `makeCrystal` call/ground-shadow-ellipse convention as
  Franklin's own crystal block, `art/franklin.ts`) standing in the block with the move's
  `'screening'`-class ring effect looping centered on it (`art/moveEffectPreview.ts`'s
  `startMoveEffectPreview`, called with an identical `from`/`to` point -- which works because
  `art/attackShapes.ts`'s `playRing` collapses its own `Phaser.Math.Linear(from, to, 0.12)`
  origin to that single point when `from` equals `to`, the same call `resolveSelfBuff` makes
  for a real cast, there passing the caster's own anchor twice). Below that: the move's own `description`
  (`data/materials.ts`'s `Move.description`, only Kondo's three moves carry one), then a
  cost/status line and a confirm button -- "Learn `<name>` (`<cost>` qumatessence)" for a
  still-unbought move (dimmed if unaffordable), "Make `<name>` active" for an already-bought,
  inactive move, or a dimmed "`<name>` (active)" tag (no-op click) for whichever one is currently
  active (registry/save `kondoActiveMove: string | null`) -- the one action that actually
  checks/spends the cost and, for a still-unbought move, appends it to `unlockedMoves`. Buying
  the very first Kondo move auto-activates it (so a purchase is never silently unusable); buying
  a second or third on top of an already-active one doesn't -- switching between already-bought
  moves is always its own explicit click either way, and only one can ever be active at a time.
  None of the three is gated by `MOVE_COMPATIBILITY`, so every one of them is always for sale
  until bought -- there's no empty/wrong-form state to render here, unlike Noether's shop. Kondo
  has no committed-choice field of its own the way Anderson's two-step pick does -- like
  Majorana/Laughlin/Skłodowska-Curie, `scene.kondoMovePreview` alone drives the whole detail
  pane, and the actual commit is registry/save `kondoActiveMove`, written only by the detail
  pane's own confirm button. This active/inactive split is a narrow, Kondo-specific special case
  in `getBattleMoves` (`data/materials.ts`): a `KONDO_MOVE_IDS` entry is surfaced purely by
  whether it equals `kondoActiveMove`, checked before (not intersected with) the ordinary
  `compatibleMoves` filter every other learned move goes through -- no other move class has (or
  needs) an equip-slot-style mechanic like this. In battle, casting one calls `BattleScene`'s
  `resolveSelfBuff`/`applyOrTickBuff` (see "Self-buffs (Kondo's three moves)" above) to apply its
  one fixed buff (`KONDO_MOVE_BUFF`, no randomness -- the move id decides the buff) to the
  caster's own side, not the opponent.
- **Anderson's impurity-doping panel** (`scenes/panels/anderson.ts`'s `showAndersonPanel`/
  `learnImpurityMove`) is its own two-step pick (host, then move), and
  only its first step uses the list+detail layout ("Candidate-crystal lists" above) -- the
  second stays a plain `renderPagedButtons` list, since a move has no crystal art to preview.
  Step one picks a host crystal (`defeatedMaterials`, or every crystal in Superposition Mode --
  same pool source as Dresselhaus/Majorana), filtered to exclude any `isHybridMaterial` (a
  Majorana fusion, or one of world 10's own named recipe-result wilds) -- doping in an
  impurity is meant to be one real compound's own excitation, not a channel a fusion already
  borrowed from two others. A left-column row click only sets `scene.andersonHostPreview`
  (which host is currently shown in the right/detail column) -- committing to that host (the
  right column's own "Dope in `<name>`" confirm button) is what sets `scene.andersonSelection`
  and advances to step two; it does not touch `andersonDopant`, so previewing or even
  committing to a host to browse its moveset and backing out doesn't disturb whatever's
  already doped in. Step two looks the host up via `findMaterialByName` and lists
  whichever of its `.moves` aren't already *usable* (`!getBattleMoves(registry).includes(id)`,
  checked before this host becomes the dopant) rather than merely unlearned -- Superposition
  Mode auto-grants every move id to `unlockedMoves` on every world entry, so comparing against
  raw `unlockedMoves` would report every host as teaching nothing there. Picking a move is what
  actually commits: `unlockedMoves.push(id)` (if not already present) and `andersonDopant` are
  set together, then persisted. No `applyPlayerForm` call at all -- see "Player form" above.
  `scene.andersonSelection: string | null` is reset in both
  `create()`/`closeDialogue()`, and `scene.andersonMovePage` (the second step's own pager) and
  `scene.andersonHostPreview` (the first step's own list+detail preview field) reset alongside
  it at every one of those same reset points. Each individual host is its own one-time
  `ANDERSON_DOPE_COST` (35) qumatessence unlock (registry/save `andersonUnlockedHosts`, a list
  of host names), charged and recorded inside `learnImpurityMove` -- the same place that
  already commits `andersonDopant` and the `unlockedMoves` append -- rather than at the
  host-preview or step-one-confirm points, both of which stay a free browse. See the
  Superposition Mode bullets above and DESIGN.md §5 for the pricing rationale.

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
`showTutorialTopics`/`showSettingsPanel`/`showTitleScreenPanel`, each taking
`scene: HubScene`):
built the same way a guardian panel file takes `scene: GuardianPanelHost` (see "Guardian panels"
above) -- these six only ever run from `HubScene`, since pressing `H` or `Enter` from any
Overworld scene warps straight there (`this.scene.start('Hub')`, no menu/overlay of choices in
between) rather than opening anything mid-world. Each is a pure function of registry/save
state (player stats/moves/passives, game settings), not of anything tied to
being mid-world, which is what makes moving them out of `OverworldScene` safe. They follow
`HubScene`'s own `dialogueContainer`/`closeDialogue()` overlay convention (both made public,
not private, on `HubScene` for the same "panel modules living outside the class can't reach a
`private` member" reason `OverworldScene` widens its own dialogue infrastructure), gated so a
station can't open over another already-open panel (`HubScene.addStationRow`'s
`dialogueContainer` check). Each `LAB_STATIONS` entry also carries a `visible(scene)` predicate
-- true unconditionally for Moves/Stats/Tutorial/Settings/Title Screen, and for Abilities only
once `passivesUnlocked` is non-empty (or `isSuperpositionMode()` is true, which grants every
passive anyway) --
`HubScene.create()` filters `LAB_STATIONS` by this before laying out the room's station rows,
so Abilities simply doesn't appear until there's something to check there.
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
actually does either, since the full description shows here too).

**The Lab's guardian gallery** (`HubScene.spawnGuardianAvatars`/`guardianSlot`/
`showGuardianTooltip`, called once from `create()`): every guardian in registry `metGuardians`
(every guardian at all in Superposition Mode) stands in the room as their own avatar, and
clicking one opens that guardian's panel directly -- no roster list in between. The data comes
from `OverworldScene.guardianRoster()`, a public static projection (`GuardianRosterEntry`) of
the private `WORLD_GUARDIANS` table carrying id/name/`shortName`/world/`blurb`/`labelColor`/
`avatar`/`open`; the avatar is that guardian's own `art/<guardian>.ts` builder (the same one
their overworld sprite and their panel's header portrait use, never a Lab-specific copy), and
`open` is the exact same callback `WORLD_GUARDIANS` dispatches to when the player walks up to
that guardian mid-world. This works because `HubScene` implements `GuardianPanelHost` (see
"Guardian panels" above) with its own copies of the qumatessence readout, `applyPlayerForm`,
`advanceToWorld`, and every per-guardian pagination field, so a guardian's panel has everything
it needs without the player's world/scene/position ever changing just from opening it.
`guardianSlot(world)` is the pure layout half -- ten fixed slots, five per upper corner, each
cluster stacked one-over-two-over-two and filled in the order its module-level
`GUARDIAN_LEFT_CLUSTER`/`GUARDIAN_RIGHT_CLUSTER` list lays out, keyed by world so a guardian
never moves between visits (see STYLE.md's "The Lab's guardian gallery" for the geometry, labels, and hover readout). The
click target is a near-transparent interactive `Rectangle` covering the slot rather than the
avatar `Container` (a Container has no hit area of its own) and takes the same
`dialogueContainer` one-panel-at-a-time guard the station rows use.

**All seven of the Lab's non-door panels** (the six stations above, plus `HubScene`'s own
`renderMaterialdexPanel`) share one heading color -- `hubStations.ts`'s exported
`LAB_TITLE_COLOR` (`#ffe066`). The Moves, Stats, Abilities and Settings panels share one
centered-content geometry on top of that: `hubStations.ts`'s
`labPanelColumns(panelWidth)` returns a fixed `contentCenterX`/`contentWrapW` margined in from
both edges of the panel (Tutorial and Materialdex lay out their own two-column list/detail
shape instead, and the Title Screen panel its own short centered confirm stack). A panel's own
themed motif (`art/labMotifs.ts`'s `makeQumatexMotif`/
`makeDoorMotif`/`makeMovesMotif`/`makeStatsMotif`/`makeAbilitiesMotif`/`makeTutorialMotif`/
`makeSettingsMotif`/`makeTitleScreenMotif` -- fixed-px art, never run through `ui/text.ts`'s
`fontPx()`/`fontScale()`) is never drawn inside the panel; each `LAB_STATIONS` entry (and
`HubScene`'s own hardcoded Qumatex and door rows) instead carries its
motif builder for `HubScene.addStationRow` to plant beside that station's own button in the
room, at a much
smaller fixed size (`STATION_MOTIF_SIZE = 26`) than a motif drawn inside a full panel would
use. A panel whose own row list can grow long caps its row font scale
(`Math.min(fontScale(scene), 1.3)`) rather than
adding a shrink-to-fit loop, the tradeoff `renderPassiveList`/`showAbilitiesPanel`
make; `showInfoPanel`/`HubScene.showPanel` keep their own shrink-to-fit loops (floor `9`px)
since their body length varies more per instance, and `showTutorialTopics`' own detail-pane
render gets the same behavior from the shared `fitProseToBudget` (see "Long authored prose is
fitted to the canvas" above).

**Story Mode vs. Superposition Mode** (save/registry `superpositionMode`, picked on
`TitleScene`'s title screen via `addModeSelector` -- a two-button picker, not a toggle; Story
Mode is just `superpositionMode: false`, no separate field): Superposition Mode is a
testing/exploration aid, not part of normal progression. This same flag also selects which of
`data/save.ts`'s two independent localStorage slots a given save reads from/writes to (see
"Save schema" below) -- Story and Superposition progress live in entirely separate files, never
sharing state. Several things key off `isSuperpositionMode()`:
- `OverworldScene.applySuperpositionUnlocks(registry)` (exported right after `BUILT_WORLDS`,
  registry-only with no scene/world dependency of its own) is the shared "everything is
  already unlocked" grant, called from two places: `HubScene.create()` (which stands every
  guardian's own avatar in the room regardless of `metGuardians` in this mode, so each one's
  panel is already fully unlocked on a save that's
  never stepped through a world door) and `OverworldScene.applySuperpositionLeveling()`
  (re-applied on every `create()`, covering Continue, Bloch teleport, and the Hub door's
  World-1 jump alike, alongside that method's own world-specific `playerStats`/`playerHp`
  re-leveling to `enemyStatsForWorld(this.world)` plus a flat `+2`, which stays local to
  `OverworldScene` since only that scene knows which world to re-level against).
  `OverworldScene.create()` calls `applySuperpositionLeveling()` immediately after grabbing
  `this.game.registry`, before any map-state read/generation and before
  `getPlayerMaterial(state)` -- the grant can seed `playerForm` itself (below), and both
  World 10's own map-shape dispatch and the player-material read need to see that seeded
  value already in the registry.
- `applySuperpositionUnlocks` grants every move (`unlockedMoves = Object.keys(MOVES)`) and
  every passive (`passivesUnlocked = Object.keys(PASSIVES)`), merges every `BUILT_WORLDS`
  entry into `visitedWorlds` (read by Feynman's/`BattleScene`'s Analytic-question eligibility
  and `HubScene.canResumeWorld`, not by Bloch -- see the candidate-pool point below), and
  unconditionally overwrites registry `discoveredMaterials` with one entry per
  `data/materials.ts`'s `allCrystals()` result, so the Hub's Qumatex (see "Qumatex" below)
  reads as fully discovered. That overwrite is unconditional rather than seed-once, because
  `discoveredMaterials` is a passive discovery log, not a player choice, so there's no prior
  pick it could clobber.
- For the four guardians whose kit is "several unlocked, only one truly active,"
  `applySuperpositionUnlocks` also seeds that one active slot to a random pick among the
  unlocked options, but only if it's still unset -- so a deliberate pick made at that
  guardian's own panel survives every later re-application of the grant: `kondoActiveMove`
  to a random one of `KONDO_MOVE_IDS`; `activePassiveByOwner[owner]` (for each
  `PASSIVE_OWNERS` entry, today just `'franklin'`) to a random passive id among that owner's
  own `PASSIVES` entries; `andersonDopant` to a random non-hybrid crystal (`allCrystals()`
  filtered through `isHybridMaterial`); and `playerForm` to a random pick from a pool
  coin-flipped between Dresselhaus's plain-crystal pool (`allCrystals()` filtered to
  non-hybrid) and Majorana's hybrid-result pool (`allCrystals()` filtered to hybrid) -- so a
  fresh Superposition save starts as a random ordinary crystal or an already-fused hybrid,
  not always the default starting `PLAYER_MATERIAL`. Feynman has no such single-active slot
  (every move he levels stands independently), so his version of the grant is unconditional
  rather than seed-once: every move id's `moveLevels` entry is set straight to `3` (max) on
  every application, since there's no deliberate lower-level pick worth preserving.
- `HubScene.enterWorld()`/`doorLabel()` branch on `isSuperpositionMode()` to jump straight to
  World 1 (`{ world: 1, regenerate: true }`) instead of `highestUnlockedWorld()`, bypassing
  `rivalDefeated` entirely -- Bloch (reachable at World 2's own middle tile via the walkable
  world doors, or by clicking his own avatar in the Lab once met once) is sufficient for
  world-to-world movement on its own regardless of whether this door has ever been used, per
  the candidate-pool point below.
- `showDresselhausPanel`/`showMajoranaPanel`/`showAndersonPanel` each swap their
  candidate pool -- `getDefeatedMaterials()` -- for the full pool (`allCrystals()`) when
  `isSuperpositionMode()` is true, rather than reading whatever's actually been defeated
  so far. `showBlochHub`'s own table always lists every `BUILT_WORLDS` entry regardless of mode
  (see "Bloch in the overworld," STYLE.md); what Superposition Mode swaps there is the
  *discovered* set that decides which rows show their real name versus `???` -- persisted
  `getVisitedWorlds()` filtered to `BUILT_WORLDS` in Story Mode, `BUILT_WORLDS` outright (every
  world reads as discovered) in Superposition Mode. This swap does not lean on `visitedWorlds`
  being pre-seeded by the grant above --
  even though `HubScene.create()`'s own call to `applySuperpositionUnlocks` already seeds
  `visitedWorlds` before any panel can open, checking `isSuperpositionMode()` directly keeps
  Bloch's hub decoupled from that seeding order, working immediately from the Lab on a
  completely fresh save regardless of which call site happens to run first.
- `showBlochHub`/`showDresselhausPanel`/`showMajoranaPanel`/`showAndersonPanel` each check
  `isSuperpositionMode()` directly (not the persisted `blochUnlockedWorlds`/
  `dresselhausUnlockedCrystals`/`majoranaUnlockedResults`/`andersonUnlockedHosts` lists) to
  treat every individual option -- every world, crystal, hybrid result, or host -- as already
  unlocked, the same way Skłodowska-Curie's own panel (`renderUltimateColumn`/`pickUltimateClass`)
  treats every
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

**Full tutorial recap** (`data/tutorial.ts`'s `visibleTutorialPages(registry)` --
`scenes/panels/hubStations.ts`'s `showTutorialTopics`): a list+detail panel
(`scenes/panels/listDetail.ts`, STYLE.md's "List+detail
panels"), the same shape a guardian's own browsed panel uses, just with no crystal/move art to
preview -- the left column names each listed topic (`renderListColumn`, paginated once the set
outgrows one page; a topic's own short `listLabel` if `TutorialPage` carries one, its full
`title` otherwise, since the left column is only `200`px wide and a handful of topic titles
would otherwise collapse to a near-identical trimmed prefix), the right column shows the
selected topic's full title and body. Selecting a row is a scoped update (see "A preview click
is a scoped update" below), not a panel rebuild: `renderListColumn`'s own `setSelectedId`
restyles the row in place and only the detail pane and panel chrome (divider, Close button,
background) re-render, tracked by `HubScene`'s own `tutorialSelectedIndex` (which topic, by its
index into the currently listed set) and `tutorialPage` (which page of the list), both reset in
`closeDialogue()` the same way `materialdexSelectedName` is. A page flip still
tears the panel down (`destroyPanel`) and rebuilds, since that changes which rows the list
itself shows. Panel stroked cyan `0x5ad9ff` like the station always has been. Only reachable
from the Lab's Tutorial station, not auto-triggered.

**Which topics that panel lists, and in what order** (`data/tutorial.ts`'s `TutorialPage.unlock`/
`visibleTutorialPages`): Story Mode lists only what the save has reached -- a `{ kind: 'tip' }`
topic once its own contextual popup has fired (`tutorialTipsSeen`), a `{ kind: 'guardian'; ids }`
topic once any of those guardians has been met (`metGuardians`, a list because a topic can cover
two guardians' takes on one mechanic and either can be reached first), a `{ kind: 'always' }`
topic unconditionally. Superposition Mode returns every topic, matching how
`applySuperpositionLeveling` treats guardians and passives as unlocked from
the start. An undiscovered topic is absent rather than listed locked, and this path never calls
`markTipSeen`, so browsing can't unlock a neighbouring topic or suppress a popup the player
hasn't reached. `showTutorialTopics` reads the list once per panel build and closes over it, so
the rows can't shift under a click. The Tutorial station itself stays ungated in `LAB_STATIONS`:
`maybeShowLabTip` marks `lab` seen on the first Hub `create()` before the player can click
anything, and `modes`/`settings` are `{ kind: 'always' }`, so the list has a floor of three rows
and can never open empty. `TUTORIAL_TIPS`' declaration order is the canonical order the game
reveals topics in and is what the panel lists them in; `npm run content-lint` enforces that
guardian topics follow it and that no topic is unreachable. To add/edit a topic, only
`data/tutorial.ts` needs touching -- the panel and the contextual popups above both read it
generically.

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
the Moves, Stats, Abilities and Settings panels use (above)
in favor of its own two-column list/detail layout, the same shape the Lab's own Tutorial
station also uses instead of `labPanelColumns` ("Full tutorial recap" above); its
own right-column crystal render already is a themed motif, so instead of reusing the station
row's own `makeQumatexMotif` icon (`art/labMotifs.ts`, a small 2x2 grid of tiny faceted gems,
planted beside the Qumatex button out in the room itself) the title line gets a small purple
prism icon of its own (`makeCrystal(this, 16, 0x9a6ad9, 'prism')`) planted just to its left.
Panel height is computed top-down from each
element's actual measured height (`renderMaterialdexPanel`'s running `y`, same pattern as
`hubStations.ts`'s `showInfoPanel`), taking the taller of the two columns before placing the
shared "Close" footer, with the blurb's own font shrinking in whole-px steps (floor `9`) if a
long entry would otherwise overflow.

**Plain single-column candidate lists share one pager: `OverworldScene.renderPagedButtons<T>`.**
Used by Anderson's second step (which move to learn from an already-chosen host) and Feynman's
own move-leveling list -- anywhere Superposition Mode's "every crystal/move" pool can
outgrow one panel and there's no crystal art worth previewing per row. Bloch's own destination
list used this too before its table+map rework (see "Bloch in the overworld," STYLE.md) --
its own left column is a `scenes/panels/listDetail.ts` table now, not this pager.
Takes the container/running-`y`/item array/current page/a `maxPerPage`
ceiling/label+onPick callbacks/an `onPageChange` callback (expected to rebuild the whole panel:
set the field, destroy `dialogueContainer`, re-call `showXPanel()` -- same pattern as every
other in-panel action) and returns the advanced `y`. **The actual per-page row count isn't
`maxPerPage` verbatim** -- it measures every candidate's own label for real at the current
`fontScale` (`ui/text.ts`), off-canvas and destroyed immediately after, and packs each page
until the next label wouldn't fit above the panel's own trailing footer, since a fixed
row count risks overflowing the canvas at the *default* text-size preset (1.5x, not 1x) once
Superposition Mode makes a long candidate list the common case, and a uniform single-line
estimate under-counts a page's real
height once a long, multi-word label (a crystal name, or a guardian-shop row with a cost
suffix) word-wraps to two lines rather than staying on one. The trailing `<- Prev`/
`Next ->`/`Page N/M` row (only rendered once the list needs more than one page) is a single
shared row, not a button row with the page label stacked underneath it -- reclaiming that
row's worth of height is what keeps a guardian whose avatar/intro text already leaves little
slack (Anderson) inside the canvas at the largest text-size preset. Each caller owns
its own page field (`andersonMovePage`), all reset in both
`create()` and `closeDialogue()` the same way `andersonSelection` is. Reuse this rather than a
bespoke row-count/shrink-to-fit calculation for any future plain candidate list that can grow
unboundedly and has no crystal art to preview.

**Candidate lists worth a two-column detail pane use the shared
`scenes/panels/listDetail.ts` scaffolding** (STYLE.md's "List+detail panels") whether or not
there's art to preview -- Dresselhaus's transmute list, Majorana's browse-by-hybrid-result list,
Anderson's own host-pick (first) step, and HubScene's Qumatex panel browse by *crystal*, the same
shape a *move*-browsing shop (Noether's Moves tab and Kondo's own self-buff step, see
"Guardians" above) also builds on, with a real battle-effect animation
(`art/moveEffectPreview.ts`) standing in for a crystal render. Bloch's own destination table
(`scenes/panels/bloch.ts`) builds on the same left-column scaffolding to browse by *world
number* instead, and its own detail pane opens with the Qumatuomi map (`art/qumatuomiMap.ts`)
fixed at the top -- rendered once showing all 10 worlds regardless
of the current selection, unlike the rest of the pane below it -- in place of the crystal-render-
plus-name block a crystal-browsing panel's own detail pane opens with, followed by the previewed
destination's own physics blurb/cost/status/confirm content;
see "Bloch in the overworld" (STYLE.md) for the full layout. The Lab's own Tutorial station
(`scenes/panels/hubStations.ts`'s `showTutorialTopics`, "Full tutorial recap" above) browses by
*topic* the same way, with no art and no commit step at all -- the detail pane is just that
topic's own title and body, selecting a row is the whole interaction -- reusing the scaffolding
purely for its paginated-list-plus-detail-pane shape, not for anything crystal/move-specific
about it. Laughlin's and
Skłodowska-Curie's own panels do *not* use this scaffolding at all -- each has exactly two fixed
moves, always both rendered at once through their own bespoke `sideBySideColumns` layout instead
of a browsed candidate list (see "Guardians" above); neither imports `renderListColumn` or
`listDetailColumns`. The two shapes also have genuinely different vertical budgets, which is the
second reason to keep them apart rather than merge them: a list+detail panel hides its escape
button inside the shorter left column and so gets that row's height back to spend on the detail
pane, while a two-up panel has no left column, keeps a full-width footer row, and carries an
inline quasiparticle picker in each column -- so the art-stage height is a property of the shape
(`DETAIL_STAGE_H` vs `TWO_UP_STAGE_H` below), not a constant the two can share.
`renderListColumn<T>`
is this layout's own left-column pager: a
single fixed sample-row-height measurement (not `renderPagedButtons`' per-item real-height
packing) reserving two rows' worth of tail space for the caller's own trailing content plus two
more for its own Prev/Next/Page-N/M row, whether or not that row ends up rendering -- the same
technique Qumatex's own left column always used, simpler than `renderPagedButtons`' two-pass
packing since a list+detail row is always just a plain crystal/hybrid/move/world name (no cost
suffix, since cost lives in the detail/status pane instead) and therefore always one line.
Selection here is
two-layered: `selectedId`/`onSelect` identify *which row is currently previewed* (a transient
field per panel -- `dresselhausPreview`, `andersonHostPreview`, `majoranaPreview`,
`noetherMovePreview`, `kondoMovePreview`, `blochPreview`, see above),
separate from
whichever *committed* two-step-flow field (`andersonSelection`) a panel
with an actual two-step flow already carries -- clicking a row (or, for Bloch, a map marker too)
only changes the preview, at no
cost; the right/detail column's own explicit confirm button is what actually applies the
guardian's mechanic. `insertColumnDivider` draws the line between the two columns once both are
known (inserted at container index 0, so it renders *beneath* every row/button -- Franklin's own
bespoke 760px two-column panel calls it too, with its own divider x, rather than hand-drawing a
second copy), `fitListLabel` is the shared ellipsis-trim-on-overflow helper, and
`renderDetailCrystalHeader`/`renderMoveDetailHeader`/`renderSelfBuffMoveDetailHeader` are the
shared header blocks each guardian panel's detail pane opens with -- a crystal render plus name
for the three crystal-browsing panels, a looping battle-effect animation plus name for the
move-browsing ones, the same animation centered on the player's own crystal for a self-buff move
(Kondo's; Qumatex's own detail pane stays a separate render since it
additionally masks an undiscovered entry and appends a physics blurb). Both move headers take the
player's real Feynman `MoveLevel` (`getMoveLevel`) so a leveled move previews the same escalating
multi-trigger cascade a real cast plays. `renderListColumnFooter` puts the panel's own escape button ("Farewell", or "Close" in the Lab)
in the **left column beneath its rows** rather than in a full-width row under both columns --
the left column is the shorter of the two here, so a footer inside it costs the panel no
height, and the budget a full-width footer row would take goes to the detail pane's own art
block and text instead. It places exactly one button; a panel needing a second escape button
("Never mind" on Anderson's pending pick) isn't a list+detail layout at that step and uses the
full-width two-button `renderCancelFarewellFooter` row instead. `DETAIL_STAGE_H` (`104`) and
`DETAIL_CRYSTAL_SIZE` (`44`) are the one art-block height/crystal size all three detail-pane
openers (and Qumatex's own pane) share, fixed regardless of the text-size setting ("art, not
text"); Laughlin's/Skłodowska-Curie's own two-up columns pass `renderMoveDetailHeader` the
shorter `TWO_UP_STAGE_H` (`84`) instead, since a panel with no left column reclaims no footer
height to spend and their columns carry an inline class picker a browsed pane doesn't.
`renderStatusAndConfirm` is the shared tail every one of
those panes closes with: the cost/status line plus an optional confirm button (omitted where
there's nothing to commit -- Dresselhaus's current form, Bloch's current or undiscovered world),
parameterized only over the wording, the dimmed-when-unavailable flag, and two per-panel spacing
knobs (`statusCap`, Anderson's tighter `1.1`; `gapAfterStatus`, Bloch's tighter `4`).
`LIST_DETAIL_PANEL_W`
(`720`) is the panel width every list+detail panel uses; Laughlin's/Skłodowska-Curie's own
bespoke panels use the wider `TWO_UP_PANEL_W` (`800`) instead (see "Guardians" above).

**A preview click is a scoped update, not a panel rebuild** in Dresselhaus's, Anderson's,
Majorana's, Kondo's and Bloch's panels, and in the Lab's own Tutorial station -- follow this in
any new list+detail panel. Each of the five guardian panels opens by building its avatar/intro/
list rows once into the panel container, plus two sub-containers: a `chromeBlock` added *first*
(so the divider, footer and panel background inside it render beneath everything added after)
and a `detailBlock` for the right-hand pane; Tutorial's own `showTutorialTopics` follows the
same `chromeBlock`/`detailBlock` split, just with a heading/hint line in place of a guardian
avatar and intro quote. Clicking a row calls `renderListColumn`'s own `setSelectedId` (restyles
the rows already on screen -- row heights are fixed, so nothing re-measures) and re-renders only
`detailBlock` plus `chromeBlock`, whose height depends on it. Bloch's Qumatuomi map is the
strongest case: its coastline, islands and markers are built once and only the selection ring
(its own `ringBlock` *inside* the map's container, so it shares the map's local coordinates)
moves. A commit -- a purchase, a transmutation, a page flip -- still tears the panel down via
`destroyPanel(scene)` and calls `showXPanel` again, since those change what the list itself
shows; Tutorial has no purchase/transmutation step, only a page flip ever rebuilds it.
`destroyPanel` is the shared teardown every rebuild goes through: it runs
`art/crystals.ts`'s `killTweensDeep` over the whole container before destroying it, since
Phaser's own `destroy()` leaves tweens targeting a dead object running and a panel is full of
infinitely-repeating ones (the guardian avatar's bob, `makeCrystal`'s per-shard sparkles, a
hybrid halo's glow, Bloch's ring pulse) -- Tutorial's own panel carries none of those, but calls
`destroyPanel` on every rebuild anyway for the same "safe even with nothing to kill" consistency.
Noether's Moves tab rebuilds through `destroyPanel` on
a preview click too: its detail pane renders no crystal at all, and its animation preview is a
`moveEffectPreview.ts` chain that retargets rather than restarting, so a scoped update would buy
it much less than it buys the five guardian panels above.

## Save schema

`data/save.ts`'s `SaveData`: `playerStats: Stats`, `visitedWorlds: number[]`,
`defeatedMaterials: DiscoveredMaterial[]` (written by `BattleScene.endBattle` on an ordinary
wild win, same "not for rivals" rule as `discoveredMaterials`), `playerForm: Material | null`
(round-trips a *whole* `Material` object through `JSON.stringify`/`localStorage`, so the
player's *current* form -- hybrid or not -- survives a reload for free; there's no separate
history list of past Majorana fusions, every visit to his panel recomputes which hybrids are
reachable fresh),
`tutorialTipsSeen:
string[]` (which contextual tips have fired; also what gates those topics in the Lab's
Tutorial station in Story Mode -- see "Which topics that panel lists, and in what order"
above), `superpositionMode: boolean` (Story Mode is just its `false` state -- see "Story
Mode vs. Superposition Mode" above; also the routing key `saveKeyFor()` uses to pick which of
`data/save.ts`'s two localStorage slots a given read/write belongs to, forced by `loadSave()`
to always match the slot actually read rather than trusted from the stored blob),
`encounterDensity: number` (one of
`data/settings.ts`'s `DENSITY_PRESETS`, set via the Lab's Settings station),
`musicStyle: MusicStyle` (same station's third row, one of `data/settings.ts`'s
`MUSIC_STYLE_PRESETS` -- which of `audio/music.ts`'s `SCORES`/`SCORES_MODERN`
tables `MusicEngine` draws from, applied immediately via `music.setStyle()`),
`difficultyTier: DifficultyTier` (same station's fourth row, one of `data/settings.ts`'s
`DIFFICULTY_TIER_PRESETS` -- B.Sc./M.Sc./Ph.D., `data/balance.ts`'s `DIFFICULTY_MULTIPLIERS`
scaling `enemyStatsForWorld` -- read live by `BattleScene`/`OverworldScene` on every
fight/re-level rather than cached, so a change applies to the very next battle),
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

**Gotcha: `TitleScene.loadIntoRegistry()` copies `SaveData` into the registry field-by-field,
not by looping over the object.** `defaultSave()`/`persistFromRegistry()` being updated for a
new field isn't enough on its own -- `loadIntoRegistry`'s `registry.set('<key>', save.<key>)`
calls are a third, separate hand-written list that has to gain the same new field too, or that
field silently stays `undefined` in the registry on every fresh load (a save file itself would
still have the right value, since `loadSave()`'s `{ ...defaultSave(), ...saved }` spread is
generic -- only this registry-seeding step is the hand-listed one). Caught the hard way while
wiring up `activePassiveByOwner`: `OverworldScene`/`BattleScene`
both read the *registry*, not `loadSave()` directly, so a field missing from this list reads as
permanently unset in every scene despite `data/save.ts` being fully correct.
`loadIntoRegistry(superposition)` is called both at boot and every time the mode picker
switches (so switching modes never leaves one mode's fields sitting in the registry under the
other's flag), so this list only needs to exist in one place regardless of entry point.

**Starting over.** `data/save.ts`'s `clearSave(superposition)` just removes the matching
localStorage key -- `TitleScene`'s "New Game (erase save)" link (behind
`confirmNewGame`'s yes/no confirm) erases only the currently selected mode's own slot, then
calls `loadIntoRegistry`/`redrawContent` directly for that same mode rather than
`this.scene.restart()`, so the picker stays on the mode the player was just looking at instead
of re-running the initial-mode tiebreak (which could otherwise flip the screen to the *other*
mode right after the erase, if that one still has a save).

## How to use this file

Before touching `game/src/`, read this file (and the relevant section of
`DESIGN.md`/`STYLE.md`) instead of re-exploring the tree. If you learn something mid-task that
would have saved a file read -- an exact function name, a pattern you had to reverse-engineer,
a gotcha in how two files interact -- add it here before you forget it, in the section it best
fits. Keep entries about *structure and pattern*, not a changelog of specific past edits (that's
what git history is for).
