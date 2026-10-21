// Shared site constants for the prerender and OG scripts.
export const SITE_URL = (process.env.SITE_URL ?? 'https://stijnris.github.io/rocq-proof-term-stepper/').replace(/\/?$/, '/');
export const SITE_NAME = 'Rocq proof term stepper';
export const SITE_TAGLINE = 'See how Rocq (formerly Coq) tactics build a proof term';
export const SITE_DESCRIPTION =
  'Step through a Rocq (formerly Coq) proof and watch each tactic build the proof term. Real Show Proof output for intro, apply, induction, rewrite, split and more, run in your browser with no install.';
