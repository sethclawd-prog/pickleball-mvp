'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { href: '/', label: 'Sessions' },
  { href: '/availability', label: 'Availability' }
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[min(520px,calc(100%-1.5rem))] items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/90 p-2 shadow-card backdrop-blur">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              active ? 'bg-accent text-white' : 'text-ink/70 hover:bg-accent-soft hover:text-ink'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
