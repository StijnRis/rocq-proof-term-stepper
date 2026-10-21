import type { ReactNode } from 'react';
import { analyze, type StepView } from '@/core/analyze';
import type { Trace } from '@/core/types';

/** Server-rendered, crawlable list: the term after every sentence, with built parts marked. */
function TermText({ v }: { v: StepView }): ReactNode {
  const p = v.parsed;
  if (!p) return (v.step.term ?? []).map((s) => s.t).join('');
  const out: ReactNode[] = [];
  let pos = 0;
  p.tokens.forEach((t, i) => {
    const gap = p.text.slice(pos, t.start);
    const prev = p.tokens[i - 1];
    if (gap) {
      if (prev && v.marks.has(prev.id) && v.marks.has(t.id) && prev.kind !== 'hole' && t.kind !== 'hole') out.push(<span key={`g${i}`} className="tm new">{gap}</span>);
      else out.push(gap);
    }
    if (t.kind === 'hole') out.push(<span key={i} className="tm hole">{t.text}</span>);
    else if (v.marks.has(t.id)) out.push(<span key={i} className="tm new">{t.text}</span>);
    else out.push(t.text);
    pos = t.end;
  });
  out.push(p.text.slice(pos));
  return out;
}

export function StepsText({ trace }: { trace: Trace }) {
  return (
    <ol className="steps">
      {trace.steps.map((_, i) => {
        const v = analyze(trace, i);
        const s = v.step;
        if (s.kind === 'qed')
          return (
            <li key={i}>
              <code>{s.text}</code> The kernel type-checks the finished term against the statement.
              {s.qed?.check && <pre className="coq-out">{s.qed.check}</pre>}
              {s.qed?.assumptions && <p className="muted">Print Assumptions: {s.qed.assumptions}</p>}
            </li>
          );
        if (s.kind === 'error')
          return (
            <li key={i}>
              <code>{s.text}</code> Coq reports: {s.error}
            </li>
          );
        return (
          <li key={i}>
            <code>{s.text.length > 120 ? s.text.slice(0, 118) + '…' : s.text}</code>{' '}
            {s.kind === 'start' ? 'Starts with a single hole whose type is the statement.' : v.built ? <>Built <code className="tm new">{v.built.length > 200 ? v.built.slice(0, 198) + '…' : v.built}</code>.</> : 'Builds no new structure.'}
            <pre className="term">
              <TermText v={v} />
            </pre>
            <p className="muted">{s.holes.length ? `${s.holes.length} open ${s.holes.length === 1 ? 'goal' : 'goals'}: ${s.holes.map((h) => h.name).join(', ')}` : 'No holes left: the term is complete.'}</p>
          </li>
        );
      })}
    </ol>
  );
}
