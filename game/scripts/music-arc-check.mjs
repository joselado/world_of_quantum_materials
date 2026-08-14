// Objective measurement of the soundtrack's per-world arc.
//
// The ten worlds are meant to darken as the player advances (dev_notes/
// WORLDS.md's light rule), and the score carries that arc. "It sounds
// darker" is not checkable by anyone who isn't listening, so this script
// turns it into numbers: it drives the real game in headless Chrome, hangs
// an AnalyserNode off the live music bus, plays all 20 scores one at a time,
// and reports a spectral/dynamic summary per score.
//
// It measures the *audio that actually comes out*, not the config that went
// in -- it never imports the score tables, so it cannot restate the intent
// it is supposed to be checking. Everything below is derived from the FFT.
//
// Usage (from game/): npm run music-arc-check
//   QM_MUSIC_STYLE=modern   measure the Modern arrangement instead
//   QM_MUSIC_CAPTURE_MS     per-score capture window (default 45000)
//   QM_MUSIC_JSON=path.json also write the raw table as JSON, for diffing a
//                           before/after pair with scripts/music-arc-diff.mjs
// CHROME_BIN auto-detects Puppeteer's cached Chrome-for-Testing binary if
// unset, same as component-check.mjs. Picks its own port so it never
// disturbs a dev server another session is already running.
//
// Reading the output: each row is one score. `centroid` (Hz) is brightness,
// `rms` loudness, `hf%` the share of energy above 4 kHz (percussion/grit
// presence), `lf%` the share below 120 Hz (low-end weight), `flat` spectral
// flatness (1 = noise-like, 0 = pure tone), `rough` a Plomp-Levelt roughness
// proxy for sensory dissonance, and `onset/s` a detected-attack rate
// standing in for note density x tempo.
//
// Known limitation, stated so nobody over-reads a small delta: the capture
// window is a fixed wall-clock duration for every score rather than an
// integer number of loops, so once-per-loop events (the battle crash and
// fanfare sting) are weighted slightly differently between scores of
// different loop lengths. That biases absolute numbers by a little; it does
// not affect the across-worlds shape these numbers exist to show.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = process.env.GAME_DIR || path.resolve(__dirname, '..');
const PORT = process.env.QM_MUSIC_PORT || '5188';
const URL = process.env.QM_URL || `http://localhost:${PORT}/`;
const STYLE = process.env.QM_MUSIC_STYLE === 'modern' ? 'modern' : 'classic';
const CAPTURE_MS = Number(process.env.QM_MUSIC_CAPTURE_MS || 45000);
const JSON_OUT = process.env.QM_MUSIC_JSON || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectChromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const out = execSync(
    `find "$HOME/.cache/puppeteer/chrome" -maxdepth 2 -type d -iname 'linux-*' -exec find {} -maxdepth 2 -type f -iname chrome \\; 2>/dev/null | head -1`,
    { shell: '/bin/bash' }
  )
    .toString()
    .trim();
  if (!out) throw new Error('CHROME_BIN not set and auto-detection failed -- set CHROME_BIN explicitly.');
  return out;
}

async function isServerUp() {
  try {
    const res = await fetch(URL, { method: 'GET' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function ensureDevServer(log) {
  if (await isServerUp()) {
    log(`Dev server already up on ${URL} -- reusing it.`);
    return { started: false, child: null };
  }
  log(`Starting a dev server on port ${PORT}...`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], {
    cwd: GAME_DIR,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 40000) {
    if (await isServerUp()) {
      log('Dev server is up.');
      return { started: true, child };
    }
    await sleep(400);
  }
  throw new Error(`Dev server did not come up on port ${PORT} within 40s.`);
}

function teardownDevServer(handle, log) {
  if (!handle.started || !handle.child) return;
  try {
    process.kill(-handle.child.pid, 'SIGTERM');
    log('Tore down the dev server we started.');
  } catch (e) {
    log(`  (teardown failed, may need manual cleanup: ${e.message || e})`);
  }
}

// --- The in-page measurement -------------------------------------------
//
// Runs inside the browser against the game's own MusicEngine singleton.
// getSfxBus() hands back the live master GainNode; fanning an AnalyserNode
// off it is non-destructive, so the game plays exactly as it normally would
// while we watch.
//
// Exactly one score per page load, which is the whole reason main() reloads
// between keys. play() schedules a full loop of oscillators up front, and
// stop() only ramps their shared gain to zero -- every node stays alive and
// costing CPU until its own stop time, up to a loop later. Measuring several
// scores in one page therefore piles up hundreds of inaudible-but-running
// oscillators, the audio thread starts glitching, and the added noise reads
// as a steady rise in brightness and spectral flatness with position in the
// run -- an artifact that looks exactly like the darkening arc this script
// exists to measure. A fresh context per score removes it.
async function measureInPage(page, key, captureMs, style) {
  return page.evaluate(
    async (key, captureMs, style) => {
      const mod = await import('/src/audio/music.ts');
      const music = mod.music;
      const { ctx, dest } = music.getSfxBus();
      await ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      dest.connect(analyser);

      const bins = analyser.frequencyBinCount;
      const binHz = ctx.sampleRate / analyser.fftSize;
      const freq = new Float32Array(bins);
      const time = new Float32Array(analyser.fftSize);
      const mag = new Float32Array(bins);
      const prevMag = new Float32Array(bins);

      music.setStyle(style);

      const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

      {
        // stop() first: play() is a no-op when the requested key is already
        // current (the title screen boots playing overworld:1).
        music.stop();
        await sleepMs(250);
        music.play(key);
        await sleepMs(1200); // let the 150ms crossfade and first bar settle

        let frames = 0;
        let rmsSum = 0;
        let centroidSum = 0;
        let hfSum = 0;
        let lfSum = 0;
        let flatSum = 0;
        let roughSum = 0;
        const flux = [];
        prevMag.fill(0);

        const until = performance.now() + captureMs;
        while (performance.now() < until) {
          analyser.getFloatTimeDomainData(time);
          analyser.getFloatFrequencyData(freq);

          let sq = 0;
          for (let i = 0; i < time.length; i++) sq += time[i] * time[i];
          const rms = Math.sqrt(sq / time.length);

          // dB -> linear magnitude. -Infinity bins (silence) clamp to 0.
          let total = 0;
          for (let i = 0; i < bins; i++) {
            const v = freq[i] <= -140 ? 0 : Math.pow(10, freq[i] / 20);
            mag[i] = v;
            total += v;
          }

          if (total > 1e-9) {
            let weighted = 0;
            let hf = 0;
            let lf = 0;
            let logSum = 0;
            for (let i = 0; i < bins; i++) {
              const f = i * binHz;
              weighted += f * mag[i];
              if (f >= 4000) hf += mag[i];
              if (f <= 120) lf += mag[i];
              logSum += Math.log(mag[i] + 1e-12);
            }
            centroidSum += weighted / total;
            hfSum += hf / total;
            lfSum += lf / total;
            // Spectral flatness: geometric mean / arithmetic mean.
            flatSum += Math.exp(logSum / bins) / (total / bins);

            // Plomp-Levelt roughness proxy: every pair of bins close enough
            // in frequency to beat against each other contributes
            // energy x a dissonance curve peaking near a quarter of a
            // critical bandwidth. Summed over a +/-25-bin neighbourhood
            // (~540 Hz), which covers the registers carrying most of the
            // energy here, and normalised by total energy so it measures
            // dissonance rather than loudness.
            let rough = 0;
            for (let i = 1; i < bins; i++) {
              const mi = mag[i];
              if (mi < total * 1e-4) continue;
              const fi = i * binHz;
              const end = Math.min(bins, i + 26);
              for (let j = i + 1; j < end; j++) {
                const mj = mag[j];
                if (mj < total * 1e-4) continue;
                const df = (j - i) * binHz;
                const x = df / (0.021 * fi + 19);
                rough += mi * mj * (Math.exp(-3.5 * x) - Math.exp(-5.75 * x));
              }
            }
            roughSum += rough / (total * total);

            let fl = 0;
            for (let i = 0; i < bins; i++) {
              const d = mag[i] - prevMag[i];
              if (d > 0) fl += d;
              prevMag[i] = mag[i];
            }
            flux.push(fl / total);
          }

          rmsSum += rms;
          frames++;
          await sleepMs(40);
        }

        // Onset rate: flux peaks above mean + 1 sd, with a one-frame
        // refractory so a single attack isn't counted twice.
        let onsets = 0;
        if (flux.length > 4) {
          const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
          const sd = Math.sqrt(flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length);
          const thr = mean + sd;
          for (let i = 1; i < flux.length; i++) {
            if (flux[i] > thr && flux[i] >= flux[i - 1] && (i < 2 || flux[i - 1] <= thr)) onsets++;
          }
        }

        const n = Math.max(1, frames);
        music.stop();
        return {
          key,
          frames,
          rms: rmsSum / n,
          centroid: centroidSum / n,
          hf: hfSum / n,
          lf: lfSum / n,
          flatness: flatSum / n,
          roughness: roughSum / n,
          onsetsPerSec: onsets / (captureMs / 1000),
        };
      }
    },
    key,
    captureMs,
    style
  );
}

function fmtTable(rows) {
  const head = ['score', 'rms', 'centroid', 'hf%', 'lf%', 'flat', 'rough', 'onset/s'];
  const body = rows.map((r) => [
    r.key,
    r.rms.toFixed(5),
    r.centroid.toFixed(0),
    (r.hf * 100).toFixed(2),
    (r.lf * 100).toFixed(2),
    r.flatness.toFixed(4),
    r.roughness.toFixed(5),
    r.onsetsPerSec.toFixed(2),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const pad = (cells) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
  return [pad(head), pad(widths.map((w) => '-'.repeat(w))), ...body.map(pad)].join('\n');
}

async function main() {
  const logLines = [];
  const log = (msg) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(line);
    logLines.push(line);
  };

  const CHROME_BIN = detectChromeBin();
  const serverHandle = await ensureDevServer(log);

  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    // no-user-gesture-required is load-bearing: without it Chrome leaves the
    // AudioContext suspended in headless and every capture reads silence.
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
    headless: true,
  });

  let failures = 0;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 854, height: 480 });

    const consoleErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      // A score whose track note-lengths don't sum to its loopBeats is
      // reported here by music.ts's own module-load assertion -- the one
      // class of scoring bug that typechecks clean, so this script is also
      // where it gets caught.
      if (text.startsWith('music:')) consoleErrors.push(text);
      else if (msg.type() === 'error' && !text.includes('favicon.ico') && !text.startsWith('Failed to load resource:')) {
        consoleErrors.push(text);
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    const keys = [];
    for (let w = 1; w <= 10; w++) keys.push(`overworld:${w}`);
    for (let w = 1; w <= 10; w++) keys.push(`battle:${w}`);

    const totalMin = ((keys.length * (CAPTURE_MS + 5000)) / 60000).toFixed(1);
    log(`Measuring ${keys.length} ${STYLE} scores at ${CAPTURE_MS}ms each (~${totalMin} min)...`);

    const rows = [];
    for (const key of keys) {
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('canvas', { timeout: 20000 });
      await sleep(1500);
      const row = await measureInPage(page, key, CAPTURE_MS, STYLE);
      log(`  ${key.padEnd(13)} rms=${row.rms.toFixed(5)} centroid=${row.centroid.toFixed(0)}Hz`);
      rows.push(row);
    }

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 20000 });
    await sleep(1500);

    const silent = rows.filter((r) => r.rms < 1e-5);
    if (silent.length) {
      log(`FAIL: ${silent.length} score(s) captured as silence -- the AudioContext never ran.`);
      log(`      ${silent.map((r) => r.key).join(', ')}`);
      failures++;
    }

    log('');
    log(`--- ${STYLE} arrangement ---`);
    console.log(fmtTable(rows));
    log('');

    // The style toggle must keep working: switching mid-session has to keep
    // producing audio rather than dropping into silence.
    const toggle = await page.evaluate(async () => {
      const { music } = await import('/src/audio/music.ts');
      const { ctx, dest } = music.getSfxBus();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      dest.connect(an);
      const buf = new Float32Array(an.fftSize);
      const rmsNow = async () => {
        await new Promise((r) => setTimeout(r, 1500));
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        return Math.sqrt(s / buf.length);
      };
      music.setStyle('classic');
      music.stop();
      music.play('overworld:7');
      const classic = await rmsNow();
      music.setStyle('modern');
      const modern = await rmsNow();
      music.setStyle('classic');
      const back = await rmsNow();
      music.stop();
      return { classic, modern, back };
    });
    const toggleOk = toggle.classic > 1e-5 && toggle.modern > 1e-5 && toggle.back > 1e-5;
    log(
      `Style toggle on a live track: classic rms=${toggle.classic.toFixed(5)} -> modern ${toggle.modern.toFixed(5)} -> classic ${toggle.back.toFixed(5)} :: ${toggleOk ? 'OK' : 'FAIL'}`
    );
    if (!toggleOk) failures++;

    if (consoleErrors.length) {
      log(`FAIL: ${consoleErrors.length} console error(s):`);
      for (const e of [...new Set(consoleErrors)]) log(`  ${e}`);
      failures++;
    } else {
      log('No console errors (includes music.ts\'s own loopBeats assertion).');
    }

    if (JSON_OUT) {
      fs.writeFileSync(JSON_OUT, JSON.stringify({ style: STYLE, captureMs: CAPTURE_MS, rows }, null, 2));
      log(`Wrote ${JSON_OUT}`);
    }
  } finally {
    await browser.close();
    teardownDevServer(serverHandle, log);
  }

  console.log(failures === 0 ? '\nmusic-arc-check: PASS' : `\nmusic-arc-check: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
