import type { CoqMessage, ExecResult, RawGoal } from '../engine/coq';
import { ppMultiline, ppSpans, ppText, ppTopLevelLines, type Pp } from '../engine/pp';
import { splitSentences } from './script';
import type { Hole, Hyp, Range, Step, TermSpan, Trace } from './types';

/** What the trace builder needs from Coq (the jsCoq client implements it). */
export interface Runner {
  exec(sentence: string): Promise<ExecResult>;
  goals(): Promise<RawGoal[] | null>;
}

const squash = (s: string) => s.replace(/\s+/g, '');

const notices = (ms: CoqMessage[]) => ms.filter((m) => m.level !== 'Debug');
const lastNotice = (ms: CoqMessage[]) => notices(ms).filter((m) => m.level === 'Notice').at(-1);

/**
 * Parses one `Existential N = ?Name : [ctx |- goal]` line. Coq separates the
 * hypotheses with a break of width 2 (see Pp_print_break(2,0) in the output),
 * single breaks never appear between hypotheses.
 */
export function parseExistential(pp: Pp): { name: string; hyps: Hyp[]; goal: string } | undefined {
  const text = ppSpans(pp)
    .map((s) => s.text)
    .join('');
  const m = /^Existential \d+ =\s*(\?[^\s:]+) : \[([\s\S]*)\]$/.exec(text.trim());
  if (!m) return undefined;
  const inner = m[2];
  const bar = inner.lastIndexOf('|-');
  const ctx = inner.slice(0, bar).trim();
  const goal = inner.slice(bar + 2).replace(/\s+/g, ' ').trim();
  const hyps: Hyp[] = ctx
    ? ctx.split(/ {2,}/).map((h) => {
        const body = /^(.+?) := (.+) : (.+)$/.exec(h);
        if (body) return { names: body[1].split(/,\s*/), body: body[2], type: body[3] };
        const i = h.indexOf(' : ');
        return { names: h.slice(0, i).split(/,\s*/), type: h.slice(i + 3) };
      })
    : [];
  return { name: m[1], hyps, goal };
}

const goalKey = (hyps: Hyp[], goal: string) =>
  squash(
    hyps
      .flatMap((h) => h.names.map((n) => `${n}${h.body ? ':=' + h.body : ''}:${h.type}`))
      .sort()
      .join('|') +
      '⊢' +
      goal,
  );

function rawGoalKey(g: RawGoal) {
  const hyps: Hyp[] = g.hyps.map((h) => ({
    names: h.names,
    body: h.body ? ppText(h.body) : undefined,
    type: ppText(h.type),
  }));
  return goalKey(hyps, ppText(g.ty));
}

async function snapshot(r: Runner): Promise<{ term: TermSpan[]; holes: Hole[] }> {
  const proof = await r.exec('Show Proof.');
  const ex = await r.exec('Show Existentials.');
  const goals = (await r.goals()) ?? [];
  const pp = lastNotice(proof.messages)?.pp;
  const term: TermSpan[] = pp ? ppSpans(pp).map((s) => (s.tag ? { t: s.text, g: s.tag } : { t: s.text })) : [];

  const parsed = (ex.messages.length ? ppTopLevelLines(lastNotice(ex.messages)!.pp) : [])
    .map(parseExistential)
    .filter((x): x is NonNullable<typeof x> => !!x);

  const keys = goals.map(rawGoalKey);
  const used = new Set<number>();
  const holes: Hole[] = parsed.map((p) => {
    const k = goalKey(p.hyps, p.goal);
    let order = keys.findIndex((gk, i) => gk === k && !used.has(i));
    if (order >= 0) used.add(order);
    return { name: p.name, hyps: p.hyps, goal: p.goal, order };
  });
  holes.sort((a, b) => (a.order < 0 ? 1e9 : a.order) - (b.order < 0 ? 1e9 : b.order));
  return { term, holes };
}

const STATEMENT = /^\s*(?:Local\s+|Global\s+)?(?:Theorem|Lemma|Fact|Remark|Corollary|Proposition|Example|Definition|Let)\s+([^\s:({[]+)/;
const CLOSERS = /^(Qed|Defined|Admitted|Abort|Save)\b/;

export async function buildTrace(
  r: Runner,
  coqVersion: string,
  script: string,
  onStep?: (n: number) => void,
): Promise<Trace> {
  const trace: Trace = { coq: coqVersion, script, setup: [], steps: [] };
  let inProof = false;
  let name: string | undefined;
  let startStep: Step | undefined;

  for (const s of splitSentences(script)) {
    const range: Range = { start: s.start, end: s.end };
    const res = await r.exec(s.text);
    if (!res.ok) {
      trace.steps.push({
        kind: 'error',
        text: s.text,
        ranges: [range],
        holes: [],
        messages: [],
        error: res.error ? ppMultiline(res.error) : 'Error',
      });
      break;
    }
    const messages = notices(res.messages).map((m) => ppMultiline(m.pp));
    const nowInProof = (await r.goals()) !== null;

    if (!inProof && nowInProof) {
      name = STATEMENT.exec(s.text)?.[1];
      const snap = await snapshot(r);
      startStep = { kind: 'start', text: s.text, ranges: [range], ...snap, messages };
      trace.steps.push(startStep);
    } else if (inProof && nowInProof) {
      if (startStep && /^Proof\b/.test(s.text) && trace.steps.at(-1) === startStep) {
        startStep.ranges.push(range);
      } else {
        const snap = await snapshot(r);
        trace.steps.push({ kind: 'tactic', text: s.text, ranges: [range], ...snap, messages });
      }
    } else if (inProof && !nowInProof) {
      const keyword = CLOSERS.exec(s.text)?.[1] ?? 'Qed';
      const qed: Step['qed'] = { name, messages, keyword };
      if (name && (keyword === 'Qed' || keyword === 'Defined' || keyword === 'Save')) {
        const chk = await r.exec(`Check ${name}.`);
        const c = lastNotice(chk.messages);
        if (c) qed.check = ppMultiline(c.pp);
        const asm = await r.exec(`Print Assumptions ${name}.`);
        const a = lastNotice(asm.messages);
        if (a) qed.assumptions = ppMultiline(a.pp);
      }
      trace.steps.push({ kind: 'qed', text: s.text, ranges: [range], holes: [], messages, qed });
    } else {
      trace.setup.push(range);
    }
    inProof = nowInProof;
    onStep?.(trace.steps.length);
  }
  return trace;
}
