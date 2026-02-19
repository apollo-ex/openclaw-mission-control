import type { CommandRunner } from '../lib/command-runner.js';
import { shellCommandRunner } from '../lib/command-runner.js';
import type {
  CollectedSnapshot,
  CronJobRecord,
  CronRunRecord,
  CronSnapshot,
  ReadonlySourceAdapter
} from './types.js';

const DEFAULT_COMMAND = ['openclaw', 'cron', 'list', '--json'] as const;

const normalizeJob = (item: Record<string, unknown>): CronJobRecord => {
  return {
    jobId: String(item.jobId ?? item.job_id ?? item.id ?? 'unknown'),
    name: String(item.name ?? 'unnamed'),
    scheduleKind: String(item.scheduleKind ?? item.schedule_kind ?? 'unknown'),
    enabled: Boolean(item.enabled ?? false),
    nextRunAt: typeof item.nextRunAt === 'string' ? item.nextRunAt : null
  };
};

const normalizeRun = (item: Record<string, unknown>): CronRunRecord => {
  return {
    runId: String(item.runId ?? item.run_id ?? item.id ?? 'unknown'),
    jobId: String(item.jobId ?? item.job_id ?? 'unknown'),
    status: String(item.status ?? 'unknown'),
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
    endedAt: typeof item.endedAt === 'string' ? item.endedAt : null,
    summary: String(item.summary ?? '')
  };
};

export class CronAdapter implements ReadonlySourceAdapter<CronSnapshot> {
  public readonly sourceType = 'cron' as const;

  constructor(
    private readonly runCommand: CommandRunner = shellCommandRunner,
    private readonly command: readonly string[] = DEFAULT_COMMAND
  ) {}

  public async collect(): Promise<CollectedSnapshot<CronSnapshot>> {
    const capturedAt = new Date().toISOString();
    const warnings: string[] = [];

    const [command, ...args] = this.command;
    const result = await this.runCommand(command, args);

    if (result.exitCode !== 0) {
      warnings.push(`cron_command_failed:${result.stderr || 'unknown'}`);
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: { jobs: [], runs: [] },
        warnings
      };
    }

    try {
      const parsed = JSON.parse(result.stdout) as {
        jobs?: unknown;
        runs?: unknown;
      };

      const jobs = Array.isArray(parsed.jobs)
        ? parsed.jobs
            .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
            .map(normalizeJob)
        : [];
      const runs = Array.isArray(parsed.runs)
        ? parsed.runs
            .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
            .map(normalizeRun)
        : [];

      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: { jobs, runs },
        warnings
      };
    } catch {
      warnings.push('cron_output_not_json');
      return {
        metadata: {
          sourceType: this.sourceType,
          capturedAt,
          freshnessMs: 0,
          readOnly: true,
          transport: 'command',
          sourceRef: this.command.join(' ')
        },
        data: { jobs: [], runs: [] },
        warnings
      };
    }
  }
}
