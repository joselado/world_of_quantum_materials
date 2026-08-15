import { defineConfig } from 'vite';

// Relative asset paths, which is what lets one build run from anywhere it is
// put: a GitHub Pages project site serves the game from a sub-path
// (/world_of_quantum_materials/), a downloaded copy runs from a local folder,
// and a plain static host serves it from the root. Vite's default absolute
// base ("/assets/...") is correct for none of those but the last.
//
// Safe here specifically because the bundle has no dynamic import() in it --
// it builds to a single chunk, so there is no lazily-fetched chunk whose path
// could resolve against the wrong directory at runtime.
export default defineConfig({
  base: './',
});
