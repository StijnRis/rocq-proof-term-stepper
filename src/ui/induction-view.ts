import type { StepView } from '../core/analyze';
import type { InductionInfo, CaseInfo } from '../core/induction';
import { render } from '../core/layout';
import { tidyDoc } from '../core/tidy';
import { tokensOf, type Node } from '../core/term';
import { h } from './dom';

const SVG = 'http://www.w3.org/2000/svg';

function code(nodes: Node[], v: StepView, width = 38): HTMLElement {
  const doc = tidyDoc(nodes, { binderTypes: true, collapse: false, expanded: new Set(), marks: v.marks });
  const pre = h('pre', { class: 'term mini' });
  render(doc, width).forEach((line, i) => {
    if (i) pre.append('\n');
    for (const s of line) {
      if (s.cls) pre.append(h('span', { class: `tm ${s.cls}`, 'data-hole': s.hole ?? null }, s.text));
      else pre.append(s.text);
    }
  });
  return pre;
}

function caseNode(c: CaseInfo, label: string, v: StepView, ihId: string | null): HTMLElement {
  const el = h('div', { class: `node case ${c.ih ? 'step' : 'base'}`, 'data-node': c.ih ? 'step' : 'base' });
  el.append(h('div', { class: 'node-title' }, label));
  if (c.fun) {
    const binders = h('div', { class: 'binders' }, 'fun ');
    for (const b of c.binders) {
      const isIh = c.ih && b.id === c.ih.name.id;
      binders.append(h('span', { class: `binder${isIh ? ' ih' : ''}`, id: isIh ? ihId : null, title: isIh ? `induction hypothesis: ${c.ih!.name.text} : ${c.ih!.type}` : null }, b.text), ' ');
    }
    binders.append('⇒');
    el.append(binders);
  }
  el.append(code(c.body, v));
  const only = c.body.length === 1 && c.body[0].k === 'tok' && c.body[0].t.kind === 'hole' ? c.body[0].t.text : null;
  const hole = only ? v.step.holes.find((x) => x.name === only) : undefined;
  if (hole) el.append(h('div', { class: 'concl' }, h('span', { class: 'turnstile' }, '⊢'), ' ', hole.goal));
  return el;
}

/** nat_ind (or list_ind, …) drawn as a tree: the cases are the children, the IH an arrow. */
export function inductionView(info: InductionInfo, v: StepView): HTMLElement {
  const root = h('div', { class: 'ind' });
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'ind-svg');
  svg.setAttribute('aria-hidden', 'true');

  const majorText = tokensOf(info.major).map((t) => t.text).join(' ');
  const rootNode = h(
    'div',
    { class: 'node root', 'data-node': 'root' },
    h('div', { class: 'node-title' }, 'induction principle'),
    h('code', { class: 'rootname' }, info.head.text),
    h('div', { class: 'root-args' }, h('span', { class: 'lbl' }, 'predicate'), code([info.motive], v, 44)),
    h('div', { class: 'root-args' }, h('span', { class: 'lbl' }, 'proved for'), h('code', null, majorText)),
  );

  const ihId = 'ih-binder';
  const base = info.cases.find((c) => !c.ih);
  const kids: HTMLElement[] = info.cases.map((c) => caseNode(c, c.ih ? 'step case' : 'base case', v, ihId));

  const kidsBox = h('div', { class: 'ind-kids' }, ...kids);
  kidsBox.style.gridTemplateColumns = `repeat(${kids.length}, minmax(0, 1fr))`;
  root.append(svg, h('div', { class: 'ind-top' }, rootNode), kidsBox);

  const stepCase = info.cases.find((c) => c.ih);
  if (stepCase?.ih) {
    root.append(
      h(
        'p',
        { class: 'caption' },
        `The step case receives a proof for `,
        h('code', null, stepCase.ih.recursiveVar.text),
        ' as ',
        h('code', null, stepCase.ih.name.text),
        ' (',
        h('code', null, stepCase.ih.type),
        ')',
        base ? '. The arrow shows where that proof comes from: first the base case, then the step applied again and again.' : '.',
      ),
    );
  }

  const draw = () => {
    if (!root.isConnected) return;
    const box = root.getBoundingClientRect();
    svg.setAttribute('width', String(box.width));
    svg.setAttribute('height', String(box.height));
    svg.replaceChildren();
    const rel = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    };
    const line = (d: string, cls: string, marker = false) => {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', cls);
      if (marker) p.setAttribute('marker-end', 'url(#ah)');
      svg.append(p);
    };
    const defs = document.createElementNS(SVG, 'defs');
    defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ah"/></marker>';
    svg.append(defs);

    const r = rel(rootNode);
    for (const k of kids) {
      const c = rel(k);
      const x1 = r.x + r.w / 2;
      const y1 = r.y + r.h;
      const x2 = c.x + c.w / 2;
      const y2 = c.y;
      const my = (y1 + y2) / 2;
      line(`M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`, 'edge');
    }
    const baseEl = root.querySelector('[data-node="base"]');
    const ihEl = root.querySelector(`#${ihId}`);
    if (baseEl && ihEl) {
      const b = rel(baseEl);
      const i = rel(ihEl);
      let d: string;
      let lx: number;
      let ly: number;
      if (b.x + b.w + 24 < i.x) {
        const x1 = b.x + b.w;
        const y1 = i.y + i.h / 2;
        const x2 = i.x - 2;
        d = `M${x1} ${y1} L${x2} ${y1}`;
        lx = (x1 + x2) / 2;
        ly = y1 - 8;
      } else {
        // narrow layout: the cases are stacked, arrow runs down the left edge
        const x1 = b.x + 14;
        const y1 = b.y + b.h;
        const x2 = i.x + i.w / 2;
        const y2 = i.y - 2;
        d = `M${x1} ${y1} C${x1} ${y1 + 30} ${x2} ${y2 - 30} ${x2} ${y2}`;
        lx = x1 + 8;
        ly = (y1 + y2) / 2;
      }
      line(d, 'ih-arrow', true);
      const label = document.createElementNS(SVG, 'text');
      label.setAttribute('x', String(lx));
      label.setAttribute('y', String(ly));
      label.setAttribute('class', 'ih-label');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = stepCase?.ih?.name.text ?? 'IH';
      svg.append(label);
    }
  };
  requestAnimationFrame(draw);
  const ro = new ResizeObserver(draw);
  ro.observe(root);
  return root;
}
