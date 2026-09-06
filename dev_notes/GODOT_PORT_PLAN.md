# Build task — rebuilding the game in Godot 4

Plan for rebuilding `world_of_quantum_materials` on a new engine, with the
goals: **it should look great, stay developable by one person working with
Claude, and run in many places — desktop, mobile, and possibly consoles.**

Status: **proposal, with one decision still open** (the web path, below).
Nothing in `game/` changes until that decision is made. The current Phaser
build is unaffected and remains the shipping game.

---

## The two facts that decide the engine

**There are no assets to migrate.** The repo contains zero `.png`, `.mp3` or
`.ogg` files. The game's entire look is 9,918 lines of procedural drawing code
in `game/src/art/`, and its entire soundtrack is 2,534 lines of Web Audio
synthesis in `game/src/audio/`. A move to another engine does not import the
art — it rewrites it, in another language.

**The current distribution model is unusually good and hard to keep.**
`README.md` sells the game as: no account, no download, no permission to
install software, runs on a locked-down university machine, plus a single
offline `.html` a student double-clicks. `game/scripts/bundle.mjs` records why
that single file is possible at all — there are no assets to fetch, so "the
whole game" really is one script. No engine below reproduces that.

---

## The engine: Godot 4, GDScript

**Godot stores everything as plain text.** Scenes (`.tscn`), scripts (`.gd`)
and resources are all human-readable and diffable, so the whole project stays
editable from a terminal. This game exists because it can be built
conversationally with Claude; an engine whose project files are binary or
GUID-wired removes that. This is the deciding property, ahead of any rendering
feature.

**It reaches the targets.** Windows, macOS, Linux, Android, iOS and web export
out of the box; consoles via [W4 Consoles](https://www.w4games.com/w4consoles)
(Switch, PS5, Xbox Series), the middleware built by Godot's own founders, or via
a porting house.

**The genre precedent exists.** *Cassette Beasts* — a monster-collecting RPG
built in Godot, shipped on Switch and Xbox (ported by Pineapple Works) — looks
good without a large art team and is the closest existing analogue to this
game. Worth studying before starting.

**GDScript, not C#.** Godot 4 C# cannot export to web; the .NET runtime does
not run in the browser sandbox, and console C# coverage has lagged GDScript.
The export targets pick the language, not the TypeScript-to-C# resemblance.
If the web target is dropped (see the open decision), C# comes back on the
table.

### Why not Unity or Unreal

- **Unreal** has no web export at all (Epic dropped HTML5 at 4.24; the official
  browser answer is Pixel Streaming, i.e. paying for GPU servers). Blueprints
  and `.uasset` are binary, so a terminal-driven workflow cannot see the
  project. Also heavily overbuilt for a 2D turn-based RPG.
- **Unity** exports to web, but builds are tens of MB, need a served origin,
  and its scenes are YAML wired by GUIDs across per-asset `.meta` files —
  workable, but it pushes development into the GUI editor. Unity has no good
  immediate-mode 2D vector API either, which is exactly what `art/` is built
  on. **Unity is the right call only if consoles become a hard, near-term
  requirement**, where its first-party console support is more mature.

---

## Open decision: what happens to the browser version

Godot's web export is a real regression from what the game has today. Builds
run 30–40 MB; the single-file offline `.html` is not reproducible; and GitHub
Pages cannot send the COOP/COEP headers Godot 4 wants for threading, so the
options are a threads-off export, the PWA / `coi-serviceworker` workaround, or
moving hosting to something that supports custom headers (e.g. Cloudflare
Pages).

That lands directly on the game's current primary audience — a student on a
locked-down university machine.

**(a) Accept the regression.** One codebase. Web becomes a 30–40 MB load, or
students take the desktop build.

**(b) Freeze the Phaser build as the "classroom edition."** It works today and
needs no further development. The physics content (below) is shared between
both as JSON. The zero-install teaching tool stays standing while the ambitious
version is built beside it.

**Recommendation: (b).** The current game already does its teaching job, and
leaving it in place costs nothing. It also removes web from the Godot build's
requirements, which reopens C# and the better rendering modes.

This decision is not made yet — resolve it before phase 2.

---

## Art direction has to be named before any code

"Looks great" is an art-direction problem, not an engine problem. An engine
does not make a game look good; a committed style does, and a project with no
art budget that reaches for photoreal ships something worse than a
well-executed stylized game.

Two styles that work without an artist:

- **High-end 2D** — keep procedural generation, add Godot's Light2D, normal
  maps and shaders. The current look elevated rather than replaced.
- **Low-poly flat-shaded 3D** — simple geometry carried by strong lighting, a
  committed palette and post-processing.

What already exists and carries over unchanged: `WORLDS.md`'s light rule, the
per-world terrain and palettes, and the ten-world arc. **The rebuild starts
from a finished art-direction document, not from zero.** `STYLE.md`'s cost rule
(speed beats spectacle) still governs.

---

## Inventory: what survives, what gets rebuilt

Current tree, 40,655 lines of TypeScript:

| Area | Lines | Fate in the rebuild |
|---|---|---|
| `data/` | 7,818 | **Survives.** Export to JSON; loads into anything. |
| `world/` | 2,084 | **Mostly survives.** Generators are near-pure logic. |
| `audio/` | 2,534 | **Pre-rendered, not rewritten** (see below). |
| `art/` | 9,918 | Rebuilt on `_draw()`/`draw_polygon` + shaders. |
| `scenes/` | 17,400 | Rebuilt as Godot scenes. |
| `ui/` | 850 | Rebuilt; `mathtext.ts` is the hard part. |
| `game/scripts/` | 15 tools | Rebuilt headless (see below). |

**The crown jewel is `data/`.** `materials.ts`, `quiz.ts`, `passives.ts` and
`balance.ts` are the part that took real expertise — physics-vetted content,
every entry grounded per CLAUDE.md's rules. Dumping it to JSON is step 0 and
should happen **regardless of whether the rebuild proceeds**: it is pure
insurance and engine-independent.

**Audio is cheaper than it looks.** Do not port the 2,101-line scheduler.
Render the 20 scores and the SFX set once to `.ogg` and ship them as files.
This turns a rewrite into an export. The trade: the "Modern" arrangement and
any runtime-parameterised audio become baked variants rather than live
transforms, so each shipped variant costs a file.

**The verification harness is rebuildable, not lost.** Godot runs `--headless`
and has gdUnit4/GUT. `content-lint` and `quiz-topic-check` are pure data checks
against the JSON and port almost verbatim. `component-check`, `playthrough-check`,
`perf-check`, `shots` and `guide` become headless Godot scripts. `gen-docs`
reads the JSON and barely changes.

**`ui/mathtext.ts` (712 lines) is the one genuinely hard rebuild.** No engine's
text stack does radicals and stacked scripts; it is a custom layout job in any
target, and the quiz panels depend on it.

---

## Consoles: design so it is not foreclosed, do not buy in yet

The realistic picture:

- Nintendo's developer registration is **free and open to individuals** — no
  company and no shipped games required. Approval for Switch tooling takes days
  to weeks, then a devkit is purchased.
- **Switch 2 requires a pitch demonstrating use of its high-resolution graphics
  features.** A quantum-materials quiz RPG is a poor fit for that ask. Switch 1
  is the realistic target if any.
- **W4 Consoles is a paid commercial licence** (no public pricing found). On
  top of that sit age ratings (PEGI/ESRB) and Nintendo's lotcheck certification.

For a free educational game this is a business and legal project more than a
coding one. So: **do not pay into it up front, but do not design it out either.**

Concrete rules for the rebuild:

1. **Controller-first input with focus navigation, from day one.** The current
   UI has no gamepad support at all — it is click-targets and panels. Building
   focus navigation in costs nothing; retrofitting it is painful.
2. No mouse-only interactions, and no keyboard-only text entry on any path
   required to finish the game.
3. Respect 16:9 title-safe margins for panel layout.
4. Keep the save system abstracted behind one interface — console storage is
   not a filesystem.

---

## Phases

**Phase 0 — extract the content (do this regardless).** Export `data/` and the
world generators' tables to JSON, with a schema and a validator. Independent of
every decision below.

**Phase 1 — resolve the open decision** above, and name the art style.

**Phase 2 — vertical slice.** One world, one crystal, one full battle,
including a quiz panel with real formula rendering. This measures the two
unknowns — vector drawing and math text — before anything is committed. If the
slice does not look better than the current game, stop here; that is the whole
point of doing it first.

**Phase 3 — the art layer.** Port the geometry in `art/` behind a thin drawing
interface, world by world, against `WORLDS.md`.

**Phase 4 — scenes.** Overworld, Battle, Hub, panels. The largest block of work.

**Phase 5 — audio.** Render the scores to `.ogg`; wire the per-world arc.

**Phase 6 — harness.** Rebuild the checks headless before the game is declared
playable, not after.

**Phase 7 — platforms.** Desktop builds first, then mobile. Console only if the
game is finished and the business side has been separately decided.

---

## Risks

- **Scope.** ~33,000 lines of game-dev labour to redo. The physics content is
  safe; the rest is a genuine rebuild, and phase 2 exists to price it honestly
  before committing.
- **Losing the classroom audience.** Mitigated by option (b) above.
- **"Looks great" not landing.** The failure mode is a half-finished style in a
  more powerful engine looking worse than the finished style it replaced.
  Phase 2's stop condition is the guard.
- **Console sunk cost.** The design rules above are cheap; the licences,
  ratings and certification are not. Keep them separate decisions.
