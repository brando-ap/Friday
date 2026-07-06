import React, { useState } from 'react';

// `extra` renders in the label row, e.g. LogIn's "Forgot?" link.
export default function PasswordField({ id, label, value, onChange, placeholder, extra, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="auth-field" htmlFor={id}>
      <span className="auth-field-label-row">
        <span>{label}</span>
        {extra}
      </span>
      <span className="auth-password-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button type="button" className="auth-password-toggle" onClick={() => setShow((s) => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}
