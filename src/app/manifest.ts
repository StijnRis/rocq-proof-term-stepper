import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/data/site';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Proof terms',
    description: 'See how Rocq (formerly Coq) tactics build a proof term.',
    start_url: '.',
    display: 'standalone',
    background_color: '#f6f7f5',
    theme_color: '#0b8a7d',
    icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
