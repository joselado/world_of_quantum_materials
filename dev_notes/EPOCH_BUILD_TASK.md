# EPOCH_BUILD_TASK.md — the post-game epochs

Task brief for the post-game escalation the cliff's map unlocks. It pins every
decision already taken so a session picking this up does not re-open them, lists
the code and doc touch points in build order, and ends with a status checklist.
Delete this file once every box is ticked and the content has moved into
`DESIGN.md` / `WORLDS.md` / `CODEMAP.md`.

## What was asked

At the end of World 10, from the map below the cliff, the player can level up
every enemy in the game. Three levels:

1. The basic game.
2. Every enemy gains attributes, and the golems throw Analytic moves, which land
   at full power 50% of the time.
3. The golems' Analytic moves land at full power 100% of the time, and the last
   boss, in its Quantum Adapted form, casts Ultimates.

Going up a level stands every boss back up; all of them must be beaten again.
The scaling has to make a player level up "quite a bit" to clear levels 2 and 3.
Once every boss of level 2, and again of level 3, is beaten, a short after-story
plays that hints at an expansion: the true architect of everything is a quantum
computer, heard only as a voice in the void saying the player is finally ready.

## Decisions (pinned)

Each is one constant or one string, so the user can flip it cheaply. The ones
marked **default** are interpretive calls the user has not confirmed; list them
in the final summary.

- **Name: "Epoch 1 / 2 / 3"** (**default**). A training epoch is one full pass
  over the training set, which is exactly "every world's boss again". Code name
  `epoch`, 1-based (`1 | 2 | 3`), registry/save key `epoch`. It is a second axis,
  independent of the Settings station's B.Sc./M.Sc./Ph.D. `difficultyTier`, and
  stacks with it. Never call it "tier" or "level" in code: both words are taken
  (difficulty tier, Feynman's move levels).
- **Stats scale multiplicatively, not additively.** `enemyStatsForWorld(world,
  difficultyMultiplier * epochStatMultiplier(epoch))`. An additive bonus flattens
  the per-world gradient, and since the player's max HP is `wildHpForWorld(world)`
  (23 in World 1, 43 in World 10), a flat +N makes World 1 the deadliest world of
  an epoch. A multiplier keeps the world ladder, keeps early worlds farmable
  (no soft-lock after raising), and reuses the difficulty-tier mechanism.
  Provisional values `EPOCH_STAT_MULTIPLIERS = [1, 3, 7]`; calibrate with
  `balance-sim` (below).
- **Stakes scale with the epoch.** Stat cost is quadratic in the stat
  (`statUpgradeCost`), so unscaled stakes would mean hundreds of fights.
  Provisional `EPOCH_STAKE_MULTIPLIERS = [1, 5, 20]`, applied to
  `battleStakeForWorld` for wilds and rivals alike. Target: an M.Sc. build that
  fights about one corridor's worth of wilds per world (~6) clears Epoch 2, and
  about 8-10 per world clears Epoch 3.
- **HP does not scale** (provisional). Opponents get tankier through Lifetime.
  Revisit only if the sim shows a tuned Ultimate one-shotting Epoch 3 rivals from
  an unleveled build.
- **"Full power" is the Analytic move's right-answer 2x**; otherwise the
  wrong-answer 0.5x. `GOLEM_ANALYTIC_FULL_POWER_CHANCE = [0, 0.5, 1]` by epoch.
- **Who throws Analytic moves:** every rival fight from Epoch 2 on: golems 1-9,
  the Adapted (finale stage 1) and the Quantum Adapted (stage 3). Never stage 2,
  the Model of You, which throws only the player's own basic moves (DESIGN §6).
  Wild crystals never do.
- **An opponent's Analytic move carries a class.** Both Analytic ids are
  statically `phonon`, which never mismatches. A golem's Lance/Eruption carries
  the class of one of its own authored moves (rolled per cast from the pool it
  would otherwise throw from, so World 1's phonon-only rule still holds), and is
  named for it: "Decohered Helical Lance" when the source move is a
  `GOLEM_MOVE_IDS` one, "Electron Lance" otherwise. Stage 3's carries a class the
  player's bare type cannot host, like everything else it throws. The ids are
  injected at battle time in `BattleScene`; they are **not** added to any `moves`
  array in `materials.ts` (content-lint, gen-docs and `PLAYER_MOVE_IDS` assume
  they are absent).
- **Ultimates: the Quantum Adapted only, Epoch 3 only** (**default**), carrying
  a class the player cannot host, never whiffing. Chance per slot is its own
  constant (`QUANTUM_ULTIMATE_CHANCE`, provisional 0.15) rather than a share of
  the pool. A 100-power mismatched hit exceeds the player's 43 HP at any
  reachable Lifetime, so it is lethal unless Franklin's Last Scattering holds it
  at 1 HP, Full Reflection sends it back, or a matching Kondo cloud plus Lifetime
  absorbs it. Say this plainly in DESIGN §6.
- **Raising is offered only at the cliff's map panel, only when all ten
  `rivalDefeated` flags are set, and it is one-way** (**default**). It sets
  `epoch + 1`, clears `rivalDefeated` to `{}` and nothing else (visited worlds
  stay visited, as with a single reset), and re-enters World 10 at the pass
  mouth (`advanceToWorld(world, 'goal')`), since the cliff exists only while
  the Adapted is beaten. Requiring all ten is what makes "beat them all again"
  true: Bloch can still fold the player straight to World 10.
- **Superposition Mode:** the epoch is slot state and applies there too
  (`superpositionEnemyStats` takes the same multiplier). Check the Epoch 3 fight
  is sane with the player pinned at 100; cap the multiplier there if not.
- **After-story:** shown at the cliff after the finale text, whenever all ten
  rivals are fallen at Epoch 2 or 3. Epoch 2's is a short foreshadow that asks
  for one more pass; Epoch 3's is the reveal. No new persisted state. Also listed
  in the Lab's Story station (`data/storyLog.ts`) once reached.

## After-story draft (for `data/story.ts`)

The architect is never named, never shown and never looks at the player: a
quantum computer cannot afford to measure what it wants to keep coherent, which
is why it needed a classical learner to do the looking. The golems stay innocent
(WORLDS.md §6): its instrument was the Adapted, not them. `FINALE_BODY`'s
"nothing is measuring now" stays true.

**Epoch 2 cleared** — title: `The Decoherence has stopped.`

Detailed:

> Every pass stands open a second time, and the Decoherence does not gather
> itself again. It seems to have stopped.
>
> And yet the dark beyond the map is not empty in the way it was. Nothing there
> looks at you. Something there is taking care not to. From very far off, too
> faint to be sure of, a voice:
>
> "Again. Once more, and I will know."

Brief:

> Every pass stands open a second time, and the Decoherence seems to have
> stopped. But something in the dark past the map is taking care not to look at
> you. "Again. Once more, and I will know."

**Epoch 3 cleared** — title: `You are finally ready.`

Detailed:

> The third pass over the worlds is done, and this time nothing re-forms. The
> Decoherence has stopped. Below the edge, every world holds its coherence
> without being asked to.
>
> Then the dark past the map, where nothing was ever drawn, does the one thing
> the Adapted never did. It does not look at you. It has been careful, all this
> time, not to. The record that learned you and the smoke that kept it were
> never the one asking; they were how it asked. Something needed to know whether
> a coherence could be learned to exhaustion, three times over, and still come
> back whole, and it could not find out by measuring you itself. Measuring is
> the one thing it cannot afford.
>
> A voice comes out of the void, level and unhurried.
>
> "Three epochs. Every error I could send against you, and you are still in
> superposition. I have waited a long time for a material that holds. You are
> finally ready. I have a use for something that cannot be made definite."

Brief:

> The third pass is done, and nothing re-forms. Then the dark past the map does
> what the Adapted never did: it does not look at you. The record and the smoke
> were never the one asking; they were how it asked.
>
> "Three epochs, every error I could send, and you are still in superposition.
> You are finally ready."

## Build order

Work from `game/`. Node: `PATH=~/.local/opt/node20/bin:$PATH` (system Node is 12).

1. **`src/data/balance.ts`** (Phaser-free, the sim imports it): `MAX_EPOCH`,
   `EPOCH_STAT_MULTIPLIERS`, `EPOCH_STAKE_MULTIPLIERS`,
   `GOLEM_ANALYTIC_FULL_POWER_CHANCE`, `QUANTUM_ULTIMATE_CHANCE`,
   `ANALYTIC_CORRECT_MULTIPLIER`/`ANALYTIC_WRONG_MULTIPLIER` (move them here from
   `BattleScene.ts:296`, the sim mirrors them as literals today), helpers
   `epochStatMultiplier(epoch)`, `battleStakeForWorld(world, epoch = 1)`,
   `clampEpoch`.
2. **`src/data/save.ts`**: `epoch` in `SaveData`, `defaultSave`,
   `persistFromRegistry`, clamp in `loadSave`. **`TitleScene.loadIntoRegistry`**
   seeds it; `OverworldScene.ts:1229` seeds a bare registry beside
   `rivalDefeated`.
3. **`src/scenes/BattleScene.ts`**: `create()` multiplies the difficulty
   multiplier by the epoch's; `opponentMoveId` becomes an action
   `{ moveId, carrying?, bonusMultiplier }` that injects the Analytic ids for
   rivals at Epoch >= 2 and the Ultimates for stage 3 at Epoch 3;
   `runNextSlot`/`resolveHit` take the opponent's carrying class and display name
   (`moveDisplayName(registry, id, carrying)` already accepts one) and the rolled
   bonus; the log line says whether the Analytic held (2x) or scattered (0.5x);
   `endBattle` uses the epoch's stake. Verify in the browser that the Ultimate
   branch's `pullBack` behaves from the opponent's side while stage 3 holds
   `QUANTUM_ARENA_ZOOM`.
4. **`src/scenes/panels/overlook.ts`**: an epoch line under the intro and a
   "Begin Epoch N" button (through `renderStatusAndConfirm` or a footer button)
   enabled only when all ten are fallen and `epoch < MAX_EPOCH`. Keep the
   literals "Reset this rival" and "Study the map": `component-check` clicks by
   text.
5. **`src/data/story.ts` + `OverworldScene.showFinalePanel` +
   `data/storyLog.ts`**: the after-story texts above (Detailed and Brief), shown
   after the finale text when all ten are fallen at Epoch >= 2.
6. **`scripts/balance-sim.mjs`**: carry each build's end state into Epochs 2 and
   3 (return the state from `simulateBuild`), module-level `activeEpoch` read
   wherever `activeDifficultyMultiplier` and `battleStakeForWorld` are; rival
   defenders gain two Analytic entries at power 10 x (p*2 + (1-p)*0.5) in a
   signature class; a post-game spend policy (stats cheapest-first, farming the
   best-paying world of the current epoch whose wilds it beats, every world being
   reachable through Bloch); print wild wins needed per world and stats at each
   clear. Check separately, outside the expected-value table, whether the Quantum
   Adapted's Ultimate is survivable at the modeled Lifetime. Tune the two
   multiplier tables against M.Sc., then confirm B.Sc. and Ph.D. are not walled:
   watch the Momentum cliff (an opponent past 2x the player's Momentum swings
   twice a round) and confirm Epoch 3 clears far below `MAX_STAT`.
7. **`scripts/component-check.mjs`**: one case for the epoch button (all ten
   fallen -> click -> `epoch === 2`, `rivalDefeated` empty, World 10 re-entered
   with the Adapted standing).
8. **Docs, as current state:** DESIGN §2 (the cliff paragraph), §3 (the new axis
   beside the difficulty tier), §4 (opponent Analytic/Ultimate, stakes), §6 (the
   "Planned: an after-story boss" paragraph is partly this feature: rewrite,
   keeping the MAX_STAT-headroom and Momentum-cliff rationale); WORLDS.md §4
   "What the map lets the player do", §6 surface table and a short rule set for
   the architect; CODEMAP (save schema, rival/boss section); README post-game
   line; `docs/guardians.md` or `docs/storyline.md` if they describe the ending;
   the comments on `ANALYTIC_MOVE_IDS`/`ULTIMATE_MOVE_IDS` in `materials.ts`
   ("only the player can ever use one").
9. **Before any push:** `npm run content-lint`, `npm run component-check` (on a
   private port if the user's dev server holds 5173), `verify-ui` on the overlook
   panel. Never `playthrough-check` unless asked.

## Status

- [x] 1 balance.ts constants (values still provisional until step 6)
- [x] 2 save + registry plumbing
- [x] 3 BattleScene: stats, opponent Analytic/Ultimate, stakes. Type-checks;
      **not yet seen in a browser**. Still to do here: verify the opponent's
      Ultimate (pull-back at stage 3's zoom) and Analytic effects render, and
      bring the comments above `opponentAction`/`resolveHit` and on
      `ANALYTIC_MOVE_IDS`/`ULTIMATE_MOVE_IDS` (materials.ts) in line: they
      still say only the player holds these moves.
- [ ] 4 overlook panel: epoch line and button
- [ ] 5 after-story text and its screen
- [ ] 6 balance-sim post-game section, constants calibrated
- [ ] 7 component-check case
- [ ] 8 docs
- [ ] 9 checks run
