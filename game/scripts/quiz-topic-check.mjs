// Checks that every wild-encounter quiz question is asking about its own
// world's course topic.
//
// CLAUDE.md's "Quiz questions in short" rule: a world-N wild encounter
// (N = 1..9) may only ask about the topics session N teaches. The failure this
// catches is drift, not typos -- a question about superexchange or the Stoner
// criterion sitting in World 1's pool reads perfectly well and typechecks
// perfectly, it is just being asked in the wrong world, and nothing else in
// the toolchain can see that.
//
// Ground truth is the SHORT notes, `lecture_notes/tex/sessions/sessionNN.tex`
// -- what the course actually delivers. `tex_extended/` is a longer companion
// that carries material beyond the session itself and deliberately is not read
// here: scoring against it would widen every session's scope past what the
// course teaches, which is the exact drift this script exists to catch.
//
// `lecture_notes/` is a local-only symlink (CLAUDE.md's "Course-content
// cross-reference"), so this script skips cleanly with exit 0 on a checkout
// that doesn't have it rather than failing a machine that was never meant to
// run it.
//
// How the scoring works: each question (prompt + both answers) is reduced to
// its distinctive words, and each word is scored against each session by
// tf-idf -- how often the session uses it, weighted by how few of the ten
// sessions use it at all. A word every session uses ("electron") contributes
// nothing; a word only one session uses ("superexchange") dominates. The
// session scoring highest is the one whose topic the question is really
// about. That being a session other than the question's own world is the
// flag.
//
// Read the output as triage, not a verdict. A question can rank its own
// session second and still be perfectly placed -- two sessions sharing
// vocabulary is normal, and a question about a compound no session names
// (GaAs, UTe2, HfO2) scores low everywhere by construction, which is allowed
// as long as the physics fits the world. The line worth acting on is a large
// margin plus a MISSING-FROM-OWN-SESSION list naming terms the world's own
// session never uses.
//
// Usage (from game/): npm run quiz-topic-check
//   QM_QUIZ_WORLD=6   check one world instead of all nine
//   QM_QUIZ_ALL=1     print every question, not just the flagged ones

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(__dirname, '..');
const REPO = path.resolve(GAME_DIR, '..');
const SESSIONS = path.join(REPO, 'lecture_notes', 'tex', 'sessions');
const ONLY_WORLD = process.env.QM_QUIZ_WORLD ? Number(process.env.QM_QUIZ_WORLD) : null;
const SHOW_ALL = !!process.env.QM_QUIZ_ALL;

if (!fs.existsSync(SESSIONS)) {
  console.log(`quiz-topic-check: ${path.relative(REPO, SESSIONS)} not present (local-only symlink) -- skipping.`);
  process.exit(0);
}

const QUIZ = fs.readFileSync(path.join(GAME_DIR, 'src', 'data', 'quiz.ts'), 'utf8');

// Words too common in either physics prose or question phrasing to say
// anything about which session a question belongs to.
const STOP = new Set(
  `which what where when this that these those with from into their there here they them then than
   your yours have been being does about would could should must will each other same
   only just also very much more most less least while because since both either neither
   before after above below over under again once first second third whole part parts thing things
   makes make made take takes taken give gives given call called calls goes going come comes
   correct incorrect answer question world crystal golem player battle move moves prompt
   actually really simply exactly always never every through across along without within between
   among against toward towards said says like unlike rather instead beyond still even ever
   such some many little large small right left down onto upon does doing done
   whether cannot itself themselves something anything nothing everything`
    .split(/\s+/)
    .filter(Boolean)
);

function terms(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zà-ÿ\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length >= 5 && !STOP.has(w))
  );
}

// Session corpora, with TeX control sequences stripped so `\section` and
// friends can't be scored as vocabulary.
const sessions = {};
for (let i = 1; i <= 10; i++) {
  const f = path.join(SESSIONS, `session${String(i).padStart(2, '0')}.tex`);
  sessions[i] = fs.readFileSync(f, 'utf8').replace(/\\[a-zA-Z]+/g, ' ').toLowerCase();
}

const dfCache = new Map();
function df(term) {
  if (!dfCache.has(term)) {
    let n = 0;
    for (let i = 1; i <= 10; i++) if (sessions[i].includes(term)) n++;
    dfCache.set(term, n);
  }
  return dfCache.get(term);
}

function countIn(sessionNo, term) {
  const hay = sessions[sessionNo];
  let n = 0;
  let idx = 0;
  while ((idx = hay.indexOf(term, idx)) !== -1) {
    n++;
    idx += term.length;
  }
  return n;
}

// Walks the WORLD_QUESTIONS object literal by line rather than executing the
// module, the same parse-don't-run approach content-lint.mjs takes to
// materials.ts -- this file is TypeScript and has no build step of its own.
function parsePools() {
  const start = QUIZ.indexOf('export const WORLD_QUESTIONS');
  const end = QUIZ.indexOf('export const MATERIAL_QUESTIONS');
  if (start === -1 || end === -1) {
    console.error('quiz-topic-check: could not find WORLD_QUESTIONS/MATERIAL_QUESTIONS in quiz.ts');
    process.exit(1);
  }
  const offset = QUIZ.slice(0, start).split('\n').length;
  const lines = QUIZ.slice(start, end).split('\n');
  const pools = {};
  let world = null;
  let cur = null;
  lines.forEach((line, i) => {
    const w = line.match(/^  (\d+): \[/);
    if (w) {
      world = Number(w[1]);
      pools[world] = [];
      return;
    }
    const p = line.match(/^\s*prompt:\s*(.*)$/);
    if (p && world) {
      cur = { world, text: p[1], lineNo: offset + i };
      pools[world].push(cur);
      return;
    }
    if (cur && /^\s*(correct|incorrect):/.test(line)) cur.text += ' ' + line.replace(/^\s*\w+:\s*/, '');
    if (/^\s*\},\s*$/.test(line)) cur = null;
  });
  return pools;
}

const pools = parsePools();
const flagged = [];
let checked = 0;

for (let world = 1; world <= 9; world++) {
  if (ONLY_WORLD && world !== ONLY_WORLD) continue;
  const qs = pools[world] || [];
  checked += qs.length;
  const lines = [];
  qs.forEach((q) => {
    const ts = [...terms(q.text)];
    const scores = {};
    for (let s = 1; s <= 10; s++) {
      let total = 0;
      for (const t of ts) {
        const d = df(t);
        if (d === 0 || d === 10) continue;
        const c = countIn(s, t);
        if (c) total += Math.log(1 + c) * Math.log(10 / d);
      }
      scores[s] = total;
    }
    const ranked = Object.entries(scores)
      .map(([s, v]) => [Number(s), v])
      .sort((a, b) => b[1] - a[1]);
    const ownRank = ranked.findIndex(([s]) => s === world) + 1;
    // Distinctive terms this question uses that its own session never uses,
    // annotated with the sessions that do -- the concrete evidence behind a
    // flag, and the part worth reading before acting on one.
    const missing = ts
      .filter((t) => df(t) > 0 && df(t) <= 3 && !sessions[world].includes(t))
      .map((t) => {
        const homes = [];
        for (let s = 1; s <= 10; s++) if (sessions[s].includes(t)) homes.push(s);
        return `${t} (session ${homes.join('/')})`;
      });
    if (ownRank === 1 && !SHOW_ALL) return;
    const mark = ownRank === 1 ? '    ok' : ownRank === 2 ? '  near' : '  DRIFT';
    lines.push(
      `${mark}  quiz.ts:${q.lineNo}  own session ${world} ranks ${ownRank} (${scores[world].toFixed(1)}) | top ${ranked
        .slice(0, 3)
        .map(([s, v]) => `s${s}:${v.toFixed(1)}`)
        .join(' ')}`
    );
    lines.push(`        ${q.text.slice(0, 140)}`);
    if (missing.length) lines.push(`        not in session ${world}: ${missing.join(', ')}`);
    if (ownRank > 1) flagged.push({ world, lineNo: q.lineNo, ownRank, best: ranked[0][0] });
  });
  if (lines.length) {
    console.log(`\n===== World ${world} (session ${world}, ${qs.length} questions) =====`);
    console.log(lines.join('\n'));
  }
}

console.log(
  `\n${flagged.length} of ${checked} questions do not rank their own session first (${
    flagged.filter((f) => f.ownRank > 2).length
  } beyond second place).`
);
console.log('Triage, not a verdict -- read the evidence line before moving anything (see this file\'s header).');
