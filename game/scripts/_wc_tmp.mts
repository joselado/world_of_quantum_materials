import { WORLD_LORE, RIVAL_TAUNTS } from '../src/data/worldLore.ts';
import { STORY_BEATS, FINALE_BODY } from '../src/data/story.ts';
const wc = (s?: string) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
for (let w = 1; w <= 10; w++) console.log(w, wc(WORLD_LORE[w]?.page1), wc(WORLD_LORE[w]?.page2), wc(RIVAL_TAUNTS[w]?.part1), wc(RIVAL_TAUNTS[w]?.part2), wc(STORY_BEATS[w]));
console.log('finale', wc(FINALE_BODY));
