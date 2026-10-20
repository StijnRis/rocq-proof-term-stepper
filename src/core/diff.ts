import { key, nodeKey, tokensOf, units, type Fun, type Node } from './term';

/**
 * Which tokens of the new term were built by the step, compared to the term
 * before it? Works on the parsed trees so that, e.g., `fun P Q : Prop` becoming
 * `fun (P Q : Prop) (p : P)` highlights only `p : P`.
 *
 * Returns the ids of the new tokens.
 */
export function diffTerms(oldTree: Node[] | undefined, newTree: Node[]): Set<number> {
  const marks = new Set<number>();
  if (!oldTree) return marks;
  diffSeq(oldTree, newTree, marks);
  return marks;
}

function markAll(n: Node | Node[], marks: Set<number>) {
  for (const t of tokensOf(n)) marks.add(t.id);
}

function pairable(o: Node, n: Node): boolean {
  if (o.k !== n.k) return false;
  if (o.k === 'group') return o.open.text === (n as typeof o).open.text;
  return o.k !== 'tok';
}

function lcs(a: string[], b: string[]): [number, number][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) (out.push([i, j]), i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

function diffSeq(o: Node[], n: Node[], marks: Set<number>) {
  const matches = lcs(o.map(nodeKey), n.map(nodeKey));
  let oi = 0;
  let ni = 0;
  const gap = (oEnd: number, nEnd: number) => {
    let p = oi;
    for (; ni < nEnd; ni++) {
      const node = n[ni];
      let q = p;
      while (q < oEnd && !pairable(o[q], node)) q++;
      if (q < oEnd) {
        diffNode(o[q], node, marks);
        p = q + 1;
      } else markAll(node, marks);
    }
  };
  for (const [mi, mj] of matches) {
    gap(mi, mj);
    oi = mi + 1;
    ni = mj + 1;
  }
  gap(o.length, n.length);
}

function diffNode(o: Node, n: Node, marks: Set<number>) {
  switch (n.k) {
    case 'group':
      return diffSeq((o as typeof n).items, n.items, marks);
    case 'fun':
      return diffFun(o as Fun, n, marks);
    case 'let': {
      const ol = o as typeof n;
      if (key(ol.head) !== key(n.head)) markAll(n.head, marks);
      diffSeq(ol.value, n.value, marks);
      return diffSeq(ol.body, n.body, marks);
    }
    case 'match': {
      const om = o as typeof n;
      diffSeq(om.scrut, n.scrut, marks);
      n.branches.forEach((b, i) => {
        const ob = om.branches[i];
        if (ob && key(ob.pat) === key(b.pat)) diffSeq(ob.body, b.body, marks);
        else markAll(b.pat.concat(b.body), marks), marks.add(b.bar.id), marks.add(b.arrow.id);
      });
      return;
    }
    case 'if': {
      const oi = o as typeof n;
      diffSeq(oi.cond, n.cond, marks);
      diffSeq(oi.thenB, n.thenB, marks);
      return diffSeq(oi.elseB, n.elseB, marks);
    }
    case 'tok':
      return;
  }
}

function diffFun(o: Fun, n: Fun, marks: Set<number>) {
  if (o.groups && n.groups) {
    const ou = units(o);
    const nu = units(n);
    const k = (u: (typeof ou)[number]) => `${u.name.text}:${key(u.group.type)}`;
    const kept = new Set(lcs(ou.map(k), nu.map(k)).map(([, j]) => j));
    nu.forEach((u, j) => {
      if (!kept.has(j)) marks.add(u.name.id);
    });
    // A group whose names are all new is new as a whole (parentheses, type).
    for (const g of n.groups) {
      if (g.names.every((t) => marks.has(t.id))) {
        markAll(g.type, marks);
        for (const t of [g.open, g.close, g.colon]) if (t) marks.add(t.id);
      }
    }
  } else if (key(o.rawBinders) !== key(n.rawBinders)) markAll(n.rawBinders, marks);
  diffSeq(o.body, n.body, marks);
}
