'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  intervalMs?: number;
}

export function AutoRefresh({ intervalMs = 15_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [router, intervalMs]);

  return <small>Auto-refresh: {Math.round(intervalMs / 1000)}s</small>;
}
