/** Splits a Rocq script into sentences, keeping source ranges for highlighting. */
export interface Sentence {
  text: string;
  /** Range in the script, from the first token to the closing period. */
  start: number;
  end: number;
}

export function splitSentences(src: string): Sentence[] {
  const out: Sentence[] = [];
  let i = 0;
  let start = -1;
  const n = src.length;

  const push = (end: number) => {
    out.push({ text: src.slice(start, end).trim(), start, end });
    start = -1;
  };

  while (i < n) {
    const c = src[i];
    // comments (nested)
    if (c === '(' && src[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (src[i] === '(' && src[i + 1] === '*') (depth++, (i += 2));
        else if (src[i] === '*' && src[i + 1] === ')') (depth--, (i += 2));
        else i++;
      }
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (start < 0) {
      start = i;
      // Focusing sentences have no period: braces and bullets stand alone.
      if (c === '{' || c === '}') {
        i++;
        push(i);
        continue;
      }
      if ((c === '-' || c === '+' || c === '*') && !/[\w(]/.test(src[i + 1] ?? ' ')) {
        let j = i;
        while (src[j] === c) j++;
        if (j >= n || /\s/.test(src[j])) {
          i = j;
          push(i);
          continue;
        }
      }
    }
    if (c === '"') {
      i++;
      while (i < n) {
        if (src[i] === '"' && src[i + 1] === '"') i += 2;
        else if (src[i] === '"') break;
        else i++;
      }
      i++;
      continue;
    }
    if (c === '.' && (i + 1 >= n || /\s/.test(src[i + 1]))) {
      i++;
      push(i);
      continue;
    }
    i++;
  }
  if (start >= 0 && src.slice(start).trim() !== '') push(n);
  return out;
}
