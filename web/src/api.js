import { getToken, clearToken } from './auth.js';

// Frontend and API are the same Worker (see ../wrangler.toml), so this is always same-origin.
const BASE = '/api';

// App.jsx registers a handler here so any 401 kicks the user back to the login screen.
let onAuthError = () => {};
export function setAuthErrorHandler(fn) {
  onAuthError = fn;
}

async function req(path, { skipAuthRedirect, headers, ...options } = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  if (res.status === 401 && !skipAuthRedirect) {
    clearToken();
    onAuthError();
    throw new Error('Session expired — please sign in again');
  }
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
  login: (password) =>
    req('/login', { method: 'POST', body: JSON.stringify({ password }), skipAuthRedirect: true }),
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
