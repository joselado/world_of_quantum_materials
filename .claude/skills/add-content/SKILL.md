---
name: add-content
description: Step-by-step checklist for adding new game content to world_of_quantum_materials -- a new crystal/material, a new hybrid recipe, or (rarer) a new guardian/world. Use whenever a task asks to add a compound, a fusion recipe, or a guardian, so no touchpoint (data entry, physics grounding, avatar art, docs regeneration, persisted state, dev_notes/DESIGN.md tables) gets missed. Complements qwm-builder's general conventions with the concrete file-by-file list for this specific task shape.
---

# Adding new content

Three different task shapes, each with its own touchpoint list. Pick the
matching section below -- don't treat them as interchangeable, the data
model genuinely differs between them (`dev_notes/CODEMAP.md`'s "Data model" section
has the full field-level detail behind everything referenced here).

## Before you start: ground it physically

This is a physics-teaching game -- new content should be grounded in the
actual course material, not invented. `lecture_notes/tex/sessions/
sessionNN.tex` (a local-only symlink, may be absent on this machine) maps to
worlds as `quiz.ts`'s own header comment documents: world 1 and 2 both draw
from `session01.tex`, world 2 additionally from `session02.tex` (Bloch's
theorem/tight-binding/graphene), and so on through world 9 -> `session09.tex`
-- check `CLAUDE.md`'s topic table and `game/src/data/quiz.ts`'s header
comment for the exact current mapping rather than assuming. A hybrid's
result material draws from whichever session its *recipe* conceptually
anchors to, which is often not the same session as either parent (`quiz.ts`'s
own comment gives a worked example: doping magnetism into a topological
material draws from the topological-band-theory session, not the doping
session). If the symlink is absent, say so and ground the content in
`dev_notes/DESIGN.md`'s existing description of that world's topic instead of
skipping grounding entirely.

## A. Adding a new crystal/material

1. Add a `crystal(name, type, maxHp, moves, shadeStep?, variantOverride?,
   shortName?)` row (`game/src/data/materials.ts`) to the right world's
   `WORLD_CRYSTALS[world]` pool (or `WORLD_RIVALS[world]` if it's a boss).
   - `type` must be an existing `MaterialType` (`TYPE_LOOK`'s keys).
     Proposing a genuinely new type is a much bigger change (touches
     `TYPE_LOOK`, `MOVE_COMPATIBILITY`, `art/attackEffects.ts`'s
     `EFFECT_STYLE`, and probably `dev_notes/DESIGN.md`'s type system section) --
     flag that explicitly rather than doing it as a side effect of adding
     one crystal.
   - Every id in `moves` must already exist in `MOVES`.
   - `shadeStep` distinguishes same-type siblings (Iron vs. Cobalt) as a
     family rather than reusing one exact color.
   - `variantOverride` only if this compound's real dimensionality/stacking
     doesn't match its type's default look (layered 2D materials ->
     `'layer'`, R-3m/R3c trigonal ones -> `'rhombohedral'` -- see
     `dev_notes/STYLE.md`). Every habit is a single body; a compound that
     would want a two-piece look is a hybrid recipe result, and draws as its
     two parents fused instead.
   - `shortName` only where a short chemical-formula/acronym form is
     genuinely worth authoring, not for every entry.
2. Add a `MATERIAL_BLURBS[name]` entry (`game/src/data/materialdex.ts`) --
   physically grounded per the section above. Not strictly required (an
   entry without one falls back to a generic per-type blurb,
   `TYPE_FALLBACK_BLURBS`), but a real content addition should have its own.
3. Check `game/src/data/quiz.ts`/`greetings.ts` for whether this material's
   type already has quiz/encounter flavor text, or needs its own.
4. Regenerate `docs/crystals.md`: `npm run docs` from `game/`. Never hand-edit
   inside its `<!-- GENERATED -->` block.
5. If `dev_notes/DESIGN.md`'s per-world table or crystal-database section enumerates
   specific example compounds for that world (rather than just linking out
   to `docs/crystals.md`), update it there too.
6. Typecheck (`npx tsc --noEmit -p .` from `game/`).

## B. Adding a new hybrid recipe

`HYBRID_RECIPES` (`game/src/data/materials.ts`) is a curated, named
parent-pair catalog, not a type-derived rule -- both parents must already be
real, named `WORLD_CRYSTALS` entries (never `WORLD_RIVALS`; rivals aren't
real compounds).

1. Author the result as a fully-specified `crystal(...)` (name/type/maxHp/
   moves all fixed here, not computed from the parents at combine time).
2. Add `{ parents: [nameA, nameB], result: <that crystal> }` to
   `HYBRID_RECIPES`. Same-type parent pairs are fine *only* because a named
   recipe explicitly covers them -- there's no general type-derived
   hybridization rule to lean on.
3. **The result must also appear in `WORLD_CRYSTALS[10]`.** Every
   hybrid-recipe result spawns as an ordinary wild in World 10 and nowhere
   else (worlds 1-9 never spawn one) -- add it there if no other recipe
   already put it in that pool.
4. Add a `MATERIAL_BLURBS` entry for the result, grounded per the section
   above -- for a fusion, ground it in whichever session the *recipe itself*
   conceptually anchors to, which often isn't either parent's own session.
5. Regenerate `docs/hybrids.md`: `npm run docs` from `game/`.
6. If `dev_notes/DESIGN.md`'s hybridization section (§5) enumerates specific named
   recipes rather than just pointing at `docs/hybrids.md`, update it there.
7. Typecheck.

## C. Adding a new guardian (rare -- only alongside a new world)

Every world 1-10 already has exactly one guardian, mid-corridor -- this
section applies only when adding a world past 10 (`BUILT_WORLDS` in
`game/src/scenes/OverworldScene.ts`), not to an existing world.

1. Extend `BUILT_WORLDS` and add a matching biome entry (`art/biomes.ts`)
   together (`dev_notes/CODEMAP.md`'s "World progression" section) -- also add
   `WORLD_NAMES` and a `WORLD_RIVALS` entry that both read as "which course
   topic is this," not a generic RPG name (check both tables together, a
   mismatched rival name is easy to miss).
2. New avatar builder in its own file: `art/<name>.ts`'s
   `make<Name>Avatar()`. Never a shared parameterized builder -- check
   `dev_notes/CODEMAP.md`'s "Guardians" list of existing motifs/colors so the new one
   reads as visually distinct from all of them, not just its neighbors.
3. New panel file: `scenes/panels/<name>.ts` exporting
   `show<Name>Panel(scene)`, wired into `WORLD_GUARDIANS[N].open`. Pick a
   panel stroke color that doesn't collide with the full assigned list in
   `dev_notes/CODEMAP.md`'s "Panel/dialogue UI" section (it enumerates every color in
   use) -- don't guess, that section is the source of truth.
4. Decide the guardian's actual mechanic. If it needs new persisted state,
   add it to `data/save.ts`'s `SaveData`/`defaultSave()`/
   `persistFromRegistry()` **together**, in the same change as the code that
   reads/writes it (`dev_notes/CODEMAP.md`'s "Registry-then-persist" pattern) -- and if
   you're renaming/replacing an existing key rather than adding a brand-new
   one, judge whether an old save needs a fallback to the previous key (real
   accumulated state, e.g. currency) or is safely self-healing (an empty
   list that just repopulates) before dropping the old key outright.
5. Add the `WORLD_GUARDIANS[N]` entry (`id`/`name`/`quote`/`avatar`/`tile` --
   `tile: 'middle'` matches every existing guardian; don't spawn it via a
   bespoke function, it goes through the shared
   `OverworldScene.spawnGuardianSprite` automatically once it's in this
   table).
6. If the guardian teaches passives, `docs/guardians.md`'s relevant table is
   generated from `data/passives.ts` -- run `npm run docs`, don't hand-edit.
   Update `dev_notes/DESIGN.md`'s guardian roster (§5 or wherever it's documented)
   either way.
7. Run the `verify-ui` skill on the new panel before calling it done -- a new
   panel is exactly the kind of change that needs an actual rendered check,
   not just a typecheck.

## After any of the above

- Typecheck.
- `npm run docs` from `game/` if you touched `materials.ts`/`passives.ts` --
  confirm the diff only reflects your data change, no unrelated drift.
- Run the `docs-sync-check` skill.
- Run the `verify-ui` skill if you touched a panel/scene layout.
