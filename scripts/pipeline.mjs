// Full update pipeline — run twice a day (08:00 and 22:00 Europe/Istanbul).
//
//   1. cleanup   — drop events older than the freshness window
//   2. scrape    — pull latest from every primary + agency source
//   3. summarize — LLM writes neutral summary + impact for new events
//
// Each step is a child process so one failure doesn't abort the rest.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STEPS = [
  ['cleanup', 'cleanup.mjs'],
  ['scrape:tccb', 'scrape/tccb.mjs'],
  ['scrape:mfa', 'scrape/mfa.mjs'],
  ['scrape:tbmm', 'scrape/tbmm.mjs'],
  ['scrape:resmigazete', 'scrape/resmigazete.mjs'],
  ['scrape:afad', 'scrape/afad.mjs'],
  ['scrape:akp', 'scrape/akp.mjs'],
  ['scrape:chp', 'scrape/chp.mjs'],
  ['scrape:iyi', 'scrape/iyi.mjs'],
  ['scrape:zafer', 'scrape/zafer.mjs'],
  ['scrape:euronews', 'scrape/euronews.mjs'],
  ['scrape:sputnik', 'scrape/sputnik.mjs'],
  ['scrape:trmedia', 'scrape/trmedia.mjs'],
  ['embed', 'llm/embed.mjs'],
  ['cluster', 'llm/cluster.mjs'],
  ['summarize', 'llm/summarize.mjs'],
];

function runStep(name, file) {
  return new Promise((resolve) => {
    console.log(`\n──── ${name} ────`);
    const child = spawn(process.execPath, [join(__dirname, file)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code !== 0) console.warn(`[pipeline] ${name} exited with code ${code}`);
      resolve();
    });
  });
}

async function main() {
  const t0 = Date.now();
  console.log(`[pipeline] start ${new Date().toISOString()}`);
  for (const [name, file] of STEPS) {
    await runStep(name, file);
  }
  console.log(`\n[pipeline] done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

main();
