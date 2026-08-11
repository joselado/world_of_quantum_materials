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
| Graphene | `metal` | 22 |
| Manganese Oxide | `classicalMagnet` | 26 |
| Nickel Oxide | `classicalMagnet` | 25 |
| Chromium | `classicalMagnet` | 24 |

### World 2 -- Symmetries, tight-binding band structure

| Crystal | Type | Max HP |
| --- | --- | --- |
| Graphene | `metal` | 22 |
| Silver | `metal` | 23 |
| Gallium Nitride | `semiconductor` | 23 |
| Magnesium Oxide | `insulator` | 21 |
| Diamond | `insulator` | 24 |
| Monolayer Boron Nitride | `insulator` | 21 |
| Indium Arsenide | `semiconductor` | 24 |
| Monolayer MoTe₂ (2H) | `semiconductor` | 22 |
| HgTe | `semiconductor` | 22 |
| CdTe | `semiconductor` | 22 |

### World 3 -- Topological band theory

| Crystal | Type | Max HP |
| --- | --- | --- |
| Bi₂Te₃ | `quantumSpinHall` | 24 |
| Monolayer WTe₂ | `quantumSpinHall` | 23 |

### World 4 -- Magnetic field, quantum Hall effect, Landau levels

| Crystal | Type | Max HP |
| --- | --- | --- |
| Gallium Arsenide | `chernInsulator` | 25 |
| Graphene (strong field) | `chernInsulator` | 24 |
| MnBi₂Te₄ | `chernInsulator` | 30 |

### World 5 -- Superconductivity, Nambu representation, Majoranas

| Crystal | Type | Max HP |
| --- | --- | --- |
| Aluminum | `superconductor` | 28 |
| Lead | `superconductor` | 30 |
| YBCO | `superconductor` | 27 |
| Lanthanum Decahydride | `superconductor` | 28 |
| Niobium | `superconductor` | 29 |
| Tantalum Disulfide (1H) | `superconductor` | 26 |
| Uranium Ditelluride | `chernSuperconductor` | 29 |

### World 6 -- Classical magnetism and magnons

| Crystal | Type | Max HP |
| --- | --- | --- |
| Iron | `classicalMagnet` | 27 |
| Cobalt | `classicalMagnet` | 27 |
| Chromium Triiodide | `classicalMagnet` | 25 |
| Chromium Tribromide | `classicalMagnet` | 25 |
| Yttrium Iron Garnet | `classicalMagnet` | 26 |
| Monolayer NiI₂ | `multiferroic` | 28 |
| Bismuth Ferrite | `multiferroic` | 27 |

### World 7 -- Quantum entanglement and tensor networks

| Crystal | Type | Max HP |
| --- | --- | --- |
| Herbertsmithite | `quantumSpinLiquid` | 23 |
| Strontium Copper Borate | `quantumSpinLiquid` | 24 |
| Thallium Copper Chloride | `quantumSpinLiquid` | 22 |
| Y₂BaNiO₅ | `quantumSpinLiquid` | 23 |

### World 8 -- Quantum magnetism, spinons, Kondo physics

| Crystal | Type | Max HP |
| --- | --- | --- |
| α-Ruthenium Trichloride | `quantumSpinLiquid` | 24 |
| Herbertsmithite | `quantumSpinLiquid` | 23 |
| YbMgGaO₄ | `quantumSpinLiquid` | 22 |
| Tantalum Disulfide (1T) | `quantumSpinLiquid` | 24 |
| Cerium Zirconate Pyrochlore | `quantumSpinLiquid` | 22 |
| YbRh₂Si₂ | `kondoHeavyFermion` | 22 |
| Cerium Cobalt Indide | `kondoHeavyFermion` | 23 |

### World 9 -- Excitations and defects

| Crystal | Type | Max HP |
| --- | --- | --- |
| Fe(Te,Se) | `chernSuperconductor` | 22 |
| Niobium Diselenide | `superconductor` | 21 |
| Manganese | `classicalMagnet` | 23 |
| Barium Titanate | `ferroelectric` | 27 |
| GeTe | `ferroelectric` | 26 |
| Hafnium Oxide | `ferroelectric` | 25 |

### World 10 -- Machine learning for quantum materials

| Crystal | Type | Max HP |
| --- | --- | --- |
| Twisted Bilayer Graphene | `superconductor` | 32 |
| InAs/Al Majorana Wire | `chernSuperconductor` | 31 |
| CrI₃/NbSe₂ Topological-SC Heterostructure | `chernSuperconductor` | 33 |
| NbSe₂/CrBr₃ Topological-SC Heterostructure | `chernSuperconductor` | 33 |
| Twisted CrI₃ | `multiferroic` | 32 |
| 1T/1H-TaS₂ Heterostructure | `quantumSpinLiquid` | 30 |
| Cr-doped (Bi,Sb)₂Te₃ | `chernInsulator` | 29 |
| HgTe/CdTe Quantum Well | `quantumSpinHall` | 25 |
| Twisted Bilayer MoTe₂ | `fractionalChern` | 26 |
| Rhombohedral Pentalayer Graphene/hBN Moiré | `fractionalChern` | 27 |
| Fe/Pb Majorana Chain | `chernSuperconductor` | 29 |
<!-- GENERATED:WORLDS END -->

## World rivals

Each world's rival is the one encounter that actually gates progress --
beating it is what opens the way to the next world. World 10's rival, The
Adapted, is the one entity in the game with no real compound behind it: a
"model of you," able to host every quasiparticle class, drawing from
whatever moves you've collected by then. World 9's rival, Rival Impurity
Resonance, has no fixed type either -- an impurity/defect-bound resonance
can form in any host crystal, so its type is rolled at random every time you
reach World 9 and stays fixed only for that visit, which is why it's absent
from the generated table below.

<!-- GENERATED:RIVALS_TABLE START -->
| World | Rival | Type | Max HP |
| --- | --- | --- | --- |
| 1 | Rival Silicon | `semiconductor` | 34 |
| 2 | Rival Bloch Wave | `metal` | 38 |
| 3 | Rival Edge State | `quantumSpinHall` | 42 |
| 4 | Rival Landau Level | `chernInsulator` | 46 |
| 5 | Rival Cooper Pair | `superconductor` | 50 |
| 6 | Rival Domain Wall | `classicalMagnet` | 54 |
| 7 | Rival Entangled Pair | `quantumSpinLiquid` | 58 |
| 8 | Rival Spinon | `quantumSpinLiquid` | 62 |
| 10 | The Adapted | `adaptive` | 80 |
<!-- GENERATED:RIVALS_TABLE END -->

See [Hybrids](hybrids.md) for the fused/doped materials that sit alongside
these, and [Guardians](guardians.md) for how Dresselhaus, Majorana, and
Anderson each let you borrow another crystal's physics.
