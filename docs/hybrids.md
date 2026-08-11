# Hybrid materials

Some crystals in the game aren't a single, un-mixed compound. Two different
things fall under this "hybrid" umbrella, and the game treats them the same
way everywhere it matters (Dresselhaus's transmute list and Anderson's
impurity-host list both exclude all of them, since both mechanics are about
one real, standalone crystal's own physics):

- **Fusion results** -- Majorana (World 5) lets you fuse two crystals you've
  already defeated into a new state, if the pairing is one of the named
  recipes below. Every result is a real `WORLD_CRYSTALS` entry (mostly found
  wild in World 10), so a hybrid you fuse and the same hybrid encountered
  wild are the exact same crystal.
- **Standalone doped/alloyed compounds** -- a handful of real compounds are
  themselves inherently a mixture of two named ingredients (a magnetic
  dopant in a host insulator, an alloy of two chalcogens) even though no
  fusion recipe produces them. They're wild encounters like any other
  crystal, just not a valid Dresselhaus/Anderson target.

*The tables below are generated from `game/src/data/materials.ts` -- run
`npm run docs` in `game/` after changing `HYBRID_RECIPES`/
`COMPOSITE_MATERIAL_NAMES`, don't hand-edit the `<!-- GENERATED -->` blocks.*

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
| Iron | Lead | Fe/Pb Majorana Chain |
| Chromium Triiodide | Chromium Triiodide | Twisted CrI₃ |
| Monolayer MoTe₂ (2H) | Monolayer MoTe₂ (2H) | Twisted Bilayer MoTe₂ |
| Niobium Diselenide | Chromium Tribromide | NbSe₂/CrBr₃ Topological-SC Heterostructure |
| Tantalum Disulfide (1T) | Tantalum Disulfide (1H) | 1T/1H-TaS₂ Heterostructure |
<!-- GENERATED:RECIPES_TABLE END -->

## Standalone doped/alloyed compounds

<!-- GENERATED:COMPOSITE_TABLE START -->
| Compound |
| --- |
| Cr-doped (Bi,Sb)₂Te₃ |
| Fe(Te,Se) |
| NV-Diamond |
<!-- GENERATED:COMPOSITE_TABLE END -->

See [Guardians](guardians.md#majorana) for how the fuse mechanic itself
works, and [Crystals](crystals.md) for the full per-world material list.
