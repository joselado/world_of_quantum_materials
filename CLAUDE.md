# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## What this repository is

`world_of_quantum_materials` is a Phaser 3 + TypeScript browser RPG
that teaches the material from Aalto's *Advanced Quantum
Materials* course. It now lives with its own
git history, pushed to `github.com/joselado/world_of_quantum_materials`.

## Where to start

Markdown docs in this repo split into two folders by audience: `docs/` is
player-facing reference material (linked from `README.md`), and `dev_notes/`
is internal design/development documentation for whoever (human or Claude) is
working on the code. Read these before touching `game/src/` — they're kept
current and are much cheaper to read than re-deriving the same context from
the code:

- `dev_notes/DESIGN.md` — the living design doc: world map, type system,
  battle rules, guardians/story, tech stack, roadmap, open questions. Source
  of truth for game content/mechanics; edit it in place as the game evolves
  rather than starting a new doc.
- `dev_notes/STYLE.md` — visual conventions (sizes, colors, shapes,
  panel/motion rules).
- `dev_notes/CODEMAP.md` — where things live in the code: function names,
  file locations, and established patterns (e.g. "one avatar builder file per
  guardian," "new persisted state touches `defaultSave`+`persistFromRegistry`
  together") to follow before adding something new.
- `dev_notes/DEVELOPMENT.md` — build/run instructions, folder contents, where
  active development happens (`game/`).
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

Some of those files may sound contradictory with CLAUDE.md. If so, ask me for clarification.

## Course-content cross-reference

`lecture_notes/` at the repo root is a **local-only symlink** (gitignored, not
pushed to GitHub) into the course-materials repo's `lecture_notes/` directory —
specifically machine-specific and not portable to another clone/machine. It exists
so Materialdex entries, quiz questions, and post-battle explanations can be adapted
from `lecture_notes/tex_extended/sessions/sessionNN.tex` rather than written fresh;
see `dev_notes/DESIGN.md` §8 and `game/src/data/quiz.ts` for how session numbers map to game
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

- For content/mechanics changes: check `dev_notes/DESIGN.md` first for the current
  rules before changing battle/progression logic, so a change doesn't contradict a
  documented decision elsewhere.
- For code changes: check `dev_notes/CODEMAP.md` first so new code follows existing
  patterns (avatar builders, persisted-state plumbing, etc.) instead of introducing
  a parallel convention.
- Keep `dev_notes/DESIGN.md`/`dev_notes/STYLE.md`/`dev_notes/CODEMAP.md`/
  `dev_notes/DEVELOPMENT.md`/`README.md`/`docs/*.md`
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


## Enemies in short
### Ordinary wild encounters
Worlds 1-8 each draw their wild encounters primarily from a curated, dedicated set of types
(their course topic's own materials). A specific compound can also spawn in another world's
pool, beyond its primary topic, when its physics genuinely fits that other world's topic too —
not a blanket "any type" rule (that's World 9's own exception, below), but a per-compound call:
e.g. Iron/Cobalt (itinerant ferromagnets, primarily World 6/magnons) also spawn in World 1
(mean-field SSB) since itinerant ferromagnetism is a mean-field-broken-symmetry example in its
own right; Barium Titanate (primarily World 9, ferroelectric having no course topic of its own)
also spawns in World 1 since a switchable polarization is spontaneous symmetry breaking too,
just with a different order parameter than a magnet's. World 9 can spawn any type (it inherits
every non-hybrid material from worlds 1-8). World 10
spawns only hybrid-recipe results — every material reachable by fusing two crystals (Majorana,
§5) also spawns there as an ordinary wild, and nowhere else. Worlds 1-9 never spawn a
hybrid-recipe result as an ordinary wild.

### Boss (end of world)
Worlds 1-8 each have a rival with a fixed type. World 9's rival has a type rolled at random
every time the player reaches it. World 10's rival is "The Adapted," an adaptive AI boss
with no fixed type — a model of the player's own crystal.

## Development hierarchy
What is written in CLAUDE.md overrides anything said anywhere else. If I give an instruction
that seems contradictory to it, ask me how to proceed — that's the only case where you may
act against something in CLAUDE.md.


## General
README.md and the files it refers to for details (moves, Guardians, etc..) should be focused on the player,
meaning that they are about how the game is played, not about internal technical organization of the code.

## Dealing with contradictions
Sometimes during editing you may find contradictory instructions from different files. When
it is not clear which rule should be followed, please just ask me.


## Physics comes first
When adding the features or modifying them, physical correctness comes first. If there are unclear cases,
ask me directly. 
