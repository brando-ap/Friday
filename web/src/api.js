// Dev: '/api' is proxied to the local Worker by Vite.
// Prod: set VITE_API_BASE to the deployed Worker URL, e.g. https://friday-api.<you>.workers.dev/api
const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');

async function req(path, options) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  listTasks: () => req('/tasks'),
  getTask: (id) => req(`/tasks/${id}`),
  createTask: (data) => req('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => req(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  addNote: (id, note) => req(`/tasks/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),
  addSubtask: (id, title) => req(`/tasks/${id}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
  setSubtaskDone: (id, done) => req(`/subtasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  deleteSubtask: (id) => req(`/subtasks/${id}`, { method: 'DELETE' }),
};
