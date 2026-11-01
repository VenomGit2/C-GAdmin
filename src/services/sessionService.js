export async function getSession() {
  const response = await fetch('/api/session', { credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) {
    let message = 'Sign-in is temporarily unavailable. Please try again.';
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  // A frontend-only preview may serve index.html for API paths. It is not a session.
  if (!response.headers.get('Content-Type')?.includes('application/json')) return false;
  let session;
  try { session = await response.json(); } catch { return false; }
  // The Worker verifies the identity and ADMIN_EMAILS before returning this endpoint.
  return typeof session?.user?.email === 'string' && session.user.email.length > 0;
}
export function startGoogleSignIn() { window.location.assign('/auth/login'); }
export function signOut() {
  window.location.assign('/cdn-cgi/access/logout');
}
