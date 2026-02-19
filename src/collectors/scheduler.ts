import type { Logger } from '../lib/logger.js';
import { markCollectorFailure, markCollectorSuccess } from '../db/upserts.js';
import type { CollectorContext, CollectorTask, SchedulerConfig } from './types.js';

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

interface TaskState {
  timer: NodeJS.Timeout;
  running: boolean;
}

export class CollectorScheduler {
  private readonly taskState = new Map<string, TaskState>();

  constructor(
    private readonly context: CollectorContext,
    private readonly tasks: CollectorTask[],
    private readonly config: SchedulerConfig,
    private readonly logger: Logger
  ) {}

  public start(): void {
    for (const task of this.tasks) {
      const state: TaskState = {
        running: false,
        timer: setInterval(() => {
          void this.executeTask(task, state);
        }, task.cadence.intervalMs)
      };

      this.taskState.set(task.name, state);
      void this.executeTask(task, state);

      this.logger.info('collector_started', {
        collector: task.name,
        cadence: task.cadence.kind,
        intervalMs: task.cadence.intervalMs
      });
    }
  }

  public stop(): void {
    for (const [name, state] of this.taskState) {
      clearInterval(state.timer);
      this.logger.info('collector_stopped', { collector: name });
    }

    this.taskState.clear();
  }

  private async executeTask(task: CollectorTask, state: TaskState): Promise<void> {
    if (state.running) {
      this.logger.debug('collector_skip_overlap', { collector: task.name });
      return;
    }

    state.running = true;

    try {
      await this.runWithRetries(task);
      markCollectorSuccess(this.context.db, task.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      markCollectorFailure(this.context.db, task.name, message, true);
      this.logger.error('collector_failed_permanently', {
        collector: task.name,
        error: message
      });
    } finally {
      state.running = false;
    }
  }

  private async runWithRetries(task: CollectorTask): Promise<void> {
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        await task.run(this.context);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isLastAttempt = attempt >= this.config.maxRetries;

        markCollectorFailure(this.context.db, task.name, message, isLastAttempt);

        this.logger.warn('collector_retry', {
          collector: task.name,
          attempt,
          maxRetries: this.config.maxRetries,
          error: message,
          isLastAttempt
        });

        if (isLastAttempt) {
          throw error;
        }

        const delay = Math.min(
          this.config.backoffBaseMs * Math.pow(2, attempt),
          this.config.backoffMaxMs
        );
        await sleep(delay);
      }
    }
  }
}
