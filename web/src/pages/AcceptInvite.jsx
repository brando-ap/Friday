import React, { useEffect, useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { getSupabaseClient } from '../auth/supabaseClient.js';
import { api } from '../api.js';

// No mockup — a trimmed Sign Up: email locked to the invite, no company field.
export default function AcceptInvite() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [invite, setInvite] = useState(undefined); // undefined = loading, null = not found
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvite(null);
      return;
    }
    api.getInvite(token).then(setInvite).catch(() => setInvite(null));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpError) {
        // Already have an account (e.g. invited to a second company) — sign in instead.
        if (/registered/i.test(signUpError.message)) {
          window.location.href = `/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
          return;
        }
        throw signUpError;
      }
      await api.acceptInvite(token);
      window.location.href = '/app';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (invite === undefined) {
    return (
      <AuthLayout showProof={false} crossLink={<a href="/login">Log in</a>}>
        <div className="auth-form">
          <p className="auth-form-sub">Loading your invite…</p>
        </div>
      </AuthLayout>
    );
  }

  if (!invite || invite.expired || invite.accepted) {
    return (
      <AuthLayout showProof={false} crossLink={<a href="/login">Log in</a>}>
        <div className="auth-form">
          <h1>Invite not available</h1>
          <p className="auth-form-sub">
            {!invite && "This invite link doesn't look right."}
            {invite?.expired && 'This invite has expired — ask whoever invited you to send a new one.'}
            {invite?.accepted && 'This invite has already been used.'}
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      showProof={false}
      crossLink={
        <>
          Already have an account? <a href="/login">Log in</a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit}>
        <h1>Join {invite.company_name}</h1>
        <p className="auth-form-sub">You've been invited to ezyFriday as {invite.email}.</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-fieldset">
          <label className="auth-field">
            <span className="auth-field-label-row">
              <span>Work email</span>
            </span>
            <div className="auth-field-static">{invite.email}</div>
          </label>
          <label className="auth-field">
            <span className="auth-field-label-row">
              <span>Full name</span>
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dana Ruiz"
              required
              autoFocus
              autoComplete="name"
            />
          </label>
          <PasswordField
            id="accept-invite-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Joining…' : `Join ${invite.company_name}`}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
