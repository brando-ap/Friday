# Friday — task tracker

A personal task/project tracker built to replace tracking work in your head + email.
It does three things on purpose, and nothing else (yet):

1. **A trusted date-sorted view** — overdue is red, due-this-week amber. This is the
   screen you check each morning *instead of* re-reading your inbox.
2. **Fast capture** — type a title, hit Enter, done in ~10 seconds. Fill in the rest later.
3. **Per-item memory** — requester, who it's for, status (incl. *Waiting*), steps, and a
   timestamped **activity log** so a project you dropped a week ago is instantly re-readable.

## Stack

One Cloudflare Worker (`web/`) serves both halves, via `@cloudflare/vite-plugin`:

| Part     | Tech                                          |
|----------|------------------------------------------------|
| Frontend | React + Vite — static assets, incl. the `ezyFriday` marketing landing page |
| Backend  | Hono API (`web/worker/`) — handles `/api/*`, same Worker, same origin |
| Database | Supabase (Postgres) via `supabase-js`           |

The Worker is the only thing that touches the database, using a Supabase
**secret API key** (`sb_secret_…`, kept server-side). Frontend and API share an origin, so there's no CORS to configure.

## One-time setup

**1. Create the database (Supabase)**
- Make a free project at <https://supabase.com>.
- SQL Editor → New query → paste `web/schema.sql` → Run.
- Project Settings → **API** → copy the **Project URL**.
- Project Settings → **API Keys** → **Secret keys** → create one → copy it (starts with `sb_secret_`).

**2. Point the Worker at it + set a password (local)**
```bash
cp web/.dev.vars.example web/.dev.vars
# edit web/.dev.vars and fill in:
#   SUPABASE_URL, SUPABASE_SECRET_KEY   (from Supabase)
#   APP_PASSWORD                        (what you type to log in)
#   JWT_SECRET                          (signs your session token)
# Generate a JWT_SECRET with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**3. Install**
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
Or, since the `friday` Cloudflare project is connected to GitHub (Workers Builds): push to `main`
and it builds + deploys automatically. Dashboard build settings: root directory `web`, build
command `npm run build`, deploy command `npx wrangler deploy` (default).

Secrets (one-time, or whenever they change):
```bash
cd web
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put APP_PASSWORD
npx wrangler secret put JWT_SECRET
```

