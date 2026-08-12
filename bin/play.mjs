#!/usr/bin/env node
// Cross-platform launcher: checks Node, installs game/ dependencies if
// needed, then starts the Vite dev server (which opens the browser itself).
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REQUIRED_NODE_MAJOR = 18;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gameDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'game');

function fail(message) {
  console.error(`world_of_quantum_materials: ${message}`);
  process.exit(1);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isNaN(nodeMajor) || nodeMajor < REQUIRED_NODE_MAJOR) {
  fail(
    `needs Node.js ${REQUIRED_NODE_MAJOR}+ (found ${process.version}). ` +
      'Install a current Node.js from https://nodejs.org and try again.'
  );
}

if (!existsSync(gameDir)) {
  fail(`expected a "game" folder next to "bin" at ${gameDir}, but it's missing.`);
}

const nodeModulesDir = path.join(gameDir, 'node_modules');
const lockFile = path.join(gameDir, 'package-lock.json');
const needsInstall =
  !existsSync(nodeModulesDir) ||
  (existsSync(lockFile) && statSync(lockFile).mtimeMs > statSync(nodeModulesDir).mtimeMs);

if (needsInstall) {
  console.log('world_of_quantum_materials: installing dependencies (first run or lockfile changed)...');
  const install = spawnSync(npmCmd, ['install'], { cwd: gameDir, stdio: 'inherit' });
  if (install.status !== 0) {
    fail('"npm install" failed -- see the output above.');
  }
}

console.log('world_of_quantum_materials: starting the dev server...');
// --open is passed only here (not baked into game/package.json's "dev"
// script) so headless tooling that runs "npm run dev" directly -- the
// run-game/verify-ui skills, CI -- doesn't get a browser-launch attempt.
const dev = spawn(npmCmd, ['run', 'dev', '--', '--open'], { cwd: gameDir, stdio: 'inherit' });
dev.on('exit', (code) => process.exit(code ?? 0));
