import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from './site';

/** Page metadata with matching Open Graph / Twitter tags and canonical URL. `path` is relative to the site root. */
export function pageMetadata(title: string, description: string, path: string, type: 'website' | 'article' = 'website'): Metadata {
  const url = SITE_URL + path;
  const image = { url: 'og.png', width: 1200, height: 630, alt: 'The tactic split building conj ?Goal ?Goal0 in a Rocq proof term' };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type, siteName: SITE_NAME, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: ['og.png'] },
  };
}
