import type { CommandRunner } from '../lib/command-runner.js';
import { shellCommandRunner } from '../lib/command-runner.js';
import type { CollectedSnapshot, ReadonlySourceAdapter, SessionRecord, SessionRunType } from './types.js';

const DEFAULT_GATEWAY_COMMAND = ['openclaw', 'gateway', 'call', 'sessions.list', '--json', '--params', '{"limit":500}'] as const;
const FALLBACK_SESSIONS_COMMAND = ['openclaw', 'sessions', '--json'] as const;

interface SessionsAdapterConfig {
  activeWindowMs: number;
  limit: number;
}

const DEFAULT_CONFIG: SessionsAdapterConfig = {
  activeWindowMs: 15 * 60 * 1000,
  limit: 500
};

const toIsoTimestamp = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
};

const classifyRunType = (sessionKey: string): SessionRunType => {
  if (sessionKey.includes(':subagent:')) {
    return 'subagent';
  }

  if (sessionKey.includes(':cron:')) {
    return 'cron';
  }

  if (sessionKey.startsWith('agent:main:')) {
    return 'main';
  }

  if (sessionKey.startsWith('agent:')) {
    return 'agent';
  }

  return 'unknown';
};

const inferAgentId = (sessionKey: string): string | null => {
  const parts = sessionKey.split(':');
  if (parts.length >= 2 && parts[0] === 'agent' && parts[1]) {
    return parts[1];
  }
  return null;
};

const normalizeSession = (
  item: Record<string, unknown>,
  nowMs: number,
  activeWindowMs: number
): SessionRecord => {
  const sessionKey = String(item.sessionKey ?? item.session_key ?? item.key ?? item.id ?? 'unknown');
  const lastUpdateAt = toIsoTimestamp(item.updatedAt ?? item.updated_at ?? item.lastUpdateAt);
  const explicitStatus = item.status === 'active' || item.status === 'recent' ? item.status : null;

  const isActiveByTimestamp = (() => {
    if (!lastUpdateAt) {
      return false;
    }

    const updatedAtMs = Date.parse(lastUpdateAt);
    if (!Number.isFinite(updatedAtMs)) {
      return false;
    }

    return nowMs - updatedAtMs <= activeWindowMs;
  })();

  const status = explicitStatus ?? (lastUpdateAt ? (isActiveByTimestamp ? 'active' : 'recent') : 'unknown');

  const inferredAgentId = inferAgentId(sessionKey);
  const rawLabel = item.label ?? item.displayName ?? (item.origin as Record<string, unknown> | undefined)?.label;

  return {
    sessionKey,
    sessionId: typeof item.sessionId === 'string' ? item.sessionId : null,
    label: typeof rawLabel === 'string' && rawLabel.trim().length > 0 ? rawLabel : 'unlabeled',
    status,
    startedAt: toIsoTimestamp(item.startedAt ?? item.started_at),
    endedAt: toIsoTimestamp(item.endedAt ?? item.ended_at),
    runtimeMs: toNumber(item.runtimeMs ?? item.runtime_ms),
    model: typeof item.model === 'string' ? item.model : null,
    agentId: typeof item.agentId === 'string' ? item.agentId : inferredAgentId,
    sessionKind: typeof item.kind === 'string' ? item.kind : typeof item.chatType === 'string' ? item.chatType : null,
    runType: classifyRunType(sessionKey),
    lastUpdateAt
  };
};

const parseSessionsPayload = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.sessions)) {
      return record.sessions.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
    }
  }

  return [];
};

export class SessionsAdapter implements ReadonlySourceAdapter<SessionRecord[]> {
  public readonly sourceType = 'sessions' as const;

  constructor(
    private readonly runCommand: CommandRunner = shellCommandRunner,
    private readonly config: SessionsAdapterConfig = DEFAULT_CONFIG,
    private readonly gatewayCommand: readonly string[] = DEFAULT_GATEWAY_COMMAND,
    private readonly fallbackCommand: readonly string[] = FALLBACK_SESSIONS_COMMAND
  ) {}

  public async collect(): Promise<CollectedSnapshot<SessionRecord[]>> {
    const capturedAt = new Date().toISOString();
    const warnings: string[] = [];
    const nowMs = Date.now();

    const gatewayCommand = [...this.gatewayCommand];
    if (this.config.limit > 0 && gatewayCommand.includes('sessions.list')) {
      const paramsIndex = gatewayCommand.indexOf('--params');
      if (paramsIndex >= 0 && gatewayCommand[paramsIndex + 1]) {
        gatewayCommand[paramsIndex + 1] = JSON.stringify({ limit: this.config.limit });
      }
    }

    const execute = async (commandParts: readonly string[]) => {
      const [command, ...args] = commandParts;
      return this.runCommand(command, args);
    };

    let result = await execute(gatewayCommand);
    let sourceRef = gatewayCommand.join(' ');

    if (result.exitCode !== 0) {
      warnings.push(`sessions_gateway_failed:${result.stderr || 'unknown'}`);
      result = await execute(this.fallbackCommand);
      sourceRef = this.fallbackCommand.join(' ');
    }

    if (result.exitCode !== 0) {
      warnings.push(`sessions_command_failed:${result.stderr || 'unknown'}`);
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef
        },
        data: [],
        warnings
      };
    }

    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      const rows = parseSessionsPayload(parsed);

      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef
        },
        data: rows.map((row) => normalizeSession(row, nowMs, this.config.activeWindowMs)),
        warnings
      };
    } catch {
      const usingGateway = sourceRef === gatewayCommand.join(' ');
      if (usingGateway) {
        warnings.push('sessions_gateway_non_json_output');
        const fallbackResult = await execute(this.fallbackCommand);
        sourceRef = this.fallbackCommand.join(' ');

        if (fallbackResult.exitCode === 0) {
          try {
            const fallbackRows = parseSessionsPayload(JSON.parse(fallbackResult.stdout) as unknown);
            return {
              metadata: {
                sourceType: this.sourceType,
                capturedAt,
                freshnessMs: 0,
                readOnly: true,
                transport: 'command',
                sourceRef
              },
              data: fallbackRows.map((row) => normalizeSession(row, nowMs, this.config.activeWindowMs)),
              warnings
            };
          } catch {
            warnings.push('sessions_output_not_json');
          }
        } else {
          warnings.push(`sessions_command_failed:${fallbackResult.stderr || 'unknown'}`);
        }
      } else {
        warnings.push('sessions_output_not_json');
      }

      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef
        },
        data: [],
        warnings
      };
    }
  }
}
