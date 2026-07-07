import React from 'react';
import { AuthProvider } from './auth/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import LogIn from './pages/LogIn.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import RequestForm from './pages/RequestForm.jsx';
import TaskApp from './pages/TaskApp.jsx';

// Only TaskApp reads useAuth() (it needs reactive session state to gate the
// board). The auth pages talk to Supabase directly on submit and don't need
// the provider — no reason to pay for a session check on every marketing/auth
// page load.
const ROUTES = [
  ['/login', LogIn],
  ['/forgot-password', ForgotPassword],
  ['/reset-password', ResetPassword],
  ['/accept-invite', AcceptInvite],
  ['/request', RequestForm],
];

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/app' || path.startsWith('/app/')) {
    return (
      <AuthProvider>
        <TaskApp />
      </AuthProvider>
    );
  }

  const Page = ROUTES.find(([route]) => route === path)?.[1];
  return Page ? <Page /> : <Landing />;
}
