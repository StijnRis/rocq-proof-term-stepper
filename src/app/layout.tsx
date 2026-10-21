import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavLinks } from '@/components/NavLinks';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/data/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['Rocq', 'Coq', 'proof term', 'tactics', 'Curry-Howard', 'Show Proof', 'intro', 'apply', 'induction', 'rewrite'],
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: 'og.png', width: 1200, height: 630, alt: 'The tactic split building conj ?Goal ?Goal0 in a Rocq proof term' }],
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: ['og.png'] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0b8a7d' },
    { media: '(prefers-color-scheme: dark)', color: '#101316' },
  ],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  alternateName: 'Coq proof term stepper',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any (web browser)',
  isAccessibleForFree: true,
  inLanguage: 'en',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand">
              <span className="logo" aria-hidden="true">λ</span>
              <span className="brand-name">
                Rocq<span className="hide-sm"> proof terms</span> <small>formerly Coq</small>
              </span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="main">{children}</main>
        <footer className="site">
          Terms are real <code>Show Proof.</code> output of Coq 8.17.1 (jsCoq). <a href="https://github.com/StijnRis/rocq-proof-term-stepper">Source on GitHub</a>.
        </footer>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
