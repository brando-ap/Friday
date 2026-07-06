# Friday — task tracker

A personal task/project tracker built to replace tracking work in your head + email.
It does four things on purpose, and nothing else (yet):

1. **A trusted date-sorted view** — overdue is red, due-this-week amber. This is the
   screen you check each morning *instead of* re-reading your inbox.
2. **Fast capture** — type a title, hit Enter, done in ~10 seconds. Fill in the rest later.
3. **Per-item memory** — requester, who it's for, status (incl. *Waiting*), steps, and a
   timestamped **activity log** so a project you dropped a week ago is instantly re-readable.
4. **A shared board** — sign up as a company, invite your team by email, everyone sees the
   same board.

## Stack

One Cloudflare Worker (`web/`) serves everything, via `@cloudflare/vite-plugin`:

| Part     | Tech                                                                        |
|----------|------------------------------------------------------------------------------|
| Frontend | React + Vite — static assets, incl. the `ezyFriday` marketing landing page   |
| Backend  | Hono API (`web/worker/`) — handles `/api/*`, same Worker, same origin        |
| Auth     | Supabase Auth (email + password) — real per-user accounts, multi-tenant      |
| Database | Supabase (Postgres) via `supabase-js`                                        |
| Email    | Resend — team invite emails; Supabase's own auth emails route through Resend too (custom SMTP, see below) |

The Worker is the only thing that touches task/company/invite data, using a Supabase
**secret API key** (`sb_secret_…`, kept server-side). The browser only ever talks to
Supabase directly for Auth (sign up / log in / password reset) using the public
**publishable key** (`sb_publishable_…` — the new name for what used to be called the
"anon" key) — every real table has Row Level Security enabled with no policies, so
that key can't touch data, only auth. Frontend and API share an origin, so there's no
CORS to configure.

Signing up creates a **company** (the "warehouse/company" field) with you as its
**owner**. Owners can invite teammates by email from `/app/team`; invited people join
the same company's board as **members**.

## One-time setup

**1. Create the database (Supabase)**
- Make a free project at <https://supabase.com>.
- SQL Editor → New query → paste `web/schema.sql` → Run.
- Project Settings → **API** → copy the **Project URL**.
- Project Settings → **API Keys** → **Secret keys** → create one → copy it (starts with `sb_secret_`).
- Project Settings → **API Keys** → copy the **publishable** key too (the new name for
  the "anon" key).

**2. Configure Supabase Auth**
- Auth → Providers → Email → turn **off** "Confirm email" (sign-up logs you straight
  in — there's no email-verification step in this app).
- Auth → Settings → SMTP → enable custom SMTP via Resend (`smtp.resend.com`, user
  `resend`, password = your Resend API key). Supabase's built-in mailer is
  rate-limited/test-only — this is what makes password-reset emails actually deliverable.
  (Requires verifying a sending domain in Resend first.)

**3. Point the Worker at it (local)**
```bash
cp web/.dev.vars.example web/.dev.vars
# edit web/.dev.vars and fill in:
#   SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY   (from Supabase)
#   RESEND_API_KEY                                                 (from Resend)

cp web/.env.example web/.env
# edit web/.env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (same values)
```

**4. Install**
```bash
npm install
```

## Run it (local)

```bash
npm run dev
```
One Vite dev server on **http://localhost:5173** — the Cloudflare Vite plugin runs the Worker
code (`/api/*`) in the real Workers runtime alongside the React app, so there's nothing to proxy.

## Deploy

```bash
npm --workspace web run deploy    # vite build && wrangler deploy
```
The `friday` Cloudflare project is connected to GitHub, but auto-deploy-on-push is turned
**off** (Settings → Build → Branch control) — deploys are manual, via the command above,
run from wherever you have `wrangler` authenticated.

Secrets (one-time, or whenever they change):
```bash
cd web
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put RESEND_API_KEY
```
Also set `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` as **Build variables** on the
Cloudflare dashboard (Settings → Variables) — these are baked in at build time, not read
from Worker secrets.

## Migrating an existing (already-live) database

If you're moving a live project from the old single-shared-password scheme to real
accounts, don't just run `schema.sql` — use the staged files in `web/migrations/`
instead, in order:

1. `001_multi_tenant_schema.sql` — additive only, safe to run any time, no effect on
   whatever code is currently deployed.
2. Deploy the new code, then sign up for real at `/signup` (not `/login`) — this
   creates your company. Your board will look **empty** at first; that's expected,
   your old tasks aren't linked to a company yet.
3. `002_backfill_tasks_company.sql` — links your existing tasks to your new company.
4. After a day or two of normal use with no issues: `003_tighten_tasks_company_not_null.sql`.

## Roadmap

**Shipped (MVP)** — quick capture, date-sorted list with urgency colors, all core fields,
status with a *Waiting* state, steps/sub-tasks, activity log, real accounts via Supabase
Auth, multi-tenant companies with email invites.

**Phase 2**
- "Waiting > N days" follow-up flag pinned to the top of the morning view (the gentle poke).
- Requester analytics — who sends you the most, so you can spot the systemic problems.
- Warehouse SMS button on `location: warehouse` tasks — pre-fills a text to the main guy.
- Google SSO (deferred from the auth rewrite — Supabase Auth supports it, just needs a
  Google Cloud OAuth app registered).
- Removing/demoting an existing team member (only invite + list exist today).
