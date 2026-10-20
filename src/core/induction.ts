import { key, tokensOf, units, type Fun, type Node, type Token } from './term';

/**
 * Finds an induction principle application such as
 * `nat_ind (fun n0 => P n0) base (fun n' IHn' => step) n` in a parsed term and
 * works out which case carries the induction hypothesis.
 */
export interface CaseInfo {
  node: Node;
  fun?: Fun;
  /** Binders of a `fun` case, e.g. n' and IHn'. */
  binders: Token[];
  /** Nodes of the case body (the hole or the term filling it). */
  body: Node[];
  /** Set when this case takes an induction hypothesis. */
  ih?: { name: Token; type: string; recursiveVar: Token };
}

export interface InductionInfo {
  head: Token;
  motive: Node;
  cases: CaseInfo[];
  major: Node[];
}

const ELIM = /_(ind|rect|rec)$/;
const norm = (s: string) => s.replace(/\s+/g, '');

function asFun(n: Node): Fun | undefined {
  if (n.k === 'fun') return n;
  if (n.k === 'group' && n.items.length === 1 && n.items[0].k === 'fun') return n.items[0];
  return undefined;
}

function children(n: Node): Node[][] {
  switch (n.k) {
    case 'group':
      return [n.items];
    case 'fun':
      return [n.body];
    case 'let':
      return [n.value, n.body];
    case 'match':
      return [n.scrut, ...n.branches.map((b) => b.body)];
    case 'if':
      return [n.cond, n.thenB, n.elseB];
    default:
      return [];
  }
}

function search(list: Node[]): InductionInfo | undefined {
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (n.k === 'tok' && n.t.kind === 'word' && ELIM.test(n.t.text)) {
      const info = build(n.t, list.slice(i + 1));
      if (info) return info;
    }
  }
  for (const n of list)
    for (const c of children(n)) {
      const r = search(c);
      if (r) return r;
    }
  return undefined;
}

function build(head: Token, args: Node[]): InductionInfo | undefined {
  if (args.length < 3) return undefined;
  const motive = args[0];
  const mf = asFun(motive);
  if (!mf || units(mf).length !== 1) return undefined;
  const mv = units(mf)[0].name.text;
  const mbody = tokensOf(mf.body).map((t) => t.text);

  const cases: CaseInfo[] = args.slice(1, -1).map((node) => {
    const f = asFun(node);
    const us = f ? units(f) : [];
    const info: CaseInfo = { node, fun: f, binders: us.map((u) => u.name), body: f ? f.body : [node] };
    if (f && us.length >= 2) {
      const ihU = us.at(-1)!;
      const rec = us.at(-2)!;
      const expected = mbody.map((t) => (t === mv ? rec.name.text : t)).join('');
      if (norm(key(ihU.group.type)) === norm(expected) || norm(tokensOf(ihU.group.type).map((t) => t.text).join('')) === norm(expected))
        info.ih = { name: ihU.name, type: tokensOf(ihU.group.type).map((t) => t.text).join(' '), recursiveVar: rec.name };
    }
    return info;
  });
  if (!cases.some((c) => c.ih)) return undefined;
  return { head, motive, cases, major: [args.at(-1)!] };
}

export function findInduction(tree: Node[]): InductionInfo | undefined {
  return search(tree);
}
