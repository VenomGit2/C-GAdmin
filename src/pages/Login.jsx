import React, { useState } from 'react';

import { startGoogleSignIn, getSignInError } from '../services/sessionService.js';

export default function Login({ error }) { const signInError=error || getSignInError();

  const [busy, setBusy] = useState(false);
  function submit(event) {
    event.preventDefault();
    setBusy(true);
    startGoogleSignIn();
  }
  return <div className="admin-login-shell"><header className="access-header"><a href="/" className="access-brand"><img src="/favicon.svg" width="32" height="32" alt=""/><span>Circuit and Grain</span></a></header><main className="login-page admin-login-page"><div className="login-card">
    <div className="login-heading"><p className="eyebrow">PRIVATE ADMINISTRATION</p><h1>Welcome back.</h1><p>Sign in to manage requests and private access.</p></div>
    <form onSubmit={submit}>
      <button type="submit" className="google-button" disabled={busy}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59A5.99 5.99 0 0 1 12 5.96Z"/></svg>
        {busy ? 'Redirecting…' : 'Sign in with Google'}
      </button>
      <p className="login-access-note">Access is limited to authorised administrators.</p>
      {signInError && <p className="login-message" role="alert">{signInError}</p>}
    </form>
    <footer className="login-footer">Circuit and Grain <a href="https://request.circuitgrain.shop">Request access</a></footer>
  </div></main><footer className="access-footer"><span>&copy; {new Date().getFullYear()} Circuit and Grain</span><span>Thoughtfully selected. Personally reviewed.</span></footer></div>;
}
