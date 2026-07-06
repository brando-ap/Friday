import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { getSupabaseClient } from '../auth/supabaseClient.js';

// No mockup for this page. Supabase's client auto-detects the recovery token in
// the URL fragment (detectSessionInUrl: true) and establishes a session for us —
// nothing to wire up here beyond calling updateUser.
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      window.location.href = '/app';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      showProof={false}
      crossLink={
        <>
          <a href="/login">Back to log in</a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit}>
        <h1>Set a new password</h1>
        <p className="auth-form-sub">Choose something you haven't used before.</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-fieldset">
          <PasswordField
            id="reset-password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <PasswordField
            id="reset-password-confirm"
            label="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            autoComplete="new-password"
          />
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
