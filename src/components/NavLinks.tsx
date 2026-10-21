'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/', 'Stepper'],
  ['/tactics/', 'Tactics'],
  ['/paste/', 'Paste your own'],
] as const;

export function NavLinks() {
  const path = usePathname();
  const inTactic = path.startsWith('/tactics/') && path !== '/tactics/';
  const active = (href: string) => (href === '/' ? path === '/' || inTactic : path === href);
  return (
    <nav className="nav" aria-label="Pages">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={active(href) ? 'on' : undefined} aria-current={active(href) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
