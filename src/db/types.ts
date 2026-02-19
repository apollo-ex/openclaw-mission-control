import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface DbExecutor {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]) => Promise<QueryResult<R>>;
}

export type DbPool = Pool;
export type DbClient = PoolClient;
