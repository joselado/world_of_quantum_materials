---
name: docs-sync-check
description: Check that a content/mechanics change in world_of_quantum_materials kept DESIGN.md/CODEMAP.md/STYLE.md/README.md/docs/*.md in sync, written as current state rather than a changelog, per CLAUDE.md's documentation rules. Use before reporting a change to game mechanics, progression, UI, or persisted state as finished -- not needed for a pure bugfix that changes no documented behavior.
---

# Check doc sync before finishing a change

`CLAUDE.md` states a hard rule for this repo: whenever a change touches
something `DESIGN.md`/`STYLE.md`/`CODEMAP.md`/`DEVELOPMENT.md`/`README.md`/
`docs/*.md` describes, that doc must be updated **in the same change**, not
as a follow-up -- and it must be written as **current state**, never as a
changelog. Banned phrasing: "X used to be Y," "no longer," "replaced the old
Z," "instead of the earlier W," "previously," "now supports" framed as a
change rather than a fact. The one exception is genuine load-bearing
*rationale* ("same-type pairs are still forbidden because fusing two of the
same phase isn't a new state") -- that's the *why* behind a current rule, not
narration of the change, and should stay.

This rule is easy to satisfy for code you wrote yourself in the same sitting
and easy to silently violate in a larger or delegated (agent-authored) change,
or when a change lands in an isolated worktree and gets merged later. This
skill is a mechanical pass to catch what memory alone misses.

## 1. Scope the diff

```
git status --short
git diff master...HEAD --stat   # or: git diff --stat, for uncommitted work
```

Get the actual list of changed files. If this is reconciling a merged
worktree branch or an agent's change you're reviewing after the fact, diff
against the commit/ref just before that change landed, not just the working
tree.

## 2. Map changed code to doc sections that describe it

For each changed file/function/scene under `game/src/`, grep the docs for
existing mentions of it -- these are the sections at risk of going stale:

```
grep -rn "<ChangedFunctionOrSceneName>" DESIGN.md CODEMAP.md STYLE.md README.md docs/*.md
```

Concretely:
- Battle rules, world/progression mechanics, guardian mechanics, hybrid
  recipes, type chart -> `DESIGN.md`.
- Visual conventions (sizes, colors, panel layout, sprite behavior) for
  whatever scene/panel you touched -> `STYLE.md`.
- Function names, file locations, established patterns (e.g. "one avatar
  builder file per guardian," "new persisted state touches
  `defaultSave`+`persistFromRegistry` together") -> `CODEMAP.md`.
- Anything player-facing (move list, crystal roster, hybrid recipes, what a
  guardian teaches) -> `docs/quasiparticles.md`/`crystals.md`/`hybrids.md`/
  `guardians.md`, and `README.md` if it's a premise/controls-level change.
- Build/run/verification instructions -> `DEVELOPMENT.md`.

If a changed piece of code has a doc match above and the diff from step 1
does **not** touch that doc, that's a stale-doc flag.

## 3. Check for GENERATED-block drift

If the diff touched `game/src/data/materials.ts` or `passives.ts`, the
`docs/*.md` tables inside `<!-- GENERATED -->` markers must come from
`npm run docs`, never a hand edit:

```
cd game
npm run docs
git diff docs/
```

If this produces changes beyond what's already committed, either the
generator wasn't run after the data change (run it, commit the result) or
someone hand-edited inside a `GENERATED` block (revert the hand edit, let the
generator own that text again). If it produces no diff, generation is
already in sync -- no action needed.

## 4. Scan doc edits for changelog phrasing

For whatever doc sections *were* edited in this diff, check the added lines
specifically (not the whole file -- old rationale predating this change is
fine to keep):

```
git diff master...HEAD -- DESIGN.md CODEMAP.md STYLE.md README.md docs/ DEVELOPMENT.md \
  | grep -E '^\+' \
  | grep -inE "used to be|no longer|replaced the old|instead of the earlier|previously (was|had|used)|old version|the old (behavior|way|approach)"
```

Any hit is a candidate rewrite: state the *current* rule/behavior directly,
keep only genuine *why*-rationale if there is any worth keeping, drop the
narration of what changed.

## 5. Report

A short checklist, not prose:
- Which docs were touched, which weren't but plausibly should have been
  (from step 2) -- for each untouched-but-plausible one, say briefly what's
  now stale in it.
- GENERATED-block status (in sync / needed regenerating / found a hand-edit).
- Any changelog-phrasing hits from step 4, with the line and a suggested
  current-state rewrite.
- If everything checks out, say so plainly rather than padding the report --
  this is a gate, not a place to manufacture findings.

Fix what step 5 surfaces before considering the change done, the same way
you'd fix a failing typecheck.
