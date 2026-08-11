# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## What this repository is

`world_of_quantum_materials` is a Phaser 3 + TypeScript browser RPG (GBA-era
Pokemon/Golden Sun style) that teaches the material from Aalto's *Advanced Quantum
Materials* course. It used to live as a `video_game/` sub-directory inside the
course-materials repo; it now lives here as its own standalone project with its own
git history, pushed to `github.com/joselado/world_of_quantum_materials`.

## Where to start

Read these before touching `game/src/` — they're kept current and are much cheaper
to read than re-deriving the same context from the code:

- `DESIGN.md` — the living design doc: world map, type system, battle rules,
  guardians/story, tech stack, roadmap, open questions. Source of truth for game
  content/mechanics; edit it in place as the game evolves rather than starting a
  new doc.
- `STYLE.md` — visual conventions (sizes, colors, shapes, panel/motion rules).
- `CODEMAP.md` — where things live in the code: function names, file locations, and
  established patterns (e.g. "one avatar builder file per guardian," "new persisted
  state touches `defaultSave`+`persistFromRegistry` together") to follow before
  adding something new.
- `DEVELOPMENT.md` — build/run instructions, folder contents, where active
  development happens (`game/`).
- `README.md` — short player-facing description of the game (premise, how it
  plays, controls); deliberately light on mechanics detail, linking out to
  `docs/` for anything a player would need to look up rather than explaining
  it inline.
- `docs/quasiparticles.md`, `docs/crystals.md`, `docs/hybrids.md`,
  `docs/guardians.md` — player-facing reference docs `README.md` links to:
  the full move list, per-world crystal roster, hybrid recipes, and what
  each guardian teaches. Each one's tables (marked with `<!-- GENERATED -->`
  comments) are generated from the actual game data
  (`game/src/data/materials.ts`/`passives.ts`) by `game/scripts/gen-docs.mjs`
  — run `npm run docs` from `game/` rather than hand-editing a table, so the
  docs can't drift from the code that defines the content.

## Course-content cross-reference

`lecture_notes/` at the repo root is a **local-only symlink** (gitignored, not
pushed to GitHub) into the course-materials repo's `lecture_notes/` directory —
specifically machine-specific and not portable to another clone/machine. It exists
so Materialdex entries, quiz questions, and post-battle explanations can be adapted
from `lecture_notes/tex_extended/sessions/sessionNN.tex` rather than written fresh;
see `DESIGN.md` §8 and `game/src/data/quiz.ts` for how session numbers map to game
worlds. If the symlink is missing (e.g. on a fresh clone or a different machine), it
points at the Aalto Dropbox-synced course repo — recreate it locally, or skip that
cross-referencing step if the course repo isn't present.

## Syncing with GitHub

This repo *is* the GitHub-connected checkout — `origin` already points at
`github.com/joselado/world_of_quantum_materials`, branch `master`. There is no
separate mirror step or rsync process anymore (an earlier setup mirrored a
`video_game/` sub-directory from the course repo into a separate standalone
checkout; that's gone now that this repo *is* the standalone checkout). Commit and
`git push origin master` here directly like any normal repo.

## Editing workflow

- For content/mechanics changes: check `DESIGN.md` first for the current rules
  before changing battle/progression logic, so a change doesn't contradict a
  documented decision elsewhere.
- For code changes: check `CODEMAP.md` first so new code follows existing patterns
  (avatar builders, persisted-state plumbing, etc.) instead of introducing a
  parallel convention.
- Keep `DESIGN.md`/`STYLE.md`/`CODEMAP.md`/`DEVELOPMENT.md`/`README.md`/`docs/*.md`
  in sync with the code as you go — whenever a change touches something one of
  them describes, update that doc in the same change, not as a follow-up. **Write
  every edit to them as current state, not as a change log.** A reader with no
  history should be able to read any of these files cold and get a correct,
  uncluttered picture of how the game works *right now*. Concretely: don't write
  "X used to be Y," "no longer," "replaced the old Z," "instead of the earlier W"
  — just state how it works. This applies on *every* edit, not as an occasional
  cleanup pass; check your own diff for this framing before finishing a task that
  touches these files. The one thing worth keeping from "why it changed" is
  genuine *rationale* that's still load-bearing for future decisions (e.g.
  "same-type pairs are still forbidden in general because fusing two of the same
  phase isn't a new state") — cut the narration of the change itself, keep the
  reasoning behind the current rule.
- For `docs/*.md` specifically: never hand-edit inside a `<!-- GENERATED -->`
  block — change the underlying data in `game/src/data/materials.ts`/`passives.ts`
  and run `npm run docs` from `game/` instead, so the table stays derived from a
  single source of truth. The prose around those blocks is still hand-maintained
  like any other doc.
- The same "current state, not a change log" rule applies to comments inside
  `game/src/` itself, not just the doc files above. When a change swaps out a
  mechanic, write the surrounding comment to describe the mechanic as it now
  works — don't leave "used to be X," "no longer Y," "replaced the old Z,"
  "instead of the earlier W" narration in the code. The mechanics are still
  evolving, so a comment that explains last week's design instead of this
  week's becomes actively misleading, not just clutter. As with the docs, keep
  genuine load-bearing rationale (the *why* behind a current rule) — cut only
  the narration of the change itself.
