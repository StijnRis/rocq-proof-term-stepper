// Copies the jsCoq assets we need (the js_of_ocaml Coq bundle and the standard
// library packages) from node_modules into public/, so Vite serves and ships
// them as static files. Nothing is fetched at runtime from a third party.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('jscoq/package.json'));
const out = 'public/jscoq';
mkdirSync(out, { recursive: true });
cpSync(join(root, 'backend/jsoo/jscoq_worker.bc.js'), join(out, 'jscoq_worker.bc.js'));
for (const pkg of ['init', 'coq-base', 'coq-arith', 'coq-collections']) {
  cpSync(join(root, 'coq-pkgs', `${pkg}.coq-pkg`), join(out, `${pkg}.coq-pkg`));
}
console.log('jsCoq assets copied to', out);
