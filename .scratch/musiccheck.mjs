import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';

const CHROME_BIN = execSync(
  `find "$HOME/.cache/puppeteer/chrome" -maxdepth 2 -type d -iname 'linux-*' -exec find {} -maxdepth 2 -type f -iname chrome \\; 2>/dev/null | head -1`
).toString().trim();

const PORT = process.env.PORT || 5219;
const browser = await puppeteer.launch({
  executablePath: CHROME_BIN,
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const msgs = [];
page.on('console', (m) => {
  if (m.text().includes('music:')) msgs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));

console.log(
  msgs.length === 0
    ? 'MUSIC_CONSOLE_CLEAN (0 "music:" messages)'
    : `MUSIC ISSUES (${msgs.length}):\n${msgs.join('\n')}`
);
await browser.close();
