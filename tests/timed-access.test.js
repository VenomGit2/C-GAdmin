import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validAccessExpiry,saveDecision} from '../worker/approvalAccess.js';
test('approval requires a finite future expiry',()=>{
 assert.equal(validAccessExpiry('not-a-date'),false);assert.equal(validAccessExpiry(new Date(Date.now()-1000).toISOString()),false);
 assert.equal(validAccessExpiry(new Date(Date.now()+86400000).toISOString()),true);
 assert.equal(validAccessExpiry(new Date(Date.now()+400*86400000).toISOString()),false);
});
test('approval without mail configuration cannot silently grant access',async()=>{
 const result=await saveDecision({}, {}, {id:1}, {status:'Approved',expiresAt:new Date(Date.now()+86400000).toISOString()},'admin@example.com');assert.equal(result.status,503);
});
test('stale approval cannot queue or send a link',async()=>{
 const env={ACCESS_LINK_SECRET:'long-test-secret-at-least-32-characters',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com',DB:{prepare:()=>({bind:()=>({})}),batch:async()=>[{meta:{changes:0}},{meta:{changes:0}},{meta:{changes:0}}]}};
 let tasks=0;const result=await saveDecision(env,{waitUntil(){tasks++;}},{id:1,status:'pending'},{status:'Approved',reason:'',version:0,expiresAt:new Date(Date.now()+86400000).toISOString()},'admin@example.com');assert.equal(result.status,409);assert.equal(tasks,0);
});

test('approval email is addressed to the applicant and contains a one-time link',async(t)=>{
 const {deliverNotification}=await import('../worker/publicRequests.js');
 const grant={id:crypto.randomUUID(),request_id:1,request_version:1,expires_at:new Date(Date.now()+3600000).toISOString()};
 const item={id:'outbox',attempts:0,kind:'access',access_link_id:grant.id,email:'visitor@example.com',status:'approved',version:1,current_grant:grant.id,access_expires_at:grant.expires_at};
 let sent;
 t.mock.method(globalThis,'fetch',async(url,options)=>{sent=JSON.parse(options.body);return Response.json({id:'mail'});});
 const env={ACCESS_LINK_SECRET:'test-secret-at-least-32-characters-long',RESEND_API_KEY:'test',EMAIL_FROM:'requests@example.com',DB:{prepare:sql=>({bind:()=>({first:async()=>sql.startsWith('SELECT o.')?item:grant,run:async()=>({meta:{changes:1}})})})}};
 await deliverNotification(env,'outbox');assert.deepEqual(sent.to,['visitor@example.com']);assert.match(sent.text,/https:\/\/circuitgrain.shop\/access#token=/);assert.equal(sent.headers['Auto-Submitted'],'auto-generated');assert.ok(!sent.text.includes(env.ACCESS_LINK_SECRET));
});
test('revocation cancels any unsent approval link notification',async(t)=>{
 const {deliverNotification}=await import('../worker/publicRequests.js');let sends=0;t.mock.method(globalThis,'fetch',async()=>{sends++;return Response.json({id:'mail'});});
 const item={attempts:0,kind:'access',access_link_id:'grant',status:'revoked'};
 const env={ACCESS_LINK_SECRET:'test-secret-at-least-32-characters-long',RESEND_API_KEY:'test',EMAIL_FROM:'requests@example.com',DB:{prepare:sql=>({bind:()=>({first:async()=>sql.startsWith('SELECT o.')?item:{id:'grant',expires_at:new Date(Date.now()+3600000).toISOString()},run:async()=>({})})})}};
 await deliverNotification(env,'outbox');assert.equal(sends,0);
});