import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.startsWith("file:")) {
  throw new Error(
    'DATABASE_URL is not a real Postgres connection string. Set it to a value like "postgresql://user:password@host:5432/dbname?sslmode=require" — see .env.example and README.md "Going live".'
  );
}

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

export const sql: ReturnType<typeof postgres> =
  globalForDb.pgClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = sql;
}

function toPositional(sqliteStyleSql: string): string {
  let i = 0;
  return sqliteStyleSql.replace(/\?/g, () => `$${++i}`);
}

const txContext = new AsyncLocalStorage<ReturnType<typeof postgres>>();

function activeClient(): ReturnType<typeof postgres> {
  return txContext.getStore() ?? sql;
}

export async function get<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await activeClient().unsafe(toPositional(query), params as never[]);
  return (rows[0] as T | undefined) ?? undefined;
}

export async function all<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const rows = await activeClient().unsafe(toPositional(query), params as never[]);
  return rows as unknown as T[];
}

export async function run(query: string, params: unknown[] = []): Promise<void> {
  await activeClient().unsafe(toPositional(query), params as never[]);
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  return sql.begin((txSql) =>
    txContext.run(txSql as unknown as ReturnType<typeof postgres>, fn)
  ) as Promise<T>;
}
