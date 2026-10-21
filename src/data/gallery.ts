import gallery from './gallery.json';
import type { Trace } from '@/core/types';
import { EXAMPLES, type Example } from './examples';

export const GALLERY = gallery as unknown as Record<string, Trace>;

/** Index of the step that shows the example's tactic. */
export function focusIndex(ex: Example): number {
  const i = GALLERY[ex.id].steps.findIndex((s) => s.kind === 'tactic' && ex.focus.test(s.text));
  return Math.max(0, i);
}

export const exampleById = (id: string) => EXAMPLES.find((e) => e.id === id);
