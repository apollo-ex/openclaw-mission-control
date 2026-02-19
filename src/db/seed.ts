import type { DatabaseSync } from 'node:sqlite';

export const seedDatabase = (db: DatabaseSync): void => {
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO agents (agent_id, role, configured, source_snapshot_id, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO NOTHING
    `
  ).run('local-observer', 'observer', 1, null, now);

  db.prepare(
    `
      INSERT INTO collector_state (collector_name, last_success_at, last_error_at, error_count, stale, last_error)
      VALUES (?, NULL, NULL, 0, 0, NULL)
      ON CONFLICT(collector_name) DO NOTHING
    `
  ).run('sessions_hot');
};
