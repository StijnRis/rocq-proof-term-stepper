// Renders public/og.png (1200x630 social preview) from real recorded data.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const g = JSON.parse(readFileSync('src/data/gallery.json', 'utf8')).split;
const step = g.steps.find((s) => /^split/.test(s.text));
const term = step.term.map((t) => t.t).join('');
const html = `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#101316;color:#e7eaed;font:32px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
h1{font-size:68px;line-height:1.08;margin:0 0 14px;letter-spacing:-.02em}h1 span{color:#2dd4bf}p{margin:0;color:#98a2b3;font-size:30px}
.card{background:#171b1f;border:2px solid #2a3036;border-radius:20px;padding:26px 30px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:26px;font-variant-ligatures:none}
.lbl{font:600 22px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;margin-bottom:10px}
.new{background:rgba(45,212,191,.2);box-shadow:0 4px 0 #2dd4bf;border-radius:5px}.hole{color:#fbbf24;background:rgba(251,191,36,.14);border:2px dashed #fbbf24;border-radius:8px;padding:0 8px;font-weight:700}
.foot{display:flex;justify-content:space-between;color:#98a2b3;font-size:24px}
</style><body>
<div><h1>Rocq <span>(Coq)</span> proof term stepper</h1><p>Watch tactics build the proof term, step by step.</p></div>
<div class=card><div class=lbl>after <b style="color:#e7eaed">split.</b></div>
<div>(fun (P Q : Prop) (p : P) (q : Q) =&gt; <span class=new>conj</span> <span class=hole>?Goal</span> <span class=hole>?Goal0</span>)</div></div>
<div class=foot><span>Real <code style="font-family:inherit">Show Proof.</code> output, run in your browser</span><span>stijnris.github.io/rocq-proof-term-stepper</span></div></body>`;
if (!term.includes('conj ?Goal ?Goal0')) throw new Error('recorded term changed; update scripts/og.mjs');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.screenshot({ path: 'public/og.png' });
await b.close();
console.log('wrote public/og.png');
