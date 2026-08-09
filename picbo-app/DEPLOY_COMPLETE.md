# Deploying Picbo.ai — Complete Guide

This covers deploying the **whole, unified application** — the real
19-page frontend and the real backend, together, as one Vercel
deployment. This supersedes any earlier deployment guide written before
the frontend and backend were merged into one project.

Two stages: **Stage 1** gets you a live, testable deployment in minutes,
running on the same SQLite database used for local testing. **Stage 2**
is what makes it genuinely production-ready — a real hosted database and
(optionally) real Gemini generation.

---

## Before you start

1. A [Vercel account](https://vercel.com/signup) — free tier is enough.
2. A [GitHub account](https://github.com) — the recommended path connects
   a GitHub repository to Vercel so every push auto-deploys.
3. The project files — the extracted `picbo-app` folder from this
   conversation, containing `public/` (the frontend), `app/api/` (the
   backend), and everything else described in
   `PICBO_COMPLETE_DOCUMENTATION.md`.
4. [Node.js](https://nodejs.org) installed locally if you want to test
   before pushing (recommended, and covered below).

---

## Stage 1 — Get it live (SQLite, works immediately)

**Important limitation to understand first:** Vercel's serverless
functions don't have a persistent local disk. A SQLite file survives
within a single running process, but Vercel can spin up a fresh function
instance per request, each with its own empty filesystem — meaning data
written in one request may not be visible in the next. **This stage is
for confirming the deployment itself works — the site loads, pages
render, the design looks right — not for real multi-user testing with
persistent accounts.** Stage 2 (real Postgres) is what makes accounts and
credits actually persist reliably once live. If you only need to see the
deployed site and click through pages, Stage 1 alone is enough.

### 1. Test it locally first

```bash
cd picbo-app
npm install
npm run dev
```

Open **http://localhost:3000** — this should redirect to the real
landing page (`index.html`), not the plain test harness. Click through
Register, Dashboard, and Generate to confirm everything works locally
before deploying. (Full manual test checklist is in "Verifying the
deployment" below — run through it locally once, then again after
deploying.)

### 2. Push to GitHub

```bash
cd picbo-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/picbo-app.git
git push -u origin main
```

Replace `YOUR-USERNAME` — create the empty repository on GitHub first
(github.com → **+** → **New repository** → name it → **Create
repository**, without adding a README), and use the exact URL GitHub
shows you there.

### 3. Import into Vercel

1. Go to **[vercel.com/dashboard](https://vercel.com/dashboard)**.
2. Click **Add New…** → **Project**.
3. First time connecting GitHub: click **Install** on the Vercel GitHub
   App, authorize it, and select your `picbo-app` repository (or **All
   repositories**).
4. Find `picbo-app` in the list, click **Import**.
5. On the **Configure Project** screen:
   - **Framework Preset**: should auto-detect as **Next.js** — this is
     correct (unlike the earlier static-only version of this project,
     which needed "Other"). If it doesn't auto-detect, select **Next.js**
     manually.
   - **Root Directory**: `./` (default) — correct if you pushed the
     contents of `picbo-app` directly to the repo root.
   - **Build and Output Settings**: leave everything default — Vercel
     runs `npm run build` (which also runs `db:init` first, per
     `package.json`) and knows Next.js's output format natively.
   - **Environment Variables**: add one now —
     - Name: `SESSION_SECRET`
     - Value: a real random string, generated with `openssl rand -base64 32`
       in your terminal (never reuse the placeholder from `.env`)
     - Leave `GEMINI_API_KEY` unset for now (Stage 2, optional)
6. Click **Deploy**.
7. Takes under two minutes. When it finishes, click **Visit**.

Your site is now live at `https://picbo-app-xyz.vercel.app` (or whatever
name you chose). It redirects to the real landing page, and every page
from the 19-page design is reachable.

### 4. Redeploying after changes

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel detects the push and redeploys automatically — watch progress
under your project's **Deployments** tab.

---

## Stage 2 — Make it production-ready (real database)

This is what makes registered accounts, sessions, and credit balances
actually persist reliably, instead of being at the mercy of which
serverless instance happens to handle each request.

### 1. Create a free Postgres database

Either works well and has a generous free tier:
- **[supabase.com](https://supabase.com)** → New Project → note the
  connection string from **Project Settings → Database → Connection
  string** (use the "Transaction" pooler connection string for
  serverless compatibility).
- **[neon.tech](https://neon.tech)** → New Project → the connection
  string is shown immediately on the project dashboard.

### 2. Apply the schema

Both services have a SQL editor in their dashboard. Open
`db/schema.postgres.sql` from this project, paste its full contents in,
and run it. This creates the same four tables (`User`, `Session`,
`CreditTransaction`, `Job`) in real Postgres.

### 3. Rewrite `lib/db.ts`

**Honest correction to something said earlier in this project:** the
backend's own `README.md` describes this as changing only one file
because the four function names (`get`, `all`, `run`, `transaction`)
stay the same — that's true, but it understates one real detail: the
current SQLite implementation is *synchronous* (Node's `node:sqlite` API
returns results immediately), while a real Postgres client is
*asynchronous* (it talks to a real server over a network, so every call
returns a Promise). That means every place in the codebase that *calls*
these functions needs an `await` added in front. This is still a small,
mechanical change — not a rewrite of application logic — but it does
touch more than one file. Here's the complete list, and exactly what
changes.

Install a Postgres client (pure JavaScript, no native binary to download
— avoids the exact problem this project hit with Prisma):

```bash
npm install postgres
```

Replace the entire contents of `lib/db.ts` with:

```typescript
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
```

Delete the old `ensureSchema()`/SQLite-specific code from that file
entirely — the schema is applied once via the SQL editor step above, not
on every app startup.

### 4. Update every call site to `await` the now-async functions

`lib/credits.ts` — make every exported function `async` and add `await`
in front of its internal `get`/`run`/`transaction` calls:

```typescript
export async function getCreditBalance(userId: string): Promise<number> {
  const row = await get<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM CreditTransaction WHERE userId = ?",
    [userId]
  );
  return row?.total ?? 0;
}

export async function chargeCredits(
  userId: string, amount: number, reason: string, refId?: string
): Promise<void> {
  await transaction(async () => {
    const balance = await getCreditBalance(userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
    await run(
      "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, -amount, reason, refId ?? null]
    );
  });
}

export async function grantCredits(
  userId: string, amount: number, reason: string, refId?: string
): Promise<void> {
  await run(
    "INSERT INTO CreditTransaction (id, userId, amount, reason, refId) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, amount, reason, refId ?? null]
  );
}
```

`lib/auth.ts` — add `await` in front of the `get`/`run` calls inside
`createSession()`, `getSessionUser()`, and `destroySession()` (they're
already `async` functions, so this is just adding the keyword, not
restructuring).

Every route file in the table below — add `await` in front of every call
to `get`, `all`, `run`, `chargeCredits`, `grantCredits`, and
`getCreditBalance`:

| File | Calls that need `await` added |
|---|---|
| `app/api/auth/register/route.ts` | `get(...)`, `run(...)`, `grantCredits(...)` |
| `app/api/auth/login/route.ts` | `get(...)` |
| `app/api/me/route.ts` | `getCreditBalance(...)` |
| `app/api/generate/photo/route.ts` | `run(...)` (×3), `get(...)`, `chargeCredits(...)`, `grantCredits(...)` |
| `app/api/jobs/[id]/route.ts` | `get(...)` |
| `app/api/admin/users/route.ts` | `all(...)`, `getCreditBalance(...)` (inside the `.map()` — switch that to `Promise.all(users.map(async (u) => ...))`, same pattern already used in the SQLite version's aggregation, just with `await` added) |

**This part of the migration path is documented and reasoned through
carefully, but — unlike everything else in this project — not verified
by actually running it,** because no Postgres server is reachable from
the sandboxed environment this was built in. Test it the same way the
SQLite version was tested: register a real account, log in, generate,
confirm the credit balance actually decreases, try an insufficient-credits
case, confirm a non-admin is blocked from the admin endpoint. If anything
above doesn't compile or behave as described, that's the specific gap to
debug first.

### 5. Update environment variables and redeploy

In Vercel: **Settings → Environment Variables** → add:
- `DATABASE_URL` = your real Postgres connection string. Click the
  **Sensitive** option when adding it (Vercel added this after a 2026
  security review of how secrets are handled) so it's encrypted at rest
  and never shown again in the dashboard after saving.

Push your code changes, or click **Redeploy** on the latest deployment
if you only changed environment variables (existing deployments don't
pick up new env vars automatically — you need a new deployment for them
to apply).

---

## Stage 3 — Optional: connect real Gemini generation

The app fully works without this — "Generate" just returns a seeded
placeholder image otherwise. To make it real:

1. Get a key at **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
2. Add `GEMINI_API_KEY` in Vercel's environment variables (mark it
   **Sensitive** too).
3. Implement the real call in `lib/ai-provider.ts` — the file's header
   comment has exact, current instructions and links, since Gemini's
   exact request/response shape can change over time and shouldn't be
   trusted from any older written example, including this one.
4. Redeploy.

---

## Verifying the deployment

Run through this after Stage 1, and again after Stage 2:

1. **Homepage loads** at your Vercel URL, redirecting to the real
   landing page — hero, animated background, navigation all render.
2. **Register a real account** through the actual UI (`/register.html`)
   — fill every required field, including the Country dropdown (an
   easy one to miss — the browser silently blocks submission if it's
   left on the empty default option).
3. **Confirm the email-verify screen appears**, click through to
   onboarding, then to the dashboard.
4. **Dashboard shows a real credit balance** (500, fresh signup bonus).
5. **Generate a photo** — confirm the credit number visibly decreases
   (500 → 460) and a new card appears in "Recent creations."
6. **Log out**, confirm you're bounced back to login if you try to
   revisit the dashboard directly.
7. **Try logging in with the wrong password** — confirm a real error
   message appears in the UI, not a silent failure.
8. **Log in correctly** — confirm you land back on the dashboard.
9. **Custom 404 page**: visit a nonexistent path — should show the
   branded "This page didn't generate." page.

If registration seems to silently do nothing, the Country dropdown is
the first thing to check — it's a real `required` field and the browser
blocks the form before your JavaScript ever runs if it's left unselected.

---

## Troubleshooting

- **"Application error" / 500 on any `/api/*` route after deploying** —
  almost always a missing or malformed `DATABASE_URL` (Stage 2) or
  `SESSION_SECRET` (Stage 1). Check **Settings → Environment Variables**,
  and check the **Deployments → [latest] → Functions** tab for the actual
  error message from the serverless function logs.
- **Registration/login works locally but not when deployed (Stage 1
  only, before Postgres)** — expected, per the SQLite limitation
  explained at the top of Stage 1. This is exactly what Stage 2 fixes.
- **404 on the homepage itself** — check that `next.config.js`'s
  redirect from `/` to `/index.html` deployed correctly, and that
  `public/index.html` exists in what you pushed to GitHub.
- **Page loads with no styling** — check the Network tab for a failed
  request to `/assets/css/style.css`; the `public/assets` folder may not
  have been included in your git push (check it's not accidentally
  listed in `.gitignore`).
- **Changes not showing up** — confirm a new deployment actually
  succeeded (green checkmark) under **Deployments**, and that you're
  looking at the production URL, not a stale preview URL from an earlier
  push.
- **Environment variable changes not taking effect** — they only apply
  to deployments created *after* you saved them; trigger a new one with
  **Redeploy** (uncheck "Use existing Build Cache") or a new `git push`.

---

## Custom domain (optional)

**Settings → Domains** in your Vercel project → type your domain → **Add**
→ follow the DNS records Vercel shows you at your domain registrar.
HTTPS is issued automatically once DNS resolves correctly. Not required
for testing — the free `*.vercel.app` URL is a complete, real, shareable
URL on its own.
