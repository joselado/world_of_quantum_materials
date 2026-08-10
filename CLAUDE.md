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
  mentors/story, tech stack, roadmap, open questions. Source of truth for game
  content/mechanics; edit it in place as the game evolves rather than starting a
  new doc.
- `STYLE.md` — visual conventions (sizes, colors, shapes, panel/motion rules).
- `CODEMAP.md` — where things live in the code: function names, file locations, and
  established patterns (e.g. "one avatar builder file per mentor," "new persisted
  state touches `defaultSave`+`persistFromRegistry` together") to follow before
  adding something new.
- `DEVELOPMENT.md` — build/run instructions, folder contents, where active
  development happens (`game/`).
- `README.md` — player-facing description of the game, for when you need the
  outside view rather than the dev view.

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
- Keep `DESIGN.md`/`STYLE.md`/`CODEMAP.md`/`DEVELOPMENT.md`/`README.md` in sync with
  the code as you go, and **write every edit to them as current state, not as a
  change log.** A reader with no history should be able to read any of these files
  cold and get a correct, uncluttered picture of how the game works *right now*.
  Concretely: don't write "X used to be Y," "no longer," "replaced the old Z,"
  "instead of the earlier W" — just state how it works. This applies on *every*
  edit, not as an occasional cleanup pass; check your own diff for this framing
  before finishing a task that touches these files. The one thing worth keeping
  from "why it changed" is genuine *rationale* that's still load-bearing for future
  decisions (e.g. "same-type pairs are still forbidden in general because fusing
  two of the same phase isn't a new state") — cut the narration of the change
  itself, keep the reasoning behind the current rule.
