import { cat, group, hard, line, nest, seg, text, type Doc, type Seg } from './layout';
import { isHole, key, tokensOf, units, type BinderGroup, type Branch, type Fun, type Node, type Token } from './term';

export interface TidyOptions {
  /** Show the types of `fun` binders, e.g. `(p : P)` instead of `p`. */
  binderTypes: boolean;
  /** Collapse predicates / return clauses behind chips. */
  collapse: boolean;
  /** Chips the reader expanded, by chip key. */
  expanded: Set<string>;
  /** Token ids built by the current step. */
  marks: Set<number>;
}

const TAG_CLASS: Record<string, string> = {
  'constr.variable': 'var',
  'constr.type': 'ty',
  'constr.notation': 'nt',
  'constr.keyword': 'kw',
  'constr.evar': 'hole',
  'constr.reference': 'ref',
};

const ELIM = /(_ind|_rect|_rec|_ind_r|_rect_r|_rec_r)$/;
const WITNESS_HEADS = new Set(['ex_intro', 'exist', 'existT', 'ex_intro2']);

export function tokenSeg(t: Token, o: TidyOptions): Seg {
  const cls: string[] = [];
  if (t.kind === 'hole') cls.push('hole');
  else if (t.tag && TAG_CLASS[t.tag]) cls.push(TAG_CLASS[t.tag]);
  if (o.marks.has(t.id)) cls.push('new');
  return { text: t.text, cls: cls.join(' ') || undefined, tok: t.id, hole: isHole(t) ? t.text : undefined };
}

class Builder {
  constructor(private o: TidyOptions) {}

  tok = (t: Token): Doc => seg(tokenSeg(t, this.o));
  space = (): Doc => text(' ');

  /** Plain, unbreakable rendering of a node list, keeping Coq's spacing. */
  flat(nodes: Node[], first = true): Doc {
    const toks = tokensOf(nodes);
    const out: Doc[] = [];
    toks.forEach((t, i) => {
      if (i > 0 || !first) {
        if (t.sp && i > 0) out.push(this.space());
      }
      out.push(this.tok(t));
    });
    return cat(...out);
  }

  hasHole(nodes: Node[]) {
    return tokensOf(nodes).some(isHole);
  }

  chip(label: string, k: string, nodes: Node[], marked: boolean): Doc {
    const open = this.o.expanded.has(k);
    if (!this.o.collapse || open) return cat(this.flat(nodes), ...(this.o.collapse ? [seg({ text: ' ⊖', cls: 'chip-toggle', chip: k })] : []));
    const isNew = tokensOf(nodes).some((t) => this.o.marks.has(t.id));
    return seg({ text: label, cls: `chip${isNew || marked ? ' new' : ''}`, chip: k });
  }

  /** A sequence of nodes: an application when no operator is involved. */
  seq(nodes: Node[]): Doc {
    if (nodes.length === 0) return text('');
    const infix = nodes.some((n) => n.k === 'tok' && n.t.kind === 'sym' && n.t.text !== ':');
    const parts: Doc[] = [];
    const headTok = nodes[0].k === 'tok' ? nodes[0].t : undefined;
    const elim = headTok && ELIM.test(headTok.text);
    const wit = headTok && WITNESS_HEADS.has(headTok.text);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const first = tokensOf(n)[0];
      if (i > 0 && first.sp) parts.push(infix ? this.space() : line());

      // `t : T` type ascription (e.g. after simpl): show the type behind a chip.
      if (n.k === 'tok' && n.t.text === ':' && n.t.kind === 'sym') {
        const rest = nodes.slice(i);
        parts.push(this.chip(': …', `asc:${key(rest)}`, rest, false));
        break;
      }
      // Predicate (motive) arguments of eliminators.
      if ((elim || wit) && n.k === 'group' && n.items.length === 1 && n.items[0].k === 'fun') {
        const f = n.items[0] as Fun;
        if (units(f).length === 1 && !this.hasHole(f.body)) {
          const k = `pred:${key([n])}`;
          if (this.o.collapse && !this.o.expanded.has(k)) {
            const nm = units(f)[0].name.text;
            const isNew = tokensOf(n).some((t) => this.o.marks.has(t.id));
            parts.push(seg({ text: `(fun ${nm} => …)`, cls: `chip${isNew ? ' new' : ''}`, chip: k }));
          } else {
            parts.push(this.node(n));
            if (this.o.collapse) parts.push(seg({ text: ' ⊖', cls: 'chip-toggle', chip: k }));
          }
          continue;
        }
      }
      parts.push(this.node(n));
    }
    if (nodes.length === 1) return parts[0];
    return infix ? cat(...parts) : group(nest(2, cat(...parts)));
  }

  binders(f: Fun): Doc {
    if (!f.groups) return this.flat(f.rawBinders);
    const out: Doc[] = [];
    f.groups.forEach((g, i) => {
      if (i > 0) out.push(this.space());
      out.push(this.binderGroup(g));
    });
    return cat(...out);
  }

  binderGroup(g: BinderGroup): Doc {
    const names: Doc[] = [];
    g.names.forEach((n, i) => {
      if (i > 0) names.push(this.space());
      names.push(this.tok(n));
    });
    if (!this.o.binderTypes || !g.colon) {
      return cat(...names);
    }
    const open = g.open ? this.tok(g.open) : seg({ text: '(', cls: this.groupNew(g) ? 'new' : undefined });
    const close = g.close ? this.tok(g.close) : seg({ text: ')', cls: this.groupNew(g) ? 'new' : undefined });
    return cat(open, ...names, text(' '), this.tok(g.colon), text(' '), this.flat(g.type, true), close);
  }

  groupNew(g: BinderGroup) {
    return g.names.every((n) => this.o.marks.has(n.id));
  }

  retClause(nodes: Node[]): Doc {
    // `n as n0 return (T)` : keep the scrutinee, hide the annotation.
    const at = nodes.findIndex((n) => n.k === 'tok' && ['as', 'in', 'return'].includes(n.t.text));
    if (at < 0) return this.seq(nodes);
    const head = nodes.slice(0, at);
    const ann = nodes.slice(at);
    const ret = ann.findIndex((n) => n.k === 'tok' && n.t.text === 'return');
    const label = [...ann.slice(0, ret < 0 ? ann.length : ret).map((n) => tokensOf(n).map((t) => t.text).join('')), 'return …'].join(' ');
    return cat(this.seq(head), this.space(), this.chip(label, `ret:${key(ann)}`, ann, false));
  }

  branch(b: Branch): Doc {
    return cat(this.tok(b.bar), text(' '), this.flat(b.pat), text(' '), this.tok(b.arrow), group(nest(4, cat(line(), this.seq(b.body)))));
  }

  node(n: Node): Doc {
    switch (n.k) {
      case 'tok':
        return this.tok(n.t);
      case 'group': {
        // A parenthesised single construct keeps its content together.
        return cat(this.tok(n.open), nest(1, this.seq(n.items)), this.tok(n.close));
      }
      case 'fun':
        return group(cat(this.tok(n.kw), text(' '), this.binders(n), text(' '), this.tok(n.arrow), nest(2, cat(line(), this.seq(n.body)))));
      case 'let':
        return cat(
          group(cat(this.tok(n.kw), text(' '), this.flat(n.head), text(' '), this.tok(n.assign), nest(2, cat(line(), this.seq(n.value))), text(' '), this.tok(n.inKw))),
          hard,
          this.seq(n.body),
        );
      case 'match': {
        const bs = n.branches.map((b) => cat(hard, this.branch(b)));
        return cat(this.tok(n.kw), text(' '), this.retClause(n.scrut), text(' '), this.tok(n.withKw), nest(2, cat(...bs)), ...(n.endKw ? [hard, this.tok(n.endKw)] : []));
      }
      case 'if':
        return group(
          cat(
            this.tok(n.kw),
            text(' '),
            this.retClause(n.cond),
            nest(2, cat(line(), this.tok(n.thenKw), text(' '), this.seq(n.thenB), line(), this.tok(n.elseKw), text(' '), this.seq(n.elseB))),
          ),
        );
    }
  }
}

export function tidyDoc(tree: Node[], o: TidyOptions): Doc {
  return new Builder(o).seq(tree);
}
