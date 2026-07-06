import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { getSupabaseClient } from '../auth/supabaseClient.js';

// No mockup for this page — kept minimal (no brand panel) and styled to match
// AuthLayout's form conventions.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Ignored deliberately — same response either way, see the notice below.
    } finally {
      setBusy(false);
      setSent(true);
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
        <h1>Reset your password</h1>
        <p className="auth-form-sub">Enter your work email and we'll send you a reset link.</p>

        {sent ? (
          <div className="auth-notice">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </div>
        ) : (
          <div className="auth-fieldset">
            <label className="auth-field">
              <span className="auth-field-label-row">
                <span>Work email</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </label>
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}
