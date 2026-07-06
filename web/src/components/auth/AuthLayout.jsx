import React from 'react';
import '../../pages/auth.css';

const PROOF_ROWS = [
  {
    message: '"can you pack #4471 by 3pm?"',
    time: 'just now',
    taskTitle: 'Pack order #4471',
    taskMeta: 'Dana · 3:00pm',
    chip: 'is-green',
    icon: '✓',
  },
  {
    message: '"reprint label for #4408?"',
    time: '1 min ago',
    taskTitle: 'Reprint label #4408',
    taskMeta: 'Jo',
    chip: 'is-green',
    icon: '✓',
  },
  {
    message: "\"where's the fragile SOP?\"",
    time: '2 min ago',
    taskTitle: 'Fragile-items SOP',
    taskMeta: 'Linked on the task',
    chip: 'is-coral',
    icon: '↗',
  },
];

function ProofAnimation() {
  return (
    <div className="auth-proof" aria-hidden="true">
      {PROOF_ROWS.map((row, i) => {
        const delay = `${i * 0.5}s`;
        return (
          <div className="auth-proof-row" key={row.taskTitle}>
            <div className="auth-proof-msg" style={{ animationDelay: delay }}>
              <div className="auth-proof-msg-text">{row.message}</div>
              <div className="auth-proof-msg-meta">Support · {row.time}</div>
            </div>
            <div className="auth-proof-task" style={{ animationDelay: delay }}>
              <span className={`auth-proof-chip ${row.chip}`}>{row.icon}</span>
              <div>
                <div className="auth-proof-task-title">{row.taskTitle}</div>
                <div className="auth-proof-task-meta">{row.taskMeta}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Logo({ className = 'auth-logo' }) {
  return (
    <a href="/" className={className}>
      <span className="auth-logo-mark">e</span>
      <span className="auth-logo-word">ezyFriday</span>
    </a>
  );
}

function BrandPanel({ headline, subhead }) {
  return (
    <div className="auth-brand">
      <div className="auth-deco auth-deco-1" />
      <div className="auth-deco auth-deco-2" />
      <Logo className="auth-logo auth-logo-brand" />
      <div className="auth-brand-mid">
        <h2 className="auth-brand-h2">{headline}</h2>
        <p className="auth-brand-sub">{subhead}</p>
        <ProofAnimation />
      </div>
      <div className="auth-trust">
        <div className="auth-avatars">
          <span className="auth-avatar" style={{ background: '#f5b98f' }} />
          <span className="auth-avatar" style={{ background: '#ffd166' }} />
          <span className="auth-avatar" style={{ background: '#7fd1c8' }} />
        </div>
        <span>Trusted by 200+ fulfilment teams</span>
      </div>
    </div>
  );
}

// showProof controls whether the brand panel renders at desktop widths at all.
// Below the responsive breakpoint the brand panel hides regardless (see auth.css),
// which is why the inline logo is always rendered in the DOM — CSS decides which
// logo is visible at a given width, not this prop.
export default function AuthLayout({ showProof = true, brandSide = 'left', headline, subhead, crossLink, children }) {
  const brand = showProof ? <BrandPanel headline={headline} subhead={subhead} /> : null;
  return (
    <div className={`auth-shell ${showProof ? 'has-brand' : 'no-brand'} side-${brandSide}`}>
      {brandSide === 'left' && brand}
      <div className="auth-form-panel">
        <div className="auth-form-top">
          <Logo className="auth-logo auth-logo-inline" />
          <div className="auth-cross-link">{crossLink}</div>
        </div>
        <div className="auth-form-center">{children}</div>
      </div>
      {brandSide === 'right' && brand}
    </div>
  );
}
