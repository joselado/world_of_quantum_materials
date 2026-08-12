# Guardians

One guardian waits partway through each of the ten worlds, each teaching a
different way of bending the game's usual rules. Every guardian you've met
stays reachable from the Guardians panel (Enter-key menu), from anywhere in
the game.

| Guardian | World | What they do |
|---|---|---|
| [Noether](#noether) | 1 | Sells ordinary moves and stat upgrades |
| [Bloch](#bloch) | 2 | Teleports you between worlds you've visited |
| [Dresselhaus](#dresselhaus) | 3 | Lets you transmute into a defeated crystal |
| [Laughlin](#laughlin) | 4 | Sells two quiz-gated Analytic moves |
| [Majorana](#majorana) | 5 | Fuses two crystals into a hybrid state |
| [Anderson](#anderson) | 6 | Lets you dope in an impurity move |
| [Bohr](#bohr) | 7 | Teaches always-on passive abilities |
| [Kondo](#kondo) | 8 | Sells self-buff moves |
| [Franklin](#franklin) | 9 | Teaches always-on passive abilities |
| [Skłodowska-Curie](#skłodowska-curie) | 10 | Teaches two quiz-gated Ultimate moves |

*Franklin's/Bohr's passive tables below are generated from
`game/src/data/passives.ts` -- run `npm run docs` in `game/` after changing
`PASSIVES`, don't hand-edit the `<!-- GENERATED -->` blocks.*

## Noether

Sells every ordinary attack move and stat upgrade in the game, priced by raw
power. What actually shows up in her shop is filtered down to whatever your
*current* crystal form can physically host (see
[Quasiparticles & moves](quasiparticles.md)) -- a semiconductor-type player
(Silicon, by default) only ever sees Electron Pulse until transmuting into a
form whose physics supports the rest.

## Bloch

Folds space between worlds: teleports you to any world you've already
visited, so backtracking never means re-walking a whole corridor.

## Dresselhaus

Lets you *transmute* into any single crystal you've already defeated,
swapping your own look, stat spread, and which moves are currently usable
without erasing anything you've learned -- switching back later restores the
rest for free. Only offers standalone crystals, never a
[hybrid](hybrids.md).

## Laughlin

Sells two quiz-gated Analytic moves that ask a physics-equation question
before they land -- answer right for double damage, wrong for half -- with a
dramatically flashier effect than an ordinary move. The question pool is
restricted to worlds you've already visited, so early on Laughlin only draws
from what you could plausibly already know. Buying (or later revisiting
Laughlin) also lets you pick which quasiparticle the move should carry,
filtered to only the classes your *current* form can host; the move itself
stays usable from any form and always asks its question, but that choice
decides whether it can land a quasiparticle-mismatch hit like an ordinary
attack. If you later transmute into a form that can't host the quasiparticle
you picked, the move falls back to Phonon Beam (the one class every form
hosts) until you retune it.

## Majorana

Lets you fuse two crystals you've already defeated into a brand-new hybrid
state and become it, if the pairing is one of the game's named recipes (see
[Hybrids](hybrids.md)) -- rendered as an actual mixture of both parents' own
colors and shapes. Recipes don't accumulate: every visit starts the pick
fresh rather than remembering past fusions.

## Anderson

Lets you "dope in" a crystal you've defeated as an impurity and learn one
specific move from it -- borrowing a single excitation channel without
becoming that crystal the way Dresselhaus does. The move fires in battle for
as long as you stay doped with that crystal, even if your own current form
can't otherwise host it -- dope in a different crystal later and you lose
the channels only the old one gave you. Only original, standalone crystals
are valid hosts, never a [hybrid](hybrids.md).

## Bohr

Teaches three passive abilities -- an always-on effect for the whole battle,
not a move you pick each turn. You can learn all three, but only one is ever
equipped at a time; switching means talking to Bohr again.

<!-- GENERATED:BOHR_PASSIVES_TABLE START -->
#### Bohr's passives

| Passive | Effect | Cost |
| --- | --- | --- |
| Correlated Response | An opponent's crit against you guarantees your own next move crits. | 40 |
| Nonlocal Correlation | Boosts your Correlation by a share of the opponent's Quantumness. | 45 |
| Shared State | A share of damage you deal returns to you as healing. | 50 |
<!-- GENERATED:BOHR_PASSIVES_TABLE END -->

## Kondo

Sells three self-buff moves -- cast on yourself, not the opponent, and no
damage dealt. Screening Pulse shields you, reducing incoming damage for a
few turns; Scattering Drag makes you evasive, giving incoming hits a chance
to miss entirely; Coherence Cascade sets you regenerating, healing you a
little each turn. You pick which buff by picking the move, and only one can
be active at a time; switching means talking to Kondo again.

## Franklin

Teaches three passive abilities, the same "learn several, equip one" shape
as Bohr's -- themed around X-ray diffraction of a defect-riddled or porous
crystal, the way a real diffraction pattern blurs from sharp spots into
diffuse rings as a sample's disorder increases.

<!-- GENERATED:FRANKLIN_PASSIVES_TABLE START -->
#### Franklin's passives

| Passive | Effect | Cost |
| --- | --- | --- |
| Diffraction Shadow | A defect-riddled lattice scatters and attenuates an incoming blow, the way porous carbon attenuates an X-ray beam. | 40 |
| Satellite Reflection | A critical hit throws off a secondary diffraction peak -- a bonus follow-up damage tick. | 45 |
| Amorphous Halo | A diffuse, defect-broadened halo softens the quasiparticle-mismatch double damage to a smaller multiplier. | 45 |
<!-- GENERATED:FRANKLIN_PASSIVES_TABLE END -->

## Skłodowska-Curie

The guardian of World 10, regarded as the leader of the guardians' circle.
Sells two quiz-gated Ultimate moves, "[Quasiparticle] Meteor" and
"[Quasiparticle] Nova" -- each far more powerful than any ordinary move in
the game, and gated accordingly: landing one requires answering three
physics questions in a row, all correct, drawn from a broad pool spanning
everything the course has covered rather than any one world's topic. Missing
even one question makes the move whiff for zero damage, though the turn is
still spent. Unlike every other tunable move in the game, picking which
quasiparticle an Ultimate move should carry isn't a flat purchase: each
quasiparticle class costs 1000 qumatessence to unlock *per move*, after which
retuning back to that class is free forever. Landing a 3-for-3 hit
plays a dramatically longer, multi-phase summoning animation than any other
move in the game.
