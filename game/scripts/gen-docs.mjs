// Regenerates the generated-table sections of the top-level docs/*.md files
// from the actual game data (src/data/materials.ts, src/data/passives.ts) --
// so a table of moves/crystals/hybrids/passives is never hand-copied out of
// sync with the code that actually defines it. Parses those files with the
// TypeScript compiler API rather than importing them, since materials.ts
// pulls in Phaser (art/colors.ts) at module scope, which needs browser
// globals (`navigator`, `window`) Node doesn't have -- static AST literals
// are all this needs anyway.
//
// Each docs/*.md file owns its own hand-written prose plus one or more
// `<!-- GENERATED:<name> START -->` / `<!-- GENERATED:<name> END -->`
// marker pairs; this script only ever replaces the text between a matching
// pair, so prose around the tables survives untouched. Run via `npm run
// docs` (or `node scripts/gen-docs.mjs` directly) after any change to
// MOVES/WORLD_CRYSTALS/WORLD_RIVALS/HYBRID_RECIPES/MOVE_COMPATIBILITY/
// PASSIVES -- CLAUDE.md asks for this to be re-run whenever one of those
// changes.

import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(gameDir, '..');
const docsDir = path.join(repoRoot, 'docs');

function parseFile(relPath) {
  const filePath = path.join(gameDir, relPath);
  const text = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return sf;
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

// Reduces a literal AST node to a plain JS value -- string/number/bool
// literals, array/object literals recursively, and calls/`new` expressions
// as a tagged {__call|__new, args} shape (this file never needs to *run*
// crystal()/namedResult(), just read the literal arguments passed to them).
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
  // `crystal()`'s optional trailing params (variantOverride, shortName) are
  // sometimes skipped positionally via an explicit `undefined` literal
  // rather than omitted -- read as plain JS `undefined`, same as omitting
  // the argument entirely would.
  if (ts.isIdentifier(node) && node.text === 'undefined') return undefined;
  throw new Error(`gen-docs: don't know how to read a ${ts.SyntaxKind[node.kind]} node: ${node.getText(sf)}`);
}

// No `maxHp` here -- crystal() takes no HP argument at all (no Material
// carries intrinsic HP; both an ordinary wild's and a rival's max HP are
// computed live from the current world by BattleScene, data/balance.ts's
// wildHpForWorld/rivalHpForWorld).
function crystalFromCall(call) {
  const [name, type, moves, hueStep, variant] = call.args;
  return { name, type, moves, hueStep: hueStep ?? 0, variant };
}

// --- materials.ts -----------------------------------------------------

const materialsSf = parseFile('src/data/materials.ts');

const MOVES = evalNode(findTopLevelConst(materialsSf, 'MOVES'), materialsSf);
const ANALYTIC_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'ANALYTIC_MOVE_IDS'), materialsSf);
const ULTIMATE_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'ULTIMATE_MOVE_IDS'), materialsSf);
const GOLEM_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'GOLEM_MOVE_IDS'), materialsSf);

const WORLD_CRYSTALS_RAW = evalNode(findTopLevelConst(materialsSf, 'WORLD_CRYSTALS'), materialsSf);
const WORLD_CRYSTALS = Object.fromEntries(
  Object.entries(WORLD_CRYSTALS_RAW).map(([world, calls]) => [world, calls.map(crystalFromCall)])
);

const WORLD_RIVALS_RAW = evalNode(findTopLevelConst(materialsSf, 'WORLD_RIVALS'), materialsSf);
const WORLD_RIVALS = Object.fromEntries(
  Object.entries(WORLD_RIVALS_RAW)
    // World 10's rival ("The Adapted") has no fixed type -- its `type` field
    // in the source is only a placeholder for the pre-battle overworld/
    // dialogue preview (BattleScene decides its type live, see that file's
    // own comment), so it's excluded here the same way World 9's rival
    // already is by having no WORLD_RIVALS entry at all (see docs/crystals.md's
    // own prose). It's also not a `crystal(...)` call like every other entry
    // here (a plain object literal instead, since its look isn't derived
    // from any real type), so it wouldn't survive crystalFromCall() below
    // anyway.
    .filter(([world]) => world !== '10')
    .map(([world, call]) => [world, crystalFromCall(call)])
);

const HYBRID_RECIPES_RAW = evalNode(findTopLevelConst(materialsSf, 'HYBRID_RECIPES'), materialsSf);
const HYBRID_RECIPES = HYBRID_RECIPES_RAW.map((r) => ({ parents: r.parents, result: r.result.args[0] }));

const MOVE_COMPATIBILITY = evalNode(findTopLevelConst(materialsSf, 'MOVE_COMPATIBILITY'), materialsSf);
const QUASIPARTICLE_NAMES = evalNode(findTopLevelConst(materialsSf, 'QUASIPARTICLE_NAMES'), materialsSf);
const MATERIAL_TYPE_NAMES = evalNode(findTopLevelConst(materialsSf, 'MATERIAL_TYPE_NAMES'), materialsSf);

// Player-facing labels, never a raw camelCase identifier -- same maps
// materials.ts's own quasiparticleLabel()/materialTypeLabel() read from at
// runtime, so a docs table and the in-game UI always agree on a name.
const classLabel = (cls) => QUASIPARTICLE_NAMES[cls] ?? cls;
const typeLabel = (type) => MATERIAL_TYPE_NAMES[type] ?? type;

// --- passives.ts --------------------------------------------------------

const passivesSf = parseFile('src/data/passives.ts');
const PASSIVES = evalNode(findTopLevelConst(passivesSf, 'PASSIVES'), passivesSf);

// --- markdown builders ----------------------------------------------------

function table(headers, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

// Mirrors README.md's "The ten worlds" table -- not itself derivable from
// materials.ts (world/topic names only exist there as comments), so this is
// the one hand-maintained lookup in this script; keep the two in sync if a
// world's topic ever changes.
const WORLD_TOPICS = {
  1: 'Second quantization, mean-field, symmetry breaking',
  2: 'Symmetries, tight-binding band structure',
  3: 'Topological band theory',
  4: 'Magnetic field, quantum Hall effect, Landau levels',
  5: 'Superconductivity, Nambu representation, Majoranas',
  6: 'Classical magnetism and magnons',
  7: 'Quantum entanglement and tensor networks',
  8: 'Quantum magnetism, spinons, Kondo physics',
  9: 'Excitations and defects',
  10: 'Machine learning for quantum materials',
};

function genQuasiparticles() {
  const classToTypes = {};
  for (const [type, classes] of Object.entries(MOVE_COMPATIBILITY)) {
    for (const cls of classes) (classToTypes[cls] ??= []).push(type);
  }
  const allTypeCount = Object.keys(MOVE_COMPATIBILITY).length;
  const moveRows = Object.values(MOVES)
    // Golem moves are opponent-only, so they stay out of a table that tells a
    // player which moves they can use.
    .filter(
      (m) =>
        !ANALYTIC_MOVE_IDS.includes(m.id) &&
        !ULTIMATE_MOVE_IDS.includes(m.id) &&
        !GOLEM_MOVE_IDS.includes(m.id) &&
        m.class !== 'screening'
    )
    .sort((a, b) => a.power - b.power)
    .map((m) => {
      const types = classToTypes[m.class] ?? [];
      const typesCell = types.length === allTypeCount ? 'Every type' : types.map(typeLabel).sort().join(', ');
      return [m.name, classLabel(m.class), String(m.power), typesCell];
    });
  const movesTable = table(['Move', 'Quasiparticle', 'Power', 'Crystal types that can use it'], moveRows);

  const compatRows = Object.entries(MOVE_COMPATIBILITY)
    .map(([type, classes]) => [typeLabel(type), classes.map(classLabel).sort().join(', ')])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const compatTable = table(['Crystal type', 'Quasiparticles it can host'], compatRows);

  return { movesTable, compatTable };
}

// No Max HP column -- no Material carries intrinsic HP (data/types.ts's own
// comment on Material); both an ordinary wild's and a rival's max HP in
// battle are computed live from the current world, not per-species, so
// there's no fixed per-crystal number left to show here.
function genCrystals() {
  const worldSections = Object.entries(WORLD_CRYSTALS)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([world, crystals]) => {
      const rows = [...crystals]
        .sort((a, b) => typeLabel(a.type).localeCompare(typeLabel(b.type)) || a.name.localeCompare(b.name))
        .map((c) => [c.name, typeLabel(c.type)]);
      // Colon rather than a dash: this heading is player-facing output, and
      // player-facing text carries no dash punctuation (STYLE.md).
      return `### World ${world}: ${WORLD_TOPICS[world] ?? ''}\n\n${table(['Crystal', 'Type'], rows)}`;
    });
  const rivalRows = Object.entries(WORLD_RIVALS)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([world, c]) => [world, c.name, typeLabel(c.type)]);
  const rivalsTable = table(['World', 'Rival', 'Type'], rivalRows);
  return { worldsBlock: worldSections.join('\n\n'), rivalsTable };
}

function genHybrids() {
  const recipeRows = HYBRID_RECIPES.map((r) => [r.parents[0], r.parents[1], r.result]);
  const recipesTable = table(['Parent A', 'Parent B', 'Result'], recipeRows);
  return { recipesTable };
}

function genGuardianPassives() {
  const section = (owner, title) => {
    const rows = Object.values(PASSIVES)
      .filter((p) => p.owner === owner)
      .map((p) => [p.name, p.description, String(p.cost)]);
    return `#### ${title}\n\n${table(['Passive', 'Effect', 'Cost'], rows)}`;
  };
  return {
    franklinTable: section('franklin', "Franklin's passives"),
  };
}

// --- write into marker blocks ----------------------------------------------

function applyGenerated(relPath, replacements) {
  const filePath = path.join(docsDir, relPath);
  let text = fs.readFileSync(filePath, 'utf8');
  for (const [name, content] of Object.entries(replacements)) {
    const re = new RegExp(`<!-- GENERATED:${name} START -->\\n[\\s\\S]*?<!-- GENERATED:${name} END -->`);
    if (!re.test(text)) throw new Error(`gen-docs: no GENERATED:${name} markers found in ${relPath}`);
    text = text.replace(re, `<!-- GENERATED:${name} START -->\n${content}\n<!-- GENERATED:${name} END -->`);
  }
  fs.writeFileSync(filePath, text);
  console.log(`updated ${relPath}`);
}

const { movesTable, compatTable } = genQuasiparticles();
applyGenerated('quasiparticles.md', { MOVES_TABLE: movesTable, COMPATIBILITY_TABLE: compatTable });

const { worldsBlock, rivalsTable } = genCrystals();
applyGenerated('crystals.md', { WORLDS: worldsBlock, RIVALS_TABLE: rivalsTable });

const { recipesTable } = genHybrids();
applyGenerated('hybrids.md', { RECIPES_TABLE: recipesTable });

const { franklinTable } = genGuardianPassives();
applyGenerated('guardians.md', { FRANKLIN_PASSIVES_TABLE: franklinTable });
