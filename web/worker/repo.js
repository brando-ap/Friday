// Data access layer. Every function takes a Supabase client (`db`) and is async.
// Errors from Supabase are thrown and surfaced as JSON 500s by the Hono onError handler.

export const STATUSES = ['not_started', 'in_progress', 'waiting', 'done'];
const EDITABLE = [
  'title', 'description', 'requester', 'requested_for',
  'location', 'due_date', 'status', 'waiting_on', 'waiting_since',
];

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

export async function listTasks(db) {
  const rows = unwrap(await db.from('tasks').select('*'));
  return rows.sort(compareTasks);
}

export async function getTask(db, id) {
  const task = unwrap(await db.from('tasks').select('*').eq('id', id).maybeSingle());
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

export async function createTask(db, data) {
  const status = STATUSES.includes(data.status) ? data.status : 'not_started';
  const row = {
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
  return getTask(db, inserted.id);
}

export async function updateTask(db, id, data) {
  const existing = unwrap(await db.from('tasks').select('*').eq('id', id).maybeSingle());
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

  if (Object.keys(patch).length === 0) return getTask(db, id);
  unwrap(await db.from('tasks').update(patch).eq('id', id));
  return getTask(db, id);
}

export async function deleteTask(db, id) {
  const { error, count } = await db.from('tasks').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function addNote(db, taskId, note) {
  const task = unwrap(await db.from('tasks').select('id').eq('id', taskId).maybeSingle());
  if (!task) return null;
  unwrap(await db.from('activity_log').insert({ task_id: taskId, note }));
  return getTask(db, taskId);
}

export async function addSubtask(db, taskId, title) {
  const task = unwrap(await db.from('tasks').select('id').eq('id', taskId).maybeSingle());
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
  return getTask(db, taskId);
}

export async function setSubtaskDone(db, subtaskId, done) {
  const row = unwrap(await db.from('subtasks').select('task_id').eq('id', subtaskId).maybeSingle());
  if (!row) return null;
  unwrap(await db.from('subtasks').update({ done }).eq('id', subtaskId));
  return getTask(db, row.task_id);
}

export async function deleteSubtask(db, subtaskId) {
  const row = unwrap(await db.from('subtasks').select('task_id').eq('id', subtaskId).maybeSingle());
  if (!row) return null;
  unwrap(await db.from('subtasks').delete().eq('id', subtaskId));
  return getTask(db, row.task_id);
}
