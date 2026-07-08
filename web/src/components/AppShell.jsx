import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

// App-wide shell from the calendar design handoff: teal sidebar (logo, nav,
// user block) + main column with a per-page utility bar. The drifting-blob
// backdrop is the handoff's sanctioned CSS fallback for its three.js scene.
const NAV = [
  ['board', 'Board', '/app'],
  ['calendar', 'Calendar', '/app/calendar'],
  ['dashboard', 'Dashboard', '/app/dashboard'],
  ['companies', 'Companies', '/app/companies'],
  ['people', 'People', '/app/people'],
  ['team', 'Team', '/app/team'],
];

function initialsOf(user) {
  const name = user?.user_metadata?.full_name || user?.email || '?';
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export default function AppShell({ active, title, subtitle, actions, children }) {
  const { session, signOut } = useAuth();
  const user = session?.user;
  const displayName = user?.user_metadata?.full_name || user?.email || '';

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-blobs" aria-hidden="true" />
        <div className="side-ring" aria-hidden="true" />
        <a className="side-logo" href="/app">
          <span className="side-logo-mark">e</span>
          <span className="side-logo-word">ezyFriday</span>
        </a>
        <nav className="side-nav">
          {NAV.map(([key, label, href]) => (
            <a key={key} href={href} className={key === active ? 'active' : ''}>
              <span className="side-dot" />
              {label}
            </a>
          ))}
        </nav>
        <div className="side-user">
          <span className="side-avatar">{initialsOf(user)}</span>
          <div className="side-user-info">
            <div className="side-user-name" title={displayName}>{displayName}</div>
            <button className="side-signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <div className="util-bar">
          <div>
            <h1 className="util-title">{title}</h1>
            {subtitle && <p className="util-sub">{subtitle}</p>}
          </div>
          {actions && <div className="util-actions">{actions}</div>}
        </div>
        <div className="shell-body">{children}</div>
      </div>
    </div>
  );
}
