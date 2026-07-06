import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// No mockup — plain app styling (styles.css), not the marketing auth design system.
export default function Team() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const refresh = async () => {
    try {
      setData(await api.getTeam());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = await api.inviteMember(email.trim());
      setEmail('');
      setNotice(
        result.email_sent
          ? `Invite sent to ${result.email}.`
          : `Invite created for ${result.email}, but the email failed to send — check the Resend setup.`
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm('Revoke this invite?')) return;
    try {
      await api.revokeInvite(id);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!data) {
    return (
      <div className="team">
        <a className="team-link team-back" href="/app">← Back to board</a>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  const isOwner = data.role === 'owner';

  return (
    <div className="team">
      <a className="link team-back" href="/app">← Back to board</a>
      <h1>Team</h1>
      {error && <div className="error">{error}</div>}
      {notice && <div className="team-notice">{notice}</div>}

      <section className="team-section">
        <h3>Members</h3>
        <ul className="team-list">
          {data.members.map((m) => (
            <li key={m.user_id}>
              <div>
                <div className="team-name">{m.full_name || m.email}</div>
                <div className="team-email">{m.email}</div>
              </div>
              <span className={`team-role role-${m.role}`}>{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="team-section">
        <h3>Pending invites</h3>
        {data.pendingInvites.length === 0 ? (
          <p className="team-empty">No pending invites.</p>
        ) : (
          <ul className="team-list">
            {data.pendingInvites.map((inv) => (
              <li key={inv.id}>
                <div>
                  <div className="team-name">{inv.email}</div>
                  <div className="team-email">
                    Sent {new Date(inv.created_at).toLocaleDateString()} · expires{' '}
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </div>
                </div>
                {isOwner && (
                  <button className="link" onClick={() => revoke(inv.id)}>
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section className="team-section">
          <h3>Invite a teammate</h3>
          <form className="team-invite-form" onSubmit={invite}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
