import { Hono } from 'hono';
import { getDb } from './supabase.js';
import { authMiddleware } from './auth.js';
import { sendInviteEmail, sendDigestEmail, sendIntakeNotificationEmail } from './resend.js';
import * as repo from './repo.js';

const app = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use('/api/*', authMiddleware);

app.get('/api/health', (c) => c.json({ ok: true }));

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
app.get('/api/invites/:token', async (c) => {
  const invite = await repo.getInviteByToken(getDb(c.env), c.req.param('token'));
  return invite ? c.json(invite) : c.json({ error: 'not found' }, 404);
});

app.post('/api/invites/:token/accept', async (c) => {
  const result = await repo.acceptInvite(getDb(c.env), c.req.param('token'), c.get('user'));
  if (result.error === 'not_found') return c.json({ error: 'invite not found' }, 404);
  if (result.error === 'expired' || result.error === 'already_accepted') {
    return c.json({ error: result.error }, 410);
  }
  if (result.error === 'email_mismatch') {
    return c.json({ error: 'this invite was sent to a different email address' }, 403);
  }
  return c.json({ company: result.company });
});

// ---------------------------------------------------------------------------
// Public request intake — no auth; the URL token is the credential (see the
// PUBLIC_ROUTES entries in auth.js and the intake section in repo.js).
// ---------------------------------------------------------------------------
const INTAKE_LIMITS = { name: 120, email: 254, title: 200, description: 5000, location: 200 };
const INTAKE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.get('/api/intake/:token', async (c) => {
  const company = await repo.getCompanyByIntakeToken(getDb(c.env), c.req.param('token'));
  return company ? c.json({ company_name: company.name }) : c.json({ error: 'not found' }, 404);
});

app.post('/api/intake/:token', async (c) => {
  const db = getDb(c.env);
  const company = await repo.getCompanyByIntakeToken(db, c.req.param('token'));
  if (!company) return c.json({ error: 'not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  // Honeypot: humans never see the "website" field. Pretend success to bots.
  if ((body.website || '').trim()) return c.json({ ok: true }, 201);

  const fields = {};
  for (const [field, max] of Object.entries(INTAKE_LIMITS)) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (value.length > max) return c.json({ error: `${field} is too long (max ${max} characters)` }, 400);
    fields[field] = value || null;
  }
  if (!fields.name) return c.json({ error: 'your name is required' }, 400);
  if (!EMAIL_RE.test(fields.email || '')) return c.json({ error: 'a valid email is required' }, 400);
  if (!fields.title) return c.json({ error: 'a short description of what you need is required' }, 400);
  if (body.due_date && !INTAKE_DATE_RE.test(body.due_date)) {
    return c.json({ error: 'needed-by date must be YYYY-MM-DD' }, 400);
  }

  const task = await repo.createIntakeTask(db, company, { ...fields, due_date: body.due_date || null });

  // Owners hear about new requests right away (the daily digest is too slow
  // for inbound work); a notification failure must not fail the submit.
  c.executionCtx.waitUntil(
    (async () => {
      try {
        for (const to of await repo.listOwnerEmails(db, company.id)) {
          await sendIntakeNotificationEmail(c.env, {
            to,
            companyName: company.name,
            task,
            requesterName: fields.name,
            requesterEmail: fields.email,
            appUrl: c.env.PUBLIC_APP_URL,
          });
        }
      } catch (err) {
        console.error('intake notification failed:', err);
      }
    })()
  );

  return c.json({ ok: true }, 201);
});

// ---------------------------------------------------------------------------
// Intake settings (member tier reads; enabling/rotating is owner-only)
// ---------------------------------------------------------------------------
app.get('/api/intake-settings', async (c) => {
  return c.json(await repo.getIntakeSettings(getDb(c.env), c.get('companyId')));
});

app.patch('/api/intake-settings', async (c) => {
  if (c.get('role') !== 'owner') return c.json({ error: 'forbidden' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const settings = await repo.updateIntakeSettings(getDb(c.env), c.get('companyId'), {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    rotate: !!body.rotate,
  });
  return c.json(settings);
});

// ---------------------------------------------------------------------------
// Team (member tier — invite creation/revocation is owner-only)
// ---------------------------------------------------------------------------
app.get('/api/team', async (c) => {
  const db = getDb(c.env);
  const companyId = c.get('companyId');
  const [members, pendingInvites] = await Promise.all([
    repo.listMembers(db, companyId),
    repo.listPendingInvites(db, companyId),
  ]);
  return c.json({ members, pendingInvites, role: c.get('role') });
});

app.post('/api/team/invites', async (c) => {
  if (c.get('role') !== 'owner') return c.json({ error: 'forbidden' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return c.json({ error: 'a valid email is required' }, 400);

  const db = getDb(c.env);
  const companyId = c.get('companyId');
  const invite = await repo.createInvite(db, companyId, c.get('user').id, email);

  let emailSent = true;
  try {
    const company = await repo.getCompany(db, companyId);
    await sendInviteEmail(c.env, {
      to: email,
      companyName: company.name,
      inviterEmail: c.get('user').email,
      acceptUrl: `${c.env.PUBLIC_APP_URL}/accept-invite?token=${invite.token}`,
    });
  } catch (err) {
    console.error('sendInviteEmail failed:', err);
    emailSent = false;
  }

  return c.json({ ...invite, email_sent: emailSent }, 201);
});

app.delete('/api/team/invites/:id', async (c) => {
  if (c.get('role') !== 'owner') return c.json({ error: 'forbidden' }, 403);
  const ok = await repo.deleteInvite(getDb(c.env), c.get('companyId'), Number(c.req.param('id')));
  return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

// ---------------------------------------------------------------------------
// Clients ("Companies" in the UI) & requesters — all scoped to the caller's
// company. Note: these are customer records, NOT the tenant workspace.
// ---------------------------------------------------------------------------
app.get('/api/clients', async (c) => {
  return c.json(await repo.listClients(getDb(c.env), c.get('companyId')));
});

app.post('/api/clients', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.name || '').trim()) return c.json({ error: 'name is required' }, 400);
  return c.json(await repo.createClient(getDb(c.env), c.get('companyId'), body), 201);
});

app.patch('/api/clients/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const client = await repo.updateClient(getDb(c.env), c.get('companyId'), Number(c.req.param('id')), body);
  return client ? c.json(client) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/clients/:id', async (c) => {
  const ok = await repo.deleteClient(getDb(c.env), c.get('companyId'), Number(c.req.param('id')));
  return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

app.get('/api/requesters', async (c) => {
  return c.json(await repo.listRequesters(getDb(c.env), c.get('companyId')));
});

app.post('/api/requesters', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.name || '').trim()) return c.json({ error: 'name is required' }, 400);
  return c.json(await repo.createRequester(getDb(c.env), c.get('companyId'), body), 201);
});

app.patch('/api/requesters/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const requester = await repo.updateRequester(getDb(c.env), c.get('companyId'), Number(c.req.param('id')), body);
  return requester ? c.json(requester) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/requesters/:id', async (c) => {
  const ok = await repo.deleteRequester(getDb(c.env), c.get('companyId'), Number(c.req.param('id')));
  return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

// ---------------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------------
app.get('/api/dashboard', async (c) => {
  return c.json(await repo.getDashboard(getDb(c.env), c.get('companyId')));
});

// ---------------------------------------------------------------------------
// Tasks (all scoped to the caller's company)
// ---------------------------------------------------------------------------
app.get('/api/tasks', async (c) => {
  return c.json(await repo.listTasks(getDb(c.env), c.get('companyId')));
});

// Bulk CSV import — rows are parsed client-side, validated per row here.
app.post('/api/tasks/import', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return c.json({ error: 'no rows to import' }, 400);
  if (rows.length > 500) return c.json({ error: 'too many rows (max 500 per import)' }, 400);
  return c.json(await repo.importTasks(getDb(c.env), c.get('companyId'), rows), 201);
});

app.post('/api/tasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.title || '').trim()) return c.json({ error: 'title is required' }, 400);
  return c.json(await repo.createTask(getDb(c.env), c.get('companyId'), body), 201);
});

app.get('/api/tasks/:id', async (c) => {
  const task = await repo.getTask(getDb(c.env), c.get('companyId'), Number(c.req.param('id')));
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const task = await repo.updateTask(getDb(c.env), c.get('companyId'), Number(c.req.param('id')), body);
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/tasks/:id', async (c) => {
  const ok = await repo.deleteTask(getDb(c.env), c.get('companyId'), Number(c.req.param('id')));
  return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

app.post('/api/tasks/:id/notes', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.note || '').trim()) return c.json({ error: 'note is required' }, 400);
  const task = await repo.addNote(getDb(c.env), c.get('companyId'), Number(c.req.param('id')), body.note.trim());
  return task ? c.json(task, 201) : c.json({ error: 'not found' }, 404);
});

app.post('/api/tasks/:id/subtasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.title || '').trim()) return c.json({ error: 'title is required' }, 400);
  const task = await repo.addSubtask(getDb(c.env), c.get('companyId'), Number(c.req.param('id')), body.title.trim());
  return task ? c.json(task, 201) : c.json({ error: 'not found' }, 404);
});

app.patch('/api/subtasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const task = await repo.setSubtaskDone(getDb(c.env), c.get('companyId'), Number(c.req.param('id')), !!body.done);
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/subtasks/:id', async (c) => {
  const task = await repo.deleteSubtask(getDb(c.env), c.get('companyId'), Number(c.req.param('id')));
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.onError((err, c) => {
  console.error(err);
  // repo throws validation errors with err.status = 400 (see badRequest).
  return c.json({ error: err.message || 'internal error' }, err.status || 500);
});

// ---------------------------------------------------------------------------
// Daily digest — runs on the cron trigger in wrangler.toml. Emails every
// workspace owner their company's tasks due today or overdue. The only place
// we iterate across tenants; each company's email only ever contains that
// company's tasks.
// ---------------------------------------------------------------------------
async function runDailyDigest(env) {
  const db = getDb(env);
  const today = new Date().toISOString().slice(0, 10);
  for (const company of await repo.listAllCompanies(db)) {
    try {
      const tasks = await repo.listDueOrOverdueTasks(db, company.id, today);
      if (tasks.length === 0) continue;
      const owners = await repo.listOwnerEmails(db, company.id);
      for (const to of owners) {
        await sendDigestEmail(env, {
          to,
          companyName: company.name,
          tasks,
          today,
          appUrl: env.PUBLIC_APP_URL,
        });
      }
    } catch (err) {
      // One company's failure (e.g. a bad email) shouldn't skip the rest.
      console.error(`daily digest failed for company ${company.id}:`, err);
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => ctx.waitUntil(runDailyDigest(env)),
};
