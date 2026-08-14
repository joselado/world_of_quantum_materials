// Static content/data-integrity lint for world_of_quantum_materials.
//
// Unlike every other script in this directory, this one checks neither
// runtime behavior (component-check.mjs/playthrough-check.mjs) nor
// difficulty (balance-sim.mjs) nor map shape (mapgen-check.mjs) -- it checks
// that the hand-authored data tables themselves are internally consistent,
// catching the class of mistake those other checks structurally can't see:
// a typo'd move id, a world missing from one table but not its sibling, a
// hybrid recipe whose result was never actually added to World 10's pool.
// This project has shipped exactly this kind of bug before (a move name
// collision, "fix Beam/Beam name collision") -- this script exists so the
// next one gets caught before a commit rather than after.
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

const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const fmtSet = (s) => `{${[...s].sort().join(', ')}}`;

// --- load data ------------------------------------------------------------

const typesSf = parseFile('src/data/types.ts');
const MATERIAL_TYPES = new Set(findTypeUnionLiterals(typesSf, 'MaterialType'));
const MOVE_CLASSES = new Set(findTypeUnionLiterals(typesSf, 'MoveClass'));

const materialsSf = parseFile('src/data/materials.ts');
const MOVES = evalNode(findTopLevelConst(materialsSf, 'MOVES'), materialsSf);
const MOVE_COMPATIBILITY = evalNode(findTopLevelConst(materialsSf, 'MOVE_COMPATIBILITY'), materialsSf);
const TYPE_LOOK = evalNode(findTopLevelConst(materialsSf, 'TYPE_LOOK'), materialsSf);
const WORLD_NAMES = evalNode(findTopLevelConst(materialsSf, 'WORLD_NAMES'), materialsSf);

// crystal(name, type, moves, shadeStep?, variantOverride?, shortName?) --
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

// 6. No two moves share a display name -- this project has shipped exactly
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

// 15. The Lab's Tutorial station lists whichever topics a Story Mode save
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

// --- report -----------------------------------------------------------

if (issues.length === 0) {
  console.log(`content-lint: clean -- ${Object.keys(MOVES).length} moves, ${MATERIAL_TYPES.size} types, ${HYBRID_RECIPES.length} hybrid recipes, ${BUILT_WORLDS.length} worlds, no issues found.`);
  process.exit(0);
} else {
  console.log(`content-lint: ${issues.length} issue(s) found:\n`);
  issues.forEach((msg) => console.log(`  - ${msg}`));
  process.exit(1);
}
