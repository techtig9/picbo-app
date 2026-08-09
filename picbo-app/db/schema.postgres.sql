-- Picbo.ai — real database schema (MVP core loop), PostgreSQL dialect.
-- Run this against a real Postgres database (Supabase, Neon, Vercel
-- Postgres, or any other Postgres host) when going live. See
-- README.md for the corresponding lib/db.ts change.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "User" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  role          text NOT NULL DEFAULT 'user',
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Session" (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" text NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_userid ON "Session"("userId");

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  amount      integer NOT NULL,
  reason      text NOT NULL,
  "refId"     text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_userid ON "CreditTransaction"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "Job" (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type             text NOT NULL,
  status           text NOT NULL DEFAULT 'queued',
  prompt           text NOT NULL,
  style            text,
  "aspectRatio"    text,
  "creditsCharged" integer,
  "resultUrl"      text,
  "errorMessage"   text,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "completedAt"    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_job_userid ON "Job"("userId", "createdAt");
