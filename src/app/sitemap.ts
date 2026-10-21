import type { MetadataRoute } from 'next';
import { EXAMPLES } from '@/data/examples';
import { SITE_URL } from '@/data/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', 'tactics/', 'paste/', ...EXAMPLES.map((e) => `tactics/${e.id}/`)];
  return paths.map((p) => ({ url: SITE_URL + p }));
}
