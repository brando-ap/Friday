import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function BreakdownTable({ title, rows, emptyText }) {
  return (
    <section className="team-section">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="team-empty">{emptyText}</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th></th>
              <th>Open</th>
              <th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.open}</td>
                <td className={r.overdue > 0 ? 'dash-overdue' : ''}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (!data) {
    return (
      <div className="team dash-page">
        <a className="link team-back" href="/app">← Back to board</a>
        {error ? <div className="error">{error}</div> : <p className="team-empty">Loading…</p>}
      </div>
    );
  }

  const stats = [
    ['Open', data.open, ''],
    ['Overdue', data.overdue, data.overdue > 0 ? 'stat-overdue' : ''],
    ['Due today', data.due_today, data.due_today > 0 ? 'stat-soon' : ''],
    ['Done this week', data.completed_this_week, 'stat-done'],
  ];

  return (
    <div className="team dash-page">
      <a className="link team-back" href="/app">← Back to board</a>
      <h1>Dashboard</h1>
      {error && <div className="error">{error}</div>}

      <div className="stat-grid">
        {stats.map(([label, value, cls]) => (
          <div key={label} className={`stat-card ${cls}`}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <BreakdownTable
        title="By company"
        rows={data.by_client}
        emptyText="No tasks are linked to a company yet — set one in a task's details."
      />
      <BreakdownTable
        title="By requester"
        rows={data.by_requester}
        emptyText="No tasks have a requester yet."
      />
    </div>
  );
}
