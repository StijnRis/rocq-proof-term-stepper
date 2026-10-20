import type { TermSpan } from './types';

/**
 * A small parser for the text of `Show Proof.`. It understands only the
 * structure we need (parentheses, `fun`, `let`, `match`, `if`); types and
 * notations are kept as plain token runs, exactly as Coq printed them.
 */

export type TokKind = 'open' | 'close' | 'word' | 'hole' | 'sym' | 'str';

export interface Token {
  id: number;
  text: string;
  kind: TokKind;
  /** Coq's own tag for this text (`constr.keyword`, `constr.evar`, ...). */
  tag?: string;
  /** Whether whitespace preceded the token in Coq's output. */
  sp: boolean;
  start: number;
  end: number;
}

export interface Tok {
  k: 'tok';
  t: Token;
}
export interface Group {
  k: 'group';
  open: Token;
  items: Node[];
  close: Token;
}
/** One binder name with the type it shares with its group. */
export interface Unit {
  name: Token;
  /** Group this unit was written in, and its position (to rebuild raw layout). */
  group: BinderGroup;
}
export interface BinderGroup {
  open?: Token;
  close?: Token;
  names: Token[];
  colon?: Token;
  type: Node[];
}
export interface Fun {
  k: 'fun';
  kw: Token;
  /** Parsed binder groups, or `undefined` when the binders are not simple (patterns). */
  groups?: BinderGroup[];
  rawBinders: Node[];
  arrow: Token;
  body: Node[];
}
export interface Let {
  k: 'let';
  kw: Token;
  head: Node[];
  assign: Token;
  value: Node[];
  inKw: Token;
  body: Node[];
}
export interface Branch {
  bar: Token;
  pat: Node[];
  arrow: Token;
  body: Node[];
}
export interface Match {
  k: 'match';
  kw: Token;
  scrut: Node[];
  withKw: Token;
  branches: Branch[];
  endKw?: Token;
}
export interface If {
  k: 'if';
  kw: Token;
  cond: Node[];
  thenKw: Token;
  thenB: Node[];
  elseKw: Token;
  elseB: Node[];
}
export type Node = Tok | Group | Fun | Let | Match | If;

// ---------------------------------------------------------------- tokenizer

const TOKEN =
  /(\s+)|("(?:[^"]|"")*")|(\?[\p{L}_][\p{L}\p{N}_']*)|([\p{L}_@][\p{L}\p{N}_'.@]*|\d+)|([(\[{])|([)\]}])|([^\s()[\]{}\p{L}\p{N}_'?"]+|[?'])/uy;

export function tokenize(spans: TermSpan[]): Token[] {
  let text = '';
  const tags: (string | undefined)[] = [];
  for (const s of spans) {
    text += s.t;
    for (let i = 0; i < s.t.length; i++) tags.push(s.g);
  }
  const out: Token[] = [];
  let sp = false;
  TOKEN.lastIndex = 0;
  let id = 0;
  while (TOKEN.lastIndex < text.length) {
    const start = TOKEN.lastIndex;
    const m = TOKEN.exec(text);
    if (!m) throw new Error(`Cannot tokenize at ${start}: ${text.slice(start, start + 20)}`);
    if (m[1] !== undefined) {
      sp = true;
      continue;
    }
    const kind: TokKind = m[2] !== undefined ? 'str' : m[3] !== undefined ? 'hole' : m[4] !== undefined ? 'word' : m[5] !== undefined ? 'open' : m[6] !== undefined ? 'close' : 'sym';
    out.push({ id: id++, text: m[0], kind, tag: tags[start], sp, start, end: TOKEN.lastIndex });
    sp = false;
  }
  return out;
}

// ------------------------------------------------------------------- parser

const isKw = (t: Token | undefined, w: string) => t !== undefined && t.kind === 'word' && t.text === w;

export function parseTerm(tokens: Token[]): Node[] {
  let i = 0;
  const peek = () => tokens[i];

  const seq = (stops: string[], closeAt = true): Node[] => {
    const items: Node[] = [];
    for (;;) {
      const t = peek();
      if (!t) break;
      if (closeAt && t.kind === 'close') break;
      if ((t.kind === 'word' || t.kind === 'sym') && stops.includes(t.text)) break;
      items.push(item(stops));
    }
    return items;
  };

  const expect = (w: string): Token => {
    const t = peek();
    if (!t || t.text !== w) throw new Error(`expected «${w}» but found «${t?.text ?? 'end'}»`);
    i++;
    return t;
  };

  const item = (outer: string[]): Node => {
    const t = tokens[i];
    if (t.kind === 'open') {
      i++;
      const items = seq([]);
      const close = peek();
      if (!close || close.kind !== 'close') throw new Error('unbalanced parenthesis');
      i++;
      return { k: 'group', open: t, items, close };
    }
    if (isKw(t, 'fun')) {
      i++;
      const rawBinders = seq(['=>']);
      const arrow = expect('=>');
      const body = seq(outer);
      return { k: 'fun', kw: t, groups: binderGroups(rawBinders), rawBinders, arrow, body };
    }
    if (isKw(t, 'let') && !tokens[i + 1]?.text.startsWith('(') ) {
      i++;
      const head = seq([':=']);
      const assign = expect(':=');
      const value = seq(['in']);
      const inKw = expect('in');
      const body = seq(outer);
      return { k: 'let', kw: t, head, assign, value, inKw, body };
    }
    if (isKw(t, 'match')) {
      i++;
      const scrut = seq(['with']);
      const withKw = expect('with');
      const branches: Branch[] = [];
      while (peek() && peek()!.text === '|' ) {
        const bar = peek()!;
        i++;
        const pat = seq(['=>']);
        const arrow = expect('=>');
        const body = seq(['|', 'end']);
        branches.push({ bar, pat, arrow, body });
      }
      const endKw = isKw(peek(), 'end') ? tokens[i++] : undefined;
      return { k: 'match', kw: t, scrut, withKw, branches, endKw };
    }
    if (isKw(t, 'if')) {
      i++;
      const cond = seq(['then']);
      const thenKw = expect('then');
      const thenB = seq(['else']);
      const elseKw = expect('else');
      const elseB = seq(outer);
      return { k: 'if', kw: t, cond, thenKw, thenB, elseKw, elseB };
    }
    i++;
    return { k: 'tok', t };
  };

  const top = seq([], false);
  if (i < tokens.length) throw new Error(`unexpected «${tokens[i].text}»`);
  return top;
}

/** `(a b : T) (c : U)` or `a b : T` -> binder groups; undefined for patterns. */
function binderGroups(nodes: Node[]): BinderGroup[] | undefined {
  if (nodes.length === 0) return [];
  const names = (ns: Node[]): Token[] | undefined => {
    const out: Token[] = [];
    for (const n of ns) {
      if (n.k !== 'tok' || n.t.kind !== 'word') return undefined;
      out.push(n.t);
    }
    return out;
  };
  if (nodes.every((n) => n.k === 'group')) {
    const groups: BinderGroup[] = [];
    for (const n of nodes as Group[]) {
      const colon = n.items.findIndex((x) => x.k === 'tok' && x.t.text === ':');
      const nm = names(colon < 0 ? n.items : n.items.slice(0, colon));
      if (!nm || nm.length === 0) return undefined;
      groups.push({
        open: n.open,
        close: n.close,
        names: nm,
        colon: colon < 0 ? undefined : (n.items[colon] as Tok).t,
        type: colon < 0 ? [] : n.items.slice(colon + 1),
      });
    }
    return groups;
  }
  const colon = nodes.findIndex((x) => x.k === 'tok' && x.t.text === ':');
  const nm = names(colon < 0 ? nodes : nodes.slice(0, colon));
  if (!nm || nm.length === 0) return undefined;
  return [{ names: nm, colon: colon < 0 ? undefined : (nodes[colon] as Tok).t, type: colon < 0 ? [] : nodes.slice(colon + 1) }];
}

export function units(f: Fun): Unit[] {
  return (f.groups ?? []).flatMap((g) => g.names.map((name) => ({ name, group: g })));
}

// ------------------------------------------------------------- structure keys

/** Canonical text of a node list, used to decide equality between steps. */
export function key(nodes: Node[]): string {
  return nodes.map(nodeKey).join(' ');
}
export function nodeKey(n: Node): string {
  switch (n.k) {
    case 'tok':
      return n.t.text;
    case 'group':
      return `${n.open.text}${key(n.items)}${n.close.text}`;
    case 'fun':
      return n.groups
        ? `fun[${units({ ...n }).map((u) => `${u.name.text}:${key(u.group.type)}`).join(',')}]=>${key(n.body)}`
        : `fun{${key(n.rawBinders)}}=>${key(n.body)}`;
    case 'let':
      return `let ${key(n.head)} := ${key(n.value)} in ${key(n.body)}`;
    case 'match':
      return `match ${key(n.scrut)} with ${n.branches.map((b) => `|${key(b.pat)}=>${key(b.body)}`).join('')} end`;
    case 'if':
      return `if ${key(n.cond)} then ${key(n.thenB)} else ${key(n.elseB)}`;
  }
}

/** All tokens of a node, in source order. */
export function tokensOf(n: Node | Node[]): Token[] {
  const out: Token[] = [];
  const go = (x: Node) => {
    switch (x.k) {
      case 'tok':
        out.push(x.t);
        break;
      case 'group':
        out.push(x.open);
        x.items.forEach(go);
        out.push(x.close);
        break;
      case 'fun':
        out.push(x.kw);
        x.rawBinders.forEach(go);
        out.push(x.arrow);
        x.body.forEach(go);
        break;
      case 'let':
        out.push(x.kw);
        x.head.forEach(go);
        out.push(x.assign);
        x.value.forEach(go);
        out.push(x.inKw);
        x.body.forEach(go);
        break;
      case 'match':
        out.push(x.kw);
        x.scrut.forEach(go);
        out.push(x.withKw);
        for (const b of x.branches) {
          out.push(b.bar);
          b.pat.forEach(go);
          out.push(b.arrow);
          b.body.forEach(go);
        }
        if (x.endKw) out.push(x.endKw);
        break;
      case 'if':
        out.push(x.kw);
        x.cond.forEach(go);
        out.push(x.thenKw);
        x.thenB.forEach(go);
        out.push(x.elseKw);
        x.elseB.forEach(go);
        break;
    }
  };
  (Array.isArray(n) ? n : [n]).forEach(go);
  return out.sort((a, b) => a.start - b.start);
}

export const isHole = (t: Token) => t.kind === 'hole';

/** Parses recorded spans into tokens + tree. */
export function parseSpans(spans: TermSpan[]): { tokens: Token[]; tree: Node[]; text: string } {
  const tokens = tokenize(spans);
  return { tokens, tree: parseTerm(tokens), text: spans.map((s) => s.t).join('') };
}
