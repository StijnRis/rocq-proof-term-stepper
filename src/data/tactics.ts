/**
 * Short, general descriptions of what common tactics build. These are
 * *explanations*; the facts they state are pinned by tests/accuracy.test.ts
 * against recorded Coq output, and every hover card also shows what Coq built
 * in the actual run.
 */
export interface TacticInfo {
  id: string;
  name: string;
  /** Shape of the term the tactic builds. */
  builds: string;
  note: string;
}

const T = (id: string, name: string, builds: string, note: string): TacticInfo => ({ id, name, builds, note });

const TABLE: [RegExp, TacticInfo][] = [
  [/^intros?\b/, T('intro', 'intro / intros', 'fun x => ?hole', 'Each introduced hypothesis becomes a lambda binder around the remaining goal.')],
  [/^apply\b/, T('apply', 'apply H', 'H ?arg1 … ?argN', 'H goes at the head of an application; premises Coq cannot infer become new holes.')],
  [/^exact\b/, T('exact', 'exact t', 't', 'The hole is filled with the term you give.')],
  [/^reflexivity\b/, T('reflexivity', 'reflexivity', 'eq_refl', 'Closes x = x (up to computation) with the proof of reflexivity of =.')],
  [/^destruct\b/, T('destruct', 'destruct x', 'match x with | C₁ … => ?g₁ | C₂ … => ?g₂ end', 'One branch (hole) per constructor. For bool, Coq prints the match as if … then … else.')],
  [/^induction\b/, T('induction', 'induction x', 'nat_ind P ?base ?step x', 'The induction principle applied to the predicate P, a base case, a step case (with the induction hypothesis as an extra argument) and x.')],
  [/^split\b/, T('split', 'split', 'conj ?l ?r', 'On a conjunction: the constructor conj with one hole per side. (It also intros any leading → first.)')],
  [/^left\b/, T('left', 'left', 'or_introl ?l', 'Picks the left disjunct.')],
  [/^right\b/, T('right', 'right', 'or_intror ?r', 'Picks the right disjunct.')],
  [/^assert\b/, T('assert', 'assert (H : P)', 'let H : P := ?proof in ?rest', 'Two holes: a proof of P, and the rest of the proof in which H is available.')],
  [/^rewrite\s*<-/, T('rewrite-back', 'rewrite <- H', 'eq_ind x (fun y => …) ?g y H', 'The mirror image of rewrite H: the same equality eliminator, but eq_ind instead of eq_ind_r.')],
  [/^rewrite\b/, T('rewrite', 'rewrite H', 'eq_ind_r (fun x => …) ?g H', 'An equality eliminator driven by H (eq_ind_r for rewrite H). The predicate says where the rewritten term occurs.')],
  [/^assumption\b/, T('assumption', 'assumption', 'the hypothesis', 'Fills the hole with the first hypothesis whose type matches the goal.')],
  [/^discriminate\b/, T('discriminate', 'discriminate', 'False_ind … (eq_ind … I … H)', 'Uses the equation between different constructors to derive False, then False_ind.')],
  [/^revert\b/, T('revert', 'revert x', '?m x', 'The new goal is ∀ x, … and the hole is applied to x. It is not a fun: revert is the inverse of intro.')],
  [/^exists\b/, T('exists', 'exists t', 'ex_intro P t ?proof', 'The witness t and a hole for the proof that P holds of t.')],
  [/^simpl\b/, T('simpl', 'simpl', '(no new structure)', 'Only changes the goal. Coq may annotate the hole with the new goal as ?Goal : T.')],
  [/^(-|\+|\*+|\{|\})$/, T('focus', 'bullet / brace', '(nothing)', 'Focuses a goal. Builds nothing; it only chooses which hole you work on next.')],
  [/^Proof\b/, T('proof', 'Proof.', '(nothing)', 'Starts the proof script.')],
  [/^(Theorem|Lemma|Fact|Remark|Corollary|Proposition|Example|Definition|Goal|Let)\b/, T('statement', 'statement', '?Goal', 'A proof starts as one hole whose type is the statement.')],
  [/^(Qed|Defined|Save)\b/, T('qed', 'Qed.', 'the finished term', 'Hands the finished term to the kernel, which type-checks it against the statement.')],
];

export function tacticInfo(sentence: string): TacticInfo | undefined {
  const s = sentence.trim();
  return TABLE.find(([re]) => re.test(s))?.[1];
}
