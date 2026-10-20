/** A tiny Wadler-style pretty printer producing lines of styled segments. */

export interface Seg {
  text: string;
  cls?: string;
  /** Hole name for `?Goal` pills (hover / click target). */
  hole?: string;
  /** Collapsible chip key. When set, clicking toggles it. */
  chip?: string;
  /** Token ids this segment came from (for tests / linking). */
  tok?: number;
}
export type Line = Seg[];

export type Doc =
  | { t: 'text'; seg: Seg }
  | { t: 'cat'; docs: Doc[] }
  | { t: 'nest'; n: number; doc: Doc }
  | { t: 'line'; flat: string }
  | { t: 'hard' }
  | { t: 'group'; doc: Doc };

export const text = (s: string, cls?: string, extra: Partial<Seg> = {}): Doc => ({ t: 'text', seg: { text: s, cls, ...extra } });
export const seg = (seg: Seg): Doc => ({ t: 'text', seg });
export const cat = (...docs: Doc[]): Doc => ({ t: 'cat', docs });
export const nest = (n: number, doc: Doc): Doc => ({ t: 'nest', n, doc });
export const line = (flat = ' '): Doc => ({ t: 'line', flat });
export const hard: Doc = { t: 'hard' };
export const group = (doc: Doc): Doc => ({ t: 'group', doc });

type Item = { indent: number; flat: boolean; doc: Doc };

function fits(width: number, rest: Item[], first: Item): boolean {
  const work: Item[] = [first];
  let ri = rest.length - 1;
  let w = width;
  while (w >= 0) {
    let it = work.pop();
    if (!it) {
      if (ri < 0) return true;
      it = rest[ri--];
    }
    const d = it.doc;
    switch (d.t) {
      case 'text':
        w -= d.seg.text.length;
        break;
      case 'cat':
        for (let k = d.docs.length - 1; k >= 0; k--) work.push({ ...it, doc: d.docs[k] });
        break;
      case 'nest':
        work.push({ ...it, doc: d.doc, indent: it.indent + d.n });
        break;
      case 'group':
        work.push({ ...it, doc: d.doc });
        break;
      case 'line':
        if (it.flat) w -= d.flat.length;
        else return true;
        break;
      case 'hard':
        return true;
    }
  }
  return false;
}

export function render(doc: Doc, width: number): Line[] {
  const lines: Line[] = [[]];
  let col = 0;
  const work: Item[] = [{ indent: 0, flat: false, doc }];
  while (work.length) {
    const it = work.pop()!;
    const d = it.doc;
    switch (d.t) {
      case 'text':
        lines[lines.length - 1].push(d.seg);
        col += d.seg.text.length;
        break;
      case 'cat':
        for (let k = d.docs.length - 1; k >= 0; k--) work.push({ ...it, doc: d.docs[k] });
        break;
      case 'nest':
        work.push({ ...it, doc: d.doc, indent: it.indent + d.n });
        break;
      case 'group': {
        const flat = it.flat || fits(width - col, work, { ...it, flat: true, doc: d.doc });
        work.push({ ...it, flat, doc: d.doc });
        break;
      }
      case 'line':
        if (it.flat) {
          lines[lines.length - 1].push({ text: d.flat });
          col += d.flat.length;
        } else {
          lines.push(it.indent ? [{ text: ' '.repeat(it.indent) }] : []);
          col = it.indent;
        }
        break;
      case 'hard':
        lines.push(it.indent ? [{ text: ' '.repeat(it.indent) }] : []);
        col = it.indent;
        break;
    }
  }
  return lines;
}
