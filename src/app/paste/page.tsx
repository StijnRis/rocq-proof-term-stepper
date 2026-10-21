import type { Metadata } from 'next';
import { PasteRunner } from '@/components/PasteRunner';
import { pageMetadata } from '@/data/seo';

export const metadata: Metadata = pageMetadata(
  'Run your own Rocq (Coq) script and watch the proof term grow',
  'Paste a Rocq or Coq proof script and see each tactic build the proof term. Coq runs in your browser; nothing is sent anywhere.',
  'paste/',
);

export default function Paste() {
  return <PasteRunner />;
}
