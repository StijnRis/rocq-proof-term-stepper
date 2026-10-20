import './style.css';
import gallery from './data/gallery.json';
import { analyze } from './core/analyze';
import { findInduction } from './core/induction';
import type { Trace } from './core/types';
import { DEFAULT_SCRIPT, EXAMPLES } from './data/examples';
import { tacticInfo } from './data/tactics';
import { h, clear } from './ui/dom';
import { galleryView } from './ui/gallery-view';
import { inductionView } from './ui/induction-view';
import { qedView } from './ui/qed-view';
import { scriptPanel } from './ui/script-panel';
import { goalsList, termPre, type TermHandlers } from './ui/term-panel';

const G = gallery as unknown as Record<string, Trace>;

type Page = 'stepper' | 'gallery' | 'paste';
type Libs = 'init' | 'arith' | 'lists' | 'all';

const state = {
  page: 'stepper' as Page,
  exampleId: 'split',
  step: 0,
  mode: 'tidy' as 'tidy' | 'raw',
  binderTypes: true,
  collapse: true,
  expanded: new Set<string>(),
  tab: 'term' as 'term' | 'tree',
  // paste mode
  pasteScript: DEFAULT_SCRIPT,
  pasteTrace: undefined as Trace | undefined,
  pasteEditing: true,
  pasteStatus: '',
  pasteBusy: false,
  libs: 'init' as Libs,
};

// ------------------------------------------------------------------- routing

function readHash() {
  const [, page, a, b] = location.hash.split('/');
  if (page === 'gallery') state.page = 'gallery';
  else if (page === 'paste') state.page = 'paste';
  else {
    state.page = 'stepper';
    if (page === 'ex' && G[a]) {
      state.exampleId = a;
      state.step = Math.min(Math.max(0, Number(b) || 0), G[a].steps.length - 1);
    } else if (!page) {
      state.exampleId = 'split';
      state.step = 0;
    }
  }
}

function writeHash() {
  const target = state.page === 'stepper' ? `#/ex/${state.exampleId}/${state.step}` : `#/${state.page}`;
  if (location.hash !== target) history.replaceState(null, '', target);
}

// ------------------------------------------------------------------- helpers

const trace = (): Trace | undefined => (state.page === 'paste' ? state.pasteTrace : G[state.exampleId]);

function go(step: number) {
  const t = trace();
  if (!t) return;
  state.step = Math.min(Math.max(0, step), t.steps.length - 1);
  render();
}

function charWidth(): number {
  const probe = h('span', { class: 'probe' }, 'MMMMMMMMMM');
  document.body.append(probe);
  const w = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return w || 8;
}

const termHandlers: TermHandlers = {
  onToggleChip(key) {
    if (state.expanded.has(key)) state.expanded.delete(key);
    else state.expanded.add(key);
    render();
  },
  onHoleHover(name) {
    document.querySelectorAll('[data-hole].linked').forEach((e) => e.classList.remove('linked'));
    if (name) document.querySelectorAll(`[data-hole="${CSS.escape(name)}"]`).forEach((e) => e.classList.add('linked'));
  },
};

// --------------------------------------------------------------------- cards

let card: HTMLElement | null = null;
function hideCard() {
  card?.remove();
  card = null;
}
function showCard(step: number | null, anchor: HTMLElement | null) {
  hideCard();
  const t = trace();
  if (step === null || !anchor || !t) return;
  const s = t.steps[step];
  const info = tacticInfo(s.text);
  const v = analyze(t, step);
  card = h(
    'div',
    { class: 'card', role: 'tooltip' },
    h('div', { class: 'card-head' }, h('code', null, s.text.length > 40 ? s.text.slice(0, 38) + '…' : s.text), info ? h('span', { class: 'muted' }, ` ${info.name}`) : null),
    info ? h('div', { class: 'card-row' }, h('span', { class: 'lbl' }, 'builds'), h('code', null, info.builds)) : null,
    info ? h('p', { class: 'card-note' }, info.note) : h('p', { class: 'card-note' }, 'No general description for this tactic; see what Coq built below.'),
    s.kind === 'error'
      ? h('div', { class: 'card-row err' }, s.error ?? '')
      : h('div', { class: 'card-row' }, h('span', { class: 'lbl' }, 'in this run'), v.built ? h('code', { class: 'tm new' }, v.built.length > 160 ? v.built.slice(0, 157) + '…' : v.built) : h('span', { class: 'muted' }, 'no new structure')),
  );
  document.body.append(card);
  const r = anchor.getBoundingClientRect();
  const cw = card.offsetWidth;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - cw - 8);
  card.style.left = `${left + window.scrollX}px`;
  card.style.top = `${r.bottom + window.scrollY + 6}px`;
}

// -------------------------------------------------------------------- panels

function stepperBar(t: Trace): HTMLElement {
  const dots = h('div', { class: 'dots', role: 'tablist', 'aria-label': 'Steps' });
  t.steps.forEach((s, i) => {
    dots.append(
      h('button', {
        class: `dot ${i < state.step ? 'done' : i === state.step ? 'now' : 'todo'} k-${s.kind}`,
        type: 'button',
        role: 'tab',
        'aria-selected': i === state.step,
        'aria-label': `Step ${i + 1}: ${s.text}`,
        title: `${i + 1}. ${s.text}`,
        onclick: () => go(i),
      }),
    );
  });
  const cur = t.steps[state.step];
  return h(
    'footer',
    { class: 'stepper' },
    h('button', { class: 'btn', type: 'button', disabled: state.step === 0, onclick: () => go(state.step - 1) }, '← Back'),
    h('div', { class: 'stepmid' }, dots, h('div', { class: 'steplabel' }, `Step ${state.step + 1} of ${t.steps.length}`, h('span', { class: 'muted' }, ' · '), h('code', null, cur.text.length > 48 ? cur.text.slice(0, 46) + '…' : cur.text))),
    h('button', { class: 'btn primary', type: 'button', disabled: state.step === t.steps.length - 1, onclick: () => go(state.step + 1) }, 'Next →'),
  );
}

function legend(): HTMLElement {
  return h(
    'div',
    { class: 'legend' },
    h('span', null, h('i', { class: 'sw new' }), 'built by the current tactic'),
    h('span', null, h('i', { class: 'sw hole' }), 'hole: a goal still to fill'),
    h('span', { class: 'muted' }, 'earlier tactics greyed · later ones dashed'),
  );
}

function termPanel(t: Trace): HTMLElement {
  const v = analyze(t, state.step);
  const s = v.step;
  const panel = h('section', { class: 'panel term-panel', 'aria-label': 'Proof term' });

  const tree = v.parsed ? findInduction(v.parsed.tree) : undefined;
  if (state.tab === 'tree' && !tree) state.tab = 'term';

  const toolbar = h('div', { class: 'toolbar' }, h('h2', null, 'Proof term'));
  const seg = (label: string, active: boolean, on: () => void, title?: string) =>
    h('button', { class: `seg${active ? ' on' : ''}`, type: 'button', 'aria-pressed': active, title: title ?? null, onclick: on }, label);
  if (s.kind !== 'qed') {
    const tabs = h('div', { class: 'segs', role: 'group', 'aria-label': 'View' });
    tabs.append(seg('Term', state.tab === 'term', () => ((state.tab = 'term'), render())));
    if (tree) tabs.append(seg('Induction tree', state.tab === 'tree', () => ((state.tab = 'tree'), render()), 'Draw the induction principle as a tree'));
    toolbar.append(tabs);
    if (state.tab === 'term') {
      const modes = h('div', { class: 'segs', role: 'group', 'aria-label': 'Printing' });
      modes.append(seg('Tidy', state.mode === 'tidy', () => ((state.mode = 'tidy'), render()), 'Normalised layout, collapsible predicates'), seg('Raw', state.mode === 'raw', () => ((state.mode = 'raw'), render()), "Coq's Show Proof text, unchanged"));
      toolbar.append(modes);
      if (state.mode === 'tidy') {
        toolbar.append(
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: state.binderTypes ? true : null, onchange: (e: Event) => ((state.binderTypes = (e.target as HTMLInputElement).checked), render()) }), 'binder types'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: state.collapse ? true : null, onchange: (e: Event) => ((state.collapse = (e.target as HTMLInputElement).checked), render()) }), 'collapse predicates'),
        );
      }
    }
  }
  panel.append(toolbar);

  const body = h('div', { class: 'term-wrap' });
  panel.append(body);

  if (s.kind === 'error') {
    body.append(h('div', { class: 'errbox' }, h('b', null, 'Coq rejected this sentence'), h('pre', null, s.error ?? '')));
    const prev = t.steps[state.step - 1];
    if (prev?.term) body.append(h('p', { class: 'muted' }, 'The term before the error:'), termPre(analyze(t, state.step - 1), { mode: state.mode, binderTypes: state.binderTypes, collapse: state.collapse, expanded: state.expanded, width: 60 }, termHandlers));
    return panel;
  }
  if (s.kind === 'qed') {
    body.append(qedView(t, v, Math.floor(body.clientWidth / charWidth()) || 60));
    return panel;
  }

  const caption = h('div', { class: 'built' });
  if (s.kind === 'start') caption.append('A proof starts as a single hole whose type is the statement.');
  else if (v.built) caption.append(h('code', null, s.text), ' built ', h('code', { class: 'tm new' }, v.built.length > 140 ? v.built.slice(0, 137) + '…' : v.built));
  else caption.append(h('code', null, s.text), ' built no new structure', tacticInfo(s.text)?.id === 'focus' ? ': it only focuses a goal.' : '.');
  body.append(caption);

  if (state.tab === 'tree' && tree) {
    body.append(inductionView(tree, v));
  } else {
    const cols = Math.max(24, Math.floor((panel.clientWidth || 560) / charWidth()) - 4);
    body.append(termPre(v, { mode: state.mode, binderTypes: state.binderTypes, collapse: state.collapse, expanded: state.expanded, width: cols }, termHandlers));
  }
  panel.append(goalsList(s.holes, termHandlers));
  return panel;
}

function scriptSide(t: Trace | undefined): HTMLElement {
  const panel = h('section', { class: 'panel script-panel', 'aria-label': 'Tactic script' });
  panel.append(h('div', { class: 'toolbar' }, h('h2', null, 'Tactic script'), state.page === 'paste' && t && !state.pasteEditing ? h('button', { class: 'btn small', type: 'button', onclick: () => ((state.pasteEditing = true), render()) }, 'Edit') : null));
  if (state.page === 'paste' && (state.pasteEditing || !t)) {
    const ta = h('textarea', { class: 'editor', spellcheck: false, 'aria-label': 'Rocq script', rows: 14 });
    ta.value = state.pasteScript;
    ta.addEventListener('input', () => (state.pasteScript = ta.value));
    const libs = h('select', { 'aria-label': 'Libraries', onchange: (e: Event) => (state.libs = (e.target as HTMLSelectElement).value as Libs) });
    for (const [v, label] of [
      ['init', 'Prelude only (fastest, ~5 MB)'],
      ['arith', '+ Arith, ZArith, Lists, Strings (~31 MB)'],
      ['lists', '+ Lists, Sets, Vectors (~20 MB)'],
      ['all', 'Everything (~31 MB)'],
    ] as const)
      libs.append(h('option', { value: v, selected: state.libs === v ? true : null }, label));
    panel.append(
      ta,
      h(
        'div',
        { class: 'runbar' },
        libs,
        h('button', { class: 'btn primary', type: 'button', disabled: state.pasteBusy ? true : null, onclick: () => void runPaste() }, state.pasteBusy ? 'Running…' : 'Run in Coq'),
      ),
      h('p', { class: 'muted small' }, state.pasteStatus || 'Coq 8.17 runs inside this page (jsCoq). Nothing is sent anywhere. A tactic that never terminates will freeze the tab.'),
    );
    return panel;
  }
  if (!t) return panel;
  panel.append(
    scriptPanel(t, state.step, {
      onSelect: (i) => go(i),
      onHover: (i, el) => showCard(i, el),
    }),
  );
  return panel;
}

// ---------------------------------------------------------------- paste mode

let engine: { libs: Libs; coq: import('./engine/coq').Coq } | undefined;

async function runPaste() {
  if (state.pasteBusy) return;
  state.pasteBusy = true;
  state.pasteStatus = 'Starting Coq…';
  render();
  try {
    const { Coq } = await import('./engine/coq');
    const { buildTrace } = await import('./core/trace');
    if (!engine || engine.libs !== state.libs) {
      const packages = { init: ['init'], arith: ['init', 'coq-base', 'coq-collections', 'coq-arith'], lists: ['init', 'coq-base', 'coq-collections'], all: ['init', 'coq-base', 'coq-arith', 'coq-collections'] }[state.libs];
      const coq = await Coq.create({
        base: import.meta.env.BASE_URL + 'jscoq/',
        packages,
        onStatus: (s) => {
          state.pasteStatus = s;
          const el = document.querySelector('.script-panel .runbar + p');
          if (el) el.textContent = s;
        },
      });
      engine = { libs: state.libs, coq };
    }
    const coq = engine.coq;
    coq.reset();
    state.pasteStatus = 'Running your script…';
    const tr = await buildTrace(coq, coq.version, state.pasteScript);
    state.pasteTrace = tr;
    state.pasteEditing = false;
    state.step = 0;
    const err = tr.steps.find((s) => s.kind === 'error');
    state.pasteStatus = err ? `Coq stopped at an error in «${err.text}».` : `Done with ${coq.version}.`;
    if (err) state.step = tr.steps.indexOf(err);
  } catch (e) {
    state.pasteStatus = `Could not run Coq: ${(e as Error).message}`;
  } finally {
    state.pasteBusy = false;
    render();
  }
}

// -------------------------------------------------------------------- shell

const app = document.getElementById('app')!;

function header(): HTMLElement {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Pages' });
  const tab = (page: Page, label: string) => nav.append(h('a', { href: page === 'stepper' ? '#/' : `#/${page}`, class: state.page === page ? 'on' : '', 'aria-current': state.page === page ? 'page' : null }, label));
  tab('stepper', 'Stepper');
  tab('gallery', 'Gallery');
  tab('paste', 'Paste your own');
  const sel = h('select', { class: 'examples', 'aria-label': 'Example', onchange: (e: Event) => ((state.exampleId = (e.target as HTMLSelectElement).value), (state.step = 0), (state.tab = 'term'), render()) });
  for (const ex of EXAMPLES) sel.append(h('option', { value: ex.id, selected: ex.id === state.exampleId ? true : null }, `${ex.tactic} — ${ex.title}`));
  return h(
    'header',
    { class: 'top' },
    h('div', { class: 'brand' }, h('h1', null, 'Rocq ', h('span', { class: 'muted' }, '(formerly Coq)'), ' tactic → proof term'), h('p', null, 'Every tactic builds part of a λ-term. Step through a proof and watch it grow. All terms are real ', h('code', null, 'Show Proof.'), ' output.')),
    nav,
    state.page === 'stepper' ? sel : null,
  );
}

function about(): HTMLElement {
  return h(
    'details',
    { class: 'about' },
    h('summary', null, 'About, and what already exists'),
    h(
      'p',
      null,
      'Terms come from Coq 8.17.1 compiled to JavaScript by ',
      h('a', { href: 'https://github.com/jscoq/jscoq' }, 'jsCoq'),
      ': after each sentence the page asks Coq for ',
      h('code', null, 'Show Proof.'),
      ', ',
      h('code', null, 'Show Existentials.'),
      ' and the goals. The teal highlight is a structural diff between consecutive terms; nothing is hand-written. Rocq is the new name of Coq (version 9 onwards); jsCoq still ships Coq 8.17.',
    ),
    h('p', null, 'Related tools: Coq’s ', h('code', null, 'Show Proof.'), ' prints the partial term as text, and ', h('code', null, 'Show Proof Diffs'), ' highlights changes between consecutive goals, not terms. Prooftree draws trees of goals. Alectryon interleaves goals with a script. coq-psv exports proof scripts with their states. Paperproof does the goal-tree view for Lean. None of them put the script and the growing term side by side with a stepper; see the README for details.'),
  );
}

let lastKey = '';
function render() {
  hideCard();
  writeHash();
  const key = `${state.page}`;
  const scroll = window.scrollY;
  clear(app);
  app.append(header());
  const main = h('main', { class: 'main' });
  app.append(main);

  if (state.page === 'gallery') {
    main.append(
      h('p', { class: 'lead' }, 'One example per tactic. Each card shows the fragment of the term Coq built for the tactic, taken from a recorded run.'),
      galleryView((id, step) => {
        state.page = 'stepper';
        state.exampleId = id;
        state.step = step;
        state.tab = 'term';
        render();
      }),
    );
  } else {
    const t = trace();
    if (state.page === 'paste' && (!t || state.pasteEditing)) {
      main.append(h('div', { class: 'cols' }, scriptSide(t), h('section', { class: 'panel placeholder' }, h('h2', null, 'Proof term'), h('p', { class: 'muted' }, 'Run a script to see the term grow here.'))));
    } else if (t) {
      main.append(h('p', { class: 'blurb' }, state.page === 'stepper' ? (EXAMPLES.find((e) => e.id === state.exampleId)?.blurb ?? '') : state.pasteStatus), h('div', { class: 'cols' }, scriptSide(t), termPanel(t)), legend(), stepperBar(t));
    }
  }
  main.append(about());
  if (key === lastKey) window.scrollTo(0, scroll);
  lastKey = key;
}

window.addEventListener('hashchange', () => {
  readHash();
  render();
});
window.addEventListener('keydown', (e) => {
  const tgt = e.target as HTMLElement;
  if (['TEXTAREA', 'SELECT', 'INPUT'].includes(tgt.tagName)) return;
  const t = trace();
  if (!t || state.page === 'gallery') return;
  if (e.key === 'ArrowRight') (e.preventDefault(), go(state.step + 1));
  else if (e.key === 'ArrowLeft') (e.preventDefault(), go(state.step - 1));
  else if (e.key === 'Home') (e.preventDefault(), go(0));
  else if (e.key === 'End') (e.preventDefault(), go(t.steps.length - 1));
});
let lastWidth = document.body.clientWidth;
new ResizeObserver(() => {
  const w = document.body.clientWidth;
  if (w === lastWidth) return;
  lastWidth = w;
  if (state.page === 'stepper' || state.page === 'paste') render();
}).observe(document.body);

readHash();
render();
