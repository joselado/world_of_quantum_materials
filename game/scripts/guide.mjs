// Builds `guide.pdf`, the player's guide, out of the docs that already exist.
//
// The guide is not a separate document with its own copy of the facts -- it is
// `README.md` and everything in `docs/` assembled and typeset. That matters
// because half of those files are themselves generated: the move, crystal and
// hybrid tables come out of `materials.ts`/`passives.ts` via `npm run docs`, and
// every screenshot comes out of the running game via `npm run shots`. Building
// the guide from them means a move's power cannot be right in the game and
// wrong in the guide. Nothing here is hand-maintained prose, so nothing here
// can drift.
//
// Usage (from game/): npm run guide
// The full refresh, in order:  npm run docs && npm run shots && npm run guide
//
// Needs pandoc and a LaTeX engine (xelatex) on PATH. Both are assumed rather
// than installed; if either is missing this says so and stops.
//
// The guide keeps the storyline chapter, spoilers and all, and it repeats
// itself: README summarises what the reference chapters then explain in full.
// That is deliberate -- the guide is meant to hold the same information the
// docs hold, in one artifact a player can read front to back.
//
// Two markdown-to-PDF hazards this handles, both of which silently drop content
// rather than failing:
//   - The docs lay images out with raw `<img>` tags, and README wraps some in
//     `<table>` grids. Pandoc drops raw HTML when targeting LaTeX, so every
//     image would vanish from the PDF without the rewriting below.
//   - Image paths differ by source (README says `screenshots/x.png`, docs say
//     `../screenshots/x.png`), so both are resolved against the repo root.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(GAME_DIR, '..');
const OUT_PDF = path.join(REPO_DIR, 'guide.pdf');

// Reading order: what the game is, then the road through it, then the
// reference chapters a player looks things up in.
const SOURCES = [
  { file: 'README.md', title: 'The Game' },
  { file: 'docs/storyline.md', title: 'The Ten Worlds' },
  { file: 'docs/quasiparticles.md', title: 'Quasiparticles and Moves' },
  { file: 'docs/crystals.md', title: 'Crystals' },
  { file: 'docs/hybrids.md', title: 'Hybrid Materials' },
  { file: 'docs/guardians.md', title: 'Guardians' },
];

const TITLE = 'World of Quantum Materials';
const SUBTITLE = "A player's guide";

function need(binary) {
  try {
    execSync(`command -v ${binary}`, { shell: '/bin/bash', stdio: 'ignore' });
  } catch (e) {
    throw new Error(`${binary} is not on PATH -- the guide needs pandoc and xelatex to build.`);
  }
}

// Raw HTML that pandoc would drop, turned into markdown it keeps. The width
// attribute is carried across so the images stay the size the docs chose for
// them rather than filling the text column.
function htmlImagesToMarkdown(md) {
  return (
    md
      // <img src="X" width="N" alt="A"> in any attribute order.
      .replace(/<img\s+[^>]*>/g, (tag) => {
        const src = /src="([^"]+)"/.exec(tag)?.[1];
        if (!src) return '';
        const alt = /alt="([^"]*)"/.exec(tag)?.[1] ?? '';
        const width = /width="?(\d+)"?/.exec(tag)?.[1];
        const size = width ? `{width=${Math.min(Number(width), 460)}px}` : '';
        return `\n\n![${alt}](${src})${size}\n\n`;
      })
      // The grid wrappers README uses to pair screenshots. Their cells become
      // ordinary block content, one image after another.
      .replace(/<\/?(table|thead|tbody|tr|td|th)[^>]*>/g, '\n')
      .replace(/<\/?(p|div|span|br)[^>]*>/g, '\n')
  );
}

// Every image path resolved against the repo root, whichever file it came from.
function resolveImagePaths(md, sourceFile) {
  const dir = path.dirname(path.join(REPO_DIR, sourceFile));
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (whole, alt, src) => {
    if (/^https?:/.test(src)) return whole;
    const abs = path.resolve(dir, src);
    return `![${alt}](${abs})`;
  });
}

// A heading inside a blockquote -- the spoiler callouts use one -- becomes a
// sectioning command inside a quote environment, which LaTeX will not typeset.
// The callout keeps its emphasis as bold instead of a heading, and stays a
// quote.
function unheadBlockquotes(md) {
  return md.replace(/^(>\s*)#{1,6}\s+(.*)$/gm, '$1**$2**');
}

// Symbols the docs use for emphasis on screen that no print font here carries.
// Dropping them silently would leave a gap mid-sentence, so they are spelled.
const UNPRINTABLE = [[/\u26A0\uFE0F?\s*/g, '']];

function spellSymbols(md) {
  return UNPRINTABLE.reduce((acc, [re, text]) => acc.replace(re, text), md);
}

// Links between the docs ("see docs/crystals.md") mean nothing in a single
// PDF that already contains those chapters, so they are flattened to their
// own text rather than left as dead paths.
function flattenInternalLinks(md) {
  return md.replace(/\[([^\]]+)\]\((?!https?:)[^)]*\.md[^)]*\)/g, '$1');
}

// Each source becomes one chapter: its own `#` title is replaced by the
// chapter name, and everything below it drops a level so the hierarchy is
// chapter > section > subsection rather than every file starting at the top.
function asChapter(md, title) {
  const body = md
    .split('\n')
    .filter((line) => !/^#\s+/.test(line))
    .map((line) => (/^#{2,5}\s/.test(line) ? '#' + line : line))
    .join('\n');
  return `\n\n\\newpage\n\n# ${title}\n\n${body}\n`;
}

function main() {
  need('pandoc');
  need('xelatex');

  const parts = [];
  for (const { file, title } of SOURCES) {
    const full = path.join(REPO_DIR, file);
    if (!fs.existsSync(full)) {
      console.log(`  (skipping ${file} -- not found)`);
      continue;
    }
    let md = fs.readFileSync(full, 'utf8');
    md = htmlImagesToMarkdown(md);
    md = resolveImagePaths(md, file);
    md = flattenInternalLinks(md);
    md = unheadBlockquotes(md);
    md = spellSymbols(md);
    parts.push(asChapter(md, title));
    console.log(`  + ${file}`);
  }

  const assembled = path.join(GAME_DIR, '.check-artifacts', 'guide.md');
  fs.mkdirSync(path.dirname(assembled), { recursive: true });
  fs.writeFileSync(assembled, parts.join('\n'));

  const args = [
    assembled,
    '-o',
    OUT_PDF,
    '--pdf-engine=xelatex',
    '--toc',
    '--toc-depth=2',
    '-V',
    `title=${TITLE}`,
    '-V',
    `subtitle=${SUBTITLE}`,
    '-V',
    'geometry:margin=2.4cm',
    '-V',
    'documentclass=report',
    '-V',
    'colorlinks=true',
    '-V',
    'linkcolor=RoyalBlue',
    '-V',
    'toccolor=black',
    // The game's text is full of physics notation -- subscripts, Greek, hbar --
    // and the default Latin Modern has holes in it. A font with real coverage
    // is what keeps those from coming out as blanks.
    '-V',
    'mainfont=DejaVu Serif',
    '-V',
    'monofont=DejaVu Sans Mono',
    '-V',
    'linestretch=1.05',
  ];

  console.log('  running pandoc...');
  execFileSync('pandoc', args, { cwd: REPO_DIR, stdio: 'inherit' });

  const kb = (fs.statSync(OUT_PDF).size / 1024).toFixed(0);
  console.log(`guide: wrote ${path.relative(REPO_DIR, OUT_PDF)} (${kb} kB)`);
}

main();
