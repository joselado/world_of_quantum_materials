# Build task — the battle themes and the finale

Open music work and the reasoning behind it. `DESIGN.md` §7 "Soundtrack" is the
authority on what the music currently *is*; this file holds what is still being
decided and why. Delete it once the decisions land and §7 absorbs them.

---

## A verification fact that governs all of this

**`assertLoopBeats` calls `console.error` — it does not throw.** A score whose
parts do not sum to its loop length still boots, and **every `component-check`
test still passes while the music is silently broken.** A green 53/53 is not
evidence for a music change.

The check that covers this work is driving the game headless and watching for
`music:` messages on the console. Zero is the pass. Do that on every music
change, and say so in the report rather than citing the suite.

## What has landed

The battle band now plays through every section seam: the two-beat dropout
entering the B riff is gone from vamp, lead, octave double and hats, the
automatic brass pickups are gone entirely, and the section crash sits on B's own
downbeat rather than on a slam-back that no longer exists. Applied to both the
generator and World 1's hand-written score; the dead helpers were deleted rather
than left behind. The loop-point walk-up, the snare fill and the hat lift are
kept — those are fills, not holes.

The reasoning, since it constrains what comes next: **stop-and-slam is a modern
rock and EDM device.** The themes this game is reaching for do the opposite —
the rhythm section essentially never stops, and contrast comes from new melodic
and harmonic material over an engine that keeps running. A dramatic hole also
ages badly under repetition, and a battle loop repeats dozens of times per
session. With synthesised voices there is no performance nuance to sell a
dropout, so subtraction reads as the music faltering rather than a band leaning
in.

## The decisions, settled

### World 8 is both — the spike rides the slope

The question was a false choice: **"what erodes" and "how much erosion" are
orthogonal.** The erosion dial governs a *process*; World 1's melody is
*material*. So the dial sweeps across 5→9 as a continuous decay, **and** the
material passing through the eroder at World 8 is World 1's tune at the tritone.
The erosion peaks exactly when what is eroding is the one thing the player
recognises.

**World 8 must keep the quotation**, because the 1↔8 rhyme is already built in
another medium: the same tree sprites, dead and grey, specified precisely so the
player recognises the friendly wood. If the visuals say *this specific place,
ruined* while the music says *generic stage six of a gradient*, the two media
disagree about what World 8 means. The music's job is to agree — the same tune,
dead and grey.

**World 7's cliff is safe**, because it is made of different substance from the
slope: its break is *categorical* (bass, pad and progression deleted, reverb
arriving) while erosion is *quantitative* (notes becoming rests), so a rising
erosion value passes underneath the deletions without touching them. The pin that
makes that permanent rather than lucky is the **musical light rule**, now in
`WORLDS.md` §1: what World 7 deletes never comes back.

### Three quotations of World 1, each a different transform

The game quotes World 1 three times, and that is an arc rather than a tic:
**World 6** takes its key and progression with a wrong drone grinding underneath,
**World 8** erodes its melody at the tritone until silence, **World 10** devours
it among nine others. Quotation becomes self-indulgent when the *same* transform
repeats; here each instance does something new to the same body. World 8 quotes
one thing achingly, World 10 quotes everything indifferently — grief against
ingestion — and each makes the other legible by contrast.

### World 10: simultaneous recombination at a fixed tonic

**Not sequential switching.** Two seconds is a radio scan, and a longer interval
only makes it a slower one — the fix is to drop rotation-as-switching entirely.
The Mirror's claim is mastery, and a trained model does not replay its inputs in
sequence, it superimposes what it learned. So the texture is **always several
worlds at once** — one world's bassline under another's lead under a third's
percussion — and what rotates is **which world carries which voice**, per phrase
of four to eight bars. That is fluency in every style rather than tuning between
stations.

**The fixed F♯ tonic is the enabling condition, not a flavour choice.** Nine
styles in nine keys layered together is mud; one tonic is what lets the collage
exist at all. Recognisability survives easily — transposition is the gentlest
transform in music, since identity lives in contour and rhythm, and World 8
already proves a mode-snapped quotation stays recognisable, recognisably *wrong*,
which is the desired reading. C returning as the Mirror's raised fourth keeps the
dead sun hanging over the whole collage.

### The canon and the mixture are layers, and their interaction is the finale

The mixture is the Mirror's ambient voice — the devoured worlds rehearsing
underneath. The tightening canon closes *over* it: the subject is the player,
being learned, while the model murmurs everything else it has ever eaten.

**As the canon tightens, the mixture thins.** A bar behind, the full nine-world
texture; two beats behind, voices dropping out; at unison the mixture is gone and
only the unison line remains — the model no longer needs its other data, because
it has become you. That final thinning rhymes with World 8's erosion into
silence: the game's two silences, one where the tune is lost and one where the
tune wins alone.

### The distortion is the timbre of the copy

**Not a blanket `drive` across World 10** — a soft-clip painted over everything
is the evil-filter cliché and spends the parameter on mood. Instead, **drive
marks devoured material**: the borrowed styles in the mixture play through the
soft-clip, because a model's rendering of its data is lossy and the clip is that
loss made audible, while the player's own melodic line stays clean.

That hands the canon its best trick for free. The Mirror's imitating voice is the
*driven* copy of the player's clean line, so the two canon voices are
distinguishable by timbre at any distance — original against lossy reproduction —
and at unison the clean and clipped signals fuse into one slightly degraded
voice. The distortion is then not atmosphere but **the sound of being imperfectly
known**.

## Superseded framing, kept for the reasoning

### World 8: nostalgic quotation, or a stage in a uniform decay?

**As built**, World 8 plays World 1's melody at the tritone, snapped downward
into the mode, each phrase losing a note until the last bar is silence.

**The alternative** is that worlds 5–9 share one continuous process that ramps
across them, so World 8 is a *stage* in a decay rather than a bespoke gesture.
The mechanism already exists as a proposed **erosion schedule** dial: notes
removed per phrase repetition, each removed note becoming **a rest of identical
duration** so beat totals cannot drift, with a deterministic removal order —
shortest duration first, offbeat before on-beat, latest position last. Long
on-beat notes die last, so the skeleton survives longest, which is also how a
memory fades.

The case for it: the front half is *one light going out* across six worlds,
while the back half is currently five discrete events. A ramp gives the late
game a spine the early game already has.

**The constraint if it is taken: the ramp must run underneath World 7's
discontinuity, not dissolve it.** The light rule makes World 7 a hard break —
the sun never returns — and the music mirrors it by deleting bass and pad and
switching on reverb for the first time. A slope with a cliff in it, never a
slope instead of a cliff.

**The cost if it is taken:** World 8 stops being *nostalgic* loss and becomes
*structural* loss. Still the loss beat, but without the ache of hearing a tune
you recognise come back wrong.

### World 10: what the Mirror plays

Three candidates, and they interact with the World 8 decision through what might
be called the game's quotation economy — how often it is allowed to quote itself
before a callback stops being an event.

1. **A canon that tightens.** 32 bars, the only piece outside the i–♭VII
   grammar, on an F♯–C tritone vamp over a bass pedal that never moves; the copy
   enters a bar behind, then two beats behind, then reaches unison — the model
   progressively learning you — and the loop turnover discards the copy and
   begins observing again. Its subject would be World 1's *battle* melody, which
   is a second quotation of World 1 if World 8 keeps its own.
2. **A mixture of all nine worlds**, changing style smoothly. Thematically the
   strongest fit: the Mirror has devoured nine worlds, its sky already shows the
   whole map from above because it is the only world entitled to see all worlds
   at once, and music assembled from all nine says the same thing in a second
   medium. It also resolves the quotation economy by contrast rather than
   compromise — World 8 quotes one thing achingly, World 10 quotes everything
   indifferently.
3. Both, if the borrowed styles can rotate underneath while the canon closes
   over the top.

**Two sub-questions on the mixture.** *Interval*: a switch every two seconds is
about five beats at this tempo, so nothing establishes — and there is a real
difference between a model fluent in every style and a radio being tuned. The
Mirror is the one boss that earned coherence. *Mode*: sequential rotation reads
as memory; several worlds playing at once, one world's bassline under another's
lead, reads as mastery.

**The variant worth testing first: hold the tonic fixed.** Let the Mirror play
all nine worlds **in its own key** — F♯ throughout, with C still returning as the
raised fourth. A trained model does not replay its inputs; it re-renders them in
its own latent space. The worlds you walked, wearing the wrong tonality, is more
unsettling than a style-switcher, and it preserves the F♯–C spine rather than
abandoning it.

**Small distortion for ominousness** is wanted somewhere in here. The engine
already has a soft-clip `drive` flag, so this is a parameter rather than new
machinery.

## Pending work already specified

- **Stepwise bridge licks.** The universal bar-7 slot replaces the current
  arpeggio licks, which spell out the destination chord before it arrives and so
  kill the arrival. The walk-up's target is the **fifth of iv, not the root**, as
  anticipation-plus-restrike; the bar-15 return is the opposite pole, the home
  root approached from below. Two rules, no per-world exceptions.
- **Composed leads.** The current lead is chord-tone punctuation regenerated per
  bar — `stabBar` is bar-local *by signature*, so it cannot know it is halfway
  through a phrase, which is why it reads as sequenced rather than composed.
  `modernPhraseCell` already composes a four-bar arc and is the in-file proof
  that a phrase-length lead is reachable.
- **A golem theme**, so a rival stops sounding like a wild encounter. One degree
  map transposed across nine worlds, bare fifths for mass, built by accretion —
  fragments, then a rising ladder, then the fragments again, because the golem
  never stays assembled. Half-time backbeat only where the world tempo is at or
  above 140; below that a snare every ~2.2 s is absence rather than weight.

## A pre-existing defect, unfixed

World 1's hand-written bridge into the B riff — a descending line into the root —
contains a pitch belonging to **neither key involved**, neither the home minor nor
the subdominant minor that section modulates to. It has been there all along. It
also approaches from above and lands on the root, pre-empting B's own material,
which wants to arrive on the fifth and sink to the root itself. Replace it when
the stepwise licks land.
