import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import AppShell from '../components/AppShell.jsx';

const SHELL_PROPS = {
  active: 'team',
  title: 'Team',
  subtitle: 'Members, invites, and your public request form.',
};

// No mockup — plain app styling (styles.css), not the marketing auth design system.
export default function Team() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [intake, setIntake] = useState(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    try {
      const [team, intakeSettings] = await Promise.all([api.getTeam(), api.getIntakeSettings()]);
      setData(team);
      setIntake(intakeSettings);
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
      <AppShell {...SHELL_PROPS}>
        <div className="team">{error && <div className="error">{error}</div>}</div>
      </AppShell>
    );
  }

  const isOwner = data.role === 'owner';

  return (
    <AppShell {...SHELL_PROPS}>
    <div className="team">
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

      <section className="team-section">
        <h3>Public request form</h3>
        {intake?.enabled ? (
          <>
            <p className="team-intake-hint">
              Anyone with this link can send your team a request — no account needed. Share it with
              your customers; each submission lands on the board with the requester attached.
            </p>
            <div className="team-intake-link">
              <code>{`${window.location.origin}/request?token=${intake.token}`}</code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/request?token=${intake.token}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
            </div>
            {isOwner && (
              <div className="team-intake-actions">
                <button
                  className="link"
                  onClick={async () => {
                    if (!window.confirm('Reset the link? The old link stops working immediately.')) return;
                    try {
                      setIntake(await api.updateIntakeSettings({ rotate: true }));
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Reset link
                </button>
                <button
                  className="link"
                  onClick={async () => {
                    try {
                      setIntake(await api.updateIntakeSettings({ enabled: false }));
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Turn off
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="team-intake-hint">
              Give customers a link where they can submit requests straight onto your board — no
              account needed.
            </p>
            {isOwner ? (
              <button
                className="team-intake-enable"
                onClick={async () => {
                  try {
                    setIntake(await api.updateIntakeSettings({ enabled: true }));
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Turn on the request form
              </button>
            ) : (
              <p className="team-empty">Ask an owner to turn it on.</p>
            )}
          </>
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
    </AppShell>
  );
}
