# Crystals

Every wild encounter is named after a real compound (or a credibly engineered
one, for World 10's heterostructures) rather than a generic monster --
each one's main type fixes its look and which quasiparticles it can host (see
[Quasiparticles & moves](quasiparticles.md)). One world per course topic; a
few compounds reappear across worlds when the same real material is relevant
to more than one topic.

*The tables below are generated from `game/src/data/materials.ts` -- run
`npm run docs` in `game/` after changing `WORLD_CRYSTALS`/`WORLD_RIVALS`,
don't hand-edit the `<!-- GENERATED -->` blocks.*

<!-- GENERATED:WORLDS START -->
### World 1 -- Second quantization, mean-field, symmetry breaking

| Crystal | Type | Max HP |
| --- | --- | --- |
| Graphene | `trivial` | 22 |
| Manganese Oxide | `magnet` | 26 |
| Nickel Oxide | `magnet` | 25 |

### World 2 -- Symmetries, tight-binding band structure

| Crystal | Type | Max HP |
| --- | --- | --- |
| Graphene | `trivial` | 22 |
| Gallium Nitride | `trivial` | 23 |
| Magnesium Oxide | `trivial` | 21 |
| Indium Arsenide | `trivial` | 24 |
| Monolayer MoTe₂ (2H) | `trivial` | 22 |

### World 3 -- Topological band theory

| Crystal | Type | Max HP |
| --- | --- | --- |
| Cr-doped (Bi,Sb)₂Te₃ | `topological` | 24 |
| Tantalum Arsenide | `topological` | 26 |
| Monolayer WTe₂ | `topological` | 23 |

### World 4 -- Magnetic field, quantum Hall effect, Landau levels

| Crystal | Type | Max HP |
| --- | --- | --- |
| Gallium Arsenide | `qhe` | 25 |
| Graphene (strong field) | `qhe` | 24 |
| Twisted Bilayer MoTe₂ | `qhe` | 26 |

### World 5 -- Superconductivity, Nambu representation, Majoranas

| Crystal | Type | Max HP |
| --- | --- | --- |
| Aluminum | `supercon` | 28 |
| Lead | `supercon` | 30 |
| YBCO | `supercon` | 27 |
| Fe/Pb Majorana Chain | `supercon` | 29 |
| Niobium | `supercon` | 29 |
| Tantalum Disulfide (1H) | `supercon` | 26 |

### World 6 -- Classical magnetism and magnons

| Crystal | Type | Max HP |
| --- | --- | --- |
| Iron | `classicalmag` | 27 |
| Cobalt | `classicalmag` | 27 |
| Chromium Triiodide | `classicalmag` | 25 |
| Chromium Tribromide | `classicalmag` | 25 |

### World 7 -- Quantum entanglement and tensor networks

| Crystal | Type | Max HP |
| --- | --- | --- |
| Herbertsmithite | `spinliquid` | 23 |
| Strontium Copper Borate | `spinliquid` | 24 |
| Thallium Copper Chloride | `spinliquid` | 22 |

### World 8 -- Quantum magnetism, spinons, Kondo physics

| Crystal | Type | Max HP |
| --- | --- | --- |
| α-Ruthenium Trichloride | `spinliquid` | 24 |
| Herbertsmithite | `spinliquid` | 23 |
| YbMgGaO₄ | `spinliquid` | 22 |
| Tantalum Disulfide (1T) | `spinliquid` | 24 |

### World 9 -- Excitations and defects

| Crystal | Type | Max HP |
| --- | --- | --- |
| Fe(Te,Se) | `supercon` | 22 |
| Niobium Diselenide | `supercon` | 21 |

### World 10 -- Machine learning for quantum materials

| Crystal | Type | Max HP |
| --- | --- | --- |
| Twisted Bilayer Graphene | `supercon` | 32 |
| InAs/Al Majorana Wire | `supercon` | 31 |
| CrI₃/NbSe₂ Topological-SC Heterostructure | `topological` | 33 |
| NbSe₂/CrBr₃ Topological-SC Heterostructure | `topological` | 33 |
| Twisted CrI₃ | `multiferroic` | 32 |
| 1T/1H-TaS₂ Heterostructure | `spinliquid` | 30 |
| MnBi₂Te₄ | `chernInsulator` | 30 |
| Monolayer NiI₂ | `multiferroic` | 28 |
<!-- GENERATED:WORLDS END -->

## World rivals

Each world's rival is the one encounter that actually gates progress --
beating it is what opens the way to the next world. World 10's rival, The
Adapted, is the one entity in the game with no real compound behind it: a
"model of you," able to host every quasiparticle class, drawing from
whatever moves you've collected by then. World 9's rival, Rival Impurity
Resonance, has no fixed type either -- an impurity/defect-bound resonance
can form in any host crystal, so its type is rolled at random the first time
you reach World 9 and stays fixed for the rest of that playthrough, which is
why it's absent from the generated table below.

<!-- GENERATED:RIVALS_TABLE START -->
| World | Rival | Type | Max HP |
| --- | --- | --- | --- |
| 1 | Rival Silicon | `trivial` | 34 |
| 2 | Rival Bloch Wave | `trivial` | 38 |
| 3 | Rival Edge State | `topological` | 42 |
| 4 | Rival Landau Level | `qhe` | 46 |
| 5 | Rival Cooper Pair | `supercon` | 50 |
| 6 | Rival Domain Wall | `classicalmag` | 54 |
| 7 | Rival Entangled Pair | `spinliquid` | 58 |
| 8 | Rival Spinon | `spinliquid` | 62 |
| 10 | The Adapted | `adaptive` | 80 |
<!-- GENERATED:RIVALS_TABLE END -->

See [Hybrids](hybrids.md) for the fused/doped materials that sit alongside
these, and [Guardians](guardians.md) for how Dresselhaus, Majorana, and
Anderson each let you borrow another crystal's physics.
