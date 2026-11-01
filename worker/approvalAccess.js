import { deliverNotification } from './publicRequests.js';

export function validAccessExpiry(value, now = Date.now()) {
  if (typeof value !== 'string') return false;
  const expiry = Date.parse(value);
  return Number.isFinite(expiry) && expiry > now + 60000 && expiry <= now + 365 * 86400000;
}
export async function saveDecision(env,ctx,record,body,actor) {
  const approved = body.status === 'Approved';
  if (approved && !validAccessExpiry(body.expiresAt)) return {error:'Choose an expiry between one minute and one year from now.',status:400};
  if (approved && (!env.ACCESS_LINK_SECRET || env.ACCESS_LINK_SECRET.length<32 || !env.RESEND_API_KEY || !env.EMAIL_FROM)) return {error:'Approval email delivery is not configured.',status:503};
  const now=new Date().toISOString();
  const grantId=approved?crypto.randomUUID():null;
  const accessExpiry=approved?new Date(body.expiresAt).toISOString():null;
  const statements=[env.DB.prepare('UPDATE requests SET status=?,version=version+1,updated_at=?,reviewed_at=?,reviewed_by=?,decision_note=?,access_expires_at=?,current_grant=? WHERE id=? AND version=? AND status=?').bind(body.status.toLowerCase(),now,now,actor,body.reason.trim(),accessExpiry,grantId,record.id,body.version,record.status)];
  if(approved){
    const linkExpiry=new Date(Math.min(Date.parse(accessExpiry),Date.now()+86400000)).toISOString();
    statements.push(env.DB.prepare('INSERT INTO access_links(id,request_id,request_version,expires_at) SELECT ?,id,version,? FROM requests WHERE id=? AND current_grant=?').bind(grantId,linkExpiry,record.id,grantId));
    statements.push(env.DB.prepare("INSERT INTO notification_outbox(id,request_id,kind,access_link_id) SELECT ?,id,'access',? FROM requests WHERE id=? AND current_grant=?").bind(`access-${grantId}`,grantId,record.id,grantId));
  }
  const results=await env.DB.batch(statements);
  if(results[0].meta.changes!==1)return {error:'This request has changed. Refresh and try again.',status:409};
  if(approved)ctx.waitUntil(deliverNotification(env,`access-${grantId}`));
  return {ok:true};
}
