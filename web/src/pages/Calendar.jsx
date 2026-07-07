import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { todayISO } from '../dates.js';
import AppShell from '../components/AppShell.jsx';

// Calendar per the design handoff (design_handoff_friday_calendar/): month
// grid + week view, right-hand detail panel, inline quick-add on day cells.
// Handoff adaptation: tasks are date-only, so Week view stacks all-day chips
// per day column instead of the prototype's time-of-day event blocks.

// Status colors from the handoff's design tokens; labels stay the app's own
// (its "Blocked" maps to our "Waiting").
const STATUS_META = {
  not_started: { bg: '#eaf4f1', fg: '#12756a', dot: '#2a9d8f', label: 'Not started' },
  in_progress: { bg: '#fbf3df', fg: '#9a6a12', dot: '#e6b84f', label: 'In progress' },
  waiting: { bg: '#fceee9', fg: '#c1512f', dot: '#e5603f', label: 'Waiting' },
  done: { bg: '#ebf4ee', fg: '#398a5a', dot: '#4bb377', label: 'Done' },
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REPEAT_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The Sunday of the week containing the given ISO date.
function sundayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return isoOf(d);
}

// Just enough rows to cover the month (5–6), per the handoff.
function monthCells(y, m /* 0-based */) {
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const rows = Math.ceil((firstDow + daysInMonth) / 7);
  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(y, m, 1 - firstDow + i);
    cells.push({ iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === m });
  }
  return cells;
}

function weekDays(weekStartISO) {
  const start = new Date(weekStartISO + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { iso: isoOf(d), day: d.getDate(), dow: WEEKDAYS[d.getDay()] };
  });
}

// "Jul 5 – 11, 2026" / "Jun 29 – Jul 5, 2026", per the prototype.
function weekRangeLabel(weekStartISO) {
  const start = new Date(weekStartISO + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const mon = (d) => d.toLocaleDateString(undefined, { month: 'short' });
  const a = `${mon(start)} ${start.getDate()}`;
  const b =
    start.getMonth() === end.getMonth() ? `${end.getDate()}` : `${mon(end)} ${end.getDate()}`;
  return `${a} – ${b}, ${end.getFullYear()}`;
}

// "Tue, Jul 7", per the handoff's detail panel.
const dueLabelFor = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'No date';

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Chip({ task, selected, onSelect }) {
  const s = STATUS_META[task.status] ?? STATUS_META.not_started;
  return (
    <button
      className={`cal-chip ${selected ? 'selected' : ''}`}
      style={{ background: s.bg, color: s.fg }}
      title={task.title}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(task.id);
      }}
    >
      <span className="cal-chip-dot" style={{ background: s.dot }} />
      <span className="cal-chip-title">{task.title}</span>
    </button>
  );
}

function DetailPanel({ task, onClose, onToggleStep }) {
  if (!task) {
    return (
      <aside className="cal-detail">
        <div className="cal-detail-empty">
          <div className="cal-detail-empty-title">No task selected</div>
          <div className="cal-detail-empty-sub">
            Pick a task on the calendar to see its details, steps, and activity.
          </div>
        </div>
      </aside>
    );
  }

  const s = STATUS_META[task.status] ?? STATUS_META.not_started;
  const steps = task.subtasks ?? [];
  const doneCount = steps.filter((st) => st.done).length;

  return (
    <aside className="cal-detail">
      <button className="cal-detail-close" title="Deselect" onClick={onClose}>×</button>
      <div className="cal-detail-status">
        <span className="cal-detail-dot" style={{ background: s.dot }} />
        <span className="cal-detail-pill" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
      </div>
      <div className="cal-detail-title">{task.title}</div>
      <div className="cal-detail-meta">
        <div><span className="k">Company</span><span className="v">{task.client?.name ?? '—'}</span></div>
        <div><span className="k">Requester</span><span className="v">{task.requester_ref?.name || task.requester || '—'}</span></div>
        <div><span className="k">Due</span><span className="v">{dueLabelFor(task.due_date)}</span></div>
        <div><span className="k">Repeat</span><span className="v">{REPEAT_LABEL[task.recurrence] ?? 'No repeat'}</span></div>
      </div>

      {steps.length > 0 && (
        <>
          <div className="cal-detail-h">Steps · {doneCount}/{steps.length}</div>
          <div className="cal-steps">
            {steps.map((st) => (
              <button
                key={st.id}
                className={`cal-step ${st.done ? 'done' : ''}`}
                onClick={() => onToggleStep(st)}
              >
                <span className="cal-step-box">{st.done ? '✓' : ''}</span>
                {st.title}
              </button>
            ))}
          </div>
        </>
      )}

      {(task.activity ?? []).length > 0 && (
        <>
          <div className="cal-detail-h">Activity</div>
          <div className="cal-activity">
            {task.activity.map((a) => (
              <div key={a.id}>
                {a.note} · <span className="when">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <a className="cal-detail-open-link" href={`/app?task=${task.id}`}>Open on the board ↗</a>
    </aside>
  );
}

export default function Calendar() {
  const today = todayISO();
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState(null);
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
  const [weekStart, setWeekStart] = useState(() => sundayOf(today));
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [addDay, setAddDay] = useState(null);
  const [addText, setAddText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const refresh = () =>
    Promise.all([api.listTasks(), api.listClients().catch(() => [])])
      .then(([t, cs]) => {
        setTasks(t);
        setClients(cs);
        setError(null);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  // The detail panel shows steps + activity, which the list payload doesn't carry.
  useEffect(() => {
    if (selectedId == null) {
      setSelected(null);
      return;
    }
    let stale = false;
    api.getTask(selectedId).then((t) => !stale && setSelected(t)).catch((e) => setError(e.message));
    return () => {
      stale = true;
    };
  }, [selectedId]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (!showDone && t.status === 'done') continue;
      if (statusFilter && t.status !== statusFilter) continue;
      if (clientFilter && String(t.client_id ?? '') !== clientFilter) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date).push(t);
    }
    return map;
  }, [tasks, showDone, statusFilter, clientFilter]);

  const openCount = tasks.filter((t) => t.status !== 'done').length;

  const rangeLabel =
    view === 'month'
      ? new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : weekRangeLabel(weekStart);

  const move = (delta) => {
    if (view === 'month') {
      const d = new Date(cursor.y, cursor.m + delta, 1);
      setCursor({ y: d.getFullYear(), m: d.getMonth() });
    } else {
      const d = new Date(weekStart + 'T00:00:00');
      d.setDate(d.getDate() + delta * 7);
      setWeekStart(isoOf(d));
    }
  };
  const goToday = () => {
    setCursor({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
    setWeekStart(sundayOf(today));
  };

  const startAdd = (iso) => {
    setAddDay(iso);
    setAddText('');
  };
  const newTask = () => {
    goToday();
    startAdd(today);
  };
  const submitAdd = async () => {
    const title = addText.trim();
    if (!title) return;
    try {
      await api.createTask({ title, due_date: addDay });
      setAddDay(null);
      setAddText('');
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };
  const onAddKey = (e) => {
    if (e.key === 'Enter') submitAdd();
    else if (e.key === 'Escape') {
      setAddDay(null);
      setAddText('');
    }
  };

  const toggleStep = async (st) => {
    try {
      const updated = await api.setSubtaskDone(st.id, !st.done);
      setSelected(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const addInput = (
    <input
      className="cal-add-input"
      value={addText}
      onChange={(e) => setAddText(e.target.value)}
      onKeyDown={onAddKey}
      onBlur={() => setAddDay(null)}
      placeholder="Task title, Enter to add"
      autoFocus
    />
  );

  return (
    <AppShell
      active="calendar"
      title="Calendar"
      subtitle="Everything your team is on, by the day."
      actions={
        <>
          <span className="count-pill">{openCount} open</span>
          <label className="show-done">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Show done
          </label>
        </>
      }
    >
      {error && <div className="error">{error}</div>}

      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <div className="cal-range">{rangeLabel}</div>
          <div className="cal-nav">
            <button onClick={() => move(-1)} title={view === 'month' ? 'Previous month' : 'Previous week'}>‹</button>
            <button onClick={() => move(1)} title={view === 'month' ? 'Next month' : 'Next week'}>›</button>
          </div>
          <button className="cal-today-btn" onClick={goToday}>Today</button>
        </div>
        <div className="cal-toolbar-right">
          <div className="cal-seg">
            <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Month</button>
            <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Week</button>
          </div>
          <select className="cal-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([value, s]) => (
              <option key={value} value={value}>{s.label}</option>
            ))}
          </select>
          <select className="cal-filter" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">All companies</option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
          <button className="cal-new-btn" onClick={newTask}>+ New task</button>
        </div>
      </div>

      <div className="cal-body">
        {view === 'month' ? (
          <div className="cal-card">
            <div className="cal-dow-row">
              {WEEKDAYS.map((d) => (
                <div key={d} className="cal-dow">{d}</div>
              ))}
            </div>
            <div className="cal-grid">
              {monthCells(cursor.y, cursor.m).map((cell) => (
                <div
                  key={cell.iso}
                  className={[
                    'cal-cell',
                    cell.inMonth ? '' : 'cal-out',
                    cell.iso === today && cell.inMonth ? 'cal-cell-today' : '',
                  ].join(' ')}
                  onClick={cell.inMonth ? () => startAdd(cell.iso) : undefined}
                >
                  <div className="cal-daynum-row">
                    {cell.iso === today && cell.inMonth ? (
                      <span className="cal-daynum-today">{cell.day}</span>
                    ) : (
                      <span className="cal-daynum">{cell.day}</span>
                    )}
                  </div>
                  <div className="cal-chips">
                    {cell.inMonth &&
                      (byDay.get(cell.iso) ?? []).map((t) => (
                        <Chip key={t.id} task={t} selected={t.id === selectedId} onSelect={setSelectedId} />
                      ))}
                    {addDay === cell.iso && addInput}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="cal-card">
            <div className="cal-week-head">
              {weekDays(weekStart).map((d) => (
                <div key={d.iso} className="cal-week-day">
                  <div className="cal-week-day-name">{d.dow}</div>
                  <div className="cal-week-date">
                    <span className={d.iso === today ? 'cal-week-today' : ''}>{d.day}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="cal-week-grid">
              {weekDays(weekStart).map((d) => (
                <div
                  key={d.iso}
                  className={`cal-week-col ${d.iso === today ? 'cal-cell-today' : ''}`}
                  onClick={() => startAdd(d.iso)}
                >
                  {(byDay.get(d.iso) ?? []).map((t) => (
                    <Chip key={t.id} task={t} selected={t.id === selectedId} onSelect={setSelectedId} />
                  ))}
                  {addDay === d.iso && addInput}
                </div>
              ))}
            </div>
          </div>
        )}

        <DetailPanel task={selected} onClose={() => setSelectedId(null)} onToggleStep={toggleStep} />
      </div>
    </AppShell>
  );
}
