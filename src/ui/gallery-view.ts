import gallery from '../data/gallery.json';
import { analyze } from '../core/analyze';
import { EXAMPLES } from '../data/examples';
import { tacticInfo } from '../data/tactics';
import type { Trace } from '../core/types';
import { h } from './dom';

const G = gallery as unknown as Record<string, Trace>;

/** One card per tactic: what Coq built for it, side by side. */
export function galleryView(open: (id: string, step: number) => void): HTMLElement {
  const grid = h('div', { class: 'gallery' });
  for (const ex of EXAMPLES) {
    const trace = G[ex.id];
    if (!trace) continue;
    const idx = trace.steps.findIndex((s) => s.kind === 'tactic' && ex.focus.test(s.text));
    const view = idx >= 0 ? analyze(trace, idx) : undefined;
    const info = tacticInfo(trace.steps[idx]?.text ?? '');
    const built = view?.built;
    grid.append(
      h(
        'article',
        { class: 'gcard' },
        h('header', null, h('code', { class: 'gtactic' }, ex.tactic), h('span', { class: 'muted' }, ex.title)),
        h('p', { class: 'muted' }, ex.blurb),
        h('div', { class: 'gbuilt' }, h('div', { class: 'gl' }, `Coq built, after ${trace.steps[idx]?.text ?? ''}`), h('pre', { class: 'term mini' }, built ? h('span', { class: 'tm new' }, built.length > 150 ? built.slice(0, 147) + '…' : built) : '(nothing new)')),
        info ? h('div', { class: 'gshape muted' }, 'general shape: ', h('code', null, info.builds)) : null,
        h('footer', null, h('button', { class: 'btn', type: 'button', onclick: () => open(ex.id, Math.max(0, idx)) }, 'Step through')),
      ),
    );
  }
  return grid;
}
