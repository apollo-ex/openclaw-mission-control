import { AutoRefresh } from '@/components/auto-refresh';
import { getStream } from '@/lib/api';

export const dynamic = 'force-dynamic';

type StreamLine = {
  ts: number;
  kind: 'message' | 'tool';
  sessionKey: string;
  roleOrTool: string;
  text: string;
};

const parseTs = (value: string | null): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
};

const short = (value: string, max = 180): string => (value.length > max ? `${value.slice(0, max)}…` : value);

export default async function MissionControlPage() {
  const stream = await getStream();

  const lines: StreamLine[] = [
    ...stream.messages.map((m) => ({
      ts: parseTs(m.messageTs),
      kind: 'message' as const,
      sessionKey: m.sessionKey ?? 'unknown-session',
      roleOrTool: m.role,
      text: short(m.textPreview ?? 'no message text')
    })),
    ...stream.tools.map((t) => ({
      ts: parseTs(t.startedAt ?? t.finishedAt),
      kind: 'tool' as const,
      sessionKey: t.sessionKey ?? 'unknown-session',
      roleOrTool: t.toolName ?? 'unknown-tool',
      text: t.durationMs !== null ? `duration=${t.durationMs}ms call=${t.toolCallId}` : `call=${t.toolCallId}`
    }))
  ].sort((a, b) => b.ts - a.ts);

  return (
    <main className="stream-console-page">
      <header className="stream-console-head">
        <strong>live stream</strong>
        <small>
          {stream.eventsPerMinute}/min · {lines.length} lines · updated {new Date(stream.generatedAt).toISOString()}
        </small>
        <AutoRefresh intervalMs={60_000} />
      </header>

      <section className="stream-console-list" aria-label="Live agent text stream">
        {lines.map((line, index) => (
          <article key={`${line.kind}-${line.sessionKey}-${line.ts}-${index}`} className={`stream-line stream-${line.kind}`}>
            <span className="stream-ts">{line.ts ? new Date(line.ts).toLocaleTimeString() : '—'}</span>
            <span className="stream-kind">{line.kind}</span>
            <span className="stream-session">{line.sessionKey}</span>
            <span className="stream-role">{line.roleOrTool}</span>
            <span className="stream-text">{line.text}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
