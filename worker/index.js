import { saveDecision } from './approvalAccess.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { canTransition } from '../src/utils/workflow.js';
import { handlePublicRequest, retryNotifications } from './publicRequests.js';
import { handleIncomingEmail } from './incomingEmail.js';
import { dashboardRecord, historyRecord, displayStatus } from './requestStorage.js';
const keySets = new Map();
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
async function authenticate(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) throw new Error('CONFIG');
  const issuer = new URL(env.ACCESS_TEAM_DOMAIN).origin;
  if (!issuer.endsWith('.cloudflareaccess.com') || !issuer.startsWith('https://')) throw new Error('CONFIG');
  if (!keySets.has(issuer)) keySets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new Error('AUTH');
  const { payload } = await jwtVerify(token, keySets.get(issuer), { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp','iat','sub','email'] });
  const admins = env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  if (typeof payload.email !== 'string' || !admins.includes(payload.email.toLowerCase())) throw new Error('FORBIDDEN');
  return payload.email;
}
export default {
 async email(message,env,ctx) { await handleIncomingEmail(message,env,ctx); },
 async scheduled(event,env,ctx) { ctx.waitUntil(retryNotifications(env)); },
 async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/public-api/')) return handlePublicRequest(request,env,ctx);
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/auth/')) {
   if (!['GET','HEAD'].includes(request.method)) return json({error:'Method not allowed.'},405);
   const response = await env.ASSETS.fetch(request);
   const headers = new Headers(response.headers);
   headers.set('Cache-Control','no-store'); headers.set('X-Content-Type-Options','nosniff'); headers.set('Referrer-Policy','same-origin');
   headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
   return new Response(response.body,{status:response.status,headers});
  }
  let actor;
  try { actor = await authenticate(request, env); }
  catch(error) { return json({ error: error.message === 'CONFIG' ? 'Cloudflare Access is not configured.' : error.message === 'FORBIDDEN' ? 'Administrator access is required.' : 'Sign in through Cloudflare Access to continue.' }, error.message === 'CONFIG' ? 503 : error.message === 'FORBIDDEN' ? 403 : 401); }
  if (url.pathname === '/auth/login' && request.method === 'GET') return new Response(null, {status:302,headers:{Location:'/', 'Cache-Control':'no-store'}});
  if (url.pathname.startsWith('/auth/')) return json({error:'Not found.'},404);
  if (url.pathname === '/api/session' && request.method === 'GET') return json({user:{email:actor}});
  if (!env.DB) return json({ error:'D1 database is not configured.' },503);
  try {
   if (url.pathname === '/api/requests' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id,email,reason,status,created_at,updated_at,version,source,email_subject,access_expires_at FROM requests ORDER BY created_at DESC').all();
    return json({ requests: results.map(dashboardRecord), user: {email:actor} });
   }
   const match = url.pathname.match(/^\/api\/requests\/([^/]+)(\/history)?$/);
   if (!match) return json({error:'Not found.'},404);
   const id = decodeURIComponent(match[1]);
   if (match[2] && request.method === 'GET') {
    const {results} = await env.DB.prepare('SELECT * FROM audit_log WHERE request_id = ? ORDER BY id DESC').bind(id).all(); return json(results.map(historyRecord));
   }
   if (match[2] || request.method !== 'PATCH') return json({error:'Method not allowed.'},405);
   if (request.headers.get('Origin') !== url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Invalid request origin or content type.'},403);
   const text = await request.text(); if (text.length > 4096) return json({error:'Request too large.'},413);
   let body; try { body = JSON.parse(text); } catch { return json({error:'Invalid JSON.'},400); }
   if (!body || typeof body !== 'object' || !Number.isInteger(body.version) || typeof body.status !== 'string' || typeof body.reason !== 'string' || body.reason.length>1000) return json({error:'Invalid decision.'},400);
   const record = await env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first();
   if (!record) return json({error:'Request not found.'},404);
   if (!canTransition(displayStatus(record.status),body.status)) return json({error:'This status change is not allowed.'},409);
   if (body.status !== 'Approved' && !body.reason.trim()) return json({error:'A decision note is required.'},400);
   const result=await saveDecision(env,ctx,record,body,actor);
   return result.error ? json({error:result.error},result.status) : json({ok:true});
  } catch { return json({error:'Unable to process this request. Please retry.'},500); }
 }
};
