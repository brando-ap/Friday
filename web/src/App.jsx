import React from 'react';
import Landing from './pages/Landing.jsx';
import TaskApp from './pages/TaskApp.jsx';

export default function App() {
  const isApp = window.location.pathname.replace(/\/+$/, '') === '/app'
    || window.location.pathname.startsWith('/app/');
  return isApp ? <TaskApp /> : <Landing />;
}
