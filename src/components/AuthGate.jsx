import React, { useEffect, useState } from 'react';
import Dashboard from '../pages/Dashboard.jsx';
import Login from '../pages/Login.jsx';
import { getSession, signOut } from '../services/sessionService.js';

export default function AuthGate() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getSession().then(session => { if (active) setAuthenticated(session); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <div className="session-loading" role="status">Checking your session…</div>;
  if (!authenticated) return <Login error={error}/>;
  return <Dashboard onSignOut={async () => { try { await signOut(); setError(''); } catch(err) { setError(err.message); } finally { setAuthenticated(false); } }}/ >;
}
