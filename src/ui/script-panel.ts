import type { Trace } from '../core/types';
import { h } from './dom';

export interface ScriptHandlers {
  onSelect(step: number): void;
  onHover(step: number | null, el: HTMLElement | null): void;
}

/** The tactic script: current tactic highlighted, past greyed, future dashed. */
export function scriptPanel(trace: Trace, current: number, hd: ScriptHandlers): HTMLElement {
  const owner = new Map<number, number>(); // range start -> step index
  const ranges: { start: number; end: number; step: number }[] = [];
  trace.steps.forEach((s, i) => s.ranges.forEach((r) => ranges.push({ ...r, step: i })));
  ranges.sort((a, b) => a.start - b.start);
  ranges.forEach((r) => owner.set(r.start, r.step));

  const pre = h('pre', { class: 'script', 'aria-label': 'Tactic script' });
  let pos = 0;
  const src = trace.script;
  const plain = (text: string, cls?: string) => {
    if (text) pre.append(h('span', { class: cls ?? 'plain' }, text));
  };

  for (const r of ranges) {
    if (r.start < pos) continue;
    plain(src.slice(pos, r.start));
    const text = src.slice(r.start, r.end);
    const state = r.step < current ? 'past' : r.step === current ? 'current' : 'future';
    const el = h(
      'span',
      {
        class: `sent ${state}${trace.steps[r.step].kind === 'error' ? ' err' : ''}`,
        role: 'button',
        tabindex: 0,
        'data-step': r.step,
        onclick: () => hd.onSelect(r.step),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            hd.onSelect(r.step);
          }
        },
        onmouseenter: (e: Event) => hd.onHover(r.step, e.currentTarget as HTMLElement),
        onmouseleave: () => hd.onHover(null, null),
        onfocus: (e: Event) => hd.onHover(r.step, e.currentTarget as HTMLElement),
        onblur: () => hd.onHover(null, null),
      },
      text,
    );
    pre.append(el);
    pos = r.end;
  }
  plain(src.slice(pos));
  return pre;
}
