import type { StoryLength } from './settings';

// Per-world narrative content: a 2-page history/lore screen shown once per
// save the first time the player enters that world, and the 2-part taunt
// that world's rival delivers in OverworldScene.showRivalEncounter before
// the fight. Both are Decoherence-arc content -- unlike data/story.ts's
// one-line beats (shown after a rival is beaten, connective tissue between
// worlds), this is keyed by the world being entered/its own rival, and
// explains how the Decoherence specifically manifests in that world's own
// physics rather than gesturing at it generically. Kept as plain data, same
// "one small file per content kind" convention as story.ts/tutorial.ts, so
// the copy can be edited without touching panel/paging/trigger code.
export interface WorldLore {
  page1: string;
  page2: string;
}

export interface RivalTaunt {
  part1: string;
  part2: string;
}

export const WORLD_LORE: Partial<Record<number, WorldLore>> = {
  1: {
    page1:
      'Long ago, before the corridors had numbers, there were only the Mean Fields. They were wide and symmetric, and every spin could point up or down, both equally likely. Then one small fluctuation, no bigger than a grain of dust, broke the symmetry. The corridor split into two branches of equal energy, one on each side of a hedge.\n\nBut a broken symmetry stays broken only in a world too large to look back. Something small walks the Mean Fields now, and the two branches are slowly mixing back into one.',
    page2:
      'Every broken symmetry leaves a ripple in its new order. The old texts call these ripples quasiparticles. The first one was born in this field, and every quasiparticle since carries a trace of it.\n\nThe Decoherence does not erase the ripple. It stops it before it can take a shape, and only noise is left. Far down this corridor, where the branches meet again, something old is waiting. It was the firmest choice these fields ever made, and it fell only when every answer was drawn out of it. It is still answering.',
  },
  2: {
    page1:
      'News of the Mean Fields reaches this hall only as a legend. The hall never needed to choose. Walk through one bay, the space between two columns, and you have walked through them all: same shape, same spacing, without end. This symmetry is translation, not spin.\n\nThe repetition is a law, not decoration. A state that obeys it does not live in any one bay. It spreads across the whole colonnade at once, and it never stands still. The lattice calls this a Bloch state.',
    page2:
      'The floor here pairs two tiles into one repeating cell. A state that lives on both tiles can vanish at certain points, and the shape of the repetition alone tells you where.\n\nThe Decoherence attacks the repetition, not the stone. One column moves a little out of step, and the wide state that filled the whole colonnade falls back into a single bay, trapped. Further along waits the widest state this hall ever carried. It held the repetition longest, until all it knew was pulled out of it.',
  },
  3: {
    page1:
      'The colonnade ends without warning, and the ground ahead breaks open. What lies there is a floor of flat, sunken domains. Each one is a single phase, and neighbors rarely agree. Their interiors are dead.\n\nWhat you can walk is the seam. Where two domains meet, the number that tells them apart must change, and it is an integer. Integers cannot slide. So the gap closes exactly at the border, and a channel opens along it. The domains cannot be reached. The lit ledge between them is a road.',
    page2:
      'Walk this road one way and your spin points one way. Walk it back and it must point the other. Direction and spin are locked, so nothing on this road can turn around. Damage the seam, and the channel goes around the damage.\n\nThe Decoherence puts magnetic flaws in the domains. A magnetic flaw is the one thing that can flip a spin. The seam still glows, but it is no longer protected. On the far ledges stands something that turned the flaws aside longer than anything else. It stands very still.',
  },
  4: {
    page1:
      'A surveyor came off the last ledge with a map she could not finish. She had followed a road and found it split into two branches. Each branch split again, and each of those split again. She stopped when the fourth split had the same shape as the first.\n\nThe land does this because a field runs through it. Under a field nothing here travels straight: every path curves into an orbit. Huge numbers of orbits share one energy, packed onto a single flat level. Above it is another level, evenly spaced.',
    page2:
      'Every orbit encloses a fixed amount of field, and one orbit differs from the next by exactly one quantum of flux. That is why this land answers in whole numbers, and no damage has ever shifted one.\n\nThe Decoherence cannot argue with an integer, so it attacks the counting. It scrambles the phase a traveler collects around a closed loop, and the loop no longer closes. At the last fork waits something that held its number longer than any orbit here. An integer cannot give way slowly, so it gave way whole.',
  },
  5: {
    page1:
      "The surveyor's last note says only: colder. The land runs out onto open ice. Every carrier on this glacier has paired off. What is left is a single wave, with one phase shared across the whole glacier.\n\nThe wave will not hold a magnetic field inside it. The ice pushes the field out. But a phase must come back to itself around a circle, so at a few points the wave gives way. The flux that gets in is trapped there, glowing at the bottom of a pit, and the ice closes around it.",
    page2:
      'This ice can hold something rare. Take one traveler and split it in two, each half its own opposite. Neither half is anything alone. What they are is stored in the distance between them, and nothing nearby can read it.\n\nThe Decoherence cannot touch the halves, so it shortens the passage. When the halves feel one another they join into one ordinary traveler, and what was hidden is gone. Far out, something holds one phase across a thousand pieces. It was whole until it was asked to carry too much.',
  },
  6: {
    page1:
      'News from the glacier reaches this coast as a swell, a rise that runs down the shore.\n\nThe sea made its choice long ago. Every spin in it points the same way as its neighbor. Tip one spin out of line, and its neighbors lean to follow. The tilt runs down the coast as a wave, and the coast calls it a magnon. Every swell is one. The rock on the beach chose differently: every square points against its neighbors, and it is broken along a wall wherever that pattern slips.',
    page2:
      'A magnon is cheap because the sea does not care which way it points. Turn every spin together, by any angle, and it costs nothing. A very long, gentle swell is almost that turn, so the longest waves cost almost nothing.\n\nThe Decoherence leaves the order alone and pins the direction. Now turning costs something, and the long swells stop. The sea goes still. Past the last swell stands something that once carried every wave of this coast. Its path was ground out of it, grain by grain.',
  },
  7: {
    page1:
      'Someone once tried to write the coast down: every spin, every direction, exactly. They stopped at forty spins. The count doubles with every spin, and forty already need a trillion numbers.\n\nThis world is that record, built and hung in empty space. Lanes run side by side, one for every site. Rungs join them and carry what one lane knows about the next. Almost none of that huge space is ever used. The states nature really chooses sit in a tiny corner of it, and everything real fits on the rungs.',
    page2:
      'A rule about boundaries keeps this world small. Cut a region out and ask how much it shares with the rest. The answer depends on the length of the cut, never on the size of the region. So a thin rung is enough.\n\nThe Decoherence works on the middles. It shares what was never meant to be shared, until the answer grows with the whole region. Then no rung is thick enough. On these lanes sits something every visitor has cut open. The cuts cost it nothing for an age. Now each comes back empty.',
  },
  8: {
    page1:
      'Everyone who camped at the edge of the network saw something different on the water. The lanes end at a shore, and past it is bog: pools of black water under flat mist, reeds, and a narrow path of peat.\n\nEvery world so far obeyed one rule: a disturbance in a magnet is one whole spin. You can move it or spread it out, but you cannot have half of one. Here it parts into two halves that drift apart, each carrying half. The bog calls the halves spinons.',
    page2:
      'The halves can wander because nothing here is settled. The spins pair into couples, but which spin pairs with which was never decided. Every pairing happens at once. The Decoherence picks one. The pairings go rigid, and the halves are pulled back into one flip.\n\nThe lights in the pools are lone spins. The carriers in the water crowd around each one until it is bound in a singlet, and it goes dark. Near the shore some still burn. In the dark further in waits something that comes apart when struck and puts itself back together.',
  },
  9: {
    page1:
      'The water ends, and past the last pool lies open ground. It is made of patches: a piece of wheat field, a few columns, a strip of lit ledge, some swept ice, a square of checkered rock. Among them lie the pieces of a fallen column, the only thing ever built here.\n\nEvery scholar here learned one thing first: a perfect crystal tells you nothing. To know what a ground state really is, take one atom out and watch. What the crystal does around the hole is the crystal telling the truth.',
    page2:
      'Put one impurity into four hosts and you get four different answers. Every answer belongs to the host, not to the defect.\n\nOne hole tells you something. The Decoherence brings thousands, and past a certain density they tell you nothing. Every state comes to rest where it stands, shut in its own pocket. Something out here answered hole after hole, until the holes came faster than any answer could cross it. No two reports agree on what crystal it is, and all say it is still answering.',
  },
  10: {
    page1:
      'Nothing comes out of here. No traveler returns with a rumor. This is the last corridor in these worlds, and whatever is written about it, you write now, by walking in.\n\nEvery world behind you stood on a single law: a symmetry, a repetition, a field, a boundary. This one obeys no law. It was built by watching every law before it, until it could make a phase of matter without understanding one. Ask it for the Mean Fields, and it will hand them back, close enough to fool you.',
    page2:
      'This is what has hunted you since the first branch split. It is no plague but a mind built out of these worlds, sharper with every world you saved. The nine golems were never that mind in disguise. Each was only the physics of its own world, grown strange. The mind only watched.\n\nEvery rival you beat was a lesson for it. The materials you freed went back to their worlds whole, and that cost it nothing. What was learned stays learned. You taught everything that waits at the end of this corridor.\n\nTo learn a quantum thing, something must measure it, and a measurement leaves a record of which state it was in. Nothing on record is still in superposition. The Decoherence is what happens when something comes to know you.\n\nNine times you faced a quantum thing with its order broken, and broken order can be mended. What waits here is the record itself, definite all the way through. Nobody has ever put a record back into superposition. It has stopped watching, and started to answer back.',
  },
};

// World 9's entry has no fixed compound -- its rolled rival (RIVAL_9_TYPES,
// data/materials.ts) can be any of eight types, so its taunt is written to
// hold for any of them rather than naming one. World 10's is the story's
// reveal beat and is deliberately shaped differently from every other
// world's (see its own text): not "I've mastered one phenomenon" but "I've
// learned all of yours."
export const RIVAL_TAUNTS: Partial<Record<number, RivalTaunt>> = {
  1: {
    part1:
      'A golem of fused shards, the color of scraped silicon, stands where the two branches meet again. "Polycrystalline Silicon Golem. A thousand grains, and every one chose long ago. Doubt cannot tunnel through me. It dies at my boundaries."',
    part2:
      '"Look at you, one small quantum material, still caught between two choices. Ask any grain of me which way the fields broke. Each one will answer, and each will swear the others say the same."',
  },
  2: {
    part1:
      'A golem of fused quartz shards rises where the bays narrow, every grain a small lattice with glass between them. "Polycrystalline Silica Golem. I kept the pattern. Every grain of me still repeats. Ask them to agree on where."',
    part2:
      '"Your lattice makes you a promise: be periodic, and you may be everywhere at once. Mine keeps that promise a grain at a time, and glass repeats nothing. So I stay where I am put."',
  },
  3: {
    part1:
      'A golem of fused shards of tarnished silver waits on the seam. Its edges are lit, but nothing moves along the light. "Polycrystalline Bismuth Telluride Golem. I am not standing on the boundary. I am the boundary. No flaw ever turned my currents."',
    part2:
      '"Strike me from behind. You will find there is no behind. Nothing in me reverses. Nothing in me scatters onward. Nothing in me moves at all. That is how complete my protection has become."',
  },
  4: {
    part1:
      'A golem of fused shards rises where the branches divide. Its dark layers are sheets of ordered spins, stacked, and every sheet is interrupted. "Polycrystalline Manganese Bismuth Telluride Golem. You needed a field to make this land quantize. I never did. My own spins do it, from the inside."',
    part2:
      '"The number I carry does not wobble when you hit it. It cannot. It is an integer, and there is no such thing as most of one. Go on. Count me."',
  },
  5: {
    part1:
      'A golem of fused shards of black ceramic pulls itself out of the frost. Its body is a mosaic of grains, with a faint glow at every seam. "Polycrystalline YBCO Golem. Look at my grain boundaries. Every one is a weak link, and every one carries current across a gap."',
    part2:
      '"A thousand junctions, and one phase agreed between them. There is a current I can carry, and not one drop more. I am very cold, and nothing has asked much of me in years."',
  },
  6: {
    part1:
      'A golem of fused shards of grey iron rises off the beach. Bright regions flow across its surface. "Polycrystalline Iron Golem. Domains. Each one agreed on a direction. Push me and I do not crack: the walls between them slide, and I am the same magnet."',
    part2:
      '"Flip whatever you can reach. It will not stay flipped and it will not stay put: it will walk off through me as a wave and fade out somewhere in my back. Nothing you start here finishes."',
  },
  7: {
    part1:
      'A golem of fused shards of green mineral spans every lane: triangles joined at their corners, full of fracture lines. "Polycrystalline Herbertsmithite Golem. What I am was never kept in any one place. You cannot take from a piece what no piece was holding."',
    part2:
      '"Cut me wherever you like and read the cut. Nothing there. Every grain of me reports the same perfect nothing. By every test I have, there was never anything to take."',
  },
  8: {
    part1:
      'A golem of fused shards rises out of the water: brown-black honeycomb layers, a stacking fault through every one. "Polycrystalline Ruthenium Trichloride Golem. Each bond wants its spins along its own axis, and every spin sits on three. Obeying one means defying two."',
    part2:
      '"I have no order to break. Whatever you land on me comes apart, and the halves stop at my first seam. Hurt me twice, then. Halves are all you get, and they do not travel."',
  },
  9: {
    part1:
      'A golem of fused shards rises out of the crust where the scars narrow. A thousand vacancies mark it. Each one glows faintly, and no glow reaches the next. "A thousand holes in me, and I have answered every one, where it was made."',
    part2:
      '"Take an atom out of me anywhere and ask what I do about it. I will tell you, right there. Nothing in me carries the answer away. Every state I have stays where it came to rest. Come and ask."',
  },
  10: {
    part1:
      'There is no golem here, and no name in any dex for what stands at the end of this corridor. It wears your own crystal: your colors, your stance, your quasiparticle. "The Adapted. Nine worlds, and you thought only you were learning."',
    part2:
      '"Every move you have ever landed, I have already survived once. This is not a fight you can win by trying harder. Trying harder is how you built me. Come closer. Teach me the rest."',
  },
};

// The Brief versions of both tables above, what a story screen reads when the
// Settings station's Text Length row is on Brief (data/settings.ts's
// STORY_LENGTH_PRESETS, its own comment for why that is the default). Each
// entry is roughly a third of its Detailed sibling and keeps the same shape,
// two pages and two parts, so the paging code never branches on length. A
// Brief entry is not a looser version of the Detailed one: it carries the same
// load-bearing beats WORLDS.md's "The premise in the game's voice" asks of
// every world (page 1 the physics as history, page 2 the one named mechanism
// the Decoherence attacks, a taunt whose boast is also the property the golem
// lost), and it gives up only the texture around them.
export const WORLD_LORE_BRIEF: Partial<Record<number, WorldLore>> = {
  1: {
    page1:
      'Long ago the Mean Fields were symmetric: every spin could point up or down. Then one fluctuation broke the symmetry. The corridor split into two branches of equal energy, and the fields were first to choose.',
    page2:
      'Every broken symmetry leaves a ripple, a quasiparticle, and the first was born here. Something small now walks these fields and makes them doubt, and the two branches mix back into one.',
  },
  2: {
    page1:
      'This hall never needed to choose. Every bay has the same shape and spacing. A state built on that repetition lives in no single bay but across the whole colonnade: a Bloch state.',
    page2:
      'The Decoherence attacks the repetition, not the stone. One column moves out of step, and the state that filled the colonnade falls back into a single bay. Further along waits the widest state this hall ever carried.',
  },
  3: {
    page1:
      'The colonnade ends in domains, each a single phase. Where two meet, the integer that tells them apart must change, and an integer cannot slide. The gap closes at the border, and the lit ledge there is a road.',
    page2:
      'On this road spin is locked to direction, so nothing turns around. The Decoherence puts magnetic flaws in the domains, the one thing that can flip a spin. The seam still glows, but it is no longer protected.',
  },
  4: {
    page1:
      'A surveyor mapped a road here that split, and split again, the same shape every time. A field runs through this land: every path curves into an orbit, and the orbits pack onto flat, evenly spaced levels.',
    page2:
      'Neighboring orbits differ by exactly one quantum of flux, so this land answers in whole numbers. The Decoherence scrambles the phase collected around a closed loop: orbits stop closing, and the levels smear into a slope.',
  },
  5: {
    page1:
      'Every carrier on this ice has paired off, and what is left is one wave with one phase. It pushes magnetic field out, and the flux it cannot expel is trapped in a few glowing pits.',
    page2:
      'This ice can hold a traveler split in two halves, with what they are stored in the distance between them. The Decoherence shortens the passage until the halves feel each other and join into one ordinary traveler.',
  },
  6: {
    page1:
      'Every spin in this sea points the same way as its neighbor. Tip one, and the tilt runs down the coast as a wave: a magnon. The rock on the beach points against itself, square by square.',
    page2:
      'Turning every spin together costs nothing, so the longest waves are almost free. The Decoherence pins the direction. Now turning costs something, the long waves stop, and the sea goes still.',
  },
  7: {
    page1:
      'Someone once tried to write the coast down, every spin exactly: forty spins already need a trillion numbers. This world is that record, built as lanes with rungs between them. Almost none of its space is used.',
    page2:
      'What a region shares with the rest depends on the length of its boundary, not on its size, so thin rungs are enough. The Decoherence makes it grow with the whole region, and no rung is thick enough.',
  },
  8: {
    page1:
      'The lanes end at a bog of black pools under flat mist. Every world so far obeyed one rule: a disturbance in a magnet is one whole spin. Here it parts into two halves, the spinons.',
    page2:
      'The halves wander because every pairing of spins happens at once. The Decoherence picks one pairing, and the halves are pulled back into one flip. The lights in the pools are lone spins, bound into singlets and going dark.',
  },
  9: {
    page1:
      'Past the last pool lies ground in patches, pieces of every world behind you. A perfect crystal tells you nothing. Take one atom out, and what the crystal does around the hole is the crystal telling the truth.',
    page2:
      'The same impurity in four hosts gives four answers, and each answer belongs to the host. The Decoherence brings thousands of holes, until every state comes to rest shut in its own small pocket.',
  },
  10: {
    page1:
      'No traveler returns from here with a rumor. Every world stood on a single law, and this one obeys none. It was built by watching every law, until it could make a phase of matter without understanding one.',
    page2:
      'What has hunted you is a mind built out of these worlds. The golems were never that mind in disguise: it only watched. Every rival you brought down was a lesson.\n\nTo learn a quantum thing is to measure it, and a measurement leaves a record. Nothing on record is still in superposition. What waits here is the record itself, and it has started to answer back.',
  },
};

export const RIVAL_TAUNTS_BRIEF: Partial<Record<number, RivalTaunt>> = {
  1: {
    part1:
      'A golem of scraped silicon. "Polycrystalline Silicon Golem. Doubt dies at my boundaries."',
    part2:
      '"Ask any grain which way the fields broke. Each swears the others say the same."',
  },
  2: {
    part1:
      'A quartz golem. "Polycrystalline Silica Golem. Every grain of me repeats. Ask them to agree on where."',
    part2:
      '"Glass repeats nothing, so I stay where I am put."',
  },
  3: {
    part1:
      'A silver golem on the seam. "Polycrystalline Bismuth Telluride Golem. I am the boundary. No flaw turned my currents."',
    part2:
      '"Nothing in me reverses, and nothing moves. Look how still my currents run."',
  },
  4: {
    part1:
      'A golem of broken layers. "Polycrystalline Manganese Bismuth Telluride Golem. You needed a field. My own spins quantize me."',
    part2:
      '"There is no such thing as most of an integer. Count me."',
  },
  5: {
    part1:
      'A golem of black ceramic. "Polycrystalline YBCO Golem. Every seam is a weak link, carrying current across a gap."',
    part2:
      '"A thousand junctions, one phase. One current, and not a drop more."',
  },
  6: {
    part1:
      'A golem of grey iron. "Polycrystalline Iron Golem. Push me and my walls slide. I stay the same magnet."',
    part2:
      '"What you flip walks off as a wave and fades. Nothing finishes in me."',
  },
  7: {
    part1:
      'A golem of cracked green triangles. "Polycrystalline Herbertsmithite Golem. No piece of me holds what I am."',
    part2:
      '"Cut me anywhere: nothing. There was never anything to take."',
  },
  8: {
    part1:
      'A golem of faulted honeycomb. "Polycrystalline Ruthenium Trichloride Golem. Every spin in me sits on three bonds that disagree."',
    part2:
      '"I have no order to break. Your blow splits, but halves do not travel."',
  },
  9: {
    part1:
      'A golem with a thousand separate glows. "A thousand holes in me, and I answered every one."',
    part2:
      '"Right where each was made. Nothing in me carries an answer away. Come and ask."',
  },
  10: {
    part1:
      'What steps out wears your own crystal. "The Adapted. You thought only you were learning."',
    part2:
      '"Every move you landed, I survived once. Trying harder is how you built me."',
  },
};

// One screen of a world's entry lore: the paragraphs it reads and the picture
// that heads them (art/storyPlates keys its painters by `plate`). A screen is
// one chapter of the Lab's Story station, so the lore met in play and the
// chapter re-read there are the same text under the same picture.
export interface WorldLoreScreen {
  plate: string;
  paragraphs: string[];
}

// A world's entry lore as the screens it plays: its history, then the
// Decoherence's attack on it. World 10's second page is two chapters, the
// reveal and the record, and splits at the middle of its paragraphs (four at
// Detailed, two at Brief), each half under its own picture.
export function worldLoreScreens(world: number, lore: WorldLore): WorldLoreScreen[] {
  const page2 = lore.page2.split('\n\n');
  const screens: WorldLoreScreen[] = [{ plate: `${world}-history`, paragraphs: lore.page1.split('\n\n') }];
  if (world === 10 && page2.length >= 2) {
    const seam = Math.ceil(page2.length / 2);
    screens.push({ plate: '10-decoherence', paragraphs: page2.slice(0, seam) }, { plate: '10-record', paragraphs: page2.slice(seam) });
  } else {
    screens.push({ plate: `${world}-decoherence`, paragraphs: page2 });
  }
  return screens;
}

// The table a story screen reads, picked by the Text Length setting. Falls
// back to the Detailed entry when a world has no Brief one, so a world
// written only once still shows its story at either setting.
export function worldLoreFor(world: number, length: StoryLength): WorldLore | undefined {
  return (length === 'brief' ? WORLD_LORE_BRIEF[world] : undefined) ?? WORLD_LORE[world];
}

export function rivalTauntFor(world: number, length: StoryLength): RivalTaunt | undefined {
  return (length === 'brief' ? RIVAL_TAUNTS_BRIEF[world] : undefined) ?? RIVAL_TAUNTS[world];
}

// Minimal structural type (mirrors data/tutorial.ts's RegistryLike) so this
// stays a plain data module.
interface RegistryLike {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

// Deliberately its own save field (`worldLoreSeen`), not folded into
// `visitedWorlds` -- Superposition Mode pre-seeds `visitedWorlds` with every
// built world on entry (OverworldScene.applySuperpositionLeveling), which
// would wrongly suppress every world's lore screen at once if this reused
// that list.
export function hasSeenWorldLore(registry: RegistryLike, world: number): boolean {
  const seen = (registry.get('worldLoreSeen') as number[]) ?? [];
  return seen.includes(world);
}

// Idempotent -- safe to call even if the world's lore is already marked seen.
export function markWorldLoreSeen(registry: RegistryLike, world: number): void {
  const seen = (registry.get('worldLoreSeen') as number[]) ?? [];
  if (seen.includes(world)) return;
  registry.set('worldLoreSeen', [...seen, world]);
}
