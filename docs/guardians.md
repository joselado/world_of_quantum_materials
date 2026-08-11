# Guardians

One guardian waits partway through each of the first nine worlds, each
teaching a different way of bending the game's usual rules. Every guardian
you've met stays reachable from the Guardians panel (Enter-key menu), from
anywhere in the game.

| Guardian | World | What they do |
|---|---|---|
| [Noether](#noether) | 1 | Sells ordinary moves and stat upgrades |
| [Bloch](#bloch) | 2 | Teleports you between worlds you've visited |
| [Dresselhaus](#dresselhaus) | 3 | Lets you transmute into a defeated crystal |
| [Laughlin](#laughlin) | 4 | Teaches always-on passive abilities |
| [Majorana](#majorana) | 5 | Fuses two crystals into a hybrid state |
| [Curie](#curie) | 6 | Sells quiz-gated "analytic" moves |
| [Bohr](#bohr) | 7 | Teaches more passive abilities |
| [Kondo](#kondo) | 8 | Sells status-inflicting moves |
| [Anderson](#anderson) | 9 | Lets you dope in an impurity move |

*Laughlin's/Bohr's passive tables below are generated from
`game/src/data/passives.ts` -- run `npm run docs` in `game/` after changing
`PASSIVES`, don't hand-edit the `<!-- GENERATED -->` blocks.*

## Noether

Sells every ordinary attack move and stat upgrade in the game, priced by raw
power. What actually shows up in her shop is filtered down to whatever your
*current* crystal form can physically host (see
[Quasiparticles & moves](quasiparticles.md)) -- a trivial-type player only
ever sees Electron Pulse until transmuting into a form whose physics
supports the rest.

## Bloch

Folds space between worlds: teleports you to any world you've already
visited, so backtracking never means re-walking a whole corridor.

## Dresselhaus

Lets you *transmute* into any single crystal you've already defeated,
swapping your own look, stat spread, and which moves are currently usable
without erasing anything you've learned -- switching back later restores the
rest for free. Only offers standalone crystals, never a
[hybrid or doped compound](hybrids.md).

## Laughlin

Teaches three passive abilities -- an always-on effect for the whole battle,
not a move you pick each turn. You can learn all three, but only one is ever
equipped at a time; switching means talking to Laughlin again.

<!-- GENERATED:LAUGHLIN_PASSIVES_TABLE START -->
#### Laughlin's passives

| Passive | Effect | Cost |
| --- | --- | --- |
| Fractional Guard | Incoming damage is multiplied down for the whole battle. | 40 |
| Anyon Echo | A critical hit triggers a bonus follow-up damage tick. | 45 |
| Edge Current | Softens the quasiparticle-mismatch double damage to a smaller multiplier. | 45 |
<!-- GENERATED:LAUGHLIN_PASSIVES_TABLE END -->

## Majorana

Lets you fuse two crystals you've already defeated into a brand-new hybrid
state and become it, if the pairing is one of the game's named recipes (see
[Hybrids](hybrids.md)) -- rendered as an actual mixture of both parents' own
colors and shapes. Recipes don't accumulate: every visit starts the pick
fresh rather than remembering past fusions.

## Curie

Sells "analytic" moves that ask a physics-equation question before they
land -- answer right for double damage, wrong for half -- with a
dramatically flashier effect than an ordinary move. Buying (or later
revisiting Curie) also lets you pick which quasiparticle the move should
carry, filtered to only the classes your *current* form can host; the move
itself stays usable from any form and always asks its question, but that
choice decides whether it can land a quasiparticle-mismatch hit like an
ordinary attack. If you later transmute into a form that can't host the
quasiparticle you picked, the move falls back to Phonon Beam (the one class
every form hosts) until you retune it.

## Bohr

Teaches three more passive abilities, the same "learn several, equip one"
shape as Laughlin's.

<!-- GENERATED:BOHR_PASSIVES_TABLE START -->
#### Bohr's passives

| Passive | Effect | Cost |
| --- | --- | --- |
| Correlated Response | An opponent's crit against you guarantees your own next move crits. | 40 |
| Nonlocal Correlation | Boosts your Correlation by a share of the opponent's Quantumness. | 45 |
| Shared State | A share of damage you deal returns to you as healing. | 50 |
<!-- GENERATED:BOHR_PASSIVES_TABLE END -->

## Kondo

Sells three moves that each weaken the target for a few turns instead of
hitting hard -- drop its damage output, slow it down, or crack its defenses.
You pick which effect by picking the move, and only one can be tuned in at a
time; switching means talking to Kondo again.

## Anderson

Lets you "dope in" a crystal you've encountered as an impurity and learn one
specific move from it -- borrowing a single excitation channel without
becoming that crystal the way Dresselhaus does. Whether the move ever fires
in battle still depends on whether your *current* form can host it. Only
original, standalone crystals are valid hosts, never a
[hybrid or doped compound](hybrids.md).
