import { describe, expect, it } from 'vitest';
import gallery from '../src/data/gallery.json';
import { findInduction } from '../src/core/induction';
import { parseSpans } from '../src/core/term';
import type { Trace } from '../src/core/types';

const G = gallery as unknown as Record<string, Trace>;

describe('induction detection', () => {
  it('finds nat_ind with the IH on the step case', () => {
    const s = G['induction'].steps.find((x) => /^induction/.test(x.text))!;
    const info = findInduction(parseSpans(s.term!).tree)!;
    expect(info.head.text).toBe('nat_ind');
    expect(info.cases).toHaveLength(2);
    expect(info.cases[0].ih).toBeUndefined();
    expect(info.cases[1].ih?.name.text).toBe("IHn'");
    expect(info.cases[1].ih?.recursiveVar.text).toBe("n'");
  });
  it('finds list_ind', () => {
    const s = G['induction-list'].steps.find((x) => /^induction/.test(x.text))!;
    const info = findInduction(parseSpans(s.term!).tree)!;
    expect(info.head.text).toBe('list_ind');
    expect(info.cases[1].ih?.name.text).toBe('IHt');
  });
  it('does not mistake eq_ind / or_ind-like eliminators for induction', () => {
    for (const id of ['rewrite', 'rewrite-back', 'discriminate', 'destruct', 'destruct-nat', 'split', 'exists']) {
      for (const s of G[id].steps) if (s.term?.length) expect(findInduction(parseSpans(s.term).tree), `${id}: ${s.text}`).toBeUndefined();
    }
  });
});
