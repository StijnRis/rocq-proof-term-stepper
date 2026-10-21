import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="prose">
      <h2>Page not found</h2>
      <p>
        That page does not exist. <Link href="/">Open the stepper</Link> or <Link href="/tactics/">browse the tactics</Link>.
      </p>
    </section>
  );
}
