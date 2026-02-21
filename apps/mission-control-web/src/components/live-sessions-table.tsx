'use client';

import { useEffect, useState } from 'react';
import type { SessionRecord } from '@/lib/contracts';

interface LiveSessionsTableProps {
  sessions: SessionRecord[];
}

const formatDuration = (value: number | null): string => {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return '—';
  }

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const calcElapsedMs = (session: SessionRecord, nowMs: number): number | null => {
  if (session.status === 'active' && session.startedAt) {
    const startedAtMs = Date.parse(session.startedAt);
    if (Number.isFinite(startedAtMs)) {
      return Math.max(0, nowMs - startedAtMs);
    }
  }

  return session.elapsedMs ?? session.runtimeMs;
};

const pillClass = (session: SessionRecord): string => {
  if (session.status !== 'active') {
    return 'pill';
  }

  if (session.runType === 'subagent') {
    return 'pill warn';
  }

  return 'pill ok';
};

export function LiveSessionsTable({ sessions }: LiveSessionsTableProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Agent</th>
            <th>Session</th>
            <th>Label</th>
            <th>Status</th>
            <th>Elapsed</th>
            <th>Last update</th>
            <th>Model</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.sessionKey}>
              <td>
                <span className="pill">{session.runType}</span>
              </td>
              <td>{session.agentId ?? '—'}</td>
              <td>
                <code>{session.sessionKey}</code>
              </td>
              <td>{session.label}</td>
              <td>
                <span className={pillClass(session)}>{session.status}</span>
              </td>
              <td>{formatDuration(calcElapsedMs(session, nowMs))}</td>
              <td>{session.lastUpdateAt ? new Date(session.lastUpdateAt).toLocaleString() : '—'}</td>
              <td>{session.model ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
