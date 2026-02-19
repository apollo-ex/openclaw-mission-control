import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export const shellCommandRunner: CommandRunner = async (command, args) => {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 2 * 1024 * 1024,
      timeout: 10_000
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0
    };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string; code?: number };

    return {
      stdout: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || err.message,
      exitCode: typeof err.code === 'number' ? err.code : 1
    };
  }
};
