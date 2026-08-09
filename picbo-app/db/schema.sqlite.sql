-- Picbo.ai — real database schema (MVP core loop), SQLite dialect.
--
-- This is a focused subset of the full design in
-- docs/DATABASE_SCHEMA.md (which also covers teams, referrals,
-- affiliates, Lumi's RAG tables, feature flags, coupons) — this schema
-- covers exactly what's needed for a genuinely working core loop:
-- register, login, credits, generate.
--
-- GOING LIVE: see db/schema.postgres.sql for the Postgres equivalent,
-- and README.md for what else changes (the DATABASE_URL, and swapping
-- lib/db.ts to use the `postgres` package instead of node:sqlite).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS User (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user',
  createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Session (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId);

-- The credit ledger. Never mutate a running balance directly — every
-- change is a row here. Balance = SUM(amount) for a user.
CREATE TABLE IF NOT EXISTS CreditTransaction (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  amount    INTEGER NOT NULL,
  reason    TEXT NOT NULL,
  refId     TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_userId ON CreditTransaction(userId, createdAt);

CREATE TABLE IF NOT EXISTS Job (
  id             TEXT PRIMARY KEY,
  userId         TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'queued',
  prompt         TEXT NOT NULL,
  style          TEXT,
  aspectRatio    TEXT,
  creditsCharged INTEGER,
  resultUrl      TEXT,
  errorMessage   TEXT,
  createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
  completedAt    TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_userId ON Job(userId, createdAt);
CREATE TABLE IF NOT EXISTS Subscription (
  id                   TEXT PRIMARY KEY,
  userId               TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  paddleSubscriptionId TEXT NOT NULL UNIQUE,
  paddleCustomerId     TEXT NOT NULL,
  tier                 TEXT NOT NULL,
  interval             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active',
  currentPeriodEnd     TEXT,
  cancelAtPeriodEnd    INTEGER NOT NULL DEFAULT 0,
  createdAt            TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscription_userId ON Subscription(userId);
