import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { getSupabaseClient, setKeepSignedIn, getKeepSignedIn } from '../auth/supabaseClient.js';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(getKeepSignedIn());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Must happen before getSupabaseClient()/signInWithPassword — the client's
      // storage medium is fixed at construction time (see supabaseClient.js).
      setKeepSignedIn(keep);
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      window.location.href = redirect || '/app';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      headline="Welcome back to the floor."
      subhead="Your board's been busy. Every request tracked, timed, and waiting where you left it."
      crossLink="New here? Ask a teammate to invite you."
    >
      <form className="auth-form" onSubmit={submit}>
        <h1>Log in</h1>
        <p className="auth-form-sub">Pick up right where the floor left off.</p>

        {error && <div className="auth-error">{error}</div>}

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
              autoComplete="email"
              autoFocus
            />
          </label>
          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            extra={<a href="/forgot-password">Forgot?</a>}
          />
          <label className="auth-checkbox">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            Keep me signed in on this device
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
