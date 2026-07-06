import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { getSupabaseClient } from '../auth/supabaseClient.js';
import { api } from '../api.js';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Set once auth.signUp succeeds. If creating the company then fails, the user
  // already has a session — this switches to a single-field retry instead of
  // asking them to re-enter credentials.
  const [needsCompanyRetry, setNeedsCompanyRetry] = useState(false);

  const createCompany = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createCompany(company.trim());
      window.location.href = '/app';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

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
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpError) throw signUpError;
      setNeedsCompanyRetry(true);
      await api.createCompany(company.trim());
      window.location.href = '/app';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      headline="Get it off the wall, into ezyFriday."
      subhead="Every text and scribble becomes a tracked task — assigned, timed, and visible to the whole floor."
      crossLink={
        <>
          Already have an account? <a href="/login">Log in</a>
        </>
      }
    >
      <form
        className="auth-form"
        onSubmit={
          needsCompanyRetry
            ? (e) => {
                e.preventDefault();
                createCompany();
              }
            : submit
        }
      >
        <div className="auth-badge">Free for 2 weeks · no card</div>
        <h1>Start free</h1>
        <p className="auth-form-sub">Set your whole floor up in an afternoon.</p>

        {error && <div className="auth-error">{error}</div>}

        {needsCompanyRetry ? (
          <div className="auth-fieldset">
            <div className="auth-notice">
              You're signed up — we just need your workspace name to finish setting up.
            </div>
            <label className="auth-field">
              <span className="auth-field-label-row">
                <span>Warehouse / company</span>
              </span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Fulfilment"
                required
                autoFocus
              />
            </label>
            <button className="auth-submit" type="submit" disabled={busy || !company.trim()}>
              {busy ? 'Finishing setup…' : 'Finish setup'}
            </button>
          </div>
        ) : (
          <div className="auth-fieldset">
            <div className="auth-field-row">
              <label className="auth-field">
                <span className="auth-field-label-row">
                  <span>Full name</span>
                </span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dana Ruiz"
                  required
                  autoComplete="name"
                />
              </label>
              <label className="auth-field">
                <span className="auth-field-label-row">
                  <span>Warehouse / company</span>
                </span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Fulfilment"
                  required
                  autoComplete="organization"
                />
              </label>
            </div>
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
              />
            </label>
            <PasswordField
              id="signup-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <label className="auth-checkbox">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
              I agree to the{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>
                Terms
              </a>{' '}
              and{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>
                Privacy Policy
              </a>
              .
            </label>
            <button className="auth-submit" type="submit" disabled={busy || !agreed}>
              {busy ? 'Creating your account…' : 'Start free — no card'}
            </button>
          </div>
        )}
        <p className="auth-footnote">Free for 14 days. Onboard your team in a day.</p>
      </form>
    </AuthLayout>
  );
}
