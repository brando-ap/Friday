import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { urgency, todayISO } from '../dates.js';
import { toCSV } from '../csv.js';
import AppShell from '../components/AppShell.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import TaskList from '../components/TaskList.jsx';
import TaskDetail from '../components/TaskDetail.jsx';
import FilterBar, { FILTER_DEFAULTS } from '../components/FilterBar.jsx';
import ImportDialog from '../components/ImportDialog.jsx';
import Team from './Team.jsx';
import Companies from './Companies.jsx';
import Calendar from './Calendar.jsx';
import Dashboard from './Dashboard.jsx';

const URGENCY_RANK = { overdue: 0, soon: 1, later: 2, none: 3, done: 4 };
const STATUS_CYCLE = ['not_started', 'in_progress', 'waiting', 'done'];
const EXPORT_COLUMNS = [
  'title', 'status', 'due_date', 'company', 'requester', 'requested_for',
  'location', 'assignee', 'recurrence', 'description', 'created_at', 'completed_at',
];
const SHORTCUTS = [
  ['n', 'New task — focus quick add'],
  ['j / k', 'Next / previous task'],
  ['e', "Cycle the selected task's status"],
  ['?', 'Show / hide this help'],
  ['Esc', 'Close help, or deselect the task'],
];

function filtersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const filters = { ...FILTER_DEFAULTS };
  for (const key of Object.keys(FILTER_DEFAULTS)) {
    if (params.has(key)) filters[key] = params.get(key);
  }
  return filters;
}

function ShortcutHelp({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-help" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Keyboard shortcuts</h2>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <table className="help-table">
          <tbody>
            {SHORTCUTS.map(([key, what]) => (
              <tr key={key}>
                <td><kbd>{key}</kbd></td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TaskApp() {
  const { session, loading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [requesters, setRequesters] = useState([]);
  const [members, setMembers] = useState([]);
  // ?task= lets the calendar (and bookmarks) deep-link straight into a task.
  const [selectedId, setSelectedId] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('task');
    return id ? Number(id) : null;
  });
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(filtersFromURL);
  const [showHelp, setShowHelp] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Bumped when something outside TaskDetail changes the task (e.g. the `e`
  // shortcut) so the open detail pane refetches.
  const [detailVersion, setDetailVersion] = useState(0);
  const quickAddRef = useRef(null);

  const path = window.location.pathname.replace(/\/+$/, '');
  const onBoard = path === '/app';

  // No session once loading settles -> bounce to the dedicated login page.
  useEffect(() => {
    if (!loading && !session) window.location.href = '/login';
  }, [loading, session]);

  const refresh = useCallback(async () => {
    try {
      // Directory/team failures shouldn't take the board down — tasks still render.
      const [t, cs, rs, team] = await Promise.all([
        api.listTasks(),
        api.listClients().catch(() => []),
        api.listRequesters().catch(() => []),
        api.getTeam().catch(() => null),
      ]);
      setTasks(t);
      setClients(cs);
      setRequesters(rs);
      setMembers(team?.members ?? []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (session && onBoard) refresh();
  }, [session, onBoard, refresh]);

  // Persist active filters in the URL so filtered views are bookmarkable.
  useEffect(() => {
    if (!onBoard) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== FILTER_DEFAULTS[key]) params.set(key, value);
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/app?${qs}` : '/app');
  }, [filters, onBoard]);

  const visible = useMemo(() => {
    let list = tasks;
    if (filters.status) list = list.filter((t) => t.status === filters.status);
    else if (!showDone) list = list.filter((t) => t.status !== 'done');
    if (filters.client) list = list.filter((t) => String(t.client_id ?? '') === filters.client);
    if (filters.requester) list = list.filter((t) => String(t.requester_id ?? '') === filters.requester);
    if (filters.assignee) list = list.filter((t) => t.assignee_id === filters.assignee);
    const q = filters.q.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    if (filters.sort === 'urgency') {
      list = [...list].sort(
        (a, b) =>
          URGENCY_RANK[urgency(a)] - URGENCY_RANK[urgency(b)] ||
          (a.due_date || '9999').localeCompare(b.due_date || '9999')
      );
    }
    return list;
  }, [tasks, filters, showDone]);

  const cycleStatus = useCallback(
    async (task) => {
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
      try {
        await api.updateTask(task.id, { status: next });
        setDetailVersion((v) => v + 1);
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    },
    [refresh]
  );

  // Keyboard shortcuts (board only): n, j/k, e, ?, Esc.
  useEffect(() => {
    if (!onBoard) return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing =
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
      if (typing) {
        if (e.key === 'Escape') el.blur();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp((v) => !v);
      } else if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (showImport) setShowImport(false);
        else setSelectedId(null);
      } else if (e.key === 'n') {
        e.preventDefault();
        quickAddRef.current?.focus();
      } else if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        if (visible.length === 0) return;
        const idx = visible.findIndex((t) => t.id === selectedId);
        let next;
        if (idx === -1) next = e.key === 'j' ? 0 : visible.length - 1;
        else next = e.key === 'j' ? Math.min(idx + 1, visible.length - 1) : Math.max(idx - 1, 0);
        setSelectedId(visible[next].id);
      } else if (e.key === 'e' && selectedId != null) {
        const task = tasks.find((t) => t.id === selectedId);
        if (task) cycleStatus(task);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBoard, visible, selectedId, showHelp, showImport, tasks, cycleStatus]);

  const handleCreate = async (data) => {
    try {
      const t = await api.createTask(data);
      await refresh();
      setSelectedId(t.id);
    } catch (e) {
      setError(e.message);
    }
  };

  // Exports exactly what's on screen — the current filtered, sorted list.
  const exportCSV = () => {
    const memberById = new Map(members.map((m) => [m.user_id, m]));
    const rows = visible.map((t) => ({
      title: t.title,
      status: t.status,
      due_date: t.due_date || '',
      company: t.client?.name || '',
      requester: t.requester_ref?.name || t.requester || '',
      requested_for: t.requested_for || '',
      location: t.location || '',
      assignee: memberById.get(t.assignee_id)?.email || '',
      recurrence: t.recurrence || '',
      description: t.description || '',
      created_at: t.created_at,
      completed_at: t.completed_at || '',
    }));
    const url = URL.createObjectURL(new Blob([toCSV(rows, EXPORT_COLUMNS)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `friday-tasks-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !session) return null; // brief flash while session resolves / redirect fires

  if (path === '/app/team') return <Team />;
  if (path === '/app/companies') return <Companies />;
  if (path === '/app/calendar') return <Calendar />;
  if (path === '/app/dashboard') return <Dashboard />;

  const openCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <AppShell
      active="board"
      title="Board"
      subtitle="The date-sorted morning view."
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
          <button
            className="kbd-hint"
            title="Keyboard shortcuts (?)"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
        </>
      }
    >
      <div className="app">
      {error && <div className="error">{error}</div>}

      <QuickAdd
        onCreate={handleCreate}
        requesters={requesters}
        clients={clients}
        titleRef={quickAddRef}
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        clients={clients}
        requesters={requesters}
        members={members}
        onExport={exportCSV}
        onImport={() => setShowImport(true)}
      />

      <div className={`layout ${selectedId != null ? 'detail-open' : ''}`}>
        <TaskList tasks={visible} selectedId={selectedId} onSelect={setSelectedId} members={members} />
        <TaskDetail
          taskId={selectedId}
          refreshKey={detailVersion}
          onChanged={refresh}
          onClose={() => setSelectedId(null)}
          requesters={requesters}
          clients={clients}
          members={members}
        />
      </div>

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
      {showImport && (
        <ImportDialog onClose={() => setShowImport(false)} onImported={refresh} />
      )}
      </div>
    </AppShell>
  );
}
