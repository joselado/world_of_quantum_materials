# Quasiparticles & moves

Every move in the game is named after a real quasiparticle or excitation --
never an abstract "attack type." A crystal can only ever learn the moves its
own physics actually supports: a plain band insulator has no magnetic order,
so it never gets a magnon move, and so on. Move power climbs with how
unconventional the underlying physics is, from an ordinary lattice vibration
up to a topological or non-Abelian excitation.

*The tables below are generated from `game/src/data/materials.ts` -- run
`npm run docs` in `game/` after changing move/type data, don't hand-edit the
`<!-- GENERATED -->` blocks.*

## Ordinary moves

<!-- GENERATED:MOVES_TABLE START -->
| Move | Quasiparticle class | Power | Crystal types that can use it |
| --- | --- | --- | --- |
| Phonon Beam | `phonon` | 6 | metal, insulator, semiconductor, classicalMagnet, quantumSpinLiquid, kondoHeavyFermion, superconductor, chernSuperconductor, chernInsulator, quantumSpinHall, fractionalChern, ferroelectric, multiferroic, adaptive |
| Electron Pulse | `electron` | 7 | metal, semiconductor, kondoHeavyFermion, superconductor, chernSuperconductor, chernInsulator, quantumSpinHall, fractionalChern, adaptive |
| Magnon Pulse | `magnon` | 8 | classicalMagnet, multiferroic, adaptive |
| Plasmon Pulse | `plasmon` | 8 | metal, adaptive |
| Ferron Pulse | `ferron` | 8 | ferroelectric, multiferroic |
| Polaron Drag | `polaron` | 9 | insulator, adaptive |
| Triplon Surge | `triplon` | 9 | quantumSpinLiquid, adaptive |
| Electromagnon Pulse | `electromagnon` | 9 | multiferroic |
| Spinon Swap | `spinon` | 10 | quantumSpinLiquid, kondoHeavyFermion, adaptive |
| Chiral Current | `chiral` | 10 | chernSuperconductor, chernInsulator, adaptive |
| Helical Current | `helical` | 10 | quantumSpinHall, adaptive |
| Higgs Oscillation | `higgs` | 10 | superconductor, chernSuperconductor, adaptive |
| Heavy Fermion Pulse | `heavyFermion` | 10 | kondoHeavyFermion, adaptive |
| Vison Loop | `vison` | 10 | quantumSpinLiquid, adaptive |
| Anyon Braid | `chargedAnyon` | 11 | fractionalChern, adaptive |
| Majorana Split | `majorana` | 11 | chernSuperconductor, adaptive |
<!-- GENERATED:MOVES_TABLE END -->

## Which crystal types can host which quasiparticles

This is the game's one type-interaction rule: if a defender's own type can't
host the attacking move's quasiparticle class at all, the hit lands at
**double damage**. No separate strong/weak chart stacked on top of it.

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
| `adaptive` | `electron`, `magnon`, `phonon`, `plasmon`, `polaron`, `spinon`, `triplon`, `chiral`, `helical`, `higgs`, `chargedAnyon`, `majorana`, `heavyFermion`, `vison` |
<!-- GENERATED:COMPATIBILITY_TABLE END -->

## Laughlin's Analytic moves

Laughlin (World 4) sells a beam move and an eruption move, not listed in the
table above since they're quiz-gated separately: using either one asks a
physics-equation question first, and answering right doubles the hit while
answering wrong halves it. Laughlin's shop also lets you tune each move to any
quasiparticle class your current form can host, the same choice an ordinary
move's fixed class already makes for you -- each move's name always reads
"<quasiparticle> Beam"/"<quasiparticle> Eruption," defaulting to Phonon
Beam/Phonon Eruption until tuned, so they're always usable. See
[Guardians](guardians.md#laughlin) for how the shop and the tuning picker work.

## Skłodowska-Curie's Ultimate moves

Skłodowska-Curie (World 10) sells a meteor move and a nova move, also not
listed in the table above -- each far more powerful than any ordinary move
(power 100, ten times an Analytic move's), and gated much more steeply:
landing one takes three physics questions answered correctly in a row, drawn
from a broad pool spanning the whole course rather than one world's own
topic. Missing even one question makes the move whiff for zero damage,
though the turn is still spent. Like Laughlin's Analytic moves, each one can
be tuned to any quasiparticle class your current form can host and always
reads "<quasiparticle> Meteor"/"<quasiparticle> Nova" -- but tuning isn't a
flat purchase here: each quasiparticle class costs 1000 qumatessence to unlock
per move, the first time it's picked, after which retuning back to it is
free forever. See [Guardians](guardians.md#skłodowska-curie) for how the
shop and the per-class unlock pricing work.

## Kondo's self-buffs

Sits outside the ordinary quasiparticle roster and the table above entirely --
Kondo's three moves are self-buffs, not attacks: they deal no damage and never
trigger the quasiparticle-mismatch rule, so there's no compatibility list to
check. Casting one buffs the caster's own side for 3 turns instead of hitting
the opponent (reduce incoming damage, a chance to dodge a hit outright, or
heal over time); only one of the three is ever active at a time. See
[Guardians](guardians.md#kondo) for details.

See [Crystals](crystals.md) for which crystal types appear in which world.
