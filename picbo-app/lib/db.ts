import postgres from "postgres";

// DATABASE_URL is your real Postgres connection string from Supabase/Neon.
const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

// The rest of the app calls get/all/run/transaction with SQLite-style
// "?" placeholders (e.g. "SELECT * FROM User WHERE email = ?"). This
// converts those to Postgres's "$1, $2, ..." positional syntax so the
// call sites below don't need their SQL strings rewritten.
function toPositional(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

export async function get<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await sql.unsafe(toPositional(query), params as never[]);
  return rows[0] as T | undefined;
}

export async function all<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const rows = await sql.unsafe(toPositional(query), params as never[]);
  return rows as unknown as T[];
}

export async function run(query: string, params: unknown[] = []) {
  return sql.unsafe(toPositional(query), params as never[]);
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const results = await sql.begin(async () => {
    return fn();
  });
  return results as T;
}
