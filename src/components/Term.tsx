'use client';
import type { ReactNode } from 'react';
import type { StepView } from '@/core/analyze';
import { render, type Line } from '@/core/layout';
import { tidyDoc } from '@/core/tidy';
import type { Hole } from '@/core/types';

export interface TermOptions {
  mode: 'tidy' | 'raw';
  binderTypes: boolean;
  collapse: boolean;
  expanded: Set<string>;
  cols: number;
}

interface Hover {
  hole: string | null;
  setHole(name: string | null): void;
  toggleChip(key: string): void;
}

const holeProps = (name: string, hv: Hover) => ({
  'data-hole': name,
  tabIndex: 0,
  onMouseEnter: () => hv.setHole(name),
  onMouseLeave: () => hv.setHole(null),
  onFocus: () => hv.setHole(name),
  onBlur: () => hv.setHole(null),
});

function Lines({ lines, hv }: { lines: Line[]; hv: Hover }) {
  const out: ReactNode[] = [];
  lines.forEach((line, li) => {
    if (li > 0) out.push('\n');
    line.forEach((s, si) => {
      const k = `${li}-${si}`;
      // Whitespace between two built tokens belongs to the built run.
      const prev = line[si - 1];
      const next = line[si + 1];
      if (!s.cls && /^\s+$/.test(s.text) && prev?.cls?.includes('new') && next?.cls?.includes('new') && !prev.hole && !next.hole) {
        out.push(<span key={k} className="tm new">{s.text}</span>);
      } else if (s.chip) {
        out.push(
          <button key={k} type="button" className={`tm ${s.cls ?? ''}`} title="Click to expand / collapse" onClick={() => hv.toggleChip(s.chip!)}>
            {s.text}
          </button>,
        );
      } else if (s.hole) {
        out.push(
          <span key={k} className={`tm ${s.cls ?? ''}${hv.hole === s.hole ? ' linked' : ''}`} {...holeProps(s.hole, hv)}>
            {s.text}
          </span>,
        );
      } else if (s.cls) out.push(<span key={k} className={`tm ${s.cls}`}>{s.text}</span>);
      else out.push(s.text);
    });
  });
  return <>{out}</>;
}

/** Coq's own text, untouched, with built tokens and holes marked. */
function Raw({ v, hv }: { v: StepView; hv: Hover }) {
  const p = v.parsed!;
  const out: ReactNode[] = [];
  let pos = 0;
  p.tokens.forEach((t, i) => {
    const gap = p.text.slice(pos, t.start);
    const prev = p.tokens[i - 1];
    if (gap) {
      if (prev && v.marks.has(prev.id) && v.marks.has(t.id) && prev.kind !== 'hole' && t.kind !== 'hole') out.push(<span key={`g${i}`} className="tm new">{gap}</span>);
      else out.push(gap);
    }
    const isNew = v.marks.has(t.id);
    if (t.kind === 'hole') out.push(<span key={i} className={`tm hole${isNew ? ' new' : ''}${hv.hole === t.text ? ' linked' : ''}`} {...holeProps(t.text, hv)}>{t.text}</span>);
    else if (isNew) out.push(<span key={i} className="tm new">{t.text}</span>);
    else out.push(t.text);
    pos = t.end;
  });
  out.push(p.text.slice(pos));
  return <>{out}</>;
}

export function TermPre({ v, o, hv }: { v: StepView; o: TermOptions; hv: Hover }) {
  if (!v.parsed) return <pre className="term">{(v.step.term ?? []).map((s) => s.t).join('')}</pre>;
  if (o.mode === 'raw')
    return (
      <pre className="term raw">
        <Raw v={v} hv={hv} />
      </pre>
    );
  const doc = tidyDoc(v.parsed.tree, { binderTypes: o.binderTypes, collapse: o.collapse, expanded: o.expanded, marks: v.marks });
  return (
    <pre className="term tidy">
      <Lines lines={render(doc, o.cols)} hv={hv} />
    </pre>
  );
}

/** A small tidy-printed fragment (used by the induction tree and the Qed view). */
export function MiniTerm({ nodes, v, cols, hv }: { nodes: Parameters<typeof tidyDoc>[0]; v: StepView; cols: number; hv: Hover }) {
  const doc = tidyDoc(nodes, { binderTypes: true, collapse: false, expanded: new Set(), marks: v.marks });
  return (
    <pre className="term mini">
      <Lines lines={render(doc, cols)} hv={hv} />
    </pre>
  );
}

export function GoalsList({ holes, hv }: { holes: Hole[]; hv: Hover }) {
  if (!holes.length)
    return (
      <section className="goals" aria-label="Open goals">
        <h3>No goals left</h3>
        <p className="muted">Every hole is filled: the term is complete.</p>
      </section>
    );
  return (
    <section className="goals" aria-label="Open goals">
      <h3>
        Open goals ({holes.length}) <span className="sub">one per hole</span>
      </h3>
      <ul>
        {holes.map((g) => {
          const state = g.order === 0 ? 'focused' : g.order > 0 ? 'queued' : 'waiting';
          const badge = g.order === 0 ? 'current goal' : g.order > 0 ? `goal ${g.order + 1}` : 'outside focus';
          return (
            <li key={g.name} className={`goal ${state}${hv.hole === g.name ? ' linked' : ''}`} data-hole={g.name} onMouseEnter={() => hv.setHole(g.name)} onMouseLeave={() => hv.setHole(null)}>
              <div className="goal-head">
                <span className="tm hole">{g.name}</span>
                <span className="badge">{badge}</span>
              </div>
              {g.hyps.length > 0 && (
                <div className="hyps">
                  {g.hyps.map((x, i) => (
                    <span key={i} className="hyp">
                      <b>{x.names.join(', ')}</b>
                      {x.body ? ` := ${x.body}` : ''} : {x.type}
                    </span>
                  ))}
                </div>
              )}
              <div className="concl">
                <span className="turnstile">⊢</span> {g.goal}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { Hover };
