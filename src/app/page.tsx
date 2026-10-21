import Link from 'next/link';
import { Stepper } from '@/components/Stepper';
import { exampleById, GALLERY } from '@/data/gallery';

export default function Home() {
  const ex = exampleById('split')!;
  return (
    <>
      <section className="hero">
        <h1>
          See what each Rocq tactic <em>builds</em>
        </h1>
        <p>
          Every tactic constructs part of a λ-term. Step through a proof and watch the term grow, side by side with the script. All terms are real <code>Show Proof.</code> output from Coq.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/tactics/">Browse the tactics</Link>
          <Link className="btn" href="/paste/">Paste your own script</Link>
        </div>
      </section>
      <Stepper trace={GALLERY[ex.id]} exampleId={ex.id} />
      <section className="prose">
        <h2>What is this?</h2>
        <p>
          In Rocq (formerly Coq) a proof is a program: every tactic you run builds part of a λ-term, the <em>proof term</em>. Rocq can show the partial term with <code>Show Proof.</code>, but only as
          text, after you run it by hand. This page runs your proof in the browser, asks Coq for <code>Show Proof.</code> after every tactic, and highlights what the tactic just built. Holes
          (<code>?Goal</code>) are the goals still open.
        </p>
      </section>
    </>
  );
}
