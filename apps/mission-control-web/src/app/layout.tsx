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
        <div className="mc-shell">
          <header className="mc-topbar">
            <div className="brand">
              <strong>OpenClaw Mission Control</strong>
              <small>read-only telemetry stream · local-first runtime visibility</small>
            </div>
            <nav className="mc-nav">
              <Link href="/">Overview</Link>
              <Link href="/agents">Agents</Link>
              <Link href="/memory">Memory</Link>
              <Link href="/cron">Cron</Link>
              <Link href="/health">Health</Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
