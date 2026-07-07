import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { todayISO, urgency, dueLabel } from '../dates.js';

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
};
const MAX_CHIPS = 3;

// 6 fixed weeks (Sun–Sat) covering the given month, as {iso, day, inMonth}.
function monthWeeks(year, month /* 0-based */) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));
  const weeks = [];
  const d = new Date(start);
  while (weeks.length < 6) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        iso: d.toISOString().slice(0, 10),
        day: d.getUTCDate(),
        inMonth: d.getUTCMonth() === month,
      });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export default function Calendar() {
  const today = todayISO();
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
  const [selectedDay, setSelectedDay] = useState(today);

  useEffect(() => {
    api.listTasks().then(setTasks).catch((e) => setError(e.message));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date).push(t);
    }
    return map;
  }, [tasks]);

  const weeks = monthWeeks(cursor.y, cursor.m);
  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const move = (delta) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + delta, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const goToday = () => {
    setCursor({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
    setSelectedDay(today);
  };
  const openTask = (id) => {
    window.location.href = `/app?task=${id}`;
  };

  const dayTasks = byDay.get(selectedDay) ?? [];
  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date > today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 15);

  return (
    <div className="cal-page">
      <a className="link team-back" href="/app">← Back to board</a>
      <div className="cal-head">
        <h1>{monthLabel}</h1>
        <div className="cal-nav">
          <button onClick={() => move(-1)} title="Previous month">‹</button>
          <button onClick={goToday}>Today</button>
          <button onClick={() => move(1)} title="Next month">›</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="cal-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {weeks.flat().map((cell) => {
          const cellTasks = byDay.get(cell.iso) ?? [];
          return (
            <div
              key={cell.iso}
              className={[
                'cal-cell',
                cell.inMonth ? '' : 'cal-out',
                cell.iso === today ? 'cal-today' : '',
                cell.iso === selectedDay ? 'cal-selected' : '',
                cellTasks.length > 0 ? 'cal-has-tasks' : '',
              ].join(' ')}
              onClick={() => setSelectedDay(cell.iso)}
            >
              <span className="cal-daynum">{cell.day}</span>
              {cellTasks.slice(0, MAX_CHIPS).map((t) => (
                <button
                  key={t.id}
                  className={`cal-chip u-${urgency(t)}`}
                  title={t.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    openTask(t.id);
                  }}
                >
                  {t.title}
                </button>
              ))}
              {cellTasks.length > MAX_CHIPS && (
                <span className="cal-more">+{cellTasks.length - MAX_CHIPS} more</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="cal-panels">
        <section className="team-section">
          <h3>{selectedDay === today ? 'Today' : selectedDay}</h3>
          {dayTasks.length === 0 ? (
            <p className="team-empty">Nothing due this day.</p>
          ) : (
            <ul className="cal-day-list">
              {dayTasks.map((t) => (
                <li key={t.id} className={`u-${urgency(t)}`} onClick={() => openTask(t.id)}>
                  <span className="cal-day-title">{t.title}</span>
                  <span className="cal-day-meta">
                    {[t.client?.name, t.requester_ref?.name || t.requester, STATUS_LABEL[t.status]]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="team-section">
          <h3>Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="team-empty">No future-dated open tasks.</p>
          ) : (
            <ul className="cal-day-list">
              {upcoming.map((t) => (
                <li key={t.id} className={`u-${urgency(t)}`} onClick={() => openTask(t.id)}>
                  <span className="cal-day-title">{t.title}</span>
                  <span className="cal-day-meta">
                    {[dueLabel(t), t.client?.name, t.requester_ref?.name || t.requester]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
