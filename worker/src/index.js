import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { getDb } from './supabase.js';
import * as repo from './repo.js';

const app = new Hono();

// Only let the deployed frontend (custom domain + Pages preview deployments) call
// the API from a browser. Non-browser clients (no Origin header) are unaffected.
const ALLOWED_ORIGIN =
  /^https:\/\/(ezyfriday\.com|www\.ezyfriday\.com|([a-z0-9-]+\.)?friday-1h7\.pages\.dev)$/;
app.use(
  '/api/*',
  cors({
    origin: (origin) => (origin && ALLOWED_ORIGIN.test(origin) ? origin : undefined),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ---------------------------------------------------------------------------
// Auth: a single shared password gates everything except /health and /login.
// Login returns a 30-day signed JWT; every other route requires it as a Bearer.
// ---------------------------------------------------------------------------
const PUBLIC_PATHS = new Set(['/api/health', '/api/login']);
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Constant-time compare so a wrong password can't be guessed by timing.
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

app.use('/api/*', async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next();
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !c.env.JWT_SECRET) return c.json({ error: 'unauthorized' }, 401);
  try {
    await verify(token, c.env.JWT_SECRET, 'HS256'); // throws on bad signature or expiry
  } catch {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

app.post('/api/login', async (c) => {
  if (!c.env.APP_PASSWORD || !c.env.JWT_SECRET) {
    return c.json({ error: 'auth not configured — set APP_PASSWORD and JWT_SECRET' }, 500);
  }
  const body = await c.req.json().catch(() => ({}));
  if (!timingSafeEqual(body.password || '', c.env.APP_PASSWORD)) {
    return c.json({ error: 'wrong password' }, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await sign({ sub: 'owner', exp }, c.env.JWT_SECRET, 'HS256');
  return c.json({ token });
});

app.get('/api/health', (c) => c.json({ ok: true }));

// ---------------------------------------------------------------------------
// Tasks (all protected by the auth middleware above)
// ---------------------------------------------------------------------------
app.get('/api/tasks', async (c) => {
  return c.json(await repo.listTasks(getDb(c.env)));
});

app.post('/api/tasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.title || '').trim()) return c.json({ error: 'title is required' }, 400);
  return c.json(await repo.createTask(getDb(c.env), body), 201);
});

app.get('/api/tasks/:id', async (c) => {
  const task = await repo.getTask(getDb(c.env), Number(c.req.param('id')));
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const task = await repo.updateTask(getDb(c.env), Number(c.req.param('id')), body);
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/tasks/:id', async (c) => {
  const ok = await repo.deleteTask(getDb(c.env), Number(c.req.param('id')));
  return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

app.post('/api/tasks/:id/notes', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.note || '').trim()) return c.json({ error: 'note is required' }, 400);
  const task = await repo.addNote(getDb(c.env), Number(c.req.param('id')), body.note.trim());
  return task ? c.json(task, 201) : c.json({ error: 'not found' }, 404);
});

app.post('/api/tasks/:id/subtasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.title || '').trim()) return c.json({ error: 'title is required' }, 400);
  const task = await repo.addSubtask(getDb(c.env), Number(c.req.param('id')), body.title.trim());
  return task ? c.json(task, 201) : c.json({ error: 'not found' }, 404);
});

app.patch('/api/subtasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const task = await repo.setSubtaskDone(getDb(c.env), Number(c.req.param('id')), !!body.done);
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/subtasks/:id', async (c) => {
  const task = await repo.deleteSubtask(getDb(c.env), Number(c.req.param('id')));
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'internal error' }, 500);
});

export default app;
