import type { Material, MaterialType, MoveClass, Stats } from './types';
import { PLAYER_MATERIAL, DEFAULT_STATS, MOVES, TYPE_LOOK } from './materials';
import { wildHpForWorld } from './balance';
import { DEFAULT_ENCOUNTER_DENSITY, DEFAULT_FONT_SCALE, DEFAULT_MUSIC_STYLE, MUSIC_STYLE_PRESETS } from './settings';
import type { MusicStyle } from './settings';
import type { PassiveOwner } from './passives';

// Single localStorage-backed save slot (v1: one profile, no cloud sync --
// matches DESIGN.md §7). TitleScene reads this once at boot into the Phaser
// registry, the runtime source of truth every scene already reads/writes;
// persistFromRegistry() is then called after each registry mutation that
// should survive a reload (token pickup, move purchase, rival defeat,
// battle outcome) so the two never drift far apart.
const SAVE_KEY = 'qm-rpg-save-v1';

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
  // of at least once -- drives the Lab's Guardians station list
  // (scenes/panels/hubStations.ts's showGuardiansPanel), which should only offer guardians
  // actually met rather than every guardian in the game. No migration shim
  // for older saves' `metMentors` key (solo hobby project, no save-compatibility
  // guarantee): a save predating this field just starts its Guardians list empty.
  metGuardians: string[];
  // Which contextual tutorial tips (data/tutorial.ts's TutorialTipId) have
  // already fired -- each one plays once, the first time its own feature
  // becomes relevant (HubScene.maybeShowLabTip, OverworldScene
  // .showTutorialTip), rather than one paged sequence up front. The
  // Lab's Tutorial station replays the full set as a topic menu on demand
  // regardless of this list.
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
  // pairing rather than only ones actually defeated.
  superpositionMode: boolean;
  // The Lab's Settings station (scenes/panels/hubStations.ts's showSettingsPanel): the
  // per-corridor-row chance a wild crystal spawns, one of data/settings.ts's
  // DENSITY_PRESETS. Only affects maps generated after the change (a fresh
  // world entry/regenerate), not the map the player is currently standing
  // on.
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
  // Laughlin's two Analytic moves and Skłodowska-Curie's two Ultimate moves
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

// Wipes the save slot so the next loadSave() starts a fresh run --
// TitleScene's "New Game" reset button. Callers must also re-seed the
// registry (e.g. via scene.restart()) since this only clears localStorage.
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // localStorage unavailable -- nothing to clear.
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// A save-shape change that isn't just "a new field with a sensible default"
// (already free via loadSave()'s `{ ...defaultSave(), ...parsed }` merge
// below) -- specifically, a field holding real player progress (currency,
// an unlock list, stats) getting renamed or restructured, where resetting
// to default would erase actual play rather than just a cheap-to-redo
// selection -- gets one entry appended here instead of an ad hoc check
// bolted onto loadSave(). MIGRATIONS[i] patches a raw parsed save forward
// from schema version i to i+1; loadSave() runs every migration from the
// save's own stored version up to the current one. Append a new function
// when such a change ships; never edit an already-shipped one, since a save
// sitting in someone's browser could be at any past version and still needs
// to replay it as originally written. CURRENT_SCHEMA_VERSION is just
// MIGRATIONS.length, so there's nothing separate to remember to bump.
//
// This is deliberately not the same mechanism as loadSave()'s two
// unlockedMoves/playerForm/rival9Type safety nets further down -- those
// guard against a *reference* going stale (a move id, a MaterialType)
// inside an otherwise current-shape field, which can happen in any version
// whenever content is renamed, not just at a save-format change, so they
// stay permanent and unversioned rather than becoming one more migration
// step.
type SaveMigration = (raw: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: SaveMigration[] = [
  // v0 -> v1: the currency field was renamed qumatokens -> qumatessence.
  // Carry an old save's accumulated value across rather than losing it.
  (raw) => {
    if (typeof raw.qumatessence !== 'number' && typeof raw.qumatokens === 'number') {
      raw.qumatessence = raw.qumatokens;
    }
    delete raw.qumatokens;
    return raw;
  },
];

const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    let parsed = JSON.parse(raw) as Record<string, unknown>;
    let version = typeof parsed.schemaVersion === 'number' ? (parsed.schemaVersion as number) : 0;
    while (version < MIGRATIONS.length) {
      parsed = MIGRATIONS[version](parsed);
      version += 1;
    }
    const data: SaveData = { ...defaultSave(), ...(parsed as Partial<SaveData>) };
    // Permanent safety nets, not migrations (see the comment above
    // MIGRATIONS) -- drop moves/types a prior version of the game defined
    // but this version renamed/retired (e.g. a retired move id, or the old
    // 'trivial'/'magnet'/'qhe' types later renamed
    // 'classicalmag'/'spinliquid'/'supercon'). MOVES/TYPE_LOOK are plain
    // object lookups with no fallback of their own, so an unrecognized
    // reference would otherwise crash the next panel render/battle rather
    // than degrade gracefully. `playerForm: null` already means "still the
    // default PLAYER_MATERIAL," so resetting to that is the same safe
    // fallback a save predating the field itself already uses.
    data.unlockedMoves = data.unlockedMoves.filter((id) => id in MOVES);
    if (data.playerForm && !(data.playerForm.type in TYPE_LOOK)) data.playerForm = null;
    if (data.rival9Type && !(data.rival9Type in TYPE_LOOK)) data.rival9Type = null;
    if (!MUSIC_STYLE_PRESETS.some((p) => p.value === data.musicStyle)) data.musicStyle = DEFAULT_MUSIC_STYLE;
    return data;
  } catch {
    return defaultSave();
  }
}

// Minimal structural type instead of importing Phaser here, so this module
// stays a plain data/storage concern -- any object with `.get` (a real
// Phaser.Data.DataManager, in practice) works.
interface RegistryLike {
  get: (key: string) => unknown;
}

export function persistFromRegistry(registry: RegistryLike) {
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
    superpositionMode: (registry.get('superpositionMode') as boolean) ?? false,
    encounterDensity: (registry.get('encounterDensity') as number) ?? DEFAULT_ENCOUNTER_DENSITY,
    fontScale: (registry.get('fontScale') as number) ?? DEFAULT_FONT_SCALE,
    musicStyle: (registry.get('musicStyle') as MusicStyle) ?? DEFAULT_MUSIC_STYLE,
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
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, schemaVersion: CURRENT_SCHEMA_VERSION }));
  } catch {
    // localStorage unavailable (private browsing, quota) -- progress just
    // won't survive a reload this session.
  }
}
