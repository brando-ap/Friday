import React, { useEffect, useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { api } from '../api.js';

const EMPTY = { name: '', email: '', title: '', description: '', location: '', due_date: '', website: '' };

// Public request-intake form (/request?token=...). No account needed — the
// token in the URL identifies the workspace (see the intake routes in the
// worker). Styled like the auth pages since requesters are outside visitors.
export default function RequestForm() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [info, setInfo] = useState(undefined); // undefined = loading, null = bad/disabled link
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setInfo(null);
      return;
    }
    api.getIntakeInfo(token).then(setInfo).catch(() => setInfo(null));
  }, [token]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.submitIntakeRequest(token, {
        ...form,
        due_date: form.due_date || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (info === undefined) {
    return (
      <AuthLayout showProof={false} crossLink={null}>
        <div className="auth-form">
          <p className="auth-form-sub">Loading…</p>
        </div>
      </AuthLayout>
    );
  }

  if (!info) {
    return (
      <AuthLayout showProof={false} crossLink={null}>
        <div className="auth-form">
          <h1>Form not available</h1>
          <p className="auth-form-sub">
            This request link doesn't look right, or the team has turned it off. Check with whoever
            gave you the link.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (submitted) {
    return (
      <AuthLayout showProof={false} crossLink={null}>
        <div className="auth-form">
          <h1>Request received ✓</h1>
          <p className="auth-form-sub">
            Thanks — the {info.company_name} team has been notified and will pick it up from here.
          </p>
          <button
            className="auth-submit"
            type="button"
            onClick={() => {
              setForm(EMPTY);
              setSubmitted(false);
            }}
          >
            Send another request
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showProof={false} crossLink={null}>
      <form className="auth-form" onSubmit={submit}>
        <h1>Request something from {info.company_name}</h1>
        <p className="auth-form-sub">Fill this in and it lands straight on their board.</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-fieldset">
          <div className="auth-field-row">
            <label className="auth-field">
              <span className="auth-field-label-row">
                <span>Your name</span>
              </span>
              <input value={form.name} onChange={set('name')} placeholder="Dana Ruiz" required autoFocus autoComplete="name" />
            </label>
            <label className="auth-field">
              <span className="auth-field-label-row">
                <span>Your email</span>
              </span>
              <input type="email" value={form.email} onChange={set('email')} placeholder="dana@company.com" required autoComplete="email" />
            </label>
          </div>
          <label className="auth-field">
            <span className="auth-field-label-row">
              <span>What do you need?</span>
            </span>
            <input value={form.title} onChange={set('title')} placeholder="Pack order #4471 for pickup" required maxLength={200} />
          </label>
          <label className="auth-field">
            <span className="auth-field-label-row">
              <span>Details (optional)</span>
            </span>
            <textarea value={form.description} onChange={set('description')} rows={4} placeholder="Anything the team should know" maxLength={5000} />
          </label>
          <div className="auth-field-row">
            <label className="auth-field">
              <span className="auth-field-label-row">
                <span>Location (optional)</span>
              </span>
              <input value={form.location} onChange={set('location')} placeholder="Dock B" maxLength={200} />
            </label>
            <label className="auth-field">
              <span className="auth-field-label-row">
                <span>Needed by (optional)</span>
              </span>
              <input type="date" value={form.due_date} onChange={set('due_date')} />
            </label>
          </div>
          {/* Honeypot — hidden from humans; bots that fill it get silently dropped. */}
          <label className="auth-field intake-website" aria-hidden="true">
            <span>Website</span>
            <input value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" />
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
