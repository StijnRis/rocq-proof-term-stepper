import type { StepView } from '@/core/analyze';
import type { Trace } from '@/core/types';
import { MiniTerm } from './Term';

const noHover = { hole: null, setHole() {}, toggleChip() {} };

export function QedView({ trace, v, cols }: { trace: Trace; v: StepView; cols: number }) {
  const q = v.step.qed!;
  const start = [...trace.steps.slice(0, v.index)].reverse().find((s) => s.kind === 'start');
  const statement = start?.holes[0]?.goal;

  if (q.keyword === 'Admitted' || q.keyword === 'Abort')
    return (
      <div className="qed">
        <p className="warn">{q.keyword === 'Admitted' ? 'Admitted. The kernel never sees a finished term: the statement is simply assumed.' : 'Abort. The proof is thrown away; nothing reaches the kernel.'}</p>
        {q.messages.length > 0 && <pre className="coq-out">{q.messages.join('\n')}</pre>}
      </div>
    );

  return (
    <div className="qed">
      <div className="qed-flow">
        <div className="box">
          <h4>Finished term</h4>
          {v.finalTerm && <MiniTerm nodes={v.finalTerm.tree} v={{ ...v, marks: new Set() }} cols={cols} hv={noHover} />}
        </div>
        <div className="check" role="img" aria-label="the kernel checks that the term has the type of the statement">
          <span className="tick">✓</span>
          <span>the kernel checks</span>
          <span className="colon">term : statement</span>
        </div>
        <div className="box">
          <h4>Statement (the theorem)</h4>
          <pre className="term">{statement}</pre>
        </div>
      </div>
      <p className="muted">The tactics are not trusted. Qed hands the finished term to the kernel, which type-checks it against the statement. Only then is the theorem added to the environment.</p>
      <h3 className="facts-title">Coq’s answers</h3>
      <div className="facts">
        {q.messages.map((m, i) => (
          <Fact key={i} label={`${q.keyword}.`} text={m} />
        ))}
        {q.check && <Fact label={`Check ${q.name}.`} text={q.check} />}
        {q.assumptions && <Fact label={`Print Assumptions ${q.name}.`} text={q.assumptions} />}
      </div>
    </div>
  );
}

function Fact({ label, text }: { label: string; text: string }) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <pre className="coq-out">{text}</pre>
    </div>
  );
}
