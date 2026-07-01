import React from 'react';
import './landing.css';

const HERO_ROWS = [
  {
    message: '"can you pack #4471 by 3pm?"',
    received: 'Support · just now',
    taskTitle: 'Pack order #4471',
    taskMeta: 'Assigned · Dana · 3:00pm',
    chip: { color: 'is-green', icon: '✓' },
  },
  {
    message: '"reprint label for #4408?"',
    received: 'Support · 1 min ago',
    taskTitle: 'Reprint label #4408',
    taskMeta: 'Assigned · Jo',
    chip: { color: 'is-green', icon: '✓' },
  },
  {
    message: "\"where's the fragile SOP?\"",
    received: 'Support · 2 min ago',
    taskTitle: 'Fragile-items SOP',
    taskMeta: 'Linked on the task',
    chip: { color: 'is-teal', icon: '↗' },
  },
];

const PILLARS = [
  { tile: '#ffd166', title: 'Projects', body: 'The big pushes, with every task rolled up.' },
  { tile: '#7fd1c8', title: 'Tasks', body: 'Assign, time and tick — everyone sees it.' },
  { tile: '#ffa0a0', title: 'Requests', body: 'Every ask from support, tracked & timed.' },
  { tile: '#ef6b4d', title: 'SOPs', body: 'The right steps, linked on every task.' },
];

function Logo() {
  return (
    <a href="/" className="landing-logo">
      <span className="landing-logo-mark">e</span>
      <span className="landing-logo-word">ezyFriday</span>
    </a>
  );
}

function Nav() {
  return (
    <nav className="landing-nav">
      <Logo />
      <div className="landing-nav-links">
        <span>Product</span>
        <span>How it works</span>
        <span>Pricing</span>
      </div>
      <div className="landing-nav-right">
        <a href="/app" className="landing-loginlink">Log in</a>
        <a href="/app" className="landing-btn landing-btn-teal landing-nav-cta">Start free</a>
      </div>
    </nav>
  );
}

function HeroVisual() {
  return (
    <div className="landing-visual" aria-hidden="true">
      {HERO_ROWS.map((row, i) => {
        const delay = `${i * 0.5}s`;
        return (
          <div className="landing-visual-row" key={row.taskTitle}>
            <div className="landing-msg" style={{ animationDelay: delay }}>
              <div className="landing-msg-text">{row.message}</div>
              <div className="landing-msg-meta">{row.received}</div>
            </div>
            <div className="landing-task" style={{ animationDelay: delay }}>
              <span className={`landing-task-chip ${row.chip.color}`}>{row.chip.icon}</span>
              <div>
                <div className="landing-task-title">{row.taskTitle}</div>
                <div className="landing-task-meta">{row.taskMeta}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Hero() {
  return (
    <section className="landing-hero">
      <div>
        <div className="landing-badge">Bye-bye, wall of sticky notes 👋</div>
        <h1 className="landing-h1">
          Get it off the wall,<br />
          into <span className="accent">ezyFriday.</span>
        </h1>
        <p className="landing-lead">
          Every "can you pack this?" note, every text, every scribble — one shared board for
          your support team and your fulfilment floor. Projects, tasks, requests and SOPs, all
          in one place.
        </p>
        <div className="landing-hero-actions">
          <a href="/app" className="landing-btn landing-btn-coral">Start free — no card</a>
          <button type="button" className="landing-btn landing-btn-outline">Book a demo</button>
        </div>
      </div>
      <HeroVisual />
    </section>
  );
}

function Pillars() {
  return (
    <section className="landing-pillars">
      <div className="landing-pillars-inner">
        <h2 className="landing-h2">One tidy board instead of four messy walls</h2>
        <div className="landing-pillar-grid">
          {PILLARS.map((p) => (
            <div className="landing-pillar-card" key={p.title}>
              <div className="landing-pillar-tile" style={{ background: p.tile }} />
              <div className="landing-pillar-title">{p.title}</div>
              <p className="landing-pillar-body">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="landing-final-cta">
      <h2 className="landing-h2">Clear the wall. Keep the calm.</h2>
      <p className="landing-final-sub">Set your whole floor up in an afternoon. Free for two weeks.</p>
      <a href="/app" className="landing-btn landing-btn-white">Start free today</a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <span className="landing-footer-word">ezyFriday</span>
      <span>Product · Pricing · Security · Contact</span>
      <span>© 2026</span>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <Nav />
      <Hero />
      <Pillars />
      <FinalCta />
      <Footer />
    </div>
  );
}
