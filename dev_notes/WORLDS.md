# WORLDS.md — world identity, theming and story

The agreed identity of the ten worlds: what each place is called, what it looks
like, what it means, and the rules that hold the set together. `DESIGN.md` §2
remains the source of truth for each world's *map shape* (its generator motif)
and its progression gate; this file covers everything above that — naming,
terrain, palette, light, and the story the sequence tells.

**The maps are under active revision.** World layouts are being fine-tuned, so
this file's terrain and palette entries and `DESIGN.md` §2's map shapes are open
for change rather than fixed. The current pass over how much ground each world
gives the player to stand on is `MAPSHAPE_BUILD_TASK.md`. A proposed change to a world's ground is a design
question to be decided on its merits, not a violation to be raised — while this
holds, judge such a proposal on whether it serves the world, and take the rest of
this file (the naming law, the light rule, the escalation spines, the premise) as
binding as ever. Everything outside the maps is unaffected.

**Implementation status:** the fiction below is settled and the code is on it —
`data/materials.ts`'s `WORLD_NAMES`, `art/biomes.ts`, `art/horizons.ts` and the
per-material modules under `scenes/overworld/terrain/materials/`. Three pieces
are still outstanding, each tracked in its own file: §4's depth-projected flanks
in `HORIZON_BUILD_TASK.md`; World 10's rendered reflections (§2) in
`REFLECTIONS_BUILD_TASK.md`; and §1's World 7 pedal and World 10 mixture,
together with §4's progress-keyed Lab theme, in `MUSIC_BUILD_TASK.md`.

---

## 0. The premise

**Decoherence has come. The materials of the world are losing their coherence.**

The player is a quantum material — a quantum thing — walking into that. Each world is
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
**stars alone** → fog → firelight → shimmer.

**After World 7, the sun never returns.** The world's own light — fog-glow,
magma, the Mirror's shimmer — is what lights Worlds 8–10 from the ground. The
day does not come back, and the back third stays somewhere it cannot reach.

**Starlight is the one thing received from above in the back third**, and it is
there to carry the network arc (§1's "The stars"), not to relight the world. It
is the faintest light in the game: it never raises the ground's value, never
casts, and never competes with a world's emitted sources. A world reads as dark
with the stars in it exactly as it does without them — they are a figure in the
sky, not illumination.

World 6 is the hinge: the first world where the sun is gone and the light is
already emitted (the aurora), a preview of the rule before the sky itself is
taken away.

### The stars

The last four worlds carry a starfield that changes across them, and what it is
doing is telling the player what the final enemy is before the game says so. A
machine-learning model is a network — nodes and the weights between them — so the
sky assembles one, in four stages, and by the time it is finished the player has
been looking at a picture of World 10's boss for three worlds.

| World | Stage | What the sky shows |
|---|---|---|
| **7** The Entangled Web | **scattered** | Faint, ordinary stars. Unconnected points, nothing to read into them yet. |
| **8** The Screened Swamp | **first links** | Strange connections appear between a few of them — lines no constellation would draw. |
| **9** The Defect Scars | **occluded** | Cloud drifts across and hides part of the pattern, so what is being assembled cannot be seen whole. |
| **10** The Devouring Mirror | **the network** | Every point joined. The thing that has been assembling itself is finished, and it is what the player is about to fight. |

Three rules hold it together.

**The stages only ever add.** A link drawn in World 8 is still there in World 10.
The player is watching one thing being built across four worlds, not four
different skies, and a link that comes and goes would read as weather.

**World 7's points stay unconnected.** That world's *ground* is already nodes
joined by bonds (its lanes and cross-link rungs), so a connected sky above it
would restate the terrain and read as tensor networks rather than as the enemy.
Unconnected points above a bonded floor is the useful arrangement: the sky is
doing something the ground is not, which is what makes it worth looking at.

**Occlusion at World 9 is the point, not a gap.** Hiding part of the pattern one
world before it completes is what makes the completion land — and a model whose
shape you cannot quite see is the more honest picture of the thing anyway.

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
would kill you": forest → stone → a drop → ground the storm strikes → ice and
pits → iron shards → nothing at all → water that takes you → molten crust →
terrain that consumes.

**What the walkable ground is** — from ground *built for walking* (a field
path, a tiled aisle), to ground that merely *happens to be traversable* (ice,
iron sand), to ground that *isn't ground at all* (filaments over void, scorched
crust, a surface that dissolves behind you).

A world where neither spine holds is a world that will read as placeholder art.

---

## 2. The worlds

The walkable route is one flat colour in every world (`STYLE.md`'s "Overworld path"): what a
world *is* is carried by its palette, its light, and the impassable surround beside the route,
not by a pattern painted on the floor. The **Walkable** column below is that floor's colour and
the corridor's own shape; the **Impassable** column is where each world's character actually
lives.

| # | Name | Walkable | Impassable | Light |
|---|---|---|---|---|
| 1 | **The Mean Fields** | open wheat / mown grass, a hedgerow dividing it for a stretch | dense summer forest | bright morning |
| 2 | **The Stone Lattice** | open pale sandstone floor, columns standing in it | the column field the hall is cut out of | hard midday sun |
| 3 | **The Winding Borders** | a network of lit ledges between domains, meeting at junctions | shallow drop to sunken dead floors | bright, windy, motionless afternoon |
| 4 | **The Storm Flats** | banded indigo ground, glowing boundary channels | ground the storm strikes | stormy dusk |
| 5 | **The Vortex Glacier** | an open sheet of pale ice | vortex pits punched through it with trapped-flux glow, frozen lake beyond | overcast twilight |
| 6 | **The Iron Steppe** | open black iron-sand | aligned iron shards standing in it in wavefronts, flipping across a domain wall | night, green aurora |
| 7 | **The Entangled Web** | white-gold causeway | true void | no sky |
| 8 | **The Screened Swamp** | a peat shelf, wide at the entrance and closing to a bank by the end | pools of open water punched into it that take you; reeds standing in them | mist-glow and the moments burning in the pools |
| 9 | **The Defect Scars** | an open plain of scorched clay | molten crust — wounds still open, and vacancies punched through the plain | red glow |
| 10 | **The Devouring Mirror** | shifting silver-violet | terrain reconfiguring around you | uncanny shimmer |

### 1 — The Mean Fields *(mean field, spontaneous symmetry breaking)*

You walk *in* a field, and forest is what hems it in. The walkable ground is the
bright one — wheat and mown grass, open enough to wander — and the surround is
dark canopy, so the value break runs the opposite way to a dirt-track world.

Partway along, a hedgerow opens out of nothing down the middle of the field,
widens, and closes again. While it stands there are two fields with no way
between them, tinted apart, and those are the degenerate symmetry-broken ground
states: the player picks one by picking a side and cannot unpick it until the
hedgerow ends. Scenery, not a diagram — a hedge in a field is the most ordinary
thing in the world, and it happens to be the shape of a broken symmetry.

**The forest is open to being thinned or removed on rendering-cost grounds.**
What it must not do is leave the world with nothing: with ground motifs gated
off, the impassable surround is the only place a world's identity lives, so a
world whose surround goes empty stops being anywhere. Something has to hem the
field in. Removing the trees also costs the 1↔8 rhyme below, which is built on
these specific trees — so that beat moves or is paid for elsewhere in the same
change rather than quietly lapsing.

The name is the register-setter for the whole set. "Mean field" is a technical
term wearing work clothes — a civilian reads *fields*, a physicist reads the
approximation. Worlds 1 and 4 both carry their physics in the *noun* this way;
every other world carries it in the modifier. That is a rhyme, not a
duplication.

### 2 — The Stone Lattice *(symmetries, tight-binding, effective models)*

Built rather than grown: an open-air stone cloister in hard midday sun, and the
only architecture in the game. The floor is wide flat pale stone with columns
standing in it, and it is cut out of a field of identical sandstone columns with
dark shadow gaps, evenly spaced, marching off in both directions — so the hall
is an aisle through a colonnade that continues past it rather than a room with
sides.

A colonnade is a lattice, and the player walks *through* it rather than beside a
picture of it: the columns in the floor are a periodic array of scatterers, with
a narrow aisle and a wide one alternating across the hall's width — the short
and long bonds of a two-atom basis, walkable instead of drawn. That is what lets
this world's ground be open without giving up its physics; the periodicity is
carried by what stands in the floor, not by the outline of a corridor.

The hall is straight-walled and constant-width, and it is the one ground in the
game that does not wander. Every contrast axis flips against World 1 at once —
organic vs. geometric, green vs. sandstone, soft irregular edges vs. hard
straight ones — which is what stops two consecutive daylight worlds from reading
as one. A cloister that drifted would be a ruin, and a ruin is a different world.

Civilization is a brief episode: one built world, then never again. World 9's
molten crust carries a few toppled column drums, which is what makes that a
story rather than a set-dressing experiment.

### 3 — The Winding Borders *(topological band theory)*

The generator partitions the grid into Voronoi domains — distinct bulk
topological phases — and the only walkable ground is the seam between two
differently-coloured ones. So: a lit ledge with a drop on either side, and the
bulk domains as sunken fields of dead rubble flanking it. Bulk-boundary correspondence
made literal — the edge state is the only place you can stand; the bulk is over
the side.

**This is the narrow world, on purpose, and the only one.** Every other world
gives the player open ground; here the ledge is all there is, because ground you
could walk out into would say the bulk is walkable, which is the opposite of
what this world exists to show. What it gets instead of width is *choice*: the
phase diagram is finely divided, so the seams form a network, and at every
junction where several domains meet the player picks which boundary to follow
north. Freedom without a single tile of walkable bulk, and a deliberate change of
pace between two open worlds.

**The drop is shallow, and never true void.** The domains are visible one storey
down as fields of dead rubble, jammed, airless, nothing moving. This matters for
three reasons: nothingness is World 7's one card, and spending it at slot three
pre-spoils the emotional peak the light rule exists to protect; a gapped bulk is
*matter* — present, extended, inert, just unavailable — which is the actual
physics; and the player still navigates by colour territory, which the Voronoi
shape depends on.

**The bulk is scree, and that is a legibility requirement before it is a
look.** Drawn as a flat wash it measured a local contrast of 0.03 against
0.8–2.1 for every other world's impassable ground: no surface at all, and a
surface-less expanse reads as another kind of floor rather than as somewhere you
cannot go. Talus is the terrain a body refuses before the mind is asked. What
delivers it is the hard cast shadow under every piece rather than the rock
itself, and three rules hold it there: **obtuse shapes only, and no glint**,
since facets and sparkle are the crystals' own language and the player and every
wild encounter is one; **nothing animates**; and **every phase keeps its rubble,
including the trivial one**, or that domain quietly recovers the walkable read
the whole material exists to remove. It earns a physics reading besides: a
gapped bulk is rigid and jammed, matter that cannot flow or carry anything
across itself, and rubble is the picture of exactly that.

**Each domain's invariant is countable in its ground.** A phase carries one slab
standing proud of its rubble per unit of invariant, so the label survives having
the colour drained rather than living in hue alone, and it can be checked against
the neighbouring domain across the seam. The tint says *which* phase; the count
says *which invariant*.

Wind over a world where nothing can move is the horror, not a contradiction:
clouds race overhead while the ground stays perfectly still.

### 4 — The Storm Flats *(integer and fractional quantum Hall effect)*

Discrete flat colour bands underfoot in a single-hue indigo ramp, a soft dark
strip along each band's lower boundary, and a glowing channel at every boundary
— which is not decoration but the subject, since edge channels live between
filled Landau levels. The bands run across the whole world, walkable and
impassable alike: they are a property of the ground, not of the route through
it. They are uniform along a row, which is why this world keeps its signature
while its floor stays flat.

Landau levels *are* dispersionless flat bands, so "Flats" is the physics, not
the weather — the same trick as "Mean Fields", where the terrain noun is also
the term of art. It is also the honest terrain noun for an engine that cannot
draw a hill.

**The impassable ground is the ground the storm strikes**, and sky and surround
are one event rather than two features: a forked bolt cracks down out of the
dusk every few seconds, lands in the off-path ground, and lights it for as long
as it lasts, leaving the burn scars the field is textured with. That is the
escalation spine stated in a single image — nobody has to be told why not to
walk there — and it is why this world sits between a drop and a glacier. **A
strike never lands on the walkable path**; one that did would say the opposite
of everything the world means.

Two constraints hold it there. **Occasional, never strobing** — a strike is an
event, and a continuously flickering frame competes with the fight and is
unpleasant to play under. And the flash stays **local to the tile it hits**: it
is momentarily the brightest thing on screen, and gameplay owns the extremes, so
the route and the player's own crystal have to keep their values through one.
Light falling on struck ground is honest here, since the sun is gone but the sky
is not — the light rule forbids received light from World 7 on, starlight
excepted, and that exception lights nothing.

The boundary shadow strips are lighting, not landform — they give flat bands
material depth without promising elevation the engine can't deliver. The bands
and their channels are what this world's terrain teaches; with a flat floor and
a name that speaks of flats rather than orbits, the quantised orbit itself is
carried by the world's writing and its quiz material rather than by the ground.

### 5 — The Vortex Glacier *(superconductivity, Nambu, Majorana)*

An open sheet of ice at overcast twilight, with one or two vortex pits punched
clean through it. The pits are dark, rim-lit, with a faint cold glow of trapped
flux down inside each one, and they sit out in the middle of the sheet so the
way past parts around them and closes again.

The winding is left to the geometry rather than drawn: a supercurrent flows
everywhere in the condensate and circulates around a trapped flux line because
there is no way through it, and that is exactly what the player does here.

Field expulsion is drawn where the field actually is: the pits. Everywhere else
the ice is blank and pale — the field has been pushed out of it — and the only
places anything shows are the cores, where the trapped flux glows. The world is
*the place that pushes something invisible away from itself*, told by where the
glow survives rather than by streaks on the road.

### 6 — The Iron Steppe *(classical magnetism, magnons)*

Night under a green aurora, on an open plain of black iron-sand — a steppe is a
plain, and this one is walked across rather than along. Standing in it are
clumps of aligned iron shards, all leaning the same way, flipping direction
across a domain wall. The magnetic order is something the player can see
standing up out of the ground — the shards are the order made visible, and the
domain wall is where it changes its mind.

The shards stand in **transverse wavefronts**, one wavelength apart down the
plain and each front offset sideways from the last, so the train reads as
travelling rather than as a fence repeated. A spin wave is a periodic
disturbance of an ordered medium moving through it, and here it is the thing the
player walks between.

This is the **false calm**, and it is anatomically correct: the *mood* relaxes
after ice and storm — the aurora is genuinely beautiful — while the *lethality*
does not, since leaning iron shards are the most overtly impaling surround so
far. A false calm the player cannot retrospectively recognize as false is just a
pretty world, so it needs one tell: the aurora stutters, or the shard field
beyond the domain wall visibly flips while you watch.

It is also the hinge of the light arc (§1): the sky still exists, but it is
already lying about where light comes from.

### 7 — The Entangled Web *(entanglement, tensor networks)*

No sky, no ground — only the network. The walkable ground is white-gold, the
game's one warm glow before World 9 burns, and its *shape* is the network: the
ladder of lanes and rungs the generator builds, hanging in true void.

In a tensor network the geometry *is* the entanglement: outside the network
there is no space. Rendering the surround as actual nothing is the honest
picture, not a mood choice, and this world holds the monopoly on it.

This is the one world where that honesty costs something. Its surround draws
nothing by definition and its floor is flat like every other, so the corridor's
own outline is the whole of what identifies it — this world leans harder on
shape alone than any other, and it is the first place to check after any change
to the boundary treatment or the generator's ladder.

Keep it still and structural — "shifting and alive" belongs entirely to World 10.

### 8 — The Screened Swamp *(quantum magnetism, spinons, Kondo)*

Open black water under low mist, reed clumps standing out of it, and peat that
holds. No trees: the silhouette is horizontal — flat water, flat mist, upright
reeds — which is what keeps it clearly apart from World 7's web overhead and
World 9's broken ground.

**The shelf closes as you go.** The peat enters wide and open, with the odd pool
in it, and by the goal it has narrowed to a bank threading between water. That
is the escalation spine written into the floor rather than into anything the
player is told: the water is winning, and further in is further screened.

**The threat is the water, not the reeds.** Reeds are "you just wouldn't walk
there" — World 1's logic, which would regress the escalation spine at world
eight of ten. The water is what takes you: stray from the bank and the medium
itself absorbs you, which is Kondo screening and spinon confinement made into a
hazard rather than a diagram.

**Screening is visible or the name is a lie** (the naming law). Lone bright
points burn in the water — local moments — and each is being closed over by a
halo of small counter-lights gathering around it. Near the entrance a moment
still burns through its halo; deeper in, the halos have shut and the points are
out. That is the screening cloud rendered as the thing it is: the medium's own
carriers crowding a moment until its magnetism is gone, and it doubles as the
escalation spine, since further in is further screened.

**The split and the screening are one picture.** The corridor parts into two
thin parallel banks and rejoins — spinon fractionalization, the world's other
topic — and what it parts *around* is a pool with a screened moment in it. The
path splits because something in the water is being put out.

The mist lies *on the water*, not through the air: this world's sky is open
above it, which is what lets the star arc's first links be seen here (§1's "The
stars"), and it keeps World 8's low mist distinct from World 9's occluding
cloud. The light is still the world's own — mist-glow and the moments' own
burning — so the light rule holds.

Palette: near-black green-grey water, sickly pale mist, reeds darker than
either.

### 9 — The Defect Scars *(excitations and defects)*

Damage past and damage present, in the same frame: the walkable scorched clay
reads as old scars, closed and healed-over, while the impassable molten crust is
wounds still open and glowing. A lattice defect *is* frozen-in damage that never
heals, and the contrast between the two carries it — the route is the damage that
stopped, the surround is the damage that did not.

The plain carries two kinds of defect, which is what makes it a *sample* rather
than a ruin. Patches of worlds 1–8's own looks are embedded along it — borrowed
defect "types," the wrong atom on the right site, changing nothing about the
ground but how it looks, and also where World 2's toppled column drums belong,
half-sunk in the crust. And vacancies: holes punched clean out of the plain with
the crust glowing in the gap, a site not occupied at all, which the player has
to walk around rather than over.

Both need the plain to be mostly *good* crystal to read at all. A defect is a
local disturbance in something otherwise regular, so the ground is wide and
whole, and the damage is what interrupts it.

### 10 — The Devouring Mirror *(machine learning for quantum materials)*

The world that isn't a world, and the only name in the set with no terrain noun
— which is correct, because a mirror is not a place you visit, it's a thing you
face. Shifting silver-violet, the terrain reconfiguring around whatever crystal
the player currently is: the name has to be a description rather than a boast,
so the world must visibly *take* something.

**The surround is the player, rendered.** The impassable terrain does not merely
reconfigure — what it reconfigures *into* is increasingly defined copies of the
player's own crystal, sharpening as they approach the boss. That is the training
loop drawn as terrain, and it is what cashes both the devouring and the mirror.
On screen the surround is faceted silver-violet that re-cuts itself on a slow
cycle, tinted toward the player's own crystal colour; drawing those facets as
the copies themselves is tracked in `REFLECTIONS_BUILD_TASK.md`.

The other half of that loop — **the path dissolving behind the player as the
world re-forms ahead**, so the world eats the trail at the back and emits the
player at the front — is written as this world's floor motif and sits behind
`GROUND_MOTIFS_ENABLED` with every other world's (`STYLE.md`'s "Overworld
path"). While the floor is flat and the copies are undrawn, both halves of the
image are carried by the writing rather than by the terrain.

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

Its road ends at a cliff, and the Qumatuomi map lies below it (§4) — every world
at once, seen from above, which is the view a trained model has of its training
data.

The finale, stated plainly: **the last world defeats you by understanding you,
and understanding a quantum thing collapses it.** This is also the payoff for
"you are a quantum material" — the player's quantumness is what is at stake, and
the last enemy is observation itself.

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
| 8 | near-black green-grey water, sickly pale mist, reeds darker than either |
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
cracked glow-veined ridge for the Defect Scars. A generic hill profile in a
different colour per world fails this rule: it is the theming *not* made visible
at distance.

**A world never sees its own distant self.** Standing in world N the horizon
composition draws world N+1's and nothing else, so a world's own statement of how
it looks from outside is only ever rendered by whoever is looking at it. World 1's
entry is therefore authored and never composed into anyone's horizon: nothing
precedes it, and it has no view behind. What a world shows above its own horizon
line is its air, its overhead motif and its neighbour — never a portrait of itself.

**The swallowed set** — the worlds whose distant self is no silhouette at all:

- **The Entangled Web** has no surround — its impassable is nothing — so its
  distant self is an absence with structure: the sky ending, thin white-gold
  filament glints in blackness where a horizon should be. Swallow zero. This is a
  gift rather than a gap: the Iron Steppe's forward horizon showing the world
  *stop* is exactly the tell its false calm needs, supplied by the composition
  system for free.
- **The Screened Swamp** has a distant self, but neither half of it is a
  silhouette: a dead flat band of mist glowing off standing water, with dark reed
  clumps standing in it. A drowned silhouette can only ever be one value, and this
  needs two — the band must run *lighter* than the air it is seen in and the reeds
  *darker*. Both are therefore drawn as a sky extra at swallow zero. The profile
  is dead flat because a bog is: everything upright in that world is reed.
- **The Devouring Mirror** has no next world and no distant self at all: its
  road stops at a cliff, and what is beyond the edge is the Qumatuomi map lying
  below it (§4) rather than any silhouette. Its swallow is zero so that the
  Defect Scars' forward horizon does not wear a violet ridge the Mirror never
  had.

### The adjacency rule

**Adjacent distant selves must differ in shape-language or sky-activity, never
in hue alone.** Hue is already guaranteed to shift by haze inheritance; this rule
exists to catch the case where hue is *all* that shifts. Two worked examples,
both already resolved:

- **Winding Borders → Storm Flats** cannot satisfy this on shape: both worlds are
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

**Gated on gate state:** a shut gate — one whose rival still holds the pass —
means no forward palette bleed.

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
truer than weather. A pass is where coherence used to flow between worlds, so a
pass is where the grinding happened, and what is left of that world's material
is lodged in the one place it could not be carried out of. The golem is not
posted there. It is caught there: it was carrying its world's coherence through
the pass when it was learned to exhaustion, so it fell where the grinding
happened, and holding the boundary reads as its nature rather than as a staging
choice. It also preserves
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

**World 1's backward exit is not a pass**, because it does not lead to a place.
Every geographic boundary in the game narrows into one; this boundary never
narrows, and it stands empty — no board naming what is beyond, since nothing
lies beyond it that a name would fit. What tells the player it is there is the
prompt the approach raises. The asymmetry is the ontology made visible, and it
is made visible by an absence, which is the honest shape for a way out of the
world.

Wayfinding is not the problem a gate solves — a corridor has nowhere else to
walk. What the gate must carry is **state**: the way forward opens only once
that world's rival is beaten. The forward pass therefore has two states, and
the guard is the whole of what tells them apart.

- **Rival unbeaten** — the rival fills the pass, and nothing of the next world
  is visible past it. Haze inheritance does not run: a shut gate shows nothing
  of what lies beyond it. Nothing else marks the state, because a body in the
  way is a plainer statement than any weather drawn over the gap.
- **Rival beaten** — the pass clears and the notch beyond it carries the next
  world's palette, the brightest thing on screen or, in the late worlds, the
  most wrongly-coloured. Light through a doorway, and diegetic: what is visible
  through the gap is the destination itself.

One ground-level cue joins the open state: the next world's walkable colour
bleeding across the last two or three tiles, a seam the player visibly steps
over.

**A backward exit is a pass with a board and no guard.** It carries no state —
the way back is open from the moment the player arrives, having walked in
through it — so nothing bars it and nothing has to signal that nothing does.
Two states belong to the forward pass alone.

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
everywhere. The player is a quantum material and the Lab is where that material
is examined, so it is better understood as the inside of the thing being played
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

### The Qumatuomi map below

The Devouring Mirror's road does not run on. It ends at a cliff, and what lies
below the edge is the Qumatuomi map — the game's own world map, a
geographically traced silhouette on which World 10 sits at Espoo's real
coordinates — seen from above.

It is the only world-end that is not the next world, because instead it is
*every* world, seen from outside and above. That is precisely the view a trained
model has of its training data: the Mirror can show the whole map at once
because it has consumed all of it. The player only gets that view by beating the
thing that had it.

**The edge is earned, and the world changes at it.** While The Adapted stands in
the pass, the Mirror is an ordinary corridor and the map is not visible at all.
Once it falls, the road past the pass is simply gone: no repeated road, no
horizon silhouette, no ground at all past the last row — the world stops, and
the view opens. The finale is taken standing at that edge.

**Render it as ground far below, not as an image pasted flat to the screen**: it
lies in the gap between the cliff lip and the horizon, with the cliff's own
shadow under the lip and a stretch of unseen ground between, dimmed and hazed by
the same atmosphere that fogs everything else and more heavily toward its far
coast. The haze is what does the work — fog is the cheapest signal that
something is scenery, and an interface element is never fogged. Unhazed it will
read as a misrendered minimap, and players will try to click it. Self-luminous,
per the light rule: the record glows, nothing shines on it.

**The shape is the point, and outranks the perspective.** It is drawn through
the same uniform scale-to-fit the panel map uses, in the same land colours, so
the coastline below is recognisably the same one Bloch's panel shows. The player
has to *recognise* it — that recognition is the whole reveal — so the only
concession to looking down at it is a mild vertical squash. A steeply
foreshortened map that reads as a generic landmass has thrown away what it was
for.

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

**Loss (8).** The emotional beat: something is taken from the player
specifically, rather than the sequence simply running pretty → moody → dead.
World 8 carries it as the world putting its own lights out — a moment still
burning near the entrance and nothing but shut halos deeper in, so walking
the world *is* watching it go out. **This beat is currently the weakest of
the three and is open to being re-anchored**: it has no callback to an earlier
world holding it up, and a recognisable thing shared between World 1 and World
8 would be the cheapest way to give it one.

**Recognition (10).** The world turns to look. After nine worlds of terrain that
did not know it was being walked on, the last one is built out of the player —
and that is what finishes them, because being known is the mechanism of the
decoherence that has been advancing since World 1.

One cheap seed makes the turn land rather than arrive from nowhere: the
occasional pool in the Screened Swamp shows the player's *own* colour back at
them, wavering on the water. The first hint that the world contains things like
you, immediately before it becomes a thing that *is* you — and it rhymes
straight into World 10, since the player meets their own reflection in a bog
and the last world is a mirror.

**That reflection must stay broken**: a few soft shapes sliding against each
other on moving water, never a likeness assembling itself. The gradient only
works if the two stages read as different phenomena — **something in the water,
then a portrait** — so that World 10's rendered reflections (§2) land as
categorically new rather than as more of the same. Left unspecified, this is
exactly the detail an artist will naturally polish, and polishing it costs the
reveal. It is also rare on purpose: a hint the player notices and wonders about,
not one they can catalogue.

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
| `STORY_BEATS` | `data/story.ts` | after a rival is beaten | the golem's release, observed by the narrator, then connective tissue looking forward |
| `WORLD_GOAL_TEXT` | `data/story.ts` | on reaching the goal tile | one line: this world's physics still holds |
| `WORLD_FLAVOR` | `data/worldFlavor.ts` | Bloch's destination preview | plain physics, deliberately *not* narrative |

**The Decoherence is never generic.** In every world it attacks one *named
mechanism*, and always the one that world exists to teach — it doesn't erase the
Meadow's order, it makes the broken symmetry doubt itself; it doesn't break the
lattice's atoms, it puts one alcove fractionally out of step so the delocalized
state has nowhere to live; it doesn't touch the Majorana halves, it shortens the
passage until they can feel each other. A world whose Decoherence page could be
pasted into another world's slot has failed this rule.

**Every rival 1–8 is the same shape: *I am what this world's physics became
when its coherence was ground out of it, and I have mistaken that for
strength.*** A golem is not a champion posted at the pass. It is what the
Decoherence leaves behind: the world's own material — the one that resisted
being learned the longest, which is exactly why it had to be learned to
exhaustion — its order broken, lodged in the choke point where coherence used
to flow between worlds, reciting the mechanism it can no longer perform. The boast is always the precise mechanism
that answers the attack named on that world's second lore page, and it is always
the precise property the golem has lost. Both readings must survive in the same
words.

Four rules hold that shape together.

**The golem never learns what it is.** The boasts stay proud, and the fights
stay dangerous. A rival that pitied itself would drain every victory in the
game, and ten of them would drain the whole road. Only the player's
understanding changes; the golem's never does.

**The name does not change.** Every rival 1 to 9 is a real material in
*polycrystalline* form, and that uniformity is the drumbeat: the same word in
front of every boss in a game about coherence, which is the earliest clue and
the one the player stops noticing. What each golem lost is said in its own
dialogue instead, never in its name, so the name stays a label and the physics
stays a thing the golem says about itself. World 10 states the loss by carrying
no material name at all.

**What a golem throws is decohered.** Its moves carry its world's own
quasiparticle at its own class and power, named for what that excitation used to
be (Decohered Chiral Current, Decohered Magnon Pulse). The corruption is in the
excitation, not in the rulebook: the type-interaction rule is untouched, so a
golem still lands double on a defender whose physics cannot host its class.
World 2 is the far end of that gradient and carries no signature move at all,
because a material with no lattice left has nothing but its own vibration.

**Beating a golem frees the material, and only the narrator says so.** Golems
1–8 are fallen resistors: each was its world's own material, the one that held
out longest against being learned, ground to exhaustion where it stood. When
one falls, its disorder anneals and the freed material rejoins its world — the
post-victory story beat (`STORY_BEATS`) states this as a physical observation
in that world's own physics vocabulary, ahead of its forward look. The
guardrails on this are all load-bearing:

- **No post-battle golem dialogue surface exists, and none may be added.** The
  freed material never speaks, never thanks, never lingers as a figure in the
  pass; gratitude anywhere would break "the golem never learns what it is."
- **The light never returns.** Liberation restores the mechanism and frees the
  material; no beat says fog lifted or a world brightened. The lost light is
  cost already paid, which is what keeps the arc melancholy rather than
  triumphant.
- **Liberation frees the material but does not un-teach the Adapted.** The
  lesson stays taken — the record lives in the Adapted, not in the residue —
  so "the golems are its leavings" holds intact.
- **World 9 is exempt**: the flaw has no coherence to lose, so there is
  nothing to free. It disperses, and the ground it borrowed goes back to being
  ground. Its own taunt states the exemption from the inside ("nothing was
  ever taken from me"), which is also its strongest seed of the reveal.
- **World 10 cannot be freed**: disorder anneals, a record does not. The
  Adapted is not a fallen quantum thing; it is the record itself, and the
  finale refuses reversal ("stabilized," never undone).
- **"Hero" appears in no player-facing string.** The resistance is told in the
  lore closers' hearsay voice on the tone gradient; the release is told by the
  beat as annealing observed, never as an emotional transaction.

That is why the rivals feel like part of the story rather than a difficulty
gate, and it is the pattern any new rival must follow.

**World 9 breaks the shape once, and World 10 breaks it permanently.** World 9's
rival has no lattice of its own and borrows whatever it lands in: the one thing
in these worlds with no coherence to lose, which is why it is the only rival the
Decoherence took nothing from. World 10's is the reveal, and it turns on the
golems rather than replacing them: the Adapted was never one of them in disguise
and never sent them, because measurement does not need a soldier. **The golems
are its leavings.** Learning a quantum thing to exhaustion is what makes it
definite, and a material that has been made definite is a material whose
coherence is gone. Every pass the player forced was held by the residue of that
learning, and every rival brought down was a lesson the Adapted had already
taken. That is the arc's payoff and the reason the finale is a mirror: the
Adapted's model of the player, complete and predictive and incapable of
superposition, is the tenth golem, and the player is looking at it.

**The golems stay innocent, and this is load-bearing.** They are never the
Adapted's agents. Each one fought the Decoherence and fell — its world's
coherence-bearer, learned to exhaustion — which is the opposite of serving it.
If they are ever rewritten as the Adapted's servants the reveal dies, because
"it was never one of them in disguise" only lands while they are something it
made rather than something it wore.

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
  strips and the strikes are what keep it material; if either is dropped, the
  world regresses immediately.
- **World 3's name does not name a landform the engine has to imply.** A cliff
  is the one landform it cannot draw, and a name resting on one describes a
  world the player never sees; "Borders" rests instead on the thing the
  generator actually builds, a network of seams between territories, and
  "Winding" carries the invariant for anyone who knows the term while reading
  as plain twisting for everyone who does not. The rule this is an instance of:
  a name has to survive being checked against the frame.
- **The 4→5 step is the flattest on the staircase** — storm to cold quiet is
  lateral rather than an escalation. Twilight is darker than dusk and the
  descent into cold reads as its own kind of worse, so this is tolerated rather
  than fixed.
- **"The Stone Lattice" is the one name that names an object rather than a
  place.** Kept because it preserves the tight-binding topic word. "The Stone
  Rows" is the alternative if place-ness ever matters more than the topic.
