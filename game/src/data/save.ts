import type { Material, MaterialType, MoveClass, Stats } from './types';
import { PLAYER_MATERIAL, DEFAULT_STATS, MOVES, TYPE_LOOK } from './materials';
import { wildHpForWorld } from './balance';
import {
  DEFAULT_ENCOUNTER_DENSITY,
  DEFAULT_FONT_SCALE,
  DEFAULT_MUSIC_STYLE,
  MUSIC_STYLE_PRESETS,
  DEFAULT_DIFFICULTY_TIER,
  DIFFICULTY_TIER_PRESETS,
  DEFAULT_WORLD_SIZE,
  WORLD_SIZE_PRESETS,
} from './settings';
import type { MusicStyle, DifficultyTier, WorldSizeId } from './settings';
import type { PassiveOwner } from './passives';

// Two independent localStorage-backed save slots, one per starting mode
// (Story Mode / Superposition Mode -- see the `superpositionMode` field
// below), no cloud sync (matches DESIGN.md §7). Story and Superposition
// progress must never mix: Superposition Mode bypasses normal unlock
// gating everywhere (every crystal/hybrid/impurity offered regardless of
// what's been defeated, every world pre-marked visited, stats re-leveled on
// every world entry), so a save written under one mode would be exploitable
// if it could ever be resumed under the other's rules. TitleScene reads the
// selected mode's slot at boot (and again on every mode-picker switch) into
// the Phaser registry, the runtime source of truth every scene already
// reads/writes; persistFromRegistry() is then called after each registry
// mutation that should survive a reload (token pickup, move purchase, rival
// defeat, battle outcome), routing the write to whichever slot matches the
// registry's own current `superpositionMode` flag, so the two never drift
// far apart.
const STORY_SAVE_KEY = 'qm-rpg-save-story-v1';
const SUPERPOSITION_SAVE_KEY = 'qm-rpg-save-superposition-v1';

function saveKeyFor(superposition: boolean): string {
  return superposition ? SUPERPOSITION_SAVE_KEY : STORY_SAVE_KEY;
}

export interface DiscoveredMaterial {
  name: string;
  type: MaterialType;
}

export interface SaveData {
  qumatessence: number;
  unlockedMoves: string[];
  playerHp: number;
  rivalDefeated: Record<number, boolean>;
  discoveredMaterials: DiscoveredMaterial[];
  // Added alongside the stats/teleport/transmutation batch:
  playerStats: Stats;
  visitedWorlds: number[];
  defeatedMaterials: DiscoveredMaterial[];
  playerForm: Material | null; // null = still the default PLAYER_MATERIAL (Silicon)
  // Guardian ids (WORLD_GUARDIANS' `id` field) the player has opened the panel
  // of at least once -- decides which guardians stand in the Lab as their own
  // clickable avatar (HubScene.spawnGuardianAvatars), so the room only offers
  // guardians actually met rather than every guardian in the game. A save with
  // no entry for this field opens an empty Lab, which is the same thing a new
  // save shows.
  metGuardians: string[];
  // Which contextual tutorial tips (data/tutorial.ts's TutorialTipId) have
  // already fired -- each one plays once, the first time its own feature
  // becomes relevant (HubScene.maybeShowLabTip, OverworldScene
  // .showTutorialTip), rather than one paged sequence up front. Also what
  // the Lab's Tutorial station gates those topics on in Story Mode
  // (data/tutorial.ts's `visibleTutorialPages`) -- a tip that hasn't fired
  // yet isn't in its topic menu either.
  tutorialTipsSeen: string[];
  // Which worlds' entry lore screen (data/worldLore.ts's WORLD_LORE, shown
  // by OverworldScene on first entering that world) has already played --
  // deliberately its own field, not folded into `visitedWorlds`, because
  // Superposition Mode's applySuperpositionLeveling pre-seeds
  // `visitedWorlds` with every built world on entry, which would wrongly
  // suppress every world's lore screen at once if this reused that list.
  worldLoreSeen: number[];
  // Title-screen toggle (TitleScene), "Superposition Mode" -- a testing/
  // exploration aid, not part of the normal progression. While on,
  // OverworldScene.create() re-levels the player's stats/moves/HP to match
  // enemyStatsForWorld() on every world entry, pre-seeds `visitedWorlds`
  // with every BUILT_WORLDS entry so Bloch's existing teleport hub (no
  // separate warp UI needed) can fold the player to any world immediately,
  // and Dresselhaus/Majorana/Anderson's panels offer every crystal/hybrid
  // pairing rather than only ones actually defeated. Also doubles as the
  // save-routing key: this field, read off the registry (not this struct),
  // is what saveKeyFor()/persistFromRegistry() use to decide which of the
  // two localStorage slots above a given write belongs to, so it is always
  // forced to match the slot a given SaveData was actually loaded from
  // (see loadSave()) rather than trusted from the stored blob alone.
  superpositionMode: boolean;
  // The Lab's Settings station (scenes/panels/hubStations.ts's showSettingsPanel): the
  // per-corridor-row chance a wild crystal spawns, one of data/settings.ts's
  // DENSITY_PRESETS. Only affects maps generated after the change (a fresh
  // world entry/regenerate), not the map the player is currently standing
  // on -- including the standing population respawns refill that map toward,
  // which is counted once at generation rather than re-read live.
  encounterDensity: number;
  // Same Settings panel, second row: the multiplier ui/text.ts's fontPx()
  // applies to every scene's authored base px size, one of data/settings.ts's
  // FONT_SCALE_PRESETS. Unlike encounterDensity this takes effect immediately
  // (read live on every fontPx() call), not just on the next map generation.
  fontScale: number;
  // Same Settings panel, third row: which of data/settings.ts's
  // MUSIC_STYLE_PRESETS (audio/music.ts's SCORES/SCORES_MODERN) the
  // MusicEngine draws from. Applies immediately (MusicEngine.setStyle
  // restarts whatever's currently playing under the new table).
  musicStyle: MusicStyle;
  // Same Settings panel, fourth row: which of data/settings.ts's
  // DIFFICULTY_TIER_PRESETS scales data/balance.ts's enemyStatsForWorld
  // (DIFFICULTY_MULTIPLIERS). Unlike the three settings above, meant to be
  // revisited mid-playthrough -- BattleScene/OverworldScene both read it
  // live on every fight/re-level rather than caching it, so a change here
  // applies to the player's very next battle.
  difficultyTier: DifficultyTier;
  // Same Settings panel, fifth row: how big a world is built, one of
  // data/settings.ts's WORLD_SIZE_PRESETS. Like encounterDensity above it,
  // this is read at map-generation time, so it applies to the next world
  // entered rather than to the one the player is standing in.
  worldSize: WorldSizeId;
  // Which of Kondo's three screening-class moves (data/materials.ts's
  // KONDO_MOVE_IDS) is currently the active/usable one -- null until the
  // player picks one for the first time in OverworldScene.showKondoPanel.
  // All three can be bought independently (they stay in unlockedMoves
  // regardless), but getBattleMoves only ever surfaces this one.
  kondoActiveMove: string | null;
  // Every passive ability the player has ever bought, flat across both
  // current owners (data/passives.ts's PassiveOwner) since passive ids are
  // globally unique across PASSIVES -- same "buy several, only one active,
  // switch by revisiting the guardian" shape as Kondo's moves above, but a
  // passive is a whole-battle always-on modifier rather than a move picked
  // from the battle menu each turn.
  passivesUnlocked: string[];
  // Which passive is currently active for each owner (BattleScene reads
  // this once at battle start, see its own comments) -- an owner missing
  // from this map has nothing equipped yet.
  activePassiveByOwner: Partial<Record<PassiveOwner, string>>;
  // Which quasiparticle class a given tunable move (by move id) is
  // currently tuned to (data/materials.ts's getTunedMoveClass,
  // scenes/panels/tunableMoveShop.ts's showMoveClassPicker) -- shared by
  // Landau's two Analytic moves and Skłodowska-Curie's two Ultimate moves
  // alike, since it's keyed by move id, not by owner. An id missing from
  // this map is "untuned," falling back to the move's own always-safe
  // default 'phonon' class for the quasiparticle-mismatch check.
  moveClassTuning: Partial<Record<string, MoveClass>>;
  // Which quasiparticle classes have been paid for (1000 qumatessence each)
  // for each of Skłodowska-Curie's two Ultimate moves (data/materials.ts's
  // ULTIMATE_MOVE_IDS/ULTIMATE_CLASS_UNLOCK_COST) -- once a (move, class)
  // pair appears here, retuning back to it via her panel is free forever,
  // mirroring how ordinary move retuning is already free once a move is
  // owned; the difference is the unlock is per-class here, not per-move.
  ultimateClassesUnlocked: Partial<Record<string, MoveClass[]>>;
  // World 9's rival's randomly rolled type (data/materials.ts's
  // rollRival9Type/RIVAL_9_TYPES) -- null until first rolled
  // (OverworldScene.resolveRival9Type, on first reaching world 9), then
  // fixed for the rest of the playthrough so the goal-tile boss preview and
  // the actual battle always agree on which crystal it turned out to be.
  rival9Type: MaterialType | null;
  // The crystal name currently doped in as an impurity via Anderson's panel
  // (scenes/panels/anderson.ts) -- null until the player picks a host there
  // for the first time. getBattleMoves unions this host's own
  // MOVE_COMPATIBILITY classes into the player's for as long as it stays set,
  // so a move learned from the dopant is battle-usable even if the player's
  // own type can't host it. Picking a different host in Anderson overwrites
  // this rather than adding to it -- only one impurity species is doped in at
  // a time, so switching dopants drops whichever classes only the old one
  // granted.
  andersonDopant: string | null;
  // Which individual *options* of each of the four repeatable-action
  // guardians' abilities have been paid for at least once (data/
  // materials.ts's BLOCH_DESTINATION_COST/DRESSELHAUS_TRANSMUTE_COST/
  // ANDERSON_DOPE_COST/MAJORANA_FUSE_COST) -- every option is its own
  // separate one-time purchase, not a single whole-ability flag, so each of
  // these is a list of option keys rather than a boolean: a Bloch world
  // number once traveled to for the first time, a Dresselhaus crystal name
  // once transmuted into, an Anderson host crystal name once doped in, a
  // Majorana hybrid *result* name once fused into. A key present in the
  // matching list means that specific option is free forever after; a key
  // absent means picking it again costs qumatessence. Majorana keys by the
  // hybrid *result*'s own name rather than by parent pair, since
  // HYBRID_RECIPES currently has no two different pairs producing the same
  // result -- paying to become a given hybrid is what stays free, however
  // it was first reached. Superposition Mode bypasses all four by checking
  // `OverworldScene.isSuperpositionMode()` directly in each panel rather
  // than writing these lists, so toggling the mode back off doesn't leave a
  // permanent free unlock behind.
  blochUnlockedWorlds: number[];
  dresselhausUnlockedCrystals: string[];
  andersonUnlockedHosts: string[];
  majoranaUnlockedResults: string[];
  // Feynman's move-leveling (§5, World 7, data/materials.ts's
  // MOVE_LEVEL_MULTIPLIERS/getMoveLevel/effectiveMovePower) -- moveId ->
  // level (0-3), missing entry means never attempted (level 0). Permanent
  // once a level is reached, the same "first time costs, permanent
  // afterward" shape every other guardian's one-time unlock already uses.
  moveLevels: Partial<Record<string, 0 | 1 | 2 | 3>>;
}

export function defaultSave(): SaveData {
  return {
    qumatessence: 0,
    unlockedMoves: [...PLAYER_MATERIAL.moves],
    // A fresh save always starts at World 1 -- HP is never intrinsic to a
    // crystal form (data/balance.ts's wildHpForWorld, driven purely by the
    // player's current world), so this is the same World 1 baseline
    // OverworldScene/HubScene fall back to when there's nowhere else to
    // resume.
    playerHp: wildHpForWorld(1),
    rivalDefeated: {},
    discoveredMaterials: [],
    playerStats: { ...DEFAULT_STATS },
    visitedWorlds: [],
    defeatedMaterials: [],
    playerForm: null,
    metGuardians: [],
    tutorialTipsSeen: [],
    worldLoreSeen: [],
    superpositionMode: false,
    encounterDensity: DEFAULT_ENCOUNTER_DENSITY,
    fontScale: DEFAULT_FONT_SCALE,
    musicStyle: DEFAULT_MUSIC_STYLE,
    difficultyTier: DEFAULT_DIFFICULTY_TIER,
    worldSize: DEFAULT_WORLD_SIZE,
    kondoActiveMove: null,
    passivesUnlocked: [],
    activePassiveByOwner: {},
    moveClassTuning: {},
    ultimateClassesUnlocked: {},
    rival9Type: null,
    andersonDopant: null,
    blochUnlockedWorlds: [],
    dresselhausUnlockedCrystals: [],
    andersonUnlockedHosts: [],
    majoranaUnlockedResults: [],
    moveLevels: {},
  };
}

// Wipes one mode's save slot so the next loadSave(superposition) for that
// same mode starts a fresh run -- TitleScene's "New Game" reset button,
// which only ever erases the currently-selected mode's own slot, never
// both. Callers must also re-seed the registry (e.g. via
// loadSave(superposition)) since this only clears localStorage.
export function clearSave(superposition: boolean) {
  try {
    localStorage.removeItem(saveKeyFor(superposition));
  } catch {
    // localStorage unavailable -- nothing to clear.
  }
}

export function hasSave(superposition: boolean): boolean {
  try {
    return localStorage.getItem(saveKeyFor(superposition)) !== null;
  } catch {
    return false;
  }
}

// What keeps a save playable across updates, in three layers, weakest first.
//
// **New fields are free.** loadSave() merges a parsed save over defaultSave(),
// so a save written before a field existed simply takes that field's default.
// Most changes to this file need nothing else: add the field to SaveData and
// to defaultSave() together and every existing save keeps working.
//
// **Stale references are dropped, always.** A save can name a move id or a
// material type that this version has since renamed or retired. MOVES and
// TYPE_LOOK are plain lookups with no fallback of their own, so an
// unrecognised name would crash the next panel render or battle rather than
// degrade; loadSave() therefore filters those fields on every load, and the
// preset-backed settings fall back to their defaults the same way. These are
// permanent and unversioned, because content gets renamed in any version, not
// only when the save format changes.
//
// **Restructuring gets a migration.** When a change is *not* just a new field
// -- a field holding real progress (currency, an unlock list, stats) renamed
// or restructured, where taking the default would erase play rather than a
// cheap-to-redo selection -- append one function here rather than bolting a
// check onto loadSave(). MIGRATIONS[i] patches a save from version
// SCHEMA_BASELINE + i to the next, and loadSave() replays every one from the
// version a save was written at up to the current one. Append when such a
// change ships; never edit one already shipped, since a save sitting in a
// browser could be at any past version and still has to replay it as written.
//
// SCHEMA_BASELINE is the format every save this version writes is stamped
// with, and the oldest one that is read. Saves older than it are not
// supported: they still load rather than being discarded, but through the
// merge alone, so anything a migration would have carried across is lost.
type SaveMigration = (raw: Record<string, unknown>) => Record<string, unknown>;

const SCHEMA_BASELINE = 1;
const MIGRATIONS: SaveMigration[] = [];
const CURRENT_SCHEMA_VERSION = SCHEMA_BASELINE + MIGRATIONS.length;

export function loadSave(superposition: boolean): SaveData {
  try {
    const raw = localStorage.getItem(saveKeyFor(superposition));
    // `superpositionMode` is forced to the requested slot on every return
    // path below (rather than trusted from `defaultSave()`, which hardcodes
    // `false`, or from the stored blob) so the registry key every other
    // scene reads (isSuperpositionMode()) always matches the slot this save
    // actually came from, even for a slot that's never been written yet.
    if (!raw) return { ...defaultSave(), superpositionMode: superposition };
    let parsed = JSON.parse(raw) as Record<string, unknown>;
    // Clamped up to the baseline rather than trusted outright, so a save from
    // before it skips straight to the merge instead of indexing off the front
    // of MIGRATIONS -- and one written by a *newer* build than this (a player
    // who ran a later version, then an older one) simply runs no migrations
    // and keeps every field this version still understands.
    const stamped = typeof parsed.schemaVersion === 'number' ? (parsed.schemaVersion as number) : 0;
    let version = Math.max(stamped, SCHEMA_BASELINE);
    while (version < CURRENT_SCHEMA_VERSION) {
      parsed = MIGRATIONS[version - SCHEMA_BASELINE](parsed);
      version += 1;
    }
    const data: SaveData = { ...defaultSave(), ...(parsed as Partial<SaveData>), superpositionMode: superposition };
    // The permanent safety nets (see the comment above MIGRATIONS): drop any
    // move id or material type this version no longer defines, and fall back
    // to the default for any preset-backed setting whose stored value is not
    // one of the offered ones. `playerForm: null` already means "still the
    // default PLAYER_MATERIAL", so resetting to it is the same state a save
    // that never set a form is in.
    data.unlockedMoves = data.unlockedMoves.filter((id) => id in MOVES);
    if (data.playerForm && !(data.playerForm.type in TYPE_LOOK)) data.playerForm = null;
    if (data.rival9Type && !(data.rival9Type in TYPE_LOOK)) data.rival9Type = null;
    if (!MUSIC_STYLE_PRESETS.some((p) => p.value === data.musicStyle)) data.musicStyle = DEFAULT_MUSIC_STYLE;
    if (!DIFFICULTY_TIER_PRESETS.some((p) => p.value === data.difficultyTier)) data.difficultyTier = DEFAULT_DIFFICULTY_TIER;
    if (!WORLD_SIZE_PRESETS.some((p) => p.value === data.worldSize)) data.worldSize = DEFAULT_WORLD_SIZE;
    return data;
  } catch {
    return { ...defaultSave(), superpositionMode: superposition };
  }
}

// Minimal structural type instead of importing Phaser here, so this module
// stays a plain data/storage concern -- any object with `.get` (a real
// Phaser.Data.DataManager, in practice) works.
interface RegistryLike {
  get: (key: string) => unknown;
}

export function persistFromRegistry(registry: RegistryLike) {
  // Which of the two slots this write belongs to -- read off the registry
  // itself rather than taking a parameter, so every one of this function's
  // ~40 call sites across the codebase can stay a plain `persistFromRegistry
  // (registry)` with no awareness of the two-slot split.
  const superposition = !!registry.get('superpositionMode');
  const data: SaveData = {
    qumatessence: (registry.get('qumatessence') as number) ?? 0,
    unlockedMoves: (registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves],
    // Defensive fallback only (playerHp is always set by the time this
    // runs) -- same World 1 baseline defaultSave() itself uses.
    playerHp: (registry.get('playerHp') as number) ?? wildHpForWorld(1),
    rivalDefeated: (registry.get('rivalDefeated') as Record<number, boolean>) ?? {},
    discoveredMaterials: (registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? [],
    playerStats: (registry.get('playerStats') as Stats) ?? { ...DEFAULT_STATS },
    visitedWorlds: (registry.get('visitedWorlds') as number[]) ?? [],
    defeatedMaterials: (registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [],
    playerForm: (registry.get('playerForm') as Material | null) ?? null,
    metGuardians: (registry.get('metGuardians') as string[]) ?? [],
    tutorialTipsSeen: (registry.get('tutorialTipsSeen') as string[]) ?? [],
    worldLoreSeen: (registry.get('worldLoreSeen') as number[]) ?? [],
    superpositionMode: superposition,
    encounterDensity: (registry.get('encounterDensity') as number) ?? DEFAULT_ENCOUNTER_DENSITY,
    fontScale: (registry.get('fontScale') as number) ?? DEFAULT_FONT_SCALE,
    musicStyle: (registry.get('musicStyle') as MusicStyle) ?? DEFAULT_MUSIC_STYLE,
    difficultyTier: (registry.get('difficultyTier') as DifficultyTier) ?? DEFAULT_DIFFICULTY_TIER,
    worldSize: (registry.get('worldSize') as WorldSizeId) ?? DEFAULT_WORLD_SIZE,
    kondoActiveMove: (registry.get('kondoActiveMove') as string | null) ?? null,
    passivesUnlocked: (registry.get('passivesUnlocked') as string[]) ?? [],
    activePassiveByOwner: (registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {},
    moveClassTuning: (registry.get('moveClassTuning') as Partial<Record<string, MoveClass>>) ?? {},
    ultimateClassesUnlocked: (registry.get('ultimateClassesUnlocked') as Partial<Record<string, MoveClass[]>>) ?? {},
    rival9Type: (registry.get('rival9Type') as MaterialType | null) ?? null,
    andersonDopant: (registry.get('andersonDopant') as string | null) ?? null,
    blochUnlockedWorlds: (registry.get('blochUnlockedWorlds') as number[]) ?? [],
    dresselhausUnlockedCrystals: (registry.get('dresselhausUnlockedCrystals') as string[]) ?? [],
    andersonUnlockedHosts: (registry.get('andersonUnlockedHosts') as string[]) ?? [],
    majoranaUnlockedResults: (registry.get('majoranaUnlockedResults') as string[]) ?? [],
    moveLevels: (registry.get('moveLevels') as Partial<Record<string, 0 | 1 | 2 | 3>>) ?? {},
  };
  try {
    // schemaVersion is a wire-format-only stamp read by loadSave() to know
    // which MIGRATIONS have already applied -- it's never part of SaveData
    // itself/the registry, only added here at serialize time.
    localStorage.setItem(saveKeyFor(superposition), JSON.stringify({ ...data, schemaVersion: CURRENT_SCHEMA_VERSION }));
  } catch {
    // localStorage unavailable (private browsing, quota) -- progress just
    // won't survive a reload this session.
  }
}
