# Quasiparticles & moves

Every move is named after a real quasiparticle or excitation, never a
generic "attack type." A crystal can only ever learn moves its own physics
actually supports — a plain band insulator has no magnetic order, so it
never gets a magnon move. Move power climbs with how exotic the underlying
physics is: an ordinary lattice vibration sits at the bottom, a topological
or non-Abelian excitation at the top.

## Ordinary moves

<!-- GENERATED:MOVES_TABLE START -->
| Move | Quasiparticle class | Power | Crystal types that can use it |
| --- | --- | --- | --- |
| Phonon Beam | `phonon` | 6 | metal, insulator, semiconductor, classicalMagnet, quantumSpinLiquid, kondoHeavyFermion, superconductor, chernSuperconductor, chernInsulator, quantumSpinHall, fractionalChern, ferroelectric, multiferroic |
| Electron Pulse | `electron` | 7 | metal, semiconductor, kondoHeavyFermion, superconductor, chernSuperconductor, chernInsulator, quantumSpinHall, fractionalChern |
| Magnon Pulse | `magnon` | 8 | classicalMagnet, multiferroic |
| Plasmon Pulse | `plasmon` | 8 | metal |
| Ferron Pulse | `ferron` | 8 | ferroelectric, multiferroic |
| Polaron Drag | `polaron` | 9 | insulator |
| Triplon Surge | `triplon` | 9 | quantumSpinLiquid |
| Electromagnon Pulse | `electromagnon` | 9 | multiferroic |
| Spinon Swap | `spinon` | 10 | quantumSpinLiquid, kondoHeavyFermion |
| Chiral Current | `chiral` | 10 | chernSuperconductor, chernInsulator |
| Helical Current | `helical` | 10 | quantumSpinHall |
| Higgs Oscillation | `higgs` | 10 | superconductor, chernSuperconductor |
| Heavy Fermion Pulse | `heavyFermion` | 10 | kondoHeavyFermion |
| Vison Loop | `vison` | 10 | quantumSpinLiquid |
| Anyon Braid | `chargedAnyon` | 11 | fractionalChern |
| Majorana Split | `majorana` | 11 | chernSuperconductor |
<!-- GENERATED:MOVES_TABLE END -->

## Which crystal types can host which quasiparticles

This is the game's only type-interaction rule: if the defender's own type
can't host the attacking move's quasiparticle class at all, the hit lands at
**double damage**. That's it — no separate strong/weak chart stacked on top
of it.

<!-- GENERATED:COMPATIBILITY_TABLE START -->
| Crystal type | Quasiparticle classes it can host |
| --- | --- |
| `metal` | `electron`, `phonon`, `plasmon` |
| `insulator` | `phonon`, `polaron` |
| `semiconductor` | `electron`, `phonon` |
| `classicalMagnet` | `magnon`, `phonon` |
| `quantumSpinLiquid` | `spinon`, `phonon`, `vison`, `triplon` |
| `kondoHeavyFermion` | `electron`, `phonon`, `heavyFermion`, `spinon` |
| `superconductor` | `electron`, `phonon`, `higgs` |
| `chernSuperconductor` | `electron`, `phonon`, `higgs`, `chiral`, `majorana` |
| `chernInsulator` | `electron`, `phonon`, `chiral` |
| `quantumSpinHall` | `electron`, `phonon`, `helical` |
| `fractionalChern` | `electron`, `phonon`, `chargedAnyon` |
| `ferroelectric` | `phonon`, `ferron` |
| `multiferroic` | `magnon`, `phonon`, `electromagnon`, `ferron` |
<!-- GENERATED:COMPATIBILITY_TABLE END -->

## Laughlin's Analytic moves

Laughlin (World 4) sells two moves that aren't in the table above, since
they're quiz-gated separately: a beam and an eruption. Using either one asks
a physics-equation question first — answer right and it hits for double
damage, answer wrong and it's halved.

Laughlin's shop also lets you tune each move to any quasiparticle class your
*current* form can host, the same choice an ordinary move's fixed class
already makes for you. Each move's name always reads "<quasiparticle>
Beam"/"<quasiparticle> Eruption," defaulting to Phonon Beam/Phonon Eruption
until tuned, so they're always usable. See
[Guardians](guardians.md#laughlins-analytics) for how the shop and tuning
picker work.

## Skłodowska-Curie's Ultimate moves

Skłodowska-Curie (World 10) sells two more moves outside the table above: a
meteor and a nova. Each is far more powerful than any ordinary move — power
100, ten times an Analytic move's — and gated to match: landing one takes
three physics questions in a row, all correct, drawn from a broad pool
spanning the whole course rather than one world's topic. Miss even one
question and the move whiffs for zero damage, though the turn is still
spent.

Like Laughlin's Analytic moves, each one can be tuned to any quasiparticle
class your *current* form can host, and always reads "<quasiparticle>
Meteor"/"<quasiparticle> Nova." Tuning isn't a flat purchase here, though:
each quasiparticle class costs 1000 qumatessence to unlock per move, the
first time you pick it — after that, retuning back to it is free forever.
See [Guardians](guardians.md#skłodowska-curies-experiments) for how the shop
and per-class pricing work.

## Kondo's self-buffs

Kondo's three moves sit outside the roster above entirely: they're
self-buffs, not attacks. They deal no damage and never trigger the
quasiparticle-mismatch rule, so there's no compatibility list to check.
Casting one buffs you for 3 turns instead of hitting the opponent — reduced
incoming damage, a chance to dodge outright, or healing over time — and only
one can be active at a time. See [Guardians](guardians.md#kondos-clouds) for
details.

See [Crystals](crystals.md) for which crystal types appear in which world.
