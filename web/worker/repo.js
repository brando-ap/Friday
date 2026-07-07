// Data access layer. Every function takes a Supabase client (`db`) and is async.
// Errors from Supabase are thrown and surfaced as JSON 500s by the Hono onError handler.
// Task/subtask/activity functions take `companyId` and scope every query to it —
// a mismatch is treated identically to "not found" (no existence leakage).

export const STATUSES = ['not_started', 'in_progress', 'waiting', 'done'];
export const RECURRENCES = ['daily', 'weekly', 'monthly'];
const EDITABLE = [
  'title', 'description', 'requester', 'requested_for',
  'location', 'due_date', 'status', 'waiting_on', 'waiting_since',
  'requester_id', 'client_id', 'assignee_id', 'recurrence',
];
const INVITE_TTL_DAYS = 7;
const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
};

// Embeds the structured attribution names so list/detail UIs render them
// without extra requests. `requester` (free text) is a real column, so the
// embedded requesters row is aliased to requester_ref.
const TASK_SELECT = '*, client:clients(id, name), requester_ref:requesters(id, name)';

const todayISO = () => new Date().toISOString().slice(0, 10);
const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
// Validation failures surface as 400s (not 500s) via the Hono onError handler.
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

// Primary view ordering: open first, then by due date (undated last), oldest first.
// Done in JS to keep the exact semantics — the dataset is tiny (~tens of rows).
function compareTasks(a, b) {
  const aDone = a.status === 'done' ? 1 : 0;
  const bDone = b.status === 'done' ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  const aNull = a.due_date ? 0 : 1;
  const bNull = b.due_date ? 0 : 1;
  if (aNull !== bNull) return aNull - bNull;
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return new Date(a.created_at) - new Date(b.created_at);
}

async function taskInCompany(db, companyId, taskId) {
  const row = unwrap(
    await db.from('tasks').select('id').eq('id', taskId).eq('company_id', companyId).maybeSingle()
  );
  return !!row;
}

// Checks that requester/client both belong to this tenant and, when both are
// set, that the client is one of the requester's clients. Throws a 400.
async function validateAttribution(db, companyId, requesterId, clientId) {
  if (requesterId != null) {
    const row = unwrap(
      await db.from('requesters').select('id').eq('id', requesterId).eq('company_id', companyId).maybeSingle()
    );
    if (!row) throw badRequest('unknown requester');
  }
  if (clientId != null) {
    const row = unwrap(
      await db.from('clients').select('id').eq('id', clientId).eq('company_id', companyId).maybeSingle()
    );
    if (!row) throw badRequest('unknown company');
  }
  if (requesterId != null && clientId != null) {
    const link = unwrap(
      await db
        .from('requester_clients')
        .select('requester_id')
        .eq('requester_id', requesterId)
        .eq('client_id', clientId)
        .maybeSingle()
    );
    if (!link) throw badRequest("that company is not one of the requester's companies");
  }
}

async function logSystem(db, taskId, note) {
  unwrap(await db.from('activity_log').insert({ task_id: taskId, note, kind: 'system' }));
}

async function nameOf(db, table, id) {
  const row = unwrap(await db.from(table).select('name').eq('id', id).maybeSingle());
  return row?.name ?? `#${id}`;
}

async function emailOf(db, userId) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data?.user?.email ?? 'unknown member';
}

// ---------------------------------------------------------------------------
// Tasks / subtasks / activity — all scoped to a company.
// ---------------------------------------------------------------------------
export async function listTasks(db, companyId) {
  const rows = unwrap(await db.from('tasks').select(TASK_SELECT).eq('company_id', companyId));
  return rows.sort(compareTasks);
}

export async function getTask(db, companyId, id) {
  const task = unwrap(
    await db.from('tasks').select(TASK_SELECT).eq('id', id).eq('company_id', companyId).maybeSingle()
  );
  if (!task) return null;
  task.subtasks = unwrap(
    await db.from('subtasks').select('*').eq('task_id', id).order('position').order('id')
  );
  task.activity = unwrap(
    await db
      .from('activity_log')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
  );
  return task;
}

export async function createTask(db, companyId, data) {
  const status = STATUSES.includes(data.status) ? data.status : 'not_started';
  const requesterId = data.requester_id || null;
  const clientId = data.client_id || null;
  await validateAttribution(db, companyId, requesterId, clientId);
  const row = {
    company_id: companyId,
    title: data.title.trim(),
    description: data.description || null,
    requester: data.requester || null,
    requested_for: data.requested_for || null,
    location: data.location || null,
    due_date: data.due_date || null,
    status,
    waiting_on: status === 'waiting' ? data.waiting_on || null : null,
    waiting_since: status === 'waiting' ? todayISO() : null,
    requester_id: requesterId,
    client_id: clientId,
    assignee_id: data.assignee_id || null,
    recurrence: RECURRENCES.includes(data.recurrence) ? data.recurrence : null,
  };
  const inserted = unwrap(await db.from('tasks').insert(row).select().single());
  return getTask(db, companyId, inserted.id);
}

export async function updateTask(db, companyId, id, data) {
  const existing = unwrap(
    await db.from('tasks').select('*').eq('id', id).eq('company_id', companyId).maybeSingle()
  );
  if (!existing) return null;

  const patch = {};
  for (const field of EDITABLE) {
    if (field in data) patch[field] = data[field] === '' ? null : data[field];
  }

  if ('recurrence' in patch && patch.recurrence !== null && !RECURRENCES.includes(patch.recurrence)) {
    throw badRequest('invalid recurrence');
  }
  if ('requester_id' in patch || 'client_id' in patch) {
    await validateAttribution(
      db,
      companyId,
      'requester_id' in patch ? patch.requester_id : existing.requester_id,
      'client_id' in patch ? patch.client_id : existing.client_id
    );
  }

  // Status side-effects: stamp waiting_since on entering 'waiting',
  // stamp/clear completed_at on entering/leaving 'done'.
  if ('status' in data) {
    if (data.status === 'waiting' && existing.status !== 'waiting') patch.waiting_since = todayISO();
    if (data.status === 'done') patch.completed_at = new Date().toISOString();
    else if (existing.status === 'done') patch.completed_at = null;
  }

  if (Object.keys(patch).length === 0) return getTask(db, companyId, id);
  unwrap(await db.from('tasks').update(patch).eq('id', id).eq('company_id', companyId));
  await logTaskChanges(db, existing, patch);

  // Recurring task completed -> auto-create the next occurrence.
  if (patch.status === 'done' && existing.status !== 'done' && existing.recurrence) {
    await spawnNextOccurrence(db, companyId, { ...existing, ...patch });
  }
  return getTask(db, companyId, id);
}

// Auto-log noteworthy field changes (kind='system') alongside manual notes.
async function logTaskChanges(db, existing, patch) {
  const events = [];
  if ('status' in patch && patch.status !== existing.status) {
    events.push(`Status: ${STATUS_LABEL[existing.status] ?? existing.status} → ${STATUS_LABEL[patch.status] ?? patch.status}`);
  }
  if ('assignee_id' in patch && patch.assignee_id !== existing.assignee_id) {
    events.push(patch.assignee_id ? `Assigned to ${await emailOf(db, patch.assignee_id)}` : 'Unassigned');
  }
  if ('requester_id' in patch && patch.requester_id !== existing.requester_id) {
    events.push(
      patch.requester_id
        ? `Requester set to ${await nameOf(db, 'requesters', patch.requester_id)}`
        : 'Requester cleared'
    );
  }
  if ('requester' in patch && (patch.requester ?? null) !== (existing.requester ?? null)) {
    events.push(patch.requester ? `Requester set to "${patch.requester}"` : 'Requester cleared');
  }
  if ('client_id' in patch && patch.client_id !== existing.client_id) {
    // "Company" is the end-user word for a client — see the naming note in schema.sql.
    events.push(
      patch.client_id ? `Company set to ${await nameOf(db, 'clients', patch.client_id)}` : 'Company cleared'
    );
  }
  for (const note of events) await logSystem(db, existing.id, note);
}

// Advance an ISO date by one recurrence interval. Monthly clamps to the last
// day of the target month (Jan 31 + 1 month = Feb 28/29).
function addInterval(iso, recurrence) {
  const [y, m, d] = iso.split('-').map(Number);
  if (recurrence === 'daily') return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (recurrence === 'weekly') return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  const t = new Date(Date.UTC(y, m, d)); // m is 1-based, so this is next month 0-based
  if (t.getUTCMonth() !== m % 12) t.setUTCDate(0); // overflowed -> last day of target month
  return t.toISOString().slice(0, 10);
}

// Next due date rolls forward from the old one; if the task was completed
// late, keep rolling so the new occurrence is strictly in the future — you
// just did the thing today, it shouldn't be due again today.
function nextDueDate(fromISO, recurrence) {
  const today = todayISO();
  let next = addInterval(fromISO, recurrence);
  while (next <= today) next = addInterval(next, recurrence);
  return next;
}

async function spawnNextOccurrence(db, companyId, task) {
  const due = nextDueDate(task.due_date || todayISO(), task.recurrence);
  const inserted = unwrap(
    await db
      .from('tasks')
      .insert({
        company_id: companyId,
        title: task.title,
        description: task.description,
        requester: task.requester,
        requested_for: task.requested_for,
        location: task.location,
        due_date: due,
        status: 'not_started',
        requester_id: task.requester_id,
        client_id: task.client_id,
        assignee_id: task.assignee_id,
        recurrence: task.recurrence,
      })
      .select()
      .single()
  );
  await logSystem(db, task.id, `Recurring: next occurrence created, due ${due}`);
  await logSystem(db, inserted.id, `Auto-created from recurring task "${task.title}"`);
}

export async function deleteTask(db, companyId, id) {
  const { error, count } = await db
    .from('tasks')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function addNote(db, companyId, taskId, note) {
  const task = unwrap(
    await db.from('tasks').select('id').eq('id', taskId).eq('company_id', companyId).maybeSingle()
  );
  if (!task) return null;
  unwrap(await db.from('activity_log').insert({ task_id: taskId, note }));
  return getTask(db, companyId, taskId);
}

export async function addSubtask(db, companyId, taskId, title) {
  const task = unwrap(
    await db.from('tasks').select('id').eq('id', taskId).eq('company_id', companyId).maybeSingle()
  );
  if (!task) return null;
  const last = unwrap(
    await db
      .from('subtasks')
      .select('position')
      .eq('task_id', taskId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  const position = last ? last.position + 1 : 0;
  unwrap(await db.from('subtasks').insert({ task_id: taskId, title, position }));
  return getTask(db, companyId, taskId);
}

export async function setSubtaskDone(db, companyId, subtaskId, done) {
  const row = unwrap(
    await db.from('subtasks').select('task_id, title, done').eq('id', subtaskId).maybeSingle()
  );
  if (!row || !(await taskInCompany(db, companyId, row.task_id))) return null;
  unwrap(await db.from('subtasks').update({ done }).eq('id', subtaskId));
  if (done !== row.done) {
    await logSystem(db, row.task_id, done ? `Step completed: ${row.title}` : `Step reopened: ${row.title}`);
  }
  return getTask(db, companyId, row.task_id);
}

export async function deleteSubtask(db, companyId, subtaskId) {
  const row = unwrap(await db.from('subtasks').select('task_id').eq('id', subtaskId).maybeSingle());
  if (!row || !(await taskInCompany(db, companyId, row.task_id))) return null;
  unwrap(await db.from('subtasks').delete().eq('id', subtaskId));
  return getTask(db, companyId, row.task_id);
}

// ---------------------------------------------------------------------------
// Clients ("Companies" in the UI) & requesters — customer attribution layer.
// Both are tenant data: always scoped to company_id.
// ---------------------------------------------------------------------------
export async function listClients(db, companyId) {
  return unwrap(
    await db.from('clients').select('*').eq('company_id', companyId).order('name')
  );
}

export async function createClient(db, companyId, data) {
  return unwrap(
    await db
      .from('clients')
      .insert({ company_id: companyId, name: data.name.trim(), notes: data.notes || null })
      .select()
      .single()
  );
}

export async function updateClient(db, companyId, id, data) {
  const patch = {};
  if ('name' in data && (data.name || '').trim()) patch.name = data.name.trim();
  if ('notes' in data) patch.notes = data.notes === '' ? null : data.notes;
  if (Object.keys(patch).length === 0) return null;
  const rows = unwrap(
    await db.from('clients').update(patch).eq('id', id).eq('company_id', companyId).select()
  );
  return rows[0] ?? null;
}

export async function deleteClient(db, companyId, id) {
  const { error, count } = await db
    .from('clients')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// Requesters come back with client_ids so the UI can show/edit which clients
// each requester belongs to without another round trip.
export async function listRequesters(db, companyId) {
  const rows = unwrap(
    await db
      .from('requesters')
      .select('*, requester_clients(client_id)')
      .eq('company_id', companyId)
      .order('name')
  );
  return rows.map(({ requester_clients, ...r }) => ({
    ...r,
    client_ids: (requester_clients ?? []).map((l) => l.client_id),
  }));
}

// Silently drops client ids that don't belong to this tenant.
async function setRequesterClients(db, companyId, requesterId, clientIds) {
  const valid = unwrap(
    await db.from('clients').select('id').eq('company_id', companyId).in('id', clientIds)
  ).map((r) => r.id);
  unwrap(await db.from('requester_clients').delete().eq('requester_id', requesterId));
  if (valid.length > 0) {
    unwrap(
      await db
        .from('requester_clients')
        .insert(valid.map((client_id) => ({ requester_id: requesterId, client_id })))
    );
  }
}

export async function createRequester(db, companyId, data) {
  const inserted = unwrap(
    await db
      .from('requesters')
      .insert({
        company_id: companyId,
        name: data.name.trim(),
        email: data.email || null,
        phone: data.phone || null,
      })
      .select()
      .single()
  );
  await setRequesterClients(db, companyId, inserted.id, data.client_ids ?? []);
  return (await listRequesters(db, companyId)).find((r) => r.id === inserted.id);
}

export async function updateRequester(db, companyId, id, data) {
  const existing = unwrap(
    await db.from('requesters').select('id').eq('id', id).eq('company_id', companyId).maybeSingle()
  );
  if (!existing) return null;
  const patch = {};
  if ('name' in data && (data.name || '').trim()) patch.name = data.name.trim();
  if ('email' in data) patch.email = data.email === '' ? null : data.email;
  if ('phone' in data) patch.phone = data.phone === '' ? null : data.phone;
  if (Object.keys(patch).length > 0) {
    unwrap(await db.from('requesters').update(patch).eq('id', id).eq('company_id', companyId));
  }
  if (Array.isArray(data.client_ids)) await setRequesterClients(db, companyId, id, data.client_ids);
  return (await listRequesters(db, companyId)).find((r) => r.id === id);
}

export async function deleteRequester(db, companyId, id) {
  const { error, count } = await db
    .from('requesters')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Public request intake — a tokenized form URL per workspace lets outside
// requesters submit work without an account. The URL token is the only
// credential, so it's a UUID, only honored while enabled, and rotatable.
// ---------------------------------------------------------------------------
export async function getIntakeSettings(db, companyId) {
  const row = unwrap(
    await db.from('companies').select('intake_token, intake_enabled').eq('id', companyId).single()
  );
  return { enabled: row.intake_enabled, token: row.intake_token };
}

export async function updateIntakeSettings(db, companyId, { enabled, rotate }) {
  const current = unwrap(
    await db.from('companies').select('intake_token').eq('id', companyId).single()
  );
  const patch = {};
  if (typeof enabled === 'boolean') patch.intake_enabled = enabled;
  // First enable mints the token; rotate invalidates any previously shared link.
  if (rotate || (enabled === true && !current.intake_token)) patch.intake_token = crypto.randomUUID();
  if (Object.keys(patch).length > 0) {
    unwrap(await db.from('companies').update(patch).eq('id', companyId));
  }
  return getIntakeSettings(db, companyId);
}

export async function getCompanyByIntakeToken(db, token) {
  return unwrap(
    await db
      .from('companies')
      .select('id, name')
      .eq('intake_token', token)
      .eq('intake_enabled', true)
      .maybeSingle()
  );
}

// Repeat submitters keep one identity: match this tenant's requesters by email
// (case-insensitive, in JS — the dataset is tiny), else create a new requester.
async function findOrCreateRequester(db, companyId, name, email) {
  const rows = unwrap(
    await db.from('requesters').select('id, email').eq('company_id', companyId).not('email', 'is', null)
  );
  const match = rows.find((r) => r.email.toLowerCase() === email.toLowerCase());
  if (match) return match.id;
  const inserted = unwrap(
    await db.from('requesters').insert({ company_id: companyId, name, email }).select('id').single()
  );
  return inserted.id;
}

export async function createIntakeTask(db, company, data) {
  const requesterId = await findOrCreateRequester(db, company.id, data.name, data.email);
  const task = await createTask(db, company.id, {
    title: data.title,
    description: data.description,
    location: data.location,
    due_date: data.due_date,
    requester_id: requesterId,
  });
  await logSystem(db, task.id, `Created from the public request form by ${data.name} (${data.email})`);
  return task;
}

// ---------------------------------------------------------------------------
// Dashboard aggregates — computed in JS like compareTasks (dataset is tiny).
// ---------------------------------------------------------------------------
export async function getDashboard(db, companyId) {
  const tasks = unwrap(await db.from('tasks').select(TASK_SELECT).eq('company_id', companyId));
  const today = todayISO();

  const isOpen = (t) => t.status !== 'done';
  const isOverdue = (t) => isOpen(t) && t.due_date && t.due_date < today;

  // "This week" = since Monday 00:00 UTC (dates in this app are date-only).
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const weekStart = monday.toISOString().slice(0, 10) + 'T00:00:00Z';

  const groupBy = (keyOf, labelOf) => {
    const groups = new Map();
    for (const t of tasks) {
      const key = keyOf(t);
      if (key == null) continue;
      if (!groups.has(key)) groups.set(key, { name: labelOf(t), open: 0, overdue: 0 });
      const g = groups.get(key);
      if (isOpen(t)) g.open += 1;
      if (isOverdue(t)) g.overdue += 1;
    }
    return [...groups.values()].sort((a, b) => b.open - a.open || b.overdue - a.overdue);
  };

  return {
    open: tasks.filter(isOpen).length,
    overdue: tasks.filter(isOverdue).length,
    due_today: tasks.filter((t) => isOpen(t) && t.due_date === today).length,
    completed_this_week: tasks.filter((t) => t.completed_at && t.completed_at >= weekStart).length,
    // Structured attribution groups by id; free-text requesters group by their
    // text so quick-entry tasks still show up in the breakdown.
    by_client: groupBy(
      (t) => t.client?.id ?? null,
      (t) => t.client?.name
    ),
    by_requester: groupBy(
      (t) => t.requester_ref?.id ?? (t.requester ? `text:${t.requester}` : null),
      (t) => t.requester_ref?.name ?? t.requester
    ),
  };
}

// ---------------------------------------------------------------------------
// Daily digest — cross-tenant iteration used only by the scheduled handler.
// ---------------------------------------------------------------------------
export async function listAllCompanies(db) {
  return unwrap(await db.from('companies').select('id, name'));
}

export async function listDueOrOverdueTasks(db, companyId, today) {
  const rows = unwrap(
    await db
      .from('tasks')
      .select(TASK_SELECT)
      .eq('company_id', companyId)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', today)
  );
  return rows.sort(compareTasks);
}

export async function listOwnerEmails(db, companyId) {
  const rows = unwrap(
    await db
      .from('memberships')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('role', 'owner')
  );
  const emails = [];
  for (const row of rows) {
    const { data, error } = await db.auth.admin.getUserById(row.user_id);
    if (error) throw new Error(error.message);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

// ---------------------------------------------------------------------------
// CSV import — one createTask per row so each row gets full validation;
// failures are collected per row instead of aborting the batch.
// ---------------------------------------------------------------------------
const IMPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function importTasks(db, companyId, rows) {
  const created = [];
  const failed = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {};
    try {
      if (!(row.title || '').trim()) throw badRequest('title is required');
      if (row.due_date && !IMPORT_DATE_RE.test(row.due_date)) {
        throw badRequest('due_date must be YYYY-MM-DD');
      }
      if (row.status && !STATUSES.includes(row.status)) {
        throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
      }
      const task = await createTask(db, companyId, {
        title: row.title,
        description: row.description || null,
        requester: row.requester || null,
        requested_for: row.requested_for || null,
        location: row.location || null,
        due_date: row.due_date || null,
        status: row.status || 'not_started',
      });
      created.push(task.id);
    } catch (err) {
      failed.push({ row: i + 1, title: row.title || '(no title)', error: err.message });
    }
  }
  return { created: created.length, failed };
}

// ---------------------------------------------------------------------------
// Companies / memberships
// ---------------------------------------------------------------------------

// The company a user belongs to. A user can technically hold more than one
// membership (e.g. accepted a second company's invite later) — there's no
// company-switcher UI yet, so we just resolve to the oldest one.
export async function findMembership(db, userId) {
  return unwrap(
    await db
      .from('memberships')
      .select('company_id, role')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle()
  );
}

async function hasMembership(db, userId, companyId) {
  const row = unwrap(
    await db
      .from('memberships')
      .select('user_id')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .maybeSingle()
  );
  return !!row;
}

export async function getCompany(db, companyId) {
  return unwrap(await db.from('companies').select('*').eq('id', companyId).single());
}

export async function listMembers(db, companyId) {
  const rows = unwrap(
    await db
      .from('memberships')
      .select('user_id, role, created_at')
      .eq('company_id', companyId)
      .order('created_at')
  );
  const members = [];
  for (const row of rows) {
    const { data, error } = await db.auth.admin.getUserById(row.user_id);
    if (error) throw new Error(error.message);
    members.push({
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      email: data.user?.email ?? null,
      full_name: data.user?.user_metadata?.full_name ?? null,
    });
  }
  return members;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
export async function listPendingInvites(db, companyId) {
  return unwrap(
    await db
      .from('invites')
      .select('id, email, role, created_at, expires_at')
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
  );
}

// Replaces any existing pending invite to the same person, so re-inviting just works.
export async function createInvite(db, companyId, invitedByUserId, email, role = 'member') {
  email = email.trim().toLowerCase();
  await db
    .from('invites')
    .delete()
    .eq('company_id', companyId)
    .eq('email', email)
    .is('accepted_at', null);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return unwrap(
    await db
      .from('invites')
      .insert({
        company_id: companyId,
        email,
        token: crypto.randomUUID(),
        invited_by: invitedByUserId,
        role,
        expires_at: expiresAt,
      })
      .select()
      .single()
  );
}

export async function getInviteByToken(db, token) {
  const invite = unwrap(
    await db
      .from('invites')
      .select('email, role, expires_at, accepted_at, companies(name)')
      .eq('token', token)
      .maybeSingle()
  );
  if (!invite) return null;
  return {
    email: invite.email,
    role: invite.role,
    company_name: invite.companies?.name ?? null,
    expired: new Date(invite.expires_at) < new Date(),
    accepted: !!invite.accepted_at,
  };
}

// Returns { error: 'not_found' | 'expired' | 'already_accepted' | 'email_mismatch' }
// or { company }. email_mismatch stops one person from redeeming another's invite
// token with a different Supabase account.
export async function acceptInvite(db, token, user) {
  const invite = unwrap(await db.from('invites').select('*').eq('token', token).maybeSingle());
  if (!invite) return { error: 'not_found' };
  if (invite.accepted_at) return { error: 'already_accepted' };
  if (new Date(invite.expires_at) < new Date()) return { error: 'expired' };
  if (invite.email.toLowerCase() !== (user.email || '').toLowerCase()) return { error: 'email_mismatch' };

  if (!(await hasMembership(db, user.id, invite.company_id))) {
    unwrap(
      await db
        .from('memberships')
        .insert({ user_id: user.id, company_id: invite.company_id, role: invite.role })
    );
  }
  unwrap(await db.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id));
  const company = unwrap(await db.from('companies').select('*').eq('id', invite.company_id).single());
  return { company };
}

export async function deleteInvite(db, companyId, inviteId) {
  const { error, count } = await db
    .from('invites')
    .delete({ count: 'exact' })
    .eq('id', inviteId)
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
