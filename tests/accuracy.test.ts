import { describe, expect, it } from 'vitest';
import gallery from '../src/data/gallery.json';
import { diffTerms } from '../src/core/diff';
import { analyze } from '../src/core/analyze';
import { parseSpans } from '../src/core/term';
import type { Step, Trace } from '../src/core/types';

/**
 * What each tactic builds, checked against *recorded Coq output* (not against a
 * hand-written table). If Coq ever disagrees, these tests fail and the claim in
 * the UI must change.
 */
const G = gallery as unknown as Record<string, Trace>;
const text = (s: Step) => (s.term ?? []).map((x) => x.t).join('');
const after = (id: string, tactic: RegExp): Step => {
  const s = G[id].steps.find((x) => x.kind === 'tactic' && tactic.test(x.text));
  if (!s) throw new Error(`no step ${tactic} in ${id}`);
  return s;
};
const newText = (id: string, tactic: RegExp) => {
  const steps = G[id].steps;
  const i = steps.indexOf(after(id, tactic));
  const prev = parseSpans(steps[i - 1].term!);
  const cur = parseSpans(steps[i].term!);
  const marks = diffTerms(prev.tree, cur.tree);
  return cur.tokens.filter((t) => marks.has(t.id)).map((t) => t.text);
};

describe('what tactics build (real Show Proof output)', () => {
  it('intros builds fun binders around the remaining hole', () => {
    expect(text(after('intro', /^intros P Q/))).toBe('(fun P Q : Prop => ?Goal)');
    expect(text(after('intro', /^intro p/))).toBe('(fun (P Q : Prop) (p : P) => ?Goal)');
  });
  it('intro only highlights the new binder', () => {
    expect(newText('intro', /^intro p/).sort()).toEqual(['(', ')', ':', 'P', 'p'].sort());
  });
  it('apply puts the hypothesis at the head with a hole argument', () => {
    expect(text(after('apply', /^apply g/))).toMatch(/=> g \?Goal\)$/);
    expect(text(after('apply', /^apply f/))).toMatch(/=> g \(f \?Goal\)\)$/);
  });
  it('exact fills the hole with the term', () => {
    expect(text(after('exact', /^exact p/))).toBe('(fun (P : Prop) (p : P) => p)');
  });
  it('reflexivity is eq_refl', () => {
    expect(text(after('reflexivity', /^reflexivity/))).toBe('eq_refl');
  });
  it('destruct on bool prints if/then/else, on nat a match with one arm per constructor', () => {
    expect(text(after('destruct', /^destruct b/))).toMatch(/if b as b0 return .* then \?Goal else \?Goal0/);
    const nat = text(after('destruct-nat', /^destruct n/));
    expect(nat).toMatch(/match n as n0 return .* with \| 0 => \?Goal \| S n0 => .*\?Goal0.* end/);
  });
  it('induction builds nat_ind / list_ind P base step x', () => {
    expect(text(after('induction', /^induction n/))).toMatch(
      /^\(fun n : nat => nat_ind \(fun n0 : nat => .*\) \?Goal \(fun \(n' : nat\) \(IHn' : .*\) => \?Goal0\) n\)$/,
    );
    expect(text(after('induction-list', /^induction l/))).toMatch(/list_ind \(fun .*\) \?Goal \(fun \(h : nat\) \(t : list nat\) \(IHt : .*\) => \?Goal0\) l/);
  });
  it('split builds conj, not exist', () => {
    expect(text(after('split', /^split/))).toMatch(/=> conj \?Goal \?Goal0\)$/);
    expect(text(after('split', /^split/))).not.toMatch(/exist/);
  });
  it('left/right build or_introl/or_intror', () => {
    expect(text(after('left', /^left/))).toMatch(/or_introl \?Goal/);
    expect(text(after('right', /^right/))).toMatch(/or_intror \?Goal/);
  });
  it('exists builds ex_intro with the witness', () => {
    expect(text(after('exists', /^exists 2/))).toBe('(ex_intro (fun n : nat => n + 1 = 3) 2 ?Goal)');
  });
  it('assert builds a let-in (not a fun applied to a proof) in this Coq', () => {
    expect(text(after('assert', /^assert/))).toMatch(/let H : Q := \?Goal in \?Goal0\)$/);
  });
  it('rewrite builds eq_ind_r (rewrite H) and eq_ind (rewrite <- H) driven by the equation', () => {
    expect(text(after('rewrite', /^rewrite H/))).toMatch(/eq_ind_r \(fun .*\) \?Goal H\)$/);
    expect(text(after('rewrite-back', /^rewrite <- H/))).toMatch(/eq_ind a \(fun .*\) \?Goal b H\)$/);
  });
  it('assumption fills in the hypothesis itself', () => {
    expect(text(after('assumption', /^assumption/))).toBe('(fun (P Q : Prop) (_ : P) (q : Q) => q)');
  });
  it('discriminate goes through False_ind', () => {
    const t = text(after('discriminate', /^discriminate/));
    expect(t).toMatch(/False_ind False H0\)$/);
    expect(t).toMatch(/eq_ind \(S n\)/);
  });
  it('revert does NOT build a fun: the term is a hole applied to the variable', () => {
    const t = text(after('revert', /^revert n/));
    expect(t).toBe('(fun n : nat => ?Goal n)');
    expect(newText('revert', /^revert n/)).toEqual(['n']);
    expect(newText('revert', /^revert n/)).not.toContain('fun');
  });
  it('the fragment a step built (hole goals included) reads naturally', () => {
    const built = (id: string, re: RegExp) => analyze(G[id], G[id].steps.indexOf(after(id, re))).built;
    expect(built('intro', /^intros P Q/)).toBe('(fun P Q : Prop => ?Goal)');
    expect(built('intro', /^intro p/)).toBe('(p : P) => ?Goal');
    expect(built('split', /^split/)).toBe('conj ?Goal ?Goal0');
    expect(built('left', /^left/)).toBe('or_introl ?Goal');
    expect(built('revert', /^revert n/)).toBe('?Goal n');
    expect(built('exact', /^exact p/)).toBe('p');
    expect(built('split', /^exact p/)).toBe('p');
    expect(built('apply', /^apply g/)).toBe('g ?Goal');
  });
  it('bullets build nothing', () => {
    for (const [id, tr] of Object.entries(G))
      tr.steps.forEach((s, i) => {
        if (s.kind === 'tactic' && /^[-+*{}]+$/.test(s.text)) expect(analyze(tr, i).built, `${id} ${i}`).toBeUndefined();
      });
  });
  it('every trace ends with a closed proof and Qed', () => {
    for (const [id, tr] of Object.entries(G)) {
      expect(tr.steps.at(-1)?.kind, id).toBe('qed');
      expect(tr.steps.some((s) => s.kind === 'error'), id).toBe(false);
      const last = tr.steps.at(-2)!;
      expect(last.holes, id).toHaveLength(0);
      expect(text(last), id).not.toMatch(/\?/);
    }
  });
});
