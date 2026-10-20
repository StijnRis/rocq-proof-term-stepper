import type { StepView } from '../core/analyze';
import type { Trace } from '../core/types';
import { render } from '../core/layout';
import { tidyDoc } from '../core/tidy';
import { h } from './dom';

export function qedView(trace: Trace, v: StepView, width: number): HTMLElement {
  const q = v.step.qed!;
  const start = [...trace.steps.slice(0, v.index)].reverse().find((s) => s.kind === 'start');
  const statement = start?.holes[0]?.goal;
  const root = h('div', { class: 'qed' });

  if (q.keyword === 'Admitted' || q.keyword === 'Abort') {
    root.append(
      h('p', { class: 'warn' }, q.keyword === 'Admitted' ? 'Admitted. The kernel never sees a finished term: the statement is simply assumed.' : 'Abort. The proof is thrown away; nothing reaches the kernel.'),
    );
    if (q.messages.length) root.append(h('pre', { class: 'coq-out' }, q.messages.join('\n')));
    return root;
  }

  const termBox = h('div', { class: 'box' }, h('h4', null, 'Finished term'));
  if (v.finalTerm) {
    const pre = h('pre', { class: 'term' });
    render(tidyDoc(v.finalTerm.tree, { binderTypes: true, collapse: true, expanded: new Set(), marks: new Set() }), Math.max(24, width - 4)).forEach((line, i) => {
      if (i) pre.append('\n');
      for (const s of line) s.cls ? pre.append(h('span', { class: `tm ${s.cls}`, 'data-chip': s.chip ?? null }, s.text)) : pre.append(s.text);
    });
    termBox.append(pre);
  }
  const stmtBox = h('div', { class: 'box' }, h('h4', null, 'Statement (the theorem)'), h('pre', { class: 'term' }, statement ?? ''));

  root.append(
    h(
      'div',
      { class: 'qed-flow' },
      termBox,
      h('div', { class: 'check', role: 'img', 'aria-label': 'kernel checks that the term has the type of the statement' }, h('span', { class: 'tick' }, '✓'), h('span', null, 'the kernel checks'), h('span', { class: 'colon' }, 'term : statement')),
      stmtBox,
    ),
    h('p', { class: 'muted' }, 'The tactics are not trusted. Qed hands the finished term to the kernel, which type-checks it against the statement. Only then is the theorem added to the environment.'),
  );
  const facts = h('div', { class: 'facts' });
  const fact = (label: string, text: string) => facts.append(h('div', { class: 'fact' }, h('span', { class: 'fact-label' }, label), h('pre', { class: 'coq-out' }, text)));
  q.messages.forEach((m) => fact(`${q.keyword}.`, m));
  if (q.check) fact(`Check ${q.name}.`, q.check);
  if (q.assumptions) fact(`Print Assumptions ${q.name}.`, q.assumptions);
  root.append(h('h3', { class: 'facts-title' }, "Coq's answers"), facts);
  return root;
}
