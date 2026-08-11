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
| Phonon Beam | `thermal` | 6 | trivial, magnet, topological, qhe, supercon, classicalmag, tensornet, spinliquid, defect, adaptive, multiferroic, chernInsulator |
| Electron Pulse | `trivial` | 7 | trivial, topological, qhe, supercon, adaptive, chernInsulator |
| Magnon Pulse | `magnetic` | 8 | magnet, classicalmag, adaptive, multiferroic |
| Polaron Drag | `localization` | 9 | supercon, tensornet, spinliquid, defect, adaptive |
| Electromagnon Pulse | `magnetoelectric` | 9 | multiferroic |
| Spinon Swap | `entanglement` | 10 | tensornet, spinliquid, adaptive |
| Anyon Braid | `gauge` | 11 | topological, qhe, adaptive, chernInsulator |
| Majorana Split | `decoherence` | 11 | topological, supercon, defect, adaptive |
<!-- GENERATED:MOVES_TABLE END -->

## Which crystal types can host which quasiparticles

This is the game's one type-interaction rule: if a defender's own type can't
host the attacking move's quasiparticle class at all, the hit lands at
**double damage**. No separate strong/weak chart stacked on top of it.

<!-- GENERATED:COMPATIBILITY_TABLE START -->
| Crystal type | Quasiparticle classes it can host |
| --- | --- |
| `trivial` | `trivial`, `thermal`, `analytic`, `screening` |
| `magnet` | `magnetic`, `thermal`, `analytic`, `screening` |
| `topological` | `gauge`, `trivial`, `thermal`, `decoherence`, `analytic`, `screening` |
| `qhe` | `gauge`, `trivial`, `thermal`, `analytic`, `screening` |
| `supercon` | `localization`, `decoherence`, `thermal`, `trivial`, `analytic`, `screening` |
| `classicalmag` | `magnetic`, `thermal`, `analytic`, `screening` |
| `tensornet` | `entanglement`, `thermal`, `localization`, `analytic`, `screening` |
| `spinliquid` | `entanglement`, `thermal`, `localization`, `analytic`, `screening` |
| `defect` | `localization`, `decoherence`, `thermal`, `analytic`, `screening` |
| `adaptive` | `trivial`, `magnetic`, `thermal`, `localization`, `gauge`, `entanglement`, `decoherence`, `analytic`, `screening` |
| `multiferroic` | `magnetoelectric`, `magnetic`, `thermal`, `analytic`, `screening` |
| `chernInsulator` | `gauge`, `trivial`, `thermal`, `analytic`, `screening` |
<!-- GENERATED:COMPATIBILITY_TABLE END -->

## Special classes

Two move classes sit outside the ordinary quasiparticle roster and the table
above -- every crystal type can host both, so neither is ever mismatched:

- **Analytic** (Curie, World 6) -- a physics-equation question gates the hit:
  answer right for double damage, wrong for half. The class the mismatch
  check actually uses for one of these moves is whichever quasiparticle
  Curie's shop tuned it to (see [Guardians](guardians.md#curie)), not
  `analytic` itself.
- **Screening** (Kondo, World 8) -- three moves that each inflict a status
  effect (weaken the target's own damage, slow it down, or crack its
  defenses) rather than hitting hard; only one is ever tuned in at a time.

See [Guardians](guardians.md) for how Curie's and Kondo's shops work, and
[Crystals](crystals.md) for which crystal types appear in which world.
