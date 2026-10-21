'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyze } from '@/core/analyze';
import { findInduction } from '@/core/induction';
import type { Trace } from '@/core/types';
import { EXAMPLES } from '@/data/examples';
import { tacticInfo } from '@/data/tactics';
import { InductionView } from './InductionView';
import { QedView } from './QedView';
import { GoalsList, TermPre, type Hover } from './Term';

interface Props {
  trace: Trace;
  /** Example id, to show the example picker and the blurb. */
  exampleId?: string;
  /** Step to start at (the URL hash #N overrides it). */
  initialStep?: number;
  /** Shown instead of the blurb (paste mode status). */
  note?: ReactNode;
  /** Extra control for the script panel header (paste mode: Edit button). */
  scriptAction?: ReactNode;
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 2) + '…' : s);

export function Stepper({ trace, exampleId, initialStep = 0, note, scriptAction }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, trace.steps.length - 1));
  const [tab, setTab] = useState<'term' | 'tree'>('term');
  const [mode, setMode] = useState<'tidy' | 'raw'>('tidy');
  const [binderTypes, setBinderTypes] = useState(true);
  const [collapse, setCollapse] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hole, setHole] = useState<string | null>(null);
  const [card, setCard] = useState<{ step: number; rect: DOMRect } | null>(null);
  const [cols, setCols] = useState(56);
  const wrap = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);

  // A new trace (paste mode) or example starts from its own initial step.
  useEffect(() => {
    const n = Number(location.hash.slice(1));
    setStep(Math.min(Math.max(0, n ? n - 1 : initialStep), trace.steps.length - 1));
    setTab('term');
  }, [trace, initialStep]);

  const go = useCallback(
    (n: number) => {
      const i = Math.min(Math.max(0, n), trace.steps.length - 1);
      setStep(i);
      history.replaceState(null, '', `#${i + 1}`);
    },
    [trace],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('textarea, select, input')) return;
      if (e.key === 'ArrowRight') (e.preventDefault(), go(step + 1));
      else if (e.key === 'ArrowLeft') (e.preventDefault(), go(step - 1));
      else if (e.key === 'Home') (e.preventDefault(), go(0));
      else if (e.key === 'End') (e.preventDefault(), go(trace.steps.length - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, step, trace]);

  // Columns available to the term layout.
  useLayoutEffect(() => {
    const el = wrap.current;
    const ch = probe.current ? probe.current.getBoundingClientRect().width / 10 : 8;
    if (!el) return;
    const measure = () => setCols(Math.max(24, Math.floor((el.clientWidth - 30) / (ch || 8))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const v = useMemo(() => analyze(trace, step), [trace, step]);
  const s = v.step;
  const tree = useMemo(() => (v.parsed ? findInduction(v.parsed.tree) : undefined), [v]);
  const activeTab = tab === 'tree' && tree ? 'tree' : 'term';
  const hv: Hover = {
    hole,
    setHole,
    toggleChip: (k) =>
      setExpanded((prev) => {
        const n = new Set(prev);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
      }),
  };
  const ex = EXAMPLES.find((e) => e.id === exampleId);
  const opts = { mode, binderTypes, collapse, expanded, cols };

  // ---- script ----
  const ranges = trace.steps.flatMap((st, i) => st.ranges.map((r) => ({ ...r, step: i }))).sort((a, b) => a.start - b.start);
  const script: ReactNode[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) script.push(<span key={`p${pos}`} className="plain">{trace.script.slice(pos, r.start)}</span>);
    const state = r.step < step ? 'past' : r.step === step ? 'current' : 'future';
    script.push(
      <span
        key={r.start}
        className={`sent ${state}${trace.steps[r.step].kind === 'error' ? ' err' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => go(r.step)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go(r.step))}
        onMouseEnter={(e) => setCard({ step: r.step, rect: e.currentTarget.getBoundingClientRect() })}
        onMouseLeave={() => setCard(null)}
        onFocus={(e) => setCard({ step: r.step, rect: e.currentTarget.getBoundingClientRect() })}
        onBlur={() => setCard(null)}
      >
        {trace.script.slice(r.start, r.end)}
      </span>,
    );
    pos = r.end;
  }
  script.push(<span key="tail" className="plain">{trace.script.slice(pos)}</span>);

  // ---- pieces ----
  const chip = (label: string, active: boolean, on: () => void, title?: string) => (
    <button type="button" className={`seg${active ? ' on' : ''}`} aria-pressed={active} title={title} onClick={on}>
      {label}
    </button>
  );

  let body: ReactNode;
  if (s.kind === 'error') {
    const prev = trace.steps[step - 1];
    body = (
      <>
        <div className="errbox">
          <b>Coq rejected this sentence</b>
          <pre>{s.error}</pre>
        </div>
        {prev?.term && (
          <>
            <p className="muted">The term before the error:</p>
            <TermPre v={analyze(trace, step - 1)} o={opts} hv={hv} />
          </>
        )}
      </>
    );
  } else if (s.kind === 'qed') {
    body = <QedView trace={trace} v={v} cols={cols} />;
  } else {
    body = (
      <>
        <div className="built">
          {s.kind === 'start' ? (
            'A proof starts as a single hole whose type is the statement.'
          ) : v.built ? (
            <>
              <code>{s.text}</code> built <code className="tm new">{short(v.built, 140)}</code>
            </>
          ) : (
            <>
              <code>{s.text}</code> built no new structure{tacticInfo(s.text)?.id === 'focus' ? ': it only focuses a goal.' : '.'}
            </>
          )}
        </div>
        {activeTab === 'tree' && tree ? <InductionView info={tree} v={v} hv={hv} /> : <TermPre v={v} o={opts} hv={hv} />}
        <GoalsList holes={s.holes} hv={hv} />
      </>
    );
  }

  const cardStep = card ? trace.steps[card.step] : undefined;
  const cardInfo = cardStep ? tacticInfo(cardStep.text) : undefined;
  const cardView = card ? analyze(trace, card.step) : undefined;

  return (
    <>
      {ex && (
        <div className="pick">
          <label htmlFor="example-select">Example</label>
          <select id="example-select" className="examples" value={ex.id} onChange={(e) => router.push(`/tactics/${e.target.value}/`)}>
            {EXAMPLES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.tactic}: {e.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="blurb">{note ?? ex?.blurb}</p>

      <div className="cols">
        <section className="panel script-panel" aria-label="Tactic script">
          <div className="toolbar">
            <h2>Tactic script</h2>
            {scriptAction}
          </div>
          <pre className="script">{script}</pre>
        </section>

        <section className="panel term-panel" aria-label="Proof term">
          <div className="toolbar">
            <h2>Proof term</h2>
            {s.kind !== 'qed' && (
              <>
                <div className="segs" role="group" aria-label="View">
                  {chip('Term', activeTab === 'term', () => setTab('term'))}
                  {tree && chip('Induction tree', activeTab === 'tree', () => setTab('tree'), 'Draw the induction principle as a tree')}
                </div>
                {activeTab === 'term' && (
                  <>
                    <div className="segs" role="group" aria-label="Printing">
                      {chip('Tidy', mode === 'tidy', () => setMode('tidy'), 'Normalised layout, collapsible predicates')}
                      {chip('Raw', mode === 'raw', () => setMode('raw'), 'Coq’s Show Proof text, unchanged')}
                    </div>
                    {mode === 'tidy' && (
                      <>
                        <label className="chk">
                          <input type="checkbox" checked={binderTypes} onChange={(e) => setBinderTypes(e.target.checked)} /> binder types
                        </label>
                        <label className="chk">
                          <input type="checkbox" checked={collapse} onChange={(e) => setCollapse(e.target.checked)} /> collapse predicates
                        </label>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <div className="term-wrap" ref={wrap}>
            <span className="probe" ref={probe}>MMMMMMMMMM</span>
            {body}
          </div>
        </section>
      </div>

      <div className="legend">
        <span><i className="sw new" />built by the current tactic</span>
        <span><i className="sw hole" />hole: a goal still to fill</span>
        <span className="muted">earlier tactics greyed · later ones dashed</span>
      </div>

      <footer className="stepper">
        <button type="button" className="btn" disabled={step === 0} onClick={() => go(step - 1)}>← Back</button>
        <div className="stepmid">
          <div className="dots" role="tablist" aria-label="Steps">
            {trace.steps.map((st, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1}: ${st.text}`}
                title={`${i + 1}. ${st.text}`}
                className={`dot ${i < step ? 'done' : i === step ? 'now' : 'todo'} k-${st.kind}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <div className="steplabel">
            Step {step + 1} of {trace.steps.length}<span className="muted"> · </span><code>{short(s.text, 48)}</code>
          </div>
        </div>
        <button type="button" className="btn primary" disabled={step === trace.steps.length - 1} onClick={() => go(step + 1)}>Next →</button>
      </footer>

      {card && cardStep && (
        <div className="card" role="tooltip" style={{ left: Math.min(Math.max(8, card.rect.left), (typeof window === 'undefined' ? 1000 : window.innerWidth) - 390), top: card.rect.bottom + 6 }}>
          <div className="card-head">
            <code>{short(cardStep.text, 40)}</code>
            {cardInfo && <span className="muted"> {cardInfo.name}</span>}
          </div>
          {cardInfo && (
            <div className="card-row">
              <span className="lbl">builds</span>
              <code>{cardInfo.builds}</code>
            </div>
          )}
          <p className="card-note">{cardInfo ? cardInfo.note : 'No general description for this tactic; see what Coq built below.'}</p>
          {cardStep.kind === 'error' ? (
            <div className="card-row err">{cardStep.error}</div>
          ) : (
            <div className="card-row">
              <span className="lbl">in this run</span>
              {cardView?.built ? <code className="tm new">{short(cardView.built, 160)}</code> : <span className="muted">no new structure</span>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
