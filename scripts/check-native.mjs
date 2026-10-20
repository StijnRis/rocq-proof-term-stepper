// Cross-check: run each gallery script through a native `coqc` and compare its
// `Show Proof.` output after every sentence with the recorded jsCoq output.
// Differences are reported (the native Coq version may be newer than jsCoq's 8.17).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const gallery = JSON.parse(readFileSync('src/data/gallery.json', 'utf8'));
const server = await createServer({ logLevel: 'error', server: { middlewareMode: true } });
const { splitSentences } = await server.ssrLoadModule('/src/core/script.ts');
await server.close();

const squash = (s) => s.replace(/\s+/g, '');
let diffs = 0;
let total = 0;
for (const [id, trace] of Object.entries(gallery)) {
  const sents = splitSentences(trace.script);
  let inProof = false;
  const out = [];
  const expect = [];
  let stepIdx = 0;
  for (const s of sents) {
    out.push(s.text);
    const step = trace.steps.find((st) => st.ranges.some((r) => r.start === s.start));
    const closes = /^(Qed|Defined|Admitted)\b/.test(s.text);
    if (step && step.term && !closes) {
      out.push('Show Proof.', 'Compute 77.');
      expect.push({ step, sentence: s.text });
    }
    void inProof;
    void stepIdx;
  }
  const dir = mkdtempSync(join(tmpdir(), 'rq-'));
  const f = join(dir, 'x.v');
  writeFileSync(f, out.join('\n') + '\n');
  const stdout = execFileSync('coqc', ['-q', f], { encoding: 'utf8' });
  const chunks = stdout.split(/\s*=\s*77\s*:\s*nat\s*/).filter((c) => c.trim());
  expect.forEach((e, i) => {
    total++;
    const native = squash(chunks[i] ?? '');
    const recorded = squash(e.step.term.map((t) => t.t).join(''));
    if (native !== recorded) {
      diffs++;
      console.log(`DIFF ${id} after «${e.sentence}»\n  native  : ${chunks[i]?.replace(/\s+/g, ' ')}\n  recorded: ${e.step.term.map((t) => t.t).join('')}`);
    }
  });
}
console.log(`${total - diffs}/${total} Show Proof outputs identical between native coqc ($(coqc --version)) and recorded jsCoq`.replace('$(coqc --version)', execFileSync('coqc', ['--version'], { encoding: 'utf8' }).split('\n')[0]));
process.exit(diffs ? 1 : 0);
