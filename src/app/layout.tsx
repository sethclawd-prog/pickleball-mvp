import type { Metadata, Viewport } from 'next';
import { Fraunces, Space_Grotesk } from 'next/font/google';

import IdentityGate from '@/components/IdentityGate';
import MobileNav from '@/components/MobileNav';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

import '@/app/globals.css';

const bodyFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body'
});

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display'
});

export const metadata: Metadata = {
  title: 'Bay Padel Crew',
  description: 'Fast same-day pickleball coordination for one crew.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Bay Padel Crew',
    statusBarStyle: 'default'
  }
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} bg-surface text-ink antialiased`}>
        <div className="relative min-h-screen pb-24">
          <div className="background-orb pointer-events-none" aria-hidden="true" />
          <main className="relative mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:px-6 md:pt-10">{children}</main>
          <MobileNav />
          <IdentityGate />
          <ServiceWorkerRegistration />
        </div>
      </body>
    </html>
  );
}
