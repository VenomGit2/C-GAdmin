const encoder = new TextEncoder();
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
}
export async function hashToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
async function signingKey(secret) {
  if (!secret || secret.length < 32) throw new Error('Access signing key is not configured.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const payload = grant => encoder.encode(JSON.stringify([grant.id, grant.request_id, grant.request_version, grant.expires_at]));
export async function createAccessToken(grant, secret) {
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), payload(grant));
  const hex = Array.from(new Uint8Array(signature), value => value.toString(16).padStart(2, '0')).join('');
  return `${grant.id}.${hex}`;
}
export async function verifyAccessToken(grant, token, secret) {
  const [id, signature] = token.split('.');
  if (id !== grant.id || !/^[0-9a-f]{64}$/.test(signature || '')) return false;
  const bytes = Uint8Array.from(signature.match(/../g), value => parseInt(value, 16));
  return crypto.subtle.verify('HMAC', await signingKey(secret), bytes, payload(grant));
}
