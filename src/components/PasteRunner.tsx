'use client';
import { useState } from 'react';
import type { Coq } from '@/engine/coq';
import { buildTrace } from '@/core/trace';
import type { Trace } from '@/core/types';
import { DEFAULT_SCRIPT } from '@/data/examples';
import { Stepper } from './Stepper';

type Libs = 'init' | 'arith' | 'lists' | 'all';
const PACKAGES: Record<Libs, string[]> = {
  init: ['init'],
  arith: ['init', 'coq-base', 'coq-collections', 'coq-arith'],
  lists: ['init', 'coq-base', 'coq-collections'],
  all: ['init', 'coq-base', 'coq-arith', 'coq-collections'],
};
const LIBS: [Libs, string][] = [
  ['init', 'Prelude only (fastest, ~5 MB)'],
  ['arith', '+ Arith, ZArith, Lists, Strings (~31 MB)'],
  ['lists', '+ Lists, Sets, Vectors (~20 MB)'],
  ['all', 'Everything (~31 MB)'],
];

let engine: { libs: Libs; coq: Coq } | undefined;

export function PasteRunner() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [libs, setLibs] = useState<Libs>('init');
  const [trace, setTrace] = useState<Trace>();
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [startAt, setStartAt] = useState(0);

  async function run() {
    setBusy(true);
    setStatus('Starting Coq…');
    try {
      if (!engine || engine.libs !== libs) {
        const { Coq } = await import('@/engine/coq');
        const coq = await Coq.create({ base: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/jscoq/`, packages: PACKAGES[libs], onStatus: setStatus });
        engine = { libs, coq };
      }
      const coq = engine.coq;
      coq.reset();
      setStatus('Running your script…');
      const tr = await buildTrace(coq, coq.version, script);
      const err = tr.steps.findIndex((s) => s.kind === 'error');
      setTrace(tr);
      setStartAt(err >= 0 ? err : 0);
      setEditing(false);
      setStatus(err >= 0 ? `Coq stopped at an error in «${tr.steps[err].text}».` : `Done with ${coq.version}.`);
    } catch (e) {
      setStatus(`Could not run Coq: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (trace && !editing)
    return (
      <Stepper
        trace={trace}
        initialStep={startAt}
        note={status}
        scriptAction={
          <button type="button" className="btn small" onClick={() => setEditing(true)}>
            Edit
          </button>
        }
      />
    );

  return (
    <div className="cols">
      <section className="panel script-panel" aria-label="Rocq script">
        <div className="toolbar">
          <h2>Tactic script</h2>
        </div>
        <textarea className="editor" spellCheck={false} aria-label="Rocq script" rows={14} value={script} onChange={(e) => setScript(e.target.value)} />
        <div className="runbar">
          <select aria-label="Libraries" value={libs} onChange={(e) => setLibs(e.target.value as Libs)}>
            {LIBS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Running…' : 'Run in Coq'}
          </button>
        </div>
        <p className="muted small">{status || 'Coq 8.17 runs inside this page (jsCoq). Nothing is sent anywhere. A tactic that never terminates will freeze the tab.'}</p>
      </section>
      <section className="panel placeholder">
        <h2>Proof term</h2>
        <p className="muted">Run a script to see the term grow here.</p>
      </section>
    </div>
  );
}
