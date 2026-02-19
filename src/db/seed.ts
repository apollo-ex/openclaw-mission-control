import type { DbExecutor } from './types.js';

export const seedDatabase = async (db: DbExecutor): Promise<void> => {
  const now = new Date().toISOString();

  await db.query(
    `
      INSERT INTO agents (agent_id, role, configured, source_snapshot_id, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(agent_id) DO NOTHING
    `,
    ['local-observer', 'observer', true, null, now]
  );

  await db.query(
    `
      INSERT INTO collector_state (collector_name, last_success_at, last_error_at, error_count, stale, last_error)
      VALUES ($1, NULL, NULL, 0, FALSE, NULL)
      ON CONFLICT(collector_name) DO NOTHING
    `,
    ['sessions_hot']
  );
};
