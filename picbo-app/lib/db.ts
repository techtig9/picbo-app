import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

// DATABASE_URL looks like "file:./dev.db" for local testing (see .env).
// Going live means swapping this whole file for a Postgres client (the
// `postgres` npm package) pointed at DATABASE_URL from .env.example —
// see README.md "Going live" section for the exact steps. The rest of
// the app (lib/auth.ts, lib/credits.ts, the API routes) calls only the
// get/all/run/transaction functions below, so that swap doesn't touch
// application logic, only this one file.

const rawUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = rawUrl.startsWith("file:")
  ? path.resolve(/* turbopackIgnore: true */ process.cwd(), rawUrl.slice("file:".length))
  : rawUrl;

const globalForDb = globalThis as unknown as { sqliteDb?: DatabaseSync };

function createConnection(): DatabaseSync {
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  return database;
}

export const rawDb: DatabaseSync = globalForDb.sqliteDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqliteDb = rawDb;
}

/** Runs the schema file if the User table doesn't exist yet — safe to call every startup. */
export function ensureSchema(): void {
  const exists = rawDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'")
    .get();
  if (exists) return;

  const schemaPath = path.resolve(process.cwd(), "db/schema.sqlite.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  rawDb.exec(schemaSql);
}

// Called immediately, unconditionally, on module load — not just from
// the db:init script. This is what makes the app self-healing: it
// doesn't matter which npm script sequence created the process (dev,
// build, or a bare `next start` against a fresh/missing database file),
// the schema is guaranteed to exist before any query runs against it.
// The npm run db:init script still exists for explicitly inspecting or
// resetting the database from the command line.
if (rawUrl.startsWith("file:")) {
  ensureSchema();
}

export function get<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | undefined {
  const stmt = rawDb.prepare(sql);
  return stmt.get(...(params as never[])) as T | undefined;
}

export function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const stmt = rawDb.prepare(sql);
  return stmt.all(...(params as never[])) as T[];
}

export function run(sql: string, params: unknown[] = []) {
  const stmt = rawDb.prepare(sql);
  return stmt.run(...(params as never[]));
}

/** A real SQL transaction — used by chargeCredits so a balance check and
 * its deduction can never be split by a concurrent request. */
export function transaction<T>(fn: () => T): T {
  rawDb.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    rawDb.exec("COMMIT");
    return result;
  } catch (err) {
    rawDb.exec("ROLLBACK");
    throw err;
  }
}
