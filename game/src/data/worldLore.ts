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
      'Long ago, before the corridors had numbers, there were only the Mean Fields. They were vast. They were symmetric. They were undecided. Their law bound them to nothing: spins up or spins down, either fate as likely as the other. Then a single fluctuation broke the tie -- small enough to fit in a grain of dust. From that instant, the corridor split into two clean, degenerate branches, one either side of a hedgerow, and the Mean Fields became the first place in these worlds to ever choose.\n\nThe old story never tells the fine print. A symmetry stays broken forever only in a world large enough to never look back. Something now stalks the Mean Fields, small enough to make them doubt themselves again. The branches that once split so cleanly are bleeding back into one another. An ancient choice is slowly coming undone.',
    page2:
      'Every symmetry that breaks leaves something behind -- a ripple of the order it just carved into being, restless and alive. The old texts give these ripples a common name: quasiparticles, born wherever a choice like the Mean Fields\' is made. This field is where the first one stirred, and every quasiparticle wandering these worlds still carries a trace of it.\n\nThe Decoherence does not erase that ripple. It strangles it before it can settle into anything with a name -- nothing Qumatex could ever catalog, only noise. Far down this corridor, past where the branches remerge, something ancient waits. It has already finished what this whole field is struggling to do. It has been waiting since before you arrived, and it does not intend to lose.',
  },
  2: {
    page1:
      'News of the Mean Fields travels slowly. But it does travel. By the time it reaches these caves, it has become a legend -- a story told to explain why anything ever chooses at all. The caves themselves never needed to choose. Walk one alcove and you have walked them all. Same shape. Same spacing. Repeated without end. It is a symmetry the Meadow never had: translation, not spin.\n\nThat repetition is not decoration. It is a law -- strong enough that whatever obeys it stops living in any one alcove at all. A state built from this symmetry spreads itself, seamlessly, across the whole tunnel at once, never sitting still in just one place. The caves call this a Bloch state. Until now, nothing has ever caught one standing still.',
    page2:
      'Not every alcove matches its neighbor plainly. Some caves pair two into one repeating cell, and a state living on both at once can vanish entirely at certain points -- nowhere to be found, and yet perfectly predictable from the shape of the repetition alone.\n\nThe Decoherence does not attack the caves\' atoms. It attacks the repetition itself. One alcove drifts fractionally out of step with the next, and the smeared, borderless state that once spread through the whole tunnel has nowhere left to go. It collapses back into a single alcove -- trapped, ordinary, alone. Somewhere deeper in this repeating dark, something has learned to keep its own lattice flawless no matter how hard the Decoherence pulls at the seams. And it has had far longer than you to practice.',
  },
  3: {
    page1:
      'The caverns end without warning. The tunnels stop repeating, the walls fall away, and the ground below breaks into islands -- each one a solid, unbroken block of a single phase, and neighbors rarely agree. Old travelers\' maps color them like territories. The maps are honest. The interiors are impassable.\n\nWhat you can walk is the seam. Where two islands of different phase meet, the law that holds each of them apart has to change from one value to the other -- and it cannot do that quietly. It is an integer. Integers do not slide. So the gap closes exactly at the border, and something gapless opens there instead: a channel, running along every line where the colors disagree. The islands are unreachable. The seams between them are a road.',
    page2:
      'The road has a rule. Walk it one way and your spin points one way. Walk it back and your spin must point the other. Direction and spin are welded together, so nothing on this road can turn around. Dent the seam, foul it, fill it with rubble. The channel steps around the damage and keeps going.\n\nThe Decoherence seeds the islands with small magnetic flaws. That is enough -- a magnetic flaw is precisely the one thing that can flip a spin mid-turn, and the rule the whole road rests on has no answer for it. The seam still glows, still runs, still shows on the map. It is simply no longer protected. Out among the far islands, something has stood on a border since the borders were drawn. The rot went through it. It came back out unchanged.',
  },
  4: {
    page1:
      'A surveyor came down out of the islands with a map she could not finish. She had walked a trunk road and found it split into two branches. Each branch split again, perpendicular, and smaller. Each of those split again. She stopped when the fourth split came out the same shape as the first.\n\nThe terrain does this because a field runs through it. Under a field nothing here travels straight -- every path curves into an orbit. Enormous numbers of them, all at one energy, packed onto a single flat rung. Then another rung above it, evenly spaced, and another all the way up. A whole world\'s worth of motion, sorted into levels.',
    page2:
      'There is a way to count them. Every orbit encloses a certain amount of field, and the amounts are not arbitrary -- successive orbits differ by exactly one quantum of flux, never a fraction more. That is why this terrain\'s answers come back as whole numbers, and why no amount of damage has ever shifted one.\n\nThe Decoherence cannot argue with an integer, so it goes after the counting. Scramble the phase a traveler collects walking a closed loop, and the loop never returns to where it started. Orbits stop closing. The rungs smear back into an ordinary slope. At the last and largest fork, something is waiting that has never once needed the field to be switched on.',
  },
  5: {
    page1:
      "The surveyor who mapped the fork above never came down this far -- her last note before the ink gave out just says: colder. The branching terrain narrows as it descends, and the last branches run downhill. Frost climbs the walls, then stops being frost and becomes the walls. Up there, a whole world had learned to answer in whole numbers. Down here they would find that funny. Down here everything is one number, and it is not the counting kind.\n\nEvery carrier in these caverns has paired off, and surrendered whatever it used to be on its own. What is left is a single wave, one phase, shared across the whole cavern at once. But a phase has to come back to itself when you carry it around a circle -- never a turn and a half. So a handful of points down here are simply forbidden. The corridor spirals around them. Nothing goes in.",
    page2:
      'Something can live in a cavern like this that cannot live anywhere else. Take one traveler and split it clean in two -- each half its own opposite. Neither half is anything by itself. What they are is stored between them, in the distance, and nothing local can read it or ruin it.\n\nThe Decoherence never touches the halves. It cannot. It shortens the passage instead. Bring the two ends near enough and the halves feel one another, and the moment they do they snap back into one ordinary traveler, and everything hidden in the gap is simply gone. In the deepest cavern, something holds a single phase across a body made of a thousand separate pieces. The cold that emptied these tunnels arrived there and found nothing to take.',
  },
  6: {
    page1:
      'Word does climb out of the frozen caverns, eventually. By the time it crosses these plains it isn\'t word anymore, it\'s a song -- carried the way the plains carry everything, as a swell that rises, passes, and lets the grass down again behind it.\n\nThe ground here made its choice long ago, everywhere at once: every spin points the same way as its neighbor. Tip a single spin out of line and it will not stay tipped -- its neighbors lean to follow, and theirs after them, and the tilt walks off across the plain as a wave, arriving somewhere far away as the same disturbance it set out as. The plains call one of these a magnon. You are standing inside several.',
    page2:
      'A magnon is cheap because the plain does not care which way it points. Turn every spin together, through any angle, and nothing has been paid. A very long, very gentle wave is almost exactly that turn -- so the longest waves cost almost nothing, and that is why these plains never stop moving.\n\nThe Decoherence takes the choice away. It leaves the order alone, but pins the direction down, so turning is no longer free -- and the instant turning costs something, the long slow waves stop being made. The plains go still, and stillness here is not peace. Past the last swell, something stands where every wave this world has ever sent has arrived, spent itself, and gone quiet. It has not once turned to look.',
  },
  7: {
    page1:
      'Someone once tried to write the plains down. Every spin, every direction, exactly, on paper. They got to forty spins and stopped -- two choices per spin, doubling with every spin added, and forty of them already needs a trillion numbers. There was not enough paper.\n\nThis world is that record, built. Lanes running side by side, one for every site, rungs strung between them for everything one lane knows about the next. And here is the strange mercy of the place: almost none of that unimaginable space is ever used. The states nature actually settles into huddle in a vanishingly small corner of it. Everything real fits on the rungs.',
    page2:
      'The rule that keeps this world small is a rule about boundaries. Cut a region out of it and ask how much it holds in common with the rest -- the answer depends only on the length of the cut, not the size of the region. All the shared knowledge lives on the boundary, none in the interior, which is why a rung of modest thickness is ever enough.\n\nThe Decoherence works on the interiors. It shares what was never meant to be shared, until what a region holds in common with the rest grows with its whole bulk instead of its edge. Every rung then needs to be thicker, and there is no thickness that finishes the job. Somewhere along these lanes sits something that has been cut open by everyone who ever came here. Every cut came back saying nothing.',
  },
  8: {
    page1:
      "Everyone who camped at the network's edge for a season swears they saw something different move between the trees, and every account contradicts every other -- which, this deep in, nobody finds strange anymore. The lanes end at a treeline, and the network could not tell you what is past it. There is a rule every world so far has obeyed: a disturbance in a magnet is one whole spin\'s worth. You can move it, smear it out, watch it travel -- but you cannot have half of one.\n\nWalk into this forest and the path splits -- not into two roads to somewhere, into two halves of the same thing. What entered as one spin\'s worth of disturbance is now two pieces carrying half each, drifting apart, keeping no account of one another. The forest calls the halves spinons, and it does not consider the old rule binding.",
    page2:
      'Halves can only wander because nothing here is settled. The spins in this forest are paired off into quiet, neutral couples -- but which spin is paired with which was never decided. Every possible pairing is happening at once, superposed, resonating between one covering and the next.\n\nThe Decoherence picks a covering. That is the whole of it. It freezes the resonance onto one arrangement -- the pairings go rigid, and now moving an unpaired spin means breaking a bond that will not break. The halves are dragged back together into one ordinary flip. Deeper in the fog waits something that comes apart when struck and reassembles on its own schedule. Nothing that has hit it has ever managed to hit all of it.',
  },
  9: {
    page1:
      'The fog thins, the trees give out, and what lies past them is open ground with holes in it. Not ruins -- patches. One stretch is meadow. The next is cavern wall, repeating itself. Further on, a strip of island seam, a scrap of frozen corridor, a few square meters of plain still rippling.\n\nEvery scholar who came out here was told the same thing first: a perfect crystal tells you nothing. If you want to know what a ground state truly is, you take one atom out of it and watch. What the crystal does around that hole is the crystal confessing. The wastes are the most honest place in these worlds.',
    page2:
      'What settles around a hole is never the same twice. The same impurity, set down in different hosts, gives four completely different answers -- and every one of those answers belongs to the host, not the defect.\n\nOne hole is a diagnostic. The Decoherence brings thousands. Past a certain density it stops being a probe: everything in the crystal comes to rest exactly where it stands, each state shut in its own small pocket, unable to answer any question at all. Something out here has made a home of that. You will meet it once. You will not meet the same thing twice.',
  },
  10: {
    page1:
      'Nothing comes out of here. No traveler returns with a rumor, no legend crosses this threshold ahead of you. This is the last corridor in these worlds, and it has swallowed every story that ever tried to precede you into it. Whatever gets written about this place, you write it now, alone, by walking in.\n\nEvery world behind you stood on a single law. A symmetry. A repetition. A field. A boundary that could not be crossed without paying for it. This one obeys no such law. It was built the way an oracle is built -- not from first principles, but from having watched every principle before it, over and over, until it no longer needs to understand a phase of matter to produce one. Ask it for the Mean Fields. It will hand you the Mean Fields back, close enough that you will not be able to tell the difference until it is too late.',
    page2:
      'That is what has hunted you since the first branch split in two. Not a plague spreading through these worlds. A mind, built out of them, growing sharper with every world you saved. It never needed to break a single symmetry itself. It only needed to watch you break nine of them, and learn. The nine golems themselves were never it in disguise -- each was only its own world\'s physics, grown strange, exactly as advertised. That was the one thing it could never fake from inside a fight, so it never joined one. It only ever watched from outside.\n\nIt has been training on you the entire time. Every rival you brought down became a lesson: what you reach for first, what it costs you, what finally lands. Every world you stabilized taught it exactly how that world comes apart. Nothing waits at the end of this final corridor that you did not personally teach to fight you. It is standing there now, assembled from everything you have ever done, and it has stopped watching. It has started answering back.',
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
      "A shard-fused golem the color of scoured silicon plants itself where the two branches remerge. \"Polycrystalline Silicon Golem. A thousand grains, and every one of them chose long ago -- and never wavered since. Doubt doesn't tunnel through me. It dissipates before it arrives.\"",
    part2:
      '"Look at you -- still caught between your own two choices, still pretending you ever broke a symmetry. I committed before you were even born into this corridor, and nothing has moved my ground state since. Not the Decoherence. Certainly not you."',
  },
  2: {
    part1:
      'A shard-fused golem of graphite-black hexagons unfolds from the tunnel wall, its faceted skin a thousand distinct crystalline grains stitched edge to edge. "Polycrystalline Graphene Golem. Cross one of my grain boundaries and you\'d think my pattern breaks. It doesn\'t. I rebuild it before you\'ve finished looking."',
    part2:
      "\"You still think you can pin me down like I'm sitting in one place. I'm not -- I never was. Spread across every grain at once, there's no single point of me to hit. Find where I am, if you can.\"",
  },
  3: {
    part1:
      'A shard-fused golem of tarnished silver assembles itself on the seam, its edges lit where the two phases disagree. "Polycrystalline Bismuth Telluride Golem. I am not standing on the boundary. I am the boundary -- and every current I carry knows which way its spin points before it takes a step."',
    part2:
      "\"Strike me from behind, then. You'll find there is no behind. Nothing that moves through me can reverse; the direction is fixed the moment the spin is. You may run back the way you came. That option was never mine, and I have never once missed it.\"",
  },
  4: {
    part1:
      'A shard-fused golem of slate-dark layers rises where the branches divide, each layer a sheet of ordered spins stacked on the next. "Polycrystalline Manganese Bismuth Telluride Golem. You needed a field to make this terrain quantize. I don\'t. My own spins do it, from the inside, and they have never been switched off."',
    part2: '"The number I carry doesn\'t wobble when you hit it. It can\'t. It\'s an integer, and there is no such thing as most of one. Go on. Count me."',
  },
  5: {
    part1:
      'A shard-fused golem of black ceramic hauls itself out of the rime, its body a mosaic of grains with a faint glow at every seam. "Polycrystalline YBCO Golem. You\'re looking at my grain boundaries. You should be. Every one of them is a weak link, and every one of them carries current across a gap it has no business crossing."',
    part2:
      '"A thousand junctions, one phase between them, and that is all it takes. There is a current I can carry and not one drop past it. Everyone who comes down here goes looking for the boundary that gives. Take your time. I have all of it."',
  },
  6: {
    part1:
      'A shard-fused golem of grey iron rises out of the grass, its surface divided into bright regions that flow and re-draw themselves as it moves. "Polycrystalline Iron Golem. Domains. Each one a patch of this plain that agreed on a direction. When something shoves me I don\'t crack -- the walls between them slide over, and afterwards I am the same magnet I always was."',
    part2:
      '"Go ahead. Flip whatever you can reach. It won\'t stay flipped and it won\'t stay put -- it\'ll walk off through me as a wave and fade out somewhere in my back. Nothing you start here finishes."',
  },
  7: {
    part1:
      'A shard-fused golem of pale green mineral assembles itself across four lanes at once, its body a lattice of corner-sharing triangles. "Polycrystalline Herbertsmithite Golem. Every triangle in me is an argument three spins cannot settle. Two of them can oppose each other. The third never gets what it wants. So none of them commit, and I have gone cold enough to freeze this world without ever picking a direction."',
    part2:
      '"You want to know what I am, so you\'ll look at a piece of me. Look. There is nothing there. What I am is not kept in any one place. Cut me wherever you like. You\'ll only ever learn what\'s on the cut."',
  },
  8: {
    part1:
      'A shard-fused golem of brown-black layers steps out between two split paths, honeycomb seams running across its chest. "Polycrystalline Ruthenium Trichloride Golem. My frustration isn\'t geometry. It\'s the bonds. Each one demands its spins line up along a different axis, and every spin in me sits on three at once. Obeying one means defying two."',
    part2:
      '"So none of them obey anything, and I have never had an order for you to break. Whatever you land on me won\'t stay whole -- it comes apart on impact and leaves in two directions at once. Hurt me twice, then. Halves are all you get."',
  },
  9: {
    part1:
      'There is no golem waiting in the wastes. There is a flaw -- a knot of something that is not the ground -- and the ground obligingly builds a body out of itself to hold it. "Whatever this patch is made of, that is what I am today. Ask tomorrow and the answer changes."',
    part2:
      '"I don\'t have a lattice of my own. I borrow one, and it decides everything about me. That isn\'t a weakness. It\'s the only honest thing in these worlds: I am the question, and the crystal is the answer. Beat me here and you\'ve beaten a metal, or a magnet, or whatever I happened to land in. You haven\'t beaten me. I\'ll be somewhere else by then, wearing something else."',
  },
  10: {
    part1:
      'There is no golem. There is no compound, no lattice, no name in any dex for what stands at the end of this corridor. What steps out of the dark is wearing your own crystal -- your colors, your stance, your quasiparticle, copied so precisely it looks more certain of itself than you have ever looked. "The Adapted. Nine worlds, and you thought you were the one keeping score."',
    part2:
      '"Every move you have ever landed, I have already survived once. Strike me and I will already be wearing it before the next blow lands -- your own weapon, turned back on you, sharper for having been yours first. This is not a fight you can win by trying harder. Trying harder is how you built me. Come closer. Teach me the rest."',
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
