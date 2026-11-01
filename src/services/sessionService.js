export async function getSession() {
  const response = await fetch('/api/session', { credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) {
    let message = 'Sign-in is temporarily unavailable. Please try again.';
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) return false;
  let session;
  try { session = await response.json(); } catch { return false; }
  return typeof session?.user?.email === 'string' && session.user.email.length > 0;
}
export function getSignInError() {
  const code = new URLSearchParams(window.location.search).get('auth_error');
  return ({not_configured:'Google sign-in is not configured yet.',not_allowed:'This Google account does not have administrator access.',expired:'Your sign-in attempt expired. Please try again.',cancelled:'Sign-in was cancelled. Please try again.',failed:'Unable to complete Google sign-in. Please try again.'})[code] || '';
}
export function startGoogleSignIn() { window.location.assign('/auth/login'); }
export async function signOut() {
  const response=await fetch('/auth/logout',{method:'POST',credentials:'same-origin'});
  if(!response.ok)throw new Error('Unable to sign out. Please try again.');
  window.location.assign('/');
}
