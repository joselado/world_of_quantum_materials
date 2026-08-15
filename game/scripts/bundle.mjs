// Builds the whole game into one self-contained `game.html` -- the copy a
// player can save to their machine and open by double-clicking it, with no
// server, no Node and no network.
//
// Why this needs its own build rather than a copy of `npm run build`'s output:
// a browser refuses to load a *module* script over `file://` (CORS blocks it,
// origin "null"), and Vite emits exactly that. So this build asks rollup for a
// single classic IIFE chunk instead, and then inlines it into the HTML, which
// leaves a page that fetches nothing at all. The game is only bundleable this
// way because it has no asset files to fetch either: every sprite, tile and
// note is drawn or synthesized at runtime (art/, audio/), so "the whole game"
// really is one script.
//
// Written into `dist/` alongside the ordinary build, so the deploy publishes
// the playable site and the downloadable file together from one artifact.
// Run via `npm run bundle` (from game/), or `npm run build && npm run bundle`
// for both at once.

import { build } from 'vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(gameDir, 'dist');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wqm-bundle-'));

await build({
  root: gameDir,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: tmpDir,
    emptyOutDir: true,
    // Everything in the page, nothing beside it: no separate CSS file, and no
    // asset small enough to be left on disk rather than inlined.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'game.js' },
    },
  },
});

const html = fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(tmpDir, 'game.js'), 'utf8');

// The whole tag is replaced, not just its src: Vite writes it as
// `<script type="module" crossorigin src="./game.js">`, and both of those
// attributes are wrong for an inlined classic script.
//
// Replaced through a *function*, which is load-bearing rather than style:
// String.replace expands `$&`, `` $` `` and `$'` inside a replacement string,
// and minified JavaScript is full of `$`. Passing the code as a plain string
// silently corrupts the bundle -- it produces a file that looks right and
// throws at parse time.
const escaped = js.replace(/<\/script>/gi, '<\\/script>');
const inlined = html.replace(/<script[^>]*src="[^"]*game\.js"[^>]*><\/script>/, () => `<script>${escaped}</script>`);

if (inlined.includes('game.js')) {
  console.error('bundle: the script tag was not replaced -- the built HTML still references game.js.');
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
const outFile = path.join(distDir, 'game.html');
fs.writeFileSync(outFile, inlined);
fs.rmSync(tmpDir, { recursive: true, force: true });

const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`bundle: wrote ${path.relative(gameDir, outFile)} (${mb} MB, self-contained -- open it in a browser with no server)`);
