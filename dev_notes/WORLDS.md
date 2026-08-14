# WORLDS.md — world identity, theming and story

The agreed identity of the ten worlds: what each place is called, what it looks
like, what it means, and the rules that hold the set together. `DESIGN.md` §2
remains the source of truth for each world's *map shape* (its generator motif)
and its progression gate; this file covers everything above that — naming,
terrain, palette, light, and the story the sequence tells.

**Implementation status:** the fiction below is settled; the code is not yet
moved onto it. `data/materials.ts`'s `WORLD_NAMES` and `art/biomes.ts` still
carry the previous theming. `WORLDS_BUILD_TASK.md` holds the work list.

---

## 0. The premise

**Decoherence has come. The materials of the world are losing their coherence.**

The player is a crystal — a quantum thing — walking into that. Each world is
further into it than the last, and the light dying across the sequence is not an
art choice but the story made visible: the worlds get darker because coherence
is being lost, and the last of it goes out in World 7 when the sky does.

The final enemy is a machine-learning model that devours coherence and defeats
the player **by understanding them** — because to learn a quantum thing is to
measure it, and to measure it is to collapse it (§2, World 10).

Everything else in this file serves that premise. The naming law keeps each
world honest about what it is; the light rule is decoherence advancing; the two
escalation spines are how far gone each place already is.

---

## 1. The three rules

Three rules generate every decision in this file. A new world, or a revision to
an old one, is judged against them before anything else.

### The naming law

**No name promises anything the texture doesn't show.**

Every world name is a physics word plus a terrain word, and both halves must be
visible on screen. "The Iron Steppe" works because the iron is *there* — black
iron-sand underfoot, iron shards in the surround. A name the player cannot
verify by looking out the window is a name that has drifted into being a
lecture index.

Two corollaries, both load-bearing:

- **No physicists.** The guardians are the people, and they are the only human
  presence in the game. A world named after the physicist standing in it is
  redundant, and a world named after a *different* physicist than its guardian
  is confusing. Personal names belong to guardians alone.
- **No quasiparticles.** Quasiparticles are the moves and the creatures
  (`docs/quasiparticles.md`); they have their own namespace. A world named for
  one borrows an identity that belongs to the battle system.

Both bans push names away from proper nouns, which cannot be drawn, and toward
phenomena, which can. That is why they hold: they are the naming law restated.

The vocabulary is deliberately short and plain — a player should not need a
dictionary. The rule polices *obscurity*, not *intensity*: "devouring" is
vivid, not hard, and belongs where the game is loudest.

### The light rule

The sequence is one long day dying — and the day is coherence. This is the
premise (§0) rendered as light, so the rule is diegetic rather than atmospheric:
the player is watching decoherence arrive.

Morning → midday → afternoon → stormy dusk → overcast twilight → night →
**no sky at all** → fog → firelight → shimmer.

**After World 7, the sun never returns.** All light in Worlds 8–10 is *emitted
by the world itself* — fog-glow, magma, the Mirror's own shimmer — never
received from above. Once the player has been shown that there is no sky, it is
not handed back. This is what makes the back third feel like somewhere the day
cannot reach, and it costs nothing but palette discipline.

World 6 is the hinge: the first world where the sun is gone and the light is
already emitted (the aurora), a preview of the rule before the sky itself is
taken away.

**The musical light rule is the same rule in sound, and what World 7 removes is
*motion beneath the melody*** — the chord progression, the moving bass line, the
chordal pad. None of them returns in Worlds 8, 9 or 10, and the reverb that
arrives with World 7 stays on to the end. **A sustained single-pitch pedal is
permitted; anything that changes pitch, implies harmony, or articulates rhythm
under the lead is not.** Wording it around motion rather than around instruments
is what lets the rule forbid a refill — no later "just a little bass movement"
can pass — while permitting the one thing World 7 needs to be audible at all.

That pedal is not a concession. **World 6's F♯ drone is the intruder grinding
against the home key; World 7's pedal is that same drone, victorious, with
nothing left to grind against** — so the tritone turn is narrated rather than
merely arrived at. It is also what makes the turn audible: an anchorless
whole-tone cloud cannot establish a new tonic, so without it the score's largest
harmonic event lands as vagueness.

**One exemption, for the finale.** World 10's mixture layers borrowed basslines
from the devoured worlds, which this rule would otherwise outlaw. The rule governs
a world's *own living accompaniment*; World 10's is quotation, marked as lossy by
the drive that distinguishes devoured material. **It is playback of the dead, not
restoration of the living.**

The rule underneath all of it: **loss is only audible against a reference that
survives in the same dimension.** Pitch loss needs one pitch anchor, rhythmic
loss needs a pulse, textural loss needs one continuous voice. Remove the last
reference in a dimension and loss stops reading as loss and starts reading as
malfunction, because the ear can no longer measure what is missing. The erosion
schedule already obeys this without naming it — a removed note becomes a rest of
identical duration, so the meter survives as the witness and a vanishing melody
reads as vanishing rather than as stuttering playback. Dissolve as far as you
like, down to one drone and one eroding line, provided every dimension keeps its
witness until silence is the point.

### The escalation spines

Two ramps run in parallel, and both are legible in a screenshot cropped to the
player's feet.

**What the impassable terrain is** — from "you just wouldn't walk there" to "it
would kill you": forest → stone → a drop → charged ground → ice and pits →
iron shards → nothing at all → fog that takes you → molten crust → terrain that
consumes.

**What the walkable ground is** — from ground *built for walking* (a field
path, a tiled aisle), to ground that merely *happens to be traversable* (ice,
iron sand), to ground that *isn't ground at all* (filaments over void, scorched
crust, a surface that dissolves behind you).

A world where neither spine holds is a world that will read as placeholder art.

---

## 2. The worlds

| # | Name | Walkable | Impassable | Light |
|---|---|---|---|---|
| 1 | **The Mean Fields** | wheat / mown grass | dense summer forest | bright morning |
| 2 | **The Stone Lattice** | mosaic-tiled aisle | rows of identical sandstone columns | hard midday sun |
| 3 | **The Edge Cliffs** | a lit ledge that visibly flows | shallow drop to sunken dead floors | bright, windy, motionless afternoon |
| 4 | **The Storm Flats** | banded indigo ground, glowing boundary channels, orbit rings | charged field-line arcs overhead | stormy dusk |
| 5 | **The Vortex Glacier** | swept ice, flow-lines bending away from the bulk | frozen lake, vortex pits with trapped-flux glow | overcast twilight |
| 6 | **The Iron Steppe** | black iron-sand, rippling | aligned iron shards, flipping across a domain wall | night, green aurora |
| 7 | **The Entangled Web** | white-gold filaments and rungs | true void | no sky |
| 8 | **The Splitting Hollow** | forest floor, path forking | fog that takes you; World 1's trees, dead | fog-lit only |
| 9 | **The Defect Scars** | scorched clay — old, closed scars | molten crust — wounds still open | red glow |
| 10 | **The Devouring Mirror** | shifting silver-violet, dissolving behind you | terrain reconfiguring around you | uncanny shimmer |

### 1 — The Mean Fields *(mean field, spontaneous symmetry breaking)*

You walk *in* a field, and forest is what hems it in. The walkable route is the
bright one — wheat and mown grass — and the surround is dark canopy, so the
value break runs the opposite way to a dirt-track world. The generator's two
parallel branches (the degenerate symmetry-broken ground states) read as two
fields divided by a hedgerow: scenery, not a diagram.

The name is the register-setter for the whole set. "Mean field" is a technical
term wearing work clothes — a civilian reads *fields*, a physicist reads the
approximation. Worlds 1 and 4 both carry their physics in the *noun* this way;
every other world carries it in the modifier. That is a rhyme, not a
duplication.

### 2 — The Stone Lattice *(symmetries, tight-binding, effective models)*

Built rather than grown: an open-air stone cloister in hard midday sun, and the
only architecture in the game. The floor is an actual repeating wallpaper
pattern, with two alternating tile motifs carrying the two-atom basis; the
surround is rows of identical sandstone columns with dark shadow gaps, evenly
spaced, marching off in both directions.

A tiled floor is a wallpaper group and a colonnade is a one-dimensional lattice,
so the player stands inside the mathematical objects rather than beside a
picture of them. Every contrast axis flips against World 1 at once — organic
vs. geometric, green vs. sandstone, soft irregular edges vs. hard straight ones
— which is what stops two consecutive daylight worlds from reading as one.

Civilization is a brief episode: one built world, then never again. World 9's
molten crust carries a few toppled column drums, which is what makes that a
story rather than a set-dressing experiment.

### 3 — The Edge Cliffs *(topological band theory)*

The generator partitions the grid into Voronoi domains — distinct bulk
topological phases — and the only walkable ground is the seam between two
differently-coloured ones. So: a lit ledge with a drop on either side, and the
two bulk domains as the sunken floors flanking it. Bulk-boundary correspondence
made literal — the edge state is the only place you can stand; the bulk is over
the side.

**The drop is shallow, and never true void.** The domains are visible one storey
down as extended flat expanses of dead colour, crystallized, airless, nothing
moving. This matters for three reasons: nothingness is World 7's one card, and
spending it at slot three pre-spoils the emotional peak the light rule exists to
protect; a gapped bulk is *matter* — present, extended, inert, just unavailable
— which is the actual physics; and the player still navigates by colour
territory, which the Voronoi shape depends on.

Wind over a world where nothing can move is the horror, not a contradiction:
clouds race overhead while the ground stays perfectly still. Keep the dead-matter
stipple *structured* — a crystalline speckle or frozen moiré — so it reads as
the texture of dead matter rather than as a rendering artifact.

### 4 — The Storm Flats *(magnetic field, quantum Hall, Landau levels)*

Discrete flat colour bands underfoot in a single-hue indigo ramp, a soft dark
strip along each band's lower boundary, and a glowing channel at every boundary
— which is not decoration but the subject, since edge channels live between
filled Landau levels. Quantised orbit rings are the ground decoration. Overhead,
charged field-line arcs crack across a stormy dusk.

Landau levels *are* dispersionless flat bands, so "Flats" is the physics, not
the weather — the same trick as "Mean Fields", where the terrain noun is also
the term of art. It is also the honest terrain noun for an engine that cannot
draw a hill.

Two things are load-bearing rather than optional here. **The orbit rings stay**:
with the name no longer saying "orbit", the rings are the only thing left
teaching the mechanism. **The overhead arcs stay**: the ground is a diagram, so
the sky has to be the violence, or this becomes the one world that reads as a
chart. The boundary shadow strips are lighting, not landform — they give flat
bands material depth without promising elevation the engine can't deliver.

### 5 — The Vortex Glacier *(superconductivity, Nambu, Majorana)*

An open glacier at overcast twilight, with the corridor spiralling around one or
two permanently blocked vortex cores. The pits are dark, rim-lit, with a faint
cold glow of trapped flux down inside each one.

"Swept" is literal: the ice is streaked with flow-lines that visibly bend around
and away from the bulk and converge only into the vortex pits. That is field
expulsion drawn as terrain — the world becomes *the place that pushes something
invisible away from itself*, which is the topic, rather than "the ice one".

### 6 — The Iron Steppe *(classical magnetism, magnons)*

Night under a green aurora. Black iron-sand underfoot with visible spin-wave
ripples running through it; the surround is fields of aligned iron shards, all
leaning the same way, flipping direction across a domain wall. The magnetic
order is something the player can see standing up out of the ground.

This is the **false calm**, and it is anatomically correct: the *mood* relaxes
after ice and storm — the aurora is genuinely beautiful — while the *lethality*
does not, since leaning iron shards are the most overtly impaling surround so
far. A false calm the player cannot retrospectively recognize as false is just a
pretty world, so it needs one tell: the aurora stutters, or the shard field
beyond the domain wall visibly flips while you watch.

It is also the hinge of the light arc (§1): the sky still exists, but it is
already lying about where light comes from.

### 7 — The Entangled Web *(entanglement, tensor networks)*

No sky, no ground — only the network. Taut, geometric, architectural filaments
in white-gold, the game's one warm glow before World 9 burns, strung as the
ladder of lanes and rungs the generator builds, hanging in true void.

In a tensor network the geometry *is* the entanglement: outside the network
there is no space. Rendering the surround as actual nothing is the honest
picture, not a mood choice, and this world holds the monopoly on it.

Keep it still and structural — "shifting and alive" belongs entirely to World 10.

### 8 — The Splitting Hollow *(quantum magnetism, spinons, Kondo)*

A dead forest in deep fog, lit only by the fog itself. Every trunk forks in two
and the corridor forks with them, matching the generator's fractionalizing path.

**The threat is the fog, not the trees.** Trees are "you just wouldn't walk
there" — World 1's logic, which would regress the escalation spine at world
eight of ten. The fog is what takes you: stray from the path and the medium
itself absorbs you, which is Kondo screening and spinon confinement made into a
hazard rather than a diagram.

The trees are World 1's tree sprites, dead and grey. That is the game's one real
story beat — the friendly wood you skirted the edge of at the start is the thing
you are lost inside near the end — and it only lands if the player can
*recognize* the trees, so the sprite reuse is the point, not an optimization.
The two palettes must stay clearly apart: warm sunlit summer green against
desaturated near-black grey-green.

### 9 — The Defect Scars *(excitations and defects)*

Damage past and damage present, in the same frame: the walkable scorched clay
reads as old scars, closed and healed-over, while the impassable molten crust is
wounds still open and glowing. A lattice defect *is* frozen-in damage that never
heals, and this world's ground decoration is literally cracks.

The generator embeds patches of worlds 1–8's own looks along the corridor —
borrowed defect "types" — which is also where World 2's toppled column drums
belong, half-sunk in the crust.

### 10 — The Devouring Mirror *(machine learning for quantum materials)*

The world that isn't a world, and the only name in the set with no terrain noun
— which is correct, because a mirror is not a place you visit, it's a thing you
face. Shifting silver-violet, the terrain reconfiguring around whatever crystal
the player currently is, and **the path dissolving behind them as the world
re-forms ahead**: the name has to be a description rather than a boast, so the
world must visibly *take* something.

**The surround is the player, rendered.** The impassable terrain does not merely
reconfigure — what it reconfigures *into* is increasingly defined copies of the
player's own crystal, sharpening as they approach the boss. With the path
dissolving behind them, the full loop is **ingestion at the back and rendering at
the front**: the world eats the player's trail and emits the player. That is the
training loop drawn as terrain, and it cashes the devouring and the mirror in one
gesture rather than two.

**The copies never resolve completely.** The terrain asymptotes; only the boss
converges. Every reflection stays slightly wrong — soft-edged, off-colour,
incomplete, the pose not quite right — for three reasons at once: the Adapted
must remain the only *perfect* copy in the world or it walks on stage as a
duplicate of scenery; samples from a still-training model genuinely do vary in
fidelity, and the converged model is the fight; and almost-you is more
frightening than exactly-you, because exactness reads as a mirror while a
near-miss reads as something *trying*.

**Reflections are surface phenomena; actors are ground phenomena.** A copy
standing *on* the terrain is a second character, while a copy visible *in* it is
a reflection — so they are clipped inside the surround's facets, under the
world's sheen, tinted toward silver-violet, with no ground contact and no cast
shadow. The behaviour that settles it beyond doubt: **they move only when the
player moves, with a lag.** Mimicry-with-delay is the one thing every player
instantly reads as a reflection, and it cannot be mistaken for an NPC because it
has no volition. They are never interactable — no prompt, and clicks fall
through, since they are world rather than object. The player's own crystal keeps
the highest contrast and saturation on screen; reflections stay inside the
backdrop's compressed band.

**The lag shortens as definition rises, and never reaches zero.** Zero lag, full
definition and unison all belong to the fight alone — the terrain carries the
convergence from faint to almost, and the battle's own tightening canon carries
the last lap from almost to unison. The two media relay rather than duplicate,
handing off at the door.

The name is the most deeply verified in the game, and not by texture: World 10's
generator literally mirrors the player, reusing whichever of worlds 1–8's
generator matches their current material's main type.

**Its identity, and the reason the name holds three readings at once:**

- *Appetite* — the mood.
- *Training* — a model learns you by consuming you. The Adapted devours your
  play in order to become your reflection, which is what a trained model is.
- *Decoherence* — the physics of why being known destroys you. Decoherence is
  not a fog that eats superpositions; it happens because the environment
  *acquires information* about the system. The system entangles with its
  surroundings, they come to hold a record of its state, and superposition dies
  precisely when something else knows which state you are in (einselection;
  Zurek's quantum Darwinism sharpens this to the environment holding *redundant
  copies*). So decoherence is the environment building a model of you, and the
  modelling is not a side effect of the destruction — it is the mechanism.

To be learned is to be measured; to be measured is to decohere. The surrogate
that copies you and the process that devours your coherence are one physical
event described twice. The copy the Mirror makes cannot be quantum — no-cloning
forbids it — so what it captures is the player's *classical shadow*, which is
also, verbatim, the name of a real technique for learning quantum states from
randomised measurements (Huang, Kueng & Preskill, 2020; shadow tomography rather
than machine learning strictly, though it is now a workhorse in ML-for-quantum
work).

**Keep the hierarchy straight.** Decoherence is the *villain's mechanism*;
machine learning is still the *lesson*. The dex entries, the quiz and the
adaptive boss mechanics carry the ML topic; the decoherence framing is the story
that makes the lesson frightening. The story frames the lesson, never replaces
it.

No player will derive quantum Darwinism from a two-word name, so the world's own
text needs **one bridging line** — guardian dialogue or a dex entry with the
shape of *to learn you, it must measure you; to measure you is to unmake you*.
Without it, the name tells the decoherence story while the writing tells the ML
story, with no visible seam between them.

Its horizon is the Qumatuomi sky (§4) — every world at once, seen from above,
which is the view a trained model has of its training data.

The finale, stated plainly: **the last world defeats you by understanding you,
and understanding a quantum thing collapses it.** This is also the payoff for
"you are a crystal" — the player's quantumness is what is at stake, and the last
enemy is observation itself.

---

## 3. Palette

Every world owns a hue, and unassigned colours are where collisions breed.

| # | Owns |
|---|---|
| 1 | fresh spring green, warm dirt, pale blue sky |
| 2 | sandstone, terracotta, bleached white, deep cast shadow |
| 3 | dead teal and dead ochre (the two domains), against a bright sky |
| 4 | storm indigo, single-hue ramp |
| 5 | pale ice-cyan, desaturated, narrow value range |
| 6 | black iron-sand under pure green aurora |
| 7 | white-gold filaments on black — the only warm glow before World 9 |
| 8 | desaturated grey-green, near-black in fog |
| 9 | scorched red, molten orange |
| 10 | silver-violet |

Violet belongs to World 10 by right, as the finale — which is why World 4 is
indigo rather than storm-violet and World 6's aurora is pure green rather than
green-violet.

---

## 4. The horizon, and the connections between worlds

The ten worlds are one road, not ten rooms. This section is how that is made
visible: land that reaches the horizon instead of stopping, a horizon that shows
where you are going, and gates that are geography rather than furniture.

### Continuity

The ground plane must always reach the horizon. Terrain is repeated in depth
past the grid's far row the same way it is already repeated sideways past the
left and right edges, so a world never visibly terminates.

Two bounds keep that honest. **Cap the repetition at the row where depth haze
reaches full opacity** — beyond it nothing is distinguishable anyway, and a
painted gradient band owns the final strip up to the horizon line. And **stop
drawing rows thinner than a pixel**: near the horizon, projected rows compress
below a pixel and will alias and crawl as the camera moves.

The first of those is an equality, not an inequality: **the depth fog reaches the
fog colour exactly at the last row drawn.** If the fog still holds some of the
ground's own colour where the rows stop, the band above has to be opaque to cover
the step, and an opaque band is one that can never soften into anything. Land, mist
and sky are one atmosphere with the horizon line as a location inside it, not three
rectangles clipped against each other — so the sky's own bottom graduates into the
same fog target on its way down to that line.

**The road continues.** Repeating the far row repeats the walkable path with it,
so a road runs on past the world's end. That is intended — it is this section's
whole thesis in one detail — but it must drown in haze quickly, and while a gate
is shut it must vanish into the closed notch's fog rather than promising passage
the rival still forbids.

### Distant selves

**Each world authors exactly one distant self**: a silhouette profile, a base
colour, and a swallow value — how it looks from far away. A world's forward
horizon is then composed at render time from its *neighbour's* distant self. No
world authors its neighbours' horizons, and no world has two silhouettes to keep
in sync.

**The data belongs to the world depicted, and is consumed by its neighbour's
renderer.** Standing in world N, every field the horizon reads — profile, base
colour, swallow — comes from world N+1's own entry, never from world N's. This is
what makes "authored once" true rather than merely intended: a world states how it
looks from outside itself, in one place, and whoever can see it reads that
statement.

**A distant self is authored as shape and base colour only. Atmosphere is applied
at render, never baked into the asset.** This is not hygiene. Haze inheritance
(below) retints the air toward the *next* world's fog colour as the player walks
toward the gate, and the silhouette has to be drowned in whatever that live value
currently is. A base colour with fog already painted into it cannot follow that
retint, and the moment it stops following, a seam opens between the silhouette and
the mist it stands in.

**Swallow** is how much of the silhouette the mist eats: a per-biome value on the
same entry, `Biome.hillAlpha`. It is what lets one world's horizon be a firm ridge
and another's a rumour, and zero is a legitimate value — a world whose distant self
is nothing.

Which value a world may take is decided by one aesthetic rule. The silhouette is
drowned most of the way into the live fog target and its base runs continuous with
the mist, so what the player sees is a narrow excursion from the fog colour rather
than a shape painted over it. A foreign hue is inherently more legible than an
own-palette hue at equal contrast, and the horizon is always wearing a foreign hue
here, so the budget is tighter than an own-colour band would need. **If a world's
profile and base colour cannot stay inside that budget at any swallow worth
drawing, its swallow goes to zero and it joins the swallowed set** — an emptied-out
horizon is always preferable to a slab.

The camera always faces forward along the corridor and never turns, so **there is
no backward variant**. The one place a backward view would have earned its keep
is the arrival beat, and that is obtained instead by bleeding the previous
world's ground palette into the first few margin rows on entry.

**A distant self is that world's impassable surround restated at horizon scale**
— column teeth for the Stone Lattice, leaning shard rows for the Iron Steppe, a
cracked glow-veined ridge for the Defect Scars. This is the same asset that
serves as the world's own horizon when standing in it, which is why it is
authored once. A generic hill profile in a different colour per world fails this
rule: it is the theming *not* made visible at distance.

**The swallowed set** — the worlds whose distant self is no silhouette at all:

- **The Entangled Web** has no surround — its impassable is nothing — so its
  distant self is an absence with structure: the sky ending, thin white-gold
  filament glints in blackness where a horizon should be. Swallow zero. This is a
  gift rather than a gap: the Iron Steppe's forward horizon showing the world
  *stop* is exactly the tell its false calm needs, supplied by the composition
  system for free.
- **The Splitting Hollow** is eaten by its own fog. A horizon that dissolves
  before it resolves is that world's identity, not a missing asset, so it too
  carries swallow zero and the Entangled Web looks forward into grey nothing.
- **The Devouring Mirror** has no next world, and its horizon is the Qumatuomi
  sky (below) rather than any silhouette. Its swallow is zero so that the Defect
  Scars' forward horizon does not wear a violet ridge the Mirror never had.

### The adjacency rule

**Adjacent distant selves must differ in shape-language or sky-activity, never
in hue alone.** Hue is already guaranteed to shift by haze inheritance; this rule
exists to catch the case where hue is *all* that shifts. Two worked examples,
both already resolved:

- **Edge Cliffs → Storm Flats** cannot satisfy this on shape: both worlds are
  flat by locked identity, so the change would read as dead teal-and-ochre giving
  way to dead indigo. The differentiator is the **sky** — the Storm Flats' distant
  self is carried by its storm, arc-flashes over a dead-flat horizon line.
  Distant lightning over flatness against racing cloud over flatness is
  unmistakable, and honest, because the storm is that world's identity.
- **Vortex Glacier → Iron Steppe** are both jagged, cold-dark and under failing
  light. The physics separates them: the Steppe's shards lean *uniformly* one way
  (aligned moments), so its horizon teeth all tilt together, where the glacier's
  pressure ridges are random and vertical. Let the lean **flip at one point along
  the horizon** — the domain wall, visible from a world away.

### Haze inheritance

As the player nears a world's goal end, the depth haze's fog target lerps toward
the *next* world's fog colour: the air ahead becomes the next world's air. On a
darkening arc this is most of the felt effect on its own — the forward horizon
being visibly worse than the ground underfoot is the cheapest dread available.

**Gated on gate state:** a shut gate means no forward palette bleed.

### Judging a horizon change

**Gate-open, standing at the goal end, is the acceptance state for every change to
the horizon.** That is where the mist is carrying the most of the next world's
colour, and a colour the horizon does not follow is exactly what tears the picture
apart. A treatment that looks settled with the gate shut has been judged against
the world's own air only, which every part of the horizon already agrees with by
default, and has therefore proven nothing. Both states are worth capturing; only
the open one decides.

### Gates as passes

One grammar throughout: **a palette seen through an opening is where you are
going.** The gate is not an object standing on a tile; it is the corridor
narrowing into a pass, with the destination visible through the gap.

**The narrowing is permanent geography.** It is the pass, and it stays once the
rival is beaten — a road outlives its guard. Both ends of every world are
shaped: **world N's start is world N−1's exit**, so if the player leaves through
a narrowing pass, world N must open with a narrow mouth that widens. Departure
and arrival geometry are one joint designed twice, not two worlds' edges that
happen to meet.

**Nothing spawns in a pass.** A pass is a deliberate exception to the rule that
no walkable segment is narrower than two tiles — a rule that exists so a wild
encounter can never fully block the path. The exception is only safe if the
generator emits a goal-adjacent suppression zone covering everything that spawns
on tiles.

**The rival stands in the pass and holds it.** That is the state signal: while
the rival lives, the way is physically barred by the thing barring it, which is
truer than weather. Every rival is its world's physics made incorruptible, so
holding the boundary is its job rather than a staging choice. It also preserves
the reveal, since nothing of the next world is visible past it.

**Size the rival to the aperture, not to the screen.** Scale is read against the
opening: a modest figure filling a narrow notch reads larger than a giant in an
open field. Wide enough that no walkable gap shows from the approach tile, fully
visible and silhouette-readable from the tile in front, and no more. The
narrowing carries the menace.

**Once the rival falls, a board in the pass names the destination** — "To The
Storm Flats". This reads as a road sign only because every world is named as a
place; it is the first system-level dividend the naming law pays.

**Two objects, two duties.** The board is scenery: world-space, depth-scaled,
painted legible at approach distance, illegible from far off — which is what
keeps it a signpost rather than an interface element, and what stops it
competing with the horizon reveal, since the horizon resolves first and the name
becomes readable later as its caption. The **interact prompt** is interface: it
obeys every text-size preset, and it carries the choice.

**Approach, read, press.** Both gate states share one interaction grammar, and
the keypress is what makes it safe. Arrival alone must never transition or start
a fight: a pass is the most interesting object in a world and players will walk
into it to look. The confirmation is not removed with the old menus, it is
relocated into the prompt — and the story beat between worlds fires on that
keypress, the exact semantic descendant of the click it replaces.

**World 10 has no board.** The grammar means "another world lies beyond", and the
finale's meaning is that there is not one. The Adapted holds the pass; when it
falls, the pass frames the mirror-sky and nothing else.

**World 1's backward exit is a door, not a pass**, because it leads to the Lab.
Every geographic boundary is a pass; the one non-geographic boundary is a door.
The asymmetry is the ontology made visible.

Wayfinding is not the problem a gate solves — a corridor has nowhere else to
walk. What the gate must carry is **state**: the goal gate exists only once that
world's rival is beaten. So the aperture has two states.

- **Rival unbeaten** — the notch is fogged shut, opaque and dark. The next world
  is not visible and haze inheritance does not run.
- **Rival beaten** — the notch clears, and the next world's palette shows through
  the gap as the brightest thing on screen, or in the late worlds the most
  wrongly-coloured. Light through a doorway, and diegetic: what is visible
  through the gap is the destination itself.

One ground-level cue joins it: the next world's walkable colour bleeding across
the last two or three tiles, a seam the player visibly steps over. The confirm
panel on stepping onto the tile stays — geography plus confirmation prevents
accidental transitions, and the panel is the safety net if any one world's pass
reads weakly.

**The far/near split, which is what keeps this honest on a flat plane.** The
horizon silhouette sits at a fixed offset above a fixed horizon line, and the
projection is asymptotic — anything drawn in that band is the same size forty
tiles out as it is on the goal tile. So the *far* part of a pass (the notch, the
neighbour's silhouette) stays in that band and is never reached, which is
truthful, because it is not this world's geography at all: it is the next
world's interior, and the player reaches it by loading it. The *near* part (the
flanking walls of the pass) must instead be depth-projected — anchored at the
goal row and scaled through the same projection as everything else — so that the
flanks grow, part around the corridor and slide off screen as the player
arrives. The approach then genuinely happens, with no elevation geometry and no
ground tilt, only scale.

### The Lab

The Lab is **not a location**. It is reachable from every world, returns the
player to precisely where they left regardless of progress, and hosts travel to
any world already visited — it does not sit beside World 1, it sits beside
everywhere. The player is a crystal and the Lab is where that crystal is
examined, so it is better understood as the inside of the thing being played
than as a room on the map.

Two signals carry that, and only two:

- **Its door is the same aperture grammar, unbound.** In the worlds an aperture
  can only ever show the fixed neighbour; the Lab's can show anywhere. It
  previews the *current* destination — by default the world and position the
  player left — and updates live when the travel panel selects a different world.
  A door that changes its view when the player changes their mind reads as a
  teleporter without a word of explanation, and it teaches itself, because the
  player has already learned to read apertures out in the worlds.
- **Its accent lighting is keyed to the player's current crystal**, so the room
  changes as the player does.
- **Its music is keyed to the player's progress.** The Lab keeps World 1's theme
  — the game's home key — held on C to the end, with its mode draining stepwise
  as the player's furthest world advances. So flicking into the Lab from World 9
  still brings the player home, to the tonic the outside world abandoned at the
  tritone turn and which survives in exactly this one room — but home in a dark
  mode. The safety is real, because the key persists and that is what a refuge
  actually offers; the escape hatch is welded shut, because the brightness does
  not, and no keypress returns the player to morning. It uses the front half's
  own transform, the mode drain, and never erosion or the tritone — those belong
  to World 8's loss beat and must not be spent on a room visited forty times.

The rule this rhymes with, stated together: **the Lab's light is keyed to the
player's crystal and the Lab's music to the player's progress — the room
reflects the player, and the player is what the story is changing.**

The **Title screen** keeps World 1's theme unchanged forever. It plays to someone
for whom the premise does not yet exist, so it is the world before the story. The
payoff is that Title and Lab begin identical and **drift apart** as a save
advances: a late-game player noticing the Lab no longer sounds like the title
screen is the whole arc measured in one comparison. They share material precisely
so that they can come to disagree.

Everything else is said by **absence**: no window, no sky, nothing implying an
outside. Every world has a horizon; the Lab has none. That only reads as
deliberate if nothing in the room accidentally supplies an exterior. Note this is
*interior-without-outside*, not void — void belongs to the Entangled Web.

For the same reason **World 1 simply starts**, with no view behind it. An arrival
with no *behind* is honest for a place you were teleported into; its start margin
gets its own morning haze and nothing more.

### The Qumatuomi sky

The Devouring Mirror's horizon is the Qumatuomi map — the game's own world map,
a geographically traced silhouette on which World 10 sits at Espoo's real
coordinates — seen from above.

It is the only horizon that is not the next world, because instead it is *every*
world, seen from outside and above. That is precisely the view a trained model
has of its training data: the Mirror can show the whole map at once because it
has consumed all of it.

**Render it as a reflection in a mirrored sky**, not as an image pasted flat to
the screen: foreshortened and tilted away, rippling faintly with the world's
shimmer, silver-violet, and dimmed and hazed by the same atmosphere that fogs
everything else. The haze is what does the work — fog is the cheapest signal that
something is scenery, and an interface element is never fogged. Rendered
screen-parallel and unhazed it will read as a misrendered minimap, and players
will try to click it. Self-luminous, per the light rule: the record glows,
nothing shines on it.

Strip every interactive affordance from the asset — no markers, no labels.
Two optional flourishes, both kept faint: a dim luminous trace of the player's
actual route across the map (*it has your whole walk*), and a single slow pulse
at the Espoo point. The route trace is the stronger; the pulse is skippable if it
reads even slightly like a readout.

## 5. Story shape

The premise (§0) supplies the arc; three beats carry it:

**Indifference (1–9).** The terrain is grandly indifferent to the player — a
mote walking through fields, cloisters and glaciers that do not know it exists.
That indifference is free, and it exists to be broken exactly once.

**Loss (8).** The 1↔8 rhyme is the emotional beat: something the player walked
past in safety at the start is what they are lost inside near the end. Without
it, the sequence runs pretty → moody → dead with no moment where anything is
taken from them specifically.

**Recognition (10).** The world turns to look. After nine worlds of terrain that
did not know it was being walked on, the last one is built out of the player —
and that is what finishes them, because being known is the mechanism of the
decoherence that has been advancing since World 1.

One cheap seed makes the turn land rather than arrive from nowhere: somewhere
late — World 8 or 9 — a few crystalline fragments of the player's *own* material
embedded in the impassable surround. The first hint that the world contains
things like you, immediately before it becomes a thing that *is* you.

**Those fragments must stay crude**: raw, unshaped, mineral, an accident of
geology rather than a likeness. The gradient only works if the two stages read as
different phenomena — **ore, then portrait** — so that World 10's rendered
reflections (§2) land as categorically new rather than as more of the same. Left
unspecified, this is exactly the detail an artist will naturally polish, and
polishing it turns the seed into an early reflection and costs the reveal.

---

## 6. The premise in the game's voice

The premise is not only art direction — it is already spoken by the game, across
five text surfaces, and the theming exists to make the terrain agree with what
the text has been saying all along. Anything added here must keep these
patterns, because they are what make the arc land rather than merely exist.

| Surface | File | When | Job |
|---|---|---|---|
| `WORLD_LORE` | `data/worldLore.ts` | once, on first entering a world | two pages: the world's physics told as history, then how the Decoherence attacks *that* physics |
| `RIVAL_TAUNTS` | `data/worldLore.ts` | before the rival fight | two parts: the rival's boast |
| `STORY_BEATS` | `data/story.ts` | after a rival is beaten | one line of connective tissue, looking forward |
| `WORLD_GOAL_TEXT` | `data/story.ts` | on reaching the goal tile | one line: this world's physics still holds |
| `WORLD_FLAVOR` | `data/worldFlavor.ts` | Bloch's destination preview | plain physics, deliberately *not* narrative |

**The Decoherence is never generic.** In every world it attacks one *named
mechanism*, and always the one that world exists to teach — it doesn't erase the
Meadow's order, it makes the broken symmetry doubt itself; it doesn't break the
lattice's atoms, it puts one alcove fractionally out of step so the delocalized
state has nowhere to live; it doesn't touch the Majorana halves, it shortens the
passage until they can feel each other. A world whose Decoherence page could be
pasted into another world's slot has failed this rule.

**Every rival 1–8 is the same shape: *I am this world's physics, made
incorruptible.*** The boast is always the precise mechanism that answers the
attack named on that world's second lore page — the golem that committed its
ground state before you were born, the one whose pattern rebuilds across every
grain boundary, the one that is the boundary rather than standing on it. That is
why the rivals feel like part of the story rather than a difficulty gate, and it
is the pattern any new rival must follow.

**World 9 breaks the shape once, and World 10 breaks it permanently.** World 9's
rival has no lattice of its own and borrows whatever it lands in. World 10's is
the reveal: the Adapted was never one of the golems in disguise — each of those
was only its own world's physics grown strange — it watched from outside and
trained on the player, and every rival brought down was a lesson. That is the
arc's payoff and the reason the finale is a mirror.

**Tone gradient.** The lore voice tracks the light: worlds 1–3 are told as
legend, second-hand and almost pastoral ("Long ago, before the corridors had
numbers"); by 7–9 the narrator has stopped telling stories and is reporting; by
10 nothing precedes the player at all — "no traveler returns with a rumor". Keep
new copy on that slope.

## 7. Known soft spots

Recorded so they are not rediscovered as surprises:

- **A pass's depth-projected flanks are the most speculative rendering trick in
  the set** — side objects scaled by depth, standing in for elevation the engine
  cannot draw. Everything else works without them, which is why they come last:
  if they read badly in the first world tried, the state-signalled aperture alone
  is a complete, shippable gate.

- **World 4 is the world most at risk of reading as graphic design.** Flat
  bands, flat glow lines and flat rings on a flat plane. The boundary shadow
  strips and overhead arcs are what keep it material; if either is dropped, the
  world regresses immediately.
- **"The Edge Cliffs" is the one name whose verification is pending on
  rendering.** A cliff is the one landform this engine can only imply. The
  shallow-drop version lowers the risk — a visible floor below calibrates the
  eye far better than uncalibrated black — but if the lit-lip-over-dark-mass
  read fails, the name describes a world with no cliffs.
- **The 4→5 step is the flattest on the staircase** — storm to cold quiet is
  lateral rather than an escalation. Twilight is darker than dusk and the
  descent into cold reads as its own kind of worse, so this is tolerated rather
  than fixed.
- **"The Stone Lattice" is the one name that names an object rather than a
  place.** Kept because it preserves the tight-binding topic word. "The Stone
  Rows" is the alternative if place-ness ever matters more than the topic.
