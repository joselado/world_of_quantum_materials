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
| Phonon Beam | `phonon` | 6 | trivial, magnet, topological, qhe, supercon, classicalmag, spinliquid, adaptive, multiferroic, chernInsulator |
| Electron Pulse | `trivial` | 7 | trivial, topological, qhe, supercon, adaptive, chernInsulator |
| Magnon Pulse | `magnetic` | 8 | magnet, classicalmag, adaptive, multiferroic |
| Polaron Drag | `localization` | 9 | supercon, spinliquid, adaptive |
| Electromagnon Pulse | `magnetoelectric` | 9 | multiferroic |
| Spinon Swap | `entanglement` | 10 | spinliquid, adaptive |
| Anyon Braid | `gauge` | 11 | topological, qhe, adaptive, chernInsulator |
| Majorana Split | `decoherence` | 11 | topological, supercon, adaptive |
<!-- GENERATED:MOVES_TABLE END -->

## Which crystal types can host which quasiparticles

This is the game's one type-interaction rule: if a defender's own type can't
host the attacking move's quasiparticle class at all, the hit lands at
**double damage**. No separate strong/weak chart stacked on top of it.

<!-- GENERATED:COMPATIBILITY_TABLE START -->
| Crystal type | Quasiparticle classes it can host |
| --- | --- |
| `trivial` | `trivial`, `phonon`, `screening` |
| `magnet` | `magnetic`, `phonon`, `screening` |
| `topological` | `gauge`, `trivial`, `phonon`, `decoherence`, `screening` |
| `qhe` | `gauge`, `trivial`, `phonon`, `screening` |
| `supercon` | `localization`, `decoherence`, `phonon`, `trivial`, `screening` |
| `classicalmag` | `magnetic`, `phonon`, `screening` |
| `spinliquid` | `entanglement`, `phonon`, `localization`, `screening` |
| `adaptive` | `trivial`, `magnetic`, `phonon`, `localization`, `gauge`, `entanglement`, `decoherence`, `screening` |
| `multiferroic` | `magnetoelectric`, `magnetic`, `phonon`, `screening` |
| `chernInsulator` | `gauge`, `trivial`, `phonon`, `screening` |
<!-- GENERATED:COMPATIBILITY_TABLE END -->

## Curie's quiz-gated moves

Skyfall Beam and Ground Eruption (Curie, World 6, in the table above at
`phonon`) work like any ordinary move, plus one extra step: using either one
asks a physics-equation question first, and answering right doubles the hit
while answering wrong halves it. Curie's shop also lets you tune each move
to any quasiparticle class your current form can host, the same choice an
ordinary move's fixed class already makes for you -- until tuned, both
default to `phonon`, so they're always usable. See
[Guardians](guardians.md#curie) for how the shop and the tuning picker work.

## Screening

Sits outside the ordinary quasiparticle roster and the table above --
`screening` is on every crystal type's compatibility list, so it's never
mismatched. Kondo (World 8) sells three screening moves, each inflicting a
status effect (weaken the target's own damage, slow it down, or crack its
defenses) rather than hitting hard; only one is ever active at a time. See
[Guardians](guardians.md#kondo) for details.

See [Crystals](crystals.md) for which crystal types appear in which world.
