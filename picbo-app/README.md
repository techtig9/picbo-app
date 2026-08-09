# Picbo.ai — Real Backend (MVP core loop)

This is a genuinely working backend, not a mock. Register a real account, it
writes a real user to a real database with a real bcrypt-hashed password.
Log in, you get a real server-side session (not just a cookie the client
trusts itself — the server checks a real session table on every request).
Generate a photo, real credits get deducted from a real ledger, with a real
row-level SQL transaction guaranteeing two simultaneous requests can't both
succeed against a balance that only covers one of them.

**The one thing that's a placeholder:** the actual image generation call.
This was built in a sandboxed environment that cannot reach
`generativelanguage.googleapis.com` (Google's Gemini API) or
`api.paddle.com`, so those two integration points are isolated into
single, clearly-marked files (`lib/ai-provider.ts` for generation) rather
than faked throughout the app. Everything *around* that call — auth,
credits, job tracking, database persistence — is real.

## Quick start (local testing)

```bash
npm install
npm run dev
```

Open **http://localhost:3000** — that's a plain functional test page
(not the polished product UI, which lives separately in `../picbo/`) with
buttons that call the real API: Register, Login, Logout, check your real
session and credit balance, and Generate a photo that really deducts
credits from a real database.

No database setup is required — `dev.db` (a SQLite file) is created
automatically the first time the app runs, and the schema is applied
automatically even if that file goes missing later. There's nothing to
install, no server to start separately, no account to sign up for.

## What's real, tested, and verified

Every one of these was actually exercised against the running server with
real HTTP requests, not just written and assumed to work:

| Behavior | Verified |
|---|---|
| Register creates a real user, real bcrypt hash, real 500-credit grant | ✅ |
| Duplicate email is rejected (409) | ✅ |
| Wrong password is rejected (401), same error as "no such user" (no enumeration) | ✅ |
| Correct login creates a real server-side session | ✅ |
| `/api/me` requires a real valid session (401 without one) | ✅ |
| Generating a photo creates a real job row and deducts real credits | ✅ |
| Insufficient credits are rejected (402) with **zero balance change** — verified by checking the balance is unchanged after a rejected attempt, not just that the error came back | ✅ |
| A non-admin user is blocked from the admin endpoint (403) | ✅ |
| A real user promoted to admin (directly in the database — never via API) can access it (200) | ✅ |
| Logout destroys the session server-side; the old cookie stops working (401) | ✅ |
| A full production build (`npm run build`) compiles with 0 TypeScript errors and 0 build warnings | ✅ |
| The entire test suite above re-passes against the production build (`npm start`), not just `npm run dev` | ✅ |
| `npm audit`: 0 vulnerabilities | ✅ |

## API reference

| Route | Method | Auth | Does |
|---|---|---|---|
| `/api/auth/register` | POST | — | `{name, email, password}` → creates user, grants 500 credits, starts session |
| `/api/auth/login` | POST | — | `{email, password}` → starts session |
| `/api/auth/logout` | POST | — | Destroys the current session |
| `/api/me` | GET | session | Current user + real credit balance |
| `/api/generate/photo` | POST | session | `{prompt, style?, aspectRatio?, complexity?}` → charges credits, creates a job, returns the (mock) result |
| `/api/jobs/:id` | GET | session | Fetch a job's status (only your own, unless admin) |
| `/api/admin/users` | GET | session + `role=admin` | List all users with real balances |

## Project structure

```
picbo-app/
├── app/
│   ├── page.tsx              Plain functional test page
│   ├── layout.tsx
│   └── api/                  All 7 real API routes listed above
├── lib/
│   ├── db.ts                  The ONE file to change to go live (see below)
│   ├── auth.ts                 Real bcrypt hashing + real DB-backed sessions
│   ├── credits.ts               Real, race-condition-safe credit ledger
│   └── ai-provider.ts            The ONE file to change to connect real Gemini
├── db/
│   ├── schema.sqlite.sql        Local testing schema (auto-applied)
│   └── schema.postgres.sql      Production schema — see "Going live"
├── scripts/init-db.js           Manual schema init/reset (`npm run db:init`)
└── .env / .env.example
```

## Going live

Three things change. Nothing else in the app needs to be touched.

### 1. Real database (required)

Vercel's serverless functions don't have a persistent local disk, so the
SQLite file this uses for local testing won't work once deployed — you
need a real hosted Postgres database.

1. Create a free database at [supabase.com](https://supabase.com) or
   [neon.tech](https://neon.tech) (both have a generous free tier).
2. Run `db/schema.postgres.sql` against it (both services have a SQL
   editor in their dashboard you can paste it into).
3. Install a Postgres client: `npm install postgres`
4. Rewrite `lib/db.ts` to use it instead of `node:sqlite` — the exported
   function signatures (`get`, `all`, `run`, `transaction`) are what every
   other file in the app calls, so keeping those same four function names
   with the same behavior means no other file needs to change. This is a
   genuinely different implementation (SQL parameter placeholders differ
   slightly between SQLite and Postgres — SQLite uses `?`, Postgres's
   `postgres` package uses tagged template literals), so budget real time
   for this step and test it the same way this project tested the SQLite
   version — a fresh registration, a real login, a real generation, a
   real insufficient-credits check.
5. Set `DATABASE_URL` in your hosting provider's environment variables to
   the real connection string.

### 2. Real Gemini generation (optional — the app works without this, just with mock images)

See the detailed instructions at the top of `lib/ai-provider.ts`. In
short: get a key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
set `GEMINI_API_KEY`, and implement the real call in that one function.

### 3. A real `SESSION_SECRET` and deployment

- Generate one with `openssl rand -base64 32` and set it as an environment
  variable — never reuse the placeholder value from `.env`.
- Deploy with the Vercel CLI (`vercel --prod`) or connect this repository
  to Vercel the same way described in `../picbo/docs/DEPLOY_VERCEL.md` —
  the dashboard flow is identical, just make sure **Framework Preset**
  auto-detects as **Next.js** this time (not "Other," since this is a real
  Next.js app, unlike the static frontend that guide was written for).

## What's still missing from the full product spec

This is the **MVP core loop** — auth, credits, one working generation
mode. The full product spec in `../picbo/docs/DATABASE_SCHEMA.md` and
`../picbo/docs/BACKEND_ARCHITECTURE.md` also covers teams, referrals,
affiliates, Lumi's RAG-backed chat, feature flags, and coupons — none of
that is wired up here yet. This project is built so extending it means
adding new tables to the schema files and new route files following the
same patterns already established (real validation with `zod`, real
session checks, real database transactions where money or credits are
involved) — not rearchitecting anything.

The 19-page polished frontend in `../picbo/` is a separate, already-tested
static prototype and hasn't been wired up to call these real endpoints yet
— right now it's the plain test page above, and the static frontend's
JavaScript, that would need to be updated to `fetch()` these routes
instead of running its local mock logic.
