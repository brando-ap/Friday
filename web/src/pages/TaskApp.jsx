import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import TaskList from '../components/TaskList.jsx';
import TaskDetail from '../components/TaskDetail.jsx';
import Team from './Team.jsx';

export default function TaskApp() {
  const { session, loading, signOut } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState(null);

  // No session once loading settles -> bounce to the dedicated login page.
  useEffect(() => {
    if (!loading && !session) window.location.href = '/login';
  }, [loading, session]);

  const refresh = useCallback(async () => {
    try {
      setTasks(await api.listTasks());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  const handleCreate = async (data) => {
    try {
      const t = await api.createTask(data);
      await refresh();
      setSelectedId(t.id);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading || !session) return null; // brief flash while session resolves / redirect fires

  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/app/team') return <Team />;

  const visible = showDone ? tasks : tasks.filter((t) => t.status !== 'done');
  const openCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Friday</h1>
        <div className="topbar-right">
          <span className="count-pill">{openCount} open</span>
          <label className="show-done">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Show done
          </label>
          <a className="team-link" href="/app/team">Team</a>
          <button className="logout" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <QuickAdd onCreate={handleCreate} />

      <div className="layout">
        <TaskList tasks={visible} selectedId={selectedId} onSelect={setSelectedId} />
        <TaskDetail
          taskId={selectedId}
          onChanged={refresh}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
