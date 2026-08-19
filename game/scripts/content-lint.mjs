// Static source/data-integrity lint for world_of_quantum_materials.
//
// Unlike every other script in this directory, this one checks neither
// runtime behavior (component-check.mjs/playthrough-check.mjs) nor
// difficulty (balance-sim.mjs) nor map shape (mapgen-check.mjs) -- it reads
// the source itself and checks what stays consistent there, catching the
// class of mistake those other checks structurally can't see. Two families:
// the hand-authored data tables' internal consistency (checks 1-16) -- a
// typo'd move id, a world missing from one table but not its sibling, a
// hybrid recipe whose result was never actually added to World 10's pool --
// and source-level assertions the compiler is deliberately told not to make
// (check 17, orphan definite-assignment fields).
// This project has shipped exactly these kinds of bug before (a move name
// collision, "fix Beam/Beam name collision"; a never-assigned `!` field that
// froze World 10) -- this script exists so the next one gets caught before a
// commit rather than after.
//
// Parses source files with the TypeScript compiler API rather than
// importing them, same reason and same technique as gen-docs.mjs/
// balance-sim.mjs: materials.ts pulls in Phaser (via art/colors.ts) at
// module scope, which needs browser globals Node doesn't have, and static
// AST literals are all any of these scripts need anyway. Pure Node, no
// browser, no dev server -- runs in well under a second.
//
// Usage: npm run content-lint (from game/), or node scripts/content-lint.mjs
// directly. Exits 1 if anything is found, 0 if clean.

import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(__dirname, '..');

function parseFile(relPath) {
  const filePath = path.join(gameDir, relPath);
  const text = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findTopLevelConst(sf, name) {
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (decl.name.getText(sf) === name && decl.initializer) return decl.initializer;
      }
    }
  }
  throw new Error(`const ${name} not found in ${sf.fileName}`);
}

function findClassProperty(sf, className, propName) {
  for (const stmt of sf.statements) {
    if (ts.isClassDeclaration(stmt) && stmt.name?.getText(sf) === className) {
      for (const member of stmt.members) {
        if (ts.isPropertyDeclaration(member) && member.name?.getText(sf) === propName && member.initializer) {
          return member.initializer;
        }
      }
    }
  }
  throw new Error(`class property ${className}.${propName} not found in ${sf.fileName}`);
}

// A top-level `export type Name = 'a' | 'b' | ...` string-literal union --
// MaterialType/MoveClass (data/types.ts) are both this shape.
function findTypeUnionLiterals(sf, name) {
  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.getText(sf) === name) {
      const t = stmt.type;
      if (!ts.isUnionTypeNode(t)) throw new Error(`${name} in ${sf.fileName} isn't a union type`);
      return t.types.map((member) => {
        if (ts.isLiteralTypeNode(member) && ts.isStringLiteralLike(member.literal)) return member.literal.text;
        throw new Error(`${name} union member isn't a string literal: ${member.getText(sf)}`);
      });
    }
  }
  throw new Error(`type ${name} not found in ${sf.fileName}`);
}

// Reduces a literal AST node to a plain JS value -- string/number/bool
// literals, array/object literals recursively, calls/`new` expressions as a
// tagged {__call|__new, args} shape, and function expressions as a plain
// {__fn: true} marker (this script never needs to *run* a guardian's
// avatar()/open() callback, just know one is present).
function evalNode(node, sf) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((el) => evalNode(el, sf));
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = prop.name.getText(sf).replace(/^['"]|['"]$/g, '');
      out[key] = evalNode(prop.initializer, sf);
    }
    return out;
  }
  if (ts.isCallExpression(node)) {
    return { __call: node.expression.getText(sf), args: node.arguments.map((a) => evalNode(a, sf)) };
  }
  if (ts.isNewExpression(node)) {
    return { __new: node.expression.getText(sf), args: (node.arguments ?? []).map((a) => evalNode(a, sf)) };
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return evalNode(node.expression, sf);
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return { __fn: true };
  if (ts.isIdentifier(node) && node.text === 'undefined') return undefined;
  // A bare identifier (e.g. `avatar: makeNoetherAvatar`, a function
  // reference rather than an inline arrow) -- this script never needs to
  // resolve what it points to, just know a value is present.
  if (ts.isIdentifier(node)) return { __ref: node.text };
  throw new Error(`content-lint: don't know how to read a ${ts.SyntaxKind[node.kind]} node: ${node.getText(sf)}`);
}

const issues = [];
const flag = (msg) => issues.push(msg);

// Reported in the clean-run summary so a check silently finding nothing to
// look at is distinguishable from one finding everything fine (check 16).
let definiteAssignmentFields = 0;

const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const fmtSet = (s) => `{${[...s].sort().join(', ')}}`;

// --- load data ------------------------------------------------------------

const typesSf = parseFile('src/data/types.ts');
const MATERIAL_TYPES = new Set(findTypeUnionLiterals(typesSf, 'MaterialType'));
const MOVE_CLASSES = new Set(findTypeUnionLiterals(typesSf, 'MoveClass'));

const materialsSf = parseFile('src/data/materials.ts');
const MOVES = evalNode(findTopLevelConst(materialsSf, 'MOVES'), materialsSf);
const MOVE_COMPATIBILITY = evalNode(findTopLevelConst(materialsSf, 'MOVE_COMPATIBILITY'), materialsSf);
const GOLEM_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'GOLEM_MOVE_IDS'), materialsSf);
const ANALYTIC_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'ANALYTIC_MOVE_IDS'), materialsSf);
const ULTIMATE_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'ULTIMATE_MOVE_IDS'), materialsSf);
// Kondo's screening moves are identified by class rather than by a literal
// list in materials.ts, so they are identified the same way here.
const KONDO_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.class === 'screening')
  .map((m) => m.id);
// SHOP_MOVE_IDS is computed rather than declared in materials.ts (a filter over
// MOVES), so it is mirrored here the same way scripts/gen-docs.mjs mirrors the
// player-only exclusions. Keep this in step with materials.ts's own filter.
const SHOP_MOVE_IDS = Object.keys(MOVES).filter(
  (id) =>
    id !== 'thermalFluctuation' &&
    !ANALYTIC_MOVE_IDS.includes(id) &&
    !ULTIMATE_MOVE_IDS.includes(id) &&
    !GOLEM_MOVE_IDS.includes(id) &&
    !KONDO_MOVE_IDS.includes(id)
);
const TYPE_LOOK = evalNode(findTopLevelConst(materialsSf, 'TYPE_LOOK'), materialsSf);
const WORLD_NAMES = evalNode(findTopLevelConst(materialsSf, 'WORLD_NAMES'), materialsSf);

// crystal(name, type, moves, hueStep?, variantOverride?, shortName?) --
// every WORLD_CRYSTALS/WORLD_RIVALS row is one of these calls (materials.ts's
// own comment on `crystal`), so args[0..2] are always name/type/moves.
function crystalFromCall(call) {
  if (!call || call.__call !== 'crystal') return null; // World 10's rival ("The Adapted") is a plain object, not a crystal() call
  const [name, type, moves] = call.args;
  return { name, type, moves: moves ?? [] };
}

const WORLD_CRYSTALS_RAW = evalNode(findTopLevelConst(materialsSf, 'WORLD_CRYSTALS'), materialsSf);
const WORLD_CRYSTALS = Object.fromEntries(
  Object.entries(WORLD_CRYSTALS_RAW).map(([world, calls]) => [world, calls.map(crystalFromCall).filter(Boolean)])
);

// World 9's rival is built by a function rather than declared as a
// WORLD_RIVALS row, so its name/moveset live in these two per-type tables
// instead -- read here so check 6 can hold it to the same hostability rule
// every other opponent is held to.
const RIVAL_9_TYPES = evalNode(findTopLevelConst(materialsSf, 'RIVAL_9_TYPES'), materialsSf);
const RIVAL_9_NAMES = evalNode(findTopLevelConst(materialsSf, 'RIVAL_9_NAMES'), materialsSf);
const RIVAL_9_MOVES = evalNode(findTopLevelConst(materialsSf, 'RIVAL_9_MOVES'), materialsSf);

const WORLD_RIVALS_RAW = evalNode(findTopLevelConst(materialsSf, 'WORLD_RIVALS'), materialsSf);
// World 10's rival ("The Adapted") deliberately has no fixed type/crystal()
// call of its own (its identity is decided live in battle, DESIGN.md §5) --
// kept as null rather than dropped, so world-coverage checks below still see
// its key present while type/move checks skip it.
const WORLD_RIVALS = Object.fromEntries(
  Object.entries(WORLD_RIVALS_RAW).map(([world, call]) => [world, crystalFromCall(call)])
);

// Every HYBRID_RECIPES `result` is `namedResult('Name')` -- a lookup against
// the real WORLD_CRYSTALS entry of that name (materials.ts's own
// `findMaterialByName`), not an independently authored crystal() literal, so
// there's no separate type/look to drift out of sync with the entry it
// names -- only the name itself needs checking against WORLD_CRYSTALS[10].
const HYBRID_RECIPES_RAW = evalNode(findTopLevelConst(materialsSf, 'HYBRID_RECIPES'), materialsSf);
const HYBRID_RECIPES = HYBRID_RECIPES_RAW.map((r) => ({
  parents: r.parents,
  result: r.result.args[0],
}));

const overworldSf = parseFile('src/scenes/OverworldScene.ts');
const WORLD_GUARDIANS_RAW = evalNode(findClassProperty(overworldSf, 'OverworldScene', 'WORLD_GUARDIANS'), overworldSf);

const passivesSf = parseFile('src/data/passives.ts');
const PASSIVES = evalNode(findTopLevelConst(passivesSf, 'PASSIVES'), passivesSf);

const quizSf = parseFile('src/data/quiz.ts');
const WORLD_QUESTIONS = evalNode(findTopLevelConst(quizSf, 'WORLD_QUESTIONS'), quizSf);

const BUILT_WORLDS = Array.from({ length: 10 }, (_, i) => String(i + 1));

// --- checks -----------------------------------------------------------

// 1. MaterialType (types.ts) and MOVE_COMPATIBILITY's own keys must be the
// exact same set -- a type with no MOVE_COMPATIBILITY row can't host any
// move at all (an unwinnable form), and a MOVE_COMPATIBILITY row for a type
// that no longer exists is dead weight nobody will notice going stale.
{
  const compatTypes = new Set(Object.keys(MOVE_COMPATIBILITY));
  if (!setEq(MATERIAL_TYPES, compatTypes)) {
    const missing = [...MATERIAL_TYPES].filter((t) => !compatTypes.has(t));
    const extra = [...compatTypes].filter((t) => !MATERIAL_TYPES.has(t));
    if (missing.length) flag(`MOVE_COMPATIBILITY is missing a row for MaterialType(s): ${fmtSet(new Set(missing))}`);
    if (extra.length) flag(`MOVE_COMPATIBILITY has a row for non-existent MaterialType(s): ${fmtSet(new Set(extra))}`);
  }
}

// 2. Every type must be able to host 'phonon' (the one universal class every
// crystal's own lattice carries) -- the documented escape hatch that keeps
// getBattleMoves() from ever returning empty. See DESIGN.md §3.
for (const [type, classes] of Object.entries(MOVE_COMPATIBILITY)) {
  if (!classes.includes('phonon')) flag(`MOVE_COMPATIBILITY['${type}'] doesn't include 'phonon' -- this type has no universal fallback move`);
}

// 3. TYPE_LOOK (per-type color/variant) must cover exactly the same set --
// a type with no look would render as undefined/blank.
{
  const lookTypes = new Set(Object.keys(TYPE_LOOK));
  if (!setEq(MATERIAL_TYPES, lookTypes)) {
    const missing = [...MATERIAL_TYPES].filter((t) => !lookTypes.has(t));
    const extra = [...lookTypes].filter((t) => !MATERIAL_TYPES.has(t));
    if (missing.length) flag(`TYPE_LOOK is missing MaterialType(s): ${fmtSet(new Set(missing))}`);
    if (extra.length) flag(`TYPE_LOOK has non-existent MaterialType(s): ${fmtSet(new Set(extra))}`);
  }
}

// 4. Every class MOVE_COMPATIBILITY grants must be a real MoveClass.
for (const [type, classes] of Object.entries(MOVE_COMPATIBILITY)) {
  for (const cls of classes) {
    if (!MOVE_CLASSES.has(cls)) flag(`MOVE_COMPATIBILITY['${type}'] lists unknown MoveClass '${cls}'`);
  }
}

// 5. Every move's own class must be a real MoveClass.
for (const move of Object.values(MOVES)) {
  if (!MOVE_CLASSES.has(move.class)) flag(`MOVES['${move.id}'].class is unknown MoveClass '${move.class}'`);
}

// 6. Every opponent's own moves must be hostable by its own type. A crystal
// that fights with a quasiparticle its physics cannot host contradicts the
// one type-interaction rule the whole battle system rests on (a defender that
// cannot host a class takes double damage from it, DESIGN.md §4), and it is
// invisible to tsc: the moveset is a plain string array, valid whatever it
// contains. This has been a live risk exactly once, when an opponent was
// retyped without its moveset following, so the check is cheap insurance on
// every future retype.
//
// World 9's rival is covered too, at the bottom of this check. It is built
// by `rivalImpurityResonance` rather than declared as a WORLD_RIVALS row, so
// the two loops below cannot see it -- and its seven rollable types have no
// hostable class in common beyond 'phonon', which makes a moveset that
// drifts out of step with the roll exactly the mistake this check catches.
for (const [world, entries] of Object.entries(WORLD_CRYSTALS)) {
  for (const c of entries) {
    for (const moveId of c.moves ?? []) {
      const move = MOVES[moveId];
      if (!move) continue; // covered by the unknown-move-id check above
      if (!(MOVE_COMPATIBILITY[c.type] ?? []).includes(move.class)) {
        flag(
          `WORLD_CRYSTALS[${world}] '${c.name}' (${c.type}) carries '${move.name}', whose class '${move.class}' its type cannot host`
        );
      }
    }
  }
}
for (const [world, rival] of Object.entries(WORLD_RIVALS)) {
  if (!rival) continue; // World 10's Adapted has no fixed type
  for (const moveId of rival.moves ?? []) {
    const move = MOVES[moveId];
    if (!move) continue;
    if (!(MOVE_COMPATIBILITY[rival.type] ?? []).includes(move.class)) {
      flag(
        `WORLD_RIVALS[${world}] '${rival.name}' (${rival.type}) carries '${move.name}', whose class '${move.class}' its type cannot host`
      );
    }
  }
}

// World 9's rolled rival: both per-type tables must cover exactly
// RIVAL_9_TYPES (a rolled type with no entry crashes the battle on a
// non-null assertion), and each type's own signature move must be one its
// type can host. The moveset's other slot is 'thermalFluctuation', hostable
// by construction -- check 2 already holds every type to carrying 'phonon'.
{
  const rollable = new Set(RIVAL_9_TYPES);
  for (const [label, table] of [
    ['RIVAL_9_NAMES', RIVAL_9_NAMES],
    ['RIVAL_9_MOVES', RIVAL_9_MOVES],
  ]) {
    const covered = new Set(Object.keys(table));
    if (!setEq(rollable, covered)) {
      flag(`${label} covers ${fmtSet(covered)}, but RIVAL_9_TYPES rolls ${fmtSet(rollable)}`);
    }
  }
  for (const type of RIVAL_9_TYPES) {
    const moveId = RIVAL_9_MOVES[type];
    if (!moveId) continue; // covered by the coverage check just above
    const move = MOVES[moveId];
    if (!move) {
      flag(`RIVAL_9_MOVES['${type}']: move id '${moveId}' doesn't exist in MOVES`);
      continue;
    }
    if (!(MOVE_COMPATIBILITY[type] ?? []).includes(move.class)) {
      flag(
        `RIVAL_9_MOVES['${type}'] is '${move.name}', whose class '${move.class}' that type cannot host ` +
          `(World 9's rival rolls into it as '${RIVAL_9_NAMES[type] ?? type}')`
      );
    }
    if (GOLEM_MOVE_IDS.includes(moveId)) {
      flag(
        `RIVAL_9_MOVES['${type}'] is the decohered move '${moveId}' -- World 9's rival is the one ` +
          `rival the Decoherence took nothing from, so it carries pristine excitations (WORLDS.md section 6)`
      );
    }
  }
}

// 7. The golems' decohered moves are opponent-only: no shop sells them and no
// wild crystal carries one. The mirror of the player-only Analytic/Ultimate
// moves, and the same kind of leak (a boss-only move reachable by the player,
// or a golem move handed to a wild) would be silent otherwise.
{
  const golemOnly = new Set(GOLEM_MOVE_IDS);
  for (const id of SHOP_MOVE_IDS) {
    if (golemOnly.has(id)) flag(`SHOP_MOVE_IDS offers golem-only move '${id}'`);
  }
  for (const [world, entries] of Object.entries(WORLD_CRYSTALS)) {
    for (const c of entries) {
      for (const moveId of c.moves ?? []) {
        if (golemOnly.has(moveId)) flag(`WORLD_CRYSTALS[${world}] '${c.name}' carries golem-only move '${moveId}'`);
      }
    }
  }
}

// 8. No two moves share a display name -- this project has shipped exactly
// this bug before (a "Beam"/"Beam" collision), and it's otherwise invisible
// until two colliding moves happen to appear on screen together.
{
  const byName = new Map();
  for (const move of Object.values(MOVES)) {
    const existing = byName.get(move.name);
    if (existing) flag(`Move name collision: '${move.name}' used by both '${existing}' and '${move.id}'`);
    else byName.set(move.name, move.id);
  }
}

// 7 & 8. Every crystal/rival's type must be real, and every move id it
// carries must resolve to a real MOVES entry -- a typo'd id here would
// silently make that move unusable (or, for a rival, unattackable-with)
// without throwing anywhere.
{
  const moveIds = new Set(Object.keys(MOVES));
  const checkCrystal = (label, c) => {
    if (!MATERIAL_TYPES.has(c.type)) flag(`${label}: unknown MaterialType '${c.type}'`);
    for (const m of c.moves) {
      if (!moveIds.has(m)) flag(`${label}: move id '${m}' doesn't exist in MOVES`);
    }
  };
  for (const [world, crystals] of Object.entries(WORLD_CRYSTALS)) {
    crystals.forEach((c) => checkCrystal(`WORLD_CRYSTALS[${world}] '${c.name}'`, c));
  }
  for (const [world, rival] of Object.entries(WORLD_RIVALS)) {
    if (!rival) continue; // World 10's rival has no fixed crystal() of its own, see WORLD_RIVALS construction above
    checkCrystal(`WORLD_RIVALS[${world}] '${rival.name}'`, rival);
  }
}

// 9. WORLD_NAMES must cover every built world 1-10 -- CODEMAP.md's own
// warning: "a mismatched rival name is easy to miss if only one table is
// updated," the same risk applies to a world missing its name entirely.
{
  const namedWorlds = new Set(Object.keys(WORLD_NAMES));
  const missing = BUILT_WORLDS.filter((w) => !namedWorlds.has(w));
  if (missing.length) flag(`WORLD_NAMES is missing world(s): ${fmtSet(new Set(missing))}`);
}

// 10. WORLD_RIVALS must cover every built world except World 9 (whose rival
// is rolled at random every visit, data/materials.ts's rollRival9Type/
// RIVAL_9_TYPES, not a fixed table row -- see DESIGN.md §2).
{
  const rivalWorlds = new Set(Object.keys(WORLD_RIVALS));
  const expected = new Set(BUILT_WORLDS.filter((w) => w !== '9'));
  const missing = [...expected].filter((w) => !rivalWorlds.has(w));
  const unexpected = [...rivalWorlds].filter((w) => !expected.has(w));
  if (missing.length) flag(`WORLD_RIVALS is missing world(s): ${fmtSet(new Set(missing))}`);
  if (unexpected.length) flag(`WORLD_RIVALS has (an) unexpected world(s) (World 9's rival should be rolled, not fixed): ${fmtSet(new Set(unexpected))}`);
}

// 11. WORLD_GUARDIANS must cover every built world with a unique id -- a
// missing entry means that world's mid-corridor chokepoint has no guardian
// to stand on it.
{
  const guardianWorlds = new Set(Object.keys(WORLD_GUARDIANS_RAW));
  const missing = BUILT_WORLDS.filter((w) => !guardianWorlds.has(w));
  if (missing.length) flag(`WORLD_GUARDIANS is missing world(s): ${fmtSet(new Set(missing))}`);
  const idsSeen = new Map();
  for (const [world, g] of Object.entries(WORLD_GUARDIANS_RAW)) {
    const prevWorld = idsSeen.get(g.id);
    if (prevWorld) flag(`Guardian id '${g.id}' used by both World ${prevWorld} and World ${world}`);
    else idsSeen.set(g.id, world);
  }
}

// 12. Every passive's owner must be a real guardian id (today, always
// 'franklin' -- PassiveOwner is a single-member union -- but this check
// stays meaningful the day a second passive-owning guardian is added).
{
  const guardianIds = new Set(Object.values(WORLD_GUARDIANS_RAW).map((g) => g.id));
  for (const p of Object.values(PASSIVES)) {
    if (!guardianIds.has(p.owner)) flag(`PASSIVES['${p.id}'].owner '${p.owner}' isn't a real guardian id`);
  }
}

// 13. Every hybrid recipe's parents must resolve to a real crystal (any
// world), and its result -- looked up by name via materials.ts's own
// `namedResult`/`findMaterialByName`, which already throws at module-load
// time if the name matches nothing at all -- must specifically be in
// WORLD_CRYSTALS[10], not just exist somewhere: World 10's whole wild pool
// is defined as being exactly these results and nothing else (DESIGN.md
// §5), so a name that resolves elsewhere but never made it into World 10's
// own pool would pass `namedResult`'s own guard while still being a material
// that's creatable via Majorana but can never actually spawn wild.
{
  const allCrystalNames = new Set();
  for (const crystals of Object.values(WORLD_CRYSTALS)) crystals.forEach((c) => allCrystalNames.add(c.name));
  const world10Names = new Set((WORLD_CRYSTALS['10'] ?? []).map((c) => c.name));

  for (const recipe of HYBRID_RECIPES) {
    for (const parent of recipe.parents) {
      if (!allCrystalNames.has(parent)) flag(`Hybrid recipe result '${recipe.result}': parent '${parent}' doesn't match any WORLD_CRYSTALS entry`);
    }
    if (!world10Names.has(recipe.result)) {
      flag(`Hybrid recipe result '${recipe.result}' isn't in WORLD_CRYSTALS[10] -- it's creatable via Majorana but will never spawn wild`);
    }
  }

  // The reverse direction: every WORLD_CRYSTALS[10] entry should trace back
  // to some recipe (DESIGN.md §5's "hosts exactly the game's actual named
  // hybrid-recipe results ... and nothing else").
  const recipeResultNames = new Set(HYBRID_RECIPES.map((r) => r.result));
  for (const c of WORLD_CRYSTALS['10'] ?? []) {
    if (!recipeResultNames.has(c.name)) flag(`WORLD_CRYSTALS[10] entry '${c.name}' doesn't match any HYBRID_RECIPES result`);
  }
}

// 14. Every world 1-9 needs at least one quiz question -- an empty pool
// would make getWorldQuestion(world, ...) fall through with nothing to ask
// (harmless for a specific material with its own MATERIAL_QUESTIONS pool,
// but not for the world's baseline pool going empty outright).
for (const w of BUILT_WORLDS.filter((w) => w !== '10')) {
  const pool = WORLD_QUESTIONS[w];
  if (!pool || pool.length === 0) flag(`WORLD_QUESTIONS[${w}] is empty`);
}

// 15. Formula markup in the quiz pools. Question prompts and answers mark
// their formulas with `$...$` and ui/mathtext.ts typesets what is inside
// (subscripts, superscripts, a real square root); a malformed span renders
// as literal `$` in front of a player mid-battle, which nothing else here
// would catch since the string is still a perfectly valid string. Read from
// the raw source rather than the parsed tables so every pool is covered at
// once -- WORLD_QUESTIONS, MATERIAL_QUESTIONS, and the Analytic/Ultimate/
// machine-learning pools alike.
{
  const quizText = fs.readFileSync(path.join(gameDir, 'src/data/quiz.ts'), 'utf8');
  const fieldRe = /(prompt|correct|incorrect):\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const short = (t) => (t.length > 70 ? `${t.slice(0, 70)}...` : t);
  let m;
  while ((m = fieldRe.exec(quizText)) !== null) {
    const body = m[2].slice(1, -1);
    if (!body.includes('$')) continue;
    const spans = body.split('$');
    if (spans.length % 2 === 0) {
      flag(`quiz.ts ${m[1]} has an unclosed formula span: "${short(body)}"`);
      continue;
    }
    for (let i = 1; i < spans.length; i += 2) {
      const span = spans[i];
      const where = `quiz.ts ${m[1]} formula "${short(span)}"`;
      if (span.trim() === '') flag(`${where} is empty`);
      if (/[_^]$/.test(span)) flag(`${where} ends on a script marker with nothing to raise or drop`);
      if (/√$/.test(span)) flag(`${where} ends on a root sign with nothing under it`);
      for (const [open, close] of [['(', ')'], ['{', '}'], ['[', ']']]) {
        const depth = [...span].reduce((d, c) => d + (c === open ? 1 : c === close ? -1 : 0), 0);
        if (depth !== 0) flag(`${where} has unbalanced '${open}${close}'`);
      }
    }
  }
}

// 16. The Lab's Tutorial station lists whichever topics a Story Mode save
// has actually reached, in TUTORIAL_TIPS' own declaration order (data/
// tutorial.ts's `visibleTutorialPages`), so that order has to be the order
// the game reveals them in and every topic has to be reachable at all.
// Three ways that goes wrong silently, none of which `tsc --noEmit` can
// see: a `kind: 'guardian'` topic naming a guardian who doesn't exist (the
// topic is then unreachable in Story Mode forever), those topics declared
// out of world order (the list reads out of sequence), and a `kind: 'tip'`
// topic with no contextual trigger site to fire it (also unreachable).
{
  const tutorialSf = parseFile('src/data/tutorial.ts');
  const TUTORIAL_TIPS = evalNode(findTopLevelConst(tutorialSf, 'TUTORIAL_TIPS'), tutorialSf);
  const guardianWorldById = new Map(Object.entries(WORLD_GUARDIANS_RAW).map(([world, g]) => [g.id, Number(world)]));
  const triggerSites =
    fs.readFileSync(path.join(gameDir, 'src/scenes/OverworldScene.ts'), 'utf8') +
    fs.readFileSync(path.join(gameDir, 'src/scenes/HubScene.ts'), 'utf8');

  let previousWorld = 0;
  let previousId = null;
  for (const [id, page] of Object.entries(TUTORIAL_TIPS)) {
    const unlock = page.unlock;
    if (unlock.kind === 'tip') {
      if (!triggerSites.includes(`showTutorialTip('${id}'`) && !triggerSites.includes(`TUTORIAL_TIPS.${id}`)) {
        flag(`TUTORIAL_TIPS['${id}'] is unlocked by its own contextual tip but nothing in OverworldScene/HubScene ever fires it`);
      }
      continue;
    }
    if (unlock.kind !== 'guardian') continue;
    const worlds = unlock.ids.map((guardianId) => {
      const world = guardianWorldById.get(guardianId);
      if (world === undefined) flag(`TUTORIAL_TIPS['${id}'] unlocks on guardian '${guardianId}', who isn't in WORLD_GUARDIANS`);
      return world;
    });
    const earliest = Math.min(...worlds.filter((w) => w !== undefined));
    if (!Number.isFinite(earliest)) continue;
    if (earliest < previousWorld) {
      flag(
        `TUTORIAL_TIPS['${id}'] unlocks in World ${earliest} but is declared after '${previousId}' (World ${previousWorld}) -- ` +
          `declaration order is the order the Tutorial station lists topics in, so it has to match the order the game reveals them`
      );
    }
    previousWorld = earliest;
    previousId = id;
  }
}

// 17. Orphan definite-assignment fields. A `private x!: T` declaration
// asserts to the compiler "something will assign this before any read," and
// the compiler then stops checking -- so if nothing ever does, every read is
// `undefined` with no diagnostic from `tsc --noEmit` anywhere, and the first
// method call on it throws at runtime. This project has shipped exactly that
// (a BattleScene text field declared, never assigned, read only on World
// 10's transmute path, which froze the game); a passing typecheck is
// structurally incapable of seeing it and a behavior check only sees it if
// its own route happens to reach that one read.
//
// What counts as an assignment is deliberately generous and name-only,
// matched across all of `src/` rather than within the declaring class: any
// assignment operator (`=`, `+=`, `??=`, ...) writing to a property access
// or a string-literal bracket access, `++`/`--`, a property target inside a
// destructuring assignment pattern, and a `for (obj.x of ...)` binding. Public
// `!:` fields on the scenes really are assigned from other files (panels
// under scenes/panels/ write `scene.playerMaterial`), and a same-named write
// anywhere suppressing a genuine orphan elsewhere is the failure mode worth
// having: a hit here always means something, which is the only way a check
// like this stays enabled.
{
  const srcDir = path.join(gameDir, 'src');
  const tsFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) tsFiles.push(full);
    }
  })(srcDir);

  const declared = [];
  const assigned = new Set();
  const unquote = (s) => s.replace(/^['"`]|['"`]$/g, '');

  // Records whatever field name(s) `node` writes to when it appears on the
  // left of an assignment -- recursing through destructuring patterns, whose
  // targets parse as ordinary object/array *literals* rather than binding
  // patterns when they're assignment targets rather than declarations.
  const recordTarget = (node, sf) => {
    if (ts.isParenthesizedExpression(node)) return recordTarget(node.expression, sf);
    if (ts.isPropertyAccessExpression(node)) return void assigned.add(node.name.getText(sf));
    if (ts.isElementAccessExpression(node)) {
      const arg = node.argumentExpression;
      if (arg && ts.isStringLiteralLike(arg)) assigned.add(arg.text);
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop)) recordTarget(prop.initializer, sf);
        else if (ts.isSpreadAssignment(prop)) recordTarget(prop.expression, sf);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(node)) return void node.elements.forEach((el) => recordTarget(el, sf));
    if (ts.isSpreadElement(node)) return recordTarget(node.expression, sf);
    // `[a = fallback] = xs` -- the target is the left of the default.
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) return recordTarget(node.left, sf);
  };

  for (const file of tsFiles) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isPropertyDeclaration(node) && node.exclamationToken && !node.initializer) {
        const owner = ts.isClassLike(node.parent) ? node.parent.name?.getText(sf) ?? '<anonymous class>' : '<unknown>';
        declared.push({
          file: path.relative(gameDir, file),
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          owner,
          name: unquote(node.name.getText(sf)),
        });
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        recordTarget(node.left, sf);
      }
      if (
        (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        recordTarget(node.operand, sf);
      }
      if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) {
        recordTarget(node.initializer, sf);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  definiteAssignmentFields = declared.length;
  for (const d of declared) {
    if (assigned.has(d.name)) continue;
    flag(
      `${d.file}:${d.line} ${d.owner}.${d.name} is declared with a definite-assignment '!' but nothing in src/ ever assigns it -- ` +
        `every read of it is undefined at runtime, and the '!' is exactly what stops tsc from saying so`
    );
  }
}

// --- report -----------------------------------------------------------

if (issues.length === 0) {
  console.log(
    `content-lint: clean -- ${Object.keys(MOVES).length} moves, ${MATERIAL_TYPES.size} types, ${HYBRID_RECIPES.length} hybrid recipes, ` +
      `${BUILT_WORLDS.length} worlds, ${definiteAssignmentFields} definite-assignment fields, no issues found.`
  );
  process.exit(0);
} else {
  console.log(`content-lint: ${issues.length} issue(s) found:\n`);
  issues.forEach((msg) => console.log(`  - ${msg}`));
  process.exit(1);
}
