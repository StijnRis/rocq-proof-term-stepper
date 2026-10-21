# Rocq (formerly Coq) tactic → proof term stepper

A small, fully static web page that shows, step by step, how Rocq tactics build a
proof term. It is a learning tool for people who know tactics but not what they
construct under the hood (Curry–Howard).

* **Left:** the tactic script. The current tactic is highlighted, earlier ones are greyed, later ones are dashed.
* **Right:** the proof term. Teal marks what the current tactic built, amber dashed pills are holes (`?Goal`, `?Goal0`, …). Below it the open goals, one per hole.
* **Bottom:** Back / Next, step dots, arrow keys.
* **Hover** a tactic for a card: the general shape it builds *and* the fragment Coq actually built in this run.

Beyond that: a **gallery** with one example per tactic, a **paste-your-own** mode that runs your script
in the browser, an **induction tree** view (`nat_ind` / `list_ind` with the base and step cases as children and the
induction hypothesis as an arrow), and a final **Qed** step.

## Where the data comes from

Nothing about terms is hand-written. After every sentence the page asks Coq for

* `Show Proof.` – the partial proof term (the right panel),
* `Show Existentials.` – every hole with its context and goal,
* the structured goal list (to know which hole is the focused goal),

and, after `Qed.`, `Check` and `Print Assumptions`. The engine is [jsCoq](https://github.com/jscoq/jscoq)
(Coq 8.17.1 compiled to JavaScript), shipped with the site, so there is no backend.
The gallery is recorded once with `pnpm gen:gallery` (headless Chromium driving the same engine) and committed as
`src/data/gallery.json`; paste mode runs the engine live in your tab.

The teal highlight is a structural diff between the parsed terms of consecutive steps (`src/core/diff.ts`). A hole
counts as new when its goal was not already open before the step, because Coq reuses hole names (`?Goal`) for different goals.
The *Tidy* view re-lays-out Coq's text (one binder per name, collapsible predicates and `return` clauses); the
*Raw* view is Coq's text verbatim.

### Verified

* `pnpm test` pins what each tactic builds against the recorded output (`tests/accuracy.test.ts`).
* `pnpm check:native` replays every gallery script through a native `coqc` and compares each `Show Proof.`:
  113/113 identical between native Coq 8.18 and the recorded jsCoq 8.17 output.
* `pnpm build && pnpm e2e` drives the production build in Chromium, including paste mode with the real engine.

## What real output says (differences from commonly quoted tables)

Checked on Coq 8.17.1 / 8.18.0; the examples are in the gallery.

| Tactic | Real `Show Proof.` shape |
| --- | --- |
| `intro` / `intros` | `fun x => ?Goal` |
| `apply g` | `g ?Goal` |
| `exact p` | `p` |
| `reflexivity` | `eq_refl` |
| `destruct b` (bool) | `if b as b0 return … then ?Goal else ?Goal0` (a `match` printed as `if`) |
| `destruct n` (nat) | `match n as n0 return … with \| 0 => ?Goal \| S n0 => (fun m => ?Goal0) n0 end` |
| `induction n` | `nat_ind (fun n0 => …) ?Goal (fun n' IHn' => ?Goal0) n` |
| `split` | `conj ?Goal ?Goal0` (and it also `intros` a leading `→` first) |
| `left` / `right` | `or_introl ?Goal` / `or_intror ?Goal` |
| `exists t` | `ex_intro (fun n => …) t ?Goal` |
| `assert (H : Q)` | **`let H : Q := ?Goal in ?Goal0`**, not `(fun H : Q => ?rest) ?proof` |
| `rewrite H` / `rewrite <- H` | `eq_ind_r (fun a0 => …) ?Goal H` / `eq_ind a (fun b0 => …) ?Goal b H` |
| `assumption` | the hypothesis (and unused binders are renamed `_`) |
| `discriminate H` | `let H0 : False := eq_ind (S n) (fun e => match e with … end) I 0 H in False_ind False H0` |
| `revert n` | `?Goal n`: a hole applied to `n`, **not** a `fun` |
| `simpl` | no new structure, but the hole may become `?Goal : <new goal>` |

## Prior art checked before building

| Tool | What it shows | Term side by side with the script, with a stepper? |
| --- | --- | --- |
| `Show Proof.` | partial term as text, run by hand | no |
| `Show Proof Diffs` | highlights changes between consecutive **goals** ([`Proof_diffs`](https://ocaml.org/p/rocq-runtime/9.1.0/rocq-runtime.printing/Proof_diffs/index.html) compares goals) | no |
| [Prooftree](https://ocaml.org/p/prooftree) | tree of goals/subgoals for Proof General | no (goals, not terms) |
| [Alectryon](https://systemf.epfl.ch/blog/alectryon) | script interleaved with recorded goals and messages as web pages | no (goals, not terms) |
| [jsCoq](https://github.com/jscoq/jscoq) | Coq in the browser | engine only; we build on it |
| [coq-psv](https://arxiv.org/pdf/2101.07761) | proof scripts exported with proof states | goals, printable, not a live term |
| [Paperproof](https://reservoir.lean-lang.org/@Paper-Proof/examples) (Lean 4) | proof as a tree of hypotheses and goals | Lean, goals not terms |

I found no tool that puts the script and the growing term side by side with a stepper (searches on the
Rocq Discourse, arXiv, Reservoir and general web, October 2026; absence of evidence, not proof of absence).

## Search and sharing

The app uses hash routes, which search engines treat as one page, so `pnpm build` also prerenders real HTML
(`scripts/prerender.mjs`): `/tactics/` plus one page per example with the script and the recorded term after every
sentence, a sitemap, `robots.txt`, canonical URLs, Open Graph/Twitter tags and JSON-LD. Page titles in the app follow the
route, and every step has a shareable link (Copy link button). Set `SITE_URL` when building for another host.

## Limitations

* jsCoq ships Coq **8.17.1**, not Rocq 9. Output for the covered tactics is identical on 8.18 (checked); newer versions may print differently.
* jsCoq runs on the page's main thread (its bundle overflows the stack inside a Web Worker in Chromium), so a tactic that
  never terminates freezes the tab.
* Paste mode needs the Coq standard library bundle for `Require`; choose it in the drop-down (Prelude only by default, ~5 MB).
* The term parser understands the structure it needs (`fun`, `let`, `match`, `if`, parentheses); anything else is kept as plain tokens. If parsing ever fails, the raw text is shown.

## Development

```sh
pnpm install
pnpm dev            # copies the jsCoq assets into public/ and starts Vite
pnpm test           # unit tests (parser, diff, layout, accuracy)
pnpm build          # type-check, build, then prerender the static pages into dist/
pnpm og             # re-render public/og.png (social preview) from recorded data
pnpm e2e            # browser checks against the build (set CHROMIUM_PATH if needed)
pnpm gen:gallery    # re-record src/data/gallery.json with the real engine
pnpm check:native   # compare the recorded gallery with a native coqc
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`
(Settings → Pages → Source: GitHub Actions).

## License

MIT for this repository. The deployed site serves unmodified jsCoq (AGPL-3.0-or-later) files; see `NOTICE.md`.
