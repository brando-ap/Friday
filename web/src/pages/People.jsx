import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import AppShell from '../components/AppShell.jsx';

const SHELL_PROPS = {
  active: 'people',
  title: 'People',
  subtitle: 'The requesters — who asks for work, and which companies they belong to.',
};

const EMPTY_DRAFT = { name: '', email: '', phone: '', client_ids: [] };

// People are requesters (the `requesters` table): the folks who ask for work.
// Each person is assigned to one or more companies (`requester_clients`), and
// picking a person on a new card offers exactly their companies.
export default function People() {
  const [people, setPeople] = useState(null);
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const refresh = async () => {
    try {
      // Counts are a nicety — a tasks fetch failure shouldn't hide the directory.
      const [rs, cs, ts] = await Promise.all([
        api.listRequesters(),
        api.listClients(),
        api.listTasks().catch(() => []),
      ]);
      setPeople(rs);
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

  const addPerson = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    run(async () => {
      await api.createRequester({
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        client_ids: draft.client_ids,
      });
      setDraft(EMPTY_DRAFT);
    });
  };

  const toggleDraftClient = (clientId) => {
    setDraft((d) => ({
      ...d,
      client_ids: d.client_ids.includes(clientId)
        ? d.client_ids.filter((id) => id !== clientId)
        : [...d.client_ids, clientId],
    }));
  };

  const patchPerson = (p, patch) => run(() => api.updateRequester(p.id, patch));

  const togglePersonClient = (p, clientId) => {
    const client_ids = p.client_ids.includes(clientId)
      ? p.client_ids.filter((id) => id !== clientId)
      : [...p.client_ids, clientId];
    patchPerson(p, { client_ids });
  };

  const removePerson = (p) => {
    if (!window.confirm(`Delete ${p.name}? Tasks keep their history but lose the link.`)) return;
    run(() => api.deleteRequester(p.id));
  };

  if (!people) {
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
          <h3>Add a person</h3>
          <form className="co-edit people-add" onSubmit={addPerson}>
            <input
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              placeholder="Email (optional)"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <input
              placeholder="Phone (optional)"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
            {clients.length > 0 && (
              <div className="co-req-clients">
                {clients.map((c) => (
                  <label key={c.id} className="co-check">
                    <input
                      type="checkbox"
                      checked={draft.client_ids.includes(c.id)}
                      onChange={() => toggleDraftClient(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            <button type="submit">Add</button>
          </form>
        </section>

        <section className="team-section">
          <h3>Everyone</h3>
          {people.length === 0 && <p className="team-empty">No people yet — add your first requester above.</p>}
          {people.length > 0 && (
            <>
              <p className="team-empty co-hint">
                Tick every company each person requests work for — those are the ones
                offered when you pick them on a new card.
              </p>
              <ul className="team-list co-req-list">
                {people.map((p) => {
                  const theirs = tasks.filter((t) => t.requester_id === p.id);
                  const open = theirs.filter((t) => t.status !== 'done').length;
                  return (
                  <li key={p.id}>
                    <div className="co-req-fields">
                      <input
                        defaultValue={p.name}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value.trim() !== p.name) {
                            patchPerson(p, { name: e.target.value.trim() });
                          }
                        }}
                      />
                      <input
                        defaultValue={p.email || ''}
                        placeholder="Email"
                        onBlur={(e) => {
                          if ((e.target.value || null) !== (p.email || null)) {
                            patchPerson(p, { email: e.target.value });
                          }
                        }}
                      />
                      <input
                        defaultValue={p.phone || ''}
                        placeholder="Phone"
                        onBlur={(e) => {
                          if ((e.target.value || null) !== (p.phone || null)) {
                            patchPerson(p, { phone: e.target.value });
                          }
                        }}
                      />
                      <div className="co-req-clients">
                        {clients.length === 0 && (
                          <span className="team-empty">
                            No companies yet — add some on the <a href="/app/companies">Companies</a> page.
                          </span>
                        )}
                        {clients.map((c) => (
                          <label key={c.id} className="co-check">
                            <input
                              type="checkbox"
                              checked={p.client_ids.includes(c.id)}
                              onChange={() => togglePersonClient(p, c.id)}
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <a className="req-count" href={`/app?requester=${p.id}`} title="See these requests on the board">
                      {theirs.length} request{theirs.length === 1 ? '' : 's'}
                      {open > 0 && ` · ${open} open`}
                    </a>
                    <button className="link" onClick={() => removePerson(p)}>✕</button>
                  </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
