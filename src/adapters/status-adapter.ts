import type { CommandRunner } from '../lib/command-runner.js';
import { shellCommandRunner } from '../lib/command-runner.js';
import type { CollectedSnapshot, ReadonlySourceAdapter, StatusSnapshot } from './types.js';

const DEFAULT_COMMAND = ['openclaw', 'gateway', 'status'] as const;

const classifyStatus = (raw: string): StatusSnapshot['openclawStatus'] => {
  const lowered = raw.toLowerCase();
  if (lowered.includes('running') || lowered.includes('healthy') || lowered.includes('ok')) {
    return 'ok';
  }
  if (lowered.includes('degraded') || lowered.includes('warning')) {
    return 'degraded';
  }
  if (lowered.includes('offline') || lowered.includes('stopped')) {
    return 'offline';
  }
  return 'unknown';
};

export class StatusAdapter implements ReadonlySourceAdapter<StatusSnapshot> {
  public readonly sourceType = 'status' as const;

  constructor(
    private readonly runCommand: CommandRunner = shellCommandRunner,
    private readonly command: readonly string[] = DEFAULT_COMMAND
  ) {}

  public async collect(): Promise<CollectedSnapshot<StatusSnapshot>> {
    const capturedAt = new Date().toISOString();
    const warnings: string[] = [];
    const [command, ...args] = this.command;
    const result = await this.runCommand(command, args);

    if (result.exitCode !== 0) {
      const errorText = result.stderr || 'unknown';
      warnings.push(`status_command_failed:${errorText}`);
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: {
          openclawStatus: 'unknown',
          raw: result.stdout,
          errors: [errorText]
        },
        warnings
      };
    }

    return {
      metadata: {
        sourceType: this.sourceType,
        capturedAt,
        freshnessMs: 0,
        readOnly: true,
        transport: 'command',
        sourceRef: this.command.join(' ')
      },
      data: {
        openclawStatus: classifyStatus(result.stdout),
        raw: result.stdout,
        errors: []
      },
      warnings
    };
  }
}
