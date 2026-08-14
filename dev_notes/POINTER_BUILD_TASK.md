# Build task — pointer parity

Make the game playable entirely by pointer, keeping the keyboard alongside it.
Delete this file once the work has landed, and move the rules in §1 into
`STYLE.md` at the same time — they are interaction conventions and belong there
once they describe something real.

**Ordering:** after the retheme (`WORLDS_BUILD_TASK.md`) and ideally after the
gate work in `HORIZON_BUILD_TASK.md` stage D. This touches every scene, and
touching every scene while ten worlds are being rewritten underneath is how
parallel conventions get born. The gate's board and challenge prompt are also
the clearest worked example of §1's interactable rule, so building them first
gives this task a pattern to follow rather than invent.

---

## 1. The rules

### The parity rule, in the form that can fail

**The game is completable, title to credits, with no keyboard attached.**

Stated as "every action reachable by keyboard is reachable by pointer" it
invites arguments about what counts as an action. Stated as above it is a
playtest anyone can run, and eventually a check that fails — see §5.

Parity is **additive**. The keyboard keeps working everywhere it works today,
with one deliberate exception: the mute shortcut is retired and mute moves into
the Settings station, where a pointer can reach it.

### Movement is hold-to-steer

Pointer position relative to the avatar sets direction — above is forward, to
the sides is a lane change — and a held pointer steps continuously. Release
stops.

**Not tap-a-tile-and-pathfind**, and the reason is not taste. Each world's map
shape is a physics motif that only exists if the player walks it as a decision:
World 1's two branches are spontaneous symmetry breaking *because the player
picks one*, and World 8 forks as fractionalization. Pathfinding chooses the
branch on the player's behalf and the topology becomes something the avatar does
offscreen. The overworld's one verb is walking, and a game whose only verb is
automated has no verbs left.

Hold-to-steer is also *more* phone-native than tap-to-move, and it removes three
problems tile-goal pathfinding would have created: no route solver, no
mid-path abort when an encounter fires (releasing is the abort), and no maximum
click depth (a direction has no depth).

If tap-a-tile is ever wanted anyway, the negotiated fallback is
**junction-stopping**: auto-walk only along unbranched stretches, halting at
every fork and returning control.

### Interactables: one rule, no special cases

**An object is clickable exactly while its HUD prompt is on screen, and clicking
it is identical to pressing the confirm key.**

Prompt visible means interactive; prompt absent means clicks fall through to the
world. The affordance is taught by legibility and enforced by the prompt, and it
ports to touch unchanged.

Scenery is always present — **it never spawns in at a proximity threshold.** A
signboard that pops into existence is an interface element in a fence-post
costume. The board at a world's pass is always there, depth-scaled, unreadably
small from far off; what arrives as the player approaches is *interactivity*,
alongside the HUD prompt, at the distance where the painted text becomes
legible. The rival's challenge prompt uses the same threshold grammar: the golem
is always visible, and challengeable only from the tiles where its prompt shows.

### Accidental input

Once moving *is* clicking, a press in flight can land on something that appeared
underneath it. Three rules, all structural rather than per-case patches:

- **Panels ignore pointer input for a short beat after opening, and discard any
  press that began before the panel existed.** Timestamp the press and compare
  against panel creation. Without this, an encounter firing mid-walk opens the
  battle panel under a tap already in flight and the player picks an option they
  never saw. `component-check`'s own history of mistaking its no-op click for a
  stuck panel is this same class wearing a test harness.
- **An object entering interactive range ignores clicks for the same beat**, so a
  press that began as movement never converts into an interaction.
- **Clicks on non-walkable terrain do nothing.** Do not snap to the nearest
  walkable tile: beside a chokepoint, nearest-walkable snapping turns a movement
  tap into a boss challenge. Dead clicks on scenery are correct — the world is
  allowed to not be a button.

---

## 2. The parity sweep

Hunt by class rather than by scene. The classes, in the order they are usually
forgotten:

1. **Advance and dismiss.** Buttons get built for choices; keys get left behind
   on the interstitials — advancing guardian dialogue, dismissing the story beat
   between worlds, closing a panel, the title screen's start prompt, stepping
   through post-battle explanation text. Invisible in normal play because
   everyone testing has a keyboard.
2. **Anything whose on-screen label names a key** — "Press H", and every
   sibling. Each such string should be, or sit beside, a click target.
3. **Settings and toggles** — mute (moving here from its shortcut, per §1) and
   wherever the three text-size presets are cycled. A text-size control behind a
   keystroke is unreachable on the phone, which is exactly where large text
   matters most.

**The mechanical version:** grep every scene for keyboard handler registrations
and require each one to name its pointer twin. That list is the task.

---

## 3. What the projection gives you free

The overworld projection **inverts exactly**: screen y maps monotonically to
depth, and x divides out by that depth's own scale. So turning a screen point
into a world position is a few lines against the one projection function
everything already routes through.

Hold-to-steer does not need this for movement, but the board and the golem are
world-space objects whose click targets do — hit-test them through the same
inverse rather than maintaining screen-space rectangles that drift from what is
drawn.

Note the invariant from the footing fix: all depths route through `projectTile`,
which applies the camera pullback internally. Hit-testing must use the same path
and must not re-apply it.

---

## 4. Out of scope, recorded so it is not lost

A phone port needs one thing this task does not cover: **iOS Safari will not
start an `AudioContext` without a user gesture**, and this game's soundtrack is
entirely procedural Web Audio. On a phone the music would silently never start
unless the engine resumes on first touch. Deliberately deferred; it is small,
but it is invisible on desktop and would present as "the port has no music."

---

## 5. Verification

- `npm run content-lint` and `npm run component-check` from `game/`, both.
  **Never** `npm run playthrough-check`. `tsc --noEmit` and `npm run build`
  clean.
- **Add a pointer-only `component-check` variant** that drives the game with no
  key events at all. This is what makes the parity rule enforceable rather than
  aspirational: a principle in a doc does not stop the next feature breaking
  parity, a check that fails does.
- Verify at all three text-size presets, and size prompts and controls for
  fingers rather than cursors — a 480-tall canvas leaves little room for error.
- Drive it headlessly with the `run-game` skill, which carries this machine's
  Node-18 workaround (system Node is 18, so Playwright and the `puppeteer` CLI
  both fail — use `puppeteer-core` against the cached Chrome-for-Testing
  binary). Give the worktree its own `npm install`; symlinking `node_modules`
  shares a Vite dep-optimization cache across sessions and produces phantom
  test failures.
- Exercise the accidental-input rules deliberately: a press in flight when an
  encounter fires, a press that began as movement as an object enters range, and
  a click on impassable ground beside a pass.

## 6. Docs

Per `CLAUDE.md`, in the same change, written as current state and never as a
change log: move §1's rules into `STYLE.md`, record the input model and the
pointer-only check in `CODEMAP.md` and `DEVELOPMENT.md`, and update `README.md`
and the tutorial's controls topic — which currently teaches arrow keys and the
mute shortcut, and will be wrong on both counts.
