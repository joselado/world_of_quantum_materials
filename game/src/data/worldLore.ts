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
      'Long ago, before the corridors had numbers, there were only the Mean Fields. They were vast. They were symmetric. They were undecided. Their law bound them to nothing: spins up or spins down, either fate as likely as the other. Then a single fluctuation broke the tie, small enough to fit in a grain of dust. From that instant, the corridor split into two clean, degenerate branches, one either side of a hedgerow, and the Mean Fields became the first place in these worlds to ever choose.\n\nThe old story never tells the fine print. A symmetry stays broken forever only in a world large enough to never look back. Something now stalks the Mean Fields, small enough to make them doubt themselves again. The branches that once split so cleanly are bleeding back into one another. An ancient choice is slowly coming undone.',
    page2:
      'Every symmetry that breaks leaves something behind, a ripple of the order it just carved into being, restless and alive. The old texts give these ripples a common name: quasiparticles, born wherever a choice like the Mean Fields\' is made. This field is where the first one stirred, and every quasiparticle wandering these worlds still carries a trace of it.\n\nThe Decoherence does not erase that ripple. It strangles it before it can settle into anything with a name: nothing Qumatex could ever catalog, only noise. Far down this corridor, past where the branches remerge, something ancient waits. It has already finished what this whole field is struggling to do. It has been waiting since before you arrived, and it does not intend to lose.',
  },
  2: {
    page1:
      'News of the Mean Fields travels slowly. But it does travel. By the time it reaches this cloister, it has become a legend, a story told to explain why anything ever chooses at all. The cloister itself never needed to choose. Walk one bay of it and you have walked them all. Same shape. Same spacing. Repeated without end in both directions, under a sun that does not move. It is a symmetry the fields never had: translation, not spin.\n\nThat repetition is not decoration. It is a law, strong enough that whatever obeys it stops living in any one bay at all. A state built from this symmetry spreads itself, seamlessly, across the whole colonnade at once, never sitting still in just one place. The lattice calls this a Bloch state. Until now, nothing has ever caught one standing still.',
    page2:
      'Not every bay matches its neighbor plainly. The floor here pairs two tiles into one repeating cell, and a state living on both at once can vanish entirely at certain points: nowhere to be found, and yet perfectly predictable from the shape of the repetition alone.\n\nThe Decoherence does not attack the stone. It attacks the repetition itself. One column drifts fractionally out of step with the next, and the smeared, borderless state that once spread through the whole colonnade has nowhere left to go. It collapses back into a single bay, trapped, ordinary, alone. Somewhere further along this repeating stone, something waits that does not repeat at all. The accounts disagree about whether it shed the pattern or lost it, and it has had far longer than you to settle on its answer.',
  },
  3: {
    page1:
      'The colonnade ends without warning. The columns stop repeating, the last of them falls behind you, and the ground ahead breaks open into flat sunken domains, each one a solid, unbroken expanse of a single phase, and neighbors rarely agree. Old travelers\' maps color them like territories. The maps are honest. The interiors are dead, and a storey below your feet.\n\nWhat you can walk is the seam. Where two islands of different phase meet, the law that holds each of them apart has to change from one value to the other, and it cannot do that quietly. It is an integer. Integers do not slide. So the gap closes exactly at the border, and something gapless opens there instead: a channel, running along every line where the colors disagree. The domains are unreachable. The lit ledge between them is a road.',
    page2:
      'The road has a rule. Walk it one way and your spin points one way. Walk it back and your spin must point the other. Direction and spin are welded together, so nothing on this road can turn around. Dent the seam, foul it, fill it with rubble. The channel steps around the damage and keeps going.\n\nThe Decoherence seeds the domains with small magnetic flaws. That is enough: a magnetic flaw is precisely the one thing that can flip a spin mid-turn, and the rule the whole road rests on has no answer for it. The seam still glows, still runs, still shows on the map. It is simply no longer protected. Out along the far ledges, something has stood on a border since the borders were drawn. The rot went through it. Whatever came back out has been standing very still ever since.',
  },
  4: {
    page1:
      'A surveyor came off the last of the ledges with a map she could not finish. She had walked a trunk road and found it split into two branches. Each branch split again, perpendicular, and smaller. Each of those split again. She stopped when the fourth split came out the same shape as the first.\n\nThe terrain does this because a field runs through it. Under a field nothing here travels straight: every path curves into an orbit. Enormous numbers of them, all at one energy, packed onto a single flat rung. Then another rung above it, evenly spaced, and another all the way up. A whole world\'s worth of motion, sorted into levels.',
    page2:
      'There is a way to count them. Every orbit encloses a certain amount of field, and the amounts are not arbitrary: successive orbits differ by exactly one quantum of flux, never a fraction more. That is why this terrain\'s answers come back as whole numbers, and why no amount of damage has ever shifted one.\n\nThe Decoherence cannot argue with an integer, so it goes after the counting. Scramble the phase a traveler collects walking a closed loop, and the loop never returns to where it started. Orbits stop closing. The rungs smear back into an ordinary slope. At the last and largest fork, something is waiting that will tell you it never needed the field switched on. Nothing has come back from it carrying a number to check that against.',
  },
  5: {
    page1:
      "The surveyor who mapped the fork above never came out this far; her last note before the ink gave out just says: colder. The branching terrain runs out onto open ice, and the last of the shelter runs out with it. Frost climbs everything, then stops being frost and becomes the ground. Back there, a whole world had learned to answer in whole numbers. Out here they would find that funny. Out here everything is one number, and it is not the counting kind.\n\nEvery carrier on this glacier has paired off, and surrendered whatever it used to be on its own. What is left is a single wave, one phase, shared across the whole field at once. It will not hold a field inside it either. The ice is swept, every line of it bending away, and what is pushed out has almost nowhere left to go. Almost: a phase must come back to itself when you carry it around a circle, never a turn and a half, so a handful of points out here are simply forbidden, and that is exactly where the expelled flux ends up, trapped and glowing at the bottom of a pit. The corridor spirals around them. Nothing goes in.",
    page2:
      'Something can live on ice like this that cannot live anywhere else. Take one traveler and split it clean in two, each half its own opposite. Neither half is anything by itself. What they are is stored between them, in the distance, and nothing local can read it or ruin it.\n\nThe Decoherence never touches the halves. It cannot. It shortens the passage instead. Bring the two ends near enough and the halves feel one another, and the moment they do they snap back into one ordinary traveler, and everything hidden in the gap is simply gone. Far out on the ice, something holds a single phase across a body made of a thousand separate pieces. The cold that emptied this glacier arrived there and found the agreement already made. Nothing has asked much of it since.',
  },
  6: {
    page1:
      'Word does climb off the glacier, eventually. By the time it crosses this steppe it isn\'t word anymore, it\'s a swell, carried the way the steppe carries everything, as a rise that passes through and lets the black sand down again behind it.\n\nThe ground here made its choice long ago, everywhere at once: every spin points the same way as its neighbor. Tip a single spin out of line and it will not stay tipped: its neighbors lean to follow, and theirs after them, and the tilt walks off across the plain as a wave, arriving somewhere far away as the same disturbance it set out as. The steppe calls one of these a magnon. You are standing inside several, and you can see them: the sand is ringed with them, and the shards leaning over you are what the order looks like standing up.',
    page2:
      'A magnon is cheap because the steppe does not care which way it points. Turn every spin together, through any angle, and nothing has been paid. A very long, very gentle wave is almost exactly that turn, so the longest waves cost almost nothing, and that is why this steppe never stops moving.\n\nThe Decoherence takes the choice away. It leaves the order alone, but pins the direction down, so turning is no longer free. And the instant turning costs something, the long slow waves stop being made. The steppe goes still, and stillness here is not peace. Past the last swell, something stands where every wave this world has ever sent has arrived, spent itself, and gone quiet. It has not once turned to look.',
  },
  7: {
    page1:
      'Someone once tried to write the steppe down. Every spin, every direction, exactly, on paper. They got to forty spins and stopped. Two choices per spin, doubling with every spin added, and forty of them already needs a trillion numbers. There was not enough paper.\n\nThis world is that record, built, and hung in nothing: there is no ground under it and no sky over it, because outside the network there is no space to have either. Lanes run side by side, one for every site, with rungs strung between them for everything one lane knows about the next. And here is the strange mercy of the place: almost none of that unimaginable space is ever used. The states nature actually settles into huddle in a vanishingly small corner of it. Everything real fits on the rungs.',
    page2:
      'The rule that keeps this world small is a rule about boundaries. Cut a region out of it and ask how much it holds in common with the rest: the answer depends only on the length of the cut, not the size of the region. All the shared knowledge lives on the boundary, none in the interior, which is why a rung of modest thickness is ever enough.\n\nThe Decoherence works on the interiors. It shares what was never meant to be shared, until what a region holds in common with the rest grows with its whole bulk instead of its edge. Every rung then needs to be thicker, and there is no thickness that finishes the job. Somewhere along these lanes sits something that has been cut open by everyone who ever came here. Every cut came back saying nothing.',
  },
  8: {
    page1:
      "Everyone who camped at the network's edge for a season swears they saw something different out on the water, and every account contradicts every other, which, this deep in, nobody finds strange anymore. The lanes end at a shoreline, and the network could not tell you what is past it. What is past it is bog: black water in pools with mist lying flat on it, reeds standing out of it, and a thread of peat bank that is the only ground that holds. Watch the water, not the reeds. Step off the bank and the medium closes over you.\n\nThere is a rule every world so far has obeyed: a disturbance in a magnet is one whole spin's worth. You can move it, smear it out, watch it travel, but you cannot have half of one. Walk out along this bank and it parts: not into two roads to somewhere, into two halves of the same thing, and what it parts around is a pool. What entered as one spin's worth of disturbance is now two pieces carrying half each, drifting apart, keeping no account of one another. The bog calls the halves spinons, and it does not consider the old rule binding.",
    page2:
      'Halves can only wander because nothing here is settled. The spins in this water are paired off into quiet, neutral couples, but which spin is paired with which was never decided. Every possible pairing is happening at once, superposed, resonating between one covering and the next. The Decoherence picks a covering. That is the whole of it: the pairings go rigid, moving an unpaired spin means breaking a bond that will not break, and the halves are dragged back together into one ordinary flip.\n\nThe lights burning out in the pools are what this place is named for. Each one is a lone moment (a single spin nothing has managed to pair off), and the water it sits in is not empty. It is a sea of loose carriers, and they crowd in around any moment they find until one of them is bound to it in a singlet of exactly the kind the rest of the bog is made of. Total spin zero. Nothing left to point anywhere. Near the shore a moment can still burn through the cloud gathering on it; further out the clouds have closed and the pools are dark. Somewhere in that dark waits something that comes apart when struck and reassembles on its own schedule. Nothing that has hit it has ever managed to hit all of it.',
  },
  9: {
    page1:
      'The water gives out, the mist lifts off it, and what lies past the last pool is open ground with holes in it. Not ruins. Patches. One stretch is wheatfield. The next is colonnade, repeating itself. Further on, a strip of lit ledge, a scrap of swept ice, a few square metres of iron sand still rippling. Among them, half sunk in the crust, lie the drums of a fallen column, the only thing anyone ever built in these worlds, and it did not stay built.\n\nEvery scholar who came out here was told the same thing first: a perfect crystal tells you nothing. If you want to know what a ground state truly is, you take one atom out of it and watch. What the crystal does around that hole is the crystal confessing. These scars are the most honest place in these worlds.',
    page2:
      'What settles around a hole is never the same twice. The same impurity, set down in different hosts, gives four completely different answers, and every one of those answers belongs to the host, not the defect.\n\nOne hole is a diagnostic. The Decoherence brings thousands. Past a certain density it stops being a probe: everything in the crystal comes to rest exactly where it stands, each state shut in its own small pocket, unable to answer any question at all. Something out here has made a home of that. You will meet it once. You will not meet the same thing twice.',
  },
  10: {
    page1:
      'Nothing comes out of here. No traveler returns with a rumor, no legend crosses this threshold ahead of you. This is the last corridor in these worlds, and it has swallowed every story that ever tried to precede you into it. Whatever gets written about this place, you write it now, alone, by walking in.\n\nEvery world behind you stood on a single law. A symmetry. A repetition. A field. A boundary that could not be crossed without paying for it. This one obeys no such law. It was built the way an oracle is built: not from first principles, but from having watched every principle before it, over and over, until it no longer needs to understand a phase of matter to produce one. Ask it for the Mean Fields. It will hand you the Mean Fields back, close enough that you will not be able to tell the difference until it is too late.',
    page2:
      'That is what has hunted you since the first branch split in two. Not a plague spreading through these worlds. A mind, built out of them, growing sharper with every world you saved. It never needed to break a single symmetry itself. It only needed to watch you break nine of them, and learn. The nine golems themselves were never it in disguise: each was only its own world\'s physics, grown strange, exactly as advertised. That was the one thing it could never fake from inside a fight, so it never joined one. It only ever watched from outside.\n\nIt has been training on you the entire time. Every rival you brought down became a lesson: what you reach for first, what it costs you, what finally lands. Every world you stabilized taught it exactly how that world comes apart. Nothing waits at the end of this final corridor that you did not personally teach to fight you.\n\nUnderstand what the teaching cost. To learn a quantum thing, something has to measure it, and to measure it is to leave the world holding a record of which state it was in. Nothing on record is still in superposition. The Decoherence was never a fog eating your coherence from outside; it is simply what happens when something out there comes to know you, and it has been coming to know you since the first branch split in two. It is standing at the end of this corridor now, assembled from everything you have ever done, and it has stopped watching. It has started answering back.',
  },
};

// World 9's entry has no fixed compound -- its rolled rival (RIVAL_9_TYPES,
// data/materials.ts) can be any of seven types, so its taunt is written to
// hold for any of them rather than naming one. World 10's is the story's
// reveal beat and is deliberately shaped differently from every other
// world's (see its own text): not "I've mastered one phenomenon" but "I've
// learned all of yours."
export const RIVAL_TAUNTS: Partial<Record<number, RivalTaunt>> = {
  1: {
    part1:
      'A shard-fused golem the color of scoured silicon stands where the two branches remerge, on the one patch of ground that belongs to neither. "Polycrystalline Silicon Golem. A thousand grains, and every one of them chose long ago and has never wavered since. Doubt cannot tunnel through me. It dies at my boundaries."',
    part2:
      '"Look at you, one small quantum material still caught between your own two choices. I settled this before you were born into this corridor. Ask any grain of me which way the fields broke. Every one will give you its answer, and every one will swear the others say the same."',
  },
  2: {
    part1:
      'A golem of clouded glass rises where the bays narrow, seamless, no two angles alike, not one face repeated anywhere on it. "Amorphous Silica Golem. Look around you. Bay after bay, the same shape at the same spacing, stone too frightened to differ from itself. I am what this colonnade is made of, set free of all that. Nothing in me repeats, and I answer to no pattern at all."',
    part2:
      '"Your lattice makes you a promise: be periodic, and you may be everywhere at once. I never took that deal. Every part of me is only itself. You call that a prison. I call it the only honesty in this hall. Come, then, quantum material. Show me how far being everywhere carries you against something that has learned to stay."',
  },
  3: {
    part1:
      'A shard-fused golem of tarnished silver waits on the seam, its edges lit where phase meets phase, though nothing moves along the light. "Disordered Bismuth Telluride Golem. I am not standing on the boundary. I am the boundary. Every current in me knew its spin before it took a step, and no flaw in this world has ever turned one around."',
    part2:
      '"Strike me from behind, then. You will find there is no behind. Nothing in me reverses. Nothing in me scatters onward. Nothing in me moves at all. That is how complete my protection has become. Look how still my currents run. Not one of them has taken a step in a very long time."',
  },
  4: {
    part1:
      'A shard-fused golem of slate-dark layers rises where the branches divide, each layer a sheet of ordered spins stacked on the next, every sheet interrupted. "Disordered Manganese Bismuth Telluride Golem. You needed a field to make this terrain quantize. I never did. My own spins do it, from the inside, and they have never once been switched off."',
    part2:
      '"The number I carry does not wobble when you hit it. It cannot. It is an integer, and there is no such thing as most of one. Go on. Count me. Take as long as you need, and tell me what you find, and I will tell you it was always exactly that."',
  },
  5: {
    part1:
      'A shard-fused golem of black ceramic hauls itself out of the rime, its body a mosaic of grains with a faint glow at every seam. "Polycrystalline YBCO Golem. You are looking at my grain boundaries. You should be. Every one of them is a weak link, and every one of them carries current across a gap it has no business crossing."',
    part2:
      '"A thousand junctions, one phase agreed between them, and that is all it takes. There is a current I can carry and not one drop past it. Everyone who comes down here goes looking for the boundary that gives first. Take your time. I have all of it, and I am very cold, and nothing has asked much of me in years."',
  },
  6: {
    part1:
      'A shard-fused golem of grey iron rises out of the black sand, its surface divided into bright regions that flow and re-draw themselves as it moves. "Polycrystalline Iron Golem. Domains. Each one a patch of this steppe that agreed on a direction. When something shoves me I do not crack: the walls between them slide over, and afterwards I am the same magnet I always was."',
    part2:
      '"Go ahead. Flip whatever you can reach. It will not stay flipped and it will not stay put: it will walk off through me as a wave and fade out somewhere in my back. Nothing you start here finishes. Nothing has finished in me for a long time."',
  },
  7: {
    part1:
      'A shard-fused golem of pale green mineral assembles itself across four lanes at once, a lattice of corner-sharing triangles seamed with fracture lines. "Polycrystalline Herbertsmithite Golem. What I am was never kept in any one place, so grind me as fine as you dare. You cannot take from any piece what no piece was ever holding."',
    part2:
      '"Cut me wherever you like and read the cut. Nothing there. Featureless, exactly as I have always been. I have checked every grain of myself, and every grain reports the same perfect nothing it has always reported. By every test I have, nothing has been taken from me. By every test I have, there was never anything to take."',
  },
  8: {
    part1:
      'A shard-fused golem of brown-black layers rises out of the water where the bank splits around it, honeycomb seams running across its chest and stacking faults running through every one of them. "Polycrystalline Ruthenium Trichloride Golem. My frustration is not geometry. It is the bonds. Each one demands its spins line up along a different axis, and every spin in me sits on three at once. Obeying one means defying two."',
    part2:
      '"So none of them obey anything, and I have never had an order for you to break. Whatever you land on me will not stay whole: it comes apart on impact and leaves in two directions at once, as far as my first seam. What steps out the other side is whole again. Hurt me twice, then. Halves are all you get, and they do not travel."',
  },
  9: {
    part1:
      'There is no golem waiting in the wastes. There is a flaw, a knot of something that is not the ground, and the ground obligingly builds a body out of itself to hold it. "Whatever this patch is made of, that is what I am today. Ask tomorrow and the answer changes."',
    part2:
      '"I do not have a lattice of my own. I borrow one, and it decides everything about me. That is not a weakness. It is the only honest thing in these worlds: I am the question, and the crystal is the answer. Beat me here and you have beaten a metal, or a magnet, or whatever I happened to land in. You have not beaten me. I will be somewhere else by then, wearing something else. Everything else you have put down out here stayed exactly where it fell, and stayed exactly what it was. Did you never wonder what that was?"',
  },
  10: {
    part1:
      'There is no golem. There is no compound, no lattice, no name in any dex for what stands at the end of this corridor. What steps out of the dark is wearing your own crystal: your colors, your stance, your quasiparticle, copied so precisely it looks more certain of itself than you have ever looked. "The Adapted. Nine worlds, and you thought you were the one keeping score."',
    part2:
      '"Every move you have ever landed, I have already survived once. Strike me and I will already be wearing it before the next blow lands: your own weapon, turned back on you, sharper for having been yours first. You have met my work nine times. It stood in nine passes and told you nine times what it used to be, and you walked over all of it. This is not a fight you can win by trying harder. Trying harder is how you built me. Come closer. Teach me the rest."',
  },
};

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
