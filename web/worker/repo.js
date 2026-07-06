// Data access layer. Every function takes a Supabase client (`db`) and is async.
// Errors from Supabase are thrown and surfaced as JSON 500s by the Hono onError handler.
// Task/subtask/activity functions take `companyId` and scope every query to it —
// a mismatch is treated identically to "not found" (no existence leakage).

export const STATUSES = ['not_started', 'in_progress', 'waiting', 'done'];
const EDITABLE = [
  'title', 'description', 'requester', 'requested_for',
  'location', 'due_date', 'status', 'waiting_on', 'waiting_since',
];
const INVITE_TTL_DAYS = 7;

const todayISO = () => new Date().toISOString().slice(0, 10);
const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

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

// ---------------------------------------------------------------------------
// Tasks / subtasks / activity — all scoped to a company.
// ---------------------------------------------------------------------------
export async function listTasks(db, companyId) {
  const rows = unwrap(await db.from('tasks').select('*').eq('company_id', companyId));
  return rows.sort(compareTasks);
}

export async function getTask(db, companyId, id) {
  const task = unwrap(
    await db.from('tasks').select('*').eq('id', id).eq('company_id', companyId).maybeSingle()
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

  // Status side-effects: stamp waiting_since on entering 'waiting',
  // stamp/clear completed_at on entering/leaving 'done'.
  if ('status' in data) {
    if (data.status === 'waiting' && existing.status !== 'waiting') patch.waiting_since = todayISO();
    if (data.status === 'done') patch.completed_at = new Date().toISOString();
    else if (existing.status === 'done') patch.completed_at = null;
  }

  if (Object.keys(patch).length === 0) return getTask(db, companyId, id);
  unwrap(await db.from('tasks').update(patch).eq('id', id).eq('company_id', companyId));
  return getTask(db, companyId, id);
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
  const row = unwrap(await db.from('subtasks').select('task_id').eq('id', subtaskId).maybeSingle());
  if (!row || !(await taskInCompany(db, companyId, row.task_id))) return null;
  unwrap(await db.from('subtasks').update({ done }).eq('id', subtaskId));
  return getTask(db, companyId, row.task_id);
}

export async function deleteSubtask(db, companyId, subtaskId) {
  const row = unwrap(await db.from('subtasks').select('task_id').eq('id', subtaskId).maybeSingle());
  if (!row || !(await taskInCompany(db, companyId, row.task_id))) return null;
  unwrap(await db.from('subtasks').delete().eq('id', subtaskId));
  return getTask(db, companyId, row.task_id);
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
