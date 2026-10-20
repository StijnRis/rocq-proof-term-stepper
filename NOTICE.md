# Third-party notices

The code in this repository is MIT licensed (see `LICENSE`).

The deployed site additionally serves, unmodified, files from the
[`jscoq`](https://www.npmjs.com/package/jscoq) npm package (jsCoq 0.17.1,
Coq 8.17.1 compiled to JavaScript with js_of_ocaml, plus the Coq standard
library `.vo` files). They are **not** stored in this repository: `pnpm run
prepare:jscoq` copies them from `node_modules` at build time. jsCoq is
licensed AGPL-3.0-or-later and Coq/Rocq is LGPL-2.1; their sources are at
<https://github.com/jscoq/jscoq> and <https://github.com/rocq-prover/rocq>.
