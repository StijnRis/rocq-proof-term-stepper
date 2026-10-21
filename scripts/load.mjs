// Dev helper: bundle a TypeScript module with esbuild and import it (the sources use extensionless
// imports and the "@/" alias, which plain Node cannot resolve).
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadTs(entry) {
  const out = join(mkdtempSync(join(tmpdir(), 'rq-load-')), 'm.mjs');
  await build({ entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', alias: { '@': resolve('src') }, logLevel: 'silent', loader: { '.json': 'json' } });
  return import(pathToFileURL(out).href);
}
