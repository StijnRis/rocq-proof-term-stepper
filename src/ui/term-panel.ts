import type { StepView } from '../core/analyze';
import { render, type Line } from '../core/layout';
import { tidyDoc } from '../core/tidy';
import type { Hole } from '../core/types';
import { h } from './dom';

export interface TermOptions {
  mode: 'tidy' | 'raw';
  binderTypes: boolean;
  collapse: boolean;
  expanded: Set<string>;
  /** Columns available for layout. */
  width: number;
}

export interface TermHandlers {
  onToggleChip(key: string): void;
  onHoleHover(name: string | null): void;
}

function linesToDom(lines: Line[], hd: TermHandlers): DocumentFragment {
  const frag = document.createDocumentFragment();
  lines.forEach((line, li) => {
    if (li > 0) frag.append('\n');
    line.forEach((s, si) => {
      // Whitespace between two built tokens is part of the built run.
      if (!s.cls && /^\s+$/.test(s.text) && line[si - 1]?.cls?.includes('new') && line[si + 1]?.cls?.includes('new') && !line[si - 1].hole && !line[si + 1].hole) {
        frag.append(h('span', { class: 'tm new' }, s.text));
        return;
      }
      if (s.chip) {
        frag.append(
          h('button', { class: `tm ${s.cls ?? ''}`, type: 'button', 'data-chip': s.chip, title: 'Click to expand / collapse', onclick: () => hd.onToggleChip(s.chip!) }, s.text),
        );
      } else if (s.hole) {
        frag.append(
          h('span', { class: `tm ${s.cls ?? ''}`, 'data-hole': s.hole, tabindex: 0, onmouseenter: () => hd.onHoleHover(s.hole!), onmouseleave: () => hd.onHoleHover(null), onfocus: () => hd.onHoleHover(s.hole!), onblur: () => hd.onHoleHover(null) }, s.text),
        );
      } else if (s.cls) frag.append(h('span', { class: `tm ${s.cls}` }, s.text));
      else frag.append(s.text);
    });
  });
  return frag;
}

/** Coq's own text, untouched, with built tokens and holes marked. */
function rawDom(v: StepView, hd: TermHandlers): DocumentFragment {
  const frag = document.createDocumentFragment();
  const p = v.parsed!;
  let pos = 0;
  p.tokens.forEach((t, ti) => {
    const gap = p.text.slice(pos, t.start);
    const prev = p.tokens[ti - 1];
    if (gap && prev && v.marks.has(prev.id) && v.marks.has(t.id) && prev.kind !== 'hole' && t.kind !== 'hole') frag.append(h('span', { class: 'tm new' }, gap));
    else frag.append(gap);
    const cls = ['tm'];
    if (t.kind === 'hole') cls.push('hole');
    if (v.marks.has(t.id)) cls.push('new');
    if (cls.length === 1) frag.append(t.text);
    else
      frag.append(
        h('span', { class: cls.join(' '), 'data-hole': t.kind === 'hole' ? t.text : null, tabindex: t.kind === 'hole' ? 0 : null, onmouseenter: t.kind === 'hole' ? () => hd.onHoleHover(t.text) : null, onmouseleave: t.kind === 'hole' ? () => hd.onHoleHover(null) : null }, t.text),
      );
    pos = t.end;
  });
  frag.append(p.text.slice(pos));
  return frag;
}

export function termPre(v: StepView, o: TermOptions, hd: TermHandlers): HTMLElement {
  const pre = h('pre', { class: `term ${o.mode}` });
  if (!v.parsed) {
    // Parsing failed (or no term): show Coq's text verbatim.
    pre.textContent = (v.step.term ?? []).map((s) => s.t).join('');
    return pre;
  }
  if (o.mode === 'raw') {
    pre.append(rawDom(v, hd));
    return pre;
  }
  const doc = tidyDoc(v.parsed.tree, { binderTypes: o.binderTypes, collapse: o.collapse, expanded: o.expanded, marks: v.marks });
  pre.append(linesToDom(render(doc, o.width), hd));
  return pre;
}

export function holeLabel(hole: Hole): string {
  return `${hole.hyps.map((x) => `${x.names.join(', ')} : ${x.type}`).join(', ')} ⊢ ${hole.goal}`;
}

/** Open goals, one per hole in the term. */
export function goalsList(holes: Hole[], hd: TermHandlers): HTMLElement {
  const root = h('section', { class: 'goals', 'aria-label': 'Open goals' });
  root.append(h('h3', null, holes.length ? `Open goals (${holes.length})` : 'No goals left', holes.length ? h('span', { class: 'sub' }, ' one per hole') : null));
  if (!holes.length) {
    root.append(h('p', { class: 'muted' }, 'Every hole is filled: the term is complete.'));
    return root;
  }
  const ul = h('ul');
  for (const g of holes) {
    const state = g.order === 0 ? 'focused' : g.order > 0 ? 'queued' : 'waiting';
    const badge = g.order === 0 ? 'current goal' : g.order > 0 ? `goal ${g.order + 1}` : 'outside focus';
    ul.append(
      h(
        'li',
        { class: `goal ${state}`, 'data-hole': g.name, onmouseenter: () => hd.onHoleHover(g.name), onmouseleave: () => hd.onHoleHover(null) },
        h('div', { class: 'goal-head' }, h('span', { class: 'tm hole', 'data-hole': g.name }, g.name), h('span', { class: 'badge' }, badge)),
        g.hyps.length
          ? h('div', { class: 'hyps' }, ...g.hyps.map((x) => h('span', { class: 'hyp' }, h('b', null, x.names.join(', ')), x.body ? ` := ${x.body}` : '', ` : ${x.type}`)))
          : null,
        h('div', { class: 'concl' }, h('span', { class: 'turnstile' }, '⊢'), ' ', g.goal),
      ),
    );
  }
  root.append(ul);
  return root;
}
