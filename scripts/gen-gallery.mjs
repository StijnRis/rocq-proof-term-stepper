// Records every gallery example by running it through the real jsCoq engine in
// headless Chromium, and writes src/data/gallery.json.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const only = process.argv[2];
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? undefined,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(`${url}gen.html`);

// Import the example list through Vite so the TypeScript source stays the single truth.
const { EXAMPLES } = await server.ssrLoadModule('/src/data/examples.ts');
const out = {};
for (const ex of EXAMPLES) {
  if (only && ex.id !== only) continue;
  const trace = await page.evaluate((s) => window.__trace(s), ex.script);
  const err = trace.steps.find((s) => s.kind === 'error');
  console.log(ex.id.padEnd(16), `${trace.steps.length} steps`, err ? `ERROR: ${err.error}` : 'ok');
  out[ex.id] = trace;
}
if (!only) writeFileSync('src/data/gallery.json', JSON.stringify(out));
else console.log(JSON.stringify(out[only], null, 1).slice(0, 6000));
await browser.close();
await server.close();
