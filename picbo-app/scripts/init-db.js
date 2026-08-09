// Ensures the SQLite database file and schema exist before Next.js
// starts. Safe to run every time — it's a no-op if the schema is
// already there. Loads .env by hand since this runs outside Next's
// request lifecycle (which normally loads .env automatically).
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const rawUrl = process.env.DATABASE_URL || "file:./dev.db";
if (!rawUrl.startsWith("file:")) {
  console.log("DATABASE_URL is not a local file (looks like Postgres) — skipping SQLite init.");
  process.exit(0);
}

const dbPath = path.resolve(process.cwd(), rawUrl.slice("file:".length));
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

const exists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'")
  .get();

if (exists) {
  console.log(`Database already initialized at ${dbPath}`);
} else {
  const schemaSql = fs.readFileSync(
    path.resolve(process.cwd(), "db/schema.sqlite.sql"),
    "utf-8"
  );
  db.exec(schemaSql);
  console.log(`Database created and schema applied at ${dbPath}`);
}

db.close();
