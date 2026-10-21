import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StepsText } from '@/components/StepsText';
import { Stepper } from '@/components/Stepper';
import { analyze } from '@/core/analyze';
import { EXAMPLES } from '@/data/examples';
import { exampleById, focusIndex, GALLERY } from '@/data/gallery';
import { SITE_NAME, SITE_URL } from '@/data/site';
import { pageMetadata } from '@/data/seo';
import { tacticInfo } from '@/data/tactics';

export const dynamicParams = false;
export const generateStaticParams = () => EXAMPLES.map((e) => ({ id: e.id }));

const heading = (e: { title: string; tactic: string }) => `${e.title}: ${e.tactic} in Rocq (Coq)`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ex = exampleById(id);
  if (!ex) return {};
  const built = analyze(GALLERY[id], focusIndex(ex)).built;
  const description = `${ex.blurb} Step-by-step example with the real Show Proof output${built ? `: ${built.length > 90 ? built.slice(0, 88) + '…' : built}` : ''}.`;
  return pageMetadata(heading(ex), description, `tactics/${id}/`, 'article');
}

export default async function TacticPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = exampleById(id);
  if (!ex) notFound();
  const trace = GALLERY[id];
  const info = tacticInfo(trace.steps[focusIndex(ex)].text);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: heading(ex),
    description: ex.blurb,
    inLanguage: 'en',
    url: `${SITE_URL}tactics/${id}/`,
    about: ['Rocq', 'Coq', 'proof term', ex.tactic],
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  };
  return (
    <>
      <Stepper trace={trace} exampleId={id} initialStep={focusIndex(ex)} />
      <article className="prose">
        <h2>{heading(ex)}</h2>
        <p>{ex.blurb}</p>
        {info && (
          <p>
            General shape: <code>{info.builds}</code>. {info.note}
          </p>
        )}
        <h3>Step by step: the proof term after each sentence</h3>
        <p className="muted">
          Recorded from Coq with <code>Show Proof.</code> after every sentence. <span className="tm new">Teal</span> is what the sentence built; <span className="tm hole">?Goal</span> pills are holes still to fill.
        </p>
        <StepsText trace={trace} />
        <h3>Other tactics</h3>
        <ul className="others">
          {EXAMPLES.filter((e) => e.id !== id).map((e) => (
            <li key={e.id}>
              <Link href={`/tactics/${e.id}/`}>{e.tactic}</Link> <span className="muted">{e.title}</span>
            </li>
          ))}
        </ul>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </>
  );
}
