import { describe, expect, it } from 'vitest';
import gallery from '../src/data/gallery.json';
import { parseSpans, tokensOf } from '../src/core/term';
import type { Trace } from '../src/core/types';

describe('term parser on real Show Proof output', () => {
  for (const [id, trace] of Object.entries(gallery as unknown as Record<string, Trace>)) {
    it(`parses every step of ${id} and round-trips the tokens`, () => {
      for (const step of trace.steps) {
        if (!step.term?.length) continue;
        const { tree, text, tokens } = parseSpans(step.term);
        expect(tokensOf(tree).map((t) => t.text).join(' ')).toBe(tokens.map((t) => t.text).join(' '));
        expect(text.replace(/\s+/g, '')).toBe(tokens.map((t) => t.text).join(''));
      }
    });
  }
});
