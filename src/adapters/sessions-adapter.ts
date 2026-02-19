import type { CommandRunner } from '../lib/command-runner.js';
import { shellCommandRunner } from '../lib/command-runner.js';
import type { CollectedSnapshot, ReadonlySourceAdapter, SessionRecord } from './types.js';

const DEFAULT_COMMAND = ['openclaw', 'sessions', 'list', '--json'] as const;

const normalizeSession = (item: Record<string, unknown>): SessionRecord => {
  return {
    sessionKey: String(item.sessionKey ?? item.session_key ?? item.id ?? 'unknown'),
    label: String(item.label ?? 'unlabeled'),
    status: item.status === 'active' || item.status === 'recent' ? item.status : 'unknown',
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
    endedAt: typeof item.endedAt === 'string' ? item.endedAt : null,
    runtimeMs: typeof item.runtimeMs === 'number' ? item.runtimeMs : null,
    model: typeof item.model === 'string' ? item.model : null,
    agentId: typeof item.agentId === 'string' ? item.agentId : null
  };
};

export class SessionsAdapter implements ReadonlySourceAdapter<SessionRecord[]> {
  public readonly sourceType = 'sessions' as const;

  constructor(
    private readonly runCommand: CommandRunner = shellCommandRunner,
    private readonly command: readonly string[] = DEFAULT_COMMAND
  ) {}

  public async collect(): Promise<CollectedSnapshot<SessionRecord[]>> {
    const capturedAt = new Date().toISOString();
    const warnings: string[] = [];

    const [command, ...args] = this.command;
    const result = await this.runCommand(command, args);

    if (result.exitCode !== 0) {
      warnings.push(`sessions_command_failed:${result.stderr || 'unknown'}`);
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: [],
        warnings
      };
    }

    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [];
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: rows.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null).map(normalizeSession),
        warnings
      };
    } catch {
      warnings.push('sessions_output_not_json');
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: [],
        warnings
      };
    }
  }
}
