import React, { useEffect, useState, useCallback } from 'react';
import { api, setAuthErrorHandler } from './api.js';
import { getToken, clearToken } from './auth.js';
import Login from './components/Login.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import TaskList from './components/TaskList.jsx';
import TaskDetail from './components/TaskDetail.jsx';

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState(null);

  // Any API call that returns 401 drops us back to the login screen.
  useEffect(() => {
    setAuthErrorHandler(() => setAuthed(false));
  }, []);

  const refresh = useCallback(async () => {
    try {
      setTasks(await api.listTasks());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  const handleCreate = async (data) => {
    try {
      const t = await api.createTask(data);
      await refresh();
      setSelectedId(t.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
    setTasks([]);
    setSelectedId(null);
  };

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

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
          <button className="logout" onClick={logout}>Sign out</button>
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
