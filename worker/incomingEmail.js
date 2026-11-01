import { saveNewRequest } from './requestStorage.js';
import PostalMime from 'postal-mime';
import { deliverNotification } from './publicRequests.js';

const MAX_EMAIL_BYTES = 1024 * 1024;
export function isAccessRequestSubject(subject) {
  return /\b(?:request(?:ing)?\s+(?:(?:for|to)\s+)?access|access\s+request(?:ed)?)\b/i.test(subject.replace(/\s+/g,' '));
}
export function plainText(html) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<\s*(br|\/p|\/div|\/li)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
}
export function hasTrustedAuthentication(headers) {
  // Only the first, Cloudflare-prepended result is trusted; never scan sender-supplied copies.
  const first = (headers.get('Authentication-Results') || '').split(/,\s*(?=[\w.-]+;)/)[0];
  return /^\s*mx\.cloudflare\.net\s*;/i.test(first) && /(?:^|;)\s*dmarc=pass(?:\s|;|$)/i.test(first);
}
async function messageKey(parts) {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function handleIncomingEmail(message,env,ctx) {
  const recipient = (env.INBOUND_REQUEST_ADDRESS || '').trim().toLowerCase();
  if (!recipient || !env.DB) { message.setReject('Request email integration is not configured.'); return; }
  if (message.to.toLowerCase() !== recipient) { message.setReject('Unknown request recipient.'); return; }
  // Optional inbox copy goes to a DIFFERENT verified external mailbox, never back to this route.
  if (env.INBOUND_FORWARD_TO) {
    if (env.INBOUND_FORWARD_TO.toLowerCase() === recipient) throw new Error('Inbound forwarding cannot target its own route.');
    await message.forward(env.INBOUND_FORWARD_TO);
  }
  if (message.rawSize > MAX_EMAIL_BYTES) { message.setReject('Message too large. Send your request without attachments (maximum 1 MB).'); return; }
  const auto = message.headers.get('Auto-Submitted');
  if ((auto && auto.toLowerCase() !== 'no') || message.headers.has('X-CG-Notification') || /\b(?:bulk|list|junk)\b/i.test(message.headers.get('Precedence') || '') || message.headers.has('List-Id') || message.headers.has('In-Reply-To')) return;
  if (!hasTrustedAuthentication(message.headers)) { message.setReject('Sender email authentication failed.'); return; }
  const raw = await new Response(message.raw).arrayBuffer();
  if (raw.byteLength > MAX_EMAIL_BYTES) { message.setReject('Message too large.'); return; }
  let mail;
  try { mail = await PostalMime.parse(raw); }
  catch { message.setReject('Unable to read this email. Please resend as plain text.'); return; }
  const subject = (mail.subject || '').trim();
  if (!isAccessRequestSubject(subject)) return;
  const email = (mail.from?.address || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message.setReject('A valid sender address is required.'); return; }
  const body = (mail.text || plainText(mail.html || '')).trim();
  if (body.length < 10) { message.setReject('Please include at least a sentence explaining your access request.'); return; }
  const key = await messageKey([recipient,email,mail.messageId || '',subject,body]);
  const saved=await saveNewRequest(env,{email,reason:body.slice(0,12000),source:'email',subject:subject.slice(0,500),messageKey:key});
  // The existing unique-email rule retains the original request and its review decision.
  if (saved.inserted) ctx.waitUntil(deliverNotification(env,saved.notificationId));
}
