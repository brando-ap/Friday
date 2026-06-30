# Friday — task tracker

A personal task/project tracker built to replace tracking work in your head + email.
It does three things on purpose, and nothing else (yet):

1. **A trusted date-sorted view** — overdue is red, due-this-week amber. This is the
   screen you check each morning *instead of* re-reading your inbox.
2. **Fast capture** — type a title, hit Enter, done in ~10 seconds. Fill in the rest later.
3. **Per-item memory** — requester, who it's for, status (incl. *Waiting*), steps, and a
   timestamped **activity log** so a project you dropped a week ago is instantly re-readable.

## Stack

| Part     | Tech                                   | Hosts on          |
|----------|----------------------------------------|-------------------|
| Frontend | React + Vite (`web/`)                  | Cloudflare Pages  |
| Backend  | Cloudflare Worker + Hono (`worker/`)   | Cloudflare Workers|
| Database | Supabase (Postgres) via `supabase-js`  | Supabase          |

The Worker is the only thing that touches the database, using the Supabase
**service_role** key (kept server-side). The browser only ever talks to the Worker.

## One-time setup

**1. Create the database (Supabase)**
- Make a free project at <https://supabase.com>.
- SQL Editor → New query → paste `worker/schema.sql` → Run.
- Project Settings → API → copy the **Project URL** and the **service_role** key.

**2. Point the Worker at it (local)**
```bash
cp worker/.dev.vars.example worker/.dev.vars
# edit worker/.dev.vars and paste your SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

**3. Install**
```bash
npm install
```

## Run it (local)

```bash
npm run dev
```
Starts the Worker (`wrangler dev`, :8787) and the web app (Vite, :5173) together.
Open **http://localhost:5173** — Vite proxies `/api` to the Worker.

## Verify the Worker bundles (no account needed)

```bash
npm run check:api   # wrangler dry-run build — proves it compiles for the Workers runtime
```

## Deploy

**Backend (Worker):**
```bash
cd worker
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy          # prints your https://friday-api.<you>.workers.dev URL
```

**Frontend (Cloudflare Pages):**
- Build command `npm run build`, output dir `web/dist`.
- Set env var `VITE_API_BASE = https://friday-api.<you>.workers.dev/api`.
- The Worker already sends permissive CORS, so the Pages origin can call it.

## Roadmap

**Shipped (MVP)** — quick capture, date-sorted list with urgency colors, all core fields,
status with a *Waiting* state, steps/sub-tasks, activity log.

**Phase 2**
- "Waiting > N days" follow-up flag pinned to the top of the morning view (the gentle poke).
- Requester analytics — who sends you the most, so you can spot the systemic problems.
- Warehouse SMS button on `location: warehouse` tasks — pre-fills a text to the main guy.
- A login (the Worker is currently open; add Supabase Auth or a shared secret before
  putting real data on a public URL).
