/** Data model of a recorded run. Everything in here is real Coq output. */

/** A piece of printed text and the innermost Coq pretty-printer tag it had. */
export interface TermSpan {
  t: string;
  g?: string;
}

export interface Hyp {
  names: string[];
  body?: string;
  type: string;
}

export interface Hole {
  /** Evar name exactly as Coq prints it in the term, e.g. `?Goal0`. */
  name: string;
  hyps: Hyp[];
  goal: string;
  /** Position in Coq's goal list (0 = the focused goal); -1 if not a goal (shelved). */
  order: number;
}

export interface Range {
  start: number;
  end: number;
}

export type StepKind = 'start' | 'tactic' | 'qed' | 'error';

export interface QedInfo {
  name?: string;
  /** What Coq printed for the sentence itself (e.g. "t is defined"). */
  messages: string[];
  /** `Check name.` after closing: the statement the kernel accepted the term for. */
  check?: string;
  /** `Print Assumptions name.` */
  assumptions?: string;
  keyword: string;
}

export interface Step {
  kind: StepKind;
  /** Source text of the sentence (for `start`: the statement). */
  text: string;
  /** Script ranges this step covers (start also covers `Proof.`). */
  ranges: Range[];
  /** `Show Proof.` output after this sentence (absent for qed/error). */
  term?: TermSpan[];
  holes: Hole[];
  /** Messages Coq printed for the sentence itself. */
  messages: string[];
  error?: string;
  qed?: QedInfo;
}

export interface Trace {
  coq: string;
  script: string;
  /** Ranges of sentences outside any proof (Require, Inductive, ...). */
  setup: Range[];
  steps: Step[];
}
