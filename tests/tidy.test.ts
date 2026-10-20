import { describe, expect, it } from 'vitest';
import gallery from '../src/data/gallery.json';
import { diffTerms } from '../src/core/diff';
import { render } from '../src/core/layout';
import { parseSpans } from '../src/core/term';
import { tidyDoc } from '../src/core/tidy';
import type { Trace } from '../src/core/types';

const G = gallery as unknown as Record<string, Trace>;
const show = (id: string, i: number, width = 60, binderTypes = true, collapse = true) => {
  const steps = G[id].steps;
  const cur = parseSpans(steps[i].term!);
  const prev = i > 0 && steps[i - 1].term ? parseSpans(steps[i - 1].term!) : undefined;
  const marks = diffTerms(prev?.tree, cur.tree);
  const lines = render(tidyDoc(cur.tree, { binderTypes, collapse, expanded: new Set(), marks }), width);
  return lines.map((l) => l.map((s) => (s.cls?.includes('new') && !s.cls.includes('hole') ? `⟦${s.text}⟧` : s.text)).join('')).join('\n');
};

describe('tidy layout', () => {
  it('prints (for the eye)', () => {
    for (const [id, i] of [['intro', 3], ['split', 2], ['induction', 7], ['destruct-nat', 8], ['assert', 4], ['discriminate', 2], ['revert', 2]] as const)
      console.log(`--- ${id} step ${i}\n` + show(id, i));
    expect(true).toBe(true);
  });
  it('keeps every token (nothing lost when collapsed chips are expanded)', () => {
    for (const [id, tr] of Object.entries(G))
      tr.steps.forEach((s, i) => {
        if (!s.term?.length) return;
        const txt = show(id, i, 50, true, false).replace(/[⟦⟧\s]/g, '');
        const raw = s.term.map((x) => x.t).join('').replace(/\s/g, '');
        // tidy normalises `fun P Q : Prop` to `fun (P Q : Prop)`, so compare only when no bare binders
        if (!/fun [^(]/.test(s.term.map((x) => x.t).join(''))) expect(txt, `${id} ${i}`).toBe(raw);
      });
  });
});
