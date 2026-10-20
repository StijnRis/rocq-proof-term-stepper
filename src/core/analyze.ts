import { diffTerms } from './diff';
import { parseSpans, type Node, type Token } from './term';
import type { Hole, Step, Trace } from './types';

export interface Parsed {
  tokens: Token[];
  tree: Node[];
  text: string;
}

export interface StepView {
  index: number;
  step: Step;
  parsed?: Parsed;
  /** Token ids built by this step (relative to the previous term). */
  marks: Set<number>;
  /** The closed term, for a Qed step (the term before it). */
  finalTerm?: Parsed;
  /** What Coq built, as a slice of its own output. */
  built?: string;
}

const cache = new WeakMap<Trace, Map<number, StepView>>();

function parse(step: Step | undefined): Parsed | undefined {
  if (!step?.term?.length) return undefined;
  try {
    return parseSpans(step.term);
  } catch (e) {
    console.warn('term parse failed, falling back to raw', e);
    return undefined;
  }
}

const squash = (x: string) => x.replace(/\s+/g, '');
/** A hole's identity is its goal (context and conclusion), not its name: Coq reuses names. */
const holeKey = (h: Hole) => squash(`${h.hyps.map((x) => `${x.names.join(',')}:${x.body ?? ''}:${x.type}`).join(';')}⊢${h.goal}`);

/**
 * Holes are "new" when their goal was not already open before the step: the
 * hole `?Goal` after `split` is a new goal (P) even though Coq reused the name.
 */
function markHoles(parsed: Parsed, step: Step, prev: Step | undefined, marks: Set<number>) {
  const before = new Map<string, number>();
  for (const h of prev?.holes ?? []) before.set(holeKey(h), (before.get(holeKey(h)) ?? 0) + 1);
  for (const t of parsed.tokens) {
    if (t.kind !== 'hole') continue;
    const info = step.holes.find((h) => h.name === t.text);
    const k = info ? holeKey(info) : undefined;
    const n = k ? (before.get(k) ?? 0) : 0;
    if (k && n > 0) {
      before.set(k, n - 1);
      marks.delete(t.id);
    } else marks.add(t.id);
  }
}

export function analyze(trace: Trace, index: number): StepView {
  let m = cache.get(trace);
  if (!m) cache.set(trace, (m = new Map()));
  const hit = m.get(index);
  if (hit) return hit;

  const step = trace.steps[index];
  const parsed = parse(step);
  const prevStep = index > 0 && step.kind !== 'start' ? trace.steps[index - 1] : undefined;
  const prev = prevStep?.kind === 'qed' ? undefined : parse(prevStep);
  const marks = parsed && prev ? diffTerms(prev.tree, parsed.tree) : new Set<number>();
  if (parsed && prev) markHoles(parsed, step, prevStep, marks);
  const view: StepView = { index, step, parsed, marks };

  if (parsed && marks.size) {
    const toks = parsed.tokens.filter((t) => marks.has(t.id));
    const slice = parsed.text.slice(toks[0].start, toks.at(-1)!.end).replace(/\s+/g, ' ');
    view.built = slice;
  }
  if (step.kind === 'qed') {
    for (let j = index - 1; j >= 0; j--) {
      if (trace.steps[j].term) {
        view.finalTerm = parse(trace.steps[j]);
        break;
      }
    }
  }
  m.set(index, view);
  return view;
}
