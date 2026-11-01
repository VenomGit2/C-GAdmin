import { createAccessToken } from './access-crypto.mjs';
import { saveNewRequest } from './requestStorage.js';
const json = (body, status = 200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validateSubmission(body) {
 if (!body || typeof body.email !== 'string' || typeof body.reason !== 'string') return null;
 const email = body.email.trim().toLowerCase(); const reason = body.reason.trim();
 if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || reason.length<10 || reason.length>2000) return null;
 return {email,reason};
}
export async function deliverNotification(env,id) {
 const item=await env.DB.prepare('SELECT o.id,o.attempts,o.sent_at,o.kind,o.access_link_id,r.email,r.reason AS purpose,r.id AS request_id,r.status,r.version,r.current_grant,r.access_expires_at FROM notification_outbox o JOIN requests r ON r.id=o.request_id WHERE o.id=?').bind(id).first();
 if(!item || item.sent_at || item.attempts>=12 || !env.RESEND_API_KEY || !env.EMAIL_FROM)return;
 let to='dnyaneshwar@circuitgrain.shop';
 let subject='New Circuit and Grain access request';
 let text=`A new request is awaiting review.\n\nRequest: ${item.request_id}\nEmail: ${item.email}\nReason:\n${item.purpose}\n\nReview it at https://admin.circuitgrain.shop`;
 if(item.kind==='access'){
  if(!env.ACCESS_LINK_SECRET || env.ACCESS_LINK_SECRET.length<32)return;
  const grant=await env.DB.prepare('SELECT * FROM access_links WHERE id=?').bind(item.access_link_id).first();
  if(!grant || grant.used_at || Date.parse(grant.expires_at)<=Date.now() || item.status!=='approved' || item.version!==grant.request_version || item.current_grant!==grant.id || Date.parse(item.access_expires_at)<=Date.now()){
   await env.DB.prepare('UPDATE notification_outbox SET sent_at=? WHERE id=?').bind(new Date().toISOString(),id).run();return;
  }
  const token=await createAccessToken(grant,env.ACCESS_LINK_SECRET);
  to=item.email;subject='Your Circuit and Grain private access';
  text=`Your request has been approved.\n\nOpen your private link:\nhttps://circuitgrain.shop/access#token=${token}\n\nAccess expires: ${item.access_expires_at}\nActivate this link before: ${grant.expires_at}\n\nThe link can be used once and activates this browser only. Keep it private. If access is revoked, the website will no longer open.\n\nCircuit and Grain`;
 }
 await env.DB.prepare('UPDATE notification_outbox SET attempts=attempts+1 WHERE id=? AND sent_at IS NULL').bind(id).run();
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`request-${id}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,headers:{'Auto-Submitted':'auto-generated','X-CG-Notification':'1'},text}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){console.error('Request notification delivery failed',response.status);return;}
  await env.DB.prepare('UPDATE notification_outbox SET sent_at=? WHERE id=?').bind(new Date().toISOString(),id).run();
 }catch{console.error('Request notification delivery unavailable');}
}
export async function retryNotifications(env) {
 if (!env.DB) return;
 // Stop retries after 23 hours to stay within the mail provider's idempotency window.
 const {results} = await env.DB.prepare("SELECT id FROM notification_outbox WHERE sent_at IS NULL AND attempts<12 AND created_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','-23 hours') ORDER BY created_at LIMIT 20").all();
 for (const item of results) await deliverNotification(env,item.id);
}
export async function handlePublicRequest(request,env,ctx) {
 const url = new URL(request.url);
 if (url.pathname==='/public-api/config' && request.method==='GET') return json({siteKey:env.TURNSTILE_SITE_KEY || ''});
 if (url.pathname!=='/public-api/requests') return json({error:'Not found.'},404);
 if (request.method!=='POST') return json({error:'Method not allowed.'},405);
 if (request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Invalid request.'},403);
 const missing=['DB','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY'].filter(name=>!env[name]);
 if(missing.length){
  console.error(JSON.stringify({event:'request_configuration_missing',missing}));
  return json({error:'Requests are temporarily unavailable. Please try again later.'},503);
 }
 const text = await request.text(); if (text.length>8192) return json({error:'Request too large.'},413);
 let body; try {body=JSON.parse(text);} catch {return json({error:'Invalid request.'},400);}
 const fields = validateSubmission(body);
 if (!fields) return json({error:'Enter a valid email and a reason between 10 and 2,000 characters.'},400);
 if (body.website || typeof body.token!=='string' || !body.token || body.token.length>2048) return json({error:'Please complete the spam verification.'},400);
 try {
  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:body.token,remoteip:request.headers.get('CF-Connecting-IP') || undefined}),signal:AbortSignal.timeout(10000)});
  if (!verification.ok) return json({error:'Spam verification unavailable. Please retry.'},503);
  const result = await verification.json();
  if (!result.success || result.hostname!==url.hostname || result.action!=='request-access') return json({error:'Verification expired or failed. Please try again.'},400);
  const saved=await saveNewRequest(env,{email:fields.email,reason:fields.reason});
  if (!saved.inserted) return json({error:'A request already exists for this email. Please wait for review or contact the administrator.'},409);
  ctx.waitUntil(deliverNotification(env,saved.notificationId));
  return json({id:saved.id,status:'Pending'},201);
 } catch(error) {console.error(JSON.stringify({event:'request_submission_failed',errorType:error?.name || 'Error'}));return json({error:'Unable to submit your request. Please try again.'},503);}
}
