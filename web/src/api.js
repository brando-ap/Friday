import { getSupabaseClient } from './auth/supabaseClient.js';

// Frontend and API are the same Worker (see ../wrangler.toml), so this is always same-origin.
const BASE = '/api';

// AuthContext registers a handler here so any 401 signs the user out everywhere.
let onAuthError = () => {};
export function setAuthErrorHandler(fn) {
  onAuthError = fn;
}

async function req(path, { skipAuthRedirect, headers, ...options } = {}) {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  const token = session?.access_token;
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  if (res.status === 401 && !skipAuthRedirect) {
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
  listTasks: () => req('/tasks'),
  getTask: (id) => req(`/tasks/${id}`),
  createTask: (data) => req('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => req(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  addNote: (id, note) => req(`/tasks/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),
  addSubtask: (id, title) => req(`/tasks/${id}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
  setSubtaskDone: (id, done) => req(`/subtasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  deleteSubtask: (id) => req(`/subtasks/${id}`, { method: 'DELETE' }),

  importTasks: (rows) => req('/tasks/import', { method: 'POST', body: JSON.stringify({ rows }) }),

  // Clients are shown as "Companies" in the UI — see the naming note in schema.sql.
  listClients: () => req('/clients'),
  createClient: (data) => req('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => req(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteClient: (id) => req(`/clients/${id}`, { method: 'DELETE' }),
  listRequesters: () => req('/requesters'),
  createRequester: (data) => req('/requesters', { method: 'POST', body: JSON.stringify(data) }),
  updateRequester: (id, data) => req(`/requesters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRequester: (id) => req(`/requesters/${id}`, { method: 'DELETE' }),

  getDashboard: () => req('/dashboard'),

  // Public request-intake form. The two token calls are made from the public
  // /request page where there's usually no session — skipAuthRedirect so a
  // stale session can't bounce an outside requester to the login page.
  getIntakeInfo: (token) => req(`/intake/${token}`, { skipAuthRedirect: true }),
  submitIntakeRequest: (token, data) =>
    req(`/intake/${token}`, { method: 'POST', body: JSON.stringify(data), skipAuthRedirect: true }),
  getIntakeSettings: () => req('/intake-settings'),
  updateIntakeSettings: (data) => req('/intake-settings', { method: 'PATCH', body: JSON.stringify(data) }),

  getTeam: () => req('/team'),
  inviteMember: (email) => req('/team/invites', { method: 'POST', body: JSON.stringify({ email }) }),
  revokeInvite: (id) => req(`/team/invites/${id}`, { method: 'DELETE' }),
  getInvite: (token) => req(`/invites/${token}`, { skipAuthRedirect: true }),
  acceptInvite: (token) => req(`/invites/${token}/accept`, { method: 'POST' }),
};
