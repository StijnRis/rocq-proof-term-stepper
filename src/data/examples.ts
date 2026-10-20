/**
 * Gallery sources. Only the *scripts* are written by hand; every term, hole and
 * goal shown in the app is recorded from Coq by `pnpm gen:gallery`
 * (see src/data/gallery.json).
 */
export interface Example {
  id: string;
  /** The tactic this example is about. */
  tactic: string;
  title: string;
  blurb: string;
  script: string;
  /** Sentence of the script that shows the tactic (first match). */
  focus: RegExp;
}

export const EXAMPLES: Example[] = [
  {
    id: 'intro',
    tactic: 'intro / intros',
    title: 'Introducing hypotheses',
    blurb: 'Each intro peels one binder off the goal and wraps the hole in a fun.',
    script: `Theorem intro_ex : forall (P Q : Prop), P -> Q -> P.
Proof.
  intros P Q.
  intro p.
  intro q.
  exact p.
Qed.`,
    focus: /^intros?\b/,
  },
  {
    id: 'apply',
    tactic: 'apply H',
    title: 'Applying a hypothesis',
    blurb: 'apply H puts H at the head of an application; its premises become holes.',
    script: `Theorem apply_ex : forall (P Q R : Prop), (P -> Q) -> (Q -> R) -> P -> R.
Proof.
  intros P Q R f g p.
  apply g.
  apply f.
  exact p.
Qed.`,
    focus: /^apply\b/,
  },
  {
    id: 'exact',
    tactic: 'exact t',
    title: 'Giving the term directly',
    blurb: 'exact t fills the hole with t itself.',
    script: `Theorem exact_ex : forall P : Prop, P -> P.
Proof.
  intros P p.
  exact p.
Qed.`,
    focus: /^exact\b/,
  },
  {
    id: 'reflexivity',
    tactic: 'reflexivity',
    title: 'Closing an equation',
    blurb: 'reflexivity closes x = x with eq_refl.',
    script: `Theorem refl_ex : 2 + 2 = 4.
Proof.
  reflexivity.
Qed.`,
    focus: /^reflexivity\b/,
  },
  {
    id: 'destruct',
    tactic: 'destruct x',
    title: 'Case analysis',
    blurb: 'destruct x builds a match with one branch (hole) per constructor.',
    script: `Theorem destruct_ex : forall b : bool, orb b true = true.
Proof.
  intros b.
  destruct b.
  - reflexivity.
  - reflexivity.
Qed.`,
    focus: /^destruct\b/,
  },
  {
    id: 'destruct-nat',
    tactic: 'destruct x',
    title: 'Case analysis on a number',
    blurb: 'On nat the branches are `match` arms: one for 0 and one for S m.',
    script: `Theorem destruct_nat_ex : forall n : nat, n = 0 \\/ exists m, n = S m.
Proof.
  intros n.
  destruct n as [| m].
  - left.
    reflexivity.
  - right.
    exists m.
    reflexivity.
Qed.`,
    focus: /^destruct\b/,
  },
  {
    id: 'induction',
    tactic: 'induction x',
    title: 'Induction on nat',
    blurb: 'induction n applies the induction principle nat_ind to a predicate, a base hole and a step hole.',
    script: `Theorem plus_n_O_ex : forall n : nat, n = n + 0.
Proof.
  intros n.
  induction n as [| n' IHn'].
  - reflexivity.
  - simpl.
    rewrite <- IHn'.
    reflexivity.
Qed.`,
    focus: /^induction\b/,
  },
  {
    id: 'induction-list',
    tactic: 'induction x',
    title: 'Induction on a list',
    blurb: 'The same shape for another inductive type: list_ind.',
    script: `Open Scope list_scope.

Theorem app_nil_ex : forall l : list nat, l ++ nil = l.
Proof.
  intros l.
  induction l as [| h t IHt].
  - reflexivity.
  - simpl.
    rewrite IHt.
    reflexivity.
Qed.`,
    focus: /^induction\b/,
  },
  {
    id: 'split',
    tactic: 'split',
    title: 'Proving a conjunction',
    blurb: 'split on P /\\ Q builds conj with two holes.',
    script: `Theorem split_ex : forall P Q : Prop, P -> Q -> P /\\ Q.
Proof.
  intros P Q p q.
  split.
  - exact p.
  - exact q.
Qed.`,
    focus: /^split\b/,
  },
  {
    id: 'left',
    tactic: 'left',
    title: 'Choosing the left disjunct',
    blurb: 'left on P \\/ Q builds or_introl.',
    script: `Theorem left_ex : forall P Q : Prop, P -> P \\/ Q.
Proof.
  intros P Q p.
  left.
  exact p.
Qed.`,
    focus: /^left\b/,
  },
  {
    id: 'right',
    tactic: 'right',
    title: 'Choosing the right disjunct',
    blurb: 'right on P \\/ Q builds or_intror.',
    script: `Theorem right_ex : forall P Q : Prop, Q -> P \\/ Q.
Proof.
  intros P Q q.
  right.
  exact q.
Qed.`,
    focus: /^right\b/,
  },
  {
    id: 'assert',
    tactic: 'assert (H : P)',
    title: 'Proving a helper fact',
    blurb: 'assert introduces a local lemma: a function applied to its own proof.',
    script: `Theorem assert_ex : forall P Q : Prop, P -> (P -> Q) -> Q.
Proof.
  intros P Q p f.
  assert (H : Q).
  - apply f.
    exact p.
  - exact H.
Qed.`,
    focus: /^assert\b/,
  },
  {
    id: 'rewrite',
    tactic: 'rewrite H',
    title: 'Rewriting with an equation',
    blurb: 'rewrite uses an equality eliminator (eq_ind / eq_ind_r) driven by H.',
    script: `Theorem rewrite_ex : forall a b : nat, a = b -> b = a.
Proof.
  intros a b H.
  rewrite H.
  reflexivity.
Qed.`,
    focus: /^rewrite\b/,
  },
  {
    id: 'rewrite-back',
    tactic: 'rewrite <- H',
    title: 'Rewriting right to left',
    blurb: 'rewrite <- H is the mirror image of rewrite H.',
    script: `Theorem rewrite_back_ex : forall a b : nat, a = b -> b = a.
Proof.
  intros a b H.
  rewrite <- H.
  reflexivity.
Qed.`,
    focus: /^rewrite\b/,
  },
  {
    id: 'assumption',
    tactic: 'assumption',
    title: 'Finding the hypothesis',
    blurb: 'assumption fills the hole with the first hypothesis whose type matches.',
    script: `Theorem assumption_ex : forall P Q : Prop, P -> Q -> Q.
Proof.
  intros P Q p q.
  assumption.
Qed.`,
    focus: /^assumption\b/,
  },
  {
    id: 'discriminate',
    tactic: 'discriminate',
    title: 'Impossible equations',
    blurb: 'discriminate derives False from a constructor clash.',
    script: `Theorem discriminate_ex : forall n : nat, S n = 0 -> False.
Proof.
  intros n H.
  discriminate H.
Qed.`,
    focus: /^discriminate\b/,
  },
  {
    id: 'revert',
    tactic: 'revert x',
    title: 'Putting a variable back in the goal',
    blurb: 'revert abstracts the goal over x; the term is a hole applied to x, not a fun.',
    script: `Theorem revert_ex : forall n : nat, n = n.
Proof.
  intros n.
  revert n.
  intros m.
  reflexivity.
Qed.`,
    focus: /^revert\b/,
  },
  {
    id: 'exists',
    tactic: 'exists t',
    title: 'Providing a witness',
    blurb: 'exists t builds ex_intro with the witness and a hole for the proof.',
    script: `Theorem exists_ex : exists n : nat, n + 1 = 3.
Proof.
  exists 2.
  reflexivity.
Qed.`,
    focus: /^exists\b/,
  },
];

export const DEFAULT_SCRIPT = `Theorem and_swap : forall P Q : Prop, P /\\ Q -> Q /\\ P.
Proof.
  intros P Q H.
  destruct H as [p q].
  split.
  - exact q.
  - exact p.
Qed.`;
