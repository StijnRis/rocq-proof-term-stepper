/**
 * Coq's pretty-printing documents ("Pp"), as sent by jsCoq. Boxes carry the
 * layout Coq would use; we only need the text and the semantic tags
 * (`constr.evar`, `constr.keyword`, ...) that Coq itself attaches.
 */
export type Pp =
  | ['Pp_empty']
  | ['Pp_string', string]
  | ['Pp_glue', Pp[]]
  | ['Pp_box', unknown, Pp]
  | ['Pp_tag', string, Pp]
  | ['Pp_print_break', number, number]
  | ['Pp_force_newline']
  | ['Pp_comment', string[]];

/** A run of text with the innermost Coq tag it was printed under. */
export interface Span {
  text: string;
  tag?: string;
}

export function ppSpans(pp: Pp): Span[] {
  const out: Span[] = [];
  const go = (p: Pp, tag?: string) => {
    switch (p[0]) {
      case 'Pp_empty':
        return;
      case 'Pp_string':
        if (p[1] !== '') out.push({ text: p[1], tag });
        return;
      case 'Pp_glue':
        for (const c of p[1]) go(c, tag);
        return;
      case 'Pp_box':
        go(p[2], tag);
        return;
      case 'Pp_tag':
        go(p[2], p[1]);
        return;
      case 'Pp_print_break':
        out.push({ text: ' '.repeat(Math.max(1, p[1])), tag: undefined });
        return;
      case 'Pp_force_newline':
        out.push({ text: '\n', tag: undefined });
        return;
      case 'Pp_comment':
        out.push({ text: p[1].join(' '), tag });
        return;
    }
  };
  go(pp);
  return out;
}

/** Plain text of a Pp, with every line break collapsed to one space. */
export function ppText(pp: Pp): string {
  return ppSpans(pp)
    .map((s) => s.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plain text keeping Coq's forced newlines (used for messages/goal lists). */
export function ppMultiline(pp: Pp): string {
  return ppSpans(pp)
    .map((s) => s.text)
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

/**
 * Splits "Show Existentials." output into one Pp per `Existential N = ...`
 * entry; Coq separates them with forced newlines at the top level.
 */
export function ppTopLevelLines(pp: Pp): Pp[] {
  const lines: Pp[][] = [[]];
  const flat = (p: Pp): Pp[] => (p[0] === 'Pp_glue' ? p[1].flatMap(flat) : [p]);
  for (const part of flat(pp)) {
    if (part[0] === 'Pp_force_newline') lines.push([]);
    else lines[lines.length - 1].push(part);
  }
  return lines.filter((l) => l.length).map((l) => ['Pp_glue', l] as Pp);
}
