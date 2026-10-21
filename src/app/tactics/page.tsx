import type { Metadata } from 'next';
import Link from 'next/link';
import { analyze } from '@/core/analyze';
import { EXAMPLES } from '@/data/examples';
import { exampleById, focusIndex, GALLERY } from '@/data/gallery';
import { pageMetadata } from '@/data/seo';
import { tacticInfo } from '@/data/tactics';

export const metadata: Metadata = pageMetadata(
  'Rocq (Coq) tactics and the proof terms they build',
  'One example per Rocq tactic with the real proof term it builds: intro, apply, exact, reflexivity, destruct, induction, split, left, right, assert, rewrite, assumption, discriminate, revert, exists.',
  'tactics/',
);

export default function Tactics() {
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Tactics and the terms they build</h1>
          <p className="blurb">One example per tactic. Each card shows the fragment of the term Coq built for it, taken from a recorded run.</p>
        </div>
      </div>
      <div className="gallery">
        {EXAMPLES.map((e) => {
          const trace = GALLERY[e.id];
          const idx = focusIndex(exampleById(e.id)!);
          const built = analyze(trace, idx).built;
          const info = tacticInfo(trace.steps[idx].text);
          return (
            <article key={e.id} className="gcard">
              <header>
                <code className="gtactic">{e.tactic}</code>
                <span className="muted">{e.title}</span>
              </header>
              <p className="muted">{e.blurb}</p>
              <div className="gbuilt">
                <div className="gl">Coq built, after {trace.steps[idx].text}</div>
                <pre className="term mini">{built ? <span className="tm new">{built.length > 150 ? built.slice(0, 147) + '…' : built}</span> : '(nothing new)'}</pre>
              </div>
              {info && (
                <div className="gshape muted">
                  general shape: <code>{info.builds}</code>
                </div>
              )}
              <footer>
                <Link className="btn" href={`/tactics/${e.id}/#${idx + 1}`}>Step through</Link>
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
