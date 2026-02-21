import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DbExecutor } from '../db/types.js';
import {
  insertSessionEvent,
  upsertSessionMessage,
  upsertSessionStreamOffset,
  upsertToolCall,
  upsertToolResult
} from '../db/upserts.js';

interface SessionIndexRow {
  session_id: string | null;
  session_key: string;
}

interface OffsetRow {
  session_id: string;
  last_byte_offset: string;
  last_line_number: string;
}

interface TranscriptTarget {
  sessionId: string;
  transcriptPath: string;
}

const MAX_FILES = 120;

const toIso = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
};

const extractTextPreview = (message: Record<string, unknown>): string | null => {
  const content = message.content;
  if (!Array.isArray(content)) {
    return null;
  }

  const parts: string[] = [];

  for (const item of content) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record.type === 'text' && typeof record.text === 'string' && record.text.trim().length > 0) {
      parts.push(record.text.trim());
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(' · ').slice(0, 480);
};

const eventIdFromLine = (line: string, lineNumber: number): string =>
  `line_${lineNumber}_${crypto.createHash('sha1').update(line).digest('hex').slice(0, 10)}`;

const compactEventJson = (parsed: Record<string, unknown>): Record<string, unknown> => {
  const compact: Record<string, unknown> = {
    id: parsed.id ?? null,
    type: parsed.type ?? 'unknown',
    timestamp: parsed.timestamp ?? null,
    parentId: parsed.parentId ?? null
  };

  const message = parsed.message;
  if (typeof message === 'object' && message !== null) {
    const msg = message as Record<string, unknown>;
    compact.message = {
      role: typeof msg.role === 'string' ? msg.role : null,
      model: typeof msg.model === 'string' ? msg.model : null,
      provider: typeof msg.provider === 'string' ? msg.provider : null,
      stopReason: typeof msg.stopReason === 'string' ? msg.stopReason : null,
      textPreview: extractTextPreview(msg)
    };

    if (msg.role === 'toolResult') {
      (compact.message as Record<string, unknown>).toolCallId = typeof msg.toolCallId === 'string' ? msg.toolCallId : null;
      (compact.message as Record<string, unknown>).toolName = typeof msg.toolName === 'string' ? msg.toolName : null;
      (compact.message as Record<string, unknown>).isError = Boolean(msg.isError);
    }
  }

  return compact;
};

const parseOpenClawSessions = async (): Promise<TranscriptTarget[]> => {
  const { execFile } = await import('node:child_process');

  const stdout = await new Promise<string>((resolve, reject) => {
    execFile('openclaw', ['sessions', '--json'], { timeout: 15_000, maxBuffer: 20 * 1024 * 1024 }, (error, out) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(out);
    });
  });

  const parsed = JSON.parse(stdout) as { sessions?: unknown[] };
  const rows = Array.isArray(parsed.sessions) ? parsed.sessions : [];

  const targets: TranscriptTarget[] = [];

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const record = row as Record<string, unknown>;
    const sessionId = typeof record.sessionId === 'string' ? record.sessionId : null;
    const transcriptPath = typeof record.transcriptPath === 'string' ? record.transcriptPath : null;

    if (!sessionId || !transcriptPath) continue;

    targets.push({ sessionId, transcriptPath });
  }

  return targets.slice(0, MAX_FILES);
};

const buildSessionKeyMap = async (db: DbExecutor): Promise<Map<string, string>> => {
  const result = await db.query<SessionIndexRow>('SELECT session_id, session_key FROM sessions WHERE session_id IS NOT NULL');
  const map = new Map<string, string>();
  for (const row of result.rows) {
    if (row.session_id) {
      map.set(row.session_id, row.session_key);
    }
  }
  return map;
};

const buildOffsetMap = async (db: DbExecutor): Promise<Map<string, { offset: number; line: number }>> => {
  const result = await db.query<OffsetRow>('SELECT session_id, last_byte_offset, last_line_number FROM session_stream_offsets');
  const map = new Map<string, { offset: number; line: number }>();
  for (const row of result.rows) {
    map.set(row.session_id, {
      offset: Number(row.last_byte_offset ?? 0),
      line: Number(row.last_line_number ?? 0)
    });
  }
  return map;
};

const ingestMessageEvent = async (
  db: DbExecutor,
  sessionId: string,
  sessionKey: string | null,
  eventId: string,
  eventTs: string,
  message: Record<string, unknown>
): Promise<void> => {
  const role = typeof message.role === 'string' ? message.role : 'unknown';
  const usage = typeof message.usage === 'object' && message.usage !== null ? (message.usage as Record<string, unknown>) : null;

  await upsertSessionMessage(db, {
    sessionId,
    sessionKey,
    eventId,
    role,
    messageTs: eventTs,
    textPreview: extractTextPreview(message),
    provider: typeof message.provider === 'string' ? message.provider : null,
    model: typeof message.model === 'string' ? message.model : null,
    stopReason: typeof message.stopReason === 'string' ? message.stopReason : null,
    usageInput: typeof usage?.input === 'number' ? usage.input : null,
    usageOutput: typeof usage?.output === 'number' ? usage.output : null,
    usageTotal: typeof usage?.totalTokens === 'number' ? usage.totalTokens : null
  });

  const content = message.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      if (record.type !== 'toolCall') continue;

      const toolCallId = typeof record.id === 'string' ? record.id : null;
      if (!toolCallId) continue;

      await upsertToolCall(db, {
        sessionId,
        sessionKey,
        toolCallId,
        eventIdCall: eventId,
        toolName: typeof record.name === 'string' ? record.name : null,
        argumentsJson: record.arguments ?? record.partialJson ?? null,
        startedAt: eventTs
      });
    }
  }

  if (role === 'toolResult') {
    const toolCallId = typeof message.toolCallId === 'string' ? message.toolCallId : null;
    if (toolCallId) {
      await upsertToolResult(db, {
        sessionId,
        sessionKey,
        toolCallId,
        eventIdResult: eventId,
        toolName: typeof message.toolName === 'string' ? message.toolName : null,
        resultJson: message.content ?? null,
        isError: Boolean(message.isError),
        finishedAt: eventTs
      });
    }
  }
};

const readIncrement = async (
  transcriptPath: string,
  startOffset: number
): Promise<{ nextOffset: number; lines: string[] }> => {
  const buffer = await fs.readFile(transcriptPath);
  const boundedOffset = Math.max(0, Math.min(startOffset, buffer.length));
  const chunk = buffer.subarray(boundedOffset).toString('utf8');

  const lines = chunk
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    nextOffset: buffer.length,
    lines
  };
};

const discoverFallbackTranscripts = async (): Promise<TranscriptTarget[]> => {
  const agentsRoot = '/Users/apollo/.openclaw/agents';
  const results: TranscriptTarget[] = [];

  try {
    const agentDirs = await fs.readdir(agentsRoot, { withFileTypes: true });

    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      const sessionsDir = path.join(agentsRoot, agentDir.name, 'sessions');
      let files: string[] = [];
      try {
        files = await fs.readdir(sessionsDir);
      } catch {
        continue;
      }

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const sessionId = file.replace(/\.jsonl$/, '').split('-topic-')[0];
        if (!sessionId) continue;
        results.push({ sessionId, transcriptPath: path.join(sessionsDir, file) });
        if (results.length >= MAX_FILES) return results;
      }
    }
  } catch {
    return [];
  }

  return results;
};

export const ingestSessionStream = async (db: DbExecutor): Promise<void> => {
  const sessionKeyById = await buildSessionKeyMap(db);
  const offsetBySessionId = await buildOffsetMap(db);

  let targets: TranscriptTarget[] = [];
  try {
    targets = await parseOpenClawSessions();
  } catch {
    targets = [];
  }

  if (targets.length === 0) {
    targets = await discoverFallbackTranscripts();
  }

  for (const target of targets) {
    const offset = offsetBySessionId.get(target.sessionId) ?? { offset: 0, line: 0 };

    let increment: { nextOffset: number; lines: string[] };
    try {
      increment = await readIncrement(target.transcriptPath, offset.offset);
    } catch {
      continue;
    }

    let lineNumber = offset.line;

    for (const line of increment.lines) {
      lineNumber += 1;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      const eventId = typeof parsed.id === 'string' ? parsed.id : eventIdFromLine(line, lineNumber);
      const eventType = typeof parsed.type === 'string' ? parsed.type : 'unknown';
      const eventTs = toIso(parsed.timestamp);
      const parentEventId = typeof parsed.parentId === 'string' ? parsed.parentId : null;
      const sessionKey = sessionKeyById.get(target.sessionId) ?? null;

      await insertSessionEvent(db, {
        sessionId: target.sessionId,
        sessionKey,
        eventId,
        parentEventId,
        eventType,
        eventTs,
        sourceLine: lineNumber,
        rawJson: compactEventJson(parsed)
      });

      const message = parsed.message;
      if (eventType === 'message' && typeof message === 'object' && message !== null) {
        await ingestMessageEvent(db, target.sessionId, sessionKey, eventId, eventTs, message as Record<string, unknown>);
      }
    }

    await upsertSessionStreamOffset(db, {
      sessionId: target.sessionId,
      sessionKey: sessionKeyById.get(target.sessionId) ?? null,
      transcriptPath: target.transcriptPath,
      lastByteOffset: increment.nextOffset,
      lastLineNumber: lineNumber
    });
  }
};
