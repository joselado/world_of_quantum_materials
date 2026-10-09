# Build task, the promotional video

A three-minute trailer for the whole game, cut the way a video game trailer is
cut: a hook, the title, the mechanics in the order a player meets them, the
worlds and their bosses escalating, the final boss as the climax, and a closing
card saying where to play. Everything on screen is captured from the running
game, nothing is mocked up, and the music is the game's own. This file is the
plan; the capture, the assembly and the review happen in a later session, and
every recipe that session needs is written here so that nothing depends on a
scratchpad that has since been cleared.

The text question is settled as follows. The video carries on-screen text and no
voice-over: a handful of full-frame cards on black at the seams between
sections, and short lower-third captions over the gameplay, with the exact
wording of every line in the shot list below. The lines are written so that they
double as a voice-over script, should one ever be recorded. The ffmpeg build on
this machine has no `drawtext` filter, so cards and captions are rendered in the
browser, in the game's own Courier face and panel colours, and screenshotted
like any other frame.

The deliverable is one file, 1920x1080, 30 frames per second, H.264 video with
AAC audio, about 180 seconds long, hosted rather than committed (see
"Housekeeping"). A 2x preview render of the same cut is what the owner watches
first, since it takes a fraction of the time.

---

## What the video has to show

The brief lists: a hint of the story, how battles go, what the moves are, that
you can be different crystals, that you can become a hybrid, what the guardians
do, the bosses, and the final boss. Each has a beat of its own below, in that
order, because that order is also the order of play, and a trailer that follows
the order of play reads as a game rather than as a feature list.

The story is hinted and never explained. `docs/storyline.md` marks the line
exactly: its premise section is what the game tells a player in the first
minute, and everything from "The road" on is a spoiler. Every card line below is
written from the premise section's vocabulary (a Decoherence, worlds losing what
they are, a quantum material walking into each phase of matter), and nothing
states what the Decoherence is, what the golems were, or what the Adapted is.
The finale beat shows the thing and says the least it can about it; how much of
it to show is the owner's first decision (see "Decisions for the owner").

---

## The cut

Cuts inside a montage land on beats of the score under them, which at 96 beats
per minute puts a cut every 1.25 seconds (two beats) and a card change every
2.5 seconds (a bar). Reading time is the other constraint: a card holds for at
least 2.5 seconds, and any in-game panel with a sentence on it holds for at
least 3 seconds, so a Brief rival taunt or an encounter question is readable.

| Time | Beat | On screen | Text | Music |
|---|---|---|---|---|
| 0:00 to 0:03 | Cold open | Black | Card: "A Decoherence is spreading through the quantum material worlds." | World 1 overworld fades in |
| 0:03 to 0:15 | The road | Ten worlds in order, 1.25 s each, walking forward, morning to no sky at all | Caption, 0:03 to 0:08: "Ten worlds. One road. The light dies along it." | World 1 overworld |
| 0:15 to 0:19 | Title | The title screen, its map and showcase crystals | Caption under the title: "You are a quantum material." | World 1 overworld |
| 0:19 to 0:31 | Explore and get ambushed | Silicon walking the Mean Fields, a qumatessence pickup, a wild Nickel Oxide's panel with its question, the right answer picked, the boost halo | Caption over the panel: "Every wild crystal is a real compound, and it asks a question before it fights." | World 1 overworld, the battle score starting on the cut into battle at 0:28 |
| 0:31 to 0:52 | Battle | Phonon Beam vs Nickel Oxide; Yttrium Iron Garnet's Magnon Wave into Bi₂Te₃ at double damage; a fast crystal swinging twice; the finishing blow and the victory panel with its physics note | Captions: "Every attack is a real quasiparticle." then "A crystal that cannot host it takes double damage." | World 1 battle |
| 0:52 to 1:04 | The moves | The Lab's Moves station, six moves on its stage, 2 s each | Caption: "Phonons, magnons, spinons, Majorana modes. Your lattice decides which ones you can throw." | World 1 battle |
| 1:04 to 1:18 | Be any crystal | Dresselhaus's panel, then the player wearing Graphene, Bi₂Te₃ and Yttrium Iron Garnet in three worlds | Card: "Become any crystal you have defeated." Caption: "Its habit, its colour, its quasiparticles." | World 6 overworld |
| 1:18 to 1:30 | Hybrids | Majorana's panel previewing the HgTe/CdTe Quantum Well, the hybrid walking the Devouring Mirror in its aura, a Helical Lock thrown | Card: "Or fuse two into a crystal found nowhere else." | World 6 overworld |
| 1:30 to 1:35 | The guardians | The Lab with all ten guardians standing in its corners | Card: "Ten guardians wait along the road, each bending one rule." | World 6 overworld |
| 1:35 to 2:00 | Guardians in motion | Bloch's map, Landau's question mid-battle, Kondo's cloud, Anderson's impurity, Skłodowska-Curie's three questions and the meteor | One caption each, see the beat | World 4 battle |
| 2:00 to 2:22 | The bosses | The approach to World 3's golem, its taunt page, the boss banner fight, the pass clearing onto World 4, World 5's golem on the ice | Captions: "A golem holds every pass." then "Polycrystalline: a thousand grains fused into one." | World 4 battle |
| 2:22 to 2:50 | The final boss | The Mirror's corridor and horizon, The Adapted wearing your crystal, it reshapes on each hit, the later stages as the owner decides | Captions: "Something has watched you walk every world." then "It is a model of you." | World 10 overworld |
| 2:50 to 3:00 | Close | The title screen | End card: the title, "Free, in your browser, nothing to install.", the address, "Built on Aalto University's Advanced Quantum Materials course." | World 10 resolves into World 1's closing chord, or silence |

The budget sums to 180 seconds. What follows is each beat in detail: what the
frame shows, why that compound and that move, and the recipe that drives the
game into it.

### Cold open and the road, 0:00 to 0:15

The single most distinctive thing the game has is the light rule, ten worlds
that are one road along which the day dies, so that is the hook. Ten shots of
1.25 seconds, 12.5 seconds in all with the title absorbing the half second, each a forward walk from a little past the world's near pass,
cut in order: wheat under morning, the colonnade at midday, the lit ledges, the
storm, the ice, the aurora, the lanes with no sky, the fog, the magma, the
network. The caption drops out after the fourth world and the rest plays
silent against the music. World 10's shot is taken from near its far end rather
than its start, so that the Adapted stands in the throat and the mirror horizon
is in frame.

Recipe: for each world N, seed with `visitedWorlds` holding 1 to N,
`worldLoreSeen` holding every world, start Overworld with `{ world: N }`, step
20 frames to let the terrain settle, then run 38 frames calling `tryMove(0, -1)`
whenever `moving` and `dialogueActive` are both false. For World 10 first set
`playerTile` and `camPos` to `goalTile` moved seven rows back toward the player
and step five frames before walking. The pass board, the golem and the horizon
are all drawn by the scene; nothing is staged.

### Title, 0:15 to 0:19

The title scene as it is, its baked map and the showcase crystals bobbing, for
3.5 seconds, with the caption composited below the mode picker. Recipe:
start Title, run 120 frames.

### Explore and get ambushed, 0:19 to 0:31

Silicon, the starting form, walking the Mean Fields with the forest hemming the
path and one qumatessence pickup taken in passing (3 s). Then the ambush: the
wild Nickel Oxide's panel, its greeting and its mean-field question, held long
enough to read (5 s), the right answer clicked, the "Attack boosted!" halo on
Silicon (1 s), and the cut into battle (3 s). Nickel Oxide is the right first
opponent because it is World 1's own compound and its question is the course's
first topic.

Recipe: seed `playerForm` null (Silicon), start Overworld `{ world: 1 }`, close
any lore dialogue, walk 75 frames, then call `showEncounter(findMaterialByName('Nickel Oxide'))`.
The panel is built by `renderEncounterPage`, so the correct option is the
button whose text equals `getWorldQuestion(1, 'Nickel Oxide').correct`; walk
the scene's children for the Text object with that string and emit
`pointerdown` on it. The scene then calls `startBattle(material, 1.5)` itself,
which is the boosted multiplier, and the halo is `addBoostHalo` in the battle.

### Battle, 0:31 to 0:52

Four shots. First, the opening exchange of the fight just started: the move
menu, `playerAttack('thermalFluctuation')`, the Phonon Beam effect, Nickel
Oxide's reply (5 s); this is the fight where nothing lands double, which is the
point of World 1. Second, the rule itself: the player as Yttrium Iron Garnet in
the Winding Borders throwing `magneticField` (Magnon Wave) into a wild Bi₂Te₃,
the menu's "!!2x" tag, the hit and the log line "No natural defense against
this!" (6 s). The physics holds: Yttrium Iron Garnet is an insulating magnet
and hosts magnons, Bi₂Te₃ is a quantum spin Hall insulator with no magnetic
order and hosts electron, helical and phonon excitations only, so the magnon
has nothing to couple to (the generated table in `docs/quasiparticles.md` is
the authority, and every other matchup below was checked against it the same
way). Third, momentum: a fast crystal swinging twice in a round, the "Turns"
row counting down, each swing its own pick (4 s). Fourth, the finishing blow,
the victory panel and the physics note under it (6 s).

Recipe: shot one continues the ambush capture. Shot two seeds `playerForm`
Yttrium Iron Garnet, `unlockedMoves` holding `magneticField`, starts Overworld
`{ world: 3 }`, calls `startBattle(findMaterialByName('Bi₂Te₃'), 1)`, steps 20
frames, then `playerAttack('magneticField')` and runs 70 frames. Shot three
seeds `playerStats` with Momentum well above the opponent's (20 against a
World 1 wild) so `currentHitOrder` gives the player two swings. Shot four seeds
Energy high enough that one more hit empties the bar, so `endBattle(true)`
raises the panel; run 90 frames after the attack.

### The moves, 0:52 to 1:04

The Lab's Moves station, which exists for exactly this: each move plays on its
own stage over a line naming the quasiparticle it throws. Six moves, two
seconds each, chosen for six different looks and six different physics: Phonon
Beam, Magnon Wave, Spinon Swap, Majorana Split, Chiral Current, Higgs
Oscillation.

Recipe: the station lists only what the current form can host
(`getBattleMoves` in `data/materials.ts` filters `unlockedMoves` through
`hostableMoveIds`), so the six picks need three forms. Seed `unlockedMoves`
with `thermalFluctuation`, `magneticField`, `entanglementSwap`,
`decoherenceWave`, `chiralCurrent`, `higgsOscillation`, then for each pick seed
`playerForm` to a host, start Hub, call `showMovesPanel(scene)` from
`scenes/panels/hubStations.ts`, emit `pointerdown` on the move's list entry
and run 60 frames: Silicon for Phonon Beam, Yttrium Iron Garnet (insulating
magnet) for Magnon Wave, Herbertsmithite (quantum spin liquid) for Spinon Swap,
and Uranium Ditelluride (Chern superconductor, hosting chiral, Higgs and
Majorana excitations together) for the last three. Stop the preview
(`stopMoveEffectPreview` in `art/moveEffectPreview.ts`) before the next pick so
two effects never overlap.

### Be any crystal, 1:04 to 1:18

Dresselhaus's panel with its list of defeated crystals and the selected one
drawn beside its price (4 s), then three cuts of the player wearing a different
form in a different world, each walking forward for 3 s: Graphene, a thin sheet
over its own shadow, in the Stone Lattice; Bi₂Te₃ on the Winding Borders;
Yttrium Iron Garnet on the Broken Coast. Three habits, three colours, three
movesets, which is what the caption says.

Recipe: seed `defeatedMaterials` with those compounds and `metGuardians`
including Dresselhaus, start Overworld `{ world: 3 }`, call
`openGuardian(guardian)` with the Dresselhaus entry of `WORLD_GUARDIANS` (a
private static of the scene class in TypeScript, read at runtime as
`scene.constructor.WORLD_GUARDIANS`), run 120 frames; then for each form seed `playerForm` and start Overworld in its
world, walk 90 frames.

### Hybrids, 1:18 to 1:30

Majorana's panel previewing the HgTe/CdTe Quantum Well: the two parents, the
fused result, the price (5 s). Then the hybrid itself walking the Devouring
Mirror in the glow that is its Hybrid Aura, wild hybrids around it (4 s), and in
battle throwing a Helical Lock, the quantum spin Hall edge mode, into one of them
(3 s).

Recipe: seed `defeatedMaterials` with HgTe and CdTe, start Overworld
`{ world: 5 }`, `openGuardian` with the Majorana entry, emit `pointerdown` on
the "HgTe/CdTe Quantum Well" list entry, run 150 frames. Then seed `playerForm`
to the quantum well, start Overworld `{ world: 10 }`, walk 120 frames, and
`startBattle` against a World 10 wild, `playerAttack('helicalCurrent')`.

### The guardians, 1:30 to 2:00

First the room: the Lab with every guardian met, ten figures in its upper
corners, over the card (5 s). Then five of them in motion, each in the act that
defines them, with one caption apiece:

- Bloch, 4 s: his panel, the map with the visited worlds named and the chosen
  one ringed, and the fold to another world. Caption: "Bloch folds the road."
- Landau, 6 s: `playerAttack('skyfallBeam')` in a battle raises the Analytic
  question panel (3 s), the right answer, the lance landing at double strength
  with its own effect (3 s). Caption: "Landau asks for the formula first."
- Kondo, 3 s: `playerAttack('spinScreening')`, the cloud rising on the
  player's own crystal. Caption: "Kondo screens a quantum number."
- Anderson, 3 s: the player's crystal carrying a doped-in impurity seated in
  its base, out on the map, with Anderson's panel previewing the same.
  Caption: "Anderson dopes an impurity in."
- Skłodowska-Curie, 9 s: `playerAttack('ultimateMeteor')`, three questions in
  a row (about 1.5 s each, the first held long enough to read), then the meteor
  falling out of the sky with the arena camera pulling back (4.5 s). Caption:
  "Skłodowska-Curie: three questions, then the sky falls."

Noether, Dresselhaus, Majorana, Feynman and Franklin are already on screen in
the Lab shot, and Dresselhaus and Majorana had their own beats, so the five
chosen for motion are the five whose act is a thing that happens rather than a
list. Recipe: the Lab shot seeds `metGuardians` with all ten ids and starts Hub
(120 frames). Bloch and Anderson use `openGuardian` in their worlds, with
`andersonDopant` seeded for the rider. Landau's shot seeds `unlockedMoves` with
`skyfallBeam` and answers the question panel the way the encounter is answered,
by emitting `pointerdown` on the correct option's Text. Kondo seeds
`unlockedMoves` with `spinScreening` and `kondoActiveMove` to the same id, since
the battle menu shows the one cloud that key names and no other. Skłodowska-Curie seeds `ultimateMeteor`
into `unlockedMoves` (untuned it casts as a phonon, which every form hosts, so
no tuning key is needed) and answers three panels in turn. Every guardian shot runs in a battle or a world where the
player's current form can host the move, else the game refuses the pick.

### The bosses, 2:00 to 2:22

One golem followed end to end, then a glimpse of a second. The approach: walking
the last rows of the Winding Borders toward the Polycrystalline Bismuth
Telluride Golem filling the pass, the road running on behind it (4 s). The
taunt page: the giant portrait and one Brief line (4 s). The fight: the rival's
health bar as a banner across the top of the screen, the golem's decohered
helical attack, a hit landing on it (6 s). The pass clearing: the gap showing
the Storm Flats' colours, the board naming the next world, the crossing (4 s).
Then 4 s of the Polycrystalline YBCO Golem out on the far ice of the Vortex
Glacier, mid-fight, so the video shows that every world has one and each is its
own compound.

Recipe: seed `playerForm` Yttrium Iron Garnet (its magnon lands double on the
Bi₂Te₃ golem, the same physics as the battle beat), start Overworld `{ world: 3 }`,
set `playerTile` and `camPos` ten rows short of `goalTile`, walk to the goal;
call `showRivalEncounter()` for the taunt page and run 120 frames; then
`startBattle(getWorldRival(), 1, true)`, 20 frames, `playerAttack('magneticField')`,
run 90 frames. For the clearing, seed `rivalDefeated[3]` true and start Overworld
`{ world: 3, regenerate: true, enterFrom: 'goal' }` (the goal landing only
applies together with `regenerate`), run 60 frames looking through the open
pass, then `confirmGate()` and run through `crossPass()` into World 4. World 5's
shot seeds a form whose move lands on a superconductor (Herbertsmithite's
`entanglementSwap`, a spinon into a superconductor that hosts electron, Higgs
and phonon only) and repeats the fight recipe in World 5.

### The final boss, 2:22 to 2:50

The Devouring Mirror's corridor first: the network ground sparking on either
side of the road, and the black horizon behind the pass showing the player's own
crystal back, made of the same network (4 s, the first caption). Then The
Adapted standing in the throat wearing the player's own crystal (3 s). The
fight: a hit lands and the Adapted reshapes, the transmute glow and the swap
into a real compound that hosts what was just thrown, twice (7 s, the second
caption). What follows depends on the owner's first decision: with the
recommended option, the stage screen's title "The Model of You" (1 s), the
network figure in the player's shape and colour (3 s), then the third stage's
smoke, the arena pulled back, the second star network filling the sky, and an
Ultimate falling on the player (8 s), then black (2 s). No card explains any of
it; the stage titles are the game's own and are the most the video says.

Recipe: seed `playerForm` to a form with two hostable classes (Yttrium Iron
Garnet), `rivalDefeated` with 1 to 9 true, start Overworld `{ world: 10 }`, walk
the last rows for the corridor shot. `startBattle(getWorldRival(), 1, true)` sets
`adaptedForm` in the battle scene and `finaleStage` to 1. `playerAttack('magneticField')`,
run 80 frames to see `transmuteAdapted` play, attack again, run 80 more. For
the later stages set `opponentHp` to 1 and attack, which routes through
`checkEndOrContinue` into `advanceFinaleStage` and raises the stage panel; emit
`pointerdown` on its button ("Face it", then "Battle!"), which is what calls
`standFinaleForm`. For the Ultimate seed `epoch` 3 before the battle starts, let
the opponent act (`runNextSlot` after the player's pick) and run 120 frames.
`storyScreensEnabled` must be on or the stage screens do not appear.

The cliff with the map below is the ending, not the boss, and the brief asked
for the boss; the cut leaves it out unless the owner chooses otherwise (second
decision).

### Close, 2:50 to 3:00

The title screen again, held, with the end card composited over its lower half:
the title line, "Free, in your browser, nothing to install.", the address
`joselado.github.io/world_of_quantum_materials`, and "Built on Aalto
University's Advanced Quantum Materials course." Recipe: start Title, run 300
frames.

---

## The cards and captions

Two kinds. A full-frame card is white text centred on black, used at the cold
open, at "Become any crystal", at "Or fuse two", at "Ten guardians", and at the
close; each fades in and out over 0.3 s. A lower-third caption is one line in
the game's panel style (the panel background and gold accent from `ui/theme.ts`)
across the bottom of the frame over gameplay, fading the same way, and never
covering the battle log or the move menu, which sit in the bottom corners, so
it is placed just above them. The face is Courier, the game's own prose face
(`ui/mathtext.ts`), at a size that reads at 1080p from a phone.

Rules the lines obey, to be rechecked on every edit: no dashes of any kind, no
exclamation marks, no citations, no game structure (no world numbers, no type
ids), physics in plain words, nothing from the spoiler side of `docs/storyline.md`.
Every line in the table above was written against those rules; a replacement
line is held to them too.

Rendering: a single static page, `game/scripts/promo-cards.html`, with one
`<section>` per card and caption, each sized 1920x1080 with a transparent
background for captions and black for cards; `promo.mjs` opens it in puppeteer
and screenshots each section to `promo/cards/<id>.png`. Cards become short
clips with ffmpeg's `fade` filter; captions are laid over the gameplay with
`overlay` enabled between their start and end times, their alpha faded in and
out.

---

## The music

The game's scores are procedural Web Audio (`game/src/audio/music.ts`), so there
is no file to drop in; the cues are rendered offline from the same code that
plays them in the game. Five cues, crossfaded over one bar at each seam:

| From | To | Score | Why |
|---|---|---|---|
| 0:00 | 0:28 | World 1 overworld, C Ionian, 96 bpm | The morning the road starts in; the montage cuts on its beats, and the cue runs through the walk and the ambush |
| 0:28 | 1:04 | World 1 battle | Starts on the cut into battle, and drives the battle and the moves |
| 1:04 | 1:35 | World 6 overworld, C Ionian, 116 bpm | The false calm, World 1's own key returning, under crystals, hybrids and the guardians' room |
| 1:35 | 2:22 | World 4 battle, 132 bpm | The crash every fourth bar lands under the Ultimate and the golems |
| 2:22 | 2:52 | World 10 overworld, F# Lydian, 158 bpm | The lead answered a bar later by an exact copy of itself, the world modelling the player, under the Adapted |
| 2:52 | 3:00 | A tonic chord of World 1's score held and fading, or silence | The close |

Classic against Modern is the owner's call (third decision); Classic is the
recommendation, because it is the sound the game identifies itself by.

The engine has the hook this needs: `music.renderScore(which, style, seconds)`
in `game/src/audio/music.ts`, beside `play()`. `play()` schedules a score loop by
loop with a timer against the live `AudioContext`, and a timer cannot drive an
`OfflineAudioContext`, whose clock only advances while it renders, so the hook
builds an `OfflineAudioContext` at 44100 Hz of the requested length, the same
master bus and ambience bus the live engine plays through, schedules every
loop that fits the length up front from time zero, and returns the rendered
`AudioBuffer`; the live engine's own context, buses and timers are not
involved. A length that is a whole number of loops ends on a loop seam, which
is what a crossfade wants. `promo.mjs` calls it through `page.evaluate`,
encodes the buffer to a 16-bit PCM WAV in the page (a few lines of
JavaScript) and writes it to `promo/audio/<cue>.wav`.

Hit sounds are a second pass and optional: `promo.mjs` already knows the stepped
clock time at which it called each `playerAttack`, so it can log those times per
segment, and the assembly can place pre-rendered one-shots from `audio/sfx.ts`
(rendered through the same offline route) at the impact offsets. The first
render ships without them; whether they are worth adding is judged on the
preview.

---

## The capture pipeline

The script is `game/scripts/promo.mjs`, committed, run as `npm run promo` for
the whole cut or `npm run promo -- road battle finale` for named segments, and
written the way `shots.mjs` is: Chrome auto-detected from puppeteer's cache,
the dev server started if `:5173` is not up, the game loaded with
`?renderer=webgl`, every state reached by seeding the registry and calling
scene methods rather than by clicking through the interface, so a segment is
reproducible and does not depend on a run of play going a particular way.

The frozen clock. Headless Chrome runs the game's own loop at a few frames per
second, and the component checks had to learn to wait on signals rather than
time because of it. The recorder sidesteps the problem: after boot it calls
`game.loop.sleep()` and then advances the game by hand, `game.step(t, 1000/30)`
with `t` incremented by a thirtieth of a second per call, taking one screenshot
per step. Every tween, bob and effect then runs at exactly 30 frames per second
of game time no matter how slow the machine is, and a segment comes out the
same length on every run. Scene changes stop every active scene first
(`Title`, `Hub`, `Overworld`, `Battle`) and start the wanted one with its init
data.

The raster. The canvas is 854x480 and the deliverable is 1920x1080, and a
`deviceScaleFactor` alone yields a blurred upscale. The genuine high-resolution
raster is the recipe that produced the README's 4x title image: set the
viewport to 854x480 at `deviceScaleFactor` N, patch
`HTMLCanvasElement.prototype.getContext` before the page loads so every WebGL
context's `viewport` and `scissor` multiply their four arguments by N, after
boot set `game.canvas.width` and `height` to N times the canvas size while the
CSS size stays 854x480, and call `setResolution(N)` on every Text object,
walking every active scene's containers. Panels and battles create new Text
objects after the walk, so the recorder re-walks after every driven action and
every scene start. N is 4 for the final render (3416x1920 frames, downscaled to
1920x1080 with lanczos, which is crisp) and 2 for previews (1708x960, scaled up
by 1.124, soft but fast). Before capturing the whole cut at 4x, time one
segment: 5400 frames of 3416x1920 PNG screenshots may take 30 to 45 minutes and
about 5 GB, which the disk has, and the number decides whether the final render
runs in the foreground or in the background.

Segments. Each beat above is one or more segments, each with its own frames
directory `promo/segments/<name>/f0001.png` and its own clip
`promo/segments/<name>.mp4`, so a segment that comes out wrong is recaptured
alone. Every segment also writes a contact sheet,
`promo/sheets/<name>.png`, every fifteenth frame tiled eight across, which is
how a segment is checked by eye before anything is assembled.

Assembly. Frames to clip:

```
ffmpeg -framerate 30 -i f%04d.png -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -crf 18 -pix_fmt yuv420p segment.mp4
```

Clips to cut: cards and clips joined with the concat demuxer where the cut is
hard, `xfade` over 0.4 s where a section dissolves (into the title, into the
guardians' room, into the finale, into the close), captions laid on with
`overlay`, the audio cues joined with `acrossfade` over one bar each and the
whole mixed at `-shortest`, encoded with `libx264 -crf 18` and `aac -b:a 192k`,
`-movflags +faststart` for streaming. The ffmpeg binary is the static 7.0.2 that
`imageio_ffmpeg` ships, at
`~/apps/anaconda3/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`;
there is no `ffmpeg` on the path and no `ffprobe` at all, so durations are
read with `ffmpeg -i`. The cut's timing lives in one table at the top of
`promo.mjs` (segment, start, duration, caption id, caption window), and the
assembly is derived from it, so moving a beat is one edit.

Settings to seed, or panels come out unreadable or missing: `storyScreensEnabled`
true (the taunt page and the finale stage screens are story screens),
`storyLength` brief (a Detailed taunt is not readable in four seconds),
`fontScale` the Normal preset, `tutorialTipsSeen` every id (a tip popup would
otherwise interrupt a shot), `tutorialTipsEnabled` false as a second guard,
`worldLoreSeen` every world (no lore screen is shown in the cut), `musicStyle`
irrelevant to the frames, `superpositionMode` false so prices and unlock states
are the real ones, and `epoch` 1 everywhere except the Quantum Adapted's
Ultimate shot. The full key list is `defaultSave` in `data/save.ts`; a seed sets
only what a shot needs and leaves the rest at the defaults.

---

## Checks before it is done

- Each segment's contact sheet looked at, for a debug state the seed left (a
  "???" in a list that should be filled, a guardian slot empty, a panel at the
  wrong text size) and for anything clipped at the frame edge.
- The 2x preview watched end to end by the owner before the 4x render starts.
- Every card and caption read once more against the rules in "The cards and
  captions", and the end card's address opened in a browser.
- The final file's length within two seconds of 180, its audio present and
  aligned (the ambush's battle score starts on the cut into battle, the
  finale's cue on the cut to the Mirror), and the file playing in a browser as
  well as in a desktop player.
- `npm run content-lint` and `npm run component-check` before the push, and no
  `playthrough-check`.

---

## Decisions for the owner

Each one is a pick; the first option is the recommendation.

How much of the final boss to show:

- All three stages, their on-screen titles visible, no card explaining them:
  the strongest climax, and the titles alone give nothing away.
- The Adapted's first stage only, reshaping on each hit: keeps the later
  stages a surprise, at the cost of the pulled-back arena and the Ultimate.
- The corridor and the Adapted standing in the pass, no fight: the most
  guarded cut, and the weakest ending.

The cliff with the map below, which is the ending:

- Leave it out: the video ends on the boss, as the brief asked.
- One wordless second between the boss and the close: a hint there is
  something past the fight.

The music arrangement:

- Classic: the chiptune the game identifies itself by.
- Modern: the same scores smoothed, closer to what trailers usually sound like.

Where the file lives:

- YouTube, linked from the README's "Play it" section: streams anywhere, costs
  the repository nothing.
- The GitHub Pages site beside the game, linked the same way: one host for
  both, with the file served from the repository's deploy.
- A GitHub release asset: downloadable, not embeddable.

The three untracked clips at the repository root (`gameplay.mp4`,
`gameplay-20s.mp4`, `gameplay-worlds-20s.mp4`), which are the earlier session's
tests:

- Delete them once `promo.mjs` reproduces their shots.
- Move them under `promo/` with the rest of the output.

Hit sounds on the hits:

- Leave them for a second pass, judged on the preview.
- Render them in the first pass from `audio/sfx.ts` at the logged impact times.

---

## Order of work for the executing session

1. Write `promo.mjs` with the frozen clock, the raster recipe at N given on the
   command line, the segment runner, the contact sheet and the per-segment clip
   encode; capture the title and the road at 2x; look at the sheets.
2. Capture the remaining segments one at a time from the recipes above, each
   checked on its sheet before moving on, the finale last since it has the most
   moving parts.
3. Render the five cues through `music.renderScore`, check the loop seams are
   clean and the levels match across cues.
4. Write `promo-cards.html`, render the cards and captions, read them once more.
5. Assemble the 2x preview; the owner watches it and settles the decisions
   above; adjust the timing table.
6. Time one segment at 4x, then render the whole cut at 4x and assemble the
   final file; upload; link it from the README.

---

## Housekeeping

`promo/` is added to `.gitignore` in the same change that adds `promo.mjs`; the
rendered video is hosted, never committed, and the README links to it. When the
script lands, `dev_notes/DEVELOPMENT.md` gets its entry beside `shots.mjs` and
`dev_notes/CODEMAP.md` the location of the render hook, in the same change,
written as current state. The capture script and the cards page are the only
additions; `game/src/` already carries everything the video needs.
