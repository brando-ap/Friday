import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import AppShell from '../components/AppShell.jsx';

const SHELL_PROPS = {
  active: 'companies',
  title: 'Companies',
  subtitle: 'The customers work comes in from, and their requesters.',
};

// "Companies" here are client companies (the `clients` table) — the outside
// customers work comes in from — NOT the tenant workspace. Requesters are the
// people at those companies who ask for things; one requester can belong to
// several companies.
export default function Companies() {
  const [clients, setClients] = useState(null);
  const [requesters, setRequesters] = useState([]);
  const [error, setError] = useState(null);

  // add-company form
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  // inline client editing: { id, name, notes }
  const [editing, setEditing] = useState(null);
  // per-company quick-add requester drafts, keyed by client id
  const [drafts, setDrafts] = useState({});

  const refresh = async () => {
    try {
      const [cs, rs] = await Promise.all([api.listClients(), api.listRequesters()]);
      setClients(cs);
      setRequesters(rs);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const run = async (fn) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const addClient = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    run(async () => {
      await api.createClient({ name: newName.trim(), notes: newNotes.trim() || null });
      setNewName('');
      setNewNotes('');
    });
  };

  const saveClient = (e) => {
    e.preventDefault();
    if (!editing.name.trim()) return;
    run(async () => {
      await api.updateClient(editing.id, { name: editing.name, notes: editing.notes });
      setEditing(null);
    });
  };

  const removeClient = (c) => {
    if (!window.confirm(`Delete ${c.name}? Tasks keep their history but lose the company link.`)) return;
    run(() => api.deleteClient(c.id));
  };

  const addRequesterTo = (e, client) => {
    e.preventDefault();
    const name = (drafts[client.id] || '').trim();
    if (!name) return;
    run(async () => {
      await api.createRequester({ name, client_ids: [client.id] });
      setDrafts({ ...drafts, [client.id]: '' });
    });
  };

  const patchRequester = (r, patch) => run(() => api.updateRequester(r.id, patch));

  const toggleRequesterClient = (r, clientId) => {
    const client_ids = r.client_ids.includes(clientId)
      ? r.client_ids.filter((id) => id !== clientId)
      : [...r.client_ids, clientId];
    patchRequester(r, { client_ids });
  };

  const removeRequester = (r) => {
    if (!window.confirm(`Delete requester ${r.name}?`)) return;
    run(() => api.deleteRequester(r.id));
  };

  if (!clients) {
    return (
      <AppShell {...SHELL_PROPS}>
        <div className="team">{error && <div className="error">{error}</div>}</div>
      </AppShell>
    );
  }

  return (
    <AppShell {...SHELL_PROPS}>
    <div className="team companies-page">
      {error && <div className="error">{error}</div>}

      {clients.map((c) => {
        const theirs = requesters.filter((r) => r.client_ids.includes(c.id));
        const isEditing = editing?.id === c.id;
        return (
          <section className="team-section" key={c.id}>
            {isEditing ? (
              <form className="co-edit" onSubmit={saveClient}>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
                <input
                  value={editing.notes}
                  placeholder="Notes (optional)"
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
                <button type="submit">Save</button>
                <button type="button" className="link" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            ) : (
              <div className="co-head">
                <div>
                  <div className="team-name">{c.name}</div>
                  {c.notes && <div className="team-email">{c.notes}</div>}
                </div>
                <div className="co-actions">
                  <button
                    className="link"
                    onClick={() => setEditing({ id: c.id, name: c.name, notes: c.notes || '' })}
                  >
                    Edit
                  </button>
                  <button className="link" onClick={() => removeClient(c)}>Delete</button>
                </div>
              </div>
            )}

            <h3 className="co-req-head">Requesters</h3>
            {theirs.length === 0 && <p className="team-empty">No requesters yet.</p>}
            <ul className="team-list">
              {theirs.map((r) => (
                <li key={r.id}>
                  <div>
                    <div className="team-name">{r.name}</div>
                    <div className="team-email">
                      {[r.email, r.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <span className="team-role">
                    {r.client_ids.length > 1 ? `${r.client_ids.length} companies` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <form className="team-invite-form" onSubmit={(e) => addRequesterTo(e, c)}>
              <input
                placeholder={`Add a requester at ${c.name}…`}
                value={drafts[c.id] || ''}
                onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
              />
              <button type="submit">Add</button>
            </form>
          </section>
        );
      })}

      <section className="team-section">
        <h3>Add a company</h3>
        <form className="co-edit" onSubmit={addClient}>
          <input
            placeholder="Company name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </section>

      {requesters.length > 0 && (
        <section className="team-section">
          <h3>All requesters</h3>
          <p className="team-empty co-hint">
            Edit contact details and tick every company each person belongs to.
          </p>
          <ul className="team-list co-req-list">
            {requesters.map((r) => (
              <li key={r.id}>
                <div className="co-req-fields">
                  <input
                    defaultValue={r.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value.trim() !== r.name) {
                        patchRequester(r, { name: e.target.value.trim() });
                      }
                    }}
                  />
                  <input
                    defaultValue={r.email || ''}
                    placeholder="Email"
                    onBlur={(e) => {
                      if ((e.target.value || null) !== (r.email || null)) {
                        patchRequester(r, { email: e.target.value });
                      }
                    }}
                  />
                  <input
                    defaultValue={r.phone || ''}
                    placeholder="Phone"
                    onBlur={(e) => {
                      if ((e.target.value || null) !== (r.phone || null)) {
                        patchRequester(r, { phone: e.target.value });
                      }
                    }}
                  />
                  <div className="co-req-clients">
                    {clients.map((c) => (
                      <label key={c.id} className="co-check">
                        <input
                          type="checkbox"
                          checked={r.client_ids.includes(c.id)}
                          onChange={() => toggleRequesterClient(r, c.id)}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <button className="link" onClick={() => removeRequester(r)}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </AppShell>
  );
}
