import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenClaw Mission Control',
  description: 'Read-only Mission Control dashboard for OpenClaw runtime state'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <Link href="/">Overview</Link>
            <Link href="/agents">Agents</Link>
            <Link href="/memory">Memory</Link>
            <Link href="/cron">Cron</Link>
            <Link href="/health">Health</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
