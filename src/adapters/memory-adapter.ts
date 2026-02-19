import fs from 'node:fs/promises';
import path from 'node:path';
import type { CollectedSnapshot, MemoryDocRecord, ReadonlySourceAdapter } from './types.js';

const CORE_DOCS = ['SOUL.md', 'USER.md', 'MEMORY.md'];

const toIso = (input: number): string => new Date(input).toISOString();

export class MemoryAdapter implements ReadonlySourceAdapter<MemoryDocRecord[]> {
  public readonly sourceType = 'memory' as const;

  constructor(private readonly workspaceRoot: string) {}

  public async collect(): Promise<CollectedSnapshot<MemoryDocRecord[]>> {
    const capturedAt = new Date().toISOString();
    const warnings: string[] = [];
    const docs: MemoryDocRecord[] = [];

    for (const coreName of CORE_DOCS) {
      const absolutePath = path.join(this.workspaceRoot, coreName);
      try {
        const [stat, content] = await Promise.all([
          fs.stat(absolutePath),
          fs.readFile(absolutePath, 'utf8')
        ]);

        docs.push({
          path: absolutePath,
          kind: 'core',
          updatedAt: toIso(stat.mtimeMs),
          content
        });
      } catch {
        warnings.push(`missing_core_doc:${coreName}`);
      }
    }

    const memoryRoot = path.join(this.workspaceRoot, 'memory');
    try {
      const entries = await fs.readdir(memoryRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) {
          continue;
        }

        const absolutePath = path.join(memoryRoot, entry.name);
        const [stat, content] = await Promise.all([
          fs.stat(absolutePath),
          fs.readFile(absolutePath, 'utf8')
        ]);

        docs.push({
          path: absolutePath,
          kind: 'memory',
          updatedAt: toIso(stat.mtimeMs),
          content
        });
      }
    } catch {
      warnings.push('memory_dir_unavailable');
    }

    return {
      metadata: {
        sourceType: this.sourceType,
        capturedAt,
        freshnessMs: 0,
        readOnly: true,
        transport: 'filesystem',
        sourceRef: this.workspaceRoot
      },
      data: docs,
      warnings
    };
  }
}
