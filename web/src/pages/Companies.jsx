import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import AppShell from '../components/AppShell.jsx';

const SHELL_PROPS = {
  active: 'companies',
  title: 'Companies',
  subtitle: 'The customers work comes in from. Manage their people on the People page.',
};

// "Companies" here are client companies (the `clients` table) — the outside
// customers work comes in from — NOT the tenant workspace. This page is just
// the company directory plus how many requests each one has; people are
// managed on the People page, requests on the board.
export default function Companies() {
  const [clients, setClients] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);

  // add-company form
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  // inline client editing: { id, name, notes }
  const [editing, setEditing] = useState(null);

  const refresh = async () => {
    try {
      // Counts are a nicety — a tasks fetch failure shouldn't hide the directory.
      const [cs, ts] = await Promise.all([api.listClients(), api.listTasks().catch(() => [])]);
      setClients(cs);
      setTasks(ts);
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

      <section className="team-section">
        <h3>Companies</h3>
        {clients.length === 0 && <p className="team-empty">No companies yet.</p>}
        <ul className="team-list">
          {clients.map((c) => {
            const theirs = tasks.filter((t) => t.client_id === c.id);
            const open = theirs.filter((t) => t.status !== 'done').length;
            const isEditing = editing?.id === c.id;
            if (isEditing) {
              return (
                <li key={c.id}>
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
                </li>
              );
            }
            return (
              <li key={c.id}>
                <div>
                  <div className="team-name">{c.name}</div>
                  {c.notes && <div className="team-email">{c.notes}</div>}
                </div>
                <a className="req-count" href={`/app?client=${c.id}`} title="See these requests on the board">
                  {theirs.length} request{theirs.length === 1 ? '' : 's'}
                  {open > 0 && ` · ${open} open`}
                </a>
                <div className="co-actions">
                  <button
                    className="link"
                    onClick={() => setEditing({ id: c.id, name: c.name, notes: c.notes || '' })}
                  >
                    Edit
                  </button>
                  <button className="link" onClick={() => removeClient(c)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
    </AppShell>
  );
}
