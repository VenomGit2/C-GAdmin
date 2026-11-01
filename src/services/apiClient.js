export async function apiRequest(url, options = {}, fallback = 'Unable to complete this request. Please try again.') {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error(fallback);
  let data;
  try { data = await response.json(); } catch { throw new Error(fallback); }
  if (!response.ok) throw new Error(data?.error || fallback);
  return data;
}
