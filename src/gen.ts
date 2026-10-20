// Dev-only page driven by scripts/gen-gallery.mjs: runs scripts through real Coq.
import { Coq } from './engine/coq';
import { buildTrace } from './core/trace';

declare global {
  interface Window {
    __coq: Promise<Coq>;
    __trace: (script: string) => Promise<unknown>;
  }
}

window.__coq = Coq.create({ base: '/jscoq/' });
window.__trace = async (script) => {
  const coq = await window.__coq;
  coq.reset();
  return buildTrace(coq, coq.version, script);
};
