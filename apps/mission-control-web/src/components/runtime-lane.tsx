'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SessionRecord } from '@/lib/contracts';

interface RuntimeLaneProps {
  sessions: SessionRecord[];
  limit?: number;
}

const toMs = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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

const elapsedMs = (session: SessionRecord, nowMs: number): number | null => {
  if (session.status === 'active') {
    const startedAtMs = toMs(session.startedAt);
    if (startedAtMs !== null) {
      return Math.max(0, nowMs - startedAtMs);
    }
  }

  return session.elapsedMs ?? session.runtimeMs;
};

const sortSessions = (a: SessionRecord, b: SessionRecord): number => {
  if (a.status === 'active' && b.status !== 'active') return -1;
  if (a.status !== 'active' && b.status === 'active') return 1;

  const aUpdated = toMs(a.lastUpdateAt ?? a.updatedAt) ?? 0;
  const bUpdated = toMs(b.lastUpdateAt ?? b.updatedAt) ?? 0;
  return bUpdated - aUpdated;
};

const runTypeClass = (runType: SessionRecord['runType']): string => {
  if (runType === 'subagent') return 'tone-degraded';
  if (runType === 'cron') return 'tone-neutral';
  if (runType === 'main') return 'tone-running';
  return 'tone-neutral';
};

export function RuntimeLane({ sessions, limit = 18 }: RuntimeLaneProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const visibleSessions = useMemo(() => [...sessions].sort(sortSessions).slice(0, limit), [sessions, limit]);

  if (visibleSessions.length === 0) {
    return <p className="empty-note">No session activity captured yet.</p>;
  }

  return (
    <ol className="runtime-lane">
      {visibleSessions.map((session) => {
        const elapsed = formatDuration(elapsedMs(session, nowMs));
        const isActive = session.status === 'active';

        return (
          <li key={session.sessionKey} className={`runtime-node ${isActive ? 'is-active' : ''}`}>
            <div className="runtime-node-head">
              <span className="runtime-agent">{session.agentId ?? 'unassigned-agent'}</span>
              <span className="runtime-arrow">→</span>
              <code className="runtime-session-key">{session.sessionKey}</code>
            </div>

            <div className="runtime-node-body">
              <div className="runtime-metadata">
                <span className={`tone-chip ${runTypeClass(session.runType)}`}>{session.runType}</span>
                <span className={`tone-chip ${isActive ? 'tone-running' : 'tone-neutral'}`}>{session.status}</span>
                {session.model ? <span className="tone-chip tone-neutral">{session.model}</span> : null}
              </div>

              <div className="runtime-clock" aria-label={`elapsed ${elapsed}`}>
                {elapsed}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
