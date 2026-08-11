# Hybrid materials

Some crystals in the game aren't a single, un-mixed compound -- Majorana
(World 5) lets you fuse two crystals you've already defeated into a new
state, if the pairing is one of the named recipes below. Every result is a
real `WORLD_CRYSTALS` entry (mostly found wild in World 10), so a hybrid you
fuse and the same hybrid encountered wild are the exact same crystal.
Dresselhaus's transmute list and Anderson's impurity-host list both exclude
every hybrid, since both mechanics are about one real, standalone crystal's
own physics.

*The table below is generated from `game/src/data/materials.ts` -- run `npm
run docs` in `game/` after changing `HYBRID_RECIPES`, don't hand-edit the
`<!-- GENERATED -->` block.*

## Fusion recipes (Majorana)

Not every possible pairing is covered -- this is a curated, physically
grounded catalog keyed by parent name, not a generic "these two types always
fuse into that type" rule. A pairing with no entry below simply can't be
fused, same-type pairs included.

<!-- GENERATED:RECIPES_TABLE START -->
| Parent A | Parent B | Result |
| --- | --- | --- |
| Aluminum | Indium Arsenide | InAs/Al Majorana Wire |
| Graphene | Graphene | Twisted Bilayer Graphene |
| Chromium Triiodide | Niobium Diselenide | CrI₃/NbSe₂ Topological-SC Heterostructure |
| Chromium | Bi₂Te₃ | Cr-doped (Bi,Sb)₂Te₃ |
| Iron | Lead | Fe/Pb Majorana Chain |
| Chromium Triiodide | Chromium Triiodide | Twisted CrI₃ |
| Monolayer MoTe₂ (2H) | Monolayer MoTe₂ (2H) | Twisted Bilayer MoTe₂ |
| Niobium Diselenide | Chromium Tribromide | NbSe₂/CrBr₃ Topological-SC Heterostructure |
| Tantalum Disulfide (1T) | Tantalum Disulfide (1H) | 1T/1H-TaS₂ Heterostructure |
| Manganese | Niobium | Mn/Nb Shiba Chain |
| HgTe | CdTe | HgTe/CdTe Quantum Well |
<!-- GENERATED:RECIPES_TABLE END -->

See [Guardians](guardians.md#majorana) for how the fuse mechanic itself
works, and [Crystals](crystals.md) for the full per-world material list.
