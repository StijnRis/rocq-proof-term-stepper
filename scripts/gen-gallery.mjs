// Records every gallery example by running it through the real jsCoq engine in
// headless Chromium, and writes src/data/gallery.json.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadTs } from './load.mjs';

const only = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), 'rq-gen-'));
await build({
  stdin: {
    contents: `import { Coq } from '@/engine/coq'; import { buildTrace } from '@/core/trace';
      window.__coq = Coq.create({ base: '/jscoq/' });
      window.__trace = async (script) => { const c = await window.__coq; c.reset(); return buildTrace(c, c.version, script); };`,
    resolveDir: resolve('.'),
    loader: 'ts',
  },
  outfile: join(dir, 'gen.js'),
  bundle: true,
  format: 'iife',
  alias: { '@': resolve('src') },
  logLevel: 'silent',
});
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (path === '/') return void res.writeHead(200, { 'content-type': 'text/html' }).end('<script src="/gen.js"></script>');
    const file = path === '/gen.js' ? join(dir, 'gen.js') : join('public', path);
    const body = readFileSync(file);
    res.writeHead(200).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url);

const { EXAMPLES } = await loadTs('src/data/examples.ts');
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
server.close();
