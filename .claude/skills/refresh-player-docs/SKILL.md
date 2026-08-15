---
name: refresh-player-docs
description: Bring everything a player reads back in line with the game after a batch of updates -- regenerate the docs/ tables from game data, retake every screenshot from the running game, audit the hand-written prose for claims the code has outgrown, and rebuild guide.pdf. Use periodically after content/mechanics/art changes have landed, or whenever a world, guardian, stat, panel or terrain has been renamed or reworked. Not for a single in-flight change (docs-sync-check covers that).
---

# Refresh the player-facing docs

Four artifacts describe this game to players: the generated tables in
`docs/*.md`, the screenshots in `screenshots/`, the hand-written prose in
`README.md` and `docs/`, and `guide.pdf`. Three of the four are derived and can
be rebuilt; the fourth is prose and has to be read. This skill does all four in
the order that makes each one correct before the next consumes it.

Run this after a batch of updates has landed, not during one. For a single
change in flight, `docs-sync-check` is the right tool.

## The order matters

```
cd game
npm run docs     # tables  <- game data
npm run shots    # images  <- running game        (~90s)
# ...prose audit (below)...
npm run guide    # PDF     <- README + docs/      (needs pandoc + xelatex)
```

`guide.pdf` is an assembly of the other three, so it goes last. Rebuilding it
first just typesets stale material.

## 1. Generated tables

`npm run docs` rewrites everything inside `<!-- GENERATED -->` blocks from
`materials.ts`/`passives.ts`. Never hand-edit inside those blocks.

If it reports "updated" but `git diff docs/` is empty, the tables were already
current — the script rewrites unconditionally.

## 2. Screenshots

`npm run shots` regenerates every image `README.md` and `docs/` embed, driving
the game headlessly. Groups: `title`, `hub`, `worlds`, `guardians`, `battle`,
`encounters`; `npm run shots -- worlds guardians` runs a subset.

**Look at what it produced.** A shot that "worked" can still be useless, and
the script only catches the crude failure (a PNG under 5 kB is an empty frame
and fails the run). Real failures found this way have included a guardian panel
captured mid-animation with an effect plume across its own text, and a world
framed at its entrance so the shot was mostly the back-exit sign. Both were
fixed by changing *when* the capture happens, not by accepting the image.

Check at minimum: one world, one guardian panel, and any screen the recent
changes touched.

**A bad screenshot can be evidence of a real defect, not a bad capture.** A row
of pale slabs on World 8's horizon turned out to be World 9's distant self
breaking `WORLDS.md`'s own swallow rule after World 8's palette changed. If an
image looks wrong, establish which of the two it is before fixing the capture.

## 3. Prose audit — the part that isn't automatic

Nothing regenerates the hand-written sentences, and they drift silently. Sweep
for claims the code has outgrown. What to grep for depends on what changed, but
these catch most of it:

- **Renamed worlds, guardians, stats, moves.** Grep the old name across
  `README.md` and `docs/`. Expect legitimate survivors: a physicist's name in a
  quiz question is course content, not a stale reference to a guardian.
- **Counts.** "six stations", "three rows", "ten worlds" — any number in prose
  is a hostage. Prefer rewording to count-free phrasing over updating the
  number.
- **Terrain and atmosphere descriptions.** A reworked world leaves its old
  description in every list that enumerates the ten.
- **Mechanics described in words.** Damage rules, gates, respawn behaviour,
  what a station offers.

Write fixes as **current state, never a change log**, per `CLAUDE.md` — no
"used to be", "no longer", "replaced the old".

Also check `dev_notes/` while you are here. It drifts the same way and is what
the next agent reads first.

## 4. The guide

`npm run guide` assembles `guide.pdf` from `README.md` + `docs/`. It is
committed, and `README.md` links to it.

It needs `pandoc` and `xelatex` on PATH. Confirm the page count and spot-check
a page with a wide table and a page with images — those are where a markdown
change breaks typesetting rather than content.

## 5. Verify and commit

`content-lint` catches a rename that reached one data table but not its
sibling — exactly the failure a refresh can introduce. Run
`npm run component-check` and `npm run perf-check` too if any game code changed
alongside the docs; docs-only changes do not need them.

Per `CLAUDE.md`, **never run `playthrough-check`** unless the user asks in that
session.

Commit the regenerated images and PDF together with the prose fixes, so the
repo never holds a screenshot of a game that no longer exists.
