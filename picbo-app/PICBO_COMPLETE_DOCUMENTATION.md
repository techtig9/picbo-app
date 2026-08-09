# Picbo.ai — Complete Project Documentation

This is the single reference document for the whole project: what it is,
how it's built, what's genuinely real versus mocked, every feature, every
file, and everything that's been tested. Read this first; it links out to
the more detailed docs for anything you want to go deeper on.

---

## 1. What Picbo.ai is

Picbo.ai is an AI platform concept — generate professional photos, ad
creatives, product photoshoots, and short animated ads from a text prompt,
powered by Google's Gemini. It's built by a fictional agency, Techtig.

This project is now **one real, running application** — not a static
mockup and a separate backend that happen to sit next to each other. A
single Next.js server serves the full 19-page designed frontend *and* a
real backend with a real database underneath it. You can register a real
account, log in, generate an image, watch real credits get deducted, log
out, and log back in — all through the actual designed UI, not a
developer test harness.

**The one honest gap:** the image that comes back from "Generate" is a
placeholder, not a real Gemini output — because the sandboxed environment
this was built in cannot reach `generativelanguage.googleapis.com` or
`api.paddle.com`. Every piece of infrastructure *around* that call —
accounts, sessions, the credit ledger, job records — is real. Section 4
below explains exactly what that means and how to make generation real
too.

---

## 2. Architecture — how the two halves became one

Two things were built separately across this project's development, then
merged into a single deployable app:

1. **The frontend** — 19 hand-built HTML/CSS/JS pages: landing page,
   auth flow, onboarding, dashboard, billing, team, referrals, admin
   panel, developer/API page, community explore gallery, changelog, help
   center, legal pages, a 404 page. Dark cyber/tech visual design,
   Tailwind CSS (via CDN, with a same-origin fallback layer), WCAG
   AA-verified contrast, fully responsive, an AI assistant widget (Lumi).

2. **The backend** — a real Next.js API with a real SQLite database
   (swappable to Postgres), real bcrypt password hashing, real
   server-side sessions, and a real credit ledger.

**The merge:** the frontend's static files now live in
`picbo-app/public/`, which Next.js serves directly alongside the API
routes under `picbo-app/app/api/`. One server, one port, one deployment.
The frontend's own JavaScript (`public/assets/js/main.js`) was rewired so
that registration, login, logout, and the dashboard's photo generation
call the real API endpoints — with real error handling for wrong
passwords, duplicate emails, and insufficient credits — instead of
running local mock logic. Everything else in the 19-page site (Paddle
checkout, the admin panel's data, referrals, teams) is still UI-accurate
mock behavior, documented honestly as such throughout this file.

```
picbo-app/                      ← the whole product, one Next.js app
├── public/                     ← the real, designed 19-page frontend
│   ├── index.html, dashboard.html, admin.html, ... (19 pages)
│   └── assets/css/style.css, assets/js/main.js
├── app/
│   ├── api/                    ← the real backend
│   │   ├── auth/register|login|logout/route.ts
│   │   ├── me/route.ts
│   │   ├── generate/photo/route.ts
│   │   ├── jobs/[id]/route.ts
│   │   └── admin/users/route.ts
│   └── test/page.tsx           ← a plain manual-test harness (not the product UI)
├── lib/
│   ├── db.ts                   ← the one file to change for Postgres
│   ├── auth.ts                 ← real bcrypt + real DB-backed sessions
│   ├── credits.ts               ← real, race-condition-safe credit ledger
│   └── ai-provider.ts            ← the one file to change for real Gemini
├── db/
│   ├── schema.sqlite.sql        ← local testing schema (auto-applied)
│   └── schema.postgres.sql      ← production schema
└── next.config.js                ← redirects "/" to the real homepage
```

---

## 3. Complete feature list

Organized by what a visitor or user can actually do.

**Generate content** (4 modes, designed in the UI; only Photo is wired to
a real endpoint — see §4):
- Photo — single images across 60+ styles
- Ad Creative — platform-sized ads with AI-written copy
- Product Photoshoot — one reference photo → multi-angle set
- Animated Ad — a 15-second, 1080p slideshow from photos (explicitly not
  generative video)

**Get help**
- Lumi, an AI assistant widget on every page (currently rule-based, not
  yet connected to real Gemini — see §4)
- Searchable Help Center

**Account** (fully real — see §4)
- Register, login, logout — real accounts, real sessions
- 5-step onboarding (UI only, not yet persisted)
- Settings: profile, password, 2FA toggle, notification preferences (UI
  only, not yet wired to the backend)

**Organize work**
- Dashboard with an interactive onboarding checklist
- Library: creations, prompt history, saved prompts, collections (UI
  only)
- Notifications feed (UI only)
- Explore — community gallery, filterable by type (UI only)

**Billing**
- 5 tiers: Free, Starter ($14), Pro ($29), Business ($59), Agency ($199)
- Monthly/Yearly toggle with correct, bug-fixed annual totals
- Credit top-ups, overage billing, 7-day trial (all UI only — no real
  Paddle integration)

**Growth**
- Referral program, affiliate program application, public changelog (UI
  only)

**Team**
- Invite teammates with roles, shared brand kits (UI only)

**Developer**
- API keys table, real code snippets (cURL/Node/Python), webhook
  management (UI only — the *documented* API is real and live, shown in
  §5, but the key-management UI itself isn't wired up yet)

**Admin** (UI shows realistic hardcoded data; the real backend's admin
endpoint is separate and functional — see §5)
- MRR/churn/LTV analytics, credit-usage-by-action tracker, transaction
  log, affiliate payouts, moderation queue, feature flags, coupons, users

---

## 4. What's real, what's mock — the precise boundary

This is the section to read before assuming anything works end to end.

| Capability | Status |
|---|---|
| Creating an account | **Real.** Bcrypt-hashed password, real row in a real database |
| Logging in / staying logged in | **Real.** A real server-side session, checked on every protected request — not a client-trusted cookie |
| Logging out | **Real.** The session is deleted server-side; the old cookie stops working |
| Credit balance | **Real.** Computed from a real transaction ledger, not a mutable counter |
| Generating a photo | **Half real.** The request, validation, auth check, credit deduction, job record, and refund-on-failure logic are all real. The *image* returned is a seeded placeholder (`picsum.photos`), not real Gemini output |
| Admin role check | **Real,** but there's no real UI to promote a user to admin yet — it's done directly in the database (`UPDATE User SET role='admin'`), matching the security principle that admin rights should never be grantable via API |
| Ad Creative / Photoshoot / Animated Ad generation | **Mock only** — the UI shows the flow, but only Photo has a real API route behind it |
| Paddle checkout / billing | **Mock only** — no real payment processor is connected |
| Lumi (AI assistant) | **Mock only** — a small canned rule-based script, not real Gemini |
| Teams, referrals, notifications, settings, library | **Mock only** — realistic UI, no backend persistence yet |
| Admin panel's dashboard (MRR, users, transactions) | **Mock only** — hardcoded realistic numbers, not read from the real database (the real `/api/admin/users` endpoint exists and works, but the admin *page* doesn't call it yet) |

**Why the gap exists:** this was built in a sandboxed environment that can
reach npm, PyPI, GitHub, and Ubuntu's package archives, but not
`generativelanguage.googleapis.com` (Gemini) or `api.paddle.com`
(Paddle). Rather than fake those calls invisibly throughout the app, both
integration points are isolated into single, clearly-commented files:

- `lib/ai-provider.ts` — swap in a real Gemini call here (exact
  instructions are in the file's header comment)
- Paddle was never wired into the real backend at all yet — the frontend's
  checkout modal is still pure UI mock, same as it's been throughout this
  project

---

## 5. The real API — full reference

Every route below is live, tested, and enforces real validation and auth.

| Route | Method | Auth required | What it does |
|---|---|---|---|
| `/api/auth/register` | POST | — | `{name, email, password}` → creates user, grants 500 credits, starts a session |
| `/api/auth/login` | POST | — | `{email, password}` → starts a session |
| `/api/auth/logout` | POST | — | Destroys the current session |
| `/api/me` | GET | session | Current user + real credit balance |
| `/api/generate/photo` | POST | session | `{prompt, style?, aspectRatio?, complexity?}` → charges credits, creates a job, returns the (mock) result |
| `/api/jobs/:id` | GET | session | Fetch a job's status (only your own, unless admin) |
| `/api/admin/users` | GET | session + `role=admin` | List all users with real balances |

**Credit costs enforced server-side** (from `lib/credits.ts`):

| Action | Credits |
|---|---|
| Simple photo | 40 |
| Complex photo | 80 |
| Ad creative (single) | 120 |
| Ad creative (bundle) | 300 |
| Photoshoot set | 350 |
| Animated ad | 500 |

Only `photo.simple`/`photo.complex` are reachable through the real
`/api/generate/photo` endpoint today; the rest are defined and priced,
ready for the same route pattern to be extended to them.

---

## 6. Design system

Dark cyber/tech visual identity, arrived at over several iterations:

- **Typography:** Space Grotesk (bold display headings), Instrument
  Serif (italic accent treatment), Instrument Sans (body/UI), JetBrains
  Mono (data/labels)
- **Color:** true-black surface scale, electric cyan primary accent,
  blue→cyan→magenta gradient family, matrix-green standalone accent
  (success/checkmarks), gold for credits
- **Texture & motion:** circuit-grid + scanline backdrop, neon glow on
  interactive states, HUD corner-bracket accents, kinetic word-reveal
  headline, spring-eased hovers, cross-page fade transitions
- **Tailwind CSS:** loaded via CDN with a theme extension mapping
  Tailwind's utilities onto these same design tokens, plus a same-origin
  fallback CSS layer so the design is correct even if the CDN is blocked
  (a real production concern, not just a sandbox limitation — Tailwind's
  own docs say the Play CDN isn't meant for production reliability)
- **Accessibility:** every text/background pairing verified against WCAG
  AA contrast (4.5:1 body text, 3:1 large text); skip-to-content links on
  every page; password visibility toggles; keyboard-navigable

---

## 7. Testing performed — the honest record

This project was tested continuously, not just at the end, and several
real bugs were caught and fixed along the way rather than glossed over.

**Static checks** (run repeatedly throughout development): JS syntax
validation, CSS brace balance, HTML tag balance across all pages,
duplicate-ID detection, internal link and asset integrity, npm
vulnerability audits, TypeScript compilation.

**Dynamic checks:** every page loaded in a real headless browser
(Playwright + Chromium) with interactive elements actually clicked, not
just assumed to work; screenshots taken and pixel-sampled to verify
colors and layout, not just visually eyeballed.

**Backend checks:** a 15-case automated regression suite run against the
live server via real HTTP requests (registration, duplicate email, wrong
password, session checks, credit deduction, insufficient-credits
rejection with balance-unchanged verification, admin gating, logout) —
passing consistently, including against the actual production build
(`npm run build && npm start`), not just dev mode.

**Full connected-system check:** a real-browser, real-click, real-typing
end-to-end test of the entire user journey through the actual designed
UI — register → email-verify screen → onboarding → dashboard → real
generation with visible credit deduction (500 → 460) → logout → blocked
from the dashboard → wrong-password rejection shown in the real UI →
correct login → back into the dashboard. Zero JavaScript errors across
the whole flow.

**Real bugs found and fixed during this process** (not hidden):
- A critical CVE in the originally-chosen Next.js version, which led to
  discovering the CVE affected the entire 14.x/15.x line — resolved by
  moving to current stable Next.js 16 rather than picking another
  eventually-vulnerable version
- Next.js 15+ made `cookies()` and route params asynchronous — verified
  via research before writing session code, since guessing wrong here
  would have silently broken authentication
- Prisma's query-engine binary isn't reachable from the build
  environment — discovered mid-build, resolved by rewriting the entire
  data layer on Node's built-in `node:sqlite` instead of working around
  it
  a security-relevant misuse of a balance-checked function for a
  no-check refund operation, caught in code review before shipping
- A production-only bug where `npm start` alone didn't guarantee the
  database schema existed — fixed by making schema creation automatic
  and self-healing on first connection, then re-verified against the
  exact failing scenario
- A UI gap where the credit balance updated in one place on screen but
  not another after generating
- A misdiagnosed "broken login" that turned out to be a test script's
  insufficient wait time racing against real bcrypt hashing latency —
  investigated properly (ruled out a stale server process, then a
  navigation-pattern theory) before finding the actual cause

---

## 8. Going live — the short version

Three things, in order of importance:

1. **A real hosted Postgres database** (Supabase or Neon both have a free
   tier) — required, since Vercel's serverless functions can't keep a
   local SQLite file around. Schema is in `db/schema.postgres.sql`;
   `lib/db.ts` is the one file to rewrite (same four exported function
   names — `get`, `all`, `run`, `transaction` — so nothing else in the
   app needs to change).
2. **A real Gemini API key**, connected in `lib/ai-provider.ts` — optional;
   the app fully works without it, just with placeholder images.
3. **A real, random `SESSION_SECRET`**, generated fresh — never reuse the
   placeholder value shipped for local testing.

Full step-by-step instructions, including exact Vercel dashboard clicks
and CLI commands, are in `DEPLOY_COMPLETE.md` — the companion document to
this one.

---

## 9. Where everything else lives

- `README.md` — quick-start instructions for running this locally
- `DEPLOY_COMPLETE.md` — the complete deployment guide
- `db/schema.sqlite.sql` / `db/schema.postgres.sql` — the real schema in
  both dialects
- `lib/ai-provider.ts` — exactly where and how to connect real Gemini
- The original design-phase documentation (backend architecture spec,
  full 30-table database design covering teams/referrals/affiliates/Lumi
  RAG/feature flags, security checklist, SEO checklist) describes the
  larger product vision beyond this MVP core loop — useful as a roadmap
  for what for extending this project next, following the same patterns
  already established here (real validation, real session checks, real
  transactions wherever credits or money are involved).
