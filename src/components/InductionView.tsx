'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { StepView } from '@/core/analyze';
import type { InductionInfo } from '@/core/induction';
import { tokensOf } from '@/core/term';
import { MiniTerm, type Hover } from './Term';

interface Geometry {
  w: number;
  h: number;
  edges: string[];
  arrow?: { d: string; lx: number; ly: number };
}

/** nat_ind (or list_ind, …) drawn as a tree: the cases are the children, the IH an arrow. */
export function InductionView({ info, v, hv }: { info: InductionInfo; v: StepView; hv: Hover }) {
  const root = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometry>();
  const majorText = tokensOf(info.major).map((t) => t.text).join(' ');
  const stepCase = info.cases.find((c) => c.ih);
  const base = info.cases.find((c) => !c.ih);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const draw = () => {
      const box = el.getBoundingClientRect();
      const rel = (e: Element) => {
        const r = e.getBoundingClientRect();
        return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
      };
      const top = rel(el.querySelector('[data-node="root"]')!);
      const edges = [...el.querySelectorAll('[data-node="base"],[data-node="step"]')].map((k) => {
        const c = rel(k);
        const x1 = top.x + top.w / 2;
        const y1 = top.y + top.h;
        const x2 = c.x + c.w / 2;
        const my = (y1 + c.y) / 2;
        return `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${c.y}`;
      });
      let arrow: Geometry['arrow'];
      const baseEl = el.querySelector('[data-node="base"]');
      const ihEl = el.querySelector('#ih-binder');
      if (baseEl && ihEl) {
        const b = rel(baseEl);
        const i = rel(ihEl);
        if (b.x + b.w + 24 < i.x) {
          const y = i.y + i.h / 2;
          arrow = { d: `M${b.x + b.w} ${y} L${i.x - 2} ${y}`, lx: (b.x + b.w + i.x) / 2, ly: y - 8 };
        } else {
          const x1 = b.x + 14;
          const y1 = b.y + b.h;
          const x2 = i.x + i.w / 2;
          const y2 = i.y - 2;
          arrow = { d: `M${x1} ${y1} C${x1} ${y1 + 30} ${x2} ${y2 - 30} ${x2} ${y2}`, lx: x1 + 8, ly: (y1 + y2) / 2 };
        }
      }
      setGeo({ w: box.width, h: box.height, edges, arrow });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [info, v]);

  return (
    <div className="ind" ref={root}>
      {geo && (
        <svg className="ind-svg" width={geo.w} height={geo.h} aria-hidden="true">
          <defs>
            <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="ah" />
            </marker>
          </defs>
          {geo.edges.map((d, i) => (
            <path key={i} d={d} className="edge" />
          ))}
          {geo.arrow && (
            <>
              <path d={geo.arrow.d} className="ih-arrow" markerEnd="url(#ah)" />
              <text x={geo.arrow.lx} y={geo.arrow.ly} className="ih-label" textAnchor="middle">
                {stepCase?.ih?.name.text}
              </text>
            </>
          )}
        </svg>
      )}
      <div className="ind-top">
        <div className="node root" data-node="root">
          <div className="node-title">induction principle</div>
          <code className="rootname">{info.head.text}</code>
          <div className="root-args">
            <span className="lbl">predicate</span>
            <MiniTerm nodes={[info.motive]} v={v} cols={44} hv={hv} />
          </div>
          <div className="root-args">
            <span className="lbl">proved for</span>
            <code>{majorText}</code>
          </div>
        </div>
      </div>
      <div className="ind-kids" style={{ gridTemplateColumns: `repeat(${info.cases.length}, minmax(0, 1fr))` }}>
        {info.cases.map((c, i) => {
          const only = c.body.length === 1 && c.body[0].k === 'tok' && c.body[0].t.kind === 'hole' ? c.body[0].t.text : null;
          const hole = only ? v.step.holes.find((x) => x.name === only) : undefined;
          return (
            <div key={i} className={`node case ${c.ih ? 'step' : 'base'}`} data-node={c.ih ? 'step' : 'base'}>
              <div className="node-title">{c.ih ? 'step case' : 'base case'}</div>
              {c.fun && (
                <div className="binders">
                  fun{' '}
                  {c.binders.map((b) => {
                    const isIh = c.ih && b.id === c.ih.name.id;
                    return (
                      <span key={b.id}>
                        <span className={`binder${isIh ? ' ih' : ''}`} id={isIh ? 'ih-binder' : undefined} title={isIh ? `induction hypothesis: ${c.ih!.name.text} : ${c.ih!.type}` : undefined}>
                          {b.text}
                        </span>{' '}
                      </span>
                    );
                  })}
                  =&gt;
                </div>
              )}
              <MiniTerm nodes={c.body} v={v} cols={38} hv={hv} />
              {hole && (
                <div className="concl">
                  <span className="turnstile">⊢</span> {hole.goal}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {stepCase?.ih && (
        <p className="caption">
          The step case receives a proof for <code>{stepCase.ih.recursiveVar.text}</code> as <code>{stepCase.ih.name.text}</code> (<code>{stepCase.ih.type}</code>)
          {base ? '. The arrow shows where that proof comes from: first the base case, then the step applied again and again.' : '.'}
        </p>
      )}
    </div>
  );
}
